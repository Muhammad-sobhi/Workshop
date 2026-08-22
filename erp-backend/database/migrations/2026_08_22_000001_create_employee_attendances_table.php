<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('work_date');
            $table->string('work_mode', 20)->default('full_day');    // full_day|half_day|piece_rate|hybrid|absent|leave
            $table->string('task_description')->nullable();           // free-text task label (for time-based / hybrid days)
            $table->enum('status', ['present', 'absent', 'half_day', 'leave', 'holiday'])->default('present');
            $table->decimal('daily_wage', 12, 2)->default(0);        // wage ACCRUED for this day (snapshot)
            $table->decimal('penalty_amount', 12, 2)->default(0);    // reduces the accrued wage
            $table->string('penalty_reason')->nullable();
            $table->decimal('advance_amount', 12, 2)->default(0);    // cash HANDED this day (settles debt)
            $table->foreignId('advance_salary_id')->nullable()       // -> employee_salaries (created if advance>0)
                  ->constrained('employee_salaries')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['employee_id', 'work_date']);            // one row per person/day
            $table->index('work_date');
            $table->index(['employee_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_attendances');
    }
};
