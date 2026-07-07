<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        DB::table('settings')->insert([
            ['key' => 'company_name', 'value' => 'نظام ERP'],
            ['key' => 'currency', 'value' => 'ر.س'],
            ['key' => 'tax_rate', 'value' => '15'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
