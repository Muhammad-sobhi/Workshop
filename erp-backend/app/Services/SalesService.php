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
     * Supports both products (WSH-P) and raw materials (WSH-M) as invoice lines.
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

            // Resolve warehouses once
            $whProd = Warehouse::productsWarehouse();
            $defaultProdWhId = $whProd ? $whProd->id : (Warehouse::first() ? Warehouse::first()->id : 1);
            $whRaw = Warehouse::rawMaterialsWarehouse();
            $rawWhId = $whRaw ? $whRaw->id : $defaultProdWhId;

            // Validate stock availability for all items (per item type & warehouse)
            foreach ($itemsData as $item) {
                $itemType = self::resolveItemType($item);
                $qty = (float) $item['quantity'];
                $warehouseId = $itemType === 'material' ? ($validated['warehouse_id'] ?? $rawWhId) : ($validated['warehouse_id'] ?? $defaultProdWhId);

                if ($itemType === 'material') {
                    $material = \App\Models\Material::findOrFail($item['material_id']);
                    if ($material->type === 'service') {
                        throw new \InvalidArgumentException("لا يمكن بيع الخدمة ({$material->name}) من المخزون.");
                    }
                    $available = InventoryService::getStock('material', $material->id, $warehouseId);
                    $uName = $material->unit ?: 'وحدة';
                    $name = $material->name;
                } else {
                    $product = Product::findOrFail($item['product_id']);
                    $available = InventoryService::getStock('product', $product->id, $warehouseId);
                    $uName = $product->unit ?: 'وحدة';
                    $name = $product->name;
                }

                if ($available < $qty) {
                    throw new \InvalidArgumentException("عذراً، المخزون المتوفر من ({$name}) غير كافٍ. المتوفر: {$available} {$uName}، المطلوب: {$qty} {$uName}.");
                }
            }

            // Calculate totals
            $totalAmount = 0.0;
            $totalCogs = 0.0;
            $calculatedItems = [];

            foreach ($itemsData as $item) {
                $itemType = self::resolveItemType($item);
                $qty = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_sale_price'];
                $warehouseId = $itemType === 'material' ? ($validated['warehouse_id'] ?? $rawWhId) : ($validated['warehouse_id'] ?? $defaultProdWhId);

                $fifoConsumption = InventoryService::consumeFifoQuantity($itemType, $item[$itemType . '_id'], $warehouseId, $qty);

                if ($itemType === 'material') {
                    $model = \App\Models\Material::findOrFail($item['material_id']);
                } else {
                    $model = Product::findOrFail($item['product_id']);
                }

                $unitCost = $fifoConsumption['blended_unit_cost'] > 0
                    ? $fifoConsumption['blended_unit_cost']
                    : (float) $model->calculateStoredUnitCost($warehouseId);
                $itemTotalCost = $fifoConsumption['total_cogs'] > 0
                    ? $fifoConsumption['total_cogs']
                    : round($qty * $unitCost, 2);

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

            $paidAmount = isset($validated['paid_amount']) ? (float) $validated['paid_amount'] : $totalAmount;
            $paidAmount = min($paidAmount, $totalAmount);
            $remainingAmount = max(0.0, round($totalAmount - $paidAmount, 2));

            // Enforce a debtor for credit sales (no orphaned receivables)
            if ($remainingAmount > 0 && !$client) {
                throw new \InvalidArgumentException('لا يمكن إصدار فاتورة آجلة (بمتبقي) بدون تحديد العميل.');
            }

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

                // Record outgoing inventory movement
                InventoryService::recordMovement(
                    warehouseId: $isMaterial
                        ? ($validated['warehouse_id'] ?? ($whRaw ? $whRaw->id : $defaultProdWhId))
                        : ($validated['warehouse_id'] ?? $defaultProdWhId),
                    materialId: $isMaterial ? $cItem['model']->id : null,
                    productId: $isMaterial ? null : $cItem['model']->id,
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
     * Determine the item type of a sale line: 'material' or 'product'.
     */
    private static function resolveItemType(array $item): string
    {
        if (!empty($item['item_type'])) {
            return $item['item_type'] === 'material' ? 'material' : 'product';
        }
        return !empty($item['material_id']) ? 'material' : 'product';
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
            $deductionAmount = (float) ($validated['deduction'] ?? 0);
            // Debt is reduced by cash + deduction; treasury receives cash only
            $totalReduction = round($paymentAmount + $deductionAmount, 2);

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
                'deduction_amount' => $deductionAmount,
                'payment_date' => $validated['payment_date'],
                'payment_method' => $validated['payment_method'],
                'notes' => ($validated['notes'] ?? 'سداد دفعة من حساب العميل') . ($deductionAmount > 0 ? " - خصم/حسم: {$deductionAmount}" : ''),
                'receipt_path' => $receiptPath,
                'sales_invoice_id' => $targetInvoiceId,
                'created_by' => $user,
            ]);

            // 2. Synchronize payment with the client's sales invoice(s)
            if ($targetInvoiceId) {
                $targetInv = SalesInvoice::find($targetInvoiceId);
                if ($targetInv) {
                    $targetInv->paid_amount = min((float)$targetInv->total_amount, (float)$targetInv->paid_amount + $totalReduction);
                    $targetInv->remaining_amount = max(0.0, (float)$targetInv->total_amount - (float)$targetInv->paid_amount);
                    $targetInv->save();
                }
            } else {
                // If no specific invoice was requested, allocate the reduction to open unpaid invoices (FIFO: oldest first)
                $openInvoices = SalesInvoice::where('client_id', $client->id)
                    ->where('remaining_amount', '>', 0)
                    ->orderBy('invoice_date', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();

                $remainingToAllocate = $totalReduction;
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
