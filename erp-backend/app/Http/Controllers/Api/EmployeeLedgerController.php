<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeLedgerEntry;
use App\Services\EmployeeLedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmployeeLedgerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $employees = Employee::get();
        
        $balances = EmployeeLedgerEntry::query()
            ->selectRaw("employee_id, SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END) bal")
            ->groupBy('employee_id')
            ->pluck('bal', 'employee_id');

        $employees->transform(function($emp) use ($balances) {
            $emp->outstanding_balance = $balances->get($emp->id, 0);
            return $emp;
        });

        return response()->json([
            'data' => $employees
        ]);
    }

    public function statement(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        
        $perPage = $request->input('per_page', 20);
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        $statement = EmployeeLedgerService::statement($employeeId, $startDate, $endDate, $perPage);

        return response()->json([
            'employee' => [
                'id' => $employee->id,
                'name' => $employee->name,
            ],
            'statement' => $statement
        ]);
    }
}
