<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_items', 'material_id')) {
                $table->foreignId('material_id')->nullable()->change();
            }

            if (!Schema::hasColumn('purchase_order_items', 'product_id')) {
                $table->foreignId('product_id')
                    ->nullable()
                    ->after('material_id')
                    ->constrained('products')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_order_items', 'product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }
        });
    }
};
