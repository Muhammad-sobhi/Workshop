<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add tenant_id to users
        if (!Schema::hasColumn('users', 'tenant_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('tenant_id')->nullable()->after('id');
            });
        }

        // 2. Add use_stock and deposit_payment_method to operations
        Schema::table('operations', function (Blueprint $table) {
            if (!Schema::hasColumn('operations', 'use_stock')) {
                $table->boolean('use_stock')->default(false)->after('deposit_paid');
            }
            if (!Schema::hasColumn('operations', 'deposit_payment_method')) {
                $table->string('deposit_payment_method')->nullable()->after('use_stock');
            }
        });

        // 3. Add quantity_taken_from_stock to operation_products
        if (Schema::hasTable('operation_products')) {
            Schema::table('operation_products', function (Blueprint $table) {
                if (!Schema::hasColumn('operation_products', 'quantity_taken_from_stock')) {
                    $table->decimal('quantity_taken_from_stock', 15, 2)->default(0.00)->after('quantity');
                }
            });
        }

        // 4. Add client_id, supplier_id, and receipt_path to revenues
        if (Schema::hasTable('revenues')) {
            Schema::table('revenues', function (Blueprint $table) {
                if (!Schema::hasColumn('revenues', 'client_id')) {
                    $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete()->after('id');
                }
                if (!Schema::hasColumn('revenues', 'supplier_id')) {
                    $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete()->after('client_id');
                }
                if (!Schema::hasColumn('revenues', 'receipt_path')) {
                    $table->string('receipt_path')->nullable()->after('payment_method');
                }
            });
        }

        // 5. Add client_id, supplier_id, and receipt_path to expenses
        if (Schema::hasTable('expenses')) {
            Schema::table('expenses', function (Blueprint $table) {
                if (!Schema::hasColumn('expenses', 'client_id')) {
                    $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete()->after('id');
                }
                if (!Schema::hasColumn('expenses', 'supplier_id')) {
                    $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete()->after('client_id');
                }
                if (!Schema::hasColumn('expenses', 'receipt_path')) {
                    $table->string('receipt_path')->nullable()->after('payment_method');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('tenant_id');
        });

        Schema::table('operations', function (Blueprint $table) {
            $table->dropColumn(['use_stock', 'deposit_payment_method']);
        });

        if (Schema::hasTable('operation_products')) {
            Schema::table('operation_products', function (Blueprint $table) {
                $table->dropColumn('quantity_taken_from_stock');
            });
        }

        if (Schema::hasTable('revenues')) {
            Schema::table('revenues', function (Blueprint $table) {
                $table->dropConstrainedForeignId('client_id');
                $table->dropConstrainedForeignId('supplier_id');
                $table->dropColumn('receipt_path');
            });
        }

        if (Schema::hasTable('expenses')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->dropConstrainedForeignId('client_id');
                $table->dropConstrainedForeignId('supplier_id');
                $table->dropColumn('receipt_path');
            });
        }
    }
};
