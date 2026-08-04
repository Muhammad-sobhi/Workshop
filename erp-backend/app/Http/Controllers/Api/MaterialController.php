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
        $perPage = (int) $request->query('per_page', 10);
        $paginator = Material::with('category')
            ->orderBy('name')
            ->paginate($perPage);

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
            $whMat = \App\Models\Warehouse::where('code', 'WH-01')
                ->orWhere('code', 'WM')
                ->orWhere('name', 'like', '%خام%')
                ->first() ?? \App\Models\Warehouse::first();

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

        if (isset($validated['initial_stock'])) {
            $validated['stock_quantity'] = (float) $validated['initial_stock'];
            unset($validated['initial_stock']);
        }

        $material->update($validated);

        if ((float)$material->stock_quantity > 0) {
            $whMat = \App\Models\Warehouse::where('code', 'WH-01')
                ->orWhere('code', 'WM')
                ->orWhere('name', 'like', '%خام%')
                ->first() ?? \App\Models\Warehouse::first();

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
}
