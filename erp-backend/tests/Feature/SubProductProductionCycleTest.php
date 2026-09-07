<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Operation;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductMaterial;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubProductProductionCycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_subproduct_bom_cycle_and_fifo_costing()
    {
        $this->withoutMiddleware();

        // 1. Warehouses
        $whRaw  = Warehouse::create(['name' => 'مخزن الخامات', 'code' => 'WSH-M']);
        $whProd = Warehouse::create(['name' => 'مخزن المنتجات الجاهزة', 'code' => 'WSH-P']);
        $whFin  = Warehouse::create(['name' => 'طلبيات العملاء', 'code' => 'WH-FIN']);

        $matCat  = MaterialCategory::create(['name' => 'معادن']);
        $prodCat = ProductCategory::create(['name' => 'أثاث']);

        // 2. Raw Material: Iron for Legs
        $iron = Material::create([
            'name'           => 'حديد زاوية للأرجل',
            'sku'            => 'MAT-IRON-01',
            'unit'           => 'كجم',
            'unit_cost'      => 20.00,
            'stock_quantity' => 200, // 200 kg available
            'category_id'    => $matCat->id,
            'warehouse_id'   => $whRaw->id,
        ]);
        InventoryService::recordMovement(
            warehouseId: $whRaw->id,
            materialId: $iron->id,
            productId: null,
            movementType: 'Purchase_Receipt',
            quantity: 200,
            unitCost: 20.00,
            referenceNumber: 'INIT-IRON'
        );

        // Raw Material: Wood Top for Table (direct material)
        $wood = Material::create([
            'name'           => 'لوح خشب مسطح',
            'sku'            => 'MAT-WOOD-01',
            'unit'           => 'لوح',
            'unit_cost'      => 150.00,
            'stock_quantity' => 20, // 20 boards
            'category_id'    => $matCat->id,
            'warehouse_id'   => $whRaw->id,
        ]);
        InventoryService::recordMovement(
            warehouseId: $whRaw->id,
            materialId: $wood->id,
            productId: null,
            movementType: 'Purchase_Receipt',
            quantity: 20,
            unitCost: 150.00,
            referenceNumber: 'INIT-WOOD'
        );

        // 3. Sub-Product: Table Leg
        // Each leg needs 2 kg of Iron
        $leg = Product::create([
            'name'           => 'رجل طاولة معدنية',
            'sku'            => 'SUB-LEG-01',
            'unit'           => 'قطعة',
            'unit_cost'      => 40.00,
            'sale_price'     => 60.00,
            'category_id'    => $prodCat->id,
            'stock_quantity' => 10, // 10 legs already in stock
        ]);
        $leg->materials()->attach($iron->id, ['quantity' => 2]); // 2 kg iron per leg

        // Record initial stock for 10 legs at 40.00 in products warehouse
        InventoryService::recordMovement(
            warehouseId: $whProd->id,
            materialId: null,
            productId: $leg->id,
            movementType: 'Production_Receipt',
            quantity: 10,
            unitCost: 40.00,
            referenceNumber: 'INIT-LEGS'
        );

        // 4. Main Product: Dining Table
        // Each table needs 1 Wood top (direct material) + 4 Legs (sub-product)
        $table = Product::create([
            'name'           => 'طاولة طعام مودرن',
            'sku'            => 'PROD-TABLE-01',
            'unit'           => 'قطعة',
            'unit_cost'      => 310.00, // estimated
            'sale_price'     => 600.00,
            'category_id'    => $prodCat->id,
            'stock_quantity' => 0,
        ]);
        $table->materials()->attach($wood->id, ['quantity' => 1]); // 1 wood board

        // Link leg as sub-product in BOM (4 legs per table)
        ProductMaterial::create([
            'product_id'     => $table->id,
            'sub_product_id' => $leg->id,
            'quantity'       => 4,
        ]);

        $client = Client::create([
            'name'  => 'عميل تجريبي للطلبية',
            'phone' => '01111111111',
        ]);

        // 5. Create Production Order: 10 Tables
        $createRes = $this->postJson('/api/operations', [
            'client_id'    => $client->id,
            'warehouse_id' => $whRaw->id,
            'products'     => [
                ['product_id' => $table->id, 'quantity' => 10]
            ],
        ]);
        $createRes->assertStatus(201);
        $opId = $createRes->json('id') ?? $createRes->json('operation.id');

        // 6. Test check-materials endpoint (GAP-5 + BUG-1 readiness)
        // 10 tables require 40 legs.
        // Stock has 10 legs -> shortage is 30 legs.
        // 30 legs shortage require 60 kg iron (2 kg * 30).
        $checkRes = $this->getJson("/api/operations/{$opId}/check-materials");
        $checkRes->assertStatus(200);

        $checkData = $checkRes->json();
        $this->assertTrue($checkData['has_sub_product_shortage']);
        $this->assertTrue($checkData['can_auto_produce_sub_products']);
        $this->assertFalse($checkData['has_material_shortage']);

        // Check sub-product analysis
        $this->assertNotEmpty($checkData['sub_products']);
        $subCheck = $checkData['sub_products'][0];
        $this->assertEquals($leg->id, $subCheck['id']);
        $this->assertEquals(40.0, (float)$subCheck['required_quantity']);
        $this->assertEquals(10.0, (float)$subCheck['available_quantity']);
        $this->assertEquals(30.0, (float)$subCheck['shortage_quantity']);
        $this->assertTrue($subCheck['can_produce']);

        // GAP-5: Verify sub_products_from_stock contains FIFO cost for the 10 legs
        $this->assertNotEmpty($checkData['sub_products_from_stock']);
        $fromStockCheck = $checkData['sub_products_from_stock'][0];
        $this->assertEquals($leg->id, $fromStockCheck['id']);
        $this->assertEquals(10.0, (float)$fromStockCheck['quantity_from_stock']);
        $this->assertEquals(400.0, (float)$fromStockCheck['fifo_cost']); // 10 * 40.00
        $this->assertEquals(40.0, (float)$fromStockCheck['avg_unit_cost']);

        // 7. Test bom-tree API endpoint (BUG-1)
        $treeRes = $this->getJson("/api/operations/{$opId}/bom-tree");
        $treeRes->assertStatus(200);
        $treeData = $treeRes->json('bom_tree');
        $this->assertNotEmpty($treeData);
        $this->assertEquals($table->id, $treeData[0]['product_id']);
        $this->assertEquals(10.0, (float)$treeData[0]['quantity']);
        $this->assertNotEmpty($treeData[0]['bom']);

        // 8. Start production with auto_produce_sub_products = true
        $startRes = $this->postJson("/api/operations/{$opId}/start", [
            'auto_produce_sub_products' => true
        ]);
        $startRes->assertStatus(200);

        // 9. Verify child operation was created and completed for the 30 legs
        $childOps = Operation::where('parent_operation_id', $opId)->get();
        $this->assertCount(1, $childOps);
        $childOp = $childOps->first();
        $this->assertEquals($leg->id, $childOp->product_id);
        $this->assertEquals(30.0, (float)$childOp->quantity);
        $this->assertEquals('Completed', $childOp->status);

        // Iron consumed: 30 legs * 2 kg = 60 kg consumed -> 200 - 60 = 140 kg remaining
        $this->assertEquals(140.0, (float)InventoryService::getStock('material', $iron->id, $whRaw->id));

        // Wood consumed at start (GAP-6): 10 tables * 1 board = 10 boards consumed -> 20 - 10 = 10 remaining
        $this->assertEquals(10.0, (float)InventoryService::getStock('material', $wood->id, $whRaw->id));

        // Legs stock: 10 initial + 30 produced = 40, minus 40 consumed by parent order at start = 0 remaining
        $this->assertEquals(0.0, (float)InventoryService::getStock('product', $leg->id, $whProd->id));

        // 10. Complete parent production order
        $completeRes = $this->postJson("/api/operations/{$opId}/complete");
        $completeRes->assertStatus(200);

        // Tables received in WH-FIN: 10 units
        $this->assertEquals(10.0, (float)InventoryService::getStock('product', $table->id, $whFin->id));

        // BUG-3: Verify table unit_cost was updated to actual production cost
        // Cost: 10 boards * 150 = 1500; 40 legs * 40 = 1600. Total = 3100 / 10 = 310.00
        $this->assertEquals(310.00, (float)$table->fresh()->unit_cost);

        // 11. Verify index() lists parent operation with childOperations, but does NOT list childOp at root
        $indexRes = $this->getJson('/api/operations');
        $indexRes->assertStatus(200);
        $opsInList = collect($indexRes->json('data'));
        $this->assertTrue($opsInList->contains('id', $opId));
        $this->assertFalse($opsInList->contains('id', $childOp->id));

        $parentInList = $opsInList->firstWhere('id', $opId);
        $this->assertArrayHasKey('child_operations', $parentInList);
        $this->assertCount(1, $parentInList['child_operations']);
        $this->assertEquals($childOp->id, $parentInList['child_operations'][0]['id']);
    }
}
