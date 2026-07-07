<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Materials low limit and service type
        Schema::table('materials', function (Blueprint $table) {
            $table->decimal('low_stock_limit', 15, 2)->default(10.00)->after('type');
            $table->string('service_location')->nullable()->after('low_stock_limit'); // 'inside' or 'outside'
        });

        // Clients debts tracking
        Schema::table('clients', function (Blueprint $table) {
            $table->decimal('debt_amount', 15, 2)->default(0.00);
            $table->date('debt_due_date')->nullable();
        });

        // Suppliers debts tracking
        Schema::table('suppliers', function (Blueprint $table) {
            $table->decimal('debt_amount', 15, 2)->default(0.00);
            $table->date('debt_due_date')->nullable();
        });

        // Operations updates for clients, deposit
        Schema::table('operations', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->decimal('deposit_paid', 15, 2)->default(0.00);
            // Allow product_id to be nullable since we can have multiple products in operation_products table
            $table->foreignId('product_id')->nullable()->change();
            $table->decimal('quantity', 15, 2)->nullable()->change();
        });

        // Operation Products (for multiple products in production order)
        Schema::create('operation_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_id')->constrained('operations')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('quantity', 15, 2);
            $table->timestamps();
        });

        // Operation Payments (Milestones)
        Schema::create('operation_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_id')->constrained('operations')->cascadeOnDelete();
            $table->decimal('amount_paid', 15, 2);
            $table->date('payment_date');
            $table->string('notes')->nullable();
            $table->string('receipt_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('operation_payments');
        Schema::dropIfExists('operation_products');
        
        Schema::table('operations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn('deposit_paid');
            $table->foreignId('product_id')->nullable(false)->change();
            $table->decimal('quantity', 15, 2)->nullable(false)->change();
        });
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['debt_amount', 'debt_due_date']);
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['debt_amount', 'debt_due_date']);
        });
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['low_stock_limit', 'service_location']);
        });
    }
};
