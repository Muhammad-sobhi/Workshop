<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('products', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('suppliers', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('warehouses', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('operations', function (Blueprint $table) {
            $table->softDeletes();
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('warehouses', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('operations', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
