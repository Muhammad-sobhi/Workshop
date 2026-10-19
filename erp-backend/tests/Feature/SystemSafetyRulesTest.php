<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Operation;
use App\Models\OperationPayment;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\Supplier;
use App\Models\TreasuryTransaction;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemSafetyRulesTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $whRaw;
    private Warehouse $whProd;
    private Warehouse $whFin;
    private Client $client;
    private Material $wood;
    private Product $chair;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->actingAs(\App\Models\User::factory()->create(['role' => 'admin']));

        $this->whRaw  = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $this->whProd = Warehouse::create(['name' => 'مخزن المنتجات', 'code' => 'WSH-P']);
        $this->whFin  = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);
        $this->client = Client::create(['name' => 'عميل', 'phone' => '0100']);

        $this->wood = Material::create([
            'name' => 'خشب', 'unit' => 'م', 'unit_cost' => 10,
            'category_id' => \App\Models\MaterialCategory::create(['name' => 'خامات'])->id,
            'warehouse_id' => $this->whRaw->id,
        ]);
        InventoryService::recordMovement($this->whRaw->id, $this->wood->id, null, 'Purchase_Receipt', 100, 10, 'PO-SEED');

        $this->chair = Product::create([
            'name' => 'كرسي', 'unit' => 'ك', 'unit_cost' => 0, 'sale_price' => 200,
            'category_id' => \App\Models\ProductCategory::create(['name' => 'كراسي'])->id,
        ]);
        $this->chair->materials()->attach($this->wood->id, ['quantity' => 2]);
    }

    // ── 1/2. Editing orders ───────────────────────────────────────────────

    public function test_editing_a_completed_order_changes_prices_only_and_never_touches_stock()
    {
        $id = $this->order();
        $this->postJson("/api/operations/$id/complete")->assertOk();

        $payload = $this->orderPayload(['total_price' => 1250, 'products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'unit_price' => 250]]]);
        $this->putJson("/api/operations/$id", $payload)->assertOk();
        $this->putJson("/api/operations/$id", $payload)->assertOk();

        $this->assertEquals(90, $this->woodStock());
        $this->assertEquals(5, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));
        $this->assertEquals(250, (float) Operation::find($id)->operationProducts->first()->unit_price);

        // Changing quantities after production started is refused
        $this->putJson("/api/operations/$id", $this->orderPayload(['products' => [['product_id' => $this->chair->id, 'quantity' => 6, 'unit_price' => 250]]]))
            ->assertStatus(422);
        $this->assertEquals(90, $this->woodStock());
    }

    public function test_a_delivered_order_cannot_be_edited_or_delivered_twice()
    {
        $id = $this->order();
        $this->postJson("/api/operations/$id/complete")->assertOk();
        $this->postJson("/api/operations/$id/deliver")->assertOk();

        $this->putJson("/api/operations/$id", $this->orderPayload())->assertStatus(422);
        $this->postJson("/api/operations/$id/deliver")->assertStatus(400);

        $this->assertEquals('Delivered', Operation::find($id)->status);
        $this->assertEquals(1, SalesInvoice::where('operation_id', $id)->count());
        $this->assertEquals(1000, (float) $this->client->fresh()->debt_amount);
    }

    public function test_pending_order_edit_moves_its_stock_reservation()
    {
        $this->stockChairs(5);
        $id = $this->order(['products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'quantity_taken_from_stock' => 2, 'unit_price' => 200]]]);
        $this->assertEquals(2, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));

        $this->putJson("/api/operations/$id", $this->orderPayload(['products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'quantity_taken_from_stock' => 4, 'unit_price' => 200]]]))
            ->assertOk();
        $this->assertEquals(1, InventoryService::getStock('product', $this->chair->id, $this->whProd->id));
        $this->assertEquals(4, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));
    }

    // ── 3. Stock can never be overdrawn ───────────────────────────────────

    public function test_stock_taken_for_an_order_is_reserved_and_cannot_be_sold_twice()
    {
        $this->stockChairs(3);
        $id = $this->order(['products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'quantity_taken_from_stock' => 3, 'unit_price' => 200]]]);

        $this->assertEquals(0, InventoryService::getStock('product', $this->chair->id, $this->whProd->id));
        $this->assertEquals(3, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));

        $this->postJson('/api/sales', $this->salePayload(3))->assertStatus(400);

        $this->postJson("/api/operations/$id/complete")->assertOk();
        $this->postJson("/api/operations/$id/deliver")->assertOk();
        $this->assertEquals(0, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));
        $this->assertEquals(0, $this->trueBalance($this->chair->id, $this->whProd->id));
        $this->assertEquals(0, $this->trueBalance($this->chair->id, $this->whFin->id));
    }

    public function test_legacy_order_whose_stock_was_used_elsewhere_cannot_complete()
    {
        $this->stockChairs(3);
        $id = $this->order();
        // Created before reservations existed: plan says 3 from stock, nothing reserved
        Operation::find($id)->operationProducts()->update(['quantity_taken_from_stock' => 3]);
        $this->postJson('/api/sales', $this->salePayload(3))->assertStatus(201);

        $this->postJson("/api/operations/$id/complete")->assertStatus(422);
        $this->assertEquals(0, $this->trueBalance($this->chair->id, $this->whProd->id));
    }

    public function test_recording_an_outgoing_movement_beyond_stock_is_refused()
    {
        $this->expectException(\InvalidArgumentException::class);
        InventoryService::recordMovement($this->whRaw->id, $this->wood->id, null, 'Damaged', 101, 10);
    }

    // ── 4/5. Payments and the client statement ───────────────────────────

    public function test_deleting_a_stage_payment_removes_it_from_the_statement_and_treasury()
    {
        $id = $this->order();
        $payId = $this->postJson("/api/operations/$id/payments", ['amount' => 300, 'payment_date' => now()->toDateString()])
            ->assertStatus(201)->json('payment.id');

        $this->deleteJson("/api/operations/$id/payments/$payId")->assertOk();

        $this->assertEquals(0, ClientPayment::count());
        $this->assertEquals(0, (float) TreasuryTransaction::sum('amount'));
        $this->assertCount(0, collect($this->getJson("/api/clients/{$this->client->id}/transactions")->json())->where('is_payment', true));
    }

    public function test_legacy_unlinked_stage_payment_row_is_removed_too()
    {
        $id = $this->order();
        $payId = $this->postJson("/api/operations/$id/payments", ['amount' => 300, 'payment_date' => now()->toDateString(), 'note' => 'x'])->json('payment.id');
        ClientPayment::query()->update(['operation_payment_id' => null]); // rows created before the link column

        $this->deleteJson("/api/operations/$id/payments/$payId")->assertOk();
        $this->assertEquals(0, ClientPayment::count());
    }

    public function test_order_money_deleted_from_the_client_statement_goes_through_the_order()
    {
        $id = $this->order(['deposit_paid' => 400]);
        $this->postJson("/api/operations/$id/payments", ['amount' => 100, 'payment_date' => now()->toDateString()])->assertStatus(201);
        $deposit = ClientPayment::whereNull('operation_payment_id')->first();
        $stage   = ClientPayment::whereNotNull('operation_payment_id')->first();

        $this->deleteJson("/api/clients/{$this->client->id}/payments/pay-{$deposit->id}")->assertStatus(422);
        $this->assertNotNull(ClientPayment::find($deposit->id));

        $this->deleteJson("/api/clients/{$this->client->id}/payments/pay-{$stage->id}")->assertOk();
        $this->assertEquals(0, OperationPayment::count());
        $this->assertEquals(400, (float) TreasuryTransaction::sum('amount'));
    }

    // ── 6. Cancel: credit or void ─────────────────────────────────────────

    public function test_cancel_keeping_collected_money_as_client_credit()
    {
        $id = $this->order(['deposit_paid' => 400]);
        $this->postJson("/api/operations/$id/payments", ['amount' => 100, 'payment_date' => now()->toDateString()])->assertStatus(201);

        $this->postJson("/api/operations/$id/cancel", ['deposit_action' => 'credit'])->assertOk();

        $this->assertEquals(500, (float) TreasuryTransaction::sum('amount'));
        $this->assertEquals(-500, (float) $this->client->fresh()->debt_amount);
        $this->assertEquals(0, OperationPayment::count());
        $this->assertEquals(500, (float) ClientPayment::whereNull('operation_id')->sum('amount'));

        // The credit pays the next invoice automatically
        $this->stockChairs(2);
        $this->postJson('/api/sales', $this->salePayload(2, 0))->assertStatus(201);
        $this->assertEquals(-100, (float) $this->client->fresh()->debt_amount);

        // Deleting a credit row reverses its treasury entry too
        $row = ClientPayment::whereNull('operation_id')->orderByDesc('amount')->first();
        $this->deleteJson("/api/clients/{$this->client->id}/payments/pay-{$row->id}")->assertOk();
        $this->assertEquals(100, (float) TreasuryTransaction::where('category', '!=', 'مبيعات منتجات جاهزة')->sum('amount'));
    }

    public function test_cancel_voiding_collected_money_as_if_never_paid()
    {
        $id = $this->order(['deposit_paid' => 400]);
        $this->postJson("/api/operations/$id/payments", ['amount' => 100, 'payment_date' => now()->toDateString()])->assertStatus(201);

        $this->postJson("/api/operations/$id/cancel", ['deposit_action' => 'void'])->assertOk();

        $this->assertEquals(0, (float) TreasuryTransaction::sum('amount'));
        $this->assertEquals(0, ClientPayment::count());
        $this->assertEquals(0, (float) $this->client->fresh()->debt_amount);
        $this->assertCount(0, collect($this->getJson("/api/clients/{$this->client->id}/transactions")->json())->where('is_payment', true));
    }

    public function test_cancelling_a_started_order_returns_materials_and_reserved_stock()
    {
        $this->stockChairs(2);
        $id = $this->order(['products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'quantity_taken_from_stock' => 2, 'unit_price' => 200]]]);
        $this->postJson("/api/operations/$id/start")->assertOk();
        $this->assertEquals(94, $this->woodStock());

        $this->postJson("/api/operations/$id/cancel")->assertOk();

        $this->assertEquals(100, $this->woodStock());
        $this->assertEquals(2, InventoryService::getStock('product', $this->chair->id, $this->whProd->id));
        $this->assertEquals(0, InventoryService::getStock('product', $this->chair->id, $this->whFin->id));
    }

    public function test_completed_or_delivered_orders_cannot_be_hard_deleted()
    {
        $id = $this->order(['deposit_paid' => 100]);
        $this->postJson("/api/operations/$id/complete")->assertOk();
        $this->deleteJson("/api/operations/$id")->assertStatus(422);

        $pending = $this->order(['deposit_paid' => 50]);
        $this->deleteJson("/api/operations/$pending")->assertOk();
        $this->assertEquals(0, ClientPayment::where('operation_id', $pending)->count());
    }

    // ── 7. Invoice client change ──────────────────────────────────────────

    public function test_moving_an_invoice_to_another_client_clears_the_old_clients_debt()
    {
        $other = Client::create(['name' => 'عميل 2', 'phone' => '0101']);
        $this->stockChairs(10);
        $invId = $this->postJson('/api/sales', $this->salePayload(2, 0))->assertStatus(201)->json('invoice.id');

        $this->putJson("/api/sales/$invId", array_merge($this->salePayload(2, 0), ['client_id' => $other->id]))->assertOk();

        $this->assertEquals(0, (float) $this->client->fresh()->debt_amount);
        $this->assertEquals(400, (float) $other->fresh()->debt_amount);
    }

    // ── 8. Purchase orders ────────────────────────────────────────────────

    public function test_purchase_order_whose_materials_were_used_cannot_be_deleted_but_can_be_repriced()
    {
        $supplier = Supplier::create(['name' => 'مورد', 'phone' => '0102']);
        $payload = ['supplier_id' => $supplier->id, 'order_date' => now()->toDateString(),
            'items' => [['material_id' => $this->wood->id, 'quantity' => 50, 'unit_cost' => 12]]];
        $poId = $this->postJson('/api/purchase-orders', $payload)->assertStatus(201)->json('order.id');
        $this->postJson("/api/purchase-orders/$poId/receive")->assertOk();

        InventoryService::recordMovement($this->whRaw->id, $this->wood->id, null, 'Production_Consumption', 140, 10, 'OP-X');

        $this->deleteJson("/api/purchase-orders/$poId")->assertStatus(422);
        $this->assertEquals(10, $this->woodStock());

        $payload['items'][0]['unit_cost'] = 11;
        $this->putJson("/api/purchase-orders/$poId", $payload)->assertOk();
        $this->assertEquals(10, $this->woodStock());

        $payload['items'][0]['quantity'] = 20; // would remove 30 already-used units
        $this->putJson("/api/purchase-orders/$poId", $payload)->assertStatus(422);
        $this->assertEquals(10, $this->woodStock());
    }

    // ── 9. Payment without a note ─────────────────────────────────────────

    public function test_stage_payment_without_note_is_saved()
    {
        $id = $this->order();
        $this->postJson("/api/operations/$id/payments", ['amount' => 50, 'payment_date' => now()->toDateString()])->assertStatus(201);
    }

    // ── Editing a material / product never doubles or wipes its stock ────

    public function test_editing_a_material_keeps_its_stock_and_applies_only_typed_changes()
    {
        $payload = ['name' => 'خشب زان', 'unit' => 'م', 'unit_cost' => 10, 'category_id' => $this->wood->category_id];

        // The edit form sends the current stock back: nothing changes
        $this->putJson("/api/materials/{$this->wood->id}", $payload + ['initial_stock' => 100])->assertOk();
        $this->assertEquals(100, $this->woodStock());

        $this->putJson("/api/materials/{$this->wood->id}", $payload + ['initial_stock' => 80])->assertOk();
        $this->assertEquals(80, $this->woodStock());
        $this->putJson("/api/materials/{$this->wood->id}", $payload + ['initial_stock' => 95])->assertOk();
        $this->assertEquals(95, $this->woodStock());
    }

    public function test_editing_a_product_keeps_its_stock()
    {
        $this->stockChairs(7);
        $payload = ['name' => 'كرسي جديد', 'unit' => 'ك', 'sale_price' => 250, 'category_id' => $this->chair->category_id,
            'materials' => [['id' => $this->wood->id, 'type' => 'material', 'quantity' => 2]]];

        $this->putJson("/api/products/{$this->chair->id}", $payload + ['initial_stock' => 7])->assertOk();
        $this->assertEquals(7, InventoryService::getStock('product', $this->chair->id, $this->whProd->id));
        $this->putJson("/api/products/{$this->chair->id}", $payload)->assertOk();
        $this->assertEquals(7, InventoryService::getStock('product', $this->chair->id, $this->whProd->id));
    }

    public function test_manual_movements_respect_stock_and_allowed_types()
    {
        $base = ['warehouse_id' => $this->whRaw->id, 'item_id' => $this->wood->id, 'item_type' => 'material', 'unit_cost' => 10];
        $this->postJson('/api/inventory/movements', $base + ['movement_type' => 'Sales_Issue', 'quantity' => 5])->assertStatus(422);
        $this->postJson('/api/inventory/movements', $base + ['movement_type' => 'Damaged', 'quantity' => 150])->assertStatus(400);
        $this->postJson('/api/inventory/movements', $base + ['movement_type' => 'Damaged', 'quantity' => 10])->assertStatus(201);
        $this->assertEquals(90, $this->woodStock());

        $this->stockChairs(2);
        $this->postJson('/api/inventory/movements', ['warehouse_id' => $this->whProd->id, 'item_id' => $this->chair->id, 'item_type' => 'product',
            'unit_cost' => 100, 'movement_type' => 'Transfer', 'quantity' => 3, 'target_warehouse_id' => $this->whFin->id])->assertStatus(400);
    }

    // ── Integrity check ───────────────────────────────────────────────────

    public function test_integrity_check_passes_on_clean_data_and_flags_negative_stock()
    {
        $id = $this->order(['deposit_paid' => 100]);
        $this->postJson("/api/operations/$id/complete")->assertOk();
        $this->postJson("/api/operations/$id/deliver")->assertOk();
        $this->artisan('system:integrity-check')->assertSuccessful();

        InventoryMovement::create([
            'movement_number' => InventoryMovement::generateMovementNumber(), 'movement_date' => now(),
            'warehouse_id' => $this->whRaw->id, 'material_id' => $this->wood->id, 'movement_type' => 'Damaged',
            'quantity' => 500, 'unit_cost' => 10, 'total_cost' => 5000,
        ]);
        $this->artisan('system:integrity-check')->assertFailed();
    }

    public function test_integrity_check_repairs_cancelled_orders_still_holding_money()
    {
        $id = $this->order(['deposit_paid' => 300]);
        Operation::find($id)->update(['status' => 'Cancelled']); // old cancel: money kept, credit lost
        $this->client->recalculateDebt();
        $this->assertEquals(0, (float) $this->client->fresh()->debt_amount);

        $this->artisan('system:integrity-check')->assertFailed();
        $this->artisan('system:integrity-check', ['--cancelled-deposits' => 'credit'])->assertFailed();
        $this->assertEquals(-300, (float) $this->client->fresh()->debt_amount);
        $this->artisan('system:integrity-check')->assertSuccessful();
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private function orderPayload(array $extra = []): array
    {
        return array_merge([
            'client_id' => $this->client->id, 'warehouse_id' => $this->whRaw->id, 'total_price' => 1000,
            'products' => [['product_id' => $this->chair->id, 'quantity' => 5, 'unit_price' => 200]],
        ], $extra);
    }

    private function order(array $extra = []): int
    {
        return $this->postJson('/api/operations', $this->orderPayload($extra))->assertStatus(201)->json('operation.id');
    }

    private function salePayload(float $qty, ?float $paid = null): array
    {
        return array_filter([
            'client_id' => $this->client->id, 'invoice_date' => now()->toDateString(), 'payment_method' => 'cash',
            'paid_amount' => $paid,
            'items' => [['product_id' => $this->chair->id, 'quantity' => $qty, 'unit_sale_price' => 200]],
        ], fn ($v) => $v !== null);
    }

    private function stockChairs(float $qty): void
    {
        InventoryService::recordMovement($this->whProd->id, null, $this->chair->id, 'Purchase_Receipt', $qty, 100, 'PO-CHAIRS');
    }

    private function woodStock(): float
    {
        return InventoryService::getStock('material', $this->wood->id, $this->whRaw->id);
    }

    private function trueBalance(int $productId, int $warehouseId): float
    {
        $sum = fn ($types) => (float) InventoryMovement::where('product_id', $productId)->where('warehouse_id', $warehouseId)
            ->whereIn('movement_type', $types)->sum('quantity');
        return round($sum(InventoryService::INCOMING_TYPES) - $sum(InventoryService::OUTGOING_TYPES), 2);
    }
}
