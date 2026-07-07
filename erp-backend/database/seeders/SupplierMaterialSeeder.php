<?php

namespace Database\Seeders;

use App\Models\Supplier;
use App\Models\Material;
use Illuminate\Database\Seeder;

class SupplierMaterialSeeder extends Seeder
{
    public function run(): void
    {
        $sup1 = Supplier::find(1);
        $sup2 = Supplier::find(2);
        $sup3 = Supplier::find(3);

        if (!$sup1 || !$sup2 || !$sup3) {
            $this->command->info('Suppliers not found. Run DatabaseSeeder first.');
            return;
        }

        $pipe40 = Material::where('code', 'MAT-PIPE-40')->first();
        $pipe30 = Material::where('code', 'MAT-PIPE-30')->first();
        $sheet1 = Material::where('code', 'MAT-SHEET-1')->first();
        $sheet2 = Material::where('code', 'MAT-SHEET-2')->first();
        $paint  = Material::where('code', 'MAT-PAINT-ES')->first();
        $mdf    = Material::where('code', 'MAT-MDF')->first();
        $foam   = Material::where('code', 'MAT-FOAM-HD')->first();
        $lock   = Material::where('code', 'MAT-ACCESS-LOCK')->first();

        // Supplier 1: شركة النور للحديد
        $sup1->materials()->syncWithoutDetaching([
            $pipe40->id => ['price' => 12.00, 'notes' => 'المورد الرئيسي للمواسير'],
            $pipe30->id => ['price' => 9.00,  'notes' => 'توريد مستمر'],
            $sheet1->id => ['price' => 44.00, 'notes' => 'صاج مجلفن عالي الجودة'],
            $sheet2->id => ['price' => 73.00, 'notes' => 'متوفر بكميات كبيرة'],
        ]);

        // Supplier 2: شركة الرواد للمعادن
        $sup2->materials()->syncWithoutDetaching([
            $sheet2->id => ['price' => 72.00, 'notes' => 'أسعار الموسم'],
            $paint->id  => ['price' => 7.50,  'notes' => 'بودرة دهان معتمدة'],
        ]);

        // Supplier 3: مؤسسة الأمل التجارية
        $sup3->materials()->syncWithoutDetaching([
            $mdf->id  => ['price' => 54.00, 'notes' => 'ألواح MDF ممتازة'],
            $foam->id => ['price' => 14.50, 'notes' => 'إسفنج كثافة عالية'],
            $lock->id => ['price' => 4.80,  'notes' => 'إكسسوارات مستوردة'],
        ]);

        $this->command->info('Supplier materials seeded successfully!');
    }
}
