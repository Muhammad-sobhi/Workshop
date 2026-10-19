<?php

namespace App\Console\Commands;

use App\Models\ClientPayment;
use App\Models\InventoryMovement;
use App\Models\Operation;
use App\Models\OperationPayment;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\TreasuryTransaction;
use App\Services\InventoryService;
use App\Services\OperationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Read-only consistency check of stock, orders, payments and treasury. Exits with 1 when
 * anything is wrong, so it can run from cron and alert. Optional flags repair the leftovers of
 * the old bugs that are safe to repair automatically.
 */
class SystemIntegrityCheck extends Command
{
    protected $signature = 'system:integrity-check
                            {--fix-orphans : Delete client-statement rows of production-order money that no longer exists}
                            {--cancelled-deposits= : For cancelled orders still holding collected money: "credit" (client credit) or "void" (as if never paid)}';

    protected $description = 'Check stock, orders, payments and treasury for inconsistencies';

    private int $issues = 0;

    public function handle(): int
    {
        $this->issues = 0;
        $this->checkNegativeStock();
        $this->checkPhantomProduction();
        $this->checkOrderInvoices();
        $this->checkInvoiceBalances();
        $this->checkOrderPaymentMirrors();
        $this->checkCancelledOrdersMoney();
        $this->checkTreasurySources();

        $this->newLine();
        if ($this->issues === 0) {
            $this->info('✔ No problems found.');
            return self::SUCCESS;
        }
        $this->error("✘ {$this->issues} problem(s) found.");
        \Illuminate\Support\Facades\Log::warning("system:integrity-check found {$this->issues} problem(s)");
        return self::FAILURE;
    }

    private function report(string $title, array $rows): void
    {
        if (empty($rows)) {
            $this->line("✔ {$title}");
            return;
        }
        $this->issues += count($rows);
        $this->warn("✘ {$title}: " . count($rows));
        foreach ($rows as $row) {
            $this->line('   - ' . $row);
        }
    }

    /** True balance per item and warehouse (getStock() shows 0 for a negative balance). */
    private function checkNegativeStock(): void
    {
        $in  = "'" . implode("','", InventoryService::INCOMING_TYPES) . "'";
        $out = "'" . implode("','", InventoryService::OUTGOING_TYPES) . "'";
        $rows = DB::table('inventory_movements')
            ->selectRaw("material_id, product_id, warehouse_id, SUM(CASE
                WHEN movement_type IN ($in) THEN quantity
                WHEN movement_type IN ($out) THEN -quantity
                WHEN movement_type = 'Stock_Adjustment' THEN quantity
                ELSE 0 END) AS balance,
                SUM(CASE WHEN movement_type IN ($in) OR (movement_type = 'Stock_Adjustment' AND quantity > 0) THEN 1 ELSE 0 END) AS incoming_count")
            ->groupBy('material_id', 'product_id', 'warehouse_id')
            ->get()
            ->filter(fn ($r) => $r->incoming_count > 0 && round((float) $r->balance, 2) < 0);

        $this->report('Negative stock balances (shown as 0 on screen)', $rows->map(function ($r) {
            $item = $r->material_id
                ? \App\Models\Material::withTrashed()->find($r->material_id)
                : Product::withTrashed()->find($r->product_id);
            return sprintf('%s #%d "%s" in warehouse %d: %s',
                $r->material_id ? 'material' : 'product', $r->material_id ?? $r->product_id,
                $item->name ?? '?', $r->warehouse_id, round((float) $r->balance, 2));
        })->values()->all());
    }

    private function checkPhantomProduction(): void
    {
        $rows = InventoryMovement::where('movement_type', 'Production_Receipt')->whereNotNull('product_id')->get()
            ->filter(function ($m) {
                $p = Product::withTrashed()->with(['materials', 'bomItems'])->find($m->product_id);
                return $p && !$p->hasPhysicalBom();
            })
            ->map(fn ($m) => "{$m->movement_number} {$m->reference_number} product {$m->product_id} qty {$m->quantity} (run operations:fix-phantom-production)")
            ->values()->all();
        $this->report('Production receipts of products without a BOM', $rows);
    }

    private function checkOrderInvoices(): void
    {
        $counts = SalesInvoice::whereNotNull('operation_id')->selectRaw('operation_id, COUNT(*) c')->groupBy('operation_id')->pluck('c', 'operation_id');
        $rows = [];
        foreach (Operation::whereNotNull('client_id')->get(['id', 'operation_number', 'status']) as $op) {
            $c = (int) ($counts[$op->id] ?? 0);
            if ($op->status === 'Delivered' && $c !== 1) {
                $rows[] = "{$op->operation_number} is Delivered with {$c} delivery invoice(s)";
            } elseif ($op->status !== 'Delivered' && $c > 0) {
                $rows[] = "{$op->operation_number} is {$op->status} but has {$c} delivery invoice(s)";
            }
        }
        $this->report('Production orders vs delivery invoices', $rows);
    }

