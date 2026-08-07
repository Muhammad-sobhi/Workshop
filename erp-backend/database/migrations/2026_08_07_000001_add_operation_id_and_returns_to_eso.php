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
        Schema::table('external_service_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('external_service_orders', 'operation_id')) {
                $table->foreignId('operation_id')->nullable()->after('product_id')->constrained('operations')->onDelete('set null');
            }
            if (!Schema::hasColumn('external_service_orders', 'returned_quantity')) {
                $table->decimal('returned_quantity', 12, 2)->default(0.00)->after('quantity');
            }
            if (!Schema::hasColumn('external_service_orders', 'rejected_quantity')) {
                $table->decimal('rejected_quantity', 12, 2)->default(0.00)->after('returned_quantity');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('external_service_orders', function (Blueprint $table) {
            if (Schema::hasColumn('external_service_orders', 'operation_id')) {
                $table->dropForeign(['operation_id']);
                $table->dropColumn('operation_id');
            }
            if (Schema::hasColumn('external_service_orders', 'returned_quantity')) {
                $table->dropColumn('returned_quantity');
            }
            if (Schema::hasColumn('external_service_orders', 'rejected_quantity')) {
                $table->dropColumn('rejected_quantity');
            }
        });
    }
};
