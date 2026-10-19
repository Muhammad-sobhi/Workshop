<?php

namespace App\Console\Commands;

use App\Models\InventoryMovement;
use App\Models\Operation;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Before the fix, a client order for a product with no raw materials / sub-products in its BOM
 * was "manufactured" without issuing anything: the Production_Receipt created stock out of
 * nothing, while the purchased stock in the products warehouse stayed untouched.
 *
 * Repair: the units really came from the products warehouse, so the phantom receipt becomes a
 * Transfer_In (at FIFO cost) matched by a Transfer_Out from the products warehouse. If the order
 * was already delivered, its Sales_Issue and delivery-invoice cost are updated to that FIFO cost.
 */
class FixPhantomProduction extends Command
{
    protected $signature = 'operations:fix-phantom-production
                            {--dry-run : Show the changes without writing them}';

    protected $description = 'Replace production receipts of products without a BOM with transfers from the products warehouse';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) {
            $this->warn('--- DRY RUN: nothing will be written ---');
        }

        $prodWh = Warehouse::productsWarehouse();
        if (!$prodWh) {
            $this->error('Products warehouse not found.');
            return self::FAILURE;
        }

        $receipts = InventoryMovement::where('movement_type', 'Production_Receipt')
            ->whereNotNull('product_id')
            ->orderBy('id')
            ->get()
            ->filter(function ($r) {
                $product = Product::withTrashed()->with(['materials', 'bomItems'])->find($r->product_id);
                return $product && !$product->hasPhysicalBom();
            });

        if ($receipts->isEmpty()) {
            $this->info('No phantom production receipts found.');
            return self::SUCCESS;
        }

        $fixed = 0;
        foreach ($receipts as $receipt) {
            $product   = Product::withTrashed()->find($receipt->product_id);
            $operation = Operation::where('operation_number', $receipt->reference_number)->first();
            $qty       = (float) $receipt->quantity;

            $this->line(sprintf(
                '%s | %s | %s | qty %s | warehouse %d | client %s | status %s',
                $receipt->movement_number, $receipt->reference_number, $product->name,
                $qty, $receipt->warehouse_id, $operation?->client?->name ?? '-', $operation?->status ?? '?'
            ));

            if (in_array($operation?->status, ['Cancelled', 'cancelled'], true)) {
                $this->warn('  ! Operation is cancelled — review manually.');
                continue;
            }

            if ((int) $receipt->warehouse_id === (int) $prodWh->id) {
                $this->warn('  ! Stock order received into the products warehouse itself — no source stock to move; review manually.');
                continue;
            }

            $available = InventoryService::getStock('product', $product->id, $prodWh->id);
            if ($available < $qty) {
                $this->warn("  ! Products warehouse has only {$available} — cannot move {$qty}; review manually.");
                continue;
            }

            $fifo     = InventoryService::consumeFifoQuantity('product', $product->id, $prodWh->id, $qty);
            $unitCost = $fifo['blended_unit_cost'] > 0 ? $fifo['blended_unit_cost'] : (float) $product->unit_cost;
            $this->line(sprintf('  -> move %s from products warehouse at FIFO cost %.2f (receipt cost was %.2f)', $qty, $unitCost, (float) $receipt->unit_cost));

            $salesIssues = InventoryMovement::where('reference_number', $receipt->reference_number)
                ->where('movement_type', 'Sales_Issue')
                ->where('product_id', $product->id)
                ->where('warehouse_id', $receipt->warehouse_id)
                ->get();
            $invoice = $operation
                ? SalesInvoice::where('operation_id', $operation->id)->with('items')->first()
                : null;

            foreach ($salesIssues as $mv) {
                $this->line("  -> {$mv->movement_number} Sales_Issue cost " . (float) $mv->unit_cost . " -> {$unitCost}");
            }
            if ($invoice) {
                $this->line("  -> invoice {$invoice->invoice_number} cost of this product -> {$unitCost}");
            }

            if ($dryRun) {
                continue;
            }

            DB::transaction(function () use ($receipt, $product, $prodWh, $qty, $unitCost, $salesIssues, $invoice) {
                InventoryService::recordMovement(
                    warehouseId:     $prodWh->id,
                    materialId:      null,
                    productId:       $product->id,
                    movementType:    'Transfer_Out',
                    quantity:        $qty,
                    unitCost:        $unitCost,
                    referenceNumber: $receipt->reference_number,
                    notes:           "تصحيح: نقل منتج جاهز من المخزن لطلبية أمر {$receipt->reference_number} (كان مسجلاً كتصنيع بدون خامات)",
                    movementDate:    (string) $receipt->movement_date,
                );

                $receipt->update([
                    'movement_type' => 'Transfer_In',
                    'unit_cost'     => $unitCost,
                    'total_cost'    => round($qty * $unitCost, 2),
                    'notes'         => "تصحيح: استلام منتج جاهز من مخزن المنتجات لأمر {$receipt->reference_number} (كان: توريد إنتاج بدون خامات)",
                ]);

                foreach ($salesIssues as $mv) {
                    $mv->update([
                        'unit_cost'  => $unitCost,
                        'total_cost' => round((float) $mv->quantity * $unitCost, 2),
                    ]);
                }

                if ($invoice) {
                    foreach ($invoice->items->where('product_id', $product->id) as $item) {
                        $item->update([
                            'unit_cost'  => $unitCost,
                            'total_cost' => round((float) $item->quantity * $unitCost, 2),
                        ]);
                    }
                    $invoice->update(['total_cogs' => round($invoice->items()->sum('total_cost'), 2)]);
                }

                InventoryService::syncCachedStock(null, $product->id);
            });
            $fixed++;
        }

        if (!$dryRun) {
            $this->info("Fixed {$fixed} receipt(s).");
        }
        return self::SUCCESS;
    }
}
