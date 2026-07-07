<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Add payment_method to operation_payments
        Schema::table('operation_payments', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('notes');
            // payment_method: instapay | vodafone_cash | cash | bank_transfer
        });

        // Add payment_method to revenues (sales)
        Schema::table('revenues', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('reference_number');
        });

        // Add payment_method to expenses (purchases/procurement)
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('reference_number');
        });
    }

    public function down(): void {
        Schema::table('operation_payments', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
        Schema::table('revenues', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
