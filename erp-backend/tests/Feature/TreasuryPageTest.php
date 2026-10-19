<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TreasuryPageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]));
    }

    private function deposit(float $amount, string $method = 'cash', string $date = '2026-10-05'): void
    {
        $this->postJson('/api/treasury/deposit', [
            'amount' => $amount, 'payment_method' => $method, 'category' => 'رأس مال', 'transaction_date' => $date,
        ])->assertCreated();
    }

    private function transfer(float $amount, string $from, string $to, string $date = '2026-10-10')
    {
        return $this->postJson('/api/treasury/transfer', [
            'amount' => $amount, 'from_method' => $from, 'to_method' => $to, 'transaction_date' => $date,
        ]);
    }

    public function test_summary_flows_follow_the_period_and_balance_runs_to_end_date()
    {
        $this->deposit(1000, 'cash', '2026-09-15');
        $this->deposit(300, 'cash', '2026-10-05');
        $this->postJson('/api/treasury/withdraw', [
            'amount' => 100, 'payment_method' => 'cash', 'category' => 'مسحوبات', 'transaction_date' => '2026-10-06',
        ])->assertCreated();

        $october = $this->getJson('/api/treasury/summary?start_date=2026-10-01&end_date=2026-10-31')->assertOk();
        $october->assertJsonPath('total_inflow', 300)
            ->assertJsonPath('total_outflow', 100)
            ->assertJsonPath('total_balance', 1200)
            ->assertJsonPath('methods.cash.balance', 1200)
            ->assertJsonPath('methods.cash.inflow', 300);

        $september = $this->getJson('/api/treasury/summary?start_date=2026-09-01&end_date=2026-09-30')->assertOk();
        $september->assertJsonPath('total_inflow', 1000)->assertJsonPath('total_balance', 1000);
    }

    public function test_transfers_move_balance_but_are_not_counted_as_inflow_or_outflow()
    {
        $this->deposit(1000, 'instapay');
        $this->transfer(400, 'instapay', 'cash')->assertOk();

        $this->getJson('/api/treasury/summary?start_date=2026-10-01&end_date=2026-10-31')
            ->assertJsonPath('total_inflow', 1000)
            ->assertJsonPath('total_outflow', 0)
            ->assertJsonPath('total_balance', 1000)
            ->assertJsonPath('methods.instapay.balance', 600)
            ->assertJsonPath('methods.cash.balance', 400)
            ->assertJsonPath('methods.instapay.outflow', 400);

        $this->getJson('/api/treasury/transactions?type=inflow')->assertJsonPath('total', 1);
        $this->getJson('/api/treasury/transactions?per_page=1')
            ->assertJsonPath('total', 3)
            ->assertJsonPath('totals.inflow', 1400)
            ->assertJsonPath('totals.outflow', 400)
            ->assertJsonPath('totals.net', 1000);
        $transfers = $this->getJson('/api/treasury/transactions?type=transfer')->assertJsonPath('total', 2);
        $this->assertSame('instapay', $transfers->json('data.0.transfer_from'));
        $this->assertSame('cash', $transfers->json('data.0.transfer_to'));

        // Both legs share one reference, unique to this transfer
        $refs = TreasuryTransaction::where('source_type', 'treasury_transfer')->pluck('reference_number')->unique();
        $this->assertCount(1, $refs);
    }

    public function test_withdraw_and_transfer_cannot_exceed_the_method_balance()
    {
        $this->deposit(500, 'cash');

        $this->postJson('/api/treasury/withdraw', [
            'amount' => 600, 'payment_method' => 'cash', 'category' => 'مسحوبات', 'transaction_date' => '2026-10-06',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->transfer(10, 'instapay', 'cash')->assertStatus(422);
        $this->transfer(500, 'cash', 'instapay')->assertOk();

        $this->assertEquals(0, TreasuryService::methodBalance('cash'));
        $this->assertEquals(500, TreasuryService::methodBalance('instapay'));
    }

    public function test_manual_transactions_can_be_edited_and_deleted_without_going_negative()
    {
        $this->deposit(500, 'cash');
        $deposit = TreasuryTransaction::first();

        $this->putJson("/api/treasury/transactions/{$deposit->id}", [
            'amount' => 800, 'payment_method' => 'cash', 'category' => 'رأس مال', 'transaction_date' => '2026-10-05',
        ])->assertOk();
        $this->assertEquals(800, TreasuryService::methodBalance('cash'));

        $this->transfer(700, 'cash', 'bank_transfer')->assertOk();
        // Deleting the deposit would leave cash at -700
        $this->deleteJson("/api/treasury/transactions/{$deposit->id}")->assertStatus(422);

        // Editing one leg of a transfer updates both
        $out = TreasuryTransaction::where('source_type', 'treasury_transfer')->where('type', 'outflow')->first();
        $this->putJson("/api/treasury/transactions/{$out->id}", [
            'amount' => 300, 'from_method' => 'cash', 'to_method' => 'instapay', 'transaction_date' => '2026-10-11',
        ])->assertOk();
        $this->assertEquals(500, TreasuryService::methodBalance('cash'));
        $this->assertEquals(300, TreasuryService::methodBalance('instapay'));
        $this->assertEquals(0, TreasuryService::methodBalance('bank_transfer'));

        // Deleting a transfer removes both legs
        $this->deleteJson("/api/treasury/transactions/{$out->id}")->assertOk();
        $this->assertSame(0, TreasuryTransaction::where('source_type', 'treasury_transfer')->count());
        $this->assertEquals(800, TreasuryService::methodBalance('cash'));
    }

    public function test_automatic_transactions_cannot_be_edited_from_treasury()
    {
        $trx = TreasuryService::recordOutflow(50, 'cash', 'مصروفات', 'مصروف', Expense::class, 1);

        $this->deleteJson("/api/treasury/transactions/{$trx->id}")->assertStatus(422);
        $this->putJson("/api/treasury/transactions/{$trx->id}", [
            'amount' => 10, 'payment_method' => 'cash', 'category' => 'x', 'transaction_date' => '2026-10-05',
        ])->assertStatus(422);
    }

    public function test_deposit_accepts_a_receipt_file()
    {
        Storage::fake('public');

        $this->post('/api/treasury/deposit', [
            'amount' => 100, 'payment_method' => 'cash', 'category' => 'رأس مال', 'transaction_date' => '2026-10-05',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $path = TreasuryTransaction::first()->receipt_path;
        $this->assertStringStartsWith('/storage/receipts/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/storage/')));
    }

    public function test_transaction_list_loads_details_without_a_query_per_row()
    {
        foreach (range(1, 30) as $i) {
            $this->deposit(10, 'cash', '2026-10-0' . (($i % 9) + 1));
        }

        DB::enableQueryLog();
        $res = $this->getJson('/api/treasury/transactions?per_page=50')->assertOk();
        $queries = count(DB::getQueryLog());

        $res->assertJsonPath('total', 30);
        $this->assertLessThan(15, $queries, "transactions endpoint ran {$queries} queries");
        $this->assertSame(1000, (int) $this->getJson('/api/treasury/transactions?per_page=999999')->json('per_page'));
    }

    public function test_treasury_requires_manage_accounts_permission()
    {
        $this->actingAs(User::create([
            'name' => 'Worker',
            'email' => 'worker@example.com',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'permissions' => ['manage_production'],
        ]));

        $this->getJson('/api/treasury/summary')->assertForbidden();
        $this->getJson('/api/treasury/transactions')->assertForbidden();
    }
}
