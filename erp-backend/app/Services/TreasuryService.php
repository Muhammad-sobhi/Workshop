<?php

namespace App\Services;

use App\Models\TreasuryTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

    /**
     * Get live, 100% accurate balances across all payment methods.
     */
    public static function getBalances(?string $upToDate = null): array
    {
        $methods = ['cash', 'instapay', 'vodafone_cash', 'bank_transfer', 'postal_transfer'];
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

        $totalBalance = 0.0;
        $totalInflow = 0.0;
        $totalOutflow = 0.0;

        foreach ($methods as $method) {
            $inflow = (float) (clone $query)->where('payment_method', $method)->where('type', 'inflow')->sum('amount');
            $outflow = (float) (clone $query)->where('payment_method', $method)->where('type', 'outflow')->sum('amount');
            $net = $inflow - $outflow;

            $balances[$method] = [
                'inflow' => round($inflow, 2),
                'outflow' => round($outflow, 2),
                'balance' => round($net, 2),
            ];

            $totalInflow += $inflow;
            $totalOutflow += $outflow;
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
