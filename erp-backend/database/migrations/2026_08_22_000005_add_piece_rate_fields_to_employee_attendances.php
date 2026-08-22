<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_attendances', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('task_description')->constrained('products')->nullOnDelete();
            $table->decimal('quantity', 10, 2)->nullable()->after('product_id');
            $table->decimal('piece_rate', 10, 2)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('employee_attendances', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn(['product_id', 'quantity', 'piece_rate']);
        });
    }
};
