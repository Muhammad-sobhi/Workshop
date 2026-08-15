<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class SettingsController extends Controller
{
    // Settings API
    public function getSettings(): JsonResponse
    {
        try {
            $settings = DB::table('settings')->get()->pluck('value', 'key');
            $logoPath = $settings['logo_path'] ?? null;
            if ($logoPath && (str_contains($logoPath, 'localhost') || str_contains($logoPath, '127.0.0.1'))) {
                $logoPath = preg_replace('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/', '', $logoPath);
            }

            return response()->json([
                'company_name'        => $settings['company_name'] ?? 'ورشة الأثاث الحديث',
                'phone'               => $settings['phone'] ?? '',
                'address'             => $settings['address'] ?? '',
                'tax_number'          => $settings['tax_number'] ?? '',
                'commercial_register' => $settings['commercial_register'] ?? '',
                'invoice_footer'      => $settings['invoice_footer'] ?? 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة ضد عيوب الصناعة',
                'currency'            => $settings['currency'] ?? 'EGP',
                'tax_rate'            => $settings['tax_rate'] ?? '0',
                'logo_path'           => $logoPath,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'company_name'        => 'ورشة الأثاث الحديث',
                'phone'               => '',
                'address'             => '',
                'tax_number'          => '',
                'commercial_register' => '',
                'invoice_footer'      => 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة',
                'currency'            => 'EGP',
                'tax_rate'            => '0',
                'logo_path'           => null,
            ]);
        }
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name'        => 'required|string|max:255',
            'phone'               => 'nullable|string|max:100',
            'address'             => 'nullable|string|max:255',
            'tax_number'          => 'nullable|string|max:100',
            'commercial_register' => 'nullable|string|max:100',
            'invoice_footer'      => 'nullable|string|max:1000',
            'currency'            => 'required|string|max:20',
            'tax_rate'            => 'required|numeric|min:0|max:100',
            'logo_path'           => 'nullable|string',
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('settings', 'public');
            $validated['logo_path'] = '/storage/' . $path;
        }

        if (!empty($validated['logo_path']) && (str_contains($validated['logo_path'], 'localhost') || str_contains($validated['logo_path'], '127.0.0.1'))) {
            $validated['logo_path'] = preg_replace('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/', '', $validated['logo_path']);
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
            'message' => 'تم حفظ إعدادات وهوية الورشة بنجاح',
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
        try {
            Schema::disableForeignKeyConstraints();

            if (Schema::hasTable('sales_invoice_items')) DB::table('sales_invoice_items')->truncate();
            if (Schema::hasTable('sales_invoices')) DB::table('sales_invoices')->truncate();
            if (Schema::hasTable('treasury_transactions')) DB::table('treasury_transactions')->truncate();
            if (Schema::hasTable('client_payments')) DB::table('client_payments')->truncate();
            if (Schema::hasTable('supplier_payments')) DB::table('supplier_payments')->truncate();
            if (Schema::hasTable('external_service_payments')) DB::table('external_service_payments')->truncate();
            if (Schema::hasTable('external_service_orders')) DB::table('external_service_orders')->truncate();
            if (Schema::hasTable('operation_payments')) DB::table('operation_payments')->truncate();
            if (Schema::hasTable('operation_products')) DB::table('operation_products')->truncate();
            if (Schema::hasTable('operations')) DB::table('operations')->truncate();
            if (Schema::hasTable('purchase_order_items')) DB::table('purchase_order_items')->truncate();
            if (Schema::hasTable('purchase_orders')) DB::table('purchase_orders')->truncate();
            if (Schema::hasTable('expenses')) DB::table('expenses')->truncate();
            if (Schema::hasTable('revenues')) DB::table('revenues')->truncate();
            if (Schema::hasTable('inventory_movements')) DB::table('inventory_movements')->truncate();
            if (Schema::hasTable('supplier_materials')) DB::table('supplier_materials')->truncate();
            if (Schema::hasTable('suppliers')) DB::table('suppliers')->truncate();
            if (Schema::hasTable('clients')) DB::table('clients')->truncate();

            if (Schema::hasTable('inventories')) {
                DB::table('inventories')->truncate();
            }
            if (Schema::hasTable('notifications')) {
                DB::table('notifications')->truncate();
            }

            if (Schema::hasColumn('materials', 'stock_quantity')) {
                DB::table('materials')->update(['stock_quantity' => 0]);
            }
            if (Schema::hasColumn('products', 'stock_quantity')) {
                DB::table('products')->update(['stock_quantity' => 0]);
            }

            Schema::enableForeignKeyConstraints();

            return response()->json([
                'message' => 'تم تصفير كافة البيانات المالية والتنفيذية (الموردين، العملاء، المشتريات، المبيعات، المصروفات، والإنتاج) بنجاح، مع الاحتفاظ ببيانات التسجيل، الخامات، الأثاث، الفئات، والمخازن.'
            ]);
        } catch (\Throwable $e) {
            Schema::enableForeignKeyConstraints();
            return response()->json([
                'message' => 'حدث خطأ أثناء تصفير البيانات: ' . $e->getMessage()
            ], 500);
        }
    }
}
