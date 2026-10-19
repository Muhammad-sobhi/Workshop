<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Link each production-order stage payment to the client_payments row that mirrors it on the
 * client statement, so deleting / cancelling one also removes the other. Deposit rows keep
 * operation_payment_id = null.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('client_payments') || Schema::hasColumn('client_payments', 'operation_payment_id')) {
            return;
        }

        Schema::table('client_payments', function (Blueprint $table) {
            $table->unsignedBigInteger('operation_payment_id')->nullable()->after('operation_id')->index();
        });

        if (!Schema::hasTable('operation_payments')) {
            return;
        }

        // Backfill: stage payments were mirrored with the same operation, amount and a "دفعة مرحلية" note
        foreach (DB::table('operation_payments')->orderBy('id')->get() as $opPay) {
            $match = DB::table('client_payments')
                ->whereNull('deleted_at')
                ->whereNull('operation_payment_id')
                ->where('operation_id', $opPay->operation_id)
                ->where('amount', $opPay->amount_paid)
                ->where('notes', 'like', 'دفعة مرحلية%')
                ->orderByRaw('CASE WHEN payment_date = ? THEN 0 ELSE 1 END', [substr((string) $opPay->payment_date, 0, 10)])
                ->orderBy('id')
                ->first();

            if ($match) {
                DB::table('client_payments')->where('id', $match->id)->update(['operation_payment_id' => $opPay->id]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('client_payments') && Schema::hasColumn('client_payments', 'operation_payment_id')) {
            Schema::table('client_payments', function (Blueprint $table) {
                $table->dropIndex(['operation_payment_id']);
                $table->dropColumn('operation_payment_id');
            });
        }
    }
};
