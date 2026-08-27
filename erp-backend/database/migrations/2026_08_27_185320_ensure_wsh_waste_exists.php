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
        $exists = DB::table('warehouses')->where('code', 'WSH-WASTE')->exists();
        if (!$exists) {
            DB::table('warehouses')->insert([
                'name' => 'مخزن الهالك',
                'code' => 'WSH-WASTE',
                'notes' => 'مخزن افتراضي لتتبع هالك التصنيع وإعادة تدويره أو بيعه كخردة.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('warehouses')->where('code', 'WSH-WASTE')->delete();
    }
};
