<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('supplier_products')) {
            Schema::create('supplier_products', function (Blueprint $table) {
                $table->id();
                $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
                $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
                $table->decimal('price', 15, 2)->default(0.00);
                $table->string('notes', 255)->nullable();
                $table->timestamps();

                $table->unique(['supplier_id', 'product_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_products');
    }
};
