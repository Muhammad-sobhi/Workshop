<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_production_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('work_date');
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('operation_id')->nullable()->constrained('operations')->nullOnDelete();
            $table->foreignId('labor_service_id')->nullable()       // materials.id where type='service'
                  ->constrained('materials')->nullOnDelete();       //   (تصنيع / تنجيد classification)
            $table->decimal('quantity', 10, 2);
            $table->decimal('piece_rate', 12, 2)->default(0);       // SNAPSHOT at save time
            $table->decimal('gross_wage', 12, 2)->default(0);       // quantity × piece_rate (stored)
            $table->decimal('deductions', 12, 2)->default(0);
            $table->string('deduction_reason')->nullable();
            $table->decimal('net_wage', 12, 2)->default(0);         // gross_wage − deductions (stored)
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['employee_id', 'work_date']);
            $table->index('product_id');
            $table->index('operation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_production_logs');
    }
};
