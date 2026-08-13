<?php
// One-time cleanup script: purge soft-deleted suppliers and reset stale debt_amount
// Run on server: php cleanup_suppliers.php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// 1. Force-delete all soft-deleted suppliers (they cause ghost data)
$softDeleted = DB::table('suppliers')->whereNotNull('deleted_at')->get();
echo "Found " . count($softDeleted) . " soft-deleted supplier(s).\n";
foreach ($softDeleted as $s) {
    echo "  Purging soft-deleted supplier ID={$s->id}, name={$s->name}, debt_amount={$s->debt_amount}\n";
    DB::table('suppliers')->where('id', $s->id)->delete();
}

// 2. For all remaining active suppliers, recalculate debt_amount live
$activeSuppliers = DB::table('suppliers')->whereNull('deleted_at')->get();
echo "\nRecalculating debt for " . count($activeSuppliers) . " active supplier(s)...\n";

foreach ($activeSuppliers as $s) {
    // PO debt
    $totalPOCost = (float) DB::table('purchase_orders')
        ->where('supplier_id', $s->id)
        ->where('status', 'Received')
        ->sum('total_amount');

    $totalPaid = (float) DB::table('purchase_orders')
        ->where('supplier_id', $s->id)
        ->where('status', 'Received')
        ->sum('deposit_paid');

    // ESO debt
    $totalESODebt = 0;
    if (\Illuminate\Support\Facades\Schema::hasTable('external_service_orders')) {
        $esos = DB::table('external_service_orders')
            ->where('supplier_id', $s->id)
            ->where('status', '!=', 'cancelled')
            ->get();
        foreach ($esos as $eso) {
            $totalESODebt += max(0, (float)$eso->total_cost - (float)$eso->total_paid);
        }
    }

    // Unallocated expenses
    $totalExpenses = 0;
    if (\Illuminate\Support\Facades\Schema::hasColumn('expenses', 'supplier_id')) {
        $totalExpenses = (float) DB::table('expenses')
            ->where('supplier_id', $s->id)
            ->sum('amount');
    }
    $unallocated = max(0, $totalExpenses - $totalPaid);

    $outstanding = max(0, max(0, $totalPOCost - $totalPaid) + $totalESODebt - $unallocated);

    echo "  [{$s->id}] {$s->name}: PO_cost={$totalPOCost}, PO_paid={$totalPaid}, ESO_debt={$totalESODebt}, expenses={$totalExpenses}, outstanding={$outstanding} (was: {$s->debt_amount})\n";

    DB::table('suppliers')->where('id', $s->id)->update(['debt_amount' => $outstanding]);
}

echo "\nDone! All supplier debts have been recalculated.\n";
