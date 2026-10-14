<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderEditStockTest extends TestCase
{
    use RefreshDatabase;

    public function test_editing_a_received_order_repeatedly_keeps_only_the_latest_quantities_in_stock()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'sanctum');

        $raw = Warehouse::create(['name' => 'المواد الخام', 'code' => 'WSH-M']);
        $prod = Warehouse::create(['name' => 'المنتجات الجاهزة', 'code' => 'WSH-P']);
        $supplier = Supplier::create(['name' => 'مورد', 'phone' => '01000000010', 'debt_amount' => 0]);

        $category = MaterialCategory::create(['name' => 'خوص'])->id;
        $palm = Material::create(['category_id' => $category, 'name' => 'خوص عروسة', 'unit' => 'طقم', 'unit_cost' => 20, 'stock_quantity' => 0]);
        $beans = Material::create(['category_id' => $category, 'name' => 'فول صغيرة', 'unit' => 'كمية', 'unit_cost' => 1, 'stock_quantity' => 0]);
        $chair = Product::create([
            'category_id' => ProductCategory::create(['name' => 'كراسي'])->id,
            'name' => 'كرسي', 'unit' => 'حبة', 'unit_cost' => 0, 'sale_price' => 500, 'stock_quantity' => 0,
        ]);

        $payload = fn (int $palmQty, int $beansQty) => [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [
                ['material_id' => $palm->id, 'quantity' => $palmQty, 'unit_cost' => 22],
                ['material_id' => $beans->id, 'quantity' => $beansQty, 'unit_cost' => 0.5],
                ['product_id' => $chair->id, 'quantity' => 3, 'unit_cost' => 300],
            ],
        ];

        $poId = $this->postJson('/api/purchase-orders', $payload(1500, 12000))->assertStatus(201)->json('order.id');
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertStatus(200);

        foreach ([[1500, 12000], [1600, 18000], [1600, 18000]] as [$palmQty, $beansQty]) {
            $this->putJson("/api/purchase-orders/{$poId}", $payload($palmQty, $beansQty))->assertStatus(200);

            $this->assertEquals($palmQty, InventoryService::getStock('material', $palm->id, $raw->id));
            $this->assertEquals($beansQty, InventoryService::getStock('material', $beans->id, $raw->id));
            $this->assertEquals(3, InventoryService::getStock('product', $chair->id, $prod->id));
            $this->assertFalse(InventoryMovement::where('product_id', $chair->id)->where('warehouse_id', $raw->id)->exists());
        }

        $this->deleteJson("/api/purchase-orders/{$poId}")->assertStatus(200);

        $this->assertEquals(0, InventoryService::getStock('material', $palm->id));
        $this->assertEquals(0, InventoryService::getStock('material', $beans->id));
        $this->assertEquals(0, InventoryService::getStock('product', $chair->id));
    }

    public function test_repair_command_restores_stock_wiped_by_old_repeated_edits()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'sanctum');

        $raw = Warehouse::create(['name' => 'المواد الخام', 'code' => 'WSH-M']);
        $prod = Warehouse::create(['name' => 'المنتجات الجاهزة', 'code' => 'WSH-P']);
        $supplier = Supplier::create(['name' => 'مورد', 'phone' => '01000000011', 'debt_amount' => 0]);
        $palm = Material::create([
            'category_id' => MaterialCategory::create(['name' => 'خوص'])->id,
            'name' => 'خوص عروسة', 'unit' => 'طقم', 'unit_cost' => 20, 'stock_quantity' => 0,
        ]);
        $chair = Product::create([
            'category_id' => ProductCategory::create(['name' => 'كراسي'])->id,
            'name' => 'كرسي', 'unit' => 'حبة', 'unit_cost' => 0, 'sale_price' => 500, 'stock_quantity' => 0,
        ]);

        $poId = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [
                ['material_id' => $palm->id, 'quantity' => 1500, 'unit_cost' => 22],
                ['product_id' => $chair->id, 'quantity' => 3, 'unit_cost' => 300],
            ],
        ])->assertStatus(201)->json('order.id');
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertStatus(200);
        $number = \App\Models\PurchaseOrder::find($poId)->order_number;

        // What the old update() left after two edits: every receipt reversed again on each edit,
        // and the re-applied product receipt routed into the raw warehouse.
        $post = fn ($wh, $mat, $prd, $type, $qty, $ref) => InventoryService::recordMovement($wh, $mat, $prd, $type, $qty, 22, $ref);
        $post($raw->id, $palm->id, null, 'Supplier_Return', 1500, "RET-{$number}");
        $post($prod->id, null, $chair->id, 'Supplier_Return', 3, "RET-{$number}");
        $post($raw->id, $palm->id, null, 'Purchase_Receipt', 1500, $number);
        $post($raw->id, null, $chair->id, 'Purchase_Receipt', 3, $number);
        $post($raw->id, $palm->id, null, 'Supplier_Return', 1500, "RET-{$number}");
        $post($prod->id, null, $chair->id, 'Supplier_Return', 3, "RET-{$number}");
        $post($raw->id, $palm->id, null, 'Supplier_Return', 1500, "RET-{$number}");
        $post($raw->id, null, $chair->id, 'Supplier_Return', 3, "RET-{$number}");
        $post($raw->id, $palm->id, null, 'Purchase_Receipt', 1500, $number);
        $post($raw->id, null, $chair->id, 'Purchase_Receipt', 3, $number);

        $this->assertEquals(0, InventoryService::getStock('material', $palm->id, $raw->id));

        // Dry run changes nothing
        $count = InventoryMovement::count();
        $this->artisan('purchase-orders:fix-edit-stock')->assertExitCode(0);
        $this->assertEquals($count, InventoryMovement::count());

        $this->artisan('purchase-orders:fix-edit-stock', ['--apply' => true])->assertExitCode(0);

        $this->assertEquals(1500, InventoryService::getStock('material', $palm->id, $raw->id));
        $this->assertEquals(3, InventoryService::getStock('product', $chair->id, $prod->id));
        $this->assertEquals(0, (float) InventoryMovement::where('product_id', $chair->id)->where('warehouse_id', $raw->id)
            ->selectRaw("SUM(CASE WHEN movement_type = 'Purchase_Receipt' THEN quantity ELSE -quantity END) AS net")->value('net'));

        // Idempotent: a second run finds nothing to correct
        $count = InventoryMovement::count();
        $this->artisan('purchase-orders:fix-edit-stock', ['--apply' => true])->assertExitCode(0);
        $this->assertEquals($count, InventoryMovement::count());

        // A later edit and delete stay consistent with the corrected history
        $this->putJson("/api/purchase-orders/{$poId}", [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [
                ['material_id' => $palm->id, 'quantity' => 1600, 'unit_cost' => 22],
                ['product_id' => $chair->id, 'quantity' => 3, 'unit_cost' => 300],
            ],
        ])->assertStatus(200);
        $this->assertEquals(1600, InventoryService::getStock('material', $palm->id, $raw->id));

        $this->deleteJson("/api/purchase-orders/{$poId}")->assertStatus(200);
        $this->assertEquals(0, InventoryService::getStock('material', $palm->id));
    }
}
