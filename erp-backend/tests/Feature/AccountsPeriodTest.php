<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountsPeriodTest extends TestCase
{
    use RefreshDatabase;

    private function kpi(array $res, string $label): float
    {
        $row = collect($res['kpis'])->first(fn ($k) => str_contains($k['label'], $label));
        return (float) preg_replace('/[^0-9.\-]/', '', $row['value']);
    }

    public function test_accounts_period_and_expense_chart()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $wh = Warehouse::create(['name' => 'معرض', 'code' => 'WSH-P']);
        $p = Product::create(['name' => 'كرسي', 'unit' => 'حبة', 'unit_cost' => 40, 'sale_price' => 100, 'stock_quantity' => 0,
            'category_id' => ProductCategory::create(['name' => 'x'])->id]);
        InventoryService::recordMovement(warehouseId: $wh->id, materialId: null, productId: $p->id, movementType: 'Initial_Balance', quantity: 10, unitCost: 40, referenceNumber: 'I');

        foreach ([[2, '2026-09-15'], [3, '2026-10-05']] as [$qty, $date]) {
            $this->postJson('/api/sales', ['product_id' => $p->id, 'quantity' => $qty, 'price' => 100, 'invoice_date' => $date,
                'payment_method' => 'cash', 'warehouse_id' => $wh->id])->assertStatus(201);
        }
        foreach ([[50, '2026-09-20', 'كهرباء'], [30, '2026-10-07', 'كهرباء'], [20, '2026-10-08', 'إيجار']] as [$amount, $date, $cat]) {
            $this->postJson('/api/expenses', ['amount' => $amount, 'expense_date' => $date, 'category' => $cat, 'description' => 'x'])->assertStatus(201);
        }

        // Accounts page: October only, same equations as before
        $oct = $this->getJson('/api/dashboard?start_date=2026-10-01&date=2026-10-31')->assertOk()->json();
        $this->assertEquals(300, $this->kpi($oct, 'إجمالي الإيرادات'));
        $this->assertEquals(120, $this->kpi($oct, 'COGS'));
        $this->assertEquals(180, $this->kpi($oct, 'مجمل الربح'));
        $this->assertEquals(50, $this->kpi($oct, 'المصروفات'));
        $this->assertEquals(130, $this->kpi($oct, 'صافي الربح'));
        $this->assertEqualsCanonicalizing([['name' => 'كهرباء', 'value' => 30.0], ['name' => 'إيجار', 'value' => 20.0]], $oct['expense_by_category']);

        // Home dashboard (no start_date): unchanged, cumulative up to the date
        $home = $this->getJson('/api/dashboard?date=2026-10-31')->assertOk()->json();
        $this->assertEquals(500, $this->kpi($home, 'إجمالي الإيرادات'));
        $this->assertEquals(100, $this->kpi($home, 'المصروفات'));
        $this->assertEquals(200, $this->kpi($home, 'صافي الربح'));
    }
}
