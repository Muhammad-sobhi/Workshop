<?php

namespace App\Services;

use App\Models\TreasuryTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class TreasuryService
{
    /**
     * Record a cash inflow (Money coming INTO the workshop).
     */
    public static function recordInflow(
        float $amount,
        string $paymentMethod,
        string $category,
        string $description,
        ?string $sourceType = null,
        ?int $sourceId = null,
        ?string $referenceNumber = null,
        ?string $transactionDate = null,
        ?string $receiptPath = null,
        ?int $userId = null
    ): TreasuryTransaction {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Inflow amount must be greater than zero.');
        }

        return TreasuryTransaction::create([
            'transaction_date' => $transactionDate ?? Carbon::now()->toDateString(),
            'type' => 'inflow',
            'amount' => $amount,
            'payment_method' => $paymentMethod ?: 'cash',
            'category' => $category,
            'description' => $description,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'reference_number' => $referenceNumber,
            'receipt_path' => $receiptPath,
            'created_by' => $userId ?? auth()->id(),
        ]);
    }

    /**
     * Record a cash outflow (Money going OUT of the workshop).
     */
    public static function recordOutflow(
        float $amount,
        string $paymentMethod,
        string $category,
        string $description,
        ?string $sourceType = null,
        ?int $sourceId = null,
        ?string $referenceNumber = null,
        ?string $transactionDate = null,
        ?string $receiptPath = null,
        ?int $userId = null
    ): TreasuryTransaction {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Outflow amount must be greater than zero.');
        }

        return TreasuryTransaction::create([
            'transaction_date' => $transactionDate ?? Carbon::now()->toDateString(),
            'type' => 'outflow',
            'amount' => $amount,
            'payment_method' => $paymentMethod ?: 'cash',
            'category' => $category,
            'description' => $description,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'reference_number' => $referenceNumber,
            'receipt_path' => $receiptPath,
            'created_by' => $userId ?? auth()->id(),
        ]);
    }

    /**
     * Revert / Delete treasury transaction associated with a specific source model.
     */
    public static function revertBySource(string $sourceType, int $sourceId): void
    {
        TreasuryTransaction::where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->delete();
    }

    /** Payment methods the treasury keeps a balance for. */
    public const METHODS = ['cash', 'instapay', 'vodafone_cash', 'bank_transfer', 'postal_transfer'];

    /** source_type of the two legs of a transfer between payment methods. */
    public const TRANSFER_SOURCE = 'treasury_transfer';

    /**
     * Current balance of one payment method (all non-deleted transactions).
     * Locks the method's rows so concurrent withdrawals cannot both pass the check.
     */
    public static function methodBalance(string $paymentMethod): float
    {
        $rows = DB::table('treasury_transactions')
            ->whereNull('deleted_at')
            ->where('payment_method', $paymentMethod)
            ->lockForUpdate()
            ->get(['type', 'amount']);

        $balance = 0.0;
        foreach ($rows as $row) {
            $balance += $row->type === 'inflow' ? (float) $row->amount : -(float) $row->amount;
        }

        return round($balance, 2);
    }

    /**
     * Reject a change that would take any payment method below zero.
     *
     * @param array<string, float> $deltas  net change per payment method (negative = money leaves)
     * @throws ValidationException
     */
    public static function assertSufficientBalance(array $deltas): void
    {
        foreach ($deltas as $method => $delta) {
            if (round($delta, 2) >= 0) {
                continue;
            }
            $balance = static::methodBalance($method);
            if (round($balance + $delta, 2) < 0) {
                throw ValidationException::withMessages([
                    'amount' => sprintf(
                        'الرصيد غير كافٍ في (%s): الرصيد الحالي %s والمطلوب خصمه %s.',
                        static::methodLabel($method),
                        number_format($balance, 2),
                        number_format(-$delta, 2)
                    ),
                ]);
            }
        }
    }

    public static function methodLabel(string $method): string
    {
        return match ($method) {
            'cash' => 'الخزينة النقدية (كاش)',
            'instapay' => 'إنستاباي (InstaPay)',
            'vodafone_cash' => 'فودافون كاش ومحافظ إلكترونية',
            'bank_transfer' => 'حساب بنكي',
            'postal_transfer' => 'بريد مصري / حوالة',
            default => $method,
        };
    }

    /**
     * Balances and flows across all payment methods.
     *
     * - balance: everything up to $upToDate (or all time)
     * - inflow / outflow: only transactions from $fromDate to $upToDate
     * - total_inflow / total_outflow exclude transfers between methods (they net to zero),
     *   per-method inflow / outflow include them since money did enter/leave that method.
     */
    public static function getBalances(?string $upToDate = null, ?string $fromDate = null): array
    {
        $methods = self::METHODS;
        $balances = [];

        if (!Schema::hasTable('treasury_transactions')) {
            foreach ($methods as $m) {
                $balances[$m] = ['inflow' => 0.0, 'outflow' => 0.0, 'balance' => 0.0];
            }
            return [
                'total_inflow' => 0.0,
                'total_outflow' => 0.0,
                'total_balance' => 0.0,
                'methods' => $balances,
            ];
        }

        $query = DB::table('treasury_transactions')->whereNull('deleted_at');
        if ($upToDate) {
            $query->where('transaction_date', '<=', $upToDate);
        }

        $inPeriod   = $fromDate ? 'transaction_date >= ?' : '1 = 1';
        $notTransfer = "COALESCE(source_type, '') <> ?";
        $bindings   = $fromDate ? [$fromDate] : [];

        // One grouped query: all-time total, period total, and period total without transfers
        $sums = $query->select(
                'payment_method',
                'type',
                DB::raw('SUM(amount) as total'),
                DB::raw("SUM(CASE WHEN {$inPeriod} THEN amount ELSE 0 END) as period_total"),
                DB::raw("SUM(CASE WHEN {$inPeriod} AND {$notTransfer} THEN amount ELSE 0 END) as period_external")
            )
            ->addBinding(array_merge($bindings, $bindings, [self::TRANSFER_SOURCE]), 'select')
            ->groupBy('payment_method', 'type')
            ->get()
            ->keyBy(fn ($row) => $row->payment_method . '|' . $row->type);

        $totalBalance = 0.0;
        $totalInflow = 0.0;
        $totalOutflow = 0.0;

        foreach ($methods as $method) {
            $in  = $sums->get($method . '|inflow');
            $out = $sums->get($method . '|outflow');
            $net = (float) ($in->total ?? 0) - (float) ($out->total ?? 0);

            $balances[$method] = [
                'inflow' => round((float) ($in->period_total ?? 0), 2),
                'outflow' => round((float) ($out->period_total ?? 0), 2),
                'balance' => round($net, 2),
            ];

            $totalInflow += (float) ($in->period_external ?? 0);
            $totalOutflow += (float) ($out->period_external ?? 0);
            $totalBalance += $net;
        }

        return [
            'total_inflow' => round($totalInflow, 2),
            'total_outflow' => round($totalOutflow, 2),
            'total_balance' => round($totalBalance, 2),
            'methods' => $balances,
        ];
    }
}
