<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use App\Models\Material;
use App\Models\Product;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WarehouseController extends Controller
{
    public function index(): JsonResponse
    {
        $warehouses = Warehouse::all();
        
        $stockCase = "SUM(CASE WHEN movement_type IN ('Initial_Balance','Purchase_Receipt','Transfer_In') OR (movement_type='Stock_Adjustment' AND quantity>0) THEN quantity WHEN movement_type IN ('Production_Consumption','Supplier_Return','Damaged','Transfer_Out') OR (movement_type='Stock_Adjustment' AND quantity<0) THEN -quantity ELSE 0 END)";

        $result = [];
        foreach ($warehouses as $wh) {
            $movementsCount = InventoryMovement::where('warehouse_id', $wh->id)->count();

            $uniqueMaterials = DB::table('inventory_movements')
                ->where('warehouse_id', $wh->id)
                ->whereNotNull('material_id')
                ->groupBy('material_id')
                ->havingRaw("{$stockCase} > 0")
                ->get(['material_id'])
                ->count();

            $uniqueProducts = DB::table('inventory_movements')
                ->where('warehouse_id', $wh->id)
                ->whereNotNull('product_id')
                ->groupBy('product_id')
                ->havingRaw("{$stockCase} > 0")
                ->get(['product_id'])
                ->count();

            $result[] = [
                'id' => $wh->id,
                'name' => $wh->name,
                'code' => $wh->code,
                'description' => $wh->description,
                'address' => $wh->address,
                'notes' => $wh->notes,
                'movements_count' => $movementsCount,
                'items_in_stock' => $uniqueMaterials + $uniqueProducts,
                'created_at' => $wh->created_at->toDateString(),
            ];
        }

        return response()->json($result);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:100|unique:warehouses,code',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $warehouse = Warehouse::create($validated);

        return response()->json([
            'message' => 'تم إنشاء المستودع بنجاح',
            'warehouse' => $warehouse
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $warehouse = Warehouse::findOrFail($id);

        $stockCase = "SUM(CASE WHEN movement_type IN ('Initial_Balance','Purchase_Receipt','Transfer_In') OR (movement_type='Stock_Adjustment' AND quantity>0) THEN quantity WHEN movement_type IN ('Production_Consumption','Supplier_Return','Damaged','Transfer_Out') OR (movement_type='Stock_Adjustment' AND quantity<0) THEN -quantity ELSE 0 END)";

        // Get material stock quantities in one aggregate query
        $materialStocks = DB::table('inventory_movements')
            ->where('warehouse_id', $warehouse->id)
            ->whereNotNull('material_id')
            ->groupBy('material_id')
            ->selectRaw("material_id, {$stockCase} as stock")
            ->having('stock', '>', 0)
            ->pluck('stock', 'material_id');

        // Get product stock quantities in one aggregate query
        $productStocks = DB::table('inventory_movements')
            ->where('warehouse_id', $warehouse->id)
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->selectRaw("product_id, {$stockCase} as stock")
            ->having('stock', '>', 0)
            ->pluck('stock', 'product_id');

        $stockItems = [];

        if ($materialStocks->isNotEmpty()) {
            $materials = Material::with('category')->whereIn('id', $materialStocks->keys())->get();
            foreach ($materials as $mat) {
                $stock = $materialStocks[$mat->id];
                $stockItems[] = [
                    'id' => $mat->id,
                    'type' => 'material',
                    'name' => $mat->name,
                    'code' => $mat->code,
                    'sku' => $mat->sku,
                    'unit' => $mat->unit,
                    'quantity' => (float)$stock,
                    'unit_cost' => (float)$mat->unit_cost,
                    'total_cost' => $stock * $mat->unit_cost,
                    'category' => $mat->category->name ?? 'غير مصنف',
                ];
            }
        }

        if ($productStocks->isNotEmpty()) {
            $products = Product::with('category')->whereIn('id', $productStocks->keys())->get();
            foreach ($products as $prod) {
                $stock = $productStocks[$prod->id];
                $stockItems[] = [
                    'id' => $prod->id,
                    'type' => 'product',
                    'name' => $prod->name,
                    'code' => $prod->code,
                    'sku' => $prod->sku,
                    'unit' => $prod->unit,
                    'quantity' => (float)$stock,
                    'unit_cost' => (float)$prod->unit_cost,
                    'total_cost' => $stock * $prod->unit_cost,
                    'category' => $prod->category->name ?? 'غير مصنف',
                ];
            }
        }

        return response()->json([
            'warehouse' => $warehouse,
            'stocks' => $stockItems
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $warehouse = Warehouse::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => "required|string|max:100|unique:warehouses,code,{$warehouse->id}",
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $warehouse->update($validated);

        return response()->json([
            'message' => 'تم تحديث بيانات المستودع بنجاح',
            'warehouse' => $warehouse
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $warehouse = Warehouse::findOrFail($id);

        // Check if there are any inventory movements linked to this warehouse
        $movementsCount = InventoryMovement::where('warehouse_id', $warehouse->id)->count();
        if ($movementsCount > 0) {
            return response()->json([
                'message' => 'لا يمكن حذف المستودع لوجود حركات مخزنية مسجلة عليه. يمكنك تعطيله أو نقل مخزونه أولاً.'
            ], 400);
        }

        $warehouse->delete();

        return response()->json([
            'message' => 'تم حذف المستودع بنجاح'
        ]);
    }
}
