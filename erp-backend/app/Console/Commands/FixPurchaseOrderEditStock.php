<?php

namespace App\Console\Commands;

use App\Models\InventoryMovement;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Repairs stock of received purchase orders that were edited more than once. Each edit used to
 * reverse every receipt carrying the order number, including receipts already reversed by an
 * earlier edit, so the order's net movements fell below its current items.
 *
 * For every received order with edit reversals (RET-<order_number>), the expected net quantity per
 * warehouse/item is taken from the order's current items and compared with the net of its
 * receipts minus its reversals. The difference is posted under the same references, so later
 * edits and deletes of the order stay consistent.
 */
class FixPurchaseOrderEditStock extends Command
{
    protected $signature = 'purchase-orders:fix-edit-stock
                            {--apply : Write the corrections (default is a dry run)}
                            {--all-tenants : Run across all tenant databases}
                            {--db= : Target a specific database name}';

    protected $description = 'Repair stock of received purchase orders damaged by repeated edits';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        if (!$apply) {
            $this->warn('--- DRY RUN (no changes written). Re-run with --apply to post corrections ---');
        }

        if ($targetDb = $this->option('db')) {
            $this->info("Switching to database: {$targetDb}");
            config(['database.connections.mysql.database' => $targetDb]);
            DB::purge('mysql');
            DB::reconnect('mysql');
            DB::setDefaultConnection('mysql');
            $this->fixConnection($apply);
            return 0;
        }

        if ($this->option('all-tenants')) {
            $tenantIds = User::on('mysql')->whereNotNull('tenant_id')->pluck('tenant_id')->unique();
            if ($tenantIds->isEmpty()) {
                $this->warn('No tenants found. Running on the current database.');
                $this->fixConnection($apply);
                return 0;
            }
            foreach ($tenantIds as $tenantId) {
                $tenantDb = 'arabic_erp_tenant_' . $tenantId;
                $this->info("=== Tenant database: {$tenantDb} ===");
                config(['database.connections.tenant.database' => $tenantDb]);
                DB::purge('tenant');
                DB::reconnect('tenant');
                DB::setDefaultConnection('tenant');
                $this->fixConnection($apply);
            }
            DB::purge('tenant');
            DB::setDefaultConnection('mysql');
            return 0;
        }

        $this->fixConnection($apply);
        return 0;
    }

    private function fixConnection(bool $apply): void
    {
        $this->info('--- Database: [' . DB::connection()->getDatabaseName() . '] ---');

        $whRaw = Warehouse::rawMaterialsWarehouse();
        $rawWarehouseId = $whRaw ? $whRaw->id : (Warehouse::first() ? Warehouse::first()->id : 1);
        $whProd = Warehouse::productsWarehouse();
        $prodWarehouseId = $whProd ? $whProd->id : $rawWarehouseId;

        $editedNumbers = InventoryMovement::where('reference_number', 'like', 'RET-%')
            ->where('movement_type', 'Supplier_Return')
            ->distinct()
            ->pluck('reference_number')
            ->map(fn ($ref) => substr($ref, 4));

        $orders = PurchaseOrder::with('items.material')
            ->where('status', 'Received')
            ->whereIn('order_number', $editedNumbers)
            ->get();

        $this->info("Checking {$orders->count()} edited received order(s)");
        $fixedOrders = 0;

        foreach ($orders as $order) {
            // Expected net per warehouse/item, routed like a receipt
            $expected = [];
            foreach ($order->items as $item) {
                if (!$item->product_id && $item->material && $item->material->type === 'service')
                    continue;
                $warehouseId = $item->product_id ? $prodWarehouseId : $rawWarehouseId;
                $materialId = $item->product_id ? null : $item->material_id;
                $key = "{$warehouseId}|{$materialId}|{$item->product_id}";
                $expected[$key] ??= ['qty' => 0.0, 'value' => 0.0];
                $expected[$key]['qty'] += (float) $item->quantity;
                $expected[$key]['value'] += (float) $item->quantity * (float) $item->unit_cost;
            }

            // Actual net = receipts under the order number − reversals under RET-<order number>
            $actual = [];
            $movements = InventoryMovement::where(function ($q) use ($order) {
                $q->where(fn ($r) => $r->where('reference_number', $order->order_number)->where('movement_type', 'Purchase_Receipt'))
                  ->orWhere(fn ($r) => $r->where('reference_number', 'RET-' . $order->order_number)->where('movement_type', 'Supplier_Return'));
            })->get();
            foreach ($movements as $m) {
                $key = "{$m->warehouse_id}|{$m->material_id}|{$m->product_id}";
                $actual[$key] ??= ['qty' => 0.0, 'unit_cost' => (float) $m->unit_cost];
                $actual[$key]['qty'] += $m->movement_type === 'Purchase_Receipt' ? (float) $m->quantity : -(float) $m->quantity;
            }

            $corrections = [];
            foreach (array_unique(array_merge(array_keys($expected), array_keys($actual))) as $key) {
                $expectedQty = $expected[$key]['qty'] ?? 0.0;
                $diff = round($expectedQty - ($actual[$key]['qty'] ?? 0.0), 4);
                if (abs($diff) < 0.0001)
                    continue;
                $unitCost = $expectedQty > 0
                    ? $expected[$key]['value'] / $expectedQty
                    : ($actual[$key]['unit_cost'] ?? 0.0);
                $corrections[] = [$key, $diff, round($unitCost, 4)];
            }

            if (empty($corrections))
                continue;

            $fixedOrders++;
            $this->line("Order {$order->order_number}:");

            DB::transaction(function () use ($corrections, $order, $apply) {
                foreach ($corrections as [$key, $diff, $unitCost]) {
                    [$warehouseId, $materialId, $productId] = explode('|', $key);
                    $materialId = $materialId !== '' ? (int) $materialId : null;
                    $productId = $productId !== '' ? (int) $productId : null;

                    $this->line(sprintf(
                        '  %s %s #%d in warehouse #%d: %+.2f',
                        $diff > 0 ? '[ADD]' : '[REMOVE]',
                        $productId ? 'product' : 'material',
                        $productId ?? $materialId,
                        $warehouseId,
                        $diff
                    ));

                    if (!$apply)
                        continue;

                    InventoryService::recordMovement(
                        warehouseId: (int) $warehouseId,
                        materialId: $materialId,
                        productId: $productId,
                        movementType: $diff > 0 ? 'Purchase_Receipt' : 'Supplier_Return',
                        quantity: abs($diff),
                        unitCost: $unitCost,
                        referenceNumber: $diff > 0 ? $order->order_number : 'RET-' . $order->order_number,
                        notes: "تصحيح مخزون أمر شراء {$order->order_number} بعد تعديلات متكررة"
                    );
                }
            });
        }

        $this->info(sprintf('%d order(s) %s', $fixedOrders, $apply ? 'corrected' : 'need correction'));
    }
}
