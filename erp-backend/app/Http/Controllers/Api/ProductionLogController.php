<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeProductionLog;
use App\Models\Operation;
use App\Models\Employee;
use App\Models\Product;
use App\Services\EmployeeLedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProductionLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = EmployeeProductionLog::with(['employee:id,name', 'product:id,name', 'operation:id,operation_number']);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }
        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }
        if ($request->filled('operation_id')) {
            $query->where('operation_id', $request->operation_id);
        }
        if ($request->filled('date_from')) {
            $query->where('work_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('work_date', '<=', $request->date_to);
        }

        $perPage = $request->input('per_page', 20);
        
        // Compute totals for the current filter BEFORE paginating
        $totalsQuery = clone $query;
        
        $paginated = $query->latest('work_date')->latest('id')->paginate($perPage);

        $totals = [
            'total_quantity' => (float) $totalsQuery->sum('quantity'),
            'total_gross' => (float) $totalsQuery->sum('gross_wage'),
            'total_deductions' => (float) $totalsQuery->sum('deductions'),
            'total_net' => (float) $totalsQuery->sum('net_wage'),
        ];

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'totals' => $totals,
            ]
        ]);
    }

    public function store(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        
        // Support rows / items / single object
        $rawRows = $request->input('items', $request->input('rows', []));
        if (empty($rawRows) && $request->has('product_id')) {
            $rawRows = [$request->all()];
        }
        
        $globalDate = $request->input('date', $request->input('work_date', now()->toDateString()));
        $savedLogs = [];

        DB::transaction(function () use ($rawRows, $employee, $globalDate, &$savedLogs) {
            foreach ($rawRows as $rowData) {
                $workDate = $rowData['work_date'] ?? $rowData['date'] ?? $globalDate;
                $productId = $rowData['product_id'] ?? null;
                $quantity = $rowData['quantity'] ?? $rowData['quantity_produced'] ?? 0;
                $pieceRate = $rowData['piece_rate'] ?? null;
                $operationId = $rowData['operation_id'] ?? null;
                $notes = $rowData['notes'] ?? null;

                $validator = Validator::make([
                    'work_date' => $workDate,
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'piece_rate' => $pieceRate,
                ], [
                    'work_date' => 'required|date',
                    'product_id' => 'required|exists:products,id',
                    'quantity' => 'required|numeric|min:0.01',
                    'piece_rate' => 'nullable|numeric|min:0',
                ]);

                $validated = $validator->validate();

                if ($operationId) {
                    $operation = Operation::find($operationId);
                    if ($operation && $operation->status === 'Cancelled') {
                        abort(400, 'لا يمكن إضافة إنتاج لعملية ملغاة.');
                    }
                }

                if (!$pieceRate) {
                    $prod = Product::find($validated['product_id']);
                    $pieceRate = $prod ? ($prod->labor_cost ?? $prod->cost_price ?? $employee->rate ?? 0) : ($employee->rate ?? 0);
                }

                $gross = round($validated['quantity'] * $pieceRate, 2);
                $net = $gross;

                $log = EmployeeProductionLog::create([
                    'employee_id' => $employee->id,
                    'work_date' => $validated['work_date'],
                    'product_id' => $validated['product_id'],
                    'operation_id' => $operationId,
                    'quantity' => $validated['quantity'],
                    'piece_rate' => $pieceRate,
                    'gross_wage' => $gross,
                    'deductions' => 0,
                    'net_wage' => $net,
                    'notes' => $notes,
                ]);

                // Credit ledger
                $productName = $log->product ? $log->product->name : 'منتج';
                $desc = "إنتاج {$log->quantity} قطعة - {$productName}";
                EmployeeLedgerService::credit($employee->id, $log->net_wage, $log->work_date, $desc, EmployeeProductionLog::class, $log->id);

                // Update operation labor cost
                if ($log->operation_id) {
                    Operation::whereKey($log->operation_id)->increment('labor_cost', $log->gross_wage);
                }

                $savedLogs[] = $log->load(['product', 'operation']);
            }
        });

        return response()->json([
            'message' => 'تم حفظ سجلات الإنتاج وترحيلها بنجاح.',
            'data' => $savedLogs,
        ]);
    }

    public function update(Request $request, $logId): JsonResponse
    {
        $log = EmployeeProductionLog::findOrFail($logId);
        
        $validator = Validator::make($request->all(), [
            'work_date' => 'required|date',
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:0.01',
            'piece_rate' => 'nullable|numeric|min:0',
        ]);
        $validated = $validator->validate();

        DB::transaction(function () use ($log, $validated, $request) {
            $oldGross = $log->gross_wage;
            $oldNet = $log->net_wage;
            $oldOpId = $log->operation_id;

            $pieceRate = $validated['piece_rate'] ?? $log->piece_rate;
            $gross = round($validated['quantity'] * $pieceRate, 2);
            $net = $gross;

            $log->update([
                'work_date' => $validated['work_date'],
                'product_id' => $validated['product_id'],
                'operation_id' => $request->operation_id ?? $log->operation_id,
                'quantity' => $validated['quantity'],
                'piece_rate' => $pieceRate,
                'gross_wage' => $gross,
                'net_wage' => $net,
                'notes' => $request->notes ?? $log->notes,
            ]);

            // Revert and re-credit ledger
            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $log->id);
            $productName = $log->product ? $log->product->name : 'منتج';
            $desc = "تعديل إنتاج {$log->quantity} قطعة - {$productName}";
            EmployeeLedgerService::credit($log->employee_id, $log->net_wage, $log->work_date, $desc, EmployeeProductionLog::class, $log->id);

            // Adjust Operation cost
            if ($oldOpId) {
                Operation::whereKey($oldOpId)->decrement('labor_cost', $oldGross);
            }
            if ($log->operation_id) {
                Operation::whereKey($log->operation_id)->increment('labor_cost', $log->gross_wage);
            }
        });

        return response()->json([
            'message' => 'تم تعديل سجل الإنتاج بنجاح.',
            'data' => $log->fresh(['product', 'operation']),
        ]);
    }

    public function destroy($logId): JsonResponse
    {
        $log = EmployeeProductionLog::findOrFail($logId);

        DB::transaction(function () use ($log) {
            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $log->id);

            if ($log->operation_id) {
                Operation::whereKey($log->operation_id)->decrement('labor_cost', $log->gross_wage);
            }

            $log->delete();
        });

        return response()->json(['message' => 'تم حذف سجل الإنتاج بنجاح.']);
    }
}