    private function checkInvoiceBalances(): void
    {
        $rows = SalesInvoice::all()->filter(fn ($i) =>
            abs(round((float) $i->paid_amount + (float) $i->remaining_amount - (float) $i->total_amount, 2)) >= 0.01
            || (float) $i->remaining_amount < 0
        )->map(fn ($i) => "{$i->invoice_number}: total {$i->total_amount}, paid {$i->paid_amount}, remaining {$i->remaining_amount}")
            ->values()->all();
        $this->report('Invoices where paid + remaining ≠ total', $rows);
    }

    /** Client-statement rows of production-order money must match the order's own records. */
    private function checkOrderPaymentMirrors(): void
    {
        $orphans = [];
        $rows = [];
        foreach (ClientPayment::whereNotNull('operation_id')->get() as $cp) {
            $op = Operation::withTrashed()->find($cp->operation_id);
            $reason = null;
            if (!$op) {
                $reason = 'its production order was deleted';
            } elseif ($cp->operation_payment_id && !OperationPayment::find($cp->operation_payment_id)) {
                $reason = 'its stage payment was deleted';
            } elseif (!$cp->operation_payment_id && str_starts_with((string) $cp->notes, 'دفعة مرحلية')) {
                $reason = 'no stage payment matches it';
            } elseif (!$cp->operation_payment_id && (float) $op->deposit_paid <= 0) {
                $reason = 'the order has no deposit';
            }
            if ($reason) {
                $orphans[] = $cp;
                $rows[] = "client payment #{$cp->id} ({$cp->amount}) of {$cp->reference_number}: {$reason}";
            }
        }

        foreach (OperationPayment::with('operation')->get() as $p) {
            if ($p->operation?->client_id && !OperationService::mirrorPayment($p)) {
                $rows[] = "stage payment #{$p->id} ({$p->amount_paid}) of {$p->operation->operation_number} is missing from the client statement";
            }
        }

        $this->report('Production-order payments vs client statement', $rows);

        if ($orphans && $this->option('fix-orphans')) {
            foreach ($orphans as $cp) {
                TreasuryTransaction::where('source_type', ClientPayment::class)->where('source_id', $cp->id)->exists()
                    ? $this->warn("   kept #{$cp->id}: it still has a treasury entry")
                    : $cp->delete();
            }
            $this->info('   orphan statement rows removed.');
        }
    }

    private function checkCancelledOrdersMoney(): void
    {
        $ops = Operation::whereIn('status', ['Cancelled', 'cancelled'])->with('payments')->get()
            ->filter(fn ($op) => (float) $op->deposit_paid + (float) $op->payments->sum('amount_paid') > 0);

        $this->report('Cancelled orders still holding collected money (not the client\'s credit, not refunded)',
            $ops->map(fn ($op) => "{$op->operation_number}: " . ((float) $op->deposit_paid + (float) $op->payments->sum('amount_paid')))->values()->all());

        $action = $this->option('cancelled-deposits');
        if ($ops->isNotEmpty() && in_array($action, ['credit', 'void'], true)) {
            foreach ($ops as $op) {
                DB::transaction(function () use ($op, $action) {
                    $action === 'credit' ? OperationService::convertCollectedToCredit($op) : OperationService::voidCollected($op);
                    $op->client?->recalculateDebt();
                });
            }
            $this->info("   applied \"{$action}\" to " . $ops->count() . ' order(s).');
        }
    }

    private function checkTreasurySources(): void
    {
        $rows = [];
        $bySource = TreasuryTransaction::whereNotNull('source_type')->whereNotNull('source_id')->get()->groupBy('source_type');
        foreach ($bySource as $type => $txs) {
            if (!class_exists($type)) continue;
            // Default scope skips soft-deleted records: their treasury entries are orphans too
            $existing = $type::whereIn('id', $txs->pluck('source_id')->unique())->pluck('id')->flip();
            foreach ($txs as $tx) {
                if (!isset($existing[$tx->source_id])) {
                    $rows[] = "treasury #{$tx->id} ({$tx->amount}, {$tx->category}) points to missing " . class_basename($type) . " #{$tx->source_id}";
                }
            }
        }
        $this->report('Treasury entries whose source record no longer exists', $rows);
    }
}
