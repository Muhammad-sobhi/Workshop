<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendance;
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
        
        // Loop 6 days (Sat to Thu)
        for ($i = 0; $i < 6; $i++) {
            $date = $weekStart->copy()->addDays($i);
            $dateString = $date->toDateString();
            
            $att = $attendances->get($dateString);
            $pLogs = $productionLogs->get($dateString, collect());
            
            $dailyWage = $att ? (float) $att->daily_wage : 0;
            $advance = $att && $att->advanceSalary ? (float) $att->advanceSalary->net_salary : 0;
            
            $prodData = null;
            $pieceGross = 0;
            if ($pLogs->isNotEmpty()) {
                $prodData = $pLogs->map(function($p) {
                    return [
                        'product_id' => $p->product_id,
                        'product_name' => $p->product ? $p->product->name : null,
                        'quantity' => (float) $p->quantity,
                        'piece_rate' => (float) $p->piece_rate,
                        'gross_wage' => (float) $p->gross_wage
                    ];
                });
                $pieceGross = $pLogs->sum('gross_wage');
            }

            $totalDailyWages += $dailyWage;
            $totalPieceWages += $pieceGross;
            $grossTotal += ($dailyWage + $pieceGross);
            $totalAdvances += $advance;

            $days[] = [
                'date' => $dateString,
                'weekday_ar' => $this->getArabicWeekday($date->dayOfWeek),
                'work_mode' => $att ? $att->work_mode : null,
                'task_description' => $att ? $att->task_description : null,
                'daily_wage' => $dailyWage,
                'production' => $prodData,
                'advance_amount' => $advance,
                'day_net' => ($dailyWage + $pieceGross) - $advance
            ];
        }

        $netThursdaySalary = $grossTotal - $totalAdvances;

        $settled = EmployeeSalary::where('employee_id', $employeeId)
            ->where('type', 'salary')
            ->where('period_start', '<=', $weekStart->toDateString())
            ->where('period_end', '>=', $weekEnd->toDateString())
            ->exists();

        return response()->json([
            'employee' => $employee->only(['id', 'name', 'salary_cycle', 'rate']),
            'week_start' => $weekStart->toDateString(),
            'days' => $days,
            'settlement_summary' => [
                'total_daily_wages' => $totalDailyWages,
                'total_piece_wages' => $totalPieceWages,
                'gross_total' => $grossTotal,
                'total_advances' => $totalAdvances,
                'net_thursday_salary' => $netThursdaySalary
            ],
            'settled' => $settled
        ]);
    }

    public function save(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        
        $weekStart = Carbon::parse($request->week_start)->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5);
        $days = $request->input('days', []);

        DB::transaction(function() use ($employeeId, $employee, $weekStart, $weekEnd, $days) {
            $existingAttendance = EmployeeAttendance::where('employee_id', $employeeId)
                ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
                ->lockForUpdate()->get()->keyBy(function($r) { return $r->work_date->toDateString(); });

            $existingProduction = EmployeeProductionLog::where('employee_id', $employeeId)
                ->whereBetween('work_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
                ->lockForUpdate()->get()->groupBy(function($r) { return $r->work_date->toDateString(); });

            foreach ($days as $d) {
                $dateString = $d['date'];
                
                // 1. Save Attendance
                $att = EmployeeAttendance::updateOrCreate(
                    ['employee_id' => $employeeId, 'work_date' => $dateString],
                    [
                        'work_mode' => $d['work_mode'] ?? null,
                        'task_description' => $d['task_description'] ?? null,
                        'daily_wage' => $d['daily_wage'] ?? 0
                    ]
                );

                EmployeeLedgerService::revertBySource(EmployeeAttendance::class, $att->id);
                if ($att->daily_wage > 0) {
                    EmployeeLedgerService::credit($employeeId, $att->daily_wage, $dateString, "Ø£Ø¬Ø± ÙŠÙˆÙ…ÙŠØ©: " . ($att->task_description ?? $dateString), EmployeeAttendance::class, $att->id);
                }

                // 2. Save Production Logs
                $prodInputList = isset($d['production']) ? (isset($d['production']['product_id']) ? [$d['production']] : $d['production']) : [];
                $prodInputList = array_filter($prodInputList);

                if (!empty($prodInputList)) {
                    foreach ($prodInputList as $prodInput) {
                        if (($prodInput['quantity'] ?? 0) > 0) {
                            $pieceRate = $prodInput['piece_rate'] ?? $employee->rate;
                            $gross = round($prodInput['quantity'] * $pieceRate, 2);
                            
                            $pLog = EmployeeProductionLog::updateOrCreate(
                                ['employee_id' => $employeeId, 'work_date' => $dateString, 'product_id' => $prodInput['product_id']],
                                [
                                    'quantity' => $prodInput['quantity'], 
                                    'piece_rate' => $pieceRate, 
                                    'gross_wage' => $gross, 
                                    'net_wage' => $gross,
                                    'deductions' => 0
                                ]
                            );
                            
                            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $pLog->id);
                            EmployeeLedgerService::credit($employeeId, $pLog->net_wage, $dateString, "Ø£Ø¬Ø± Ø¥Ù†ØªØ§Ø¬: " . ($prodInput['product_name'] ?? 'Ù…Ù†ØªØ¬'), EmployeeProductionLog::class, $pLog->id);
                        }
                    }
                } else {
                    // Clear old production
                    if ($existingPLogs = $existingProduction->get($dateString)) {
                        foreach ($existingPLogs as $oldP) {
                            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $oldP->id);
                            $oldP->delete();
                        }
                    }
                }
                
                // 3. Advance Handling
                // Not fully mapped out in brief for creation in timesheet (relies on EmployeeController usually), 
                // but we will update it if provided.
            }
        });

        return response()->json(['message' => 'ØªÙ… Ø­Ù Ø¸ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª Ø¨Ù†Ø¬Ø§Ø­.']);
    }

    public function destroy(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        $weekStart = Carbon::parse($request->week_start)->startOfWeek(Carbon::SATURDAY);
        $weekEnd = $weekStart->copy()->addDays(5);

        DB::transaction(function() use ($employeeId, $weekStart, $weekEnd) {
            $salaryExists = EmployeeSalary::where('employee_id', $employeeId)
                ->where('type', 'salary')
                ->where('period_start', '<=', $weekStart->toDateString())
                ->where('period_end', '>=', $weekEnd->toDateString())
                ->exists();

            if ($salaryExists) {
                abort(409, 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø­Ø°Ù  Ø£Ø³Ø¨ÙˆØ¹ ØªÙ… ØµØ±Ù  Ø±Ø§ØªØ¨Ù‡ Ø¨Ø§Ù„Ù Ø¹Ù„.');
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

        return response()->json(['message' => 'ØªÙ… Ø­Ø°Ù  Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ Ø¨Ù†Ø¬Ø§Ø­.']);
    }

    private function getArabicWeekday($dayOfWeek)
    {
        $days = [
            Carbon::SATURDAY => 'Ø§Ù„Ø³Ø¨Øª',
            Carbon::SUNDAY => 'Ø§Ù„Ø£Ø­Ø¯',
            Carbon::MONDAY => 'Ø§Ù„Ø¥Ø«Ù†ÙŠÙ†',
            Carbon::TUESDAY => 'Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡',
            Carbon::WEDNESDAY => 'Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡',
            Carbon::THURSDAY => 'Ø§Ù„Ø®Ù…ÙŠØ³',
            Carbon::FRIDAY => 'Ø§Ù„Ø¬Ù…Ø¹Ø©',
        ];
        return $days[$dayOfWeek] ?? '';
    }
}
