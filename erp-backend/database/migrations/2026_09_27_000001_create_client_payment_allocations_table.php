<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records exactly how much of each client payment was applied to each sales invoice.
     * Any part of a payment that is not allocated stays as a credit on the client's account.
     */
    public function up(): void
    {
        Schema::create('client_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_payment_id')->constrained('client_payments')->cascadeOnDelete();
            $table->foreignId('sales_invoice_id')->constrained('sales_invoices')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->timestamps();
        });

        // Backfill: previously a linked payment was assumed to be fully applied to its invoice
        // (never more than the invoice's recorded paid amount).
        $payments = DB::table('client_payments as p')
            ->join('sales_invoices as i', 'i.id', '=', 'p.sales_invoice_id')
            ->whereNull('p.deleted_at')
            ->whereNull('p.operation_id')
            ->whereNull('i.deleted_at')
            ->orderBy('p.id')
            ->get(['p.id', 'p.amount', 'p.deduction_amount', 'p.sales_invoice_id', 'i.paid_amount']);

        $allocatedPerInvoice = [];
        foreach ($payments as $p) {
            $invId = $p->sales_invoice_id;
            $room = round((float) $p->paid_amount - ($allocatedPerInvoice[$invId] ?? 0), 2);
            $amount = round(min((float) $p->amount + (float) $p->deduction_amount, max(0, $room)), 2);
            if ($amount <= 0) {
                continue;
            }
            DB::table('client_payment_allocations')->insert([
                'client_payment_id' => $p->id,
                'sales_invoice_id' => $invId,
                'amount' => $amount,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $allocatedPerInvoice[$invId] = ($allocatedPerInvoice[$invId] ?? 0) + $amount;
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_payment_allocations');
    }
};
