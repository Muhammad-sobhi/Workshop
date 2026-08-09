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
        Schema::table('revenues', function (Blueprint $table) {
            if (!Schema::hasColumn('revenues', 'cogs')) {
                $table->decimal('cogs', 15, 2)->default(0.00)->after('amount');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('revenues', function (Blueprint $table) {
            if (Schema::hasColumn('revenues', 'cogs')) {
                $table->dropColumn('cogs');
            }
        });
    }
};
