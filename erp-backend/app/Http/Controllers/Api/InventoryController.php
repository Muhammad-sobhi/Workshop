<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\InventorySnapshot;
use App\Services\InventoryService;
use App\Models\Material;
use App\Models\Product;
use App\Models\InventoryMovement;
use App\Models\Warehouse;
use App\Models\MaterialCategory;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index(): JsonResponse
    {
        // Combined inventory list
        $result = [];
        
        $materials = Material::with('category')->get();
        $matSnapshot = InventorySnapshot::for('material', $materials);
        foreach ($materials as $mat) {
            $unitCost = (float)$matSnapshot->storedUnitCost($mat);
            $result[] = [
                'id' => $mat->id,
                'type' => $mat->type,
                'sku' => $mat->sku,
                'name' => $mat->name,
                'quantity' => (float)$matSnapshot->calculateStock($mat),
                'unit' => $mat->unit,
                'price' => $unitCost,
                'category' => $mat->category->name ?? 'غير مصنف',
            ];
        }

        $products = Product::with('category')->get();
        $prodSnapshot = InventorySnapshot::for('product', $products);
        foreach ($products as $prod) {
            $unitCost = (float)$prodSnapshot->storedUnitCost($prod);
            $result[] = [
                'id' => $prod->id,
                'type' => 'product',
                'sku' => $prod->sku,
                'name' => $prod->name,
                'quantity' => (float)$prodSnapshot->calculateStock($prod),
                'unit' => $prod->unit,
                'price' => $unitCost,
                'unit_cost' => $unitCost,
                'sale_price' => (float)$prod->sale_price,
                'category' => $prod->category->name ?? 'غير مصنف',
            ];
        }

        return response()->json($result);
    }

    public function getMaterials(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 200);
        $paginator = Material::with('category')->paginate($perPage);
        $snapshot = InventorySnapshot::for('material', $paginator->getCollection());
        $paginator->setCollection(
            $paginator->getCollection()->map(function ($mat) use ($snapshot) {
                return [
                    'id' => $mat->id,
                    'name' => $mat->name,
                    'code' => $mat->code,
                    'sku' => $mat->sku,
                    'unit' => $mat->unit,
                    'unit_cost' => (float)$snapshot->storedUnitCost($mat),
                    'quantity' => (float)$snapshot->calculateStock($mat),
                    'category' => $mat->category->name ?? 'غير مصنف',
                ];
            })
        );
        return response()->json($paginator);
    }

    public function getProducts(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 200);
        $paginator = Product::with('category')->paginate($perPage);
        $wshpId = \App\Models\Warehouse::productsWarehouse()?->id;
        $snapshot = InventorySnapshot::for('product', $paginator->getCollection());

        $paginator->setCollection(
            $paginator->getCollection()->map(function ($prod) use ($wshpId, $snapshot) {
                return [
                    'id' => $prod->id,
                    'name' => $prod->name,
                    'code' => $prod->code,
                    'sku' => $prod->sku,
                    'unit' => $prod->unit,
                    'unit_cost' => (float)$snapshot->storedUnitCost($prod),
                    'sale_price' => (float)$prod->sale_price,
                    'quantity' => (float)$snapshot->calculateStock($prod),
                    'stock_wshp' => $wshpId ? $snapshot->liveStock($prod, $wshpId) : (float)$snapshot->calculateStock($prod),
                    'category' => $prod->category->name ?? 'غير مصنف',
                    'image_path' => $prod->image_path,
                ];
            })
        );
        return response()->json($paginator);
    }

    public function getMovements(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $query = InventoryMovement::with(['warehouse', 'material', 'product', 'user'])
            ->orderBy('movement_date', 'desc');

        if ($request->filled('start_date')) {
            $query->whereDate('movement_date', '>=', $request->query('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('movement_date', '<=', $request->query('end_date'));
        }

        $paginator = $query->paginate($perPage);
        $paginator->setCollection(
            $paginator->getCollection()->map(function ($m) {
                $itemName = $m->material ? $m->material->name : ($m->product ? $m->product->name : '');
                $itemCode = $m->material ? $m->material->code : ($m->product ? $m->product->code : '');
                $itemType = $m->material ? 'material' : 'product';
                return [
                    'id' => $m->id,
                    'movement_number' => $m->movement_number,
                    'movement_date' => $m->movement_date,
                    'warehouse_id' => $m->warehouse_id,
                    'warehouse_name' => $m->warehouse->name ?? '',
                    'item_id' => $m->material_id ?: $m->product_id,
                    'item_name' => $itemName,
                    'item_code' => $itemCode,
                    'item_type' => $itemType,
                    'movement_type' => $m->movement_type,
                    'movement_type_text' => $this->translateType($m->movement_type),
                    'quantity' => (float)$m->quantity,
                    'unit_cost' => (float)$m->unit_cost,
                    'total_cost' => (float)$m->total_cost,
                    'reference_number' => $m->reference_number,
                    'notes' => $m->notes,
                    'created_by_name' => $m->user->name ?? 'مدير النظام',
                ];
            })
        );
        return response()->json($paginator);
    }

    public function storeMovement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => 'required|exists:warehouses,id',
            'item_id' => 'required|integer',
            'item_type' => 'required|in:material,product',
            'movement_type' => 'required|string|in:Initial_Balance,Stock_Adjustment,Damaged,Supplier_Return,Transfer',
            'quantity' => 'required|numeric|min:0.01',
            'unit_cost' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
            'reference_number' => 'nullable|string',
            
            // Required for warehouse transfer
            'target_warehouse_id' => 'nullable|exists:warehouses,id|different:warehouse_id',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = auth()->id();
            
            $isMaterial = $validated['item_type'] === 'material';
            $materialId = $isMaterial ? $validated['item_id'] : null;
            $productId = !$isMaterial ? $validated['item_id'] : null;
            
            $item = $isMaterial 
                ? Material::findOrFail($validated['item_id'])
                : Product::findOrFail($validated['item_id']);

            if (isset($item->type) && $item->type === 'service') {
                return response()->json(['message' => 'الخدمات لا يتم تخزينها في المستودعات ولا تسجل لها حركات مخزنية.'], 400);
            }

            // Strict rule: Materials CANNOT be transferred to another storage
            if ($isMaterial && $validated['movement_type'] === 'Transfer') {
                return response()->json([
                    'message' => 'غير مسموح بنقل أو تحويل المواد الخام بين المستودعات. المواد الخام مكانها المعتمد حصرياً هو مستودع المواد الخام الرئيسي.'
                ], 422);
            }

            // Special handling for Transfer Between Warehouses (Products Only)
            if ($validated['movement_type'] === 'Transfer') {
                if (empty($validated['target_warehouse_id'])) {
                    return response()->json(['message' => 'المستودع المستهدف مطلوب لعمليات التحويل المخزني.'], 400);
                }

                // Check source warehouse stock
                $currentStock = $item->calculateStock($validated['warehouse_id']);
                
                if ($currentStock < $validated['quantity']) {
                    return response()->json(['message' => 'الكمية غير كافية في مستودع المصدر لإتمام عملية التحويل.'], 400);
                }

                $refNo = !empty($validated['reference_number']) ? $validated['reference_number'] : ('TR-' . time());
                $userNotes = !empty($validated['notes']) ? $validated['notes'] : '';

                // Recorded through the stock service so the source can never go below zero
                $moveOut = InventoryService::recordMovement(
                    warehouseId: (int) $validated['warehouse_id'],
                    materialId: $materialId,
                    productId: $productId,
                    movementType: 'Transfer_Out',
                    quantity: (float) $validated['quantity'],
                    unitCost: (float) $validated['unit_cost'],
                    referenceNumber: $refNo,
                    notes: 'تحويل مخزني صادر إلى مستودع رقم ' . $validated['target_warehouse_id'] . ($userNotes ? '. ' . $userNotes : ''),
                    userId: $user
                );
                $moveIn = InventoryService::recordMovement(
                    warehouseId: (int) $validated['target_warehouse_id'],
                    materialId: $materialId,
                    productId: $productId,
                    movementType: 'Transfer_In',
                    quantity: (float) $validated['quantity'],
                    unitCost: (float) $validated['unit_cost'],
                    referenceNumber: $refNo,
                    notes: 'تحويل مخزني وارد من مستودع رقم ' . $validated['warehouse_id'] . ($userNotes ? '. ' . $userNotes : ''),
                    userId: $user
                );

                return response()->json([
                    'message' => 'تم تسجيل عملية التحويل المخزني بنجاح بين المستودعين',
                    'movement_out' => $moveOut,
                    'movement_in' => $moveIn
                ], 201);
            }

            // Normal movement logging (Stock_Adjustment, Damaged, Initial_Balance)
            // If movement is Damaged, it decreases stock, so we treat it as outgoing
            // If it is Stock_Adjustment, we check if quantity is negative/positive. For safety, we accept positive quantity and the user selects if it is an increase or decrease in stock!
            $mvType = $validated['movement_type'];
            
            // Check stock if it is a decreasing movement
            if (in_array($mvType, ['Damaged', 'Supplier_Return'])) {
                $currentStock = $item->calculateStock($validated['warehouse_id']);
                if ($currentStock < $validated['quantity']) {
                    return response()->json(['message' => 'المخزون المتوفر غير كافٍ للصرف.'], 400);
                }
            }

            $userRef = !empty($validated['reference_number']) ? $validated['reference_number'] : ('MAN-' . time());

            // Stock service: outgoing types are checked against the warehouse balance, cache synced
            $movement = InventoryService::recordMovement(
                warehouseId: (int) $validated['warehouse_id'],
                materialId: $materialId,
                productId: $productId,
                movementType: $mvType,
                quantity: (float) $validated['quantity'],
                unitCost: (float) $validated['unit_cost'],
                referenceNumber: $userRef,
                notes: $validated['notes'] ?? '',
                userId: $user
            );

            return response()->json([
                'message' => 'تم تسجيل حركة المخزون بنجاح',
                'movement' => $movement
            ], 201);
        });
    }

    public function getLedger(string $type, string $id): JsonResponse
    {
        $isMaterial = $type === 'material';
        
        $item = $isMaterial 
            ? Material::findOrFail($id)
            : Product::findOrFail($id);

        $query = InventoryMovement::with('warehouse');
        if ($isMaterial) {
            $query->where('material_id', $id);
        } else {
            $query->where('product_id', $id);
        }

        // Get movements in chronological order
        $movements = $query->orderBy('movement_date', 'asc')->get();

        $incomingTypes = ['Initial_Balance', 'Purchase_Receipt', 'Transfer_In'];
        $outgoingTypes = ['Production_Consumption', 'Supplier_Return', 'Damaged', 'Transfer_Out'];

        $runningBalance = 0;
        $ledger = [];

        foreach ($movements as $m) {
            $qty = (float)$m->quantity;
            $qtyIn = 0;
            $qtyOut = 0;
            
            // Check if movement is incoming or outgoing
            if (in_array($m->movement_type, $incomingTypes)) {
                $qtyIn = $qty;
                $runningBalance += $qty;
            } elseif (in_array($m->movement_type, $outgoingTypes)) {
                $qtyOut = $qty;
                $runningBalance -= $qty;
            } elseif ($m->movement_type === 'Stock_Adjustment') {
                // Determine direction based on quantity sign or note
                // Let's assume quantity is stored positive, we check notes or let's assume signed quantity
                if ($qty > 0) {
                    $qtyIn = $qty;
                    $runningBalance += $qty;
                } else {
                    $qtyOut = abs($qty);
                    $runningBalance -= abs($qty);
                }
            }

            $ledger[] = [
                'id' => $m->id,
                'date' => Carbon::parse($m->movement_date)->toDateString(),
                'movement_type' => $m->movement_type,
                'movement_type_text' => $this->translateType($m->movement_type),
                'quantity_in' => $qtyIn,
                'quantity_out' => $qtyOut,
                'running_balance' => $runningBalance,
                'reference_number' => $m->reference_number ?: '-',
                'warehouse_name' => $m->warehouse->name ?? '',
                'notes' => $m->notes,
            ];
        }

        // Reverse to display latest first in the UI
        $ledger = array_reverse($ledger);

        return response()->json([
            'item' => [
                'id' => $item->id,
                'name' => $item->name,
                'code' => $item->code,
                'sku' => $item->sku,
                'unit' => $item->unit,
                'unit_cost' => (float)$item->unit_cost,
                'type' => $type,
                'current_stock' => $runningBalance,
            ],
            'ledger' => $ledger
        ]);
    }

    public function bulkInitialStock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'materials' => 'nullable|array',
            'materials.*.id' => 'required|exists:materials,id',
            'materials.*.initial_stock' => 'required|numeric|min:0',
            'products' => 'nullable|array',
            'products.*.id' => 'required|exists:products,id',
            'products.*.initial_stock' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated) {
            $whMat = Warehouse::rawMaterialsWarehouse();

            $whFin = Warehouse::productsWarehouse();

            // Each typed quantity is the wanted stock: only the difference is recorded
            foreach ($validated['materials'] ?? [] as $item) {
                $mat = Material::find($item['id']);
                if ($mat && $whMat && $mat->type !== 'service') {
                    InventoryService::applyEditedStock('material', $mat->id, $whMat->id, (float) $mat->stock_quantity, (float) $item['initial_stock'], (float) $mat->unit_cost);
                }
            }
            foreach ($validated['products'] ?? [] as $item) {
                $prod = Product::find($item['id']);
                if ($prod && $whFin) {
                    InventoryService::applyEditedStock('product', $prod->id, $whFin->id, (float) $prod->calculateStock(), (float) $item['initial_stock'], (float) $prod->unit_cost);
                }
            }

            return response()->json([
                'message' => 'تم حفظ وتحديث أرصدة أول المدة بنجاح'
            ]);
        });
    }

    private function translateType(string $type): string
    {
        return match ($type) {
            'Initial_Balance' => 'رصيد أول المدة',
            'Purchase_Receipt' => 'توريد مشتريات',
            'Production_Consumption' => 'صرف للإنتاج',
            'Stock_Adjustment' => 'تسوية مخزنية',
            'Supplier_Return' => 'مرتجع للمورد',
            'Transfer_In' => 'تحويل وارد (استلام)',
            'Transfer_Out' => 'تحويل صادر (صرف)',
            'Damaged' => 'صرف تالف',
            'Production_Waste' => 'إهلاك تصنيع',
            'Waste_Receipt' => 'توريد هالك',
            default => $type
        };
    }
}
