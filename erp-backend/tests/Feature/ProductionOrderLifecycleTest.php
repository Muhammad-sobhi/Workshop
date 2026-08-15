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

    public function test_operation_number_generation_handles_soft_deleted_and_existing_unique_keys()
    {
        $this->withoutMiddleware();

        $wh = Warehouse::create(['name' => 'المخزن', 'code' => 'WSH-1']);
        $client = Client::create(['name' => 'عميل تجريبي']);

        // Create OP 1
        $op1 = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $wh->id,
            'total_price' => 100,
        ])->json('operation');

        // Create OP 2
        $op2 = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $wh->id,
            'total_price' => 200,
        ])->json('operation');

        // Soft delete OP 2
        \App\Models\Operation::find($op2['id'])->delete();

        // Create OP 3: Must NOT clash with OP 2, must generate next number cleanly!
        $op3Res = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $wh->id,
            'total_price' => 300,
        ]);
        $op3Res->assertStatus(201);
        $this->assertNotEquals($op2['operation_number'], $op3Res->json('operation.operation_number'));
    }

    public function test_partial_pull_from_stock_and_manufacture_remaining_quantity()
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whProd = Warehouse::create(['name' => 'مخزن المنتجات', 'code' => 'WSH-P']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات جزئية']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات جزئية']);

        // Material with 20 units in raw materials warehouse
        $material = Material::create([
            'name' => 'ماسورة حديد 40*40',
            'unit' => 'متر',
            'unit_cost' => 50.00,
            'stock_quantity' => 20,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);
        \App\Models\InventoryMovement::create([
            'movement_number' => 'MV-MAT-01',
            'movement_date' => \Carbon\Carbon::now(),
            'warehouse_id' => $whRaw->id,
            'material_id' => $material->id,
            'movement_type' => 'Initial_Balance',
            'quantity' => 20,
            'unit_cost' => 50.00,
            'total_cost' => 1000.00,
        ]);

        // Product already has 5 units in products warehouse (WSH-P)
        $product = Product::create([
            'name' => 'ترابيزة حديد كاملة',
            'unit' => 'حبة',
            'unit_cost' => 100.00,
            'sale_price' => 250.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 5,
        ]);
        \App\Models\InventoryMovement::create([
            'movement_number' => 'MV-PROD-01',
            'movement_date' => \Carbon\Carbon::now(),
            'warehouse_id' => $whProd->id,
            'product_id' => $product->id,
            'movement_type' => 'Initial_Balance',
            'quantity' => 5,
            'unit_cost' => 100.00,
            'total_cost' => 500.00,
        ]);

        // Each product requires 2 meters of material
        $product->materials()->attach($material->id, ['quantity' => 2]);

        $client = Client::create(['name' => 'عميل طلبية جزئية', 'phone' => '01234567890']);

        // Order 10 products with use_stock = true (5 from stock + 5 to manufacture)
        $opRes = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $whRaw->id,
            'use_stock' => true,
            'total_price' => 2500.00,
            'deposit_paid' => 500.00,
            'products' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10,
                ]
            ]
        ]);
        $opRes->assertStatus(201);
        $opId = $opRes->json('operation.id');

        // Check materials: should ONLY require materials for the remaining 5 products (5 * 2 = 10 meters)
        $checkRes = $this->getJson("/api/operations/{$opId}/check-materials");
        $checkRes->assertStatus(200);
        $this->assertFalse($checkRes->json('has_shortage'));
        $matCheck = $checkRes->json('materials.0');
        $this->assertEquals(10.0, $matCheck['required_quantity']); // 5 remaining to produce * 2 = 10
        $this->assertEquals(20.0, $matCheck['available_quantity']);
        $this->assertEquals(0.0, $matCheck['shortage_quantity']);

        // Complete production
        $compRes = $this->postJson("/api/operations/{$opId}/complete");
        $compRes->assertStatus(200);
        $this->assertEquals('Completed', $compRes->json('operation.status'));

        // Verify:
        // 1. Raw materials consumed = 10 meters (20 - 10 = 10 remaining in WSH-M)
        $this->assertEquals(10.0, (float)$material->calculateStock($whRaw->id));

        // 2. Products warehouse (WSH-P) has 0 units remaining (all 5 were pulled)
        $this->assertEquals(0.0, (float)$product->calculateStock($whProd->id));

        // 3. Client orders warehouse (WH-FIN) now has ALL 10 units (5 pulled from WSH-P + 5 newly produced)
        $this->assertEquals(10.0, (float)$product->calculateStock($whFin->id));

        // 4. Deliver to client
        $delivRes = $this->postJson("/api/operations/{$opId}/deliver");
        $delivRes->assertStatus(200);

        // 5. Client orders warehouse (WH-FIN) is now 0 after delivery
        $this->assertEquals(0.0, (float)$product->calculateStock($whFin->id));

        // 6. Sales revenue and COGS recorded for 10 units
        $salesRes = $this->getJson('/api/sales');
        $salesData = $salesRes->json();
        $this->assertCount(1, $salesData);
        $this->assertEquals(2500.00, $salesData[0]['amount']);
        $this->assertEquals(1000.00, $salesData[0]['product_cost']); // 10 * 100 unit_cost = 1000
    }

    public function test_production_for_stock_without_client_deposits_directly_to_products_warehouse_WSH_P()
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whProd = Warehouse::create(['name' => 'مستودع المنتجات الجاهزة', 'code' => 'WSH-P']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات تصنيع للتخزين']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'ترابيزات للمعرض']);

        $material = Material::create([
            'name' => 'حديد فورمايكا',
            'unit' => 'متر',
            'unit_cost' => 100.00,
            'stock_quantity' => 50,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);

        \App\Services\InventoryService::recordMovement(
            warehouseId: $whRaw->id,
            materialId: $material->id,
            productId: null,
            movementType: 'Initial_Balance',
            quantity: 50,
            unitCost: 100.00,
            referenceNumber: 'INIT-MAT-TEST',
            notes: 'رصيد أولي',
            userId: null
        );

        $product = Product::create([
            'name' => 'ترابيزة فورجيه فورمايكا لامع',
            'unit' => 'قطعة',
            'unit_cost' => 500.00,
            'sale_price' => 2408.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 0,
        ]);

        $product->materials()->attach($material->id, ['quantity' => 5]);

        // Create production order FOR STOCK (client_id is null)
        $opRes = $this->postJson('/api/operations', [
            'warehouse_id' => $whRaw->id,
            'client_id' => null, // NO client -> for showroom / stock
            'notes' => 'إنتاج للتخزين بالمعرض',
            'products' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10,
                ]
            ]
        ]);
        $opRes->assertStatus(201);
        $opId = $opRes->json('operation.id');

        // Complete production
        $compRes = $this->postJson("/api/operations/{$opId}/complete");
        $compRes->assertStatus(200);

        // Verification:
        // 1. Raw materials consumed = 10 * 5 = 50 meters
        $this->assertEquals(0.0, (float)$material->calculateStock($whRaw->id));

        // 2. WSH-P (مستودع المنتجات الجاهزة / المعرض) MUST have ALL 10 products ready for sale
        $this->assertEquals(10.0, (float)$product->calculateStock($whProd->id));

        // 3. WH-FIN (طلبيات العملاء) MUST remain 0 because this was for stock, not for a client
        $this->assertEquals(0.0, (float)$product->calculateStock($whFin->id));
    }

    public function test_two_sequential_orders_with_exact_manual_stock_and_manufacture_split()
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $whProd = Warehouse::create(['name' => 'معرض المنتجات', 'code' => 'WSH-P']);
        $whFin = Warehouse::create(['name' => 'مخزن طلبيات العملاء', 'code' => 'WH-FIN']);

        $matCat = \App\Models\MaterialCategory::create(['name' => 'خامات']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات']);

        $material = Material::create([
            'name' => 'حديد فورجيه',
            'unit' => 'متر',
            'unit_cost' => 50.00,
            'stock_quantity' => 20,
            'category_id' => $matCat->id,
            'warehouse_id' => $whRaw->id,
        ]);

        \App\Services\InventoryService::recordMovement(
            warehouseId: $whRaw->id,
            materialId: $material->id,
            productId: null,
            movementType: 'Initial_Balance',
            quantity: 20,
            unitCost: 50.00,
            referenceNumber: 'INIT-MAT-01'
        );

        $product = Product::create([
            'name' => 'ترابيزة فورجيه',
            'unit' => 'ترابيزة',
            'unit_cost' => 100.00,
            'sale_price' => 2700.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 8,
        ]);

        // Put initial 8 tables in WSH-P
        \App\Services\InventoryService::recordMovement(
            warehouseId: $whProd->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Initial_Balance',
            quantity: 8,
            unitCost: 100.00,
            referenceNumber: 'INIT-PRD-01'
        );

        $product->materials()->attach($material->id, ['quantity' => 2]); // 2 meters per table

        $client1 = Client::create(['name' => 'عميل 1', 'phone' => '01000000001']);
        $client2 = Client::create(['name' => 'عميل 2', 'phone' => '01000000002']);

        // Order 1: 5 tables taken 100% from storage (8 - 5 = 3 left in WSH-P)
        $op1Res = $this->postJson('/api/operations', [
            'client_id' => $client1->id,
            'warehouse_id' => $whRaw->id,
            'use_stock' => true,
            'products' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                    'quantity_taken_from_stock' => 5,
                ]
            ]
        ]);
        $op1Res->assertStatus(201);
        $this->assertEquals('Completed', $op1Res->json('operation.status'));

        // Verify stock in WSH-P is now 3, and WH-FIN has 5
        $this->assertEquals(3.0, (float)$product->calculateStock($whProd->id));
        $this->assertEquals(5.0, (float)$product->calculateStock($whFin->id));
        $this->assertEquals(20.0, (float)$material->calculateStock($whRaw->id)); // 0 raw materials consumed

        // Order 2: 2 tables requested: 1 taken from stock, 1 to manufacture
        $op2Res = $this->postJson('/api/operations', [
            'client_id' => $client2->id,
            'warehouse_id' => $whRaw->id,
            'use_stock' => true,
            'products' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'quantity_taken_from_stock' => 1,
                ]
            ]
        ]);
        $op2Res->assertStatus(201);
        $this->assertEquals('Pending', $op2Res->json('operation.status')); // Needs 1 manufactured
        $op2Id = $op2Res->json('operation.id');

        // Complete Order 2
        $comp2Res = $this->postJson("/api/operations/{$op2Id}/complete");
        $comp2Res->assertStatus(200);

        // Verification after Order 2:
        // 1. Storage WSH-P must have exactly 3 - 1 = 2 products!
        $this->assertEquals(2.0, (float)$product->calculateStock($whProd->id));

        // 2. WH-FIN has 5 (Order 1) + 2 (Order 2) = 7 products
        $this->assertEquals(7.0, (float)$product->calculateStock($whFin->id));

        // 3. Raw materials consumed = 1 table * 2 meters = 2 meters consumed (20 - 2 = 18 remaining in WSH-M)
        $this->assertEquals(18.0, (float)$material->calculateStock($whRaw->id));
    }
}

