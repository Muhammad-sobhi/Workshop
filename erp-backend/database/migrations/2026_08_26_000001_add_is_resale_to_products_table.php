<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'is_resale')) {
                $table->boolean('is_resale')->default(false)->index()->after('unit_cost');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'is_resale')) {
                $table->dropIndex(['is_resale']);
                $table->dropColumn('is_resale');
            }
        });
    }
};
