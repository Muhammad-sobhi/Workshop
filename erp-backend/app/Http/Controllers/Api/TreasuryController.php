<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientPayment;
use App\Models\ExternalServiceOrder;
use App\Models\Operation;
use App\Models\SupplierPayment;
use App\Models\TreasuryTransaction;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TreasuryController extends Controller
{
    private const MAX_PER_PAGE = 1000;

    /** Transactions entered from the treasury page itself — the only ones editable here. */
    private const MANUAL_SOURCES = ['manual_deposit', 'manual_withdrawal', TreasuryService::TRANSFER_SOURCE];

    private const METHOD_RULE = 'in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer';
    private const RECEIPT_RULE = 'nullable|file|mimes:jpeg,jpg,png,gif,webp,bmp,heic,heif,avif,tif,tiff,pdf|max:20480';

    /**
     * Balances up to end_date (or all time) and in/out flows between start_date and end_date.
     */
    public function summary(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'date' => 'nullable|date',
        ]);

        $fromDate = $request->query('start_date') ?: null;
        $upToDate = $request->query('end_date') ?: ($request->query('date') ?: null);

        return response()->json(TreasuryService::getBalances($upToDate, $fromDate));
    }

    /**
     * Paginated treasury ledger.
     * type: inflow / outflow (transfers between methods excluded) or transfer.
     */
    public function transactions(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'type' => 'nullable|in:inflow,outflow,transfer',
            'payment_method' => 'nullable|string|' . self::METHOD_RULE,
            'search' => 'nullable|string|max:255',
        ]);

        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->query('per_page', 25)));

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

        $type = $request->query('type');
        if ($type === 'transfer') {
            $query->where('source_type', TreasuryService::TRANSFER_SOURCE);
        } elseif ($type === 'inflow' || $type === 'outflow') {
            $query->where('type', $type)->where(function ($q) {
                $q->whereNull('source_type')->orWhere('source_type', '!=', TreasuryService::TRANSFER_SOURCE);
            });
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

        // Totals of the whole filtered set, not only the current page
        $totals = (clone $query)->toBase()->reorder()->selectRaw(
            "COALESCE(SUM(CASE WHEN type = 'inflow' THEN amount ELSE 0 END), 0) as inflow, " .
            "COALESCE(SUM(CASE WHEN type = 'outflow' THEN amount ELSE 0 END), 0) as outflow"
        )->first();

        $paginator = $query->paginate($perPage);
        $this->attachDetails($paginator->getCollection());

        return response()->json($paginator->toArray() + [
            'totals' => [
                'inflow' => round((float) $totals->inflow, 2),
                'outflow' => round((float) $totals->outflow, 2),
                'net' => round((float) $totals->inflow - (float) $totals->outflow, 2),
            ],
        ]);
    }

    /**
     * Record a manual cash deposit (e.g. capital injection, opening balance).
     */
    public function deposit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|' . self::METHOD_RULE,
            'category' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'receipt' => self::RECEIPT_RULE,
        ]);

        $trx = TreasuryService::recordInflow(
            amount: (float) $validated['amount'],
            paymentMethod: $validated['payment_method'],
            category: $validated['category'],
            description: $validated['description'] ?? 'إيداع يدوي في الخزينة',
            sourceType: 'manual_deposit',
            referenceNumber: $validated['reference_number'] ?? null,
            transactionDate: $validated['transaction_date'],
            receiptPath: $this->storeReceipt($request)
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
            'payment_method' => 'required|string|' . self::METHOD_RULE,
            'category' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string',
            'reference_number' => 'nullable|string',
            'receipt' => self::RECEIPT_RULE,
        ]);

        $trx = DB::transaction(function () use ($validated, $request) {
            $amount = (float) $validated['amount'];
            TreasuryService::assertSufficientBalance([$validated['payment_method'] => -$amount]);

            return TreasuryService::recordOutflow(
                amount: $amount,
                paymentMethod: $validated['payment_method'],
                category: $validated['category'],
                description: $validated['description'] ?? 'سحب يدوي من الخزينة',
                sourceType: 'manual_withdrawal',
                referenceNumber: $validated['reference_number'] ?? null,
                transactionDate: $validated['transaction_date'],
                receiptPath: $this->storeReceipt($request)
            );
        });

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
            'from_method' => 'required|string|' . self::METHOD_RULE,
            'to_method' => 'required|string|' . self::METHOD_RULE . '|different:from_method',
            'amount' => 'required|numeric|min:0.01',
            'transaction_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $amount = (float) $validated['amount'];
            TreasuryService::assertSufficientBalance([$validated['from_method'] => -$amount]);

            [$outDesc, $inDesc] = $this->transferDescriptions($validated['from_method'], $validated['to_method'], $validated['notes'] ?? null);

            // 1. Outflow from source method
            $out = TreasuryService::recordOutflow(
                amount: $amount,
                paymentMethod: $validated['from_method'],
                category: 'تحويل بين الخزائن والمحافظ',
                description: $outDesc,
                sourceType: TreasuryService::TRANSFER_SOURCE,
                transactionDate: $validated['transaction_date']
            );

            // Both legs share a reference that is unique per transfer
            $ref = 'TRF-' . $out->id;
            $out->update(['reference_number' => $ref]);

            // 2. Inflow into target method
            TreasuryService::recordInflow(
                amount: $amount,
                paymentMethod: $validated['to_method'],
                category: 'تحويل بين الخزائن والمحافظ',
                description: $inDesc,
                sourceType: TreasuryService::TRANSFER_SOURCE,
                referenceNumber: $ref,
                transactionDate: $validated['transaction_date']
            );

            $fromName = TreasuryService::methodLabel($validated['from_method']);
            $toName = TreasuryService::methodLabel($validated['to_method']);

            return response()->json([
                'message' => "تم تحويل مبلغ {$amount} EGP بنجاح من ({$fromName}) إلى ({$toName})",
            ]);
        });
    }

    /**
     * Edit a manual deposit / withdrawal, or both legs of a transfer.
     */
    public function update(Request $request, TreasuryTransaction $transaction): JsonResponse
    {
        $this->ensureManual($transaction);

        if ($transaction->source_type === TreasuryService::TRANSFER_SOURCE) {
            $validated = $request->validate([
                'from_method' => 'required|string|' . self::METHOD_RULE,
                'to_method' => 'required|string|' . self::METHOD_RULE . '|different:from_method',
                'amount' => 'required|numeric|min:0.01',
                'transaction_date' => 'required|date',
                'notes' => 'nullable|string',
            ]);

            DB::transaction(function () use ($transaction, $validated) {
                [$out, $in] = $this->transferLegs($transaction);
                $amount = (float) $validated['amount'];

                $deltas = [];
                $this->addDelta($deltas, $out->payment_method, (float) $out->amount);
                $this->addDelta($deltas, $in->payment_method, -(float) $in->amount);
                $this->addDelta($deltas, $validated['from_method'], -$amount);
                $this->addDelta($deltas, $validated['to_method'], $amount);
                TreasuryService::assertSufficientBalance($deltas);

                [$outDesc, $inDesc] = $this->transferDescriptions($validated['from_method'], $validated['to_method'], $validated['notes'] ?? null);
                $common = ['amount' => $amount, 'transaction_date' => $validated['transaction_date']];
                $out->update($common + ['payment_method' => $validated['from_method'], 'description' => $outDesc]);
                $in->update($common + ['payment_method' => $validated['to_method'], 'description' => $inDesc]);
            });

            return response()->json(['message' => 'تم تعديل التحويل بنجاح']);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|' . self::METHOD_RULE,
            'category' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'description' => 'nullable|string',
            'receipt' => self::RECEIPT_RULE,
            'remove_receipt' => 'nullable|boolean',
        ]);

        DB::transaction(function () use ($transaction, $validated, $request) {
            $sign = $transaction->type === 'inflow' ? 1 : -1;
            $deltas = [];
            $this->addDelta($deltas, $transaction->payment_method, -$sign * (float) $transaction->amount);
            $this->addDelta($deltas, $validated['payment_method'], $sign * (float) $validated['amount']);
            TreasuryService::assertSufficientBalance($deltas);

            $data = [
                'amount' => (float) $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'category' => $validated['category'],
                'transaction_date' => $validated['transaction_date'],
                'description' => $validated['description'] ?? $transaction->description,
            ];
            if ($request->hasFile('receipt')) {
                $data['receipt_path'] = $this->storeReceipt($request);
            } elseif ($request->boolean('remove_receipt')) {
                $data['receipt_path'] = null;
            }

            $transaction->update($data);
        });

        return response()->json(['message' => 'تم تعديل الحركة بنجاح', 'transaction' => $transaction->fresh()]);
    }

    /**
     * Delete a manual deposit / withdrawal, or both legs of a transfer.
     */
    public function destroy(TreasuryTransaction $transaction): JsonResponse
    {
        $this->ensureManual($transaction);

        DB::transaction(function () use ($transaction) {
            $legs = $transaction->source_type === TreasuryService::TRANSFER_SOURCE
                ? $this->transferLegs($transaction)
                : [$transaction];

            $deltas = [];
            foreach ($legs as $leg) {
                $this->addDelta($deltas, $leg->payment_method, $leg->type === 'inflow' ? -(float) $leg->amount : (float) $leg->amount);
            }
            TreasuryService::assertSufficientBalance($deltas);

            foreach ($legs as $leg) {
                $leg->delete();
            }
        });

        return response()->json(['message' => 'تم حذف الحركة من الخزينة']);
    }

    private function ensureManual(TreasuryTransaction $transaction): void
    {
        if (!in_array($transaction->source_type, self::MANUAL_SOURCES, true)) {
            abort(422, 'هذه الحركة مسجلة تلقائياً من شاشة أخرى (مبيعات، مصروفات، موردين...) ويجب تعديلها أو حذفها من مصدرها.');
        }
    }

    /**
     * The outflow and inflow legs of the transfer that $transaction belongs to.
     *
     * @return TreasuryTransaction[] [out, in]
     */
    private function transferLegs(TreasuryTransaction $transaction): array
    {
        $legs = TreasuryTransaction::where('source_type', TreasuryService::TRANSFER_SOURCE)
            ->where('reference_number', $transaction->reference_number)
            ->lockForUpdate()
            ->get();

        $out = $legs->where('type', 'outflow');
        $in = $legs->where('type', 'inflow');
        if ($out->count() !== 1 || $in->count() !== 1) {
            abort(422, 'تعذر تحديد طرفي هذا التحويل (رقم مرجع مكرر). يرجى تسجيل حركة عكسية بدلاً من التعديل.');
        }

        return [$out->first(), $in->first()];
    }

    private function addDelta(array &$deltas, string $method, float $amount): void
    {
        $deltas[$method] = ($deltas[$method] ?? 0.0) + $amount;
    }

    private function transferDescriptions(string $from, string $to, ?string $notes): array
    {
        $fromName = TreasuryService::methodLabel($from);
        $toName = TreasuryService::methodLabel($to);
        $suffix = $notes ? " - {$notes}" : '';

        return [
            "تحويل مالي صادر من ({$fromName}) إلى ({$toName}){$suffix}",
            "تحويل مالي وارد من ({$fromName}) إلى ({$toName}){$suffix}",
        ];
    }

    private function storeReceipt(Request $request): ?string
    {
        if (!$request->hasFile('receipt')) {
            return null;
        }

        return '/storage/' . $request->file('receipt')->store('receipts', 'public');
    }

    /**
     * Add entity / order details to a page of transactions, loading each source type in one query.
     */
    private function attachDetails(Collection $rows): void
    {
        $idsOf = fn (string $class) => $rows->where('source_type', $class)->pluck('source_id')->filter()->unique()->values()->all();

        $clientPayments = ClientPayment::with('client')->whereIn('id', $idsOf(ClientPayment::class))->get()->keyBy('id');
        $supplierPayments = SupplierPayment::with(['supplier', 'purchaseOrder.items.material', 'purchaseOrder.items.product'])
            ->whereIn('id', $idsOf(SupplierPayment::class))->get()->keyBy('id');
        $serviceOrders = ExternalServiceOrder::with('supplier')->whereIn('id', $idsOf(ExternalServiceOrder::class))->get()->keyBy('id');

        $operationIds = array_merge($idsOf(Operation::class), $clientPayments->pluck('operation_id')->filter()->all());
        $operationNumbers = $rows->pluck('reference_number')
            ->filter(fn ($ref) => is_string($ref) && str_starts_with($ref, 'OP-'))
            ->unique()->values()->all();
        $operations = (empty($operationIds) && empty($operationNumbers))
            ? collect()
            : Operation::with(['client', 'operationProducts.product', 'payments'])
                ->where(fn ($q) => $q->whereIn('id', $operationIds)->orWhereIn('operation_number', $operationNumbers))
                ->get();
        $operationsById = $operations->keyBy('id');
        $operationsByNumber = $operations->keyBy('operation_number');

        // Everything paid against each purchase order (deposit and any later linked payment)
        $poIds = $supplierPayments->pluck('purchase_order_id')->filter()->unique()->values()->all();
        $poPaid = empty($poIds) ? collect() : SupplierPayment::whereIn('purchase_order_id', $poIds)
            ->groupBy('purchase_order_id')
            ->selectRaw('purchase_order_id, SUM(amount) as paid')
            ->pluck('paid', 'purchase_order_id');

        // Both legs of each transfer, to know where it came from and went to
        $transferRefs = $rows->where('source_type', TreasuryService::TRANSFER_SOURCE)->pluck('reference_number')->filter()->unique()->values()->all();
        $transferLegs = empty($transferRefs) ? collect() : TreasuryTransaction::where('source_type', TreasuryService::TRANSFER_SOURCE)
            ->whereIn('reference_number', $transferRefs)
            ->get(['reference_number', 'type', 'payment_method'])
            ->groupBy('reference_number');

        $rows->transform(function ($t) use ($clientPayments, $supplierPayments, $serviceOrders, $operationsById, $operationsByNumber, $poPaid, $transferLegs) {
            $d = [
                'entity_name' => null,
                'entity_phone' => null,
                'resolved_reference' => $t->reference_number,
                'order_kind' => null,
                'order_total' => null,
                'order_paid' => null,
                'order_remaining' => null,
                'items_summary' => [],
            ];

            switch ($t->source_type) {
                case Operation::class:
                    if ($op = $operationsById->get($t->source_id)) {
                        $d = array_merge($d, $this->operationDetails($op), [
                            'entity_name' => $op->client?->name,
                            'entity_phone' => $op->client?->phone,
                            'resolved_reference' => $op->operation_number,
                        ]);
                    }
                    break;

                case ClientPayment::class:
                    if ($cp = $clientPayments->get($t->source_id)) {
                        $d['entity_name'] = $cp->client?->name;
                        $d['entity_phone'] = $cp->client?->phone;
                        $d['resolved_reference'] = $cp->reference_number ?: $cp->payment_number;
                        if ($cp->operation_id && ($op = $operationsById->get($cp->operation_id))) {
                            $d = array_merge($d, $this->operationDetails($op));
                        }
                    }
                    break;

                case SupplierPayment::class:
                    if ($sp = $supplierPayments->get($t->source_id)) {
                        $d['entity_name'] = $sp->supplier?->name;
                        $d['entity_phone'] = $sp->supplier?->phone;
                        $d['resolved_reference'] = $sp->purchaseOrder?->order_number ?: $sp->payment_number;
                        if ($po = $sp->purchaseOrder) {
                            // Supplier payments are not allocated to orders, so what is still owed
                            // is the supplier's account balance, not total − payments linked to this order
                            $d['order_kind'] = 'purchase';
                            $d['order_total'] = (float) ($po->total_amount ?? 0);
                            $d['order_paid'] = (float) ($poPaid[$po->id] ?? $po->deposit_paid ?? 0);
                            $d['order_remaining'] = $sp->supplier ? max(0.0, (float) $sp->supplier->debt_amount) : null;
                            $d['items_summary'] = $po->items->map(fn ($item) => [
                                'name' => $item->material?->name ?? $item->product?->name ?? 'مادة خام',
                                'quantity' => (float) $item->quantity,
                                'unit' => $item->material?->unit ?? $item->product?->unit ?? 'وحدة',
                                'unit_cost' => (float) $item->unit_cost,
                                'total_cost' => (float) $item->total_cost,
                            ])->values()->all();
                        }
                    }
                    break;

                case ExternalServiceOrder::class:
                    if ($eso = $serviceOrders->get($t->source_id)) {
                        $d['entity_name'] = $eso->supplier?->name;
                        $d['entity_phone'] = $eso->supplier?->phone;
                        $d['resolved_reference'] = $eso->order_number;
                        $d['order_kind'] = 'service';
                        $d['order_total'] = (float) ($eso->total_cost ?? 0);
                        $d['order_paid'] = (float) ($eso->paid_amount ?? 0);
                        $d['order_remaining'] = (float) ($eso->balance ?? 0);
                        $d['items_summary'] = [[
                            'name' => $eso->service_name ?: 'خدمة خارجية',
                            'quantity' => (float) ($eso->quantity ?? 1),
                            'unit' => 'خدمة',
                            'unit_cost' => (float) ($eso->unit_cost ?? $eso->total_cost),
                            'total_cost' => (float) ($eso->total_cost ?? 0),
                        ]];
                    }
                    break;
            }

            // Fallback: transactions that only carry the operation number as reference
            $ref = $d['resolved_reference'];
            if (!$d['entity_name'] && is_string($ref) && str_starts_with($ref, 'OP-') && ($op = $operationsByNumber->get($ref))) {
                $d = array_merge($d, $this->operationDetails($op), [
                    'entity_name' => $op->client?->name,
                    'entity_phone' => $op->client?->phone,
                ]);
            }

            $isTransfer = $t->source_type === TreasuryService::TRANSFER_SOURCE;
            if ($isTransfer) {
                $legs = $transferLegs->get($t->reference_number, collect());
                $t->transfer_from = $legs->firstWhere('type', 'outflow')?->payment_method;
                $t->transfer_to = $legs->firstWhere('type', 'inflow')?->payment_method;
            }

            $t->number = $t->transaction_number;
            $t->date = $t->transaction_date ? $t->transaction_date->format('Y-m-d') : '';
            $t->client_name = $d['entity_name'];
            $t->supplier_name = $d['entity_name'];
            $t->entity_name = $d['entity_name'];
            $t->entity_phone = $d['entity_phone'];
            $t->resolved_reference = $d['resolved_reference'];
            $t->order_kind = $d['order_kind'];
            $t->items_summary = $d['items_summary'];
            $t->order_total = $d['order_total'];
            $t->order_paid = $d['order_paid'];
            $t->order_remaining = $d['order_remaining'];
            $t->is_transfer = $isTransfer;
            $t->is_editable = in_array($t->source_type, self::MANUAL_SOURCES, true);
            $t->user_name = $t->user?->name ?? 'المشرف';

            return $t;
        });
    }

    /**
     * Order financials and lines of an operation, priced as agreed on the order.
     */
    private function operationDetails(Operation $op): array
    {
        $total = (float) ($op->total_price ?? 0);
        $paid = (float) ($op->deposit_paid ?? 0) + (float) $op->payments->sum('amount_paid');
        $prices = $op->linePrices();

        return [
            'order_kind' => 'operation',
            'order_total' => $total,
            'order_paid' => $paid,
            'order_remaining' => max(0.0, round($total - $paid, 2)),
            'items_summary' => $op->operationProducts->map(fn ($line) => [
                'name' => $line->product?->name ?? 'منتج',
                'quantity' => (float) $line->quantity,
                'unit' => $line->product?->unit ?? 'وحدة',
                'unit_cost' => (float) ($prices[$line->id]['unit_price'] ?? 0),
                'total_cost' => (float) ($prices[$line->id]['total'] ?? 0),
            ])->values()->all(),
        ];
    }
}
