<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('client_payments', 'deduction_amount')) {
                $table->decimal('deduction_amount', 12, 2)->default(0)->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_payments', function (Blueprint $table) {
            if (Schema::hasColumn('client_payments', 'deduction_amount')) {
                $table->dropColumn('deduction_amount');
            }
        });
    }
};
