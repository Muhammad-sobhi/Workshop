<?php

namespace App\Console\Commands;

use App\Models\SalesInvoice;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Delivery invoices created before the fix gave every line the same unit price
 * (order total ÷ total quantity). Re-price each line from the order line it came from.
 * Invoice totals, payments and client debt are not touched.
 */
class FixDeliveryLinePrices extends Command
{
    protected $signature = 'sales:fix-delivery-line-prices
                            {--dry-run : Show the changes without writing them}';

    protected $description = 'Restore per-line sale prices on order-delivery invoices from their production order lines';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) {
            $this->warn('--- DRY RUN: nothing will be written ---');
        }

        $invoices = SalesInvoice::where('invoice_type', 'order_delivery')
            ->whereNotNull('operation_id')
            ->with(['items.product', 'operation.operationProducts', 'client'])
            ->get()
            ->filter(fn ($inv) => $inv->operation && $inv->items->count() > 1);

        $changes = [];
        foreach ($invoices as $inv) {
            $linePrices = $inv->operation->linePrices();
            // Pair invoice items with order lines of the same product, in order
            $lines = $inv->operation->operationProducts->groupBy('product_id')->map->values();
            $used  = [];

            foreach ($inv->items as $item) {
                $idx  = $used[$item->product_id] = ($used[$item->product_id] ?? -1) + 1;
                $line = $lines[$item->product_id][$idx] ?? null;
                if (!$line || abs((float) $line->quantity - (float) $item->quantity) > 0.001) {
                    $this->warn("  ! {$inv->invoice_number}: no matching order line for product {$item->product_id}, skipped");
                    continue;
                }
                $new = $linePrices[$line->id];
                if (abs($new['unit_price'] - (float) $item->unit_sale_price) < 0.01
                    && abs($new['total'] - (float) $item->total_sale_price) < 0.01) {
                    continue;
                }
                $changes[] = [$item, $new];
                $this->line(sprintf(
                    '%s | %s | %s | qty %s | unit %.2f -> %.2f | total %.2f -> %.2f',
                    $inv->invoice_number,
                    $inv->client->name ?? '-',
                    $item->product->name ?? $item->product_id,
                    (float) $item->quantity,
                    (float) $item->unit_sale_price, $new['unit_price'],
                    (float) $item->total_sale_price, $new['total']
                ));
            }

            $newSum = round($inv->items->sum(function ($item) use ($changes) {
                foreach ($changes as [$changed, $new]) {
                    if ($changed->id === $item->id) return $new['total'];
                }
                return (float) $item->total_sale_price;
            }), 2);
            if (abs($newSum - (float) $inv->total_amount) >= 0.01) {
                $this->warn(sprintf('  ! %s: line totals %.2f differ from invoice total %.2f (order total was edited)', $inv->invoice_number, $newSum, (float) $inv->total_amount));
            }
        }

        if (empty($changes)) {
            $this->info('Nothing to change.');
            return self::SUCCESS;
        }

        if (!$dryRun) {
            DB::transaction(function () use ($changes) {
                foreach ($changes as [$item, $new]) {
                    $item->update([
                        'unit_sale_price'  => $new['unit_price'],
                        'total_sale_price' => $new['total'],
                    ]);
                }
            });
        }

        $this->info(($dryRun ? 'Would update ' : 'Updated ') . count($changes) . ' invoice line(s).');
        return self::SUCCESS;
    }
}
