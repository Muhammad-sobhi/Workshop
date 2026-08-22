<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeLedgerEntry;
use App\Models\EmployeeProductionLog;
use App\Models\EmployeeSalary;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Operation;
use App\Models\Product;
use App\Services\EmployeeLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class EmployeeLedgerIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migrations_and_ledger_service_end_to_end()
    {
        $employee = Employee::create(['name' => 'Ahmed', 'salary_cycle' => 'day', 'rate' => 150, 'status' => 'active']);

        $attendance = EmployeeAttendance::create([
            'employee_id' => $employee->id,
            'work_date' => '2026-08-22',
            'status' => 'present',
            'daily_wage' => 150,
            'advance_amount' => 100,
        ]);

        $productCategory = \App\Models\ProductCategory::create(['name' => 'furniture']);
        $product = Product::create(['name' => 'Chair', 'unit' => 'pcs', 'unit_cost' => 50, 'sale_price' => 90, 'category_id' => $productCategory->id]);
        $warehouse = \App\Models\Warehouse::create(['name' => 'main', 'code' => 'WH1', 'location' => 'Main']);
        $operation = Operation::create([
            'product_id' => $product->id,
            'quantity' => 10,
            'warehouse_id' => $warehouse->id,
            'status' => 'In_Progress',
        ]);
        $log = EmployeeProductionLog::create([
            'employee_id' => $employee->id,
            'work_date' => '2026-08-22',
            'product_id' => $product->id,
            'operation_id' => $operation->id,
            'quantity' => 10,
            'piece_rate' => 25,
            'gross_wage' => 250,
            'net_wage' => 250,
        ]);

        $credit = EmployeeLedgerService::credit($employee->id, 150, '2026-08-22', 'أجر يوم', EmployeeAttendance::class, $attendance->id);
        $this->assertInstanceOf(EmployeeLedgerEntry::class, $credit);
        $this->assertSame('credit', $credit->type);
        $this->assertSame(150.0, (float) $credit->amount);

        $credit2 = EmployeeLedgerService::credit($employee->id, 250, '2026-08-22', 'إنتاج', EmployeeProductionLog::class, $log->id);
        $debit = EmployeeLedgerService::debit($employee->id, 100, '2026-08-22', 'سلفة', EmployeeSalary::class, 77);

        $this->assertSame('debit', $debit->type);
        $this->assertSame(100.0, (float) $debit->amount);
        $this->assertEqualsWithDelta(300.0, EmployeeLedgerService::outstandingBalance($employee->id), 0.001);

        // revertBySource removes only the matching source entries
        EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $log->id);
        $this->assertEqualsWithDelta(50.0, EmployeeLedgerService::outstandingBalance($employee->id), 0.001);

        // zero/negative amounts rejected
        $this->expectException(InvalidArgumentException::class);
        EmployeeLedgerService::credit($employee->id, 0, '2026-08-22', 'x');
    }

    public function test_zero_amount_debit_is_rejected()
    {
        $employee = Employee::create(['name' => 'X', 'salary_cycle' => 'day', 'rate' => 1, 'status' => 'active']);

        $this->expectException(InvalidArgumentException::class);
        EmployeeLedgerService::debit($employee->id, -5, '2026-08-22', 'x');
    }

    public function test_statement_running_balance_and_windowing()
    {
        $employee = Employee::create(['name' => 'Ahmed', 'salary_cycle' => 'day', 'rate' => 150, 'status' => 'active']);

        EmployeeLedgerService::credit($employee->id, 150, '2026-08-22', 'أجر 1');
        EmployeeLedgerService::credit($employee->id, 250, '2026-08-23', 'إنتاج');
        EmployeeLedgerService::debit($employee->id, 100, '2026-08-24', 'سلفة');

        $stmt = EmployeeLedgerService::statement($employee->id, null, null, 50);
        $this->assertSame(3, $stmt->total());
        $items = array_values($stmt->items());
        $this->assertEqualsWithDelta(150.0, (float) $items[0]->running_balance, 0.001);
        $this->assertEqualsWithDelta(400.0, (float) $items[1]->running_balance, 0.001);
        $this->assertEqualsWithDelta(300.0, (float) $items[2]->running_balance, 0.001);

        // Window starting after all entries → empty page, no crash
        $windowed = EmployeeLedgerService::statement($employee->id, '2026-08-25', null, 50);
        $this->assertSame(0, $windowed->total());

        // Window starting mid-stream opens with prior balance
        $mid = EmployeeLedgerService::statement($employee->id, '2026-08-23', null, 50);
        $this->assertSame(2, $mid->total());
        $midItems = array_values($mid->items());
        $this->assertEqualsWithDelta(400.0, (float) $midItems[0]->running_balance, 0.001);

        // Employee helper delegates to service (§5.4)
        $this->assertEqualsWithDelta(300.0, $employee->outstandingBalance(), 0.001);
    }

    public function test_salary_type_and_week_start_columns_are_fillable()
    {
        $employee = Employee::create(['name' => 'Ahmed', 'salary_cycle' => 'day', 'rate' => 150, 'status' => 'active']);

        $salary = EmployeeSalary::create([
            'employee_id' => $employee->id,
            'type' => 'advance',
            'week_start' => '2026-08-22',
            'payment_date' => '2026-08-25',
            'base_salary' => 0,
            'net_salary' => 100,
            'payment_method' => 'cash',
        ]);

        $this->assertSame('advance', $salary->type);
        $this->assertSame('2026-08-22', $salary->week_start->toDateString());

        // Default type stays backward compatible
        $legacy = EmployeeSalary::create([
            'employee_id' => $employee->id,
            'payment_date' => '2026-08-21',
            'base_salary' => 5000,
            'net_salary' => 5000,
            'payment_method' => 'cash',
        ]);
        $this->assertSame('salary', $legacy->type);
    }

    public function test_operations_labor_cost_column_defaults_to_zero()
    {
        $productCategory = \App\Models\ProductCategory::create(['name' => 'furniture']);
        $product = Product::create(['name' => 'Chair', 'unit' => 'pcs', 'unit_cost' => 50, 'sale_price' => 90, 'category_id' => $productCategory->id]);
        $warehouse = \App\Models\Warehouse::create(['name' => 'main', 'code' => 'WH1', 'location' => 'Main']);
        $operation = Operation::create([
            'product_id' => $product->id,
            'quantity' => 10,
            'warehouse_id' => $warehouse->id,
            'status' => 'Pending',
        ]);

        $this->assertEqualsWithDelta(0.0, (float) $operation->fresh()->labor_cost, 0.001);
    }

    public function test_labor_based_material_with_actual_logs_skips_bom_recalculation()
    {
        $category = MaterialCategory::create(['name' => 'svc']);
        $material = Material::create([
            'name' => 'تنجيد', 'unit' => 'unit', 'type' => 'service', 'unit_cost' => 200,
            'stock_quantity' => 0, 'category_id' => $category->id, 'is_labor_based' => true,
        ]);
        $productCategory = \App\Models\ProductCategory::create(['name' => 'furniture']);
        $product = Product::create(['name' => 'Sofa', 'unit' => 'pcs', 'unit_cost' => 0, 'sale_price' => 500, 'category_id' => $productCategory->id]);
        $product->materials()->attach($material->id, ['quantity' => 1]);
        $product->recalculateCost();
        $this->assertEqualsWithDelta(200.0, (float) $product->unit_cost, 0.001);

        $employee = Employee::create(['name' => 'Worker', 'salary_cycle' => 'production', 'rate' => 25, 'status' => 'active']);
        EmployeeProductionLog::create([
            'employee_id' => $employee->id, 'work_date' => '2026-08-22', 'product_id' => $product->id,
            'labor_service_id' => $material->id, 'quantity' => 4, 'piece_rate' => 30,
            'gross_wage' => 120, 'net_wage' => 120,
        ]);
        $this->assertTrue($material->hasActualLaborLogs());

        // Price change must NOT propagate to products.unit_cost anymore (self-corrects from logs)
        $material->update(['unit_cost' => 999]);
        $this->assertEqualsWithDelta(200.0, (float) $product->fresh()->unit_cost, 0.001);
    }

    public function test_non_labor_based_material_keeps_legacy_recalculation_behavior()
    {
        $category = MaterialCategory::create(['name' => 'raw']);
        $plain = Material::create([
            'name' => 'خشب', 'unit' => 'm', 'type' => 'raw', 'unit_cost' => 10,
            'stock_quantity' => 0, 'category_id' => $category->id,
        ]);
        $productCategory = \App\Models\ProductCategory::create(['name' => 'furniture']);
        $product = Product::create(['name' => 'Table', 'unit' => 'pcs', 'unit_cost' => 0, 'sale_price' => 300, 'category_id' => $productCategory->id]);
        $product->materials()->attach($plain->id, ['quantity' => 1]);
        $product->recalculateCost();
        $this->assertEqualsWithDelta(10.0, (float) $product->unit_cost, 0.001);

        $plain->update(['unit_cost' => 40]);
        $this->assertEqualsWithDelta(40.0, (float) $product->fresh()->unit_cost, 0.001);
    }
}
