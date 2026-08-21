<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE employees MODIFY COLUMN salary_cycle ENUM('day', 'few_days', 'month', 'production', 'week') NOT NULL DEFAULT 'month'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE employees MODIFY COLUMN salary_cycle ENUM('day', 'few_days', 'month', 'production') NOT NULL DEFAULT 'month'");
        }
    }
};
