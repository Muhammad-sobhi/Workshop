<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_salaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')
                  ->constrained('employees')
                  ->cascadeOnDelete();
            $table->date('payment_date');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('base_salary', 12, 2);
            $table->decimal('production_quantity', 10, 2)->nullable();
            $table->decimal('production_rate', 12, 2)->nullable();
            $table->decimal('deductions', 12, 2)->default(0);
            $table->string('deduction_reason')->nullable();
            $table->decimal('net_salary', 12, 2);
            $table->string('payment_method')->default('cash');
            $table->string('receipt_path')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['employee_id', 'payment_date']);
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salaries');
    }
};
