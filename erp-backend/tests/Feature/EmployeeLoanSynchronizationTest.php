<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeSalary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeLoanSynchronizationTest extends TestCase
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
            'name' => 'محمد أحمد',
            'salary_cycle' => 'month',
            'rate' => 200,
            'status' => 'active',
        ]);
    }

    public function test_loan_from_daily_work_creates_salary_record_treasury_outflow_and_ledger_debit()
    {
        $payload = [
            'week_start' => '2026-08-22',
            'days' => [
                [
                    'date' => '2026-08-22',
                    'work_mode' => 'full_day',
                    'daily_wage' => 200,
                    'advance_amount' => 50,
                    'penalty_amount' => 0,
                ],
                [
                    'date' => '2026-08-23',
                    'work_mode' => 'full_day',
                    'daily_wage' => 200,
                    'advance_amount' => 0,
                    'penalty_amount' => 0,
                ],
            ],
        ];

        $res = $this->postJson("/api/employees/{$this->employee->id}/timesheet", $payload);
        $res->assertStatus(200);

        // 1. EmployeeSalary record created for advance
        $this->assertDatabaseHas('employee_salaries', [
            'employee_id' => $this->employee->id,
            'type' => 'advance',
            'net_salary' => 50.00,
            'payment_date' => '2026-08-22 00:00:00',
        ]);

        // 2. Treasury outflow recorded
        $this->assertDatabaseHas('treasury_transactions', [
            'amount' => 50.00,
            'type' => 'outflow',
            'category' => 'سلفة موظف',
        ]);

        // 3. EmployeeAttendance linked to advance salary
        $att = EmployeeAttendance::where('employee_id', $this->employee->id)
            ->whereDate('work_date', '2026-08-22')
            ->first();
        $this->assertNotNull($att);
        $this->assertNotNull($att->advance_salary_id);

        // 4. Salaries list endpoint sees this advance
        $salariesRes = $this->getJson('/api/employees-salaries');
        $salariesRes->assertStatus(200);
        $this->assertEquals(1, $salariesRes->json('total'));
        $this->assertEquals('advance', $salariesRes->json('data.0.type'));
    }

    public function test_loan_from_salaries_tab_reflects_in_daily_work_and_affects_treasury()
    {
        // 1. Record advance from Salaries tab
        $res = $this->postJson("/api/employees/{$this->employee->id}/salaries", [
            'type' => 'advance',
            'amount' => 120,
            'payment_date' => '2026-08-24',
            'payment_method' => 'cash',
        ]);
        $res->assertStatus(201);

        // 2. Treasury outflow created
        $this->assertDatabaseHas('treasury_transactions', [
            'amount' => 120.00,
            'type' => 'outflow',
            'category' => 'سلفة موظف',
        ]);

        // 3. Daily Work tab timesheet endpoint shows this advance
        $timesheetRes = $this->getJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $timesheetRes->assertStatus(200);

        // Check Monday (2026-08-24) advance_amount
        $days = $timesheetRes->json('data.days');
        $monday = collect($days)->firstWhere('date', '2026-08-24');
        $this->assertNotNull($monday);
        $this->assertEquals(120, $monday['advance_amount']);

        // Check week settlement total_advances
        $this->assertEquals(120, $timesheetRes->json('data.settlement_summary.total_advances'));
    }

    public function test_deleting_loan_from_salaries_tab_reverts_treasury_and_clears_timesheet()
    {
        // Create advance from salaries tab
        $res = $this->postJson("/api/employees/{$this->employee->id}/salaries", [
            'type' => 'advance',
            'amount' => 100,
            'payment_date' => '2026-08-22',
            'payment_method' => 'cash',
        ]);
        $salaryId = $res->json('salary.id');

        $this->assertEquals(1, \App\Models\TreasuryTransaction::count());

        // Delete the salary
        $delRes = $this->deleteJson("/api/employees/{$this->employee->id}/salaries/{$salaryId}");
        $delRes->assertStatus(200);

        // Treasury transaction reverted/deleted (soft deleted)
        $this->assertEquals(0, \App\Models\TreasuryTransaction::count());

        // Timesheet reflects 0 advances
        $timesheetRes = $this->getJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $this->assertEquals(0, $timesheetRes->json('data.settlement_summary.total_advances'));
    }

    public function test_resaving_timesheet_with_changed_advance_reverts_old_and_creates_new()
    {
        $timesheetDay = [
            'date'           => '2026-08-22',
            'work_mode'      => 'full_day',
            'daily_wage'     => 200,
            'advance_amount' => 50,
            'penalty_amount' => 0,
        ];

        // First save: advance = 50
        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days'       => [$timesheetDay],
        ])->assertStatus(200);

        $this->assertEquals(1, \App\Models\TreasuryTransaction::count());
        $this->assertEquals(50, \App\Models\TreasuryTransaction::first()->amount);

        // Re-save same day with advance = 80
        $timesheetDay['advance_amount'] = 80;
        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days'       => [$timesheetDay],
        ])->assertStatus(200);

        // Exactly one treasury outflow, amount now 80, old 50 gone
        $this->assertEquals(1, \App\Models\TreasuryTransaction::count());
        $this->assertEquals(80.00, (float) \App\Models\TreasuryTransaction::first()->amount);

        // Exactly one EmployeeSalary record
        $this->assertEquals(1, \App\Models\EmployeeSalary::count());
        $this->assertEquals(80.00, (float) \App\Models\EmployeeSalary::first()->net_salary);

        // Timesheet reflects updated amount
        $timesheetRes = $this->getJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $this->assertEquals(80, $timesheetRes->json('data.settlement_summary.total_advances'));
    }

    public function test_resaving_timesheet_with_advance_cleared_to_zero_reverts_everything()
    {
        $timesheetDay = [
            'date'           => '2026-08-22',
            'work_mode'      => 'full_day',
            'daily_wage'     => 200,
            'advance_amount' => 60,
            'penalty_amount' => 0,
        ];

        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days'       => [$timesheetDay],
        ])->assertStatus(200);

        $this->assertEquals(1, \App\Models\TreasuryTransaction::count());

        // Re-save with advance cleared to 0
        $timesheetDay['advance_amount'] = 0;
        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days'       => [$timesheetDay],
        ])->assertStatus(200);

        $this->assertEquals(0, \App\Models\TreasuryTransaction::count());
        $this->assertEquals(0, \App\Models\EmployeeSalary::count());

        $timesheetRes = $this->getJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $this->assertEquals(0, $timesheetRes->json('data.settlement_summary.total_advances'));
    }

    public function test_deleting_timesheet_week_reverts_linked_advance_salaries_and_treasury()
    {
        // Save timesheet with advance
        $this->postJson("/api/employees/{$this->employee->id}/timesheet", [
            'week_start' => '2026-08-22',
            'days' => [
                [
                    'date' => '2026-08-22',
                    'work_mode' => 'full_day',
                    'daily_wage' => 200,
                    'advance_amount' => 75,
                    'penalty_amount' => 0,
                ],
            ],
        ])->assertStatus(200);

        $this->assertEquals(1, \App\Models\EmployeeSalary::count());
        $this->assertEquals(1, \App\Models\TreasuryTransaction::count());

        // Delete week
        $delRes = $this->deleteJson("/api/employees/{$this->employee->id}/timesheet?week_start=2026-08-22");
        $delRes->assertStatus(200);

        $this->assertEquals(0, \App\Models\EmployeeSalary::count());
        $this->assertEquals(0, \App\Models\TreasuryTransaction::count());
    }
}
