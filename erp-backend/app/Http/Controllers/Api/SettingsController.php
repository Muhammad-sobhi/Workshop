<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SettingsController extends Controller
{
    // Settings API
    public function getSettings(): JsonResponse
    {
        try {
            $settings = DB::table('settings')->get()->pluck('value', 'key');
            return response()->json($settings);
        } catch (\Exception $e) {
            return response()->json([
                'company_name' => 'نظام ERP',
                'currency'     => 'ر.س',
                'tax_rate'     => '15',
                'logo_path'    => null,
            ]);
        }
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'currency'     => 'required|string|max:20',
            'tax_rate'     => 'required|numeric|min:0|max:100',
            'logo_path'    => 'nullable|string',
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('settings', 'public');
            $validated['logo_path'] = '/storage/' . $path;
        }

        foreach ($validated as $key => $value) {
            if ($value !== null) {
                DB::table('settings')->updateOrInsert(
                    ['key' => $key],
                    ['value' => $value, 'updated_at' => now()]
                );
            }
        }

        return response()->json([
            'message' => 'تم حفظ الإعدادات بنجاح',
            'logo_path' => $validated['logo_path'] ?? null
        ]);
    }

    // User Manager API
    public function getUsers(): JsonResponse
    {
        $users = User::where('tenant_id', auth()->user()->tenant_id)
            ->orderBy('name')
            ->get()
            ->map(function ($u) {
                return [
                    'id'          => $u->id,
                    'name'        => $u->name,
                    'email'       => $u->email,
                    'role'        => $u->role,
                    'permissions' => $u->permissions ?? [],
                ];
            });
        return response()->json($users);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|string|email|max:255|unique:users,email',
            'password'    => 'required|string|min:6',
            'role'        => 'required|string',
            'permissions' => 'nullable|array',
        ]);

        $user = User::create([
            'name'        => $validated['name'],
            'email'       => $validated['email'],
            'password'    => Hash::make($validated['password']),
            'role'        => $validated['role'],
            'permissions' => $validated['permissions'] ?? [],
            'tenant_id'   => auth()->user()->tenant_id,
        ]);

        return response()->json(['message' => 'تم إنشاء المستخدم بنجاح', 'user' => $user], 201);
    }

    public function updateUser(Request $request, $id): JsonResponse
    {
        $user = User::where('tenant_id', auth()->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|string|email|max:255|unique:users,email,' . $id,
            'password'    => 'nullable|string|min:6',
            'role'        => 'required|string',
            'permissions' => 'nullable|array',
        ]);

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->role = $validated['role'];
        $user->permissions = $validated['permissions'] ?? [];

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json(['message' => 'تم تحديث بيانات المستخدم بنجاح', 'user' => $user]);
    }

    public function destroyUser($id): JsonResponse
    {
        $user = User::where('tenant_id', auth()->user()->tenant_id)->findOrFail($id);
        // Prevent deleting current user
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'لا يمكنك حذف حسابك الشخصي النشط.'], 422);
        }
        $user->delete();
        return response()->json(['message' => 'تم حذف المستخدم بنجاح']);
    }

    public function resetData(): JsonResponse
    {
        return DB::transaction(function () {
            // Delete dependent transactions first to satisfy FK constraints
            DB::table('operation_payments')->delete();
            DB::table('operation_products')->delete();
            DB::table('operations')->delete();
            DB::table('purchase_order_items')->delete();
            DB::table('purchase_orders')->delete();
            DB::table('expenses')->delete();
            DB::table('revenues')->delete();
            DB::table('inventory_movements')->delete();
            DB::table('supplier_materials')->delete();
            DB::table('suppliers')->delete();
            DB::table('clients')->delete();

            if (\Illuminate\Support\Facades\Schema::hasTable('inventories')) {
                DB::table('inventories')->update(['quantity' => 0]);
            }

            return response()->json([
                'message' => 'تم تصفير كافة البيانات المالية والتنفيذية (الموردين، العملاء، المشتريات، المبيعات، المصروفات، والإنتاج) بنجاح، مع الاحتفاظ ببيانات التسجيل، الخامات، الأثاث، الفئات، والمخازن.'
            ]);
        });
    }
}
