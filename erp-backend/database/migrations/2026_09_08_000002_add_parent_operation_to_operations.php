<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operations', function (Blueprint $table) {
            // Links a sub-production order (for a missing sub-product) back to the
            // parent operation that triggered its creation. Nullable — most orders have no parent.
            $table->foreignId('parent_operation_id')
                ->nullable()
                ->after('id')
                ->constrained('operations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('operations', function (Blueprint $table) {
            $table->dropForeign(['parent_operation_id']);
            $table->dropColumn('parent_operation_id');
        });
    }
};
