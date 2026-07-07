<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MaterialCategory;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoriesController extends Controller
{
    // List all categories and units
    public function index(): JsonResponse
    {
        $materialCategories = MaterialCategory::orderBy('name')->get();
        $productCategories = ProductCategory::orderBy('name')->get();
        $measurementUnits = DB::table('measurement_units')->orderBy('name')->get();

        return response()->json([
            'material_categories' => $materialCategories,
            'product_categories'  => $productCategories,
            'measurement_units'   => $measurementUnits,
        ]);
    }

    // Material Category CRUD
    public function storeMaterialCategory(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:255|unique:material_categories,name']);
        $cat = MaterialCategory::create(['name' => $request->name]);
        return response()->json($cat, 201);
    }

    public function updateMaterialCategory(Request $request, $id): JsonResponse
    {
        $cat = MaterialCategory::findOrFail($id);
        $request->validate(['name' => 'required|string|max:255|unique:material_categories,name,' . $id]);
        $cat->update(['name' => $request->name]);
        return response()->json($cat);
    }

    public function destroyMaterialCategory($id): JsonResponse
    {
        $cat = MaterialCategory::findOrFail($id);
        if ($cat->materials()->exists()) {
            return response()->json(['message' => 'لا يمكن حذف هذه الفئة لوجود مواد خام مرتبطة بها.'], 422);
        }
        $cat->delete();
        return response()->json(['message' => 'تم الحذف بنجاح']);
    }

    // Product Category CRUD
    public function storeProductCategory(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:255|unique:product_categories,name']);
        $cat = ProductCategory::create(['name' => $request->name]);
        return response()->json($cat, 201);
    }

    public function updateProductCategory(Request $request, $id): JsonResponse
    {
        $cat = ProductCategory::findOrFail($id);
        $request->validate(['name' => 'required|string|max:255|unique:product_categories,name,' . $id]);
        $cat->update(['name' => $request->name]);
        return response()->json($cat);
    }

    public function destroyProductCategory($id): JsonResponse
    {
        $cat = ProductCategory::findOrFail($id);
        if ($cat->products()->exists()) {
            return response()->json(['message' => 'لا يمكن حذف هذه الفئة لوجود منتجات مرتبطة بها.'], 422);
        }
        $cat->delete();
        return response()->json(['message' => 'تم الحذف بنجاح']);
    }

    // Measurement Unit CRUD
    public function storeMeasurementUnit(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:measurement_units,name',
            'type' => 'required|string|max:100',
        ]);

        $id = DB::table('measurement_units')->insertGetId([
            'name'       => $request->name,
            'type'       => $request->type,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $unit = DB::table('measurement_units')->where('id', $id)->first();
        return response()->json($unit, 201);
    }

    public function updateMeasurementUnit(Request $request, $id): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:measurement_units,name,' . $id,
            'type' => 'required|string|max:100',
        ]);

        DB::table('measurement_units')->where('id', $id)->update([
            'name'       => $request->name,
            'type'       => $request->type,
            'updated_at' => now(),
        ]);

        $unit = DB::table('measurement_units')->where('id', $id)->first();
        return response()->json($unit);
    }

    public function destroyMeasurementUnit($id): JsonResponse
    {
        $unit = DB::table('measurement_units')->where('id', $id)->first();
        if (!$unit) {
            return response()->json(['message' => 'الوحدة غير موجودة.'], 404);
        }
        // Check if materials are using this unit
        $hasMaterials = DB::table('materials')->where('unit', $unit->name)->exists();
        $hasProducts = DB::table('products')->where('unit', $unit->name)->exists();
        if ($hasMaterials || $hasProducts) {
            return response()->json(['message' => 'لا يمكن حذف هذه الوحدة لأنها قيد الاستخدام في المواد أو المنتجات.'], 422);
        }

        DB::table('measurement_units')->where('id', $id)->delete();
        return response()->json(['message' => 'تم الحذف بنجاح']);
    }
}
