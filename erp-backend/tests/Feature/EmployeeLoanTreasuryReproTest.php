<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\TreasuryTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeLoanTreasuryReproTest extends TestCase
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
            'name' => 'موظف سلف',
            'salary_cycle' => 'month',
            'rate' => 200,
            'status' => 'active',
        ]);
    }

    private function day(string $date, float $advance = 0, float $penalty = 0): array
    {
        return [
            'date'           => $date,
            'work_mode'      => 'full_day',
            'daily_wage'     => 200,
            'advance_amount' => $advance,
            'penalty_amount' => $penalty,
        ];
    }

    public function test_five_timesheet_loans_plus_deduction_produce_five_treasury_outflows_of_550()
    {
        $res = $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days' => [
                $this->day('2026-08-22', advance: 100),
                $this->day('2026-08-23', advance: 50),
                $this->day('2026-08-24', advance: 100, penalty: 50),
                $this->day('2026-08-25', advance: 100),
                $this->day('2026-08-26', advance: 200),
            ],
        ]);
        $res->assertStatus(200);

        // 5 loan salary records totaling 550
        $salaries = \App\Models\EmployeeSalary::where('type', 'advance')->get();
        $this->assertCount(5, $salaries);
        $this->assertEquals(550.0, (float) $salaries->sum('net_salary'));

        // 5 treasury outflow transactions totaling exactly 550
        $txns = TreasuryTransaction::where('type', 'outflow')
            ->where('category', 'سلفة موظف')->get();
        $this->assertCount(5, $txns, 'Expected 5 loan outflow transactions');
        $this->assertEquals(550.0, (float) $txns->sum('amount'));

        // Deduction must NOT touch treasury
        $this->assertEquals(5, TreasuryTransaction::count());

        // What does the treasury API report?
        $listRes = $this->getJson('/api/treasury/transactions?per_page=50');
        $listRes->assertStatus(200);
        dump('LIST total: ' . $listRes->json('total'));
        dump($listRes->json('data'));

        $summaryRes = $this->getJson('/api/treasury/summary');
        dump('SUMMARY: ' . json_encode($summaryRes->json(), JSON_UNESCAPED_UNICODE));
    }

    public function test_mixed_two_salaries_tab_loans_and_three_timesheet_loans_total_550_in_treasury()
    {
        // 2 loans from Pay Salaries tab: 100 + 50
        $this->postJson("/api/employees/{$this->employee->id}/salaries", [
            'type' => 'advance', 'amount' => 100,
            'payment_date' => '2026-08-23', 'payment_method' => 'cash',
        ])->assertStatus(201);
        $this->postJson("/api/employees/{$this->employee->id}/salaries", [
            'type' => 'advance', 'amount' => 50,
            'payment_date' => '2026-08-24', 'payment_method' => 'cash',
        ])->assertStatus(201);

        // 3 loans from Daily Work timesheet: 100 + 100 + 200, plus 50 deduction
        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days' => [
                $this->day('2026-08-22', advance: 100),
                $this->day('2026-08-25', advance: 100),
                $this->day('2026-08-26', advance: 200, penalty: 50),
            ],
        ])->assertStatus(200);

        // Total loans across both tabs = 550 in 5 treasury transactions
        $txns = TreasuryTransaction::where('type', 'outflow')
            ->where('category', 'سلفة موظف')->get();
        $this->assertCount(5, $txns);
        $this->assertEquals(550.0, (float) $txns->sum('amount'));

        // Timesheet settlement shows all 5 loans of the week
        $timesheetRes = $this->getJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $this->assertEquals(550, $timesheetRes->json('data.settlement_summary.total_advances'));
    }
}
