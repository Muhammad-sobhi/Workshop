<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('purchase_orders', 'payment_method')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->string('payment_method')->nullable()->after('deposit_paid');
            });
        }
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
