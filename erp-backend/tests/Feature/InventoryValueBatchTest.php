<?php

namespace Tests\Feature;

use App\Models\MaterialCategory;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryValueBatchTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;
    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->warehouse = Warehouse::create(['name' => 'Main', 'code' => 'WH-1']);
    }

    private function move(string $col, int $id, string $type, float $qty, float $cost, string $date): void
    {
        InventoryMovement::create([
            'movement_number' => 'T-' . (++$this->seq),
            'movement_date' => $date,
            'warehouse_id' => $this->warehouse->id,
            $col => $id,
            'movement_type' => $type,
            'quantity' => $qty,
            'unit_cost' => $cost,
            'total_cost' => round($qty * $cost, 2),
        ]);
    }

    private function perItemValue(string $type, $models): float
    {
        return (float) $models->sum(fn ($m) => InventoryService::getStock($type, $m->id) * (float) $m->calculateStoredUnitCost());
    }

    public function test_batched_inventory_figures_match_per_item_calculation()
    {
        $cat = ProductCategory::create(['name' => 'Chairs']);
        $p = fn ($code, $stock, $cost) => Product::create([
            'name' => $code, 'code' => $code, 'category_id' => $cat->id, 'unit' => 'pc',
            'unit_cost' => $cost, 'sale_price' => 100, 'stock_quantity' => $stock,
        ]);

        // Baseline stock only, no movements
        $p('P1', 12.5, 40);
        // Several FIFO batches, partly consumed, with decimal quantities
        $p2 = $p('P2', 0, 10);
        $this->move('product_id', $p2->id, 'Initial_Balance', 10.1, 50, '2026-01-01');
        $this->move('product_id', $p2->id, 'Production_Receipt', 0.2, 70.33, '2026-01-02');
        $this->move('product_id', $p2->id, 'Production_Receipt', 5, 80, '2026-01-02');
        $this->move('product_id', $p2->id, 'Sales_Issue', 10.3, 0, '2026-01-03');
        $this->move('product_id', $p2->id, 'Stock_Adjustment', 1.25, 90, '2026-01-04');
        $this->move('product_id', $p2->id, 'Stock_Adjustment', -0.4, 0, '2026-01-05');
        // Only outgoing movements on top of baseline stock
        $p3 = $p('P3', 20, 15);
        $this->move('product_id', $p3->id, 'Sales_Issue', 7.5, 0, '2026-02-01');
        // Fully consumed, falls back to unit_cost
        $p4 = $p('P4', 0, 33);
        $this->move('product_id', $p4->id, 'Production_Receipt', 4, 25, '2026-03-01');
        $this->move('product_id', $p4->id, 'Sales_Issue', 4, 0, '2026-03-02');
        // Zero-quantity adjustment only, zero cost
        $p5 = $p('P5', 3, 0);
        $this->move('product_id', $p5->id, 'Stock_Adjustment', 0, 0, '2026-04-01');

        $mc = MaterialCategory::create(['name' => 'Raw']);
        $m1 = Material::create(['category_id' => $mc->id, 'name' => 'Wood', 'sku' => 'M1', 'unit' => 'm', 'unit_cost' => 5, 'stock_quantity' => 0, 'type' => 'raw']);
        $this->move('material_id', $m1->id, 'Purchase_Receipt', 100, 5.55, '2026-01-01');
        $this->move('material_id', $m1->id, 'Purchase_Receipt', 50, 6.1, '2026-01-10');
        $this->move('material_id', $m1->id, 'Production_Consumption', 120.75, 0, '2026-01-15');
        Material::create(['category_id' => $mc->id, 'name' => 'Glue', 'sku' => 'M2', 'unit' => 'kg', 'unit_cost' => 2, 'stock_quantity' => 8, 'type' => 'raw']);

        // Movements in a second warehouse, for per-warehouse stock
        $wh2 = Warehouse::create(['name' => 'Showroom', 'code' => 'WH-2']);
        InventoryMovement::create(['movement_number' => 'T-W2', 'movement_date' => '2026-05-01', 'warehouse_id' => $wh2->id,
            'product_id' => $p2->id, 'movement_type' => 'Transfer_In', 'quantity' => 3.3, 'unit_cost' => 60, 'total_cost' => 198]);
        // Item types only some stock formulas count (Waste_Receipt / Sales_Return / Production_Waste)
        $this->move('material_id', $m1->id, 'Waste_Receipt', 2.2, 1, '2026-01-20');
        $this->move('material_id', $m1->id, 'Production_Waste', 0.7, 0, '2026-01-21');
        $this->move('product_id', $p3->id, 'Sales_Return', 1.1, 15, '2026-02-02');

        $products = Product::all();
        $materials = Material::where('type', '!=', 'service')->get();

        // MySQL sums decimals exactly (as in production) so results must be identical;
        // SQLite sums them as floats, so allow float noise there.
        $same = \DB::connection()->getDriverName() === 'mysql'
            ? fn ($expected, $actual, $msg) => $this->assertSame($expected, $actual, $msg)
            : fn ($expected, $actual, $msg) => $this->assertEqualsWithDelta($expected, $actual, 1e-9, $msg);

        foreach (['product' => $products, 'material' => Material::all()] as $type => $items) {
            $snapshot = \App\Services\InventorySnapshot::for($type, $items);
            foreach ($items as $item) {
                $same((float) $item->calculateStock(), $snapshot->calculateStock($item), "$type {$item->id} calculateStock");
                $same((float) $item->calculateStoredUnitCost(), $snapshot->storedUnitCost($item), "$type {$item->id} storedUnitCost");
                foreach ([null, $this->warehouse->id, $wh2->id] as $whId) {
                    $same(InventoryService::getStock($type, $item->id, $whId), $snapshot->liveStock($item, $whId), "$type {$item->id} getStock wh=$whId");
                }
            }
        }

        $this->assertSame($this->perItemValue('product', $products), InventoryService::getInventoryValue('product', $products));
        $this->assertSame($this->perItemValue('material', $materials), InventoryService::getInventoryValue('material', $materials));
    }
}
