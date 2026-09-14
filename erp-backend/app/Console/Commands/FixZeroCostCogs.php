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
                            {--all-databases : Automatically find and fix ALL databases on MySQL containing sales invoice items}
                            {--db= : Target a specific database name}
                            {--force : Force reset invoice item costs to 0.0 even if product stored unit_cost is > 0}
                            {--product= : Target a specific product by name or ID}';

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
        $allDatabases = $this->option('all-databases');
        $targetDb = $this->option('db');
        $force = $this->option('force');
        $productFilter = $this->option('product');

        if ($dryRun) {
            $this->warn('--- RUNNING IN DRY-RUN MODE (No changes will be written) ---');
        }

        if ($allDatabases) {
            $this->info('Scanning MySQL server for all databases containing sales invoices...');
            $databases = DB::select('SHOW DATABASES');
            $processedCount = 0;
            foreach ($databases as $dbObj) {
                $db = $dbObj->Database;
                if (in_array($db, ['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'])) continue;
                try {
                    $hasTable = DB::select("SELECT count(*) as c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sales_invoice_items'", [$db]);
                    if (!empty($hasTable) && $hasTable[0]->c > 0) {
                        $itemCount = DB::select("SELECT count(*) as c FROM `{$db}`.sales_invoice_items")[0]->c;
                        if ($itemCount > 0) {
                            $processedCount++;
                            $this->info("==================================================");
                            $this->info("=== Processing Database [{$db}] (contains {$itemCount} invoice items) ===");
                            $this->info("==================================================");
                            config(['database.connections.mysql.database' => $db]);
                            DB::purge('mysql');
                            DB::reconnect('mysql');
                            DB::setDefaultConnection('mysql');

                            $this->fixConnection($dryRun, $force, $productFilter);
                        }
                    }
                } catch (\Exception $e) {
                    // skip database if inaccessible
                }
            }
            $this->info("Finished scanning all databases. Successfully processed {$processedCount} database(s).");
            return 0;
        }

        if ($targetDb) {
            $this->info("Switching to database: {$targetDb}");
            config(['database.connections.mysql.database' => $targetDb]);
            DB::purge('mysql');
            DB::reconnect('mysql');
            DB::setDefaultConnection('mysql');

            $this->fixConnection($dryRun, $force, $productFilter);
            $this->info("Completed database: {$targetDb}");
            return 0;
        }

        if ($allTenants) {
            $tenantIds = User::on('mysql')->whereNotNull('tenant_id')->pluck('tenant_id')->unique();
            if ($tenantIds->isEmpty()) {
                $this->warn('No tenants found in users table. Checking current database connection (' . config('database.connections.mysql.database') . ')...');
                $this->fixConnection($dryRun, $force, $productFilter);
            } else {
                $this->info(sprintf("Found %d tenants: %s", $tenantIds->count(), $tenantIds->implode(', ')));
                foreach ($tenantIds as $tenantId) {
                    $tenantDb = 'arabic_erp_tenant_' . $tenantId;
                    $this->info("=== Processing Tenant Database: {$tenantDb} ===");
                    config(['database.connections.tenant.database' => $tenantDb]);
                    DB::purge('tenant');
                    DB::reconnect('tenant');
                    DB::setDefaultConnection('tenant');

                    $this->fixConnection($dryRun, $force, $productFilter);
                }
                DB::purge('tenant');
                DB::setDefaultConnection('mysql');
            }
        } else {
            $currentDb = config('database.connections.mysql.database');
            $this->info("Running on current database: {$currentDb}");
            $this->fixConnection($dryRun, $force, $productFilter);
        }

        $this->info('Fix command completed successfully.');
        return 0;
    }

    private function fixConnection(bool $dryRun, bool $force = false, ?string $productFilter = null): void
    {
        $currentDb = DB::connection()->getDatabaseName();
        $this->info("--- Checking database: [{$currentDb}] ---");

        $query = SalesInvoiceItem::with(['product', 'salesInvoice'])
            ->whereNotNull('product_id')
            ->where('unit_cost', '>', 0);

        if ($productFilter) {
            $query->whereHas('product', function ($q) use ($productFilter) {
                $q->where('name', 'like', "%{$productFilter}%")
                  ->orWhere('id', $productFilter);
            });
        }

        $items = $query->get();

        $this->info(sprintf("Found %d sales invoice items with unit_cost > 0", $items->count()));

        if ($items->isEmpty()) {
            $totalItems = SalesInvoiceItem::count();
            $this->warn("Total items in sales_invoice_items table: {$totalItems}");
            return;
        }

        $affectedInvoiceIds = [];
        $fixedItemsCount = 0;
        $skippedCount = 0;

        foreach ($items as $item) {
            $product = $item->product ?: Product::withTrashed()->find($item->product_id);
            if (!$product) {
                $this->warn("  [SKIPPED] Item #{$item->id}: Product not found (product_id={$item->product_id})");
                $skippedCount++;
                continue;
            }

            $currentStoredUnitCost = (float) $product->calculateStoredUnitCost();

            // Check candidate condition
            $isZeroCostProduct = ($currentStoredUnitCost === 0.0);
            $isCandidate = $isZeroCostProduct || $force;

            if (!$isCandidate) {
                $this->line(sprintf(
                    "  [SKIPPED] Item #%d (%s): Product stored unit cost is %.2f (products.unit_cost=%.2f, sale_price=%.2f). Use --force to reset.",
                    $item->id,
                    $product->name,
                    $currentStoredUnitCost,
                    (float)$product->unit_cost,
                    (float)$product->sale_price
                ));
                $skippedCount++;
                continue;
            }

            $fixedItemsCount++;
            $affectedInvoiceIds[$item->sales_invoice_id] = true;

            $invNumber = $item->salesInvoice?->invoice_number ?? "ID:{$item->sales_invoice_id}";
            $this->info(sprintf(
                "  [FIXED] Item #%d [Invoice: %s, Product: %s]: unit_cost %.2f -> 0.00 (total_cost: %.2f -> 0.00)",
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

                // If product table itself has unit_cost equal to sale_price and no BOM, reset product unit_cost to 0.0
                if ($force && (float)$product->unit_cost > 0) {
                    $hasBom = $product->bomItems()->count() > 0;
                    if (!$hasBom) {
                        $this->line(sprintf("    -> Also resetting Product '%s' unit_cost: %.2f -> 0.00 in products table", $product->name, (float)$product->unit_cost));
                        $product->unit_cost = 0.00;
                        $product->saveQuietly();
                    }
                }
            }
        }

        $this->info(sprintf('Summary for [%s]: %d items fixed, %d items skipped across %d invoices', $currentDb, $fixedItemsCount, $skippedCount, count($affectedInvoiceIds)));

        if (!$dryRun && !empty($affectedInvoiceIds)) {
            foreach (array_keys($affectedInvoiceIds) as $invId) {
                $invoice = SalesInvoice::find($invId);
                if ($invoice) {
                    $newTotalCogs = (float) $invoice->items()->sum('total_cost');
                    $this->line(sprintf("  -> Updated Invoice #%s total_cogs: %.2f -> %.2f", $invoice->invoice_number, (float)$invoice->total_cogs, $newTotalCogs));
                    $invoice->total_cogs = $newTotalCogs;
                    $invoice->saveQuietly();
                }
            }
        }
    }
}
