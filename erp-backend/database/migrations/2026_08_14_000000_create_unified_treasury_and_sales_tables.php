<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Unified Treasury Transactions Ledger (Single Source of Truth for Cash Flow)
        if (!Schema::hasTable('treasury_transactions')) {
            Schema::create('treasury_transactions', function (Blueprint $table) {
                $table->id();
                $table->string('transaction_number')->unique();
                $table->date('transaction_date');
                $table->enum('type', ['inflow', 'outflow']);
                $table->decimal('amount', 12, 2);
                $table->string('payment_method')->default('cash'); // cash, instapay, vodafone_cash, bank_transfer, postal_transfer
                $table->string('category');
                $table->text('description')->nullable();
                $table->string('source_type')->nullable(); // Polymorphic / named source model
                $table->unsignedBigInteger('source_id')->nullable();
                $table->string('reference_number')->nullable();
                $table->string('receipt_path')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['transaction_date', 'type']);
                $table->index('payment_method');
                $table->index(['source_type', 'source_id']);
            });
        }

        // 2. Structured Sales Invoices
        if (!Schema::hasTable('sales_invoices')) {
            Schema::create('sales_invoices', function (Blueprint $table) {
                $table->id();
                $table->string('invoice_number')->unique();
                $table->date('invoice_date');
                $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
                $table->string('invoice_type')->default('direct_sale'); // direct_sale, order_delivery, historical_opening
                $table->decimal('total_amount', 12, 2)->default(0);
                $table->decimal('total_cogs', 12, 2)->default(0);
                $table->decimal('paid_amount', 12, 2)->default(0);
                $table->decimal('remaining_amount', 12, 2)->default(0);
                $table->string('payment_method')->nullable();
                $table->foreignId('operation_id')->nullable()->constrained('operations')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index('invoice_date');
                $table->index('invoice_type');
            });
        }

        // 3. Sales Invoice Items (Multi-product support with snapshot COGS)
        if (!Schema::hasTable('sales_invoice_items')) {
            Schema::create('sales_invoice_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sales_invoice_id')->constrained('sales_invoices')->cascadeOnDelete();
                $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
                $table->decimal('quantity', 10, 2);
                $table->decimal('unit_sale_price', 12, 2);
                $table->decimal('unit_cost', 12, 2)->default(0); // Cost snapshot at sale moment
                $table->decimal('total_sale_price', 12, 2);
                $table->decimal('total_cost', 12, 2)->default(0);
                $table->string('notes')->nullable();
                $table->timestamps();
            });
        }

        // 4. Dedicated Supplier Payments
        if (!Schema::hasTable('supplier_payments')) {
            Schema::create('supplier_payments', function (Blueprint $table) {
                $table->id();
                $table->string('payment_number')->unique();
                $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
                $table->decimal('amount', 12, 2);
                $table->date('payment_date');
                $table->string('payment_method')->default('cash');
                $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
                $table->foreignId('external_service_order_id')->nullable()->constrained('external_service_orders')->nullOnDelete();
                $table->string('reference_number')->nullable();
                $table->text('notes')->nullable();
                $table->string('receipt_path')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['supplier_id', 'payment_date']);
            });
        }

        // 5. Dedicated Client Payments
        if (!Schema::hasTable('client_payments')) {
            Schema::create('client_payments', function (Blueprint $table) {
                $table->id();
                $table->string('payment_number')->unique();
                $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
                $table->decimal('amount', 12, 2);
                $table->date('payment_date');
                $table->string('payment_method')->default('cash');
                $table->foreignId('operation_id')->nullable()->constrained('operations')->nullOnDelete();
                $table->foreignId('sales_invoice_id')->nullable()->constrained('sales_invoices')->nullOnDelete();
                $table->string('reference_number')->nullable();
                $table->text('notes')->nullable();
                $table->string('receipt_path')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['client_id', 'payment_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_payments');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('sales_invoice_items');
        Schema::dropIfExists('sales_invoices');
        Schema::dropIfExists('treasury_transactions');
    }
};
