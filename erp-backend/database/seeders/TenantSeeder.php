<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TenantSeeder extends Seeder
{
    /**
     * Seed the tenant's database connection.
     */
    public function run(): void
    {
        // 1. Seed Measurement Units
        DB::table('measurement_units')->insert([
            ['name' => 'متر', 'type' => 'length', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'كيلو', 'type' => 'weight', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'لوح', 'type' => 'general', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'حبة', 'type' => 'quantity', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'لتر', 'type' => 'volume', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'طقم', 'type' => 'quantity', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'متر مربع', 'type' => 'area', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 2. Seed Settings
        DB::table('settings')->insert([
            ['key' => 'company_name', 'value' => 'ورشة الأثاث والمواد', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'currency', 'value' => 'EGP', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'tax_rate', 'value' => '14', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 3. Seed Warehouses
        Warehouse::create([
            'name' => 'المخزن الرئيسي',
            'code' => 'WH-MAIN',
            'description' => 'المخزن الرئيسي لتخزين البضائع والمواد بمختلف أنواعها',
            'address' => 'المنطقة الصناعية',
            'notes' => 'يحتوي على نظام تكييف متكامل'
        ]);

        Warehouse::create([
            'name' => 'مخزن المواد الخام',
            'code' => 'WH-RAW',
            'description' => 'مخزن مخصص لتفريغ وتخزين المواد الخام الواردة من الموردين قبل التصنيع',
            'address' => 'المنطقة الصناعية - البوابة الشرقية',
            'notes' => 'قريب من خط الإنتاج الأول'
        ]);

        Warehouse::create([
            'name' => 'مخزن المنتجات الجاهزة',
            'code' => 'WH-FIN',
            'description' => 'مخزن مخصص لحفظ المنتجات الجاهزة للتسليم النهائي للعملاء المعارض',
            'address' => 'حي الملز',
            'notes' => 'مراقب بالكاميرات على مدار الساعة'
        ]);
    }
}
