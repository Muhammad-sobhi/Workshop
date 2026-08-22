<?php
namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeSalaryIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_salary_payments_write_to_treasury_transactions_and_ledger()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $employee = Employee::create([
            'name' => 'Test Employee',
            'salary_cycle' => 'month',
            'rate' => 5000,
            'status' => 'active',
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/employees/{$employee->id}/salaries", [
                'payment_date' => '2026-08-21',
                'base_salary' => 5000,
                'deductions' => 200,
                'deduction_reason' => 'Late deduction',
                'payment_method' => 'cash',
            ]);

        $response->assertStatus(201);

        // Verify record exists in salaries
        $this->assertDatabaseHas('employee_salaries', [
            'employee_id' => $employee->id,
            'net_salary' => 4800.00,
        ]);

        // Verify financial integration
        $this->assertDatabaseCount('treasury_transactions', 1);
        $this->assertDatabaseHas('treasury_transactions', [
            'amount' => 4800.00,
            'type' => 'outflow',
        ]);
        
        $this->assertDatabaseCount('employee_ledger_entries', 1);
        $this->assertDatabaseHas('employee_ledger_entries', [
            'employee_id' => $employee->id,
            'amount' => 4800.00,
            'type' => 'debit',
        ]);
    }
}

