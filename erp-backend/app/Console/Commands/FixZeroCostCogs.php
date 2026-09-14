<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FixZeroCostCogs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sales:fix-zero-cost-cogs {--dry-run : Simulate changes without writing to database} {--all-tenants : Run across all tenant databases}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fix sales invoice items where unit_cost was erroneously set to sale_price instead of 0.0';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $allTenants = $this->option('all-tenants');

        if ($dryRun) {
            $this->warn('--- RUNNING IN DRY-RUN MODE (No changes will be written) ---');
        }

        if ($allTenants) {
            $users = User::whereNotNull('tenant_id')->get();
            if ($users->isEmpty()) {
                $this->info('No tenants found. Running on default connection...');
                $this->fixConnection($dryRun);
            } else {
                foreach ($users as $user) {
                    $tenantDb = 'arabic_erp_tenant_' . $user->tenant_id;
                    $this->info("Processing tenant database: {$tenantDb}");
                    config(['database.connections.tenant.database' => $tenantDb]);
                    DB::purge('tenant');
                    DB::reconnect('tenant');
                    DB::setDefaultConnection('tenant');

                    $this->fixConnection($dryRun);
                }
            }
        } else {
            $this->fixConnection($dryRun);
        }

        $this->info('Fix completed successfully.');
        return 0;
    }

    private function fixConnection(bool $dryRun): void
    {
        $items = SalesInvoiceItem::with(['product', 'salesInvoice'])
            ->whereNotNull('product_id')
            ->where('unit_cost', '>', 0)
            ->get();

        $affectedInvoiceIds = [];
        $fixedItemsCount = 0;

        foreach ($items as $item) {
            $product = $item->product ?: Product::withTrashed()->find($item->product_id);
            if (!$product) {
                continue;
            }

            $currentStoredUnitCost = (float) $product->calculateStoredUnitCost();

            // Check if product actually has 0 cost, but item was assigned unit_sale_price as cost
            $isErroneouslyAssignedSalePrice = (
                $currentStoredUnitCost === 0.0 &&
                (
                    abs((float)$item->unit_cost - (float)$item->unit_sale_price) < 0.01 ||
                    abs((float)$item->unit_cost - (float)$product->sale_price) < 0.01
                )
            );

            if ($isErroneouslyAssignedSalePrice) {
                $fixedItemsCount++;
                $affectedInvoiceIds[$item->sales_invoice_id] = true;

                $this->line(sprintf(
                    "Item #%d (Inv: %s, Product: %s): unit_cost %.2f -> 0.00 (total_cost: %.2f -> 0.00)",
                    $item->id,
                    $item->salesInvoice?->invoice_number ?? 'N/A',
                    $product->name,
                    (float)$item->unit_cost,
                    (float)$item->total_cost
                ));

                if (!$dryRun) {
                    $item->unit_cost = 0.00;
                    $item->total_cost = 0.00;
                    $item->saveQuietly();
                }
            }
        }

        $this->info(sprintf('Total affected items found: %d across %d invoices', $fixedItemsCount, count($affectedInvoiceIds)));

        if (!$dryRun && !empty($affectedInvoiceIds)) {
            foreach (array_keys($affectedInvoiceIds) as $invId) {
                $invoice = SalesInvoice::find($invId);
                if ($invoice) {
                    $newTotalCogs = (float) $invoice->items()->sum('total_cost');
                    $this->line(sprintf("Updating Invoice #%s total_cogs: %.2f -> %.2f", $invoice->invoice_number, (float)$invoice->total_cogs, $newTotalCogs));
                    $invoice->total_cogs = $newTotalCogs;
                    $invoice->saveQuietly();
                }
            }
        }
    }
}
