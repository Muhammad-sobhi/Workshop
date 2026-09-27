<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\SalesInvoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientPaymentAllocationTest extends TestCase
{
    use RefreshDatabase;

    protected Client $client;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));

        $this->client = Client::create(['name' => 'شركة الصفوة القابضة']);
        $cat = ProductCategory::create(['name' => 'أثاث']);
        $this->product = Product::create([
            'name' => 'خزانة معدنية',
            'code' => 'PRD-ALLOC-01',
            'category_id' => $cat->id,
            'unit' => 'حبة',
            'unit_cost' => 100,
            'sale_price' => 1100,
            'stock_quantity' => 0,
        ]);
    }

    /** Historical sale 141,500 with 130,000 down payment → 11,500 remaining. */
    private function createHistoricalSale(): SalesInvoice
    {
        $this->postJson('/api/sales/historical', [
            'client_id' => $this->client->id,
            'revenue_date' => '2026-09-05',
            'payment_method' => 'cash',
            'paid_amount' => 130000,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'sale_price' => 141500]],
        ])->assertStatus(201);

        return SalesInvoice::latest('id')->first();
    }

    private function pay(float $amount, array $extra = []): ClientPayment
    {
        $this->postJson("/api/clients/{$this->client->id}/pay-debt", array_merge([
            'amount' => $amount,
            'payment_method' => 'cash',
            'payment_date' => '2026-09-27',
        ], $extra))->assertOk();

        return ClientPayment::latest('id')->first();
    }

    private function statementRow(string $id): ?array
    {
        return collect($this->getJson("/api/clients/{$this->client->id}/transactions")->json())
            ->firstWhere('id', $id);
    }

    public function test_overpayment_settles_invoice_and_keeps_excess_as_client_credit()
    {
        $invoice = $this->createHistoricalSale();
        $this->assertEquals(11500, $this->client->fresh()->debt_amount);

        $payment = $this->pay(70000);

        $invoice->refresh();
        $this->assertEquals(141500, (float) $invoice->paid_amount);
        $this->assertEquals(0, (float) $invoice->remaining_amount);
        $this->assertEquals(-58500, (float) $this->client->fresh()->debt_amount);

        // The down payment shown on the statement must stay 130,000 and the running balance must end at -58,500
        $this->assertEquals(130000, $this->statementRow('inv-dep-' . $invoice->id)['amount']);
        $this->assertEquals(-58500, $this->statementRow('pay-' . $payment->id)['running_debt']);
    }

    public function test_undoing_overpayment_restores_exact_previous_state()
    {
        $invoice = $this->createHistoricalSale();
        $payment = $this->pay(70000);

        $this->deleteJson("/api/clients/{$this->client->id}/payments/pay-{$payment->id}")->assertOk();

        $invoice->refresh();
        $this->assertEquals(130000, (float) $invoice->paid_amount);
        $this->assertEquals(11500, (float) $invoice->remaining_amount);
        $this->assertEquals(11500, (float) $this->client->fresh()->debt_amount);
        $this->assertEquals(130000, $this->statementRow('inv-dep-' . $invoice->id)['amount']);
    }

    public function test_invoice_down_payment_row_cannot_be_undone_as_a_payment()
    {
        $invoice = $this->createHistoricalSale();

        $this->deleteJson("/api/clients/{$this->client->id}/payments/inv-dep-{$invoice->id}")->assertStatus(422);
        $this->assertEquals(130000, (float) $invoice->fresh()->paid_amount);
    }

    public function test_client_credit_is_applied_to_a_later_invoice()
    {
        $this->createHistoricalSale();
        $this->pay(70000); // 58,500 credit

        $this->postJson('/api/sales/historical', [
            'client_id' => $this->client->id,
            'revenue_date' => '2026-09-28',
            'payment_method' => 'cash',
            'paid_amount' => 0,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'sale_price' => 100000]],
        ])->assertStatus(201);

        $second = SalesInvoice::latest('id')->first();
        $this->assertEquals(58500, (float) $second->paid_amount);
        $this->assertEquals(41500, (float) $second->remaining_amount);
        $this->assertEquals(41500, (float) $this->client->fresh()->debt_amount);
    }

    public function test_payment_spanning_two_invoices_is_fully_reverted_on_undo()
    {
        $first = $this->createHistoricalSale(); // 11,500 remaining
        $this->postJson('/api/sales/historical', [
            'client_id' => $this->client->id,
            'revenue_date' => '2026-09-06',
            'payment_method' => 'cash',
            'paid_amount' => 0,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'sale_price' => 20000]],
        ])->assertStatus(201);
        $second = SalesInvoice::latest('id')->first();

        $payment = $this->pay(25000);
        $this->assertEquals(0, (float) $first->fresh()->remaining_amount);
        $this->assertEquals(6500, (float) $second->fresh()->remaining_amount);
        $this->assertEquals(6500, (float) $this->client->fresh()->debt_amount);

        $this->deleteJson("/api/clients/{$this->client->id}/payments/pay-{$payment->id}")->assertOk();
        $this->assertEquals(11500, (float) $first->fresh()->remaining_amount);
        $this->assertEquals(20000, (float) $second->fresh()->remaining_amount);
        $this->assertEquals(31500, (float) $this->client->fresh()->debt_amount);
    }

    public function test_editing_invoice_does_not_double_count_later_payments()
    {
        $invoice = $this->createHistoricalSale();
        $this->pay(5000); // remaining 6,500

        $sale = collect($this->getJson('/api/sales')->json())->firstWhere('id', $invoice->id);
        $this->assertEquals(130000, $sale['initial_paid_amount']);

        $this->putJson("/api/sales/{$invoice->id}", [
            'client_id' => $this->client->id,
            'invoice_date' => '2026-09-05',
            'payment_method' => 'cash',
            'paid_amount' => $sale['initial_paid_amount'],
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_sale_price' => 141500]],
        ])->assertOk();

        $invoice->refresh();
        $this->assertEquals(135000, (float) $invoice->paid_amount);
        $this->assertEquals(6500, (float) $invoice->remaining_amount);
        $this->assertEquals(6500, (float) $this->client->fresh()->debt_amount);
    }
}
