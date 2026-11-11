<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Operation;
use App\Models\OperationProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductMaterial;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\OperationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationMaterialShortagesTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $raw;
    private Warehouse $prod;
    private Client $client;
    private Material $wood;
    private Material $paint;
    private Product $table;   // 2 wood + 4 legs + 1 hinge
    private Product $leg;     // manufactured sub-product: 0.5 wood + 0.1 paint
    private Product $hinge;   // bought ready, no BOM

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->raw = Warehouse::create(['name' => 'خامات', 'code' => 'WSH-M', 'location' => 'x']);
        $this->prod = Warehouse::create(['name' => 'منتجات', 'code' => 'WSH-P', 'location' => 'x']);
        Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN', 'location' => 'x']);
        $this->client = Client::create(['name' => 'حسين']);

        $cat = ProductCategory::create(['name' => 'ترابيزات']);
        $product = fn ($name) => Product::create(['name' => $name, 'code' => $name, 'category_id' => $cat->id, 'unit' => 'قطعة', 'unit_cost' => 10, 'sale_price' => 100]);
        $matCat = MaterialCategory::create(['name' => 'أخشاب']);
        $material = fn ($name, $type = 'material') => Material::create(['name' => $name, 'code' => $name, 'category_id' => $matCat->id, 'unit' => 'متر', 'unit_cost' => 5, 'type' => $type]);

        [$this->table, $this->leg, $this->hinge] = [$product('ترابيزة'), $product('رجل'), $product('مفصلة')];
        [$this->wood, $this->paint] = [$material('خشب'), $material('دهان')];
        $service = $material('تقطيع', 'service');

        $bom = fn ($p, $attrs) => ProductMaterial::create(['product_id' => $p->id] + $attrs);
        $bom($this->table, ['material_id' => $this->wood->id, 'quantity' => 2]);
        $bom($this->table, ['material_id' => $service->id, 'quantity' => 1]);
        $bom($this->table, ['sub_product_id' => $this->leg->id, 'quantity' => 4]);
        $bom($this->table, ['sub_product_id' => $this->hinge->id, 'quantity' => 1]);
        $bom($this->leg, ['material_id' => $this->wood->id, 'quantity' => 0.5]);
        $bom($this->leg, ['material_id' => $this->paint->id, 'quantity' => 0.1]);
    }

    private function order(string $status, float $qty, float $fromStock = 0, ?int $clientId = null): Operation
    {
        $op = Operation::create([
            'product_id' => $this->table->id, 'quantity' => $qty, 'warehouse_id' => $this->raw->id,
            'status' => $status, 'client_id' => $clientId, 'deposit_paid' => 0,
        ]);
        OperationProduct::create(['operation_id' => $op->id, 'product_id' => $this->table->id, 'quantity' => $qty, 'quantity_taken_from_stock' => $fromStock]);
        return $op;
    }

    private function stock(string $type, $model, float $qty): void
    {
        InventoryService::recordMovement(
            $type === 'material' ? $this->raw->id : $this->prod->id,
            $type === 'material' ? $model->id : null,
            $type === 'product' ? $model->id : null,
            $type === 'material' ? 'Purchase_Receipt' : 'Production_Receipt',
            $qty,
            5
        );
    }

    private function shortages(): array
    {
        return $this->getJson('/api/operations/material-shortages')->assertOk()->json();
    }

    private function row(array $rows, $model): ?array
    {
        return collect($rows)->firstWhere('id', $model->id);
    }

    public function test_sums_needs_of_pending_orders_and_explodes_short_sub_products()
    {
        $this->stock('material', $this->wood, 30);
        $this->stock('product', $this->leg, 10);
        $this->stock('product', $this->hinge, 3);

        $first = $this->order('Pending', 5, 0, $this->client->id);   // 10 wood, 20 legs, 5 hinges
        $second = $this->order('Pending', 10, 4);                    // makes 6: 12 wood, 24 legs, 6 hinges
        $this->order('In_Progress', 100);
        $this->order('Completed', 100);
        $this->order('Cancelled', 100);

        $res = $this->shortages();
        $this->assertEquals(2, $res['orders_count']);

        // legs: 44 needed, 10 in stock → 34 made: 17 wood + 3.4 paint. wood total 10 + 12 + 17 = 39
        $wood = $this->row($res['materials'], $this->wood);
        $this->assertEquals([39, 30, 9], [$wood['required'], $wood['available'], $wood['shortage']]);
        $this->assertEquals(
            [[$first->operation_number, 'حسين', 15], [$second->operation_number, null, 24]],
            array_map(fn ($o) => [$o['operation_number'], $o['client_name'], $o['quantity']], $wood['orders'])
        );

        $paint = $this->row($res['materials'], $this->paint);
        $this->assertEquals([3.4, 0, 3.4], [$paint['required'], $paint['available'], $paint['shortage']]);
        $this->assertCount(2, $res['materials']); // the service line is never a shortage

        // The bought product stays a product, the manufactured sub-product never shows as one
        $this->assertCount(1, $res['products']);
        $hinge = $this->row($res['products'], $this->hinge);
        $this->assertEquals([11, 3, 8], [$hinge['required'], $hinge['available'], $hinge['shortage']]);
    }

    public function test_nothing_short_when_stock_covers_all_orders_together()
    {
        $this->stock('material', $this->wood, 8);
        $this->stock('product', $this->leg, 16);
        $this->stock('product', $this->hinge, 4);
        $this->order('Pending', 2);
        $this->order('Pending', 2);
        $this->order('Pending', 5, 5); // fully from stock

        $this->assertEquals(['orders_count' => 3, 'materials' => [], 'products' => []], $this->shortages());

        // Each order alone is still covered, but one more unit of wood demand is not
        $this->order('Pending', 1);
        $res = $this->shortages();
        $this->assertEquals(4, $this->row($res['materials'], $this->wood)['shortage']); // 2 + 4 legs × 0.5
        $this->assertEquals(1, $this->row($res['products'], $this->hinge)['shortage']);
    }

    public function test_started_and_cancelled_orders_leave_the_report()
    {
        $this->stock('material', $this->wood, 4);
        $this->stock('product', $this->leg, 8);
        $this->stock('product', $this->hinge, 2);
        $a = $this->order('Pending', 2);
        $b = $this->order('Pending', 2);

        // wood: 8 direct + 8 short legs × 0.5 = 12 against 4 in stock
        $this->assertEquals(8, $this->row($this->shortages()['materials'], $this->wood)['shortage']);

        // Starting A issues its materials: only B remains, against what is left in stock
        OperationService::startProduction($a->fresh());
        $res = $this->shortages();
        $this->assertEquals(1, $res['orders_count']);
        $wood = $this->row($res['materials'], $this->wood);
        $this->assertEquals([8, 0, 8], [$wood['required'], $wood['available'], $wood['shortage']]);

        // Cancelling A in progress returns its materials and sub-products to stock
        OperationService::cancelProduction($a->fresh(['payments']));
        $this->assertEquals(['orders_count' => 1, 'materials' => [], 'products' => []], $this->shortages());

        OperationService::cancelProduction($b->fresh(['payments']));
        $this->assertEquals(0, $this->shortages()['orders_count']);
    }
}
