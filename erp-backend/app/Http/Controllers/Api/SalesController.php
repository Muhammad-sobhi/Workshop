<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class SalesController extends Controller
{
    /**
     * List all sales invoices with exact COGS, items, and client info.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);

        if (!Schema::hasTable('sales_invoices')) {
            if (!$request->has('page') || $perPage > 500) {
                return response()->json([]);
            }
            return response()->json([
                'data' => [],
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
                'per_page' => $perPage,
            ]);
        }

        $query = SalesInvoice::with(['client', 'items.product', 'operation'])->orderBy('invoice_date', 'desc')->orderBy('id', 'desc');

        if ($request->filled('start_date')) {
            $query->whereDate('invoice_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('invoice_date', '<=', $request->query('end_date'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        if ($request->filled('invoice_type')) {
            $query->where('invoice_type', $request->query('invoice_type'));
        }

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('invoice_number', 'LIKE', "%{$s}%")
                    ->orWhere('notes', 'LIKE', "%{$s}%")
                    ->orWhereHas('client', function ($cq) use ($s) {
                        $cq->where('name', 'LIKE', "%{$s}%");
                    });
            });
        }

        // If not requesting specific page, return flat array for test and dropdown compatibility
        if (!$request->has('page') || $perPage > 500) {
            $invoices = $query->get()->map(function ($inv) {
                return $this->formatInvoice($inv);
            });
            return response()->json($invoices);
        }

        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(function ($inv) {
            return $this->formatInvoice($inv);
        });

        return response()->json($paginator);
    }

    /**
     * Create a new sales invoice (Single or Multi-item).
     */
    public function store(Request $request): JsonResponse
    {
        // Support both single item form (product_id, quantity, price) and multi-item form (items array)
        $validated = $request->validate([
            'client_id' => 'nullable|exists:clients,id',
            'invoice_date' => 'required|date',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'paid_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'warehouse_id' => 'nullable|exists:warehouses,id',

            // Single item payload fallback
            'product_id' => 'nullable|exists:products,id',
            'quantity' => 'nullable|numeric|min:0.01',
            'price' => 'nullable|numeric|min:0',

            // Multi items payload
            'items' => 'nullable|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_sale_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $user = auth()->id();
            $client = !empty($validated['client_id']) ? Client::find($validated['client_id']) : null;

            // Normalize items array
            $itemsData = [];
            if (!empty($validated['items'])) {
                $itemsData = $validated['items'];
            } elseif (!empty($validated['product_id']) && !empty($validated['quantity'])) {
                $itemsData[] = [
                    'product_id' => $validated['product_id'],
                    'quantity' => $validated['quantity'],
                    'unit_sale_price' => $validated['price'] ?? 0,
                ];
            } else {
                return response()->json(['message' => 'يجب تحديد صنف واحد على الأقل لإصدار الفاتورة.'], 400);
            }

            // Get target warehouse for finished products (WSH-P or first warehouse)
            $whProd = Warehouse::productsWarehouse();
            $warehouseId = $validated['warehouse_id'] ?? ($whProd ? $whProd->id : (Warehouse::first() ? Warehouse::first()->id : 1));

            // Validate stock availability for all items
            foreach ($itemsData as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (float) $item['quantity'];
                $available = InventoryService::getStock('product', $product->id, $warehouseId);

                if ($available < $qty) {
                    $uName = $product->unit ?: 'وحدة';
                    return response()->json([
                        'message' => "عذراً، المخزون المتوفر من ({$product->name}) غير كافٍ. المتوفر: {$available} {$uName}، المطلوب: {$qty} {$uName}."
                    ], 400);
                }
            }

            // Calculate totals
            $totalAmount = 0.0;
            $totalCogs = 0.0;
            $calculatedItems = [];

            foreach ($itemsData as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_sale_price'];

                $fifoConsumption = InventoryService::consumeFifoQuantity('product', $product->id, $warehouseId, $qty);
                $unitCost = $fifoConsumption['blended_unit_cost'] > 0
                    ? $fifoConsumption['blended_unit_cost']
                    : (float) $product->calculateStoredUnitCost($warehouseId);
                $itemTotalCost = $fifoConsumption['total_cogs'] > 0
                    ? $fifoConsumption['total_cogs']
                    : round($qty * $unitCost, 2);

                $itemTotalSale = round($qty * $unitPrice, 2);

                $totalAmount += $itemTotalSale;
                $totalCogs += $itemTotalCost;

                $calculatedItems[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_sale_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'total_sale_price' => $itemTotalSale,
                    'total_cost' => $itemTotalCost,
                ];
            }

            $paidAmount = isset($validated['paid_amount']) ? (float) $validated['paid_amount'] : $totalAmount;
            $paidAmount = min($paidAmount, $totalAmount);
            $remainingAmount = max(0.0, round($totalAmount - $paidAmount, 2));

            // Create Sales Invoice
            $invNo = SalesInvoice::generateNextInvoiceNumber('INV');
            $invoice = SalesInvoice::create([
                'invoice_number' => $invNo,
                'invoice_date' => $validated['invoice_date'],
                'client_id' => $client?->id,
                'invoice_type' => 'direct_sale',
                'total_amount' => $totalAmount,
                'total_cogs' => $totalCogs,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? null,
                'created_by' => $user,
            ]);

            // Create items & deduct stock via InventoryService
            foreach ($calculatedItems as $cItem) {
                SalesInvoiceItem::create([
                    'sales_invoice_id' => $invoice->id,
                    'product_id' => $cItem['product']->id,
                    'quantity' => $cItem['quantity'],
                    'unit_sale_price' => $cItem['unit_sale_price'],
                    'unit_cost' => $cItem['unit_cost'],
                    'total_sale_price' => $cItem['total_sale_price'],
                    'total_cost' => $cItem['total_cost'],
                ]);

                // Record outgoing inventory movement
                InventoryService::recordMovement(
                    warehouseId: $warehouseId,
                    materialId: null,
                    productId: $cItem['product']->id,
                    movementType: 'Sales_Issue',
                    quantity: $cItem['quantity'],
                    unitCost: $cItem['unit_cost'],
                    referenceNumber: $invNo,
                    notes: "مبيعات للعميل (" . ($client ? $client->name : 'عميل نقدي') . ") - فاتورة {$invNo}",
                    movementDate: $validated['invoice_date'],
                    userId: $user
                );
            }

            // Record cash inflow in Treasury for paid amount
            if ($paidAmount > 0) {
                TreasuryService::recordInflow(
                    amount: $paidAmount,
                    paymentMethod: $validated['payment_method'],
                    category: 'مبيعات منتجات جاهزة',
                    description: "تحصيل فاتورة مبيعات رقم {$invNo}" . ($client ? " - العميل: {$client->name}" : ''),
                    sourceType: SalesInvoice::class,
                    sourceId: $invoice->id,
                    referenceNumber: $invNo,
                    transactionDate: $validated['invoice_date'],
                    userId: $user
                );
            }

            // Recalculate client debt dynamically
            if ($client) {
                $client->recalculateDebt();
            }

            return response()->json([
                'message' => 'تم إصدار فاتورة المبيعات بنجاح، وخصم المخزن، وتسجيل الإيراد في الخزينة.',
                'invoice' => $this->formatInvoice($invoice->load(['client', 'items.product'])),
            ], 201);
        });
    }

    /**
     * Record historical opening sale without stock deduction.
     */
    public function storeHistoricalSale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'nullable|exists:clients,id',
            'revenue_date' => 'required|date',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.sale_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = auth()->id();
            $client = !empty($validated['client_id']) ? Client::find($validated['client_id']) : null;

            $totalAmount = 0.0;
            $totalCogs = 0.0;
            $calculatedItems = [];

            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (float) $item['quantity'];
                $price = (float) $item['sale_price'];
                $unitCost = (float) $product->calculateStoredUnitCost();

                $itemTotalSale = round($qty * $price, 2);
                $itemTotalCost = round($qty * $unitCost, 2);

                $totalAmount += $itemTotalSale;
                $totalCogs += $itemTotalCost;

                $calculatedItems[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_sale_price' => $price,
                    'unit_cost' => $unitCost,
                    'total_sale_price' => $itemTotalSale,
                    'total_cost' => $itemTotalCost,
                ];
            }

            $invNo = SalesInvoice::generateNextInvoiceNumber('HIST');
            $invoice = SalesInvoice::create([
                'invoice_number' => $invNo,
                'invoice_date' => $validated['revenue_date'],
                'client_id' => $client?->id,
                'invoice_type' => 'historical_opening',
                'total_amount' => $totalAmount,
                'total_cogs' => $totalCogs,
                'paid_amount' => $totalAmount,
                'remaining_amount' => 0,
                'payment_method' => $validated['payment_method'],
                'notes' => 'مبيعات سابقة (رصيد إفتتاحي)' . (!empty($validated['notes']) ? " - {$validated['notes']}" : ''),
                'created_by' => $user,
            ]);

            foreach ($calculatedItems as $cItem) {
                SalesInvoiceItem::create([
                    'sales_invoice_id' => $invoice->id,
                    'product_id' => $cItem['product']->id,
                    'quantity' => $cItem['quantity'],
                    'unit_sale_price' => $cItem['unit_sale_price'],
                    'unit_cost' => $cItem['unit_cost'],
                    'total_sale_price' => $cItem['total_sale_price'],
                    'total_cost' => $cItem['total_cost'],
                ]);
            }

            // Log Treasury Inflow for Net Profit ONLY (صافي الربح بعد خصم التكلفة)
            $netProfit = round($totalAmount - $totalCogs, 2);
            if ($netProfit > 0) {
                TreasuryService::recordInflow(
                    amount: $netProfit,
                    paymentMethod: $validated['payment_method'],
                    category: 'مبيعات سابقة / رصيد إفتتاحي',
                    description: "أرباح مبيعات سابقة رقم {$invNo} (صافي الربح بعد خصم التكلفة)" . ($client ? " للعميل ({$client->name})" : ''),
                    sourceType: SalesInvoice::class,
                    sourceId: $invoice->id,
                    referenceNumber: $invNo,
                    transactionDate: $validated['revenue_date'],
                    userId: $user
                );
            }

            return response()->json([
                'message' => 'تم تسجيل المبيعات السابقة بنجاح وإدراجها في الخزينة وقائمة الدخل بدقة.',
                'invoice' => $this->formatInvoice($invoice->load(['client', 'items.product'])),
            ], 201);
        });
    }

    /**
     * Get Clients list with real live balance.
     */
    public function getClients(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 50);
        $paginator = Client::orderBy('name', 'asc')->paginate($perPage);

        return response()->json($paginator);
    }

    /**
     * Client debt payment endpoint.
     */
    public function payClientDebt(Request $request, string $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'payment_date' => 'required|date',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'notes' => 'nullable|string',
        ]);

        $paymentAmount = (float) $validated['amount'];

        // Protection against rapid duplicate submissions (e.g. double click)
        if (Schema::hasTable('client_payments')) {
            $recentDup = ClientPayment::where('client_id', $client->id)
                ->where('amount', $paymentAmount)
                ->where('created_at', '>=', now()->subSeconds(4))
                ->first();
            if ($recentDup) {
                return response()->json([
                    'message' => 'تم تسجيل سداد الدفعة للعميل بنجاح وتحديث الخزينة وحساب العميل.',
                    'payment' => $recentDup,
                    'client' => $client->fresh(),
                ]);
            }
        }

        return DB::transaction(function () use ($client, $validated, $request, $paymentAmount) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            // Check if specific sales invoice was passed or extract from notes
            $targetInvoiceId = $request->input('sales_invoice_id');
            if (!$targetInvoiceId && !empty($validated['notes'])) {
                if (preg_match('/INV-\d{4}-\d+/i', $validated['notes'], $matches)) {
                    $foundInv = SalesInvoice::where('invoice_number', strtoupper($matches[0]))->first();
                    if ($foundInv) {
                        $targetInvoiceId = $foundInv->id;
                    }
                }
            }

            // 1. Create ClientPayment record
            $payment = ClientPayment::create([
                'client_id' => $client->id,
                'amount' => $paymentAmount,
                'payment_date' => $validated['payment_date'],
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? 'سداد دفعة من حساب العميل',
                'receipt_path' => $receiptPath,
                'sales_invoice_id' => $targetInvoiceId,
                'created_by' => $user,
            ]);

            // 2. Synchronize payment with the client's sales invoice(s)
            if ($targetInvoiceId) {
                $targetInv = SalesInvoice::find($targetInvoiceId);
                if ($targetInv) {
                    $targetInv->paid_amount = min((float)$targetInv->total_amount, (float)$targetInv->paid_amount + $paymentAmount);
                    $targetInv->remaining_amount = max(0.0, (float)$targetInv->total_amount - (float)$targetInv->paid_amount);
                    $targetInv->save();
                }
            } else {
                // If no specific invoice was requested, allocate the payment to open unpaid invoices (FIFO: oldest first)
                $openInvoices = SalesInvoice::where('client_id', $client->id)
                    ->where('remaining_amount', '>', 0)
                    ->orderBy('invoice_date', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();

                $remainingToAllocate = $paymentAmount;
                foreach ($openInvoices as $inv) {
                    if ($remainingToAllocate <= 0) break;
                    $alloc = min($remainingToAllocate, (float)$inv->remaining_amount);
                    $inv->paid_amount = (float)$inv->paid_amount + $alloc;
                    $inv->remaining_amount = max(0.0, (float)$inv->total_amount - (float)$inv->paid_amount);
                    $inv->save();
                    
                    if (!$payment->sales_invoice_id) {
                        $payment->sales_invoice_id = $inv->id;
                        $payment->save();
                    }
                    $remainingToAllocate -= $alloc;
                }
            }

            // 3. Record Treasury Inflow
            TreasuryService::recordInflow(
                amount: $paymentAmount,
                paymentMethod: $validated['payment_method'],
                category: 'تسديد ديون عملاء',
                description: "سداد دفعة حساب للعميل ({$client->name})" . (!empty($validated['notes']) ? " - {$validated['notes']}" : ''),
                sourceType: ClientPayment::class,
                sourceId: $payment->id,
                referenceNumber: $payment->payment_number,
                transactionDate: $validated['payment_date'],
                receiptPath: $receiptPath,
                userId: $user
            );

            // 4. Recalculate Client live debt
            $client->recalculateDebt();

            return response()->json([
                'message' => 'تم تسجيل سداد الدفعة للعميل بنجاح وتحديث الخزينة وحساب العميل.',
                'payment' => $payment,
                'client' => $client->fresh(),
            ]);
        });
    }

    /**
     * Delete/Undo client payment and revert Treasury inflow.
     */
    public function deleteClientPayment(string $clientId, string $paymentId): JsonResponse
    {
        $cleanId = str_replace(['pay-', 'rev-', 'exp-'], '', $paymentId);
        $client = Client::findOrFail($clientId);

        $payment = null;
        if (Schema::hasTable('client_payments')) {
            $payment = ClientPayment::where('client_id', $client->id)->find($cleanId);
        }

        if (!$payment) {
            return response()->json(['message' => 'تعذر العثور على سجل السداد المحدد.'], 404);
        }

        return DB::transaction(function () use ($client, $payment, $paymentId) {
            // Revert linked invoice paid/remaining amount if applicable
            if ($payment->sales_invoice_id) {
                $inv = SalesInvoice::find($payment->sales_invoice_id);
                if ($inv) {
                    $inv->paid_amount = max(0.0, (float)$inv->paid_amount - (float)$payment->amount);
                    $inv->remaining_amount = min((float)$inv->total_amount, (float)$inv->remaining_amount + (float)$payment->amount);
                    $inv->save();
                }
            }

            // Revert Treasury Inflow
            TreasuryService::revertBySource(ClientPayment::class, $payment->id);

            // Delete payment record
            $payment->delete();

            // Recalculate Client debt
            $client->recalculateDebt();

            return response()->json([
                'message' => 'تم إلغاء قيد السداد بنجاح واسترجاع حركة الخزينة والمتبقي.',
                'client' => $client->fresh(),
            ]);
        });
    }

    /**
     * Get complete client transactions statement.
     */
    public function getClientTransactions(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        // Synchronize client debt dynamically from ledger
        $client->recalculateDebt();

        // 1. Invoices
        $invoices = [];
        $invoiceDeposits = [];
        if (Schema::hasTable('sales_invoices')) {
            try {
                $rawInvoices = SalesInvoice::where('client_id', $id)
                    ->with(['items.product', 'payments'])
                    ->get();

                foreach ($rawInvoices as $inv) {
                    $totalAmt = (float) $inv->total_amount;
                    $paidAmt = (float) $inv->paid_amount;
                    $remAmt = (float) ($inv->remaining_amount ?? max(0, $totalAmt - $paidAmt));
                    $pStatus = $remAmt <= 0 ? 'paid' : ($paidAmt > 0 ? 'partial' : 'unpaid');
                    $pStatusLabel = $remAmt <= 0 ? 'مسددة بالكامل' : ($paidAmt > 0 ? 'مسددة جزئياً (متبقي دين)' : 'غير مسددة (دين بالكامل)');
                    $dStr = $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '';

                    $invoices[] = [
                        'id' => 'inv-' . $inv->id,
                        'type' => 'invoice',
                        'is_payment' => false,
                        'number' => $inv->invoice_number,
                        'amount' => $totalAmt,
                        'total_amount' => $totalAmt,
                        'paid_amount' => $paidAmt,
                        'remaining_amount' => $remAmt,
                        'payment_status' => $pStatus,
                        'payment_status_label' => $pStatusLabel,
                        'date' => $dStr,
                        'created_at' => $inv->created_at ? $inv->created_at->toIso8601String() : $dStr,
                        'category' => $inv->invoice_type === 'historical_opening' ? 'مبيعات سابقة / رصيد إفتتاحي' : 'فاتورة مبيعات',
                        'description' => $inv->notes ?: 'فاتورة مبيعات رقم ' . $inv->invoice_number,
                        'payment_method' => $inv->payment_method ?: 'cash',
                        'items_summary' => $inv->items ? $inv->items->map(fn($i) => [
                            'name' => $i->product->name ?? 'منتج',
                            'quantity' => (float) $i->quantity,
                            'unit' => $i->product->unit ?? 'وحدة',
                            'unit_cost' => (float) $i->unit_sale_price,
                            'total_cost' => (float) $i->total_sale_price,
                        ]) : [],
                    ];

                    if (empty($inv->operation_id) && $paidAmt > 0) {
                        $linkedPaymentsSum = (float) ClientPayment::where('sales_invoice_id', $inv->id)->sum('amount');
                        $initialDeposit = round($paidAmt - $linkedPaymentsSum, 2);
                        if ($initialDeposit > 0) {
                            $invoiceDeposits[] = [
                                'id' => 'inv-dep-' . $inv->id,
                                'type' => 'payment',
                                'is_payment' => true,
                                'is_deposit' => true,
                                'parent_id' => 'inv-' . $inv->id,
                                'sales_invoice_id' => 'inv-' . $inv->id,
                                'number' => $inv->invoice_number,
                                'reference_number' => $inv->invoice_number,
                                'amount' => $initialDeposit,
                                'total_amount' => $initialDeposit,
                                'date' => $dStr,
                                'created_at' => $inv->created_at ? $inv->created_at->toIso8601String() : $dStr,
                                'category' => 'دفعة عربون مقدم',
                                'description' => 'دفعة مسددة عند إصدار الفاتورة (' . $inv->invoice_number . ')',
                                'payment_method' => $inv->payment_method ?: 'cash',
                                'receipt_path' => null,
                                'items_summary' => [],
                            ];
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("Error fetching sales invoices for client {$id}: " . $e->getMessage());
            }
        }

        // 2. Direct client payments (includes payments and ledger deposits)
        $payments = [];
        if (Schema::hasTable('client_payments')) {
            try {
                $invoicedOpToInvMap = [];
                if (Schema::hasTable('sales_invoices')) {
                    $invoicedOpToInvMap = SalesInvoice::where('client_id', $id)
                        ->whereNotNull('operation_id')
                        ->pluck('id', 'operation_id')
                        ->toArray();
                }

                $payments = ClientPayment::where('client_id', $id)->get()->map(function ($p) use ($invoicedOpToInvMap) {
                    $dStr = $p->payment_date ? (is_string($p->payment_date) ? substr($p->payment_date, 0, 10) : $p->payment_date->format('Y-m-d')) : '';
                    $targetInvId = $p->sales_invoice_id ?: ($p->operation_id && isset($invoicedOpToInvMap[$p->operation_id]) ? $invoicedOpToInvMap[$p->operation_id] : null);
                    $parentId = $targetInvId ? 'inv-' . $targetInvId : ($p->operation_id ? 'op-' . $p->operation_id : null);

                    return [
                        'id' => 'pay-' . $p->id,
                        'type' => 'payment',
                        'is_payment' => true,
                        'is_deposit' => (bool)($p->operation_id || str_contains($p->notes ?? '', 'عربون')),
                        'number' => $p->reference_number ?: $p->payment_number,
                        'reference_number' => $p->reference_number ?: $p->payment_number,
                        'sales_invoice_id' => $targetInvId ? 'inv-' . $targetInvId : null,
                        'operation_id' => $p->operation_id ? 'op-' . $p->operation_id : null,
                        'parent_id' => $parentId,
                        'amount' => (float) $p->amount,
                        'total_amount' => (float) $p->amount,
                        'date' => $dStr,
                        'created_at' => $p->created_at ? $p->created_at->toIso8601String() : $dStr,
                        'category' => (bool)($p->operation_id || str_contains($p->notes ?? '', 'عربون')) ? 'دفعة عربون مقدم' : 'سداد دفعة عميل',
                        'description' => $p->notes ?: 'سداد دفعة نقدية',
                        'payment_method' => $p->payment_method ?: 'cash',
                        'receipt_path' => $p->receipt_path,
                        'items_summary' => [],
                    ];
                })->toArray();
            } catch (\Throwable $e) {
                Log::warning("Error fetching client payments for {$id}: " . $e->getMessage());
            }
        }

        // 3. Production Orders
        $operations = [];
        if (Schema::hasTable('production_orders')) {
            try {
                $invoicedOpIds = [];
                if (Schema::hasTable('sales_invoices')) {
                    $invoicedOpIds = SalesInvoice::where('client_id', $id)
                        ->whereNotNull('operation_id')
                        ->pluck('operation_id')
                        ->toArray();
                }

                $rawOps = \App\Models\ProductionOrder::where('client_id', $id)
                    ->whereNotIn('id', $invoicedOpIds)
                    ->with(['items.product', 'materials.material'])
                    ->get();

                foreach ($rawOps as $op) {
                    $dStr = $op->order_date ? (is_string($op->order_date) ? substr($op->order_date, 0, 10) : $op->order_date->format('Y-m-d')) : '';
                    $totalPrice = (float) $op->total_price;
                    $operations[] = [
                        'id' => 'op-' . $op->id,
                        'type' => 'production_order',
                        'is_payment' => false,
                        'is_deposit' => false,
                        'number' => $op->order_number,
                        'reference_number' => $op->order_number,
                        'amount' => $totalPrice,
                        'total_amount' => $totalPrice,
                        'deposit_paid' => (float) ($op->deposit_paid ?? 0),
                        'date' => $dStr,
                        'created_at' => $op->created_at ? $op->created_at->toIso8601String() : $dStr,
                        'category' => 'أمر تشغيل وإنتاج',
                        'description' => $op->notes ?: 'أمر تشغيل وإنتاج رقم ' . $op->order_number,
                        'payment_method' => 'cash',
                        'payment_status_label' => $op->status,
                        'remaining_amount' => max(0, $totalPrice - (float)($op->deposit_paid ?? 0)),
                        'items_summary' => $op->items->map(fn($i) => [
                            'name' => $i->product->name ?? 'منتج',
                            'quantity' => (float) $i->quantity,
                            'unit' => $i->product->unit ?? 'قطعة',
                            'unit_cost' => (float) $i->unit_price,
                            'total_cost' => (float) ($i->total_price ?? ($i->quantity * $i->unit_price)),
                        ]),
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning("Error fetching operations for client {$id}: " . $e->getMessage());
            }
        }

        $merged = array_merge($invoices, $invoiceDeposits, $operations, $payments);
        
        // Sort chronologically ascending (Oldest first -> Newest last)
        usort($merged, function ($a, $b) {
            $dComp = strcmp($a['date'] ?? '', $b['date'] ?? '');
            if ($dComp !== 0) return $dComp;

            $aIsPay = !empty($a['is_payment']);
            $bIsPay = !empty($b['is_payment']);
            $aIsDeposit = !empty($a['is_deposit']);
            $bIsDeposit = !empty($b['is_deposit']);

            // If on same date, an invoice/order must come before its own deposit
            if ($aIsPay != $bIsPay) {
                if (!$aIsPay && $bIsDeposit) {
                    $matchParent = ($b['sales_invoice_id'] ?? '') === $a['id'] || ($b['operation_id'] ?? '') === $a['id'] || ($b['parent_id'] ?? '') === $a['id'];
                    if ($matchParent) return -1;
                }
                if ($aIsDeposit && !$bIsPay) {
                    $matchParent = ($a['sales_invoice_id'] ?? '') === $b['id'] || ($a['operation_id'] ?? '') === $b['id'] || ($a['parent_id'] ?? '') === $b['id'];
                    if ($matchParent) return 1;
                }
            }

            $cA = $a['created_at'] ?? '';
            $cB = $b['created_at'] ?? '';
            $cComp = strcmp($cA, $cB);
            if ($cComp !== 0) return $cComp;

            if ($aIsPay !== $bIsPay) return ($aIsPay ? 1 : 0) - ($bIsPay ? 1 : 0);

            return strcmp($a['id'] ?? '', $b['id'] ?? '');
        });

        // Compute running debt cumulative balance strictly in chronological order
        $runningDebt = 0.0;
        foreach ($merged as &$tx) {
            $amt = (float)($tx['amount'] ?? 0);
            if (!empty($tx['is_payment'])) {
                $runningDebt = round($runningDebt - $amt, 2);
            } else {
                $runningDebt = round($runningDebt + $amt, 2);
            }
            $tx['running_debt'] = $runningDebt;
        }
        unset($tx);

        return response()->json($merged);
    }

    /**
     * Get open unpaid invoices for a client.
     */
    public function getClientOpenInvoices(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $invoices = SalesInvoice::where('client_id', $client->id)
            ->where('remaining_amount', '>', 0)
            ->orderBy('invoice_date', 'asc')
            ->orderBy('id', 'asc')
            ->get()
            ->map(fn($inv) => [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'total_amount' => (float)$inv->total_amount,
                'paid_amount' => (float)$inv->paid_amount,
                'remaining_amount' => (float)$inv->remaining_amount,
                'invoice_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
                'notes' => $inv->notes,
            ]);

        return response()->json($invoices);
    }

    public function storeClient(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'debt_amount' => 'nullable|numeric|min:0',
            'debt_due_date' => 'nullable|date',
        ]);

        $validated['debt_amount'] = $validated['debt_amount'] ?? 0;
        $client = Client::create($validated);

        return response()->json(['message' => 'تم إضافة العميل بنجاح', 'client' => $client], 201);
    }

    public function updateClient(Request $request, string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'debt_amount' => 'nullable|numeric|min:0',
            'debt_due_date' => 'nullable|date',
        ]);

        $client->update($validated);
        return response()->json(['message' => 'تم تحديث بيانات العميل بنجاح', 'client' => $client]);
    }

    public function destroyClient(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $client->delete();
        return response()->json(['message' => 'تم حذف العميل بنجاح']);
    }

    public function bulkImportClients(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.name' => 'required|string|max:255',
            'items.*.phone' => 'nullable|string|max:100',
            'items.*.email' => 'nullable|string|email|max:255',
            'items.*.company' => 'nullable|string|max:255',
            'items.*.debt_amount' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            $importedCount = 0;
            foreach ($request->input('items') as $item) {
                Client::create([
                    'name' => $item['name'],
                    'phone' => $item['phone'] ?? null,
                    'email' => $item['email'] ?? null,
                    'company' => $item['company'] ?? null,
                    'debt_amount' => $item['debt_amount'] ?? 0.00,
                ]);
                $importedCount++;
            }

            return response()->json(['message' => "تم استيراد {$importedCount} من العملاء بنجاح"]);
        });
    }

    private function formatInvoice(SalesInvoice $inv): array
    {
        $itemsArr = $inv->items ? $inv->items->map(function ($item) {
            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product->name ?? 'صنف مباع',
                'quantity' => (float) $item->quantity,
                'unit' => $item->product->unit ?? 'وحدة',
                'unit_sale_price' => (float) $item->unit_sale_price,
                'unit_cost' => (float) $item->unit_cost,
                'total_sale_price' => (float) $item->total_sale_price,
                'total_cost' => (float) $item->total_cost,
            ];
        })->toArray() : [];

        $desc = $inv->notes ?: '';
        if (empty($desc) && count($itemsArr) > 0) {
            $names = implode(', ', array_map(fn($i) => "{$i['quantity']} {$i['unit']} {$i['product_name']}", $itemsArr));
            $desc = "بيع: {$names}";
        }

        $paidAmount = (float) ($inv->paid_amount ?? 0);
        $totalAmount = (float) ($inv->total_amount ?? 0);
        $remainingAmount = (float) ($inv->remaining_amount ?? max(0, $totalAmount - $paidAmount));
        $status = $remainingAmount <= 0 ? 'paid' : ($paidAmount > 0 ? 'partial' : 'unpaid');
        $statusLabel = $remainingAmount <= 0 ? 'مسددة بالكامل' : ($paidAmount > 0 ? 'مسددة جزئياً (متبقي دين)' : 'غير مسددة (دين بالكامل)');

        $paymentsArr = [];
        $query = ClientPayment::where('sales_invoice_id', $inv->id);
        if ($inv->operation_id) {
            $query->orWhere('operation_id', $inv->operation_id);
        }
        $linkedList = $query->orderBy('payment_date', 'asc')->orderBy('id', 'asc')->get();
        $linkedPaymentsSum = (float) $linkedList->sum('amount');
        $initialDeposit = empty($inv->operation_id) ? round($paidAmount - $linkedPaymentsSum, 2) : 0.0;

        if ($initialDeposit > 0) {
            $paymentsArr[] = [
                'id' => 'dep-' . $inv->id,
                'payment_number' => $inv->invoice_number,
                'amount' => $initialDeposit,
                'payment_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
                'payment_method' => $inv->payment_method ?: 'cash',
                'notes' => 'دفعة عربون مسددة عند إصدار الفاتورة',
            ];
        }

        foreach ($linkedList as $p) {
            $paymentsArr[] = [
                'id' => $p->id,
                'payment_number' => $p->reference_number ?: $p->payment_number,
                'amount' => (float)$p->amount,
                'payment_date' => $p->payment_date ? (is_string($p->payment_date) ? substr($p->payment_date, 0, 10) : $p->payment_date->format('Y-m-d')) : '',
                'payment_method' => $p->payment_method ?: 'cash',
                'notes' => $p->notes ?: 'سداد دفعة من حساب العميل',
            ];
        }

        return [
            'id' => $inv->id,
            'type' => 'invoice',
            'revenue_number' => $inv->invoice_number,
            'invoice_number' => $inv->invoice_number,
            'amount' => $totalAmount,
            'total_amount' => $totalAmount,
            'cogs' => (float) $inv->total_cogs,
            'product_cost' => (float) $inv->total_cogs,
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remainingAmount,
            'payment_status' => $status,
            'payment_status_label' => $statusLabel,
            'revenue_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
            'invoice_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
            'category' => $inv->invoice_type === 'historical_opening' ? 'مبيعات سابقة / رصيد إفتتاحي' : 'مبيعات منتجات جاهزة',
            'description' => $desc,
            'payment_method' => $inv->payment_method,
            'client_id' => $inv->client_id,
            'client_name' => $inv->client->name ?? '',
            'items' => $itemsArr,
            'payments' => $paymentsArr,
            'created_at' => $inv->created_at ? $inv->created_at->toISOString() : '',
        ];
    }
}

