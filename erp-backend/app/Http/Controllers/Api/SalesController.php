<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Product;
use App\Services\TreasuryService;
use App\Services\SalesService;
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

        // Auto-synchronize any unallocated client payments to open unpaid invoices
        if (Schema::hasTable('client_payments')) {
            $unallocatedClientIds = ClientPayment::whereNull('operation_id')
                ->whereNull('sales_invoice_id')
                ->pluck('client_id')
                ->filter()
                ->unique();

            if ($unallocatedClientIds->isNotEmpty()) {
                foreach (Client::whereIn('id', $unallocatedClientIds)->get() as $c) {
                    $c->recalculateDebt();
                }
            }
        }

        $query = SalesInvoice::with(['client', 'items.product', 'items.material', 'operation'])->orderBy('invoice_date', 'desc')->orderBy('id', 'desc');

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
     * Update an existing sales invoice (Revert Old -> Apply New).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $cleanId = str_replace('inv-', '', $id);
        $invoice = SalesInvoice::with(['items', 'client', 'payments'])->findOrFail($cleanId);

        if ($invoice->invoice_type !== 'direct_sale' && $invoice->invoice_type !== 'historical_opening') {
            return response()->json(['message' => 'لا يمكن تعديل فواتير أوامر الإنتاج من هذه الواجهة. قم بتعديل أمر الإنتاج نفسه.'], 400);
        }

        $validated = $request->validate([
            'client_id' => 'nullable|exists:clients,id',
            'invoice_date' => 'required|date',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'paid_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'warehouse_id' => 'nullable|exists:warehouses,id',

            // Multi items payload
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|required_without:items.*.material_id|exists:products,id',
            'items.*.material_id' => 'nullable|required_without:items.*.product_id|exists:materials,id',
            'items.*.item_type' => 'nullable|string|in:product,material',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_sale_price' => 'required|numeric|min:0',
        ]);

        try {
            DB::transaction(function () use ($invoice, $validated) {
                // 1. Revert Old
                // Revert Inventory for each item (if direct sale)
                if ($invoice->invoice_type === 'direct_sale') {
                    foreach ($invoice->items as $item) {
                        $movement = \App\Models\InventoryMovement::where('reference_number', $invoice->invoice_number)
                            ->where('movement_type', 'Sales_Issue')
                            ->where('product_id', $item->product_id)
                            ->where('material_id', $item->material_id)
                            ->first();
                        $warehouseId = $movement ? $movement->warehouse_id : 1;

                        InventoryService::recordMovement(
                            warehouseId: $warehouseId,
                            materialId: $item->item_type === 'material' ? ($item->material_id ?? $item->product_id) : null,
                            productId: $item->item_type === 'material' ? null : $item->product_id,
                            movementType: 'Sales_Return',
                            quantity: (float) $item->quantity,
                            unitCost: $item->unit_cost,
                            referenceNumber: 'RET-' . $invoice->invoice_number,
                            notes: "تعديل فاتورة مبيعات {$invoice->invoice_number} وإرجاع المخزون القديم مؤقتاً",
                            movementDate: now()->toDateTimeString(),
                            userId: auth()->id()
                        );
                    }
                }

                // Revert initial treasury inflow linked to the invoice directly
                TreasuryService::revertBySource(SalesInvoice::class, $invoice->id);

                // Note: We intentionally do NOT delete `ClientPayment` rows that were added later by the user.
                // We only recalculate remaining balance. 
                $invoice->items()->delete();

                // 2 & 3. Apply New (Similar to store logic but applied to existing invoice)
                $user = auth()->id();
                $client = !empty($validated['client_id']) ? Client::find($validated['client_id']) : null;
                $isHistorical = $invoice->invoice_type === 'historical_opening';

                $whProd = \App\Models\Warehouse::productsWarehouse();
                $defaultProdWhId = $whProd ? $whProd->id : (\App\Models\Warehouse::first() ? \App\Models\Warehouse::first()->id : 1);
                $whRaw = \App\Models\Warehouse::rawMaterialsWarehouse();
                $rawWhId = $whRaw ? $whRaw->id : $defaultProdWhId;

            // Validate stock availability for all items if direct_sale
            if (!$isHistorical) {
                foreach ($validated['items'] as $item) {
                    $itemType = !empty($item['item_type']) ? ($item['item_type'] === 'material' ? 'material' : 'product') : (!empty($item['material_id']) ? 'material' : 'product');
                    $qty = (float) $item['quantity'];
                    $warehouseId = $itemType === 'material' ? ($validated['warehouse_id'] ?? $rawWhId) : ($validated['warehouse_id'] ?? $defaultProdWhId);

                    if ($itemType === 'material') {
                        $material = \App\Models\Material::findOrFail($item['material_id'] ?? $item['product_id']);
                        if ($material->type === 'service') {
                            throw new \InvalidArgumentException("لا يمكن بيع الخدمة ({$material->name}) من المخزون.");
                        }
                        $available = InventoryService::getStock('material', $material->id, $warehouseId);
                        $uName = $material->unit ?: 'وحدة';
                        $name = $material->name;
                    } else {
                        $product = \App\Models\Product::findOrFail($item['product_id']);
                        $available = InventoryService::getStock('product', $product->id, $warehouseId);
                        $uName = $product->unit ?: 'وحدة';
                        $name = $product->name;
                    }

                    if ($available < $qty) {
                        throw new \InvalidArgumentException("المخزون المتوفر من ({$name}) غير كافٍ لتعديل الفاتورة. المتوفر: {$available} {$uName}، المطلوب: {$qty} {$uName}.");
                    }
                }
            }

                $totalAmount = 0.0;
                $totalCogs = 0.0;
                $calculatedItems = [];

                foreach ($validated['items'] as $item) {
                    $itemType = !empty($item['item_type']) ? ($item['item_type'] === 'material' ? 'material' : 'product') : (!empty($item['material_id']) ? 'material' : 'product');
                    $qty = (float) $item['quantity'];
                    $unitPrice = (float) $item['unit_sale_price'];
                    $warehouseId = $itemType === 'material' ? ($validated['warehouse_id'] ?? $rawWhId) : ($validated['warehouse_id'] ?? $defaultProdWhId);

                    if (!$isHistorical) {
                        $fifoConsumption = InventoryService::consumeFifoQuantity($itemType, $item[$itemType . '_id'] ?? $item['product_id'], $warehouseId, $qty);
                        if ($itemType === 'material') {
                            $model = \App\Models\Material::findOrFail($item['material_id'] ?? $item['product_id']);
                        } else {
                            $model = \App\Models\Product::findOrFail($item['product_id']);
                        }
                        $unitCost = $fifoConsumption['blended_unit_cost'] > 0 ? $fifoConsumption['blended_unit_cost'] : (float) $model->calculateStoredUnitCost($warehouseId);
                        $itemTotalCost = $fifoConsumption['total_cogs'] > 0 ? $fifoConsumption['total_cogs'] : round($qty * $unitCost, 2);
                    } else {
                        // Historical Sale
                        $model = \App\Models\Product::findOrFail($item['product_id']);
                        $unitCost = (float) $model->calculateStoredUnitCost();
                        $itemTotalCost = round($qty * $unitCost, 2);
                    }

                    $itemTotalSale = round($qty * $unitPrice, 2);
                    $totalAmount += $itemTotalSale;
                    $totalCogs += $itemTotalCost;

                    $calculatedItems[] = [
                        'item_type' => $itemType,
                        'model' => $model,
                        'quantity' => $qty,
                        'unit_sale_price' => $unitPrice,
                        'unit_cost' => $unitCost,
                        'total_sale_price' => $itemTotalSale,
                        'total_cost' => $itemTotalCost,
                    ];
                }

                // Check external payments on this invoice
                $externalPayments = $invoice->payments()->sum('amount') + $invoice->payments()->sum('deduction_amount');
                
                $initialPaidAmount = isset($validated['paid_amount']) ? (float) $validated['paid_amount'] : $totalAmount;
                // Total collected = initial deposit + subsequent payments
                $totalPaid = min($totalAmount, $initialPaidAmount + $externalPayments);
                $remainingAmount = max(0.0, round($totalAmount - $totalPaid, 2));

                if ($remainingAmount > 0 && !$client) {
                    throw new \InvalidArgumentException('لا يمكن تعديل الفاتورة لمتبقي آجلة بدون تحديد العميل.');
                }

                // Update Invoice
                $invoice->update([
                    'invoice_date' => $validated['invoice_date'] ?? $invoice->invoice_date,
                    'client_id' => $client?->id,
                    'total_amount' => $totalAmount,
                    'total_cogs' => $totalCogs,
                    'paid_amount' => $totalPaid,
                    'remaining_amount' => $remainingAmount,
                    'payment_method' => $validated['payment_method'],
                    'notes' => $validated['notes'] ?? $invoice->notes,
                ]);

                // Create new items & issue stock
                foreach ($calculatedItems as $cItem) {
                    $isMaterial = $cItem['item_type'] === 'material';

                    SalesInvoiceItem::create([
                        'sales_invoice_id' => $invoice->id,
                        'product_id' => $isMaterial ? null : $cItem['model']->id,
                        'material_id' => $isMaterial ? $cItem['model']->id : null,
                        'item_type' => $cItem['item_type'],
                        'quantity' => $cItem['quantity'],
                        'unit_sale_price' => $cItem['unit_sale_price'],
                        'unit_cost' => $cItem['unit_cost'],
                        'total_sale_price' => $cItem['total_sale_price'],
                        'total_cost' => $cItem['total_cost'],
                    ]);

                    if (!$isHistorical) {
                        InventoryService::recordMovement(
                            warehouseId: $isMaterial ? ($validated['warehouse_id'] ?? $rawWhId) : ($validated['warehouse_id'] ?? $defaultProdWhId),
                            materialId: $isMaterial ? $cItem['model']->id : null,
                            productId: $isMaterial ? null : $cItem['model']->id,
                            movementType: 'Sales_Issue',
                            quantity: $cItem['quantity'],
                            unitCost: $cItem['unit_cost'],
                            referenceNumber: $invoice->invoice_number,
                            notes: "مبيعات للعميل (" . ($client ? $client->name : 'عميل نقدي') . ") - فاتورة معدلة {$invoice->invoice_number}",
                            movementDate: $validated['invoice_date'] ?? $invoice->invoice_date,
                            userId: $user
                        );
                    }
                }

                // Record new treasury inflow for the initial paid amount
                if ($initialPaidAmount > 0) {
                    if (!$isHistorical) {
                        TreasuryService::recordInflow(
                            amount: $initialPaidAmount,
                            paymentMethod: $validated['payment_method'],
                            category: 'مبيعات منتجات جاهزة',
                            description: "تحصيل فاتورة مبيعات معدلة رقم {$invoice->invoice_number}" . ($client ? " - العميل: {$client->name}" : ''),
                            sourceType: SalesInvoice::class,
                            sourceId: $invoice->id,
                            referenceNumber: $invoice->invoice_number,
                            transactionDate: $validated['invoice_date'] ?? $invoice->invoice_date,
                            userId: $user
                        );
                    } else {
                        // Historical Sale Treasury Formula
                        $netProfit = round($totalAmount - $totalCogs, 2);
                        $treasuryInflow = round($netProfit - $remainingAmount, 2);
                        if ($treasuryInflow > 0) {
                            TreasuryService::recordInflow(
                                amount: $treasuryInflow,
                                paymentMethod: $validated['payment_method'],
                                category: 'مبيعات سابقة / رصيد إفتتاحي',
                                description: "أرباح مبيعات سابقة معدلة رقم {$invoice->invoice_number} (تم التحصيل الجزئي أو الكلي)" . ($client ? " للعميل ({$client->name})" : ''),
                                sourceType: SalesInvoice::class,
                                sourceId: $invoice->id,
                                referenceNumber: $invoice->invoice_number,
                                transactionDate: $validated['invoice_date'] ?? $invoice->invoice_date,
                                userId: $user
                            );
                        } elseif ($treasuryInflow < 0) {
                            TreasuryService::recordOutflow(
                                amount: abs($treasuryInflow),
                                paymentMethod: $validated['payment_method'],
                                category: 'مبيعات سابقة / رصيد إفتتاحي',
                                description: "تسوية أرباح مبيعات سابقة معدلة رقم {$invoice->invoice_number} (قيمة سالبة)" . ($client ? " للعميل ({$client->name})" : ''),
                                sourceType: SalesInvoice::class,
                                sourceId: $invoice->id,
                                referenceNumber: $invoice->invoice_number,
                                transactionDate: $validated['invoice_date'] ?? $invoice->invoice_date,
                                userId: $user
                            );
                        }
                    }
                }

                // Recalculate old client debt if client changed
                $oldClientId = $invoice->getOriginal('client_id');
                if ($oldClientId && $oldClientId != $client?->id) {
                    Client::find($oldClientId)?->recalculateDebt();
                }

                // Recalculate new client debt
                if ($client) {
                    $client->recalculateDebt();
                }
            });

            return response()->json([
                'message' => 'تم تعديل الفاتورة وتحديث المخزون والخزينة بنجاح.',
                'invoice' => $this->formatInvoice($invoice->fresh(['client', 'items.product'])),
            ]);

        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        } catch (\Exception $e) {
            \Log::error('Update Invoice Error: ' . $e->getMessage());
            return response()->json(['message' => 'حدث خطأ أثناء تعديل الفاتورة. الرجاء المحاولة مرة أخرى.'], 500);
        }
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
            'items.*.product_id' => 'nullable|required_without:items.*.material_id|exists:products,id',
            'items.*.material_id' => 'nullable|required_without:items.*.product_id|exists:materials,id',
            'items.*.item_type' => 'nullable|string|in:product,material',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_sale_price' => 'required|numeric|min:0',
        ]);

        try {
            $invoice = SalesService::createDirectSale($validated);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        return response()->json([
            'message' => 'تم إصدار فاتورة المبيعات بنجاح، وخصم المخزن، وتسجيل الإيراد في الخزينة.',
            'invoice' => $this->formatInvoice($invoice->load(['client', 'items.product'])),
        ], 201);
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
            'paid_amount' => 'nullable|numeric|min:0',
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

            $paidAmount = isset($validated['paid_amount']) ? min($totalAmount, (float) $validated['paid_amount']) : $totalAmount;
            $remainingAmount = max(0.0, round($totalAmount - $paidAmount, 2));

            $invNo = SalesInvoice::generateNextInvoiceNumber('HIST');
            $invoice = SalesInvoice::create([
                'invoice_number' => $invNo,
                'invoice_date' => $validated['revenue_date'],
                'client_id' => $client?->id,
                'invoice_type' => 'historical_opening',
                'total_amount' => $totalAmount,
                'total_cogs' => $totalCogs,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
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

            if ($client) {
                $client->recalculateDebt();
            }

            // Log Treasury Inflow based on formula: treasury_inflow = net_profit - remaining_amount
            $netProfit = round($totalAmount - $totalCogs, 2);
            $treasuryInflow = round($netProfit - $remainingAmount, 2);

            if ($paidAmount > 0) {
                if ($treasuryInflow > 0) {
                    TreasuryService::recordInflow(
                        amount: $treasuryInflow,
                        paymentMethod: $validated['payment_method'],
                        category: 'مبيعات سابقة / رصيد إفتتاحي',
                        description: "أرباح مبيعات سابقة رقم {$invNo} (تم التحصيل الجزئي أو الكلي)" . ($client ? " للعميل ({$client->name})" : ''),
                        sourceType: SalesInvoice::class,
                        sourceId: $invoice->id,
                        referenceNumber: $invNo,
                        transactionDate: $validated['revenue_date'],
                        userId: $user
                    );
                } elseif ($treasuryInflow < 0) {
                    TreasuryService::recordOutflow(
                        amount: abs($treasuryInflow),
                        paymentMethod: $validated['payment_method'],
                        category: 'مبيعات سابقة / رصيد إفتتاحي',
                        description: "تسوية أرباح مبيعات سابقة رقم {$invNo} (قيمة سالبة)" . ($client ? " للعميل ({$client->name})" : ''),
                        sourceType: SalesInvoice::class,
                        sourceId: $invoice->id,
                        referenceNumber: $invNo,
                        transactionDate: $validated['revenue_date'],
                        userId: $user
                    );
                }
            }

            return response()->json([
                'message' => 'تم تسجيل المبيعات السابقة بنجاح وإدراجها في الخزينة وقائمة الدخل بدقة.',
            'invoice' => $this->formatInvoice($invoice->load(['client', 'items.product', 'items.material'])),
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
            'deduction' => 'nullable|numeric|min:0',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'payment_date' => 'required|date',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'notes' => 'nullable|string',
        ]);

        $paymentAmount = (float) $validated['amount'];
        $deductionAmount = (float) ($validated['deduction'] ?? 0);

        // Deduction can never exceed what remains unpaid after the cash portion
        $currentDebt = $client->recalculateDebt();
        if ($deductionAmount > 0 && round($paymentAmount + $deductionAmount, 2) > round((float) $currentDebt + 0.001, 2)) {
            return response()->json([
                'message' => "قيمة الخصم أكبر من المتبقي على العميل. المتبقي الحالي: {$currentDebt}",
            ], 422);
        }

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

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $path = $request->file('receipt')->store('receipts', 'public');
            $receiptPath = '/storage/' . $path;
        }

        $result = SalesService::payClientDebt(
            $client,
            $validated,
            $receiptPath,
            $request->input('sales_invoice_id'),
        );

        return response()->json([
            'message' => 'تم تسجيل سداد الدفعة للعميل بنجاح وتحديث الخزينة وحساب العميل.',
            'payment' => $result['payment'],
            'client' => $result['client'],
        ]);
    }

    /**
     * Delete/Undo Sales Invoice.
     */
    public function destroy(string $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $cleanId = str_replace('inv-', '', $id);
            $invoice = SalesInvoice::with(['items', 'payments', 'client', 'operation'])->findOrFail($cleanId);

            // 1. Restore inventory — hard erase for ALL invoice types.
            // Delete the original Sales_Issue movement record entirely (no reversal entry).
            // This leaves zero trace of the sale in the movements log.
            foreach ($invoice->items as $item) {
                $originalMovement = \App\Models\InventoryMovement::where('reference_number', $invoice->invoice_number)
                    ->where('movement_type', 'Sales_Issue')
                    ->where('product_id', $item->product_id)
                    ->where('material_id', $item->material_id)
                    ->first();

                if ($originalMovement) {
                    $materialId = $originalMovement->material_id;
                    $productId  = $originalMovement->product_id;
                    $originalMovement->delete();
                    // Re-sync cached stock_quantity from live movement sum
                    InventoryService::syncCachedStock($materialId, $productId);
                }
            }

            // 2. Revert treasury inflow
            TreasuryService::revertBySource(SalesInvoice::class, $invoice->id);

            // Revert payments linked to this invoice if any exist to clear treasury
            foreach ($invoice->payments as $payment) {
                TreasuryService::revertBySource(ClientPayment::class, $payment->id);
                $payment->delete();
            }

            // 3. Restore operation status to Completed if linked
            if ($invoice->operation_id && $invoice->operation) {
                $invoice->operation->status = 'Completed';
                $invoice->operation->delivered_at = null;
                $invoice->operation->save();
            }

            $client = $invoice->client ? clone $invoice->client : null;

            // 4 & 5. Delete invoice & items
            $invoice->items()->delete();
            $invoice->delete();

            // Recalculate client debt
            if ($client) {
                $client->recalculateDebt();
            }

            return response()->json(['message' => 'تم حذف فاتورة المبيعات وإلغاء القيود المتعلقة بها بنجاح.']);
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
            // Deduction is stored on the payment row itself — deleting it removes both
            $totalReduction = round((float) $payment->amount + (float) ($payment->deduction_amount ?? 0), 2);

            // Revert linked invoice paid/remaining amount if applicable
            if ($payment->sales_invoice_id) {
                $inv = SalesInvoice::find($payment->sales_invoice_id);
                if ($inv) {
                    $inv->paid_amount = max(0.0, (float)$inv->paid_amount - $totalReduction);
                    $inv->remaining_amount = min((float)$inv->total_amount, (float)$inv->remaining_amount + $totalReduction);
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
                    ->with(['items.product', 'items.material', 'payments'])
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
                        // paid_amount includes deductions — sum cash + deduction together
                        $linkedPaymentsSum = (float) ClientPayment::where('sales_invoice_id', $inv->id)
                            ->selectRaw('COALESCE(SUM(amount + deduction_amount), 0) as s')
                            ->value('s');
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
                    $deductionAmt = (float) ($p->deduction_amount ?? 0);
                    $isDeposit = (bool)($p->operation_id || str_contains($p->notes ?? '', 'عربون'));

                    return [
                        'id' => 'pay-' . $p->id,
                        'type' => 'payment',
                        'is_payment' => true,
                        'is_deposit' => $isDeposit && $deductionAmt <= 0,
                        'is_deduction' => $deductionAmt > 0,
                        'number' => $p->reference_number ?: $p->payment_number,
                        'reference_number' => $p->reference_number ?: $p->payment_number,
                        'sales_invoice_id' => $targetInvId ? 'inv-' . $targetInvId : null,
                        'operation_id' => $p->operation_id ? 'op-' . $p->operation_id : null,
                        'parent_id' => $parentId,
                        'amount' => (float) $p->amount,
                        'deduction_amount' => $deductionAmt,
                        'total_amount' => (float) $p->amount,
                        'date' => $dStr,
                        'created_at' => $p->created_at ? $p->created_at->toIso8601String() : $dStr,
                        'category' => $deductionAmt > 0
                            ? 'سداد مع خصم / حسم'
                            : ($isDeposit ? 'دفعة عربون مقدم' : 'سداد دفعة عميل'),
                        'description' => $deductionAmt > 0
                            ? 'سداد دفعة مع خصم/حسم بقيمة ' . number_format($deductionAmt, 2) . ' — مقبوض نقداً: ' . number_format((float) $p->amount, 2)
                            : ($p->notes ?: 'سداد دفعة نقدية'),
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
        if (Schema::hasTable('operations')) {
            try {
                $invoicedOpIds = [];
                if (Schema::hasTable('sales_invoices')) {
                    $invoicedOpIds = SalesInvoice::where('client_id', $id)
                        ->whereNotNull('operation_id')
                        ->pluck('operation_id')
                        ->toArray();
                }

                $rawOps = \App\Models\Operation::where('client_id', $id)
                    ->whereNotIn('status', ['Cancelled', 'cancelled'])
                    ->whereNotIn('id', $invoicedOpIds)
                    ->with(['operationProducts.product'])
                    ->get();

                foreach ($rawOps as $op) {
                    $dStr = $op->start_date
                        ? (is_string($op->start_date) ? substr($op->start_date, 0, 10) : $op->start_date->format('Y-m-d'))
                        : ($op->created_at ? $op->created_at->format('Y-m-d') : '');
                    $totalPrice = (float) $op->total_price;
                    $depositPaid = (float) ($op->deposit_paid ?? 0);

                    // Build items summary — OperationProduct has no unit_price, so distribute total_price
                    $opProducts = $op->operationProducts;
                    $itemsCount = $opProducts->count();
                    $itemsSummary = $opProducts->map(function ($i) use ($totalPrice, $itemsCount) {
                        $qty = (float) $i->quantity;
                        // Split the total order price evenly across products if no per-item price exists
                        $itemTotal = $itemsCount > 0 ? round($totalPrice / $itemsCount, 2) : 0;
                        $unitPrice = $qty > 0 ? round($itemTotal / $qty, 2) : 0;
                        return [
                            'name'       => $i->product->name ?? 'منتج',
                            'quantity'   => $qty,
                            'unit'       => $i->product->unit ?? 'قطعة',
                            'unit_cost'  => $unitPrice,
                            'total_cost' => $itemTotal,
                        ];
                    })->values()->toArray();

                    $operations[] = [
                        'id'                   => 'op-' . $op->id,
                        'type'                 => 'production_order',
                        'is_payment'           => false,
                        'is_deposit'           => false,
                        'number'               => $op->operation_number,
                        'reference_number'     => $op->operation_number,
                        'amount'               => $totalPrice,
                        'total_amount'         => $totalPrice,
                        'deposit_paid'         => $depositPaid,
                        'date'                 => $dStr,
                        'created_at'           => $op->created_at ? $op->created_at->toIso8601String() : $dStr,
                        'category'             => 'أمر تشغيل وإنتاج',
                        'description'          => $op->notes ?: ('أمر تشغيل وإنتاج رقم ' . $op->operation_number),
                        'payment_method'       => $op->deposit_payment_method ?? 'cash',
                        'payment_status_label' => $op->status,
                        'remaining_amount'     => max(0, $totalPrice - $depositPaid),
                        'items_summary'        => $itemsSummary,
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
        // Start from opening_balance
        $runningDebt = (float) ($client->opening_balance ?? 0.0);
        foreach ($merged as &$tx) {
            $amt = (float)($tx['amount'] ?? 0);
            if (!empty($tx['is_payment'])) {
                // Deductions settle debt too (debt reduction = cash + deduction)
                $settleAmount = $amt + (float)($tx['deduction_amount'] ?? 0);
                $runningDebt = round($runningDebt - $settleAmount, 2);
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
            'opening_balance' => 'nullable|numeric',
        ]);

        $validated['debt_amount'] = $validated['debt_amount'] ?? 0;
        $validated['opening_balance'] = $validated['opening_balance'] ?? 0.00;
        $client = Client::create($validated);
        $client->recalculateDebt();

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
            'opening_balance' => 'nullable|numeric',
        ]);

        $validated['opening_balance'] = $validated['opening_balance'] ?? 0.00;
        $client->update($validated);
        $client->recalculateDebt();
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
            $isMaterial = ($item->item_type ?? 'product') === 'material';
            return [
                'id' => $item->id,
                'item_type' => $isMaterial ? 'material' : 'product',
                'product_id' => $item->product_id,
                'material_id' => $item->material_id,
                'product_name' => (!$isMaterial && $item->product) ? $item->product->name : ($isMaterial ? ($item->material->name ?? 'خامة') : 'صنف مباع'),
                'quantity' => (float) $item->quantity,
                'unit' => ($item->product->unit ?? null) ?: (($item->material->unit ?? null) ?: 'وحدة'),
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
        // paid_amount includes deductions — sum cash + deduction together
        $linkedPaymentsSum = (float) $linkedList->sum(fn ($p) => (float) $p->amount + (float) ($p->deduction_amount ?? 0));
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
            $pDeduction = (float) ($p->deduction_amount ?? 0);
            $paymentsArr[] = [
                'id' => $p->id,
                'payment_number' => $p->reference_number ?: $p->payment_number,
                'amount' => (float)$p->amount,
                'deduction_amount' => $pDeduction,
                'is_deduction' => $pDeduction > 0,
                'payment_date' => $p->payment_date ? (is_string($p->payment_date) ? substr($p->payment_date, 0, 10) : $p->payment_date->format('Y-m-d')) : '',
                'payment_method' => $p->payment_method ?: 'cash',
                'notes' => $pDeduction > 0
                    ? 'سداد مع خصم/حسم: ' . number_format($pDeduction, 2) . ' (مقبوض نقداً: ' . number_format((float) $p->amount, 2) . ')'
                    : ($p->notes ?: 'سداد دفعة من حساب العميل'),
            ];
        }

        return [
            'id' => $inv->id,
            'type' => 'invoice',
            'invoice_type' => $inv->invoice_type,
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

