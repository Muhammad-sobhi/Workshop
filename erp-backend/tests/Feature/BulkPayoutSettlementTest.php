<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulkPayoutSettlementTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Employee $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($this->user);

        $this->employee = Employee::create([
            'name' => 'موظف الرواتب',
            'salary_cycle' => 'month',
            'rate' => 1500,
            'status' => 'active',
        ]);
    }

    private function payload(string $weekStart, string $weekEnd): array
    {
        return [
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'payment_date' => $weekEnd,
            'payment_method' => 'cash',
            'payouts' => [
                [
                    'employee_id' => $this->employee->id,
                    'payout_mode' => 'week_only',
                    'amount' => 1500,
                ],
            ],
        ];
    }

    public function test_first_bulk_payout_pays_employee_once()
    {
        $res = $this->postJson('/api/timesheets/bulk-payout', $this->payload('2026-08-15 00:00:00', '2026-08-21 00:00:00'));

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $res->assertJsonPath('data.count', 1);
        $this->assertCount(1, $res->json('data.salaries'));

        $this->assertDatabaseCount('employee_salaries', 1);
        $this->assertDatabaseHas('employee_salaries', [
            'employee_id' => $this->employee->id,
            'type' => 'salary',
            'start_date' => '2026-08-15 00:00:00',
            'end_date' => '2026-08-21 00:00:00',
            'net_salary' => 1500.00,
        ]);
        $this->assertDatabaseHas('treasury_transactions', [
            'type' => 'outflow',
            'amount' => 1500.00,
        ]);
    }

    public function test_duplicate_bulk_payout_for_same_week_is_skipped()
    {
        $this->postJson('/api/timesheets/bulk-payout', $this->payload('2026-08-15 00:00:00', '2026-08-21 00:00:00'))
            ->assertStatus(200);

        $res = $this->postJson('/api/timesheets/bulk-payout', $this->payload('2026-08-15 00:00:00', '2026-08-21 00:00:00'));

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $res->assertJsonPath('data.count', 0);
        $this->assertCount(0, $res->json('data.salaries'));

        $this->assertDatabaseCount('employee_salaries', 1);
        $this->assertDatabaseCount('treasury_transactions', 1);
    }

    public function test_payout_for_different_week_settles_independently()
    {
        $this->postJson('/api/timesheets/bulk-payout', $this->payload('2026-08-15 00:00:00', '2026-08-21 00:00:00'))
            ->assertStatus(200);

        $res = $this->postJson('/api/timesheets/bulk-payout', $this->payload('2026-08-22 00:00:00', '2026-08-28 00:00:00'));

        $res->assertStatus(200);
        $res->assertJsonPath('data.count', 1);

        $this->assertDatabaseCount('employee_salaries', 2);
        $this->assertDatabaseHas('employee_salaries', [
            'employee_id' => $this->employee->id,
            'start_date' => '2026-08-22 00:00:00',
            'end_date' => '2026-08-28 00:00:00',
        ]);
    }
}
