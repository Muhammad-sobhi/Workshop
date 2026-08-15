<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TreasuryController extends Controller
{
    /**
     * Get 100% truthful balances across all payment methods.
     */
    public function summary(Request $request): JsonResponse
    {
        $upToDate = $request->query('date') ?: null;
        $balances = TreasuryService::getBalances($upToDate);

        return response()->json($balances);
    }

    /**
     * Get paginated unified transaction list for Treasury ledger.
     */
    public function transactions(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 25);
        $query = TreasuryTransaction::with('user')->orderBy('transaction_date', 'desc')->orderBy('id', 'desc');

        if ($request->filled('start_date')) {
            $query->whereDate('transaction_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('transaction_date', '<=', $request->query('end_date'));
        }

        if ($request->filled('type') && in_array($request->query('type'), ['inflow', 'outflow'])) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->query('payment_method'));
        }

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('transaction_number', 'LIKE', "%{$s}%")
                  ->orWhere('description', 'LIKE', "%{$s}%")
                  ->orWhere('category', 'LIKE', "%{$s}%")
                  ->orWhere('reference_number', 'LIKE', "%{$s}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json($paginator);
    }

    /**
     * Record a manual cash deposit (e.g. capital injection, opening balance).
     */
    public function deposit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'category' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $path = $request->file('receipt')->store('receipts', 'public');
            $receiptPath = '/storage/' . $path;
        }

        $trx = TreasuryService::recordInflow(
            amount: (float) $validated['amount'],
            paymentMethod: $validated['payment_method'],
            category: $validated['category'],
            description: $validated['description'] ?? 'إيداع يدوي في الخزينة',
            sourceType: 'manual_deposit',
            referenceNumber: $validated['reference_number'] ?? null,
            transactionDate: $validated['transaction_date'],
            receiptPath: $receiptPath
        );

        return response()->json([
            'message' => 'تم تسجيل الإيداع في الخزينة بنجاح',
            'transaction' => $trx,
        ], 201);
    }

    /**
     * Record a manual cash withdrawal / payout.
     */
    public function withdraw(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'category' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $path = $request->file('receipt')->store('receipts', 'public');
            $receiptPath = '/storage/' . $path;
        }

        $trx = TreasuryService::recordOutflow(
            amount: (float) $validated['amount'],
            paymentMethod: $validated['payment_method'],
            category: $validated['category'],
            description: $validated['description'] ?? 'سحب يدوي من الخزينة',
            sourceType: 'manual_withdrawal',
            referenceNumber: $validated['reference_number'] ?? null,
            transactionDate: $validated['transaction_date'],
            receiptPath: $receiptPath
        );

        return response()->json([
            'message' => 'تم تسجيل السحب من الخزينة بنجاح',
            'transaction' => $trx,
        ], 201);
    }

    /**
     * Transfer cash between payment methods (e.g. Instapay -> Cash).
     */
    public function transfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'to_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer|different:from_method',
            'amount' => 'required|numeric|min:0.01',
            'transaction_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $amount = (float) $validated['amount'];
            $fromName = $this->methodName($validated['from_method']);
            $toName = $this->methodName($validated['to_method']);
            $ref = 'TRF-' . time();

            // 1. Outflow from source method
            TreasuryService::recordOutflow(
                amount: $amount,
                paymentMethod: $validated['from_method'],
                category: 'تحويل بين الخزائن والمحافظ',
                description: "تحويل مالي صادر من ({$fromName}) إلى ({$toName})" . ($validated['notes'] ? " - {$validated['notes']}" : ''),
                sourceType: 'treasury_transfer',
                referenceNumber: $ref,
                transactionDate: $validated['transaction_date']
            );

            // 2. Inflow into target method
            TreasuryService::recordInflow(
                amount: $amount,
                paymentMethod: $validated['to_method'],
                category: 'تحويل بين الخزائن والمحافظ',
                description: "تحويل مالي وارد من ({$fromName}) إلى ({$toName})" . ($validated['notes'] ? " - {$validated['notes']}" : ''),
                sourceType: 'treasury_transfer',
                referenceNumber: $ref,
                transactionDate: $validated['transaction_date']
            );

            return response()->json([
                'message' => "تم تحويل مبلغ {$amount} EGP بنجاح من ({$fromName}) إلى ({$toName})",
            ]);
        });
    }

    private function methodName(string $method): string
    {
        return match ($method) {
            'cash' => 'الخزينة النقدية (كاش)',
            'instapay' => 'إنستاباي (InstaPay)',
            'vodafone_cash' => 'فودافون كاش ومحافظ إلكترونية',
            'bank_transfer' => 'حساب بنكي',
            'postal_transfer' => 'بريد مصري / حوالة',
            default => $method
        };
    }
}
