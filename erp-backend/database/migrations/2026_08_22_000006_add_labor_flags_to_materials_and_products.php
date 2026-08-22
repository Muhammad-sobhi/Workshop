<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->boolean('is_labor_based')->default(false)->after('service_location'); // تصنيع/تنجيد
        });
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('actual_labor_cost_cache', 15, 2)->default(0)->after('unit_cost'); // optional read cache
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn('is_labor_based');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('actual_labor_cost_cache');
        });
    }
};
