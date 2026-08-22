<?php

namespace App\Services;

use App\Models\EmployeeLedgerEntry;
use Illuminate\Contracts\Pagination\LengthAwarePaginator as LengthAwarePaginatorContract;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

/**
 * Single write gateway for the employee debt ledger (mirrors how all cash
 * goes through TreasuryService).
 *
 * Ledger conventions (debt owed BY the workshop TO the employee):
 *  - credit (+) = labor accrued (timesheet day / production log)
 *  - debit  (−) = cash paid out (advance / weekly net / monthly salary / bonus)
 *  - Outstanding balance = SUM(credit) − SUM(debit), soft-delete aware.
 *
 * Every method here MUST be called inside the caller's DB::transaction,
 * together with the source-document insert and the treasury call — one atomic unit.
 */
class EmployeeLedgerService
{
    /**
     * Credit: labor accrued. Returns the entry.
     */
    public static function credit(
        int $employeeId,
        float $amount,
        string $date,
        string $description,
        ?string $sourceType = null,
        ?int $sourceId = null
    ): EmployeeLedgerEntry {
        return static::addEntry(
            EmployeeLedgerEntry::TYPE_CREDIT,
            $employeeId,
            $amount,
            $date,
            $description,
            $sourceType,
            $sourceId
        );
    }

    /**
     * Debit: cash paid out (advance/salary). Returns the entry.
     */
    public static function debit(
        int $employeeId,
        float $amount,
        string $date,
        string $description,
        ?string $sourceType = null,
        ?int $sourceId = null
    ): EmployeeLedgerEntry {
        return static::addEntry(
            EmployeeLedgerEntry::TYPE_DEBIT,
            $employeeId,
            $amount,
            $date,
            $description,
            $sourceType,
            $sourceId
        );
    }

    /**
     * Soft-delete all entries for a source doc (used when reverting).
     */
    public static function revertBySource(string $sourceType, int $sourceId): void
    {
        EmployeeLedgerEntry::where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->delete();
    }

    /**
     * Outstanding balance the workshop owes the employee:
     * SUM(credit) − SUM(debit), soft-delete aware. Live single lookup.
     *
     * For bulk listings or stats, NEVER loop over this per employee;
     * use a grouped query instead to prevent N+1 queries.
     */
    public static function outstandingBalance(int $employeeId): float
    {
        $balance = EmployeeLedgerEntry::where('employee_id', $employeeId)
            ->selectRaw('COALESCE(SUM(' . static::signedAmountSql() . '), 0) AS balance')
            ->value('balance');

        return round((float) $balance, 2);
    }

    /**
     * Statement rows + running balance for UI, ordered by (entry_date, id).
     * Each returned entry carries a dynamic `running_balance` attribute that starts
     * from the balance accumulated before the `$from` date.
     */
    public static function statement(
        int $employeeId,
        ?string $from = null,
        ?string $to = null,
        int $perPage = 50
    ): LengthAwarePaginatorContract {
        $perPage = max(1, $perPage);

        $entries = EmployeeLedgerEntry::where('employee_id', $employeeId)
            ->when($from, fn ($query) => $query->where('entry_date', '>=', $from))
            ->when($to, fn ($query) => $query->where('entry_date', '<=', $to))
            ->orderBy('entry_date')
            ->orderBy('id')
            ->get();

        // Balance accumulated before the requested window starts.
        $running = 0.0;
        if ($from) {
            $running = (float) EmployeeLedgerEntry::where('employee_id', $employeeId)
                ->where('entry_date', '<', $from)
                ->selectRaw('COALESCE(SUM(' . static::signedAmountSql() . '), 0) AS balance')
                ->value('balance');
        }

        foreach ($entries as $entry) {
            $running = round($running + static::signedAmount((float) $entry->amount, (string) $entry->type), 2);
            $entry->running_balance = $running;
        }

        $page = LengthAwarePaginator::resolveCurrentPage();
        $items = $entries->slice(($page - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator(
            $items,
            $entries->count(),
            $perPage,
            $page,
            ['path' => LengthAwarePaginator::resolveCurrentPath()]
        );
    }

    protected static function addEntry(
        string $type,
        int $employeeId,
        float $amount,
        string $date,
        string $description,
        ?string $sourceType,
        ?int $sourceId
    ): EmployeeLedgerEntry {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Ledger entry amount must be greater than zero.');
        }

        return EmployeeLedgerEntry::create([
            'employee_id' => $employeeId,
            'entry_date' => $date ?: Carbon::now()->toDateString(),
            'type' => $type,
            'amount' => round($amount, 2),
            'description' => $description,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'created_by' => auth()->id(),
        ]);
    }

    protected static function signedAmount(float $amount, string $type): float
    {
        return $type === EmployeeLedgerEntry::TYPE_CREDIT ? $amount : -$amount;
    }

    protected static function signedAmountSql(): string
    {
        return "CASE WHEN type = 'credit' THEN amount ELSE -amount END";
    }
}
