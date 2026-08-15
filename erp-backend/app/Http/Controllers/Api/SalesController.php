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

class SalesController extends Controller
{
    /**
     * List all sales invoices with exact COGS, items, and client info.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
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

            // If remaining amount > 0, update client debt
            if ($remainingAmount > 0 && $client) {
                $client->increment('debt_amount', $remainingAmount);
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

            // Log Treasury Inflow
            TreasuryService::recordInflow(
                amount: $totalAmount,
                paymentMethod: $validated['payment_method'],
                category: 'مبيعات سابقة / رصيد إفتتاحي',
                description: "مبيعات سابقة رقم {$invNo}" . ($client ? " للعميل ({$client->name})" : ''),
                sourceType: SalesInvoice::class,
                sourceId: $invoice->id,
                referenceNumber: $invNo,
                transactionDate: $validated['revenue_date'],
                userId: $user
            );

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

        foreach ($paginator->items() as $client) {
            $client->recalculateDebt();
        }

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

        return DB::transaction(function () use ($client, $validated, $request) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            $paymentAmount = (float) $validated['amount'];

            // 1. Create ClientPayment record
            $payment = ClientPayment::create([
                'client_id' => $client->id,
                'amount' => $paymentAmount,
                'payment_date' => $validated['payment_date'],
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? 'سداد دفعة من حساب العميل',
                'receipt_path' => $receiptPath,
                'created_by' => $user,
            ]);

            // 2. Record Treasury Inflow
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

            // 3. Recalculate Client live debt
            $client->recalculateDebt();

            return response()->json([
                'message' => 'تم تسجيل سداد الدفعة للعميل بنجاح وتحديث الخزينة وحساب العميل.',
                'payment' => $payment,
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

        // 1. Invoices
        $invoices = SalesInvoice::where('client_id', $id)->with('items.product')->get()->map(function ($inv) {
            return [
                'id' => 'inv-' . $inv->id,
                'type' => 'invoice',
                'number' => $inv->invoice_number,
                'amount' => (float) $inv->total_amount,
                'paid_amount' => (float) $inv->paid_amount,
                'remaining_amount' => (float) $inv->remaining_amount,
                'date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
                'category' => 'فاتورة مبيعات',
                'description' => $inv->notes ?: 'فاتورة مبيعات رقم ' . $inv->invoice_number,
                'payment_method' => $inv->paid_amount > 0 ? $inv->payment_method : '-',
                'items_summary' => $inv->items->map(fn($i) => [
                    'name' => $i->product->name ?? 'منتج',
                    'quantity' => (float) $i->quantity,
                    'unit' => $i->product->unit ?? 'وحدة',
                    'unit_cost' => (float) $i->unit_sale_price,
                    'total_cost' => (float) $i->total_sale_price,
                ]),
            ];
        })->toArray();

        // 2. Direct client payments
        $payments = ClientPayment::where('client_id', $id)->get()->map(function ($p) {
            return [
                'id' => 'pay-' . $p->id,
                'type' => 'payment',
                'number' => $p->payment_number,
                'amount' => (float) $p->amount,
                'date' => $p->payment_date ? (is_string($p->payment_date) ? substr($p->payment_date, 0, 10) : $p->payment_date->format('Y-m-d')) : '',
                'category' => 'سداد دفعة عميل',
                'description' => $p->notes ?: 'سداد دفعة نقدية',
                'payment_method' => $p->payment_method ?: 'cash',
                'receipt_path' => $p->receipt_path,
                'items_summary' => [],
            ];
        })->toArray();

        // 3. Uninvoiced Active Operations (Pending/In Production/Completed/Delivered)
        $invoicedOpIds = SalesInvoice::where('client_id', $id)->whereNotNull('operation_id')->pluck('operation_id')->toArray();
        $opPayments = [];
        $operations = \App\Models\Operation::where('client_id', $id)
            ->whereNotIn('id', $invoicedOpIds)
            ->whereNotIn('status', ['Cancelled'])
            ->with(['operationProducts.product', 'payments'])
            ->get()
            ->map(function ($op) use (&$opPayments) {
                $dStr = $op->created_at ? $op->created_at->format('Y-m-d') : date('Y-m-d');
                $totalPrice = (float) ($op->total_price ?? 0);
                $depositPaid = (float) ($op->deposit_paid ?? 0);
                $stagePaid = (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                $totalPaid = $depositPaid + $stagePaid;

                // Map stage payments as children
                if ($op->payments) {
                    foreach ($op->payments as $pmt) {
                        $pDate = $pmt->payment_date ? (is_string($pmt->payment_date) ? substr($pmt->payment_date, 0, 10) : $pmt->payment_date->format('Y-m-d')) : $dStr;
                        $opPayments[] = [
                            'id' => 'op-pay-' . $pmt->id,
                            'type' => 'payment',
                            'number' => $op->operation_number,
                            'amount' => (float) $pmt->amount_paid,
                            'date' => $pDate,
                            'category' => 'تسديد دفعة مرحلية',
                            'description' => "دفعة على أمر تشغيل ({$op->operation_number})" . ($pmt->notes ? " - {$pmt->notes}" : ''),
                            'payment_method' => $pmt->payment_method ?: 'cash',
                            'receipt_path' => $pmt->receipt_path,
                            'items_summary' => [],
                        ];
                    }
                }

                if ($depositPaid > 0) {
                    $opPayments[] = [
                        'id' => 'op-dep-' . $op->id,
                        'type' => 'payment',
                        'number' => $op->operation_number,
                        'amount' => $depositPaid,
                        'date' => $dStr,
                        'category' => 'دفعة عربون / مقدم',
                        'description' => "دفعة عربون عند إنشاء أمر التشغيل {$op->operation_number}",
                        'payment_method' => $op->deposit_payment_method ?: 'cash',
                        'receipt_path' => null,
                        'items_summary' => [],
                    ];
                }

                return [
                    'id' => 'op-' . $op->id,
                    'type' => 'production_order',
                    'number' => $op->operation_number,
                    'amount' => $totalPrice,
                    'paid_amount' => $totalPaid,
                    'date' => $dStr,
                    'category' => 'أمر تشغيل وإنتاج',
                    'description' => "أمر تشغيل رقم {$op->operation_number} - الحالة: {$op->status}",
                    'payment_method' => $depositPaid > 0 ? ($op->deposit_payment_method ?? 'نقدي') : '-',
                    'items_summary' => $op->operationProducts->map(fn($opP) => [
                        'name' => $opP->product->name ?? 'منتج',
                        'quantity' => (float) $opP->quantity,
                        'unit' => $opP->product->unit ?? 'وحدة',
                        'unit_cost' => (float) ($opP->product->sale_price ?? 0),
                        'total_cost' => (float) (($opP->quantity) * ($opP->product->sale_price ?? 0)),
                    ]),
                ];
            })->toArray();

        $merged = array_merge($invoices, $payments, $operations, $opPayments);
        usort($merged, function ($a, $b) {
            return strcmp($b['date'], $a['date']);
        });

        return response()->json($merged);
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

        return [
            'id' => $inv->id,
            'type' => 'invoice',
            'revenue_number' => $inv->invoice_number,
            'invoice_number' => $inv->invoice_number,
            'amount' => (float) $inv->total_amount,
            'total_amount' => (float) $inv->total_amount,
            'cogs' => (float) $inv->total_cogs,
            'product_cost' => (float) $inv->total_cogs,
            'paid_amount' => (float) $inv->paid_amount,
            'remaining_amount' => (float) $inv->remaining_amount,
            'revenue_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
            'invoice_date' => $inv->invoice_date ? $inv->invoice_date->format('Y-m-d') : '',
            'category' => $inv->invoice_type === 'historical_opening' ? 'مبيعات سابقة / رصيد إفتتاحي' : 'مبيعات منتجات جاهزة',
            'description' => $desc,
            'payment_method' => $inv->payment_method,
            'client_id' => $inv->client_id,
            'client_name' => $inv->client->name ?? '',
            'items' => $itemsArr,
            'created_at' => $inv->created_at ? $inv->created_at->toISOString() : '',
        ];
    }
}
