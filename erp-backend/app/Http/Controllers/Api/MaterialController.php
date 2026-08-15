<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaterialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if ($perPage <= 0 || $request->boolean('all')) {
            $perPage = 10000;
        }
        $query = Material::with('category')->orderBy('name');

        if ($request->has('type')) {
            $query->where('type', $request->query('type'));
        }

        $paginator = $query->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(function ($m) {
                return [
                    'id'          => $m->id,
                    'name'        => $m->name,
                    'code'        => $m->code,
                    'sku'         => $m->sku,
                    'unit'        => $m->unit,
                    'unit_cost'   => (float) $m->unit_cost,
                    'category_id' => $m->category_id,
                    'category'    => $m->category?->name,
                    'description' => $m->description,
                    'stock'       => (float) $m->stock_quantity,
                    'dimension'   => $m->dimension !== null ? (float) $m->dimension : null,
                    'type'        => $m->type,
                    'low_stock_limit' => (float) $m->low_stock_limit,
                    'service_location' => $m->service_location,
                ];
            })
        );

        return response()->json($paginator);
    }

    public function categories(): JsonResponse
    {
        return response()->json(MaterialCategory::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:100|unique:materials,code',
            'sku'         => 'nullable|string|max:100|unique:materials,sku',
            'unit'        => 'required|string|max:50',
            'unit_cost'   => 'required|numeric|min:0',
            'category_id' => 'required|exists:material_categories,id',
            'description' => 'nullable|string',
            'dimension'   => 'nullable|numeric|min:0',
            'type'        => 'nullable|string|in:material,service',
            'low_stock_limit' => 'nullable|numeric|min:0',
            'service_location' => 'nullable|string|in:inside,outside',
            'initial_stock'   => 'nullable|numeric|min:0',
        ]);

        if (isset($validated['initial_stock'])) {
            $validated['stock_quantity'] = (float) $validated['initial_stock'];
            unset($validated['initial_stock']);
        }

        $material = Material::create($validated);

        if ((float)$material->stock_quantity > 0) {
            $whMat = \App\Models\Warehouse::rawMaterialsWarehouse();

            if ($whMat) {
                \App\Models\InventoryMovement::updateOrCreate(
                    [
                        'warehouse_id'  => $whMat->id,
                        'material_id'   => $material->id,
                        'movement_type' => 'Initial_Balance',
                    ],
                    [
                        'movement_number' => 'MV-INIT-MAT-' . $material->id,
                        'movement_date'   => \Illuminate\Support\Carbon::now(),
                        'quantity'        => (float)$material->stock_quantity,
                        'unit_cost'       => (float)$material->unit_cost,
                        'total_cost'      => (float)$material->stock_quantity * (float)$material->unit_cost,
                        'reference_number'=> 'INIT-MAT-' . $material->id,
                        'notes'           => 'رصيد مخزون أول المدة للمادة الخام',
                        'created_by'      => auth()->id()
                    ]
                );
            }
        }

        $material->load('category');

        return response()->json(['message' => 'تم إضافة المادة الخام بنجاح', 'material' => $material], 201);
    }

    public function show(string $id): JsonResponse
    {
        $material = Material::with(['category', 'suppliers'])->findOrFail($id);
        $material->stock = (float) $material->stock_quantity;
        return response()->json($material);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $material = Material::findOrFail($id);

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:100|unique:materials,code,' . $id,
            'sku'         => 'nullable|string|max:100|unique:materials,sku,' . $id,
            'unit'        => 'required|string|max:50',
            'unit_cost'   => 'required|numeric|min:0',
            'category_id' => 'required|exists:material_categories,id',
            'description' => 'nullable|string',
            'dimension'   => 'nullable|numeric|min:0',
            'type'        => 'nullable|string|in:material,service',
            'low_stock_limit' => 'nullable|numeric|min:0',
            'service_location' => 'nullable|string|in:inside,outside',
            'initial_stock'   => 'nullable|numeric|min:0',
        ]);

        unset($validated['initial_stock']);

        $material->update($validated);

        $material->load('category');

        return response()->json(['message' => 'تم تحديث بيانات المادة بنجاح', 'material' => $material]);
    }

    public function destroy(string $id): JsonResponse
    {
        $material = Material::findOrFail($id);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($material) {
            // Delete inventory movements associated with this material
            $material->movements()->delete();

            // Detach suppliers relation if any
            $material->suppliers()->detach();

            // Delete material
            $material->delete();

            return response()->json(['message' => 'تم حذف المادة الخام وكافة حركاتها المخزنية بنجاح']);
        });
    }

    public function bulkImport(\Illuminate\Http\Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.name' => 'required|string|max:255',
            'items.*.unit' => 'required|string',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.category' => 'required|string',
            'items.*.description' => 'nullable|string',
        ]);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
            $importedCount = 0;
            foreach ($request->input('items') as $item) {
                $category = MaterialCategory::firstOrCreate(['name' => $item['category']]);
                
                Material::create([
                    'name' => $item['name'],
                    'unit' => $item['unit'],
                    'unit_cost' => $item['unit_cost'],
                    'category_id' => $category->id,
                    'description' => $item['description'] ?? null,
                    'type' => 'material',
                ]);
                $importedCount++;
            }

            return response()->json(['message' => "تم استيراد {$importedCount} من المواد بنجاح"]);
        });
    }

    public function getPriceImpact(Request $request, string $id): JsonResponse
    {
        $material = Material::with('products')->findOrFail($id);
        $newUnitCost = (float) $request->query('new_unit_cost', $material->unit_cost);
        $oldUnitCost = (float) $material->unit_cost;
        $unitCostDiff = $newUnitCost - $oldUnitCost;

        $stockQty = (float) $material->stock_quantity;
        $oldStockValue = round($stockQty * $oldUnitCost, 2);
        $newStockValue = round($stockQty * $newUnitCost, 2);
        $stockValueDiff = round($newStockValue - $oldStockValue, 2);

        $affectedProducts = [];

        foreach ($material->products as $product) {
            $qtyUsed = (float) ($product->pivot->quantity ?? 1);
            $currProductCost = (float) $product->unit_cost;
            $newProductCost = max(0.0, round($currProductCost + ($qtyUsed * $unitCostDiff), 2));
            $currSalePrice = (float) $product->sale_price;

            $currentMarginPercent = $currSalePrice > 0
                ? round((($currSalePrice - $currProductCost) / $currSalePrice) * 100, 2)
                : 0.0;

            // Suggested sale price keeping the exact same margin percentage
            $suggestedSalePrice = $currentMarginPercent < 100 && $currentMarginPercent > 0
                ? round($newProductCost / (1 - ($currentMarginPercent / 100)), 2)
                : round($newProductCost * 1.35, 2); // Default 35% margin if zero

            $affectedProducts[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'material_qty_used' => $qtyUsed,
                'current_unit_cost' => $currProductCost,
                'new_calculated_unit_cost' => $newProductCost,
                'cost_difference' => round($newProductCost - $currProductCost, 2),
                'current_sale_price' => $currSalePrice,
                'current_margin_percent' => $currentMarginPercent,
                'suggested_sale_price' => $suggestedSalePrice,
                'product_stock' => (float) $product->stock_quantity,
            ];
        }

        return response()->json([
            'material' => [
                'id' => $material->id,
                'name' => $material->name,
                'unit' => $material->unit,
                'old_unit_cost' => $oldUnitCost,
                'new_unit_cost' => $newUnitCost,
                'cost_diff' => round($unitCostDiff, 2),
                'stock_quantity' => $stockQty,
                'old_stock_value' => $oldStockValue,
                'new_stock_value' => $newStockValue,
                'stock_value_diff' => $stockValueDiff,
            ],
            'affected_products' => $affectedProducts,
            'total_affected_products' => count($affectedProducts),
        ]);
    }

    public function updatePriceWithOptions(Request $request, string $id): JsonResponse
    {
        $material = Material::findOrFail($id);

        $validated = $request->validate([
            'new_unit_cost' => 'required|numeric|min:0',
            'apply_to_material_stock' => 'nullable|boolean',
            'apply_to_products_bom' => 'nullable|boolean',
            'apply_future_only' => 'nullable|boolean',
            'notes' => 'nullable|string',
            'product_prices' => 'nullable|array',
            'product_prices.*.product_id' => 'required_with:product_prices|exists:products,id',
            'product_prices.*.sale_price' => 'required_with:product_prices|numeric|min:0',
        ]);

        $oldUnitCost = (float) $material->unit_cost;
        $newUnitCost = (float) $validated['new_unit_cost'];
        $applyToBom = $request->boolean('apply_to_products_bom', true);
        $applyFutureOnly = $request->boolean('apply_future_only', false);
        $applyToMaterialStock = $request->boolean('apply_to_material_stock', true);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($material, $oldUnitCost, $newUnitCost, $applyToBom, $applyFutureOnly, $applyToMaterialStock, $validated) {
            $user = auth()->id();

            // 1. Record History Audit Log
            \App\Models\MaterialPriceHistory::create([
                'material_id' => $material->id,
                'old_unit_cost' => $oldUnitCost,
                'new_unit_cost' => $newUnitCost,
                'apply_to_material_stock' => $applyToMaterialStock,
                'apply_to_products_bom' => $applyToBom,
                'apply_future_only' => $applyFutureOnly,
                'notes' => $validated['notes'] ?? null,
                'created_by' => $user,
            ]);

            // 2. If Future Only or BOM skipped, set skip flag
            if ($applyFutureOnly || !$applyToBom) {
                $material->skipBomRecalculation = true;
            }

            $material->unit_cost = $newUnitCost;
            $material->save();

            // 3. Update Product Sale Prices if provided
            if ($applyToBom && !empty($validated['product_prices'])) {
                foreach ($validated['product_prices'] as $pPrice) {
                    \App\Models\Product::where('id', $pPrice['product_id'])->update([
                        'sale_price' => (float) $pPrice['sale_price']
                    ]);
                }
            }

            return response()->json([
                'message' => 'تم تحديث سعر المادة الخام وتطبيق الخيارات المحددة بنجاح.',
                'material' => $material->fresh()->load('category'),
            ]);
        });
    }

    public function getPriceHistory(string $id): JsonResponse
    {
        $material = Material::findOrFail($id);
        $histories = \App\Models\MaterialPriceHistory::with('user:id,name')
            ->where('material_id', $material->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($histories);
    }
}

