<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

        if (!Schema::hasTable('treasury_transactions')) {
            return response()->json([
                'data' => [],
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
                'per_page' => $perPage,
            ]);
        }

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

        $paginator->getCollection()->transform(function ($t) {
            $dStr = $t->transaction_date ? (is_string($t->transaction_date) ? substr($t->transaction_date, 0, 10) : $t->transaction_date->format('Y-m-d')) : '';
            
            $entityName = null;
            $entityPhone = null;
            $itemsSummary = [];
            $orderTotal = null;
            $orderPaid = null;
            $orderRemaining = null;
            $refNumber = $t->reference_number;

            if ($t->source_type === \App\Models\Operation::class || $t->source_type === 'App\Models\Operation') {
                $op = \App\Models\Operation::with(['client', 'operationProducts.product'])->find($t->source_id);
                if ($op) {
                    $entityName = $op->client?->name;
                    $entityPhone = $op->client?->phone;
                    $refNumber = $op->operation_number;
                    $orderTotal = (float) ($op->total_price ?? 0);
                    $orderPaid = (float) ($op->deposit_paid ?? 0) + (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                    $orderRemaining = max(0.0, $orderTotal - $orderPaid);
                    if ($op->operationProducts) {
                        $itemsSummary = $op->operationProducts->map(fn($opP) => [
                            'name' => $opP->product?->name ?? 'منتج',
                            'quantity' => (float) $opP->quantity,
                            'unit' => $opP->product?->unit ?? 'وحدة',
                            'unit_cost' => (float) ($opP->product?->sale_price ?? 0),
                            'total_cost' => (float) (($opP->quantity) * ($opP->product?->sale_price ?? 0)),
                        ])->toArray();
                    }
                }
            } elseif ($t->source_type === \App\Models\ClientPayment::class || $t->source_type === 'App\Models\ClientPayment') {
                $cp = \App\Models\ClientPayment::with(['client', 'operation.operationProducts.product'])->find($t->source_id);
                if ($cp) {
                    $entityName = $cp->client?->name;
                    $entityPhone = $cp->client?->phone;
                    $refNumber = $cp->reference_number ?: $cp->payment_number;
                    if ($cp->operation) {
                        $op = $cp->operation;
                        $orderTotal = (float) ($op->total_price ?? 0);
                        $orderPaid = (float) ($op->deposit_paid ?? 0) + (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                        $orderRemaining = max(0.0, $orderTotal - $orderPaid);
                        if ($op->operationProducts) {
                            $itemsSummary = $op->operationProducts->map(fn($opP) => [
                                'name' => $opP->product?->name ?? 'منتج',
                                'quantity' => (float) $opP->quantity,
                                'unit' => $opP->product?->unit ?? 'وحدة',
                                'unit_cost' => (float) ($opP->product?->sale_price ?? 0),
                                'total_cost' => (float) (($opP->quantity) * ($opP->product?->sale_price ?? 0)),
                            ])->toArray();
                        }
                    }
                }
            } elseif ($t->source_type === \App\Models\SupplierPayment::class || $t->source_type === 'App\Models\SupplierPayment') {
                $sp = \App\Models\SupplierPayment::with(['supplier', 'purchaseOrder.items.material'])->find($t->source_id);
                if ($sp) {
                    $entityName = $sp->supplier?->name;
                    $entityPhone = $sp->supplier?->phone;
                    $refNumber = $sp->purchaseOrder?->order_number ?: $sp->payment_number;
                    if ($sp->purchaseOrder) {
                        $po = $sp->purchaseOrder;
                        $orderTotal = (float) ($po->total_amount ?? 0);
                        $orderPaid = (float) ($po->deposit_paid ?? 0);
                        $orderRemaining = max(0.0, $orderTotal - $orderPaid);
                        if ($po->items) {
                            $itemsSummary = $po->items->map(fn($item) => [
                                'name' => $item->material?->name ?? 'مادة خام',
                                'quantity' => (float) $item->quantity,
                                'unit' => $item->material?->unit ?? 'وحدة',
                                'unit_cost' => (float) $item->unit_cost,
                                'total_cost' => (float) $item->total_cost,
                            ])->toArray();
                        }
                    }
                }
            } elseif ($t->source_type === \App\Models\ExternalServiceOrder::class || $t->source_type === 'App\Models\ExternalServiceOrder') {
                $eso = \App\Models\ExternalServiceOrder::with('supplier')->find($t->source_id);
                if ($eso) {
                    $entityName = $eso->supplier?->name;
                    $entityPhone = $eso->supplier?->phone;
                    $refNumber = $eso->order_number;
                    $orderTotal = (float) ($eso->total_cost ?? 0);
                    $orderPaid = (float) ($eso->paid_amount ?? 0);
                    $orderRemaining = (float) ($eso->balance ?? 0);
                    $itemsSummary = [
                        [
                            'name' => $eso->service_name ?: 'خدمة خارجية',
                            'quantity' => (float) ($eso->quantity ?? 1),
                            'unit' => 'خدمة',
                            'unit_cost' => (float) ($eso->unit_cost ?? $eso->total_cost),
                            'total_cost' => (float) ($eso->total_cost ?? 0),
                        ]
                    ];
                }
            }

            // Fallback for operation reference search if not found
            if (!$entityName && $refNumber && str_starts_with($refNumber, 'OP-')) {
                $op = \App\Models\Operation::with(['client', 'operationProducts.product'])->where('operation_number', $refNumber)->first();
                if ($op) {
                    $entityName = $op->client?->name;
                    $entityPhone = $op->client?->phone;
                    $orderTotal = (float) ($op->total_price ?? 0);
                    $orderPaid = (float) ($op->deposit_paid ?? 0) + (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                    $orderRemaining = max(0.0, $orderTotal - $orderPaid);
                    if ($op->operationProducts) {
                        $itemsSummary = $op->operationProducts->map(fn($opP) => [
                            'name' => $opP->product?->name ?? 'منتج',
                            'quantity' => (float) $opP->quantity,
                            'unit' => $opP->product?->unit ?? 'وحدة',
                            'unit_cost' => (float) ($opP->product?->sale_price ?? 0),
                            'total_cost' => (float) (($opP->quantity) * ($opP->product?->sale_price ?? 0)),
                        ])->toArray();
                    }
                }
            }

            $t->number = $t->transaction_number;
            $t->date = $dStr;
            $t->client_name = $entityName;
            $t->supplier_name = $entityName;
            $t->entity_name = $entityName;
            $t->entity_phone = $entityPhone;
            $t->resolved_reference = $refNumber;
            $t->items_summary = $itemsSummary;
            $t->order_total = $orderTotal;
            $t->order_paid = $orderPaid;
            $t->order_remaining = $orderRemaining;
            $t->user_name = $t->user?->name ?? 'المشرف';

            return $t;
        });

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
