<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_salaries', function (Blueprint $table) {
            $table->string('type', 20)->default('salary')->after('employee_id'); // 'salary' or 'advance'
            $table->date('week_start')->nullable()->after('end_date'); // anchor for weekly payouts
        });
    }

    public function down(): void
    {
        Schema::table('employee_salaries', function (Blueprint $table) {
            $table->dropColumn(['type', 'week_start']);
        });
    }
};
