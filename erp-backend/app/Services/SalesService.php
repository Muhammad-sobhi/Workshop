<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;

class SalesService
{
    /**
     * Create a direct sale invoice: validate stock, consume FIFO cost,
     * persist invoice/items/movements, record treasury inflow and sync client debt.
     */
    public static function createDirectSale(array $validated): SalesInvoice
    {
        return DB::transaction(function () use ($validated) {
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
                throw new \InvalidArgumentException('يجب تحديد صنف واحد على الأقل لإصدار الفاتورة.');
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
                    throw new \InvalidArgumentException("عذراً، المخزون المتوفر من ({$product->name}) غير كافٍ. المتوفر: {$available} {$uName}، المطلوب: {$qty} {$uName}.");
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

            return $invoice;
        });
    }

    /**
     * Record a client debt payment: allocate across invoices, record
     * treasury inflow and recalculate live client debt.
     */
    public static function payClientDebt(Client $client, array $validated, ?string $receiptPath = null, ?int $salesInvoiceId = null): array
    {
        return DB::transaction(function () use ($client, $validated, $receiptPath, $salesInvoiceId) {
            $user = auth()->id();
            $paymentAmount = (float) $validated['amount'];

            // Check if specific sales invoice was passed or extract from notes
            $targetInvoiceId = $salesInvoiceId;
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

            return [
                'payment' => $payment,
                'client' => $client->fresh(),
            ];
        });
    }
}
