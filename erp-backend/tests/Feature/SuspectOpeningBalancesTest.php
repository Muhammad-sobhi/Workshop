<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SuspectOpeningBalancesTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_items_whose_opening_balance_was_overwritten_after_other_movements()
    {
        $wh  = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $cat = \App\Models\MaterialCategory::create(['name' => 'خامات']);
        $make = fn ($name) => Material::create(['name' => $name, 'unit' => 'م', 'unit_cost' => 10, 'category_id' => $cat->id, 'warehouse_id' => $wh->id]);
        $opening = fn ($m, $qty) => InventoryMovement::create([
            'movement_number' => 'MV-INIT-MAT-' . $m->id, 'movement_date' => now(), 'warehouse_id' => $wh->id,
            'material_id' => $m->id, 'movement_type' => 'Initial_Balance', 'quantity' => $qty, 'unit_cost' => 10,
            'total_cost' => $qty * 10, 'reference_number' => 'INIT-MAT-' . $m->id,
        ]);

        // A: bought 100, then an edit created an opening balance of 100 (counted twice)
        Carbon::setTestNow('2026-10-01 10:00');
        $a = $make('خشب');
        InventoryService::recordMovement($wh->id, $a->id, null, 'Purchase_Receipt', 100, 10, 'PO-1');
        Carbon::setTestNow('2026-10-02 10:00');
        $opening($a, 100);

        // B: opening 50, bought 100, then an edit rewrote the opening to 150
        Carbon::setTestNow('2026-10-01 10:00');
        $b = $make('قماش');
        $bOpening = $opening($b, 50);
        Carbon::setTestNow('2026-10-01 11:00');
        InventoryService::recordMovement($wh->id, $b->id, null, 'Purchase_Receipt', 100, 10, 'PO-2');
        Carbon::setTestNow('2026-10-03 10:00');
        $bOpening->update(['quantity' => 150, 'total_cost' => 1500]);

        // C: opening balance set at creation, then normal use — fine
        Carbon::setTestNow('2026-10-01 10:00');
        $c = $make('حديد');
        $opening($c, 40);
        Carbon::setTestNow('2026-10-01 12:00');
        InventoryService::recordMovement($wh->id, $c->id, null, 'Purchase_Receipt', 10, 10, 'PO-3');
        Carbon::setTestNow();

        $this->artisan('inventory:suspect-opening-balances')
            ->expectsOutputToContain('2 item(s)')
            ->expectsTable(
                ['النوع', '#', 'الصنف', 'المستودع', 'رصيد أول المدة', 'تاريخ التعديل', 'الرصيد الحالي', 'زيادة محتملة', 'الرصيد المتوقع'],
                [
                    ['خامة', $a->id, 'خشب', 'مخزن المواد الخام', 100, '2026-10-02 10:00', 200, 100, 100],
                    ['خامة', $b->id, 'قماش', 'مخزن المواد الخام', 150, '2026-10-03 10:00', 250, 100, 150],
                ]
            )
            ->assertSuccessful();
    }

    public function test_reports_nothing_on_clean_data()
    {
        $this->artisan('inventory:suspect-opening-balances')
            ->expectsOutputToContain('No item had its opening balance overwritten')
            ->assertSuccessful();
    }
}
