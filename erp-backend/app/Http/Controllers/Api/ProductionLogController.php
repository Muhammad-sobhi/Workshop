<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductionLogRequest;
use App\Models\EmployeeProductionLog;
use App\Models\Operation;
use App\Models\Employee;
use App\Services\EmployeeLedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

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
        $paginated = $query->latest('work_date')->latest('id')->paginate($perPage);

        // Compute totals for the current filter
        $totalsQuery = clone $query;
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
        
        // Handle single row or bulk rows
        $rows = $request->has('rows') ? $request->input('rows') : [$request->all()];
        
        $savedLogs = [];

        DB::transaction(function () use ($rows, $employee, &$savedLogs) {
            foreach ($rows as $rowData) {
                // Validate manually or assume pre-validated. 
                // To be safe we create a request object to use rules
                $req = new StoreProductionLogRequest($rowData);
                $validated = $this->validate($req, $req->rules());

                if (isset($validated['operation_id'])) {
                    $operation = Operation::findOrFail($validated['operation_id']);
                    if ($operation->status === 'Cancelled') {
                        abort(400, 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§Ù Ø© Ø¥Ù†ØªØ§Ø¬ Ù„Ø¹Ù…Ù„ÙŠØ© Ù…Ù„ØºØ§Ø©.');
                    }
                }

                $pieceRate = $validated['piece_rate'] ?? $employee->rate;
                $gross = round($validated['quantity'] * $pieceRate, 2);
                $deductions = $validated['deductions'] ?? 0;
                $net = $gross - $deductions;

                $log = EmployeeProductionLog::create([
                    'employee_id' => $employee->id,
                    'work_date' => $validated['work_date'],
                    'product_id' => $validated['product_id'] ?? null,
                    'operation_id' => $validated['operation_id'] ?? null,
                    'labor_service_id' => $validated['labor_service_id'] ?? null,
                    'quantity' => $validated['quantity'],
                    'piece_rate' => $pieceRate,
                    'gross_wage' => $gross,
                    'deductions' => $deductions,
                    'deduction_reason' => $validated['deduction_reason'] ?? null,
                    'net_wage' => $net,
                    'notes' => $validated['notes'] ?? null,
                ]);

                // Credit ledger
                $productName = $log->product ? $log->product->name : 'Ø¹Ù…Ù„ÙŠØ©';
                $desc = "Ø¥Ù†ØªØ§Ø¬ {$log->quantity} Ù‚Ø·Ø¹Ø© - {$productName}";
                EmployeeLedgerService::credit($employee->id, $log->net_wage, $log->work_date, $desc, EmployeeProductionLog::class, $log->id);

                // Update operation labor cost
                if ($log->operation_id) {
                    Operation::whereKey($log->operation_id)->increment('labor_cost', $log->gross_wage);
                }

                $savedLogs[] = $log->load(['product', 'operation']);
            }
        });

        return response()->json([
            'message' => 'ØªÙ… Ø­Ù Ø¸ Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ø¥Ù†ØªØ§Ø¬ Ø¨Ù†Ø¬Ø§Ø­.',
            'data' => $savedLogs,
        ]);
    }

    public function update(Request $request, $logId): JsonResponse
    {
        $log = EmployeeProductionLog::findOrFail($logId);
        $req = new StoreProductionLogRequest($request->all());
        $validated = $this->validate($req, $req->rules());

        if (isset($validated['operation_id']) && $validated['operation_id'] != $log->operation_id) {
            $operation = Operation::findOrFail($validated['operation_id']);
            if ($operation->status === 'Cancelled') {
                abort(400, 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§Ù Ø© Ø¥Ù†ØªØ§Ø¬ Ù„Ø¹Ù…Ù„ÙŠØ© Ù…Ù„ØºØ§Ø©.');
            }
        }

        DB::transaction(function () use ($log, $validated) {
            $oldGross = $log->gross_wage;
            $oldNet = $log->net_wage;
            $oldOpId = $log->operation_id;

            $pieceRate = $validated['piece_rate'] ?? $log->piece_rate;
            $gross = round($validated['quantity'] * $pieceRate, 2);
            $deductions = $validated['deductions'] ?? 0;
            $net = $gross - $deductions;

            $log->update([
                'work_date' => $validated['work_date'],
                'product_id' => $validated['product_id'] ?? null,
                'operation_id' => $validated['operation_id'] ?? null,
                'labor_service_id' => $validated['labor_service_id'] ?? null,
                'quantity' => $validated['quantity'],
                'piece_rate' => $pieceRate,
                'gross_wage' => $gross,
                'deductions' => $deductions,
                'deduction_reason' => $validated['deduction_reason'] ?? null,
                'net_wage' => $net,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Re-credit ledger
            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $log->id);
            $productName = $log->product ? $log->product->name : 'Ø¹Ù…Ù„ÙŠØ©';
            $desc = "Ø¥Ù†ØªØ§Ø¬ {$log->quantity} Ù‚Ø·Ø¹Ø© - {$productName}";
            EmployeeLedgerService::credit($log->employee_id, $log->net_wage, $log->work_date, $desc, EmployeeProductionLog::class, $log->id);

            // Update operation labor cost delta
            if ($oldOpId && $oldOpId == $log->operation_id) {
                $delta = $gross - $oldGross;
                if ($delta != 0) {
                    Operation::whereKey($log->operation_id)->increment('labor_cost', $delta);
                }
            } else {
                if ($oldOpId) {
                    Operation::whereKey($oldOpId)->decrement('labor_cost', $oldGross);
                }
                if ($log->operation_id) {
                    Operation::whereKey($log->operation_id)->increment('labor_cost', $gross);
                }
            }
        });

        return response()->json([
            'message' => 'ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø³Ø¬Ù„ Ø§Ù„Ø¥Ù†ØªØ§Ø¬ Ø¨Ù†Ø¬Ø§Ø­.',
            'data' => $log->fresh(['product', 'operation']),
        ]);
    }

    public function destroy($logId): JsonResponse
    {
        $log = EmployeeProductionLog::findOrFail($logId);

        DB::transaction(function () use ($log) {
            $outstanding = EmployeeLedgerService::outstandingBalance($log->employee_id);
            if ($outstanding - $log->net_wage < 0) {
                abort(409, 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù  Ø³Ø¬Ù„ Ø¥Ù†ØªØ§Ø¬ ØªÙ… ØµØ±Ù  Ù…Ø³ØªØ­Ù‚Ø§ØªÙ‡');
            }

            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $log->id);

            if ($log->operation_id) {
                Operation::whereKey($log->operation_id)->decrement('labor_cost', $log->gross_wage);
            }

            $log->delete();
        });

        return response()->json([
            'message' => 'ØªÙ… Ø­Ø°Ù  Ø³Ø¬Ù„ Ø§Ù„Ø¥Ù†ØªØ§Ø¬ Ø¨Ù†Ø¬Ø§Ø­.'
        ]);
    }
}
