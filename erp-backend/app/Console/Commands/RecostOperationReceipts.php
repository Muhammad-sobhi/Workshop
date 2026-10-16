<?php

namespace App\Console\Commands;

use App\Models\InventoryMovement;
use App\Models\Operation;
use App\Models\Product;
use App\Models\SalesInvoiceItem;
use App\Services\OperationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Re-price the finished-goods receipts of a completed multi-product operation that was
 * costed before the fix, when each product was charged the whole operation's consumption.
 * Service and labor components of the stored unit cost are kept as they are.
 */
class RecostOperationReceipts extends Command
{
    protected $signature = 'operations:recost-receipts
                            {operation_number : e.g. OP-2026-0019}
                            {--dry-run : Show the changes without writing them}';

    protected $description = 'Recalculate Production_Receipt unit costs of a multi-product operation from each product\'s own consumption';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) {
            $this->warn('--- DRY RUN: nothing will be written ---');
        }

        $operation = Operation::where('operation_number', $this->argument('operation_number'))->first();
        if (!$operation) {
            $this->error('Operation not found.');
            return self::FAILURE;
        }

        $receipts = InventoryMovement::where('reference_number', $operation->operation_number)
            ->where('movement_type', 'Production_Receipt')
            ->orderBy('id')
            ->get();
        if ($receipts->isEmpty()) {
            $this->error('Operation has no Production_Receipt movements.');
            return self::FAILURE;
        }

        $items = $receipts->map(fn ($r) => [
            'product'          => Product::withTrashed()->with(['materials', 'bomItems'])->find($r->product_id),
            'qtyToManufacture' => (float) $r->quantity,
        ])->all();

        $oldConsumedTotal = (float) InventoryMovement::where('reference_number', $operation->operation_number)
            ->where('movement_type', 'Production_Consumption')
            ->sum(DB::raw('quantity * unit_cost'));
        $allocated = OperationService::allocateConsumedCost($operation, $items);

        $changes = [];
        foreach ($receipts as $i => $receipt) {
            $qty     = (float) $receipt->quantity;
            $oldUnit = (float) $receipt->unit_cost;
            // Old cost = whole-operation consumption ÷ qty + services + labor; keep the services + labor part
            $extraPerUnit = $oldUnit - round($oldConsumedTotal / $qty, 2);
            $newUnit      = round(round($allocated[$i] / $qty, 2) + $extraPerUnit, 2);

            $product = $items[$i]['product'];
            $this->line(sprintf(
                '%s (product %d) | qty %.2f | unit_cost %.2f -> %.2f',
                $product?->name ?? '?', $receipt->product_id, $qty, $oldUnit, $newUnit
            ));

            if (abs($newUnit - $oldUnit) >= 0.01) {
                $changes[] = compact('receipt', 'product', 'oldUnit', 'newUnit', 'qty');
            }
        }

        if (empty($changes)) {
            $this->info('Nothing to change.');
            return self::SUCCESS;
        }

        // Already-issued stock keeps the old cost; list it for manual review
        foreach ($changes as $c) {
            $issued = InventoryMovement::where('product_id', $c['receipt']->product_id)
                ->where('id', '>', $c['receipt']->id)
                ->whereIn('movement_type', Product::STOCK_OUTGOING_TYPES)
                ->where('unit_cost', $c['oldUnit'])
                ->get(['movement_number', 'movement_type', 'quantity', 'reference_number']);
            $invoiceItems = SalesInvoiceItem::where('product_id', $c['receipt']->product_id)
                ->where('unit_cost', $c['oldUnit'])
                ->count();

            foreach ($issued as $m) {
                $this->warn("  ! {$m->movement_number} {$m->movement_type} qty {$m->quantity} ({$m->reference_number}) still carries {$c['oldUnit']}");
            }
            if ($invoiceItems > 0) {
                $this->warn("  ! {$invoiceItems} sales invoice item(s) of product {$c['receipt']->product_id} carry cost {$c['oldUnit']}");
            }
        }

        if ($dryRun) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes) {
            foreach ($changes as $c) {
                $c['receipt']->update([
                    'unit_cost'  => $c['newUnit'],
                    'total_cost' => round($c['qty'] * $c['newUnit'], 2),
                ]);
                // completeProduction copied the receipt cost onto the product; fix it only if untouched since
                if ($c['product'] && abs((float) $c['product']->unit_cost - $c['oldUnit']) < 0.01) {
                    Product::withTrashed()->where('id', $c['product']->id)->update(['unit_cost' => $c['newUnit']]);
                }
            }
        });

        $this->info('Updated ' . count($changes) . ' receipt(s).');
        return self::SUCCESS;
    }
}
