<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_materials', function (Blueprint $table) {
            // Make material_id nullable so a row can reference a sub-product instead
            $table->foreignId('material_id')->nullable()->change();

            // New: reference a manufactured product as a BOM component
            // Either material_id OR sub_product_id is set — never both
            $table->foreignId('sub_product_id')
                ->nullable()
                ->after('material_id')
                ->constrained('products')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_materials', function (Blueprint $table) {
            $table->dropForeign(['sub_product_id']);
            $table->dropColumn('sub_product_id');
            $table->foreignId('material_id')->nullable(false)->change();
        });
    }
};
