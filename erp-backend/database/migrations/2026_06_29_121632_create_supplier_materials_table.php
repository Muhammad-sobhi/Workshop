<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->decimal('price', 15, 2)->default(0.00); // supplier's price for this material
            $table->string('notes')->nullable();
            $table->timestamps();
            $table->unique(['supplier_id', 'material_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_materials');
    }
};
