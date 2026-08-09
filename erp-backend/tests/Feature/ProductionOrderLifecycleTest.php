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
}
