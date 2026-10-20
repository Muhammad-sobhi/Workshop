<?php

namespace Tests\Feature;

use App\Models\ExternalServiceOrder;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ExternalServiceOrderEditTest extends TestCase
{
    use RefreshDatabase;

    private Supplier $supplierA;
    private Supplier $supplierB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]));

        $this->supplierA = Supplier::create(['name' => 'ورشة أ', 'debt_amount' => 0]);
        $this->supplierB = Supplier::create(['name' => 'ورشة ب', 'debt_amount' => 0]);
    }

    private function createOrder(array $overrides = []): ExternalServiceOrder
    {
        $res = $this->postJson('/api/external-service-orders', array_merge([
            'supplier_id' => $this->supplierA->id,
            'item_description' => 'دهان كراسي',
            'quantity' => 10,
            'unit' => 'قطعة',
            'unit_cost' => 100,
            'sent_date' => '2026-10-01',
            'initial_payment' => 300,
            'payment_method' => 'cash',
        ], $overrides));
        $res->assertStatus(201);

        return ExternalServiceOrder::findOrFail($res->json('order.id'));
    }

    private function payload(ExternalServiceOrder $order, array $overrides = []): array
    {
        return array_merge([
            'supplier_id' => $order->supplier_id,
            'item_description' => $order->item_description,
            'quantity' => (float) $order->quantity,
            'unit' => $order->unit,
            'unit_cost' => (float) $order->unit_cost,
            'sent_date' => $order->sent_date->format('Y-m-d'),
        ], $overrides);
    }

    private function treasurySnapshot(): array
    {
        return DB::table('treasury_transactions')->orderBy('id')->get()->map(fn ($t) => (array) $t)->all();
    }

    #[Test]
    public function editing_cost_recomputes_totals_and_supplier_debt_without_touching_treasury()
    {
        $order = $this->createOrder();
        $this->assertEquals(700.00, (float) $this->supplierA->fresh()->debt_amount);
        $treasuryBefore = $this->treasurySnapshot();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, [
            'quantity' => 12,
            'unit_cost' => 125.5,
            'item_description' => 'دهان كراسي فورجيه',
            'sent_date' => '2026-10-05',
            'expected_return_date' => '2026-10-20',
            'notes' => 'معدل',
        ]))->assertOk();

        $order->refresh();
        $this->assertEquals(1506.00, (float) $order->total_cost);
        $this->assertEquals(300.00, (float) $order->total_paid);
        $this->assertEquals(1206.00, (float) $order->balance);
        $this->assertEquals('دهان كراسي فورجيه', $order->item_description);
        $this->assertEquals('2026-10-05', $order->sent_date->format('Y-m-d'));
        $this->assertEquals('2026-10-20', $order->expected_return_date->format('Y-m-d'));
        $this->assertEquals('sent', $order->status);
        $this->assertCount(1, $order->payments);

        $this->assertEquals(1206.00, (float) $this->supplierA->fresh()->debt_amount);
        $this->assertEquals($treasuryBefore, $this->treasurySnapshot());

        // Lowering the cost back down is reflected exactly too
        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['quantity' => 5, 'unit_cost' => 60]))
            ->assertOk();
        $this->assertEquals(0.00, (float) $order->fresh()->balance);
        $this->assertEquals(0.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function editing_twice_with_the_same_values_is_idempotent()
    {
        $order = $this->createOrder();
        $payload = $this->payload($order, ['unit_cost' => 150]);

        $this->putJson("/api/external-service-orders/{$order->id}", $payload)->assertOk();
        $this->putJson("/api/external-service-orders/{$order->id}", $payload)->assertOk();

        $this->assertEquals(1200.00, (float) $order->fresh()->balance);
        $this->assertEquals(1200.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function changing_supplier_moves_the_debt_to_the_new_supplier()
    {
        $order = $this->createOrder();
        // Another order stays on supplier A
        $this->createOrder(['quantity' => 2, 'unit_cost' => 50, 'initial_payment' => 0]);
        $this->assertEquals(800.00, (float) $this->supplierA->fresh()->debt_amount);

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, [
            'supplier_id' => $this->supplierB->id,
        ]))->assertOk();

        $this->assertEquals(100.00, (float) $this->supplierA->fresh()->debt_amount);
        $this->assertEquals(700.00, (float) $this->supplierB->fresh()->debt_amount);
        $this->assertEquals($this->supplierB->id, $order->fresh()->supplier_id);
    }

    #[Test]
    public function cost_below_paid_amount_is_refused_and_nothing_changes()
    {
        $order = $this->createOrder();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['quantity' => 2, 'unit_cost' => 100]))
            ->assertStatus(422);

        $order->refresh();
        $this->assertEquals(1000.00, (float) $order->total_cost);
        $this->assertEquals(700.00, (float) $order->balance);
        $this->assertEquals(700.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function quantity_below_received_is_refused_and_status_follows_quantity()
    {
        $order = $this->createOrder();
        $this->putJson("/api/external-service-orders/{$order->id}/returns", [
            'returned_quantity' => 8,
            'rejected_quantity' => 2,
        ])->assertOk();
        $this->assertEquals('completed', $order->fresh()->status);

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order->fresh(), ['quantity' => 9]))
            ->assertStatus(422);
        $this->assertEquals(10.00, (float) $order->fresh()->quantity);

        // More pieces than received -> partially received
        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order->fresh(), ['quantity' => 15]))
            ->assertOk();
        $this->assertEquals('partially_received', $order->fresh()->status);

        // Back to exactly the received amount -> completed
        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order->fresh(), ['quantity' => 10]))
            ->assertOk();
        $this->assertEquals('completed', $order->fresh()->status);
    }

    #[Test]
    public function cancelled_order_keeps_its_status_and_stays_out_of_supplier_debt()
    {
        $order = $this->createOrder();
        $this->putJson("/api/external-service-orders/{$order->id}/status", ['status' => 'cancelled'])->assertOk();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order->fresh(), ['unit_cost' => 200]))
            ->assertOk();

        $this->assertEquals('cancelled', $order->fresh()->status);
        $this->assertEquals(1700.00, (float) $order->fresh()->balance);
        $this->assertEquals(0.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function payments_after_edit_keep_balance_consistent()
    {
        $order = $this->createOrder();
        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['unit_cost' => 150]))->assertOk();

        $this->postJson("/api/external-service-orders/{$order->id}/payments", [
            'amount' => 200,
            'payment_method' => 'cash',
            'payment_date' => '2026-10-10',
        ])->assertOk();

        $order->refresh();
        $this->assertEquals(500.00, (float) $order->total_paid);
        $this->assertEquals(1000.00, (float) $order->balance);
        $this->assertEquals(1000.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function invalid_input_is_rejected()
    {
        $order = $this->createOrder();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['quantity' => 0]))
            ->assertStatus(422)->assertJsonValidationErrors('quantity');
        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['supplier_id' => 999999]))
            ->assertStatus(422)->assertJsonValidationErrors('supplier_id');
        $this->putJson('/api/external-service-orders/999999', $this->payload($order))
            ->assertNotFound();
    }

    private function outflows(): array
    {
        return DB::table('treasury_transactions')->whereNull('deleted_at')->orderBy('id')
            ->get(['amount', 'payment_method'])->map(fn ($t) => [(float) $t->amount, $t->payment_method])->all();
    }

    #[Test]
    public function editing_the_advance_payment_rewrites_its_treasury_entry_and_debt()
    {
        $order = $this->createOrder();
        $this->postJson("/api/external-service-orders/{$order->id}/payments", [
            'amount' => 100, 'payment_method' => 'cash', 'payment_date' => '2026-10-03',
        ])->assertOk();

        // Multipart POST with _method=PUT, exactly as the dashboard sends it.
        $this->post("/api/external-service-orders/{$order->id}", $this->payload($order, [
            '_method' => 'PUT',
            'initial_payment' => 450,
            'payment_method' => 'instapay',
            'transaction_reference' => 'REF-1',
        ]), ['Accept' => 'application/json'])->assertOk();

        $order->refresh();
        $this->assertEquals(550.00, (float) $order->total_paid);
        $this->assertEquals(450.00, (float) $order->balance);
        $this->assertEquals(450.00, (float) $this->supplierA->fresh()->debt_amount);
        $this->assertCount(2, $order->payments);
        $this->assertEqualsCanonicalizing([[100.0, 'cash'], [450.0, 'instapay']], $this->outflows());
        $advance = $order->payments->sortBy('id')->first();
        $this->assertEquals('REF-1', $advance->transaction_reference);
        $this->assertEquals('2026-10-01', $advance->payment_date->format('Y-m-d'));
    }

    #[Test]
    public function unchanged_advance_payment_leaves_treasury_untouched()
    {
        $order = $this->createOrder();
        $before = $this->treasurySnapshot();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, [
            'unit_cost' => 120, 'initial_payment' => 300, 'payment_method' => 'cash',
        ]))->assertOk();

        $this->assertEquals($before, $this->treasurySnapshot());
        $this->assertEquals(900.00, (float) $order->fresh()->balance);
    }

    #[Test]
    public function advance_payment_can_be_removed_and_added()
    {
        $order = $this->createOrder();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['initial_payment' => 0]))->assertOk();
        $order->refresh();
        $this->assertCount(0, $order->payments);
        $this->assertEquals(0.00, (float) $order->total_paid);
        $this->assertEquals([], $this->outflows());
        $this->assertEquals(1000.00, (float) $this->supplierA->fresh()->debt_amount);

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, [
            'initial_payment' => 250, 'payment_method' => 'vodafone_cash',
        ]))->assertOk();
        $order->refresh();
        $this->assertCount(1, $order->payments);
        $this->assertEquals(250.00, (float) $order->total_paid);
        $this->assertEquals([[250.0, 'vodafone_cash']], $this->outflows());
        $this->assertEquals(750.00, (float) $this->supplierA->fresh()->debt_amount);
    }

    #[Test]
    public function advance_above_cost_is_refused_and_nothing_changes()
    {
        $order = $this->createOrder();
        $before = $this->treasurySnapshot();

        $this->putJson("/api/external-service-orders/{$order->id}", $this->payload($order, ['initial_payment' => 1500]))
            ->assertStatus(422);

        $this->assertEquals($before, $this->treasurySnapshot());
        $this->assertEquals(300.00, (float) $order->fresh()->total_paid);
    }
}
