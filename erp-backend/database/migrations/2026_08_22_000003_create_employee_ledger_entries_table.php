<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->date('entry_date');
            $table->string('type', 10);                              // 'credit' = labor accrued (+debt), 'debit' = paid (-debt)
            $table->decimal('amount', 12, 2);
            $table->text('description')->nullable();
            $table->string('source_type')->nullable();               // App\Models\EmployeeAttendance |
            $table->unsignedBigInteger('source_id')->nullable();     // EmployeeProductionLog | EmployeeSalary
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['employee_id', 'entry_date']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_ledger_entries');
    }
};
