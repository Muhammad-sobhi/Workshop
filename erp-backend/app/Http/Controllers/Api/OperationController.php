<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Operation;
use App\Models\Product;
use App\Models\Material;
use App\Models\InventoryMovement;
use App\Models\Warehouse;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OperationController extends Controller
{
    public function index(): JsonResponse
    {
        $operations = Operation::with(['product.category', 'warehouse', 'client', 'operationProducts.product', 'payments'])->orderBy('created_at', 'desc')->paginate(50);
        return response()->json($operations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'deposit_paid' => 'nullable|numeric|min:0',
            'total_price' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            // Allow single product for fallback
            'product_id' => 'nullable|exists:products,id',
            'quantity' => 'nullable|numeric|min:0.01',
            // Multiple products array
            'products' => 'nullable|array',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|numeric|min:0.01',
        ]);

        $opNo = 'OP-' . Carbon::now()->year . '-' . str_pad(Operation::count() + 1, 4, '0', STR_PAD_LEFT);
        
        $operation = Operation::create([
            'operation_number' => $opNo,
            'product_id' => $validated['product_id'] ?? null,
            'quantity' => $validated['quantity'] ?? null,
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'client_id' => $validated['client_id'] ?? null,
            'deposit_paid' => $validated['deposit_paid'] ?? 0.00,
            'total_price' => $validated['total_price'] ?? null,
            'status' => 'Pending',
            'notes' => $validated['notes'] ?? null,
        ]);

        // Save multiple products
        if (!empty($validated['products'])) {
            foreach ($validated['products'] as $prod) {
                \App\Models\OperationProduct::create([
                    'operation_id' => $operation->id,
                    'product_id' => $prod['product_id'],
                    'quantity' => $prod['quantity'],
                ]);
            }
        } elseif (!empty($validated['product_id']) && !empty($validated['quantity'])) {
            // Fallback for single product
            \App\Models\OperationProduct::create([
                'operation_id' => $operation->id,
                'product_id' => $validated['product_id'],
                'quantity' => $validated['quantity'],
            ]);
        }

        return response()->json([
            'message' => 'تم إنشاء عملية الإنتاج بنجاح كمسودة معلقة',
            'operation' => $operation->load(['client', 'operationProducts.product'])
        ], 201);
    }

    public function checkMaterials(string $id): JsonResponse
    {
        $operation = Operation::with('operationProducts.product.materials')->findOrFail($id);
        
        $materialsCheck = [];
        $hasShortage = false;
        $suggestions = [];
        $requiredMaterials = [];

        // Aggregate required materials across all products in the operation
        $items = $operation->operationProducts;
        foreach ($items as $item) {
            $product = $item->product;
            foreach ($product->materials as $material) {
                // If it is a service, check if we need to exclude it or handle it
                if ($material->type === 'service') {
                    continue;
                }
                
                $requiredForProduct = $material->pivot->quantity * $item->quantity;
                if (!isset($requiredMaterials[$material->id])) {
                    $requiredMaterials[$material->id] = [
                        'material' => $material,
                        'required' => 0
                    ];
                }
                $requiredMaterials[$material->id]['required'] += $requiredForProduct;
            }
        }

        // Check stock for each aggregated material
        foreach ($requiredMaterials as $matId => $data) {
            $material = $data['material'];
            $required = $data['required'];
            $available = $material->calculateStock($operation->warehouse_id);
            $shortage = max(0, $required - $available);

            if ($shortage > 0) {
                $hasShortage = true;
                $suggestions[] = [
                    'material_id' => $material->id,
                    'material_name' => $material->name,
                    'shortage_qty' => $shortage,
                    'unit' => $material->unit,
                    'estimated_cost' => $shortage * $material->unit_cost,
                ];
            }

            $materialsCheck[] = [
                'id' => $material->id,
                'name' => $material->name,
                'sku' => $material->sku,
                'unit' => $material->unit,
                'required_quantity' => (float)$required,
                'available_quantity' => (float)$available,
                'shortage_quantity' => (float)$shortage,
            ];
        }

        return response()->json([
            'operation_id' => $operation->id,
            'operation_number' => $operation->operation_number,
            'product_name' => $items->count() === 1 ? $items->first()->product->name : 'متعدد المنتجات (' . $items->count() . ' أصناف)',
            'quantity' => (float)($items->sum('quantity')),
            'warehouse_id' => $operation->warehouse_id,
            'warehouse_name' => $operation->warehouse->name ?? '',
            'has_shortage' => $hasShortage,
            'materials' => $materialsCheck,
            'suggestions' => $suggestions,
        ]);
    }

    public function startProduction(string $id): JsonResponse
    {
        $operation = Operation::with('operationProducts.product.materials')->findOrFail($id);

        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن بدء العمليات المعلقة فقط.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $requiredMaterials = [];

            // Aggregate requirements
            foreach ($operation->operationProducts as $item) {
                foreach ($item->product->materials as $material) {
                    if ($material->type === 'service') {
                        continue;
                    }
                    $required = $material->pivot->quantity * $item->quantity;
                    if (!isset($requiredMaterials[$material->id])) {
                        $requiredMaterials[$material->id] = [
                            'material' => $material,
                            'required' => 0
                        ];
                    }
                    $requiredMaterials[$material->id]['required'] += $required;
                }
            }

            // Check availability
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $available = $material->calculateStock($operation->warehouse_id);
                
                if ($available < $required) {
                    return response()->json([
                        'message' => "عذراً، لا يمكن بدء الإنتاج لعدم توفر كمية كافية من مادة ({$material->name}). الكمية المطلوبة: {$required}، المتوفرة: {$available}"
                    ], 400);
                }
            }

            // Consume materials
            $mvCount = InventoryMovement::count();
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $mvNo = 'MV-' . str_pad(++$mvCount, 5, '0', STR_PAD_LEFT);
                
                InventoryMovement::create([
                    'movement_number' => $mvNo,
                    'movement_date' => Carbon::now(),
                    'warehouse_id' => $operation->warehouse_id,
                    'material_id' => $material->id,
                    'product_id' => null,
                    'movement_type' => 'Production_Consumption',
                    'quantity' => $required,
                    'unit_cost' => $material->unit_cost,
                    'total_cost' => $required * $material->unit_cost,
                    'reference_number' => $operation->operation_number,
                    'notes' => 'استهلاك تصنيع تلقائي - أمر تشغيل رقم ' . $operation->operation_number,
                    'created_by' => $user
                ]);

                $material->stock_quantity -= $required;
                $material->save();
            }

            // Update status
            $operation->update([
                'status' => 'In_Progress',
                'start_date' => Carbon::now()
            ]);

            return response()->json([
                'message' => 'تم بدء عملية الإنتاج بنجاح وتم صرف المواد الخام من المستودع تلقائياً.',
                'operation' => $operation
            ]);
        });
    }

    public function completeProduction(string $id): JsonResponse
    {
        $operation = Operation::with('operationProducts.product')->findOrFail($id);

        if ($operation->status !== 'In_Progress') {
            return response()->json(['message' => 'يمكن إكمال العمليات التي هي قيد التنفيذ فقط.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();

            $whFin = Warehouse::where('code', 'WH-FIN')->first();
            $targetWarehouseId = $whFin ? $whFin->id : $operation->warehouse_id;

            // Log finished product inventory receipt for each product
            $mvCount = InventoryMovement::count();
            foreach ($operation->operationProducts as $item) {
                $product = $item->product;
                $mvNo = 'MV-' . str_pad(++$mvCount, 5, '0', STR_PAD_LEFT);
                
                InventoryMovement::create([
                    'movement_number' => $mvNo,
                    'movement_date' => Carbon::now(),
                    'warehouse_id' => $targetWarehouseId,
                    'material_id' => null,
                    'product_id' => $product->id,
                    'movement_type' => 'Purchase_Receipt',
                    'quantity' => $item->quantity,
                    'unit_cost' => $product->unit_cost,
                    'total_cost' => $item->quantity * $product->unit_cost,
                    'reference_number' => $operation->operation_number,
                    'notes' => 'توريد منتج جاهز تلقائي - إتمام أمر تشغيل رقم ' . $operation->operation_number,
                    'created_by' => $user
                ]);

                $product->stock_quantity += $item->quantity;
                $product->save();
            }

            // Update status
            $operation->update([
                'status' => 'Completed',
                'completion_date' => Carbon::now()
            ]);

            return response()->json([
                'message' => 'تم إتمام عملية الإنتاج بنجاح وإضافة المنتجات النهائية إلى مستودع المنتجات الجاهزة تلقائياً.',
                'operation' => $operation
            ]);
        });
    }

    public function addPayment(Request $request, string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);
        
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'note' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer',
        ]);

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $path = $request->file('receipt')->store('receipts', 'public');
            $receiptPath = '/storage/' . $path;
        }

        $payment = \App\Models\OperationPayment::create([
            'operation_id' => $operation->id,
            'amount_paid' => $validated['amount'],
            'payment_date' => $validated['payment_date'],
            'notes' => $validated['note'] ?? null,
            'receipt_path' => $receiptPath,
            'payment_method' => $validated['payment_method'] ?? null,
        ]);

        return response()->json([
            'message' => 'تم تسجيل الدفعة بنجاح',
            'payment' => $payment
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);
        
        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن تعديل العمليات المعلقة فقط.'], 400);
        }

        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'notes' => 'nullable|string',
            'total_price' => 'nullable|numeric|min:0',
            'deposit_paid' => 'nullable|numeric|min:0',
        ]);

        $operation->update($validated);

        return response()->json([
            'message' => 'تم تحديث أمر الإنتاج بنجاح',
            'operation' => $operation->load(['client', 'warehouse'])
        ]);
    }
}
