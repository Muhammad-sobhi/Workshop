<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\Operation;
use App\Models\Product;
use App\Models\Revenue;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionOrderLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_order_full_lifecycle_and_deletion_rules()
    {
        $this->withoutMiddleware();

        // Setup initial warehouses, material, product, and client
        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات عامة']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات عامة']);

        $material = Material::create([
            'name' => 'خشب فورماليكا',
            'unit' => 'متر',
            'unit_cost' => 100.00,
            'stock_quantity' => 50,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);

        $product = Product::create([
            'name' => 'ترابيزة فورجيه',
            'unit' => 'حبة',
            'unit_cost' => 500.00,
            'sale_price' => 1000.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 0,
        ]);

        // Link product to material (2 meters per product)
        $product->materials()->attach($material->id, ['quantity' => 2]);

        $client = Client::create([
            'name' => 'شركة الأمل',
            'phone' => '01000000000',
        ]);

        // ----------------------------------------------------
        // PHASE 1: Create & Start Production Order (Before "إتمام التصنيع")
        // ----------------------------------------------------
        $opRes = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $whRaw->id,
            'product_id' => $product->id,
            'quantity' => 5,
            'total_price' => 5000.00,
            'deposit_paid' => 1000.00,
            'deposit_payment_method' => 'cash',
        ]);
        $opRes->assertStatus(201);
        $opId = $opRes->json('operation.id');

        // Verify raw material is NOT pulled yet
        $this->assertEquals(50, $material->fresh()->stock_quantity);

        // Start production
        $this->postJson("/api/operations/{$opId}/start")->assertStatus(200);
        // Verify raw material is STILL NOT pulled (remains 50)
        $this->assertEquals(50, $material->fresh()->stock_quantity);

        // Verify /sales does NOT report undelivered order deposit as completed sales revenue
        $salesRes = $this->getJson('/api/sales');
        $this->assertCount(0, $salesRes->json());

        // ----------------------------------------------------
        // PHASE 2: Press "إتمام التصنيع" (Complete Production)
        // ----------------------------------------------------
        $compRes = $this->postJson("/api/operations/{$opId}/complete");
        $compRes->assertStatus(200);

        // Raw materials consumed: 5 products * 2 meters = 10 meters consumed -> 40 remaining
        $this->assertEquals(40, $material->fresh()->stock_quantity);

        // Finished products added to "طلبيات" (WH-FIN): 5 products
        $this->assertEquals(5, $product->fresh()->stock_quantity);

        // Verify /sales STILL does NOT contain undelivered completed order
        $salesRes = $this->getJson('/api/sales');
        $this->assertCount(0, $salesRes->json());

        // ----------------------------------------------------
        // PHASE 3: Press "client received his order" (Deliver)
        // ----------------------------------------------------
        $delivRes = $this->postJson("/api/operations/{$opId}/deliver");
        $delivRes->assertStatus(200);

        // Products delivered: 5 products issued -> 0 stock remaining
        $this->assertEquals(0, $product->fresh()->stock_quantity);

        // Verify /sales now returns delivered order with total price and COGS
        $salesRes = $this->getJson('/api/sales');
        $salesData = $salesRes->json();
        $this->assertCount(1, $salesData);
        $this->assertEquals(5000.00, $salesData[0]['amount']);
        $this->assertEquals(2500.00, $salesData[0]['product_cost']); // 5 * 500 unit_cost = 2500
    }

    public function test_deletion_rules_after_completion()
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات عامة 2']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات عامة 2']);

        $material = Material::create([
            'name' => 'حديد فورجيه',
            'unit' => 'كجم',
            'unit_cost' => 50.00,
            'stock_quantity' => 100,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);

        $product = Product::create([
            'name' => 'كرسي فورجيه',
            'unit' => 'حبة',
            'unit_cost' => 200.00,
            'sale_price' => 400.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 0,
        ]);

        $product->materials()->attach($material->id, ['quantity' => 4]);

        $client = Client::create(['name' => 'عميل تجربة']);

        $opRes = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $whRaw->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'total_price' => 4000.00,
            'deposit_paid' => 500.00,
        ]);
        $opId = $opRes->json('operation.id');

        // Complete production
        $this->postJson("/api/operations/{$opId}/complete")->assertStatus(200);

        // Material consumed: 10 * 4 = 40 kg -> 60 remaining
        $this->assertEquals(60, $material->fresh()->stock_quantity);
        // Products produced: 10 units in WH-FIN
        $this->assertEquals(10, $product->fresh()->stock_quantity);

        // Delete completed production order
        $this->deleteJson("/api/operations/{$opId}")->assertStatus(200);

        // Requirement: Products STAY in "طلبيات" (10 units) and materials STAY consumed (60 kg)
        $this->assertEquals(60, $material->fresh()->stock_quantity);
        $this->assertEquals(10, $product->fresh()->stock_quantity);
    }

    public function test_use_pre_stored_products_in_production_order()
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whProd = Warehouse::create(['name' => 'مخزن المنتجات', 'code' => 'WSH-P']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات تجربة']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات تجربة']);

        // Material with 0 stock
        $material = Material::create([
            'name' => 'ترابيزه فورجيه بنز',
            'unit' => 'حبة',
            'unit_cost' => 50.00,
            'stock_quantity' => 0,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);

        // Product already has 5 units in stock
        $product = Product::create([
            'name' => 'ترابيزه فورجيه فورمايكا لامع',
            'unit' => 'ترابيزه',
            'unit_cost' => 1500.00,
            'sale_price' => 2800.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 5,
        ]);

        // Put initial balance movement in WSH-P
        \App\Models\InventoryMovement::create([
            'movement_number' => 'MV-00001',
            'movement_date' => \Carbon\Carbon::now(),
            'warehouse_id' => $whProd->id,
            'product_id' => $product->id,
            'movement_type' => 'Initial_Balance',
            'quantity' => 5,
            'unit_cost' => 1500.00,
            'total_cost' => 7500.00,
        ]);

        $product->materials()->attach($material->id, ['quantity' => 1]);

        $client = Client::create(['name' => 'محمود', 'phone' => '01111111111']);

        // Create order for 5 tables with use_stock = true
        $opRes = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $whRaw->id,
            'use_stock' => true,
            'total_price' => 14000.00,
            'deposit_paid' => 0.00,
            'products' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                ]
            ]
        ]);
        $opRes->assertStatus(201);
        $opId = $opRes->json('operation.id');

        // Check materials: should NOT have shortage because all 5 are taken from stock
        $checkRes = $this->getJson("/api/operations/{$opId}/check-materials");
        $checkRes->assertStatus(200);
        $this->assertFalse($checkRes->json('has_shortage'));

        // Complete production: should succeed without error even though raw material stock is 0!
        $compRes = $this->postJson("/api/operations/{$opId}/complete");
        $compRes->assertStatus(200);
        $this->assertEquals('Completed', $compRes->json('operation.status'));

        // Deliver to client: should deliver all 5 units successfully
        $delivRes = $this->postJson("/api/operations/{$opId}/deliver");
        $delivRes->assertStatus(200);
        $this->assertEquals(0, $product->fresh()->stock_quantity);
    }
}
