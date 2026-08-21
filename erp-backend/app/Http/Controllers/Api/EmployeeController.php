<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeSalary;
use App\Http\Requests\StoreEmployeeRequest;
use App\Http\Requests\StoreSalaryPaymentRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $status = $request->query('status');

        $query = Employee::query()
            ->withSum('salaries as total_paid', 'net_salary')
            ->withSum('salaries as total_deductions', 'deductions')
            ->withMax('salaries as last_payment_date', 'payment_date');

        if ($search) {
            $query->where('name', 'like', '%' . $search . '%');
        }

        if ($status) {
            $query->where('status', $status);
        }

        $employees = $query->orderBy('name')->paginate(20);

        $employees->getCollection()->transform(function ($emp) {
            return [
                'id' => $emp->id,
                'name' => $emp->name,
                'phone' => $emp->phone,
                'salary_cycle' => $emp->salary_cycle,
                'rate' => (float)$emp->rate,
                'status' => $emp->status,
                'notes' => $emp->notes,
                'total_paid' => (float)($emp->total_paid ?? 0),
                'total_deductions' => (float)($emp->total_deductions ?? 0),
                'last_payment_date' => $emp->last_payment_date,
            ];
        });

        return response()->json($employees);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $employee = Employee::create(array_merge(
            $request->validated(),
            ['created_by' => auth()->id()]
        ));

        return response()->json($employee, 201);
    }

    public function show(string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);
        return response()->json($employee);
    }

    public function update(StoreEmployeeRequest $request, string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);
        $employee->update($request->validated());
        return response()->json($employee);
    }

    public function destroy(string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);
        $employee->delete();
        return response()->json(['message' => 'تم حذف الموظف بنجاح']);
    }

    public function salaries(string $id): JsonResponse
    {
        $salaries = EmployeeSalary::with('product')
            ->where('employee_id', $id)
            ->orderBy('payment_date', 'desc')
            ->paginate(20);
        return response()->json($salaries);
    }

    /**
     * STUB - To be fully implemented by security-sensitive writer (Claude Opus)
     */
    public function recordSalary(StoreSalaryPaymentRequest $request, string $id): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        return DB::transaction(function () use ($request, $employee) {
            $validated = $request->validated();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            $baseSalary = (float)$validated['base_salary'];
            $deductions = (float)($validated['deductions'] ?? 0);
            $netSalary = round($baseSalary - $deductions, 2);

            $salary = EmployeeSalary::create([
                'employee_id' => $employee->id,
                'product_id' => $validated['product_id'] ?? null,
                'payment_date' => $validated['payment_date'],
                'start_date' => $validated['start_date'] ?? null,
                'end_date' => $validated['end_date'] ?? null,
                'base_salary' => $baseSalary,
                'production_quantity' => $validated['production_quantity'] ?? null,
                'production_rate' => $validated['production_rate'] ?? null,
                'deductions' => $deductions,
                'deduction_reason' => $validated['deduction_reason'] ?? null,
                'net_salary' => $netSalary,
                'payment_method' => $validated['payment_method'],
                'receipt_path' => $receiptPath,
                'notes' => $validated['notes'] ?? null,
                'created_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'تم تسجيل دفعة الراتب بنجاح',
                'salary' => $salary,
            ], 201);
        });
    }

    public function allSalaries(Request $request): JsonResponse
    {
        $employeeId = $request->query('employee_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $perPage = (int)$request->query('per_page', 50);

        $query = EmployeeSalary::with(['employee', 'product']);

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        if ($dateFrom) {
            $query->whereDate('payment_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('payment_date', '<=', $dateTo);
        }

        $salaries = $query->orderBy('payment_date', 'desc')->paginate($perPage);
        return response()->json($salaries);
    }

    public function deleteSalary(string $id, string $salaryId): JsonResponse
    {
        $salary = EmployeeSalary::where('employee_id', $id)->findOrFail($salaryId);
        $salary->delete();
        return response()->json(['message' => 'تم حذف دفعة الراتب بنجاح']);
    }

    public function stats(): JsonResponse
    {
        $totalEmployees = Employee::count();
        $activeEmployees = Employee::where('status', 'active')->count();
        $totalPaidThisMonth = EmployeeSalary::whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->sum('net_salary');
        $totalDeductionsThisMonth = EmployeeSalary::whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->sum('deductions');

        return response()->json([
            'total_employees' => $totalEmployees,
            'active_employees' => $activeEmployees,
            'total_paid_this_month' => (float)$totalPaidThisMonth,
            'total_deductions_this_month' => (float)$totalDeductionsThisMonth,
        ]);
    }
}
