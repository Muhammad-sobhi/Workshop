<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeLedgerEntry;
use App\Models\EmployeeProductionLog;
use App\Models\EmployeeSalary;
use App\Services\EmployeeLedgerService;
use App\Services\TreasuryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TimesheetController extends Controller
{
    public function show(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        
        $weekStart = Carbon::parse($request->week_start ?? now())->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5); // Saturday to Thursday

        $attendances = EmployeeAttendance::with('advanceSalary')
            ->where('employee_id', $employeeId)
            ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->get()->keyBy(function($item) { return $item->work_date->toDateString(); });

        $productionLogs = EmployeeProductionLog::with(['product', 'operation'])
            ->where('employee_id', $employeeId)
            ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->get()->groupBy(function($item) { return $item->work_date->toDateString(); });

        $days = [];
        $totalDailyWages = 0;
        $totalPieceWages = 0;
        $grossTotal = 0;
        $totalAdvances = 0;
        $totalPenalties = 0;
        
        // Loop 6 days (Sat to Thu)
        for ($i = 0; $i < 6; $i++) {
            $date = $weekStart->copy()->addDays($i);
            $dateString = $date->toDateString();
            
            $att = $attendances->get($dateString);
            $pLogs = $productionLogs->get($dateString, collect());
            
            $dailyWage = $att ? (float) $att->daily_wage : 0;
            $advance = $att ? (float) ($att->advance_amount ?? 0) : 0;
            if ($att && $att->advanceSalary) {
                $advance = max($advance, (float) $att->advanceSalary->net_salary);
            }
            $penalty = $att ? (float) ($att->penalty_amount ?? 0) : 0;
            
            $firstPLog = $pLogs->first();
            $productId = $firstPLog ? $firstPLog->product_id : ($att->product_id ?? null);
            $quantity = $pLogs->isNotEmpty() ? $pLogs->sum('quantity') : ($att->quantity ?? null);
            $pieceRate = $firstPLog ? (float) $firstPLog->piece_rate : ($att->piece_rate ?? null);
            $pieceGross = $pLogs->isNotEmpty() ? (float) $pLogs->sum('gross_wage') : 0;

            $totalDailyWages += $dailyWage;
            $totalPieceWages += $pieceGross;
            $grossTotal += ($dailyWage + $pieceGross);
            $totalAdvances += $advance;
            $totalPenalties += $penalty;

            $days[] = [
                'date' => $dateString,
                'weekday_ar' => $this->getArabicWeekday($date->dayOfWeek),
                'work_mode' => $att ? $att->work_mode : 'full_day',
                'task_description' => $att ? $att->task_description : '',
                'daily_wage' => $att ? $dailyWage : 0,
                'product_id' => $productId,
                'quantity' => $quantity,
                'piece_rate' => $pieceRate,
                'advance_amount' => $advance,
                'penalty_amount' => $penalty,
                'day_net' => ($dailyWage + $pieceGross) - $advance - $penalty
            ];
        }

        $netThursdaySalary = $grossTotal - $totalAdvances - $totalPenalties;

        $settled = EmployeeSalary::where('employee_id', $employeeId)
            ->where('type', 'salary')
            ->where('start_date', '<=', $weekStart->toDateString())
            ->where('end_date', '>=', $weekEnd->toDateString())
            ->exists();

        $result = [
            'employee' => $employee->only(['id', 'name', 'salary_cycle', 'rate']),
            'week_start' => $weekStart->toDateString(),
            'week_end' => $weekEnd->toDateString(),
            'days' => $days,
            'settlement_summary' => [
                'total_daily_wages' => $totalDailyWages,
                'total_piece_wages' => $totalPieceWages,
                'gross_total' => $grossTotal,
                'total_advances' => $totalAdvances,
                'total_penalties' => $totalPenalties,
                'net_thursday_salary' => $netThursdaySalary
            ],
            'settled' => $settled
        ];

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function save(Request $request, $employeeId): JsonResponse
    {
        $validated = $request->validate([
            'week_start' => 'required|date',
            'days' => 'required|array|min:1|max:7',
            'days.*.date' => 'required|date',
            'days.*.work_mode' => 'required|in:full_day,half_day,piece_rate,hybrid,leave,absent',
            'days.*.daily_wage' => 'required|numeric|min:0',
            'days.*.advance_amount' => 'nullable|numeric|min:0',
            'days.*.penalty_amount' => 'nullable|numeric|min:0',
            'days.*.product_id' => 'nullable|exists:products,id',
            'days.*.quantity' => 'nullable|numeric|min:0',
            'days.*.piece_rate' => 'nullable|numeric|min:0',
            'days.*.task_description' => 'nullable|string',
        ]);

        $employee = Employee::findOrFail($employeeId);
        
        $weekStart = Carbon::parse($validated['week_start'])->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5);
        $days = $validated['days'] ?? [];

        DB::transaction(function() use ($employeeId, $employee, $weekStart, $weekEnd, $days) {
            $existingProduction = EmployeeProductionLog::where('employee_id', $employeeId)
                ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
                ->lockForUpdate()->get()->groupBy(function($r) { return $r->work_date->toDateString(); });

            foreach ($days as $d) {
                $dateString = $d['date'];
                $dailyWage = (float) ($d['daily_wage'] ?? 0);
                $advance = (float) ($d['advance_amount'] ?? 0);
                $penalty = (float) ($d['penalty_amount'] ?? 0);
                $workMode = $d['work_mode'] ?? 'full_day';
                $taskDesc = $d['task_description'] ?? null;
                $productId = !empty($d['product_id']) ? $d['product_id'] : null;
                $quantity = !empty($d['quantity']) ? (float) $d['quantity'] : null;
                $pieceRate = !empty($d['piece_rate']) ? (float) $d['piece_rate'] : null;
                
                // 1. Save Attendance
                $att = EmployeeAttendance::updateOrCreate(
                    ['employee_id' => $employeeId, 'work_date' => $dateString],
                    [
                        'work_mode' => $workMode,
                        'task_description' => $taskDesc,
                        'daily_wage' => $dailyWage,
                        'advance_amount' => $advance,
                        'penalty_amount' => $penalty,
                        'product_id' => $productId,
                        'quantity' => $quantity,
                        'piece_rate' => $pieceRate,
                    ]
                );

                EmployeeLedgerService::revertBySource(EmployeeAttendance::class, $att->id);
                
                if ($att->daily_wage > 0) {
                    EmployeeLedgerService::credit(
                        $employeeId, 
                        $att->daily_wage, 
                        $dateString, 
                        "أجر يومية: " . ($att->task_description ?: $dateString), 
                        EmployeeAttendance::class, 
                        $att->id
                    );
                }

                if ($advance > 0) {
                    EmployeeLedgerService::debit(
                        $employeeId, 
                        $advance, 
                        $dateString, 
                        "سلفة يومية: " . $dateString, 
                        EmployeeAttendance::class, 
                        $att->id
                    );
                }

                if ($penalty > 0) {
                    EmployeeLedgerService::debit(
                        $employeeId, 
                        $penalty, 
                        $dateString, 
                        "خصم/جزاء: " . $dateString, 
                        EmployeeAttendance::class, 
                        $att->id
                    );
                }

                // 2. Save Production Logs
                if ($productId && $quantity > 0) {
                    $rate = $pieceRate ?? $employee->rate;
                    $gross = round($quantity * $rate, 2);
                    
                    $pLog = EmployeeProductionLog::updateOrCreate(
                        ['employee_id' => $employeeId, 'work_date' => $dateString, 'product_id' => $productId],
                        [
                            'quantity' => $quantity, 
                            'piece_rate' => $rate, 
                            'gross_wage' => $gross, 
                            'net_wage' => $gross,
                            'deductions' => 0
                        ]
                    );
                    
                    EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $pLog->id);
                    EmployeeLedgerService::credit(
                        $employeeId, 
                        $pLog->net_wage, 
                        $dateString, 
                        "أجر إنتاج بالقطعة: {$quantity} قطعة", 
                        EmployeeProductionLog::class, 
                        $pLog->id
                    );
                } else {
                    // Clear old production for this date if now removed
                    if ($existingPLogs = $existingProduction->get($dateString)) {
                        foreach ($existingPLogs as $oldP) {
                            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $oldP->id);
                            $oldP->delete();
                        }
                    }
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ يوميات الأسبوع بنجاح.'
        ]);
    }

    public function destroy(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        $weekStart = Carbon::parse($request->week_start)->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5);

        DB::transaction(function() use ($employeeId, $weekStart, $weekEnd) {
            $salaryExists = EmployeeSalary::where('employee_id', $employeeId)
                ->where('type', 'salary')
                ->where('start_date', '<=', $weekStart->toDateString())
                ->where('end_date', '>=', $weekEnd->toDateString())
                ->exists();

            if ($salaryExists) {
                abort(409, 'لا يمكن حذف أسبوع تم صرف راتبه بالفعل.');
            }

            $attendances = EmployeeAttendance::where('employee_id', $employeeId)
                ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
                ->get();

            foreach ($attendances as $att) {
                if ($att->advance_salary_id) {
                    TreasuryService::revertBySource(EmployeeSalary::class, $att->advance_salary_id);
                    EmployeeLedgerService::revertBySource(EmployeeSalary::class, $att->advance_salary_id);
                    EmployeeSalary::whereKey($att->advance_salary_id)->delete();
                }

                EmployeeLedgerService::revertBySource(EmployeeAttendance::class, $att->id);
                $att->delete();
            }

            $productionLogs = EmployeeProductionLog::where('employee_id', $employeeId)
                ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
                ->get();

            foreach ($productionLogs as $pLog) {
                EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $pLog->id);
                $pLog->delete();
            }
        });

        return response()->json(['message' => 'تم حذف بيانات الأسبوع بنجاح.']);
    }

    public function bulkPreview(Request $request): JsonResponse
    {
        $weekStart = Carbon::parse($request->week_start ?? now())->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5);
        $weekStartStr = $weekStart->toDateString();
        $weekEndStr = $weekEnd->toDateString();

        $employees = Employee::where('status', 'active')->orderBy('name')->get();

        $attendances = EmployeeAttendance::with('advanceSalary')
            ->whereBetween('work_date', [$weekStartStr, $weekEndStr])
            ->get()
            ->groupBy('employee_id');

        $productionLogs = EmployeeProductionLog::whereBetween('work_date', [$weekStartStr, $weekEndStr])
            ->get()
            ->groupBy('employee_id');

        $settledSalaries = EmployeeSalary::where('type', 'salary')
            ->where('start_date', '<=', $weekStartStr)
            ->where('end_date', '>=', $weekEndStr)
            ->pluck('employee_id')
            ->flip();

        $totalBalances = EmployeeLedgerEntry::query()
            ->selectRaw("employee_id, SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END) as bal")
            ->groupBy('employee_id')
            ->pluck('bal', 'employee_id');

        $previewList = [];

        foreach ($employees as $emp) {
            $empId = $emp->id;
            $empAtts = $attendances->get($empId, collect());
            $empPLogs = $productionLogs->get($empId, collect());

            $dailyWages = (float) $empAtts->sum('daily_wage');
            $pieceWages = (float) $empPLogs->sum('gross_wage');
            $advances = 0.0;
            foreach ($empAtts as $att) {
                $adv = (float) ($att->advance_amount ?? 0);
                if ($att->advanceSalary) {
                    $adv = max($adv, (float) $att->advanceSalary->net_salary);
                }
                $advances += $adv;
            }
            $penalties = (float) $empAtts->sum('penalty_amount');

            $weekGross = $dailyWages + $pieceWages;
            $weekNet = max(0, round($weekGross - $advances - $penalties, 2));

            $currentTotalBalance = (float) $totalBalances->get($empId, 0);
            $priorBalance = max(0, round($currentTotalBalance - $weekNet, 2));

            $alreadySettled = isset($settledSalaries[$empId]);
            $hasActivity = $empAtts->isNotEmpty() || $empPLogs->isNotEmpty();

            $previewList[] = [
                'employee_id' => $empId,
                'employee_name' => $emp->name,
                'salary_cycle' => $emp->salary_cycle,
                'rate' => (float) $emp->rate,
                'daily_wages' => $dailyWages,
                'piece_wages' => $pieceWages,
                'week_gross' => $weekGross,
                'week_advances' => $advances,
                'week_penalties' => $penalties,
                'week_net' => $weekNet,
                'prior_balance' => $priorBalance,
                'total_balance' => $currentTotalBalance,
                'already_settled' => $alreadySettled,
                'has_activity' => $hasActivity,
                'default_payout_mode' => 'week_only',
                'suggested_amount' => $weekNet,
            ];
        }

        return response()->json([
            'success' => true,
            'week_start' => $weekStartStr,
            'week_end' => $weekEndStr,
            'employees' => $previewList
        ]);
    }

    public function bulkPayout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'week_start' => 'required|date',
            'week_end' => 'required|date',
            'payment_date' => 'required|date',
            'payment_method' => 'required|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'payouts' => 'required|array|min:1',
            'payouts.*.employee_id' => 'required|exists:employees,id',
            'payouts.*.payout_mode' => 'required|in:week_only,week_plus_old,exclude',
            'payouts.*.amount' => 'required|numeric|min:0',
            'payouts.*.notes' => 'nullable|string',
        ]);

        $weekStart = $validated['week_start'];
        $weekEnd = $validated['week_end'];
        $paymentDate = $validated['payment_date'];
        $paymentMethod = $validated['payment_method'];
        $payouts = $validated['payouts'];

        $result = DB::transaction(function() use ($weekStart, $weekEnd, $paymentDate, $paymentMethod, $payouts) {
            $processedCount = 0;
            $totalPaid = 0.0;
            $createdSalaries = [];

            foreach ($payouts as $item) {
                $mode = $item['payout_mode'];
                $amount = (float) $item['amount'];
                $employeeId = $item['employee_id'];

                if ($mode === 'exclude' || $amount <= 0) {
                    continue;
                }

                $employee = Employee::findOrFail($employeeId);

                // Prevent double-paying the same week server-side (lockForUpdate prevents race condition)
                $alreadyPaid = EmployeeSalary::where('employee_id', $employeeId)
                    ->where('type', 'salary')
                    ->where('start_date', '<=', $weekStart)
                    ->where('end_date', '>=', $weekEnd)
                    ->lockForUpdate()
                    ->exists();

                if ($alreadyPaid) {
                    continue;
                }

                $modeDesc = $mode === 'week_plus_old' ? ' (شامل رصيد مستحق سابق)' : '';
                $notes = !empty($item['notes']) 
                    ? $item['notes'] 
                    : "صرف راتب أسبوع: من {$weekStart} إلى {$weekEnd}{$modeDesc}";

                $salary = EmployeeSalary::create([
                    'employee_id' => $employee->id,
                    'type' => 'salary',
                    'payment_date' => $paymentDate,
                    'start_date' => $weekStart,
                    'end_date' => $weekEnd,
                    'base_salary' => $amount,
                    'deductions' => 0,
                    'net_salary' => $amount,
                    'payment_method' => $paymentMethod,
                    'notes' => $notes,
                    'created_by' => auth()->id(),
                ]);

                $treasuryDesc = "راتب أسبوع - {$employee->name} ({$weekStart} -> {$weekEnd}){$modeDesc}";
                TreasuryService::recordOutflow(
                    amount: $amount,
                    paymentMethod: $paymentMethod,
                    category: 'رواتب وأجور الموظفين',
                    description: $treasuryDesc,
                    sourceType: EmployeeSalary::class,
                    sourceId: $salary->id,
                    transactionDate: $paymentDate
                );

                EmployeeLedgerService::debit(
                    employeeId: $employee->id,
                    amount: $amount,
                    date: $paymentDate,
                    description: $notes,
                    sourceType: EmployeeSalary::class,
                    sourceId: $salary->id
                );

                $processedCount++;
                $totalPaid += $amount;
                $createdSalaries[] = [
                    'employee_id' => $employee->id,
                    'employee_name' => $employee->name,
                    'amount' => $amount,
                    'mode' => $mode
                ];
            }

            return [
                'count' => $processedCount,
                'total_paid' => round($totalPaid, 2),
                'salaries' => $createdSalaries
            ];
        });

        return response()->json([
            'success' => true,
            'message' => "تم صرف رواتب {$result['count']} موظف بإجمالي " . number_format($result['total_paid'], 2) . " ج.م بنجاح.",
            'data' => $result
        ]);
    }

    private function getArabicWeekday($dayOfWeek)
    {
        $days = [
            Carbon::SATURDAY => 'السبت',
            Carbon::SUNDAY => 'الأحد',
            Carbon::MONDAY => 'الإثنين',
            Carbon::TUESDAY => 'الثلاثاء',
            Carbon::WEDNESDAY => 'الأربعاء',
            Carbon::THURSDAY => 'الخميس',
            Carbon::FRIDAY => 'الجمعة',
        ];

        return $days[$dayOfWeek] ?? '';
    }
}
