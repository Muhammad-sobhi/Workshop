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
    protected $signature = 'sales:fix-zero-cost-cogs 
                            {--dry-run : Simulate changes without writing to database} 
                            {--all-tenants : Run across all tenant databases}
                            {--db= : Target a specific database name}
                            {--all-zero : Reset cost to 0.0 for any invoice item whose product has 0.0 cost, even if prices were customized}';

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
        $targetDb = $this->option('db');
        $allZero = $this->option('all-zero') !== false; // Default to true or check option

        if ($dryRun) {
            $this->warn('--- RUNNING IN DRY-RUN MODE (No changes will be written) ---');
        }

        if ($targetDb) {
            $this->info("Switching to database: {$targetDb}");
            config(['database.connections.mysql.database' => $targetDb]);
            DB::purge('mysql');
            DB::reconnect('mysql');
            DB::setDefaultConnection('mysql');

            $this->fixConnection($dryRun, $allZero);
            $this->info("Completed database: {$targetDb}");
            return 0;
        }

        if ($allTenants) {
            $tenantIds = User::on('mysql')->whereNotNull('tenant_id')->pluck('tenant_id')->unique();
            if ($tenantIds->isEmpty()) {
                $this->info('No tenants found in users table. Running on default connection (' . config('database.connections.mysql.database') . ')...');
                $this->fixConnection($dryRun, $allZero);
            } else {
                foreach ($tenantIds as $tenantId) {
                    $tenantDb = 'arabic_erp_tenant_' . $tenantId;
                    $this->info("=== Processing Tenant Database: {$tenantDb} ===");
                    config(['database.connections.tenant.database' => $tenantDb]);
                    DB::purge('tenant');
                    DB::reconnect('tenant');
                    DB::setDefaultConnection('tenant');

                    $this->fixConnection($dryRun, $allZero);
                }
                DB::purge('tenant');
                DB::setDefaultConnection('mysql');
            }
        } else {
            $currentDb = config('database.connections.mysql.database');
            $this->info("Running on current database: {$currentDb}");
            $this->fixConnection($dryRun, $allZero);
        }

        $this->info('Fix command completed successfully.');
        return 0;
    }

    private function fixConnection(bool $dryRun, bool $allZero = true): void
    {
        $currentDb = DB::connection()->getDatabaseName();
        $this->info("Checking database: [{$currentDb}]...");

        $items = SalesInvoiceItem::with(['product', 'salesInvoice'])
            ->whereNotNull('product_id')
            ->where('unit_cost', '>', 0)
            ->get();

        $this->info(sprintf("Found %d sales invoice items with unit_cost > 0", $items->count()));

        $affectedInvoiceIds = [];
        $fixedItemsCount = 0;

        foreach ($items as $item) {
            $product = $item->product ?: Product::withTrashed()->find($item->product_id);
            if (!$product) {
                continue;
            }

            $currentStoredUnitCost = (float) $product->calculateStoredUnitCost();

            // When a product has 0.0 cost (no purchase cost, no manufacturing cost, no FIFO batches),
            // any positive unit_cost on the sales invoice item came from the old fallback to sale_price.
            $isCandidate = ($currentStoredUnitCost === 0.0);

            if (!$isCandidate) {
                continue;
            }

            $fixedItemsCount++;
            $affectedInvoiceIds[$item->sales_invoice_id] = true;

            $invNumber = $item->salesInvoice?->invoice_number ?? "ID:{$item->sales_invoice_id}";
            $this->line(sprintf(
                "  -> Item #%d [Invoice: %s, Product: %s]: unit_cost %.2f -> 0.00 (total_cost: %.2f -> 0.00)",
                $item->id,
                $invNumber,
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

        $this->info(sprintf('Total affected items: %d across %d invoices in [%s]', $fixedItemsCount, count($affectedInvoiceIds), $currentDb));

        if (!$dryRun && !empty($affectedInvoiceIds)) {
            foreach (array_keys($affectedInvoiceIds) as $invId) {
                $invoice = SalesInvoice::find($invId);
                if ($invoice) {
                    $newTotalCogs = (float) $invoice->items()->sum('total_cost');
                    $this->line(sprintf("  -> Updating Invoice #%s total_cogs: %.2f -> %.2f", $invoice->invoice_number, (float)$invoice->total_cogs, $newTotalCogs));
                    $invoice->total_cogs = $newTotalCogs;
                    $invoice->saveQuietly();
                }
            }
        }
    }
}
