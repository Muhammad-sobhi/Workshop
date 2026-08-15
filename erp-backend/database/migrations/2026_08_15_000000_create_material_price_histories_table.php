<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->onDelete('cascade');
            $table->decimal('old_unit_cost', 15, 2);
            $table->decimal('new_unit_cost', 15, 2);
            $table->boolean('apply_to_material_stock')->default(true);
            $table->boolean('apply_to_products_bom')->default(true);
            $table->boolean('apply_future_only')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_price_histories');
    }
};
