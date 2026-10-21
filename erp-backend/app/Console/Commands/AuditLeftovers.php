<?php

namespace App\Console\Commands;

use App\Models\InventoryMovement;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only. Lists what the bugs fixed in the 2026-10-21 audit may have left in the data, so it can
 * be reviewed before anything is corrected:
 *  - stock added back by deleting a sales invoice that had been edited (leftover RET- returns)
 *  - purchase-order deposits whose payment row was undone from the supplier statement
 *  - treasury entries whose source record no longer exists (e.g. a deleted supplier's orders)
 *  - suppliers whose stored debt differs from the recalculated one (e.g. cancelled external orders)
 *  - users saved in this tenant database by Settings → Users (they cannot log in)
 */
class AuditLeftovers extends Command
{
    protected $signature = 'system:audit-leftovers';

    protected $description = 'Read-only report of data left behind by the bugs fixed in the 2026-10-21 audit';

    public function handle(): int
    {
        $this->leftoverSaleReturns();
        $this->undoneDeposits();
        $this->orphanTreasuryEntries();
        $this->staleSupplierDebts();
        $this->tenantUsers();

        return self::SUCCESS;
    }

    private function leftoverSaleReturns(): void
    {
        $this->info('1) Stock left by deleted invoices that had been edited');

        $live = DB::table('sales_invoices')->whereNull('deleted_at')->pluck('invoice_number')->flip();
        $returns = InventoryMovement::where('movement_type', 'Sales_Return')->where('reference_number', 'like', 'RET-%')->get();

        $rows = [];
        foreach ($returns->groupBy('reference_number') as $ref => $group) {
            $invoiceNumber = substr($ref, 4);
            if ($live->has($invoiceNumber)) continue;

            // Net of every sale movement still carrying this deleted invoice's numbers
            $movements = InventoryMovement::where(fn ($q) => $q
                ->where(fn ($r) => $r->where('reference_number', $invoiceNumber)->where('movement_type', 'Sales_Issue'))
                ->orWhere(fn ($r) => $r->where('reference_number', $ref)->where('movement_type', 'Sales_Return')))
                ->with(['material:id,name', 'product:id,name'])
                ->get();
            foreach ($movements->groupBy(fn ($m) => ($m->material_id ? 'm' . $m->material_id : 'p' . $m->product_id) . '|' . $m->warehouse_id) as $items) {
                $net = $items->sum(fn ($m) => $m->movement_type === 'Sales_Return' ? (float) $m->quantity : -(float) $m->quantity);
                if (abs($net) < 0.0001) continue;
                $first = $items->first();
                $rows[] = [$invoiceNumber, $first->material?->name ?? $first->product?->name ?? '?', $first->warehouse_id, round($net, 2)];
            }
        }

        $rows ? $this->table(['Deleted invoice', 'Item', 'Warehouse', 'Extra stock'], $rows) : $this->line('   none');
    }

    private function undoneDeposits(): void
    {
        $this->info('2) Purchase-order deposits whose payment row was undone (treasury outflow still there)');

        $rows = PurchaseOrder::where('deposit_paid', '>', 0)->get()
            ->filter(fn ($po) => !SupplierPayment::where('purchase_order_id', $po->id)->exists())
            ->map(fn ($po) => [$po->order_number, $po->supplier?->name, (float) $po->deposit_paid])
            ->values()->all();

        $rows ? $this->table(['Purchase order', 'Supplier', 'Deposit'], $rows) : $this->line('   none');
    }

    private function orphanTreasuryEntries(): void
    {
        $this->info('3) Treasury entries whose source record no longer exists');

        $rows = [];
        $types = DB::table('treasury_transactions')->whereNull('deleted_at')->whereNotNull('source_type')->whereNotNull('source_id')
            ->distinct()->pluck('source_type');
        foreach ($types as $type) {
            if (!class_exists($type)) continue;
            $table = (new $type)->getTable();
            if (!Schema::hasTable($table)) continue;
            $hasSoftDelete = Schema::hasColumn($table, 'deleted_at');

            $entries = DB::table('treasury_transactions')->whereNull('deleted_at')->where('source_type', $type)->get();
            foreach ($entries as $t) {
                $source = DB::table($table)->where('id', $t->source_id)->when($hasSoftDelete, fn ($q) => $q->whereNull('deleted_at'));
                if ($source->exists()) continue;
                $rows[] = [$t->id, $t->transaction_date, $t->type, (float) $t->amount, class_basename($type) . '#' . $t->source_id, mb_substr((string) $t->description, 0, 60)];
            }
        }

        $rows ? $this->table(['Treasury id', 'Date', 'Type', 'Amount', 'Missing source', 'Description'], $rows) : $this->line('   none');
    }

    private function staleSupplierDebts(): void
    {
        $this->info('4) Suppliers whose stored debt differs from the recalculated debt');

        $rows = [];
        foreach (Supplier::orderBy('id')->get() as $supplier) {
            $stored = round((float) $supplier->debt_amount, 2);
            // recalculateDebt() saves; roll it back so this report never writes
            DB::beginTransaction();
            try {
                $calculated = round($supplier->recalculateDebt(), 2);
            } finally {
                DB::rollBack();
            }
            if (abs($stored - $calculated) >= 0.01) {
                $rows[] = [$supplier->id, $supplier->name, $stored, $calculated];
            }
        }

        $rows ? $this->table(['Id', 'Supplier', 'Stored debt', 'Recalculated'], $rows) : $this->line('   none');
    }

    private function tenantUsers(): void
    {
        $this->info('5) Users saved in this database by Settings → Users (only meaningful for a tenant database)');

        if (DB::getDefaultConnection() === config('erp.central_connection')) {
            $this->line('   skipped: this is the central database (run through tenants:run)');
            return;
        }

        $rows = DB::table('users')->orderBy('id')->get(['id', 'name', 'email', 'role'])
            ->map(fn ($u) => [$u->id, $u->name, $u->email, $u->role])->all();

        $rows ? $this->table(['Id', 'Name', 'Email', 'Role'], $rows) : $this->line('   none');
    }
}
