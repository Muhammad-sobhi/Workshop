<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->decimal('stock_quantity', 15, 2)->default(0.00)->after('unit_cost');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->decimal('stock_quantity', 15, 2)->default(0.00)->after('unit_cost');
        });

        DB::statement('UPDATE materials m SET stock_quantity = (
            SELECT COALESCE(SUM(
                CASE
                    WHEN im.movement_type IN (\'Initial_Balance\', \'Purchase_Receipt\', \'Transfer_In\') THEN im.quantity
                    WHEN im.movement_type = \'Stock_Adjustment\' AND im.quantity > 0 THEN im.quantity
                    ELSE -im.quantity
                END
            ), 0)
            FROM inventory_movements im
            WHERE im.material_id = m.id
        )');

        DB::statement('UPDATE products p SET stock_quantity = (
            SELECT COALESCE(SUM(
                CASE
                    WHEN im.movement_type IN (\'Initial_Balance\', \'Purchase_Receipt\', \'Transfer_In\') THEN im.quantity
                    WHEN im.movement_type = \'Stock_Adjustment\' AND im.quantity > 0 THEN im.quantity
                    ELSE -im.quantity
                END
            ), 0)
            FROM inventory_movements im
            WHERE im.product_id = p.id
        )');
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn('stock_quantity');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('stock_quantity');
        });
    }
};
