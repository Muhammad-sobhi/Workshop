<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $paginator = Product::with(['category', 'materials'])
            ->orderBy('name')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(function ($p) {
                return [
                    'id'          => $p->id,
                    'name'        => $p->name,
                    'code'        => $p->code,
                    'sku'         => $p->sku,
                    'unit'        => $p->unit,
                    'unit_cost'   => (float) $p->unit_cost,
                    'sale_price'  => (float) $p->sale_price,
                    'category_id' => $p->category_id,
                    'category'    => $p->category?->name,
                    'description' => $p->description,
                    'image_path'  => $p->image_path,
                    'stock'       => (float) $p->stock_quantity,
                    'materials'   => $p->materials->map(function ($m) {
                        return [
                            'id'       => $m->id,
                            'name'     => $m->name,
                            'unit'     => $m->unit,
                            'unit_cost'=> (float) $m->unit_cost,
                            'quantity' => (float) $m->pivot->quantity,
                        ];
                    }),
                ];
            })
        );

        return response()->json($paginator);
    }

    public function categories(): JsonResponse
    {
        return response()->json(ProductCategory::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:100|unique:products,code',
            'sku'         => 'nullable|string|max:100|unique:products,sku',
            'unit'        => 'required|string|max:50',
            'unit_cost'   => 'nullable|numeric|min:0',
            'sale_price'  => 'required|numeric|min:0',
            'category_id' => 'required|exists:product_categories,id',
            'description' => 'nullable|string',
            'image'       => 'nullable|file|image|max:2048',
            'image_path'  => 'nullable|string',
            'materials'   => 'nullable|array',
            'materials.*.id' => 'required|exists:materials,id',
            'materials.*.quantity' => 'required|numeric|min:0.0001',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $imagePath = $validated['image_path'] ?? null;
            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('products', 'public');
                $imagePath = '/storage/' . $path;
            }

            // Calculate cost based on materials
            $calculatedCost = 0;
            if (!empty($validated['materials'])) {
                foreach ($validated['materials'] as $item) {
                    $mat = \App\Models\Material::find($item['id']);
                    if ($mat) {
                        $calculatedCost += ((float) $mat->unit_cost) * ((float) $item['quantity']);
                    }
                }
            } else {
                $calculatedCost = $validated['unit_cost'] ?? 0;
            }

            $product = Product::create([
                'name'        => $validated['name'],
                'code'        => $validated['code'],
                'sku'         => $validated['sku'],
                'unit'        => $validated['unit'],
                'unit_cost'   => $calculatedCost,
                'sale_price'  => $validated['sale_price'],
                'category_id' => $validated['category_id'],
                'description' => $validated['description'] ?? null,
                'image_path'  => $imagePath,
            ]);

            if (!empty($validated['materials'])) {
                $syncData = [];
                foreach ($validated['materials'] as $item) {
                    $syncData[$item['id']] = ['quantity' => $item['quantity']];
                }
                $product->materials()->sync($syncData);
            }

            $product->load(['category', 'materials']);

            return response()->json([
                'message' => 'تم إضافة المنتج بنجاح مع جدول المكونات (BOM)',
                'product' => $product
            ], 201);
        });
    }

    public function show(string $id): JsonResponse
    {
        $product = Product::with(['category', 'materials'])->findOrFail($id);
        $product->stock = (float) $product->stock_quantity;
        // Append image_path
        return response()->json([
            'id'          => $product->id,
            'name'        => $product->name,
            'code'        => $product->code,
            'sku'         => $product->sku,
            'unit'        => $product->unit,
            'unit_cost'   => (float) $product->unit_cost,
            'sale_price'  => (float) $product->sale_price,
            'category_id' => $product->category_id,
            'category'    => $product->category?->name,
            'description' => $product->description,
            'image_path'  => $product->image_path,
            'stock'       => (float) $product->stock,
            'materials'   => $product->materials->map(function ($m) {
                return [
                    'id'       => $m->id,
                    'name'     => $m->name,
                    'unit'     => $m->unit,
                    'unit_cost'=> (float) $m->unit_cost,
                    'quantity' => (float) $m->pivot->quantity,
                ];
            }),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:100|unique:products,code,' . $id,
            'sku'         => 'nullable|string|max:100|unique:products,sku,' . $id,
            'unit'        => 'required|string|max:50',
            'unit_cost'   => 'nullable|numeric|min:0',
            'sale_price'  => 'required|numeric|min:0',
            'category_id' => 'required|exists:product_categories,id',
            'description' => 'nullable|string',
            'image'       => 'nullable|file|image|max:2048',
            'image_path'  => 'nullable|string',
            'materials'   => 'nullable|array',
            'materials.*.id' => 'required|exists:materials,id',
            'materials.*.quantity' => 'required|numeric|min:0.0001',
        ]);

        return DB::transaction(function () use ($validated, $product, $request) {
            $imagePath = $validated['image_path'] ?? $product->image_path;
            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('products', 'public');
                $imagePath = '/storage/' . $path;
            }

            // Calculate cost based on materials
            $calculatedCost = 0;
            if (!empty($validated['materials'])) {
                foreach ($validated['materials'] as $item) {
                    $mat = \App\Models\Material::find($item['id']);
                    if ($mat) {
                        $calculatedCost += ((float) $mat->unit_cost) * ((float) $item['quantity']);
                    }
                }
            } else {
                $calculatedCost = $validated['unit_cost'] ?? $product->unit_cost;
            }

            $product->update([
                'name'        => $validated['name'],
                'code'        => $validated['code'],
                'sku'         => $validated['sku'],
                'unit'        => $validated['unit'],
                'unit_cost'   => $calculatedCost,
                'sale_price'  => $validated['sale_price'],
                'category_id' => $validated['category_id'],
                'description' => $validated['description'] ?? null,
                'image_path'  => $imagePath,
            ]);

            $syncData = [];
            if (!empty($validated['materials'])) {
                foreach ($validated['materials'] as $item) {
                    $syncData[$item['id']] = ['quantity' => $item['quantity']];
                }
            }
            $product->materials()->sync($syncData);

            $product->load(['category', 'materials']);

            return response()->json([
                'message' => 'تم تحديث بيانات المنتج والمكونات بنجاح',
                'product' => $product
            ]);
        });
    }

    public function destroy(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        // Check if product has any movements or operations
        if ($product->movements()->exists()) {
            return response()->json([
                'message' => 'لا يمكن حذف المنتج لوجود حركات مخزنية مرتبطة به. يمكنك تعديله فقط.'
            ], 422);
        }

        $product->materials()->detach();
        $product->delete();

        return response()->json([
            'message' => 'تم حذف المنتج بنجاح'
        ]);
    }
}
