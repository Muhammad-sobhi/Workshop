<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Employee;
use App\Models\ExternalServicePayment;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditFixesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function productWithStock(): array
    {
        $wh = Warehouse::create(['name' => 'معرض المنتجات الجاهزة', 'code' => 'WSH-P']);
        $cat = ProductCategory::create(['name' => 'كراسي']);
        $p = Product::create(['name' => 'كرسي', 'code' => 'P1', 'category_id' => $cat->id, 'unit' => 'كرسي', 'unit_cost' => 10, 'sale_price' => 30, 'stock_quantity' => 0]);
        InventoryService::recordMovement(warehouseId: $wh->id, materialId: null, productId: $p->id, movementType: 'Initial_Balance', quantity: 100, unitCost: 10, referenceNumber: 'INIT');

        return [$wh, $p];
    }

    private function material(): Material
    {
        return Material::create(['category_id' => MaterialCategory::create(['name' => 'خامات'])->id, 'name' => 'خشب', 'unit' => 'متر', 'unit_cost' => 10, 'stock_quantity' => 0]);
    }

    private function treasuryTotal(): float
    {
        return (float) DB::table('treasury_transactions')->whereNull('deleted_at')->sum('amount');
    }

    public function test_deleting_an_edited_invoice_restores_the_original_stock()
    {
        [$wh, $p] = $this->productWithStock();
        $id = $this->postJson('/api/sales', ['product_id' => $p->id, 'quantity' => 5, 'price' => 30, 'invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'warehouse_id' => $wh->id])
            ->assertStatus(201)->json('invoice.id');

        $this->putJson("/api/sales/{$id}", ['invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'warehouse_id' => $wh->id,
            'items' => [['product_id' => $p->id, 'quantity' => 3, 'unit_sale_price' => 30]]])->assertOk();
        $this->putJson("/api/sales/{$id}", ['invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'warehouse_id' => $wh->id,
            'items' => [['product_id' => $p->id, 'quantity' => 8, 'unit_sale_price' => 30]]])->assertOk();
        $this->assertEquals(92, InventoryService::getStock('product', $p->id, $wh->id));

        $this->deleteJson("/api/sales/{$id}")->assertOk();
        $this->assertEquals(100, InventoryService::getStock('product', $p->id, $wh->id));
        $this->assertEquals(100, (float) $p->fresh()->stock_quantity);
        $this->assertEquals(0, $this->treasuryTotal());
    }

    public function test_purchase_order_deposit_cannot_be_undone_from_the_supplier_statement()
    {
        $s = Supplier::create(['name' => 'مورد', 'debt_amount' => 0]);
        $this->postJson('/api/purchase-orders', ['supplier_id' => $s->id, 'order_date' => '2026-10-01', 'deposit_paid' => 200, 'payment_method' => 'cash',
            'items' => [['material_id' => $this->material()->id, 'quantity' => 10, 'unit_cost' => 50]]])->assertSuccessful();
        $pay = SupplierPayment::firstOrFail();

        $this->deleteJson("/api/suppliers/{$s->id}/payments/pay-{$pay->id}")->assertStatus(422);
        $this->deleteJson("/api/suppliers/{$s->id}/payments/{$pay->id}")->assertStatus(422);

        $this->assertEquals(1, SupplierPayment::count());
        $this->assertEquals(200, (float) PurchaseOrder::first()->deposit_paid);
        $this->assertEquals(200, $this->treasuryTotal());
    }

    public function test_direct_supplier_payment_can_still_be_undone()
    {
        $s = Supplier::create(['name' => 'مورد', 'debt_amount' => 0, 'opening_balance' => 500]);
        $this->postJson("/api/suppliers/{$s->id}/pay-debt", ['amount' => 100, 'payment_method' => 'cash', 'payment_date' => '2026-10-01'])->assertOk();
        $pay = SupplierPayment::firstOrFail();

        $this->deleteJson("/api/suppliers/{$s->id}/payments/pay-{$pay->id}")->assertOk();

        $this->assertEquals(0, SupplierPayment::count());
        $this->assertEquals(0, $this->treasuryTotal());
        $this->assertEquals(500, (float) $s->fresh()->debt_amount);
    }

    public function test_supplier_with_history_is_not_deleted()
    {
        $s = Supplier::create(['name' => 'ورشة', 'debt_amount' => 0]);
        $this->postJson('/api/external-service-orders', ['supplier_id' => $s->id, 'item_description' => 'x', 'quantity' => 1, 'unit' => 'قطعة', 'unit_cost' => 100,
            'sent_date' => '2026-10-01', 'initial_payment' => 50, 'payment_method' => 'cash'])->assertStatus(201);

        $this->deleteJson("/api/suppliers/{$s->id}")->assertStatus(422);
        $this->assertNotNull($s->fresh());
        $this->assertEquals(1, ExternalServicePayment::count());

        $clean = Supplier::create(['name' => 'مورد بدون حركات', 'debt_amount' => 0]);
        $this->deleteJson("/api/suppliers/{$clean->id}")->assertOk();
        $this->assertNull(Supplier::withTrashed()->find($clean->id));
    }

    public function test_client_with_history_is_not_deleted()
    {
        [$wh, $p] = $this->productWithStock();
        $client = Client::create(['name' => 'عميل']);
        $this->postJson('/api/sales', ['client_id' => $client->id, 'product_id' => $p->id, 'quantity' => 1, 'price' => 30, 'invoice_date' => '2026-10-01',
            'payment_method' => 'cash', 'paid_amount' => 10, 'warehouse_id' => $wh->id])->assertStatus(201);

        $this->deleteJson("/api/clients/{$client->id}")->assertStatus(422);
        $this->assertNotNull($client->fresh());

        $clean = Client::create(['name' => 'عميل جديد']);
        $this->deleteJson("/api/clients/{$clean->id}")->assertOk();
    }

    public function test_cancelling_an_external_order_updates_the_supplier_debt()
    {
        $s = Supplier::create(['name' => 'ورشة', 'debt_amount' => 0]);
        $id = $this->postJson('/api/external-service-orders', ['supplier_id' => $s->id, 'item_description' => 'x', 'quantity' => 10, 'unit' => 'قطعة',
            'unit_cost' => 100, 'sent_date' => '2026-10-01', 'initial_payment' => 300, 'payment_method' => 'cash'])->json('order.id');
        $this->assertEquals(700, (float) $s->fresh()->debt_amount);

        $this->putJson("/api/external-service-orders/{$id}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertEquals(0, (float) $s->fresh()->debt_amount);

        $this->putJson("/api/external-service-orders/{$id}/status", ['status' => 'sent'])->assertOk();
        $this->assertEquals(700, (float) $s->fresh()->debt_amount);

        $this->deleteJson("/api/external-service-orders/{$id}")->assertOk();
        $this->assertEquals(0, (float) $s->fresh()->debt_amount);
    }

    public function test_external_service_receipt_is_saved_under_storage()
    {
        Storage::fake('public');
        $s = Supplier::create(['name' => 'ورشة', 'debt_amount' => 0]);
        $this->post('/api/external-service-orders', ['supplier_id' => $s->id, 'item_description' => 'x', 'quantity' => 1, 'unit' => 'قطعة', 'unit_cost' => 100,
            'sent_date' => '2026-10-01', 'initial_payment' => 50, 'payment_method' => 'cash',
            'receipt_image' => UploadedFile::fake()->image('r.jpg')], ['Accept' => 'application/json'])->assertStatus(201);

        $path = ExternalServicePayment::firstOrFail()->receipt_image_path;
        $this->assertStringStartsWith('/storage/receipts/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/storage/')));
        $this->assertEquals($path, DB::table('treasury_transactions')->value('receipt_path'));
    }

    public function test_backup_covers_external_payments_employees_and_allocations()
    {
        $tables = array_keys($this->getJson('/api/backup/status')->assertOk()->json('table_stats'));

        foreach (['external_service_payments', 'employees', 'employee_salaries', 'employee_attendances', 'employee_production_logs',
            'employee_ledger_entries', 'client_payment_allocations', 'supplier_products'] as $table) {
            $this->assertContains($table, $tables);
        }
    }

    public function test_reset_clears_payment_allocations_and_keeps_supplier_links()
    {
        [$wh, $p] = $this->productWithStock();
        $client = Client::create(['name' => 'عميل']);
        $invoiceId = $this->postJson('/api/sales', ['client_id' => $client->id, 'product_id' => $p->id, 'quantity' => 1, 'price' => 100,
            'invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'paid_amount' => 0, 'warehouse_id' => $wh->id])->json('invoice.id');
        $this->postJson("/api/clients/{$client->id}/pay-debt", ['amount' => 40, 'payment_method' => 'cash', 'payment_date' => '2026-10-02'])->assertOk();
        $this->assertGreaterThan(0, DB::table('client_payment_allocations')->count());

        $s = Supplier::create(['name' => 'ورشة', 'debt_amount' => 0]);
        $s->materials()->attach($this->material()->id, ['price' => 25]);

        $this->postJson('/api/settings/reset-data')->assertOk();

        $this->assertEquals(0, DB::table('client_payment_allocations')->count());
        $this->assertEquals(1, DB::table('supplier_materials')->count());
        $this->assertNotNull($invoiceId);
    }

    public function test_material_or_product_used_by_documents_is_not_deleted()
    {
        $s = Supplier::create(['name' => 'مورد', 'debt_amount' => 0]);
        $used = $this->material();
        $this->postJson('/api/purchase-orders', ['supplier_id' => $s->id, 'order_date' => '2026-10-01',
            'items' => [['material_id' => $used->id, 'quantity' => 1, 'unit_cost' => 5]]])->assertSuccessful();
        $this->deleteJson("/api/materials/{$used->id}")->assertStatus(422);
        $this->assertNotNull($used->fresh());

        [$wh, $p] = $this->productWithStock();
        $this->postJson('/api/sales', ['product_id' => $p->id, 'quantity' => 1, 'price' => 30, 'invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'warehouse_id' => $wh->id])
            ->assertStatus(201);
        $this->deleteJson("/api/products/{$p->id}")->assertStatus(422);
        $this->assertEquals(99, InventoryService::getStock('product', $p->id, $wh->id));

        // An item with only an opening balance can still be deleted (e.g. entered by mistake)
        $fresh = Material::create(['category_id' => $used->category_id, 'name' => 'مسمار', 'unit' => 'حبة', 'unit_cost' => 1, 'stock_quantity' => 0]);
        InventoryService::recordMovement(warehouseId: $wh->id, materialId: $fresh->id, productId: null, movementType: 'Initial_Balance', quantity: 10, unitCost: 1, referenceNumber: 'INIT');
        $this->deleteJson("/api/materials/{$fresh->id}")->assertOk();
    }

    public function test_settings_user_cannot_grant_full_access()
    {
        $manager = User::factory()->create(['role' => 'manager', 'permissions' => ['manage_settings']]);
        $this->actingAs($manager);

        $this->postJson('/api/users', ['name' => 'x', 'email' => 'x@example.com', 'password' => 'secret12', 'role' => 'admin', 'permissions' => []])->assertStatus(403);
        $this->postJson('/api/users', ['name' => 'x', 'email' => 'x@example.com', 'password' => 'secret12', 'role' => 'sales', 'permissions' => ['manage_all']])->assertStatus(403);
        $this->putJson("/api/users/{$manager->id}", ['name' => 'me', 'email' => $manager->email, 'role' => 'admin', 'permissions' => ['manage_settings']])->assertStatus(403);
        $this->postJson('/api/users', ['name' => 'y', 'email' => 'y@example.com', 'password' => 'secret12', 'role' => 'sales', 'permissions' => ['manage_sales']])->assertStatus(201);

        $this->assertEquals('manager', $manager->fresh()->role);
    }

    public function test_logo_must_be_a_raster_image()
    {
        Storage::fake('public');
        $base = ['company_name' => 'ورشة', 'currency' => 'EGP', 'tax_rate' => 0];

        $this->post('/api/settings', $base + ['logo' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
            ['Accept' => 'application/json'])->assertStatus(422);
        $this->post('/api/settings', $base + ['logo' => UploadedFile::fake()->image('logo.png')], ['Accept' => 'application/json'])->assertOk();
    }

    public function test_sensitive_lists_need_the_matching_permission()
    {
        $this->actingAs(User::factory()->create(['role' => 'sales', 'permissions' => ['manage_sales']]));
        $employee = Employee::create(['name' => 'عامل', 'salary_cycle' => 'month', 'rate' => 5000, 'status' => 'active']);

        $this->getJson('/api/users')->assertStatus(403);
        $this->getJson('/api/backup/status')->assertStatus(403);
        $this->getJson('/api/employees-salaries')->assertStatus(403);
        $this->getJson("/api/employees/{$employee->id}/salaries")->assertStatus(403);
        $this->getJson("/api/employees/{$employee->id}/ledger")->assertStatus(403);

        $this->actingAs(User::factory()->create(['role' => 'hr', 'permissions' => ['manage_employees']]));
        $this->getJson('/api/employees-salaries')->assertOk();
        $this->getJson("/api/employees/{$employee->id}/ledger")->assertOk();
    }

    public function test_users_always_use_the_central_connection()
    {
        $central = config('erp.central_connection');
        $this->assertSame($central, (new User)->getConnectionName());

        DB::setDefaultConnection('tenant');
        try {
            $this->assertSame($central, (new User)->getConnectionName());
        } finally {
            DB::setDefaultConnection($central);
        }
    }

    public function test_expense_without_description_is_saved()
    {
        $this->postJson('/api/expenses', ['amount' => 10, 'expense_date' => '2026-10-01', 'category' => 'كهرباء'])->assertStatus(201);
    }

    public function test_leftovers_report_finds_old_damage_without_writing()
    {
        [$wh, $p] = $this->productWithStock();
        // Leftover of an edited invoice deleted before the fix
        InventoryService::recordMovement(warehouseId: $wh->id, materialId: null, productId: $p->id, movementType: 'Sales_Return', quantity: 2, unitCost: 10, referenceNumber: 'RET-INV-OLD-1');

        $s = Supplier::create(['name' => 'مورد', 'debt_amount' => 999]);
        $this->postJson('/api/purchase-orders', ['supplier_id' => $s->id, 'order_date' => '2026-10-01', 'deposit_paid' => 200, 'payment_method' => 'cash',
            'items' => [['material_id' => $this->material()->id, 'quantity' => 10, 'unit_cost' => 50]]])->assertSuccessful();
        SupplierPayment::query()->forceDelete();
        DB::table('suppliers')->where('id', $s->id)->update(['debt_amount' => 999]);
        DB::table('treasury_transactions')->insert(['transaction_date' => '2026-10-01', 'type' => 'outflow', 'amount' => 75, 'payment_method' => 'cash',
            'category' => 'x', 'description' => 'orphan', 'source_type' => ExternalServicePayment::class, 'source_id' => 4242, 'transaction_number' => 'TRX-ORPHAN-1', 'created_at' => now(), 'updated_at' => now()]);

        $snapshot = fn () => [
            DB::table('inventory_movements')->count(), DB::table('treasury_transactions')->count(),
            DB::table('suppliers')->pluck('debt_amount')->all(), DB::table('supplier_payments')->count(),
        ];
        $before = $snapshot();

        $this->artisan('system:audit-leftovers')
            ->expectsOutputToContain('INV-OLD-1')
            ->expectsOutputToContain('PO-')
            ->expectsOutputToContain('ExternalServicePayment#4242')
            ->assertSuccessful();

        $this->assertEquals($before, $snapshot());
    }
}
