<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Material;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FifoBatchValuationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($this->user);

        $this->warehouse = Warehouse::create([
            'name' => 'معرض المنتجات الجاهزة',
            'code' => 'WSH-P',
        ]);
    }

    public function test_fifo_layers_tracks_multiple_batches_with_exact_costs()
    {
        $cat = ProductCategory::create(['name' => 'كراسي']);
        $product = Product::create([
            'name' => 'كرسي فورجيه كلاسيك',
            'code' => 'PRD-CHAIR-01',
            'category_id' => $cat->id,
            'unit' => 'كرسي',
            'unit_cost' => 1000.00,
            'sale_price' => 1500.00,
            'stock_quantity' => 0,
        ]);

        // 1. First Batch: Opening Balance 200 units @ cost 1000, sale price 1500
        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Initial_Balance',
            quantity: 200,
            unitCost: 1000.00,
            referenceNumber: 'INIT-2026-001',
            notes: 'رصيد افتتاحي دفعة أولى'
        );

        // 2. Second Batch: Production of 50 units @ cost 1400, sale price 2000
        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Production_Receipt',
            quantity: 50,
            unitCost: 1400.00,
            referenceNumber: 'OP-2026-002',
            notes: 'توريد إنتاج ورشة حديث بأسعار خامات جديدة'
        );

        // Check active FIFO layers before any sale
        $layers = InventoryService::getFifoLayers('product', $product->id, $this->warehouse->id);
        $this->assertCount(2, $layers);
        $this->assertEquals(200, $layers[0]['remaining_quantity']);
        $this->assertEquals(1000.00, $layers[0]['unit_cost']);
        $this->assertEquals(50, $layers[1]['remaining_quantity']);
        $this->assertEquals(1400.00, $layers[1]['unit_cost']);

        // 3. Consume 150 units (should come 100% from first batch @ 1000 cost)
        $consumption1 = InventoryService::consumeFifoQuantity('product', $product->id, $this->warehouse->id, 150);
        $this->assertEquals(150000.00, $consumption1['total_cogs']); // 150 * 1000
        $this->assertEquals(1000.00, $consumption1['blended_unit_cost']);

        // Record the physical sales movement
        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Sales_Issue',
            quantity: 150,
            unitCost: $consumption1['blended_unit_cost'],
            referenceNumber: 'INV-001'
        );

        // Verify remaining layers after first sale: Layer 1 has 50 left, Layer 2 has 50 left
        $layersAfterSale1 = InventoryService::getFifoLayers('product', $product->id, $this->warehouse->id);
        $this->assertCount(2, $layersAfterSale1);
        $this->assertEquals(50, $layersAfterSale1[0]['remaining_quantity']);
        $this->assertEquals(1000.00, $layersAfterSale1[0]['unit_cost']);
        $this->assertEquals(50, $layersAfterSale1[1]['remaining_quantity']);
        $this->assertEquals(1400.00, $layersAfterSale1[1]['unit_cost']);

        // 4. Consume 75 units (50 from Layer 1 @ 1000 + 25 from Layer 2 @ 1400)
        // Total expected COGS = (50 * 1000) + (25 * 1400) = 50,000 + 35,000 = 85,000
        $consumption2 = InventoryService::consumeFifoQuantity('product', $product->id, $this->warehouse->id, 75);
        $this->assertEquals(85000.00, $consumption2['total_cogs']);
        $this->assertEquals(round(85000 / 75, 2), $consumption2['blended_unit_cost']);

        // Record the second sales movement
        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Sales_Issue',
            quantity: 75,
            unitCost: $consumption2['blended_unit_cost'],
            referenceNumber: 'INV-002'
        );

        // Verify remaining layers: Layer 1 is 100% depleted, Layer 2 has 25 left
        $layersAfterSale2 = InventoryService::getFifoLayers('product', $product->id, $this->warehouse->id);
        $this->assertCount(1, $layersAfterSale2);
        $this->assertEquals('Production_Receipt', $layersAfterSale2[0]['movement_type']);
        $this->assertEquals(25, $layersAfterSale2[0]['remaining_quantity']);
        $this->assertEquals(1400.00, $layersAfterSale2[0]['unit_cost']);
    }

    public function test_warehouse_show_endpoint_returns_classified_stocks_and_fifo_batches()
    {
        $cat = ProductCategory::create(['name' => 'ترابيزات فورجيه']);
        $product = Product::create([
            'name' => 'ترابيزة فورمايكا لامع',
            'code' => 'PRD-TAB-01',
            'category_id' => $cat->id,
            'unit' => 'ترابيزة',
            'unit_cost' => 2000.00,
            'sale_price' => 2700.00,
            'stock_quantity' => 0,
        ]);

        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Initial_Balance',
            quantity: 10,
            unitCost: 2000.00,
            referenceNumber: 'INIT-TAB-01'
        );

        $res = $this->getJson("/api/warehouses/{$this->warehouse->id}");
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'warehouse',
            'stocks' => [
                '*' => [
                    'id',
                    'name',
                    'category',
                    'quantity',
                    'unit_cost',
                    'total_cost',
                    'batches_count',
                    'batches' => [
                        '*' => ['movement_type', 'remaining_quantity', 'unit_cost', 'total_cost']
                    ]
                ]
            ],
            'categories',
        ]);

        $this->assertEquals(['ترابيزات فورجيه'], $res->json('categories'));
        $this->assertEquals(1, $res->json('stocks.0.batches_count'));
        $this->assertEquals(10, $res->json('stocks.0.batches.0.remaining_quantity'));
    }
}
