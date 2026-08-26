<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            if (Schema::hasColumn('sales_invoice_items', 'product_id')) {
                $table->foreignId('product_id')->nullable()->change();
            }

            if (!Schema::hasColumn('sales_invoice_items', 'material_id')) {
                $table->foreignId('material_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('materials')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('sales_invoice_items', 'item_type')) {
                $table->enum('item_type', ['product', 'material'])->default('product')->after('material_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales_invoice_items', function (Blueprint $table) {
            if (Schema::hasColumn('sales_invoice_items', 'item_type')) {
                $table->dropColumn('item_type');
            }
            if (Schema::hasColumn('sales_invoice_items', 'material_id')) {
                $table->dropConstrainedForeignId('material_id');
            }
        });
    }
};
