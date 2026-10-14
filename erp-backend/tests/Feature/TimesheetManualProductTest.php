<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\EmployeeLedgerEntry;
use App\Models\EmployeeProductionLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimesheetManualProductTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_product_name_is_saved_and_shown_in_timesheet_and_ledger()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $employee = Employee::create(['name' => 'Ali', 'salary_cycle' => 'day', 'rate' => 350, 'status' => 'active']);

        $this->postJson("/api/employees/{$employee->id}/timesheet", [
            'week_start' => '2026-10-10',
            'days' => [[
                'date' => '2026-10-11',
                'work_mode' => 'hybrid',
                'daily_wage' => 350,
                'manual_product_name' => 'كرسي سفرة',
                'quantity' => 4,
                'piece_rate' => 50,
            ]],
        ])->assertOk();

        $log = EmployeeProductionLog::where('employee_id', $employee->id)->first();
        $this->assertSame('كرسي سفرة', $log->manual_product_name);

        $day = collect($this->getJson("/api/employees/{$employee->id}/timesheet?week_start=2026-10-10")->json('data.days'))
            ->firstWhere('date', '2026-10-11');
        $this->assertSame('كرسي سفرة', $day['manual_product_name']);

        $entry = EmployeeLedgerEntry::where('source_type', EmployeeProductionLog::class)->first();
        $this->assertStringContainsString('كرسي سفرة', $entry->description);

        $row = collect($this->getJson("/api/employees/{$employee->id}/ledger")->json('statement.data'))->first();
        $this->assertSame('2026-10-11', $row['entry_date']);
    }
}
