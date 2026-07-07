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
        ]);

        $material = Material::create($validated);
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
        ]);

        $material->update($validated);
        $material->load('category');

        return response()->json(['message' => 'تم تحديث بيانات المادة بنجاح', 'material' => $material]);
    }

    public function destroy(string $id): JsonResponse
    {
        $material = Material::findOrFail($id);
        // Check if material has movements before deleting
        if ($material->movements()->exists()) {
            return response()->json(['message' => 'لا يمكن حذف المادة لأنها مرتبطة بحركات مخزون. يمكنك تعديلها فقط.'], 422);
        }
        $material->delete();
        return response()->json(['message' => 'تم حذف المادة الخام بنجاح']);
    }
}
