<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Employee;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Operation;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\InventorySnapshot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuditFixesPass2Test extends TestCase
{
    use RefreshDatabase;

    private Warehouse $raw;
    private Warehouse $prod;
    private Warehouse $fin;
    private Material $mat;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));

        $this->raw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $this->prod = Warehouse::create(['name' => 'معرض', 'code' => 'WSH-P']);
        $this->fin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $this->mat = Material::create(['name' => 'خشب', 'unit' => 'متر', 'unit_cost' => 10, 'stock_quantity' => 0,
            'category_id' => MaterialCategory::create(['name' => 'خامات'])->id]);
        InventoryService::recordMovement(warehouseId: $this->raw->id, materialId: $this->mat->id, productId: null, movementType: 'Initial_Balance', quantity: 100, unitCost: 10, referenceNumber: 'INIT');

        $this->product = Product::create(['name' => 'كرسي', 'unit' => 'حبة', 'unit_cost' => 0, 'sale_price' => 100, 'stock_quantity' => 0,
            'category_id' => ProductCategory::create(['name' => 'كراسي'])->id]);
        $this->product->materials()->attach($this->mat->id, ['quantity' => 2]);
    }

    private function stock(Warehouse $wh): float
    {
        return InventoryService::getStock('product', $this->product->id, $wh->id);
    }

    private function treasuryTotal(): float
    {
        return (float) DB::table('treasury_transactions')->whereNull('deleted_at')->sum('amount');
    }

    private function order(array $overrides = []): int
    {
        return $this->postJson('/api/operations', array_merge([
            'warehouse_id' => $this->raw->id, 'product_id' => $this->product->id, 'quantity' => 3, 'total_price' => 300,
        ], $overrides))->assertStatus(201)->json('operation.id');
    }

    public function test_cancelling_a_completed_stock_order_does_not_add_stock_twice()
    {
        $id = $this->order(['quantity' => 5, 'total_price' => 0]);
        $this->postJson("/api/operations/{$id}/complete")->assertOk();
        $this->assertEquals(5, $this->stock($this->prod));

        $this->postJson("/api/operations/{$id}/cancel")->assertOk();

        $this->assertEquals(5, $this->stock($this->prod));
        $this->assertEquals(0, $this->stock($this->fin));
    }

    public function test_cancelling_a_completed_client_order_moves_its_goods_to_the_showroom()
    {
        $client = Client::create(['name' => 'عميل']);
        $id = $this->order(['client_id' => $client->id]);
        $this->postJson("/api/operations/{$id}/complete")->assertOk();
        $this->assertEquals(3, $this->stock($this->fin));

        $this->postJson("/api/operations/{$id}/cancel")->assertOk();

        $this->assertEquals(0, $this->stock($this->fin));
        $this->assertEquals(3, $this->stock($this->prod));
    }

    public function test_payments_are_refused_on_cancelled_orders_and_above_the_total()
    {
        $client = Client::create(['name' => 'عميل']);
        $id = $this->order(['client_id' => $client->id, 'deposit_paid' => 100, 'deposit_payment_method' => 'cash']);

        $this->postJson("/api/operations/{$id}/payments", ['amount' => 250, 'payment_date' => '2026-10-01', 'payment_method' => 'cash'])->assertStatus(422);
        $this->postJson("/api/operations/{$id}/payments", ['amount' => 200, 'payment_date' => '2026-10-01', 'payment_method' => 'cash'])->assertStatus(201);

        $cancelled = $this->order(['client_id' => $client->id]);
        $this->postJson("/api/operations/{$cancelled}/cancel")->assertOk();
        $this->postJson("/api/operations/{$cancelled}/payments", ['amount' => 50, 'payment_date' => '2026-10-01', 'payment_method' => 'cash'])->assertStatus(422);

        $this->assertEquals(300, $this->treasuryTotal());
    }

    public function test_deleting_a_delivery_invoice_returns_the_goods_and_allows_redelivery()
    {
        $client = Client::create(['name' => 'عميل']);
        $id = $this->order(['client_id' => $client->id]);
        $this->postJson("/api/operations/{$id}/complete")->assertOk();
        $invoiceId = $this->postJson("/api/operations/{$id}/deliver")->assertOk()->json('invoice.id');
        $this->assertEquals(0, $this->stock($this->fin));

        $this->deleteJson("/api/sales/{$invoiceId}")->assertOk();
        $this->assertEquals(3, $this->stock($this->fin));
        $this->assertEquals('Completed', Operation::find($id)->status);

        $this->postJson("/api/operations/{$id}/deliver")->assertOk();
        $this->assertEquals(0, $this->stock($this->fin));
    }

    public function test_deleting_an_invoice_keeps_client_payments_as_credit()
    {
        InventoryService::recordMovement(warehouseId: $this->prod->id, materialId: null, productId: $this->product->id, movementType: 'Initial_Balance', quantity: 10, unitCost: 10, referenceNumber: 'I');
        $client = Client::create(['name' => 'عميل']);
        $sale = fn ($qty, $date) => $this->postJson('/api/sales', ['client_id' => $client->id, 'product_id' => $this->product->id, 'quantity' => $qty, 'price' => 100,
            'invoice_date' => $date, 'payment_method' => 'cash', 'paid_amount' => 0, 'warehouse_id' => $this->prod->id])->assertStatus(201)->json('invoice.id');
        $a = $sale(3, '2026-10-01');
        $b = $sale(7, '2026-10-02');
        $this->postJson("/api/clients/{$client->id}/pay-debt", ['amount' => 1000, 'payment_method' => 'cash', 'payment_date' => '2026-10-03'])->assertOk();

        $this->deleteJson("/api/sales/{$a}")->assertOk();

        $this->assertEquals(1, ClientPayment::count());
        $this->assertEquals(1000, $this->treasuryTotal());
        $this->assertEquals(0, (float) SalesInvoice::find($b)->remaining_amount);
        $this->assertEquals(-300, (float) $client->fresh()->debt_amount);
        $this->assertEquals($b, ClientPayment::first()->sales_invoice_id);
    }

    public function test_a_warehouse_that_never_received_an_item_holds_none_of_it()
    {
        InventoryService::recordMovement(warehouseId: $this->prod->id, materialId: null, productId: $this->product->id, movementType: 'Initial_Balance', quantity: 5, unitCost: 10, referenceNumber: 'I');

        $this->assertEquals(5, $this->stock($this->prod));
        $this->assertEquals(0, $this->stock($this->fin));
        $this->assertEquals(5, InventoryService::getStock('product', $this->product->id));

        $snapshot = InventorySnapshot::for('product', collect([$this->product->fresh()]));
        $this->assertEquals(0, $snapshot->liveStock($this->product->fresh(), $this->fin->id));
        $this->assertEquals(5, $snapshot->liveStock($this->product->fresh(), $this->prod->id));

        // Legacy item with only a stock_quantity baseline and no movements keeps its baseline
        $legacy = Product::create(['name' => 'قديم', 'unit' => 'حبة', 'unit_cost' => 1, 'sale_price' => 2, 'stock_quantity' => 7, 'category_id' => $this->product->category_id]);
        $this->assertEquals(7, InventoryService::getStock('product', $legacy->id, $this->fin->id));
    }

    public function test_saving_a_timesheet_keeps_the_payment_method_of_an_advance()
    {
        $e = Employee::create(['name' => 'عامل', 'salary_cycle' => 'month', 'rate' => 200, 'status' => 'active']);
        $this->postJson("/api/employees/{$e->id}/salaries", ['type' => 'advance', 'amount' => 500, 'payment_date' => '2026-10-19', 'payment_method' => 'instapay'])->assertStatus(201);
        $before = DB::table('treasury_transactions')->get(['id', 'amount', 'payment_method'])->toArray();

        $save = fn ($advance) => $this->postJson("/api/employees/{$e->id}/timesheet", ['week_start' => '2026-10-17', 'days' => [
            ['date' => '2026-10-19', 'work_mode' => 'full_day', 'daily_wage' => 200, 'advance_amount' => $advance],
        ]])->assertOk();

        $save(500);
        $this->assertEquals($before, DB::table('treasury_transactions')->whereNull('deleted_at')->get(['id', 'amount', 'payment_method'])->toArray());

        $save(300);
        $rows = DB::table('treasury_transactions')->whereNull('deleted_at')->get(['amount', 'payment_method']);
        $this->assertCount(1, $rows);
        $this->assertEquals([300.0, 'instapay'], [(float) $rows[0]->amount, $rows[0]->payment_method]);

        $save(0);
        $this->assertEquals(0, $this->treasuryTotal());
    }

    public function test_transfer_moves_stock_at_its_fifo_cost()
    {
        InventoryService::recordMovement(warehouseId: $this->prod->id, materialId: null, productId: $this->product->id, movementType: 'Initial_Balance', quantity: 4, unitCost: 25, referenceNumber: 'I');

        $this->postJson('/api/inventory/movements', ['warehouse_id' => $this->prod->id, 'target_warehouse_id' => $this->fin->id, 'item_id' => $this->product->id,
            'item_type' => 'product', 'movement_type' => 'Transfer', 'quantity' => 2, 'unit_cost' => 999])->assertStatus(201);

        $costs = DB::table('inventory_movements')->whereIn('movement_type', ['Transfer_Out', 'Transfer_In'])->pluck('unit_cost')->map(fn ($c) => (float) $c)->all();
        $this->assertEquals([25.0, 25.0], $costs);
    }

    public function test_leftovers_report_lists_pass_two_damage_without_writing()
    {
        // 6) a payment soft-deleted with the invoice it settled (old destroy behaviour)
        InventoryService::recordMovement(warehouseId: $this->prod->id, materialId: null, productId: $this->product->id, movementType: 'Initial_Balance', quantity: 10, unitCost: 10, referenceNumber: 'I');
        $client = Client::create(['name' => 'عميل الاختبار']);
        $inv = $this->postJson('/api/sales', ['client_id' => $client->id, 'product_id' => $this->product->id, 'quantity' => 1, 'price' => 100,
            'invoice_date' => '2026-10-01', 'payment_method' => 'cash', 'paid_amount' => 0, 'warehouse_id' => $this->prod->id])->json('invoice.id');
        $this->postJson("/api/clients/{$client->id}/pay-debt", ['amount' => 100, 'payment_method' => 'cash', 'payment_date' => '2026-10-02'])->assertOk();
        DB::table('client_payments')->update(['deleted_at' => now()]);
        DB::table('sales_invoices')->where('id', $inv)->update(['deleted_at' => now()]);

        // 7) stock issued from a warehouse that never had it
        DB::table('inventory_movements')->insert(['movement_number' => 'MV-NEG', 'warehouse_id' => $this->fin->id, 'product_id' => $this->product->id, 'movement_type' => 'Sales_Issue',
            'quantity' => 2, 'unit_cost' => 10, 'reference_number' => 'X', 'movement_date' => now(), 'created_at' => now(), 'updated_at' => now()]);

        // 8) an InstaPay advance replaced by a cash one from the timesheet
        $e = Employee::create(['name' => 'عامل السلفة', 'salary_cycle' => 'month', 'rate' => 200, 'status' => 'active']);
        DB::table('employee_salaries')->insert([
            ['employee_id' => $e->id, 'type' => 'advance', 'payment_date' => '2026-10-19', 'base_salary' => 0, 'deductions' => 0, 'net_salary' => 500, 'payment_method' => 'instapay', 'notes' => null, 'deleted_at' => now(), 'created_at' => now(), 'updated_at' => now()],
            ['employee_id' => $e->id, 'type' => 'advance', 'payment_date' => '2026-10-19', 'base_salary' => 0, 'deductions' => 0, 'net_salary' => 500, 'payment_method' => 'cash', 'notes' => 'سلفة يومية من جدول العمل: 2026-10-19', 'deleted_at' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $counts = fn () => collect(['client_payments', 'sales_invoices', 'inventory_movements', 'employee_salaries', 'treasury_transactions', 'suppliers'])
            ->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all();
        $before = $counts();

        $this->artisan('system:audit-leftovers')
            ->expectsOutputToContain('عميل الاختبار')
            ->expectsOutputToContain('طلبيات')
            ->expectsOutputToContain('عامل السلفة')
            ->assertSuccessful();

        $this->assertEquals($before, $counts());
    }
}
