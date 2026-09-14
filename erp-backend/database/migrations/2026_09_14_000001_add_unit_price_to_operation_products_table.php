<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('operation_products') && !Schema::hasColumn('operation_products', 'unit_price')) {
            Schema::table('operation_products', function (Blueprint $table) {
                $table->decimal('unit_price', 15, 2)->nullable()->after('quantity');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('operation_products') && Schema::hasColumn('operation_products', 'unit_price')) {
            Schema::table('operation_products', function (Blueprint $table) {
                $table->dropColumn('unit_price');
            });
        }
    }
};
