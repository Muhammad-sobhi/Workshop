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
        Schema::create('external_service_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->onDelete('cascade');
            $table->foreignId('material_id')->nullable()->constrained('materials')->onDelete('set null');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->string('item_description');
            $table->decimal('quantity', 12, 2);
            $table->string('unit')->default('قطعة');
            $table->decimal('unit_cost', 12, 2);
            $table->decimal('total_cost', 12, 2);
            $table->decimal('total_paid', 12, 2)->default(0.00);
            $table->decimal('balance', 12, 2)->default(0.00);
            $table->enum('status', ['sent', 'partially_received', 'completed', 'cancelled'])->default('sent');
            $table->date('sent_date');
            $table->date('expected_return_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('external_service_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('external_service_order_id')->constrained('external_service_orders')->onDelete('cascade');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->default('instapay'); // instapay, vodafone_cash, cash, bank_transfer
            $table->string('transaction_reference')->nullable();
            $table->string('receipt_image_path')->nullable();
            $table->date('payment_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('external_service_payments');
        Schema::dropIfExists('external_service_orders');
    }
};
