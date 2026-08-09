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
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $operations = Operation::with(['product.category', 'warehouse', 'client', 'operationProducts.product', 'payments'])->orderBy('created_at', 'desc')->paginate($perPage);
        return response()->json($operations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'deposit_paid' => 'nullable|numeric|min:0',
            'deposit_payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'use_stock' => 'nullable|boolean',
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

        $isStockOrder = empty($validated['client_id']);

        $maxId = Operation::max('id') ?? 0;
        $opNo = 'OP-' . Carbon::now()->year . '-' . str_pad($maxId + 1, 4, '0', STR_PAD_LEFT);
        
        $warehouseId = $validated['warehouse_id'] ?? null;
        if (!$warehouseId) {
            $whRaw = $this->getWhRaw();
            if (!$whRaw) {
                $whFin = $this->getWhFin();
                $whRaw = Warehouse::where('id', '!=', $whFin ? $whFin->id : 0)->first();
            }
            $warehouseId = $whRaw ? $whRaw->id : (Warehouse::first() ? Warehouse::first()->id : null);
        }

        $operation = Operation::create([
            'operation_number' => $opNo,
            'product_id' => $validated['product_id'] ?? null,
            'quantity' => $validated['quantity'] ?? null,
            'warehouse_id' => $warehouseId,
            'client_id' => $validated['client_id'] ?? null,
            'deposit_paid' => $validated['deposit_paid'] ?? 0.00,
            'deposit_payment_method' => $validated['deposit_payment_method'] ?? null,
            'use_stock' => $validated['use_stock'] ?? false,
            'total_price' => $validated['total_price'] ?? null,
            'status' => $isStockOrder ? 'Completed' : 'Pending',
            'notes' => $validated['notes'] ?? null,
            'completion_date' => $isStockOrder ? Carbon::now() : null,
        ]);

        // Save products
        $productEntries = [];
        if (!empty($validated['products'])) {
            foreach ($validated['products'] as $prod) {
                $productEntries[] = \App\Models\OperationProduct::create([
                    'operation_id' => $operation->id,
                    'product_id' => $prod['product_id'],
                    'quantity' => $prod['quantity'],
                ]);
            }
        }
        
        if (count($productEntries) === 0 && !empty($operation->product_id) && !empty($operation->quantity)) {
            // Fallback for single product
            $productEntries[] = \App\Models\OperationProduct::create([
                'operation_id' => $operation->id,
                'product_id' => $operation->product_id,
                'quantity' => $operation->quantity,
            ]);
        }

        // For internal stock orders (no client, not for sale), deduct raw materials & directly add products to WSH-P (المنتجات) storage
        if ($isStockOrder && count($productEntries) > 0) {
            // 1. Calculate required raw materials
            $requiredMaterials = [];
            foreach ($productEntries as $entry) {
                $product = Product::with('materials')->find($entry->product_id);
                if (!$product) continue;
                $prodQty = (float) $entry->quantity;
                foreach ($product->materials as $material) {
                    if ($material->type === 'service') continue;
                    $req = $material->pivot->quantity * $prodQty;
                    if (!isset($requiredMaterials[$material->id])) {
                        $requiredMaterials[$material->id] = [
                            'material' => $material,
                            'required' => 0
                        ];
                    }
                    $requiredMaterials[$material->id]['required'] += $req;
                }
            }

            // 2. Check material stock availability
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $available = $material->calculateStock($warehouseId);
                if ($available < $required) {
                    return response()->json([
                        'message' => "عذراً، لا يمكن إتمام التخزين الداخلي لعدم توفر كمية كافية من مادة ({$material->name}). الكمية المطلوبة: {$required}، المتوفرة: {$available}"
                    ], 400);
                }
            }

            // 3. Deduct raw materials (Production_Consumption)
            $whProd = $this->getWhProd();
            $targetWarehouseId = $whProd ? $whProd->id : ($validated['warehouse_id'] ?? 1);
            $user = auth()->id();
            $maxId = InventoryMovement::max('id') ?? 0;

            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $mvNo = 'MV-' . str_pad(++$maxId, 5, '0', STR_PAD_LEFT);
                
                InventoryMovement::create([
                    'movement_number' => $mvNo,
                    'movement_date' => Carbon::now(),
                    'warehouse_id' => $warehouseId,
                    'material_id' => $material->id,
                    'product_id' => null,
                    'movement_type' => 'Production_Consumption',
                    'quantity' => $required,
                    'unit_cost' => $material->unit_cost,
                    'total_cost' => $required * $material->unit_cost,
                    'reference_number' => $operation->operation_number,
                    'notes' => 'استهلاك تصنيع تلقائي (تخزين داخلي) - أمر رقم ' . $operation->operation_number,
                    'created_by' => $user
                ]);

                $material->stock_quantity -= $required;
                $material->save();
            }

            // 4. Add finished products to WSH-P (المنتجات) storage
            foreach ($productEntries as $entry) {
                $product = Product::find($entry->product_id);
                if (!$product) continue;
                
                $qty = (float) $entry->quantity;
                $mvNo = 'MV-' . str_pad(++$maxId, 5, '0', STR_PAD_LEFT);

                InventoryMovement::create([
                    'movement_number' => $mvNo,
                    'movement_date' => Carbon::now(),
                    'warehouse_id' => $targetWarehouseId,
                    'material_id' => null,
                    'product_id' => $product->id,
                    'movement_type' => 'Purchase_Receipt',
                    'quantity' => $qty,
                    'unit_cost' => $product->unit_cost,
                    'total_cost' => $qty * $product->unit_cost,
                    'reference_number' => $operation->operation_number,
                    'notes' => 'توريد منتج للمخزون - أمر تخزين داخلي رقم ' . $operation->operation_number,
                    'created_by' => $user
                ]);

                $product->stock_quantity += $qty;
                $product->save();
            }

            return response()->json([
                'message' => 'تم إضافة المنتجات إلى مخزن المنتجات واستهلاك المواد الخام بنجاح',
                'operation' => $operation->load(['client', 'operationProducts.product'])
            ], 201);
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
        $whFin = $this->getWhFin();
        $whFinId = $whFin ? $whFin->id : $operation->warehouse_id;

        foreach ($items as $item) {
            $product = $item->product;
            
            $prodQty = (float)$item->quantity;
            if ($operation->use_stock) {
                $availableProductStock = (float)$product->calculateStock(null);
                $prodQty = max(0.00, $prodQty - $availableProductStock);
            }

            if ($prodQty <= 0) {
                continue;
            }

            foreach ($product->materials as $material) {
                // If it is a service, check if we need to exclude it or handle it
                if ($material->type === 'service') {
                    continue;
                }
                
                $requiredForProduct = $material->pivot->quantity * $prodQty;
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
        $operation = Operation::findOrFail($id);

        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن بدء العمليات المعلقة فقط.'], 400);
        }

        $operation->update([
            'status' => 'In_Progress',
            'start_date' => Carbon::now()
        ]);

        return response()->json([
            'message' => 'تم بدء عملية الإنتاج بنجاح وتغيير حالة الأمر إلى (قيد التنفيذ). سيتم خصم المواد وتوريد المنتجات عند إتمام التصنيع.',
            'operation' => $operation
        ]);
    }

    public function completeProduction(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product.materials', 'product.materials'])->findOrFail($id);

        if (!in_array($operation->status, ['Pending', 'In_Progress'])) {
            return response()->json(['message' => 'يمكن إكمال العمليات المعلقة أو قيد التنفيذ فقط.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $maxId = InventoryMovement::max('id') ?? 0;

            // 1. Prepare items to process
            $itemsToProcess = [];
            if ($operation->operationProducts && $operation->operationProducts->count() > 0) {
                foreach ($operation->operationProducts as $opProd) {
                    $itemsToProcess[] = [
                        'product' => $opProd->product,
                        'quantity' => (float)$opProd->quantity,
                    ];
                }
            } elseif ($operation->product) {
                $itemsToProcess[] = [
                    'product' => $operation->product,
                    'quantity' => (float)($operation->quantity ?? 1),
                ];
            }

            // 2. Aggregate required raw materials
            $requiredMaterials = [];
            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                if (!$product) continue;
                $prodQty = $item['quantity'];

                foreach ($product->materials as $material) {
                    if ($material->type === 'service') continue;
                    $req = $material->pivot->quantity * $prodQty;
                    if (!isset($requiredMaterials[$material->id])) {
                        $requiredMaterials[$material->id] = [
                            'material' => $material,
                            'required' => 0
                        ];
                    }
                    $requiredMaterials[$material->id]['required'] += $req;
                }
            }

            // 3. Check raw material stock availability
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $available = max((float)$material->stock_quantity, (float)$material->calculateStock($operation->warehouse_id));
                if ($available < $required) {
                    return response()->json([
                        'message' => "عذراً، لا يمكن إتمام التصنيع لعدم توفر كمية كافية من مادة ({$material->name}). الكمية المطلوبة: {$required}، المتوفرة: {$available}"
                    ], 400);
                }
            }

            // 4. Consume raw materials (Production_Consumption from raw material warehouse)
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $mvNo = 'MV-' . str_pad(++$maxId, 5, '0', STR_PAD_LEFT);

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
                    'notes' => 'استهلاك تصنيع تلقائي - إتمام أمر تشغيل رقم ' . $operation->operation_number,
                    'created_by' => $user
                ]);

                $material->stock_quantity -= $required;
                $material->save();
            }

            // 5. Add finished products to WH-FIN (طلبيات) storage
            $whFin = $this->getWhFin();
            $targetWarehouseId = $whFin ? $whFin->id : $operation->warehouse_id;

            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                if (!$product) continue;
                $toProduce = $item['quantity'];

                if ($toProduce > 0) {
                    $mvNo = 'MV-' . str_pad(++$maxId, 5, '0', STR_PAD_LEFT);

                    InventoryMovement::create([
                        'movement_number' => $mvNo,
                        'movement_date' => Carbon::now(),
                        'warehouse_id' => $targetWarehouseId,
                        'material_id' => null,
                        'product_id' => $product->id,
                        'movement_type' => 'Purchase_Receipt',
                        'quantity' => $toProduce,
                        'unit_cost' => $product->unit_cost,
                        'total_cost' => $toProduce * $product->unit_cost,
                        'reference_number' => $operation->operation_number,
                        'notes' => 'توريد منتج جاهز تلقائي - إتمام أمر تشغيل رقم ' . $operation->operation_number,
                        'created_by' => $user
                    ]);

                    $product->stock_quantity += $toProduce;
                    $product->save();
                }
            }

            // 6. Update operation status to Completed
            $operation->update([
                'status' => 'Completed',
                'completion_date' => Carbon::now()
            ]);

            return response()->json([
                'message' => 'تم إتمام عملية الإنتاج بنجاح، وخصم المواد الخام من المستودع، وتوريد المنتجات إلى مخزن المنتجات الجاهزة (طلبيات).',
                'operation' => $operation
            ]);
        });
    }

    public function deliverToClient(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product', 'product', 'client'])->findOrFail($id);

        if ($operation->status !== 'Completed') {
            return response()->json(['message' => 'يمكن تسليم أوامر الإنتاج المكتملة فقط للعملاء.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $whFin = $this->getWhFin();
            $targetWarehouseId = $whFin ? $whFin->id : $operation->warehouse_id;

            $maxId = InventoryMovement::max('id') ?? 0;
            $itemsToDeliver = [];
            $totalCogs = 0;

            if ($operation->operationProducts && $operation->operationProducts->count() > 0) {
                foreach ($operation->operationProducts as $opProd) {
                    $itemsToDeliver[] = [
                        'product' => $opProd->product,
                        'totalQty' => (float)$opProd->quantity,
                    ];
                }
            } elseif ($operation->product) {
                $itemsToDeliver[] = [
                    'product' => $operation->product,
                    'totalQty' => (float)($operation->quantity ?? 1),
                ];
            }

            foreach ($itemsToDeliver as $item) {
                $product = $item['product'];
                if (!$product) continue;

                $totalQty = $item['totalQty'];
                if ($totalQty > 0) {
                    $mvNo = 'MV-' . str_pad(++$maxId, 5, '0', STR_PAD_LEFT);
                    $itemCost = $totalQty * (float)$product->unit_cost;
                    $totalCogs += $itemCost;

                    InventoryMovement::create([
                        'movement_number' => $mvNo,
                        'movement_date' => Carbon::now(),
                        'warehouse_id' => $targetWarehouseId,
                        'material_id' => null,
                        'product_id' => $product->id,
                        'movement_type' => 'Sales_Issue',
                        'quantity' => $totalQty,
                        'unit_cost' => $product->unit_cost,
                        'total_cost' => $itemCost,
                        'reference_number' => $operation->operation_number,
                        'notes' => 'تسليم طلبية للعميل (' . ($operation->client->name ?? 'عميل') . ') - أمر إنتاج ' . $operation->operation_number,
                        'created_by' => $user
                    ]);

                    $product->stock_quantity = max(0, $product->stock_quantity - $totalQty);
                    $product->save();
                }
            }

            // Create Revenue record for Sales Page & P&L Income Statement
            $totalPrice = (float)($operation->total_price ?? $totalCogs);
            $revNo = 'REV-' . Carbon::now()->year . '-' . str_pad(\App\Models\Revenue::count() + 1, 4, '0', STR_PAD_LEFT);
            \App\Models\Revenue::create([
                'revenue_number' => $revNo,
                'amount' => $totalPrice,
                'cogs' => $totalCogs,
                'revenue_date' => Carbon::now()->toDateString(),
                'category' => 'مبيعات منتجات',
                'description' => 'بيع وتسليم طلبية لأمر الإنتاج ' . $operation->operation_number . ($operation->client ? ' للعميل (' . $operation->client->name . ')' : ''),
                'reference_number' => $operation->operation_number,
                'payment_method' => $operation->deposit_payment_method ?? 'cash',
                'client_id' => $operation->client_id,
            ]);

            $operation->update([
                'status' => 'Delivered',
            ]);

            return response()->json([
                'message' => 'تم تسليم الطلبية للعميل بنجاح، وخصم المنتجات من المخزن، وتسجيل إجمالي المبيعات وتكلفة البضاعة المباعة (COGS) في قائمة الدخل والمبيعات.',
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
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
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

    public function deletePayment(string $id, string $paymentId): JsonResponse
    {
        $operation = Operation::findOrFail($id);
        $payment = \App\Models\OperationPayment::where('operation_id', $operation->id)->findOrFail($paymentId);

        $amount = (float)$payment->amount_paid;
        $payment->delete();

        // Update deposit_paid if needed
        $totalPaidRemaining = $operation->payments()->sum('amount_paid');
        $operation->deposit_paid = max(0, $totalPaidRemaining);
        $operation->save();

        return response()->json([
            'message' => 'تم التراجع عن الدفعة وإلغاؤها بنجاح وتحديث الحسابات المالية.'
        ]);
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

    public function cancelProduction(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product', 'payments'])->findOrFail($id);

        if ($operation->status === 'Cancelled') {
            return response()->json(['message' => 'هذا الأمر ملغى بالفعل.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            // 1. Delete associated payments & revenue entries
            $operation->payments()->delete();
            \App\Models\Revenue::where('reference_number', $operation->operation_number)->delete();

            // Note: If order was Completed, produced products STAY in "طلبيات" (WH-FIN) and consumed materials STAY consumed as per requirement.

            // 2. Mark operation as Cancelled
            $operation->update([
                'status' => 'Cancelled',
                'deposit_paid' => 0.00,
            ]);

            return response()->json([
                'message' => 'تم إلغاء أمر التشغيل وإلغاء القيود المالية المتعلقة به بنجاح.'
            ]);
        });
    }

    public function destroy(string $id): JsonResponse
    {
        $operation = Operation::with(['payments'])->findOrFail($id);

        return DB::transaction(function () use ($operation) {
            // 1. Delete associated payments & revenue entries
            $operation->payments()->delete();
            \App\Models\Revenue::where('reference_number', $operation->operation_number)->delete();

            // Note: If order was Completed, produced products STAY in "طلبيات" (WH-FIN) and consumed materials STAY consumed as per requirement.

            // 2. Delete operation record
            $operation->delete();

            return response()->json([
                'message' => 'تم حذف أمر الإنتاج وإلغاء قيوده المالية بنجاح.'
            ]);
        });
    }

    private function getWhFin()
    {
        $wh = Warehouse::where('code', 'WH-FIN')->first();
        if ($wh) return $wh;

        $wh = Warehouse::where('name', 'like', '%طلبيات%')->first();
        if ($wh) return $wh;

        return Warehouse::where('name', 'like', '%طلب%')->first();
    }

    private function getWhProd()
    {
        $wh = Warehouse::where('code', 'WSH-P')->first();
        if ($wh) return $wh;

        $wh = Warehouse::where('code', 'WSHP')->first();
        if ($wh) return $wh;

        $wh = Warehouse::where('name', 'like', '%المنتجات%')->first();
        if ($wh) return $wh;

        return Warehouse::where('name', 'like', '%منتج%')->first();
    }

    private function getWhRaw()
    {
        $wh = Warehouse::where('code', 'WSH-M')->first();
        if ($wh) return $wh;

        $wh = Warehouse::where('code', 'WH-RAW')->first();
        if ($wh) return $wh;

        $wh = Warehouse::where('name', 'like', '%مواد%')->first();
        if ($wh) return $wh;

        return Warehouse::where('name', 'like', '%خام%')->first();
    }
}
