<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderPriceIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_order_price_does_not_change_material_or_product_cost()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'sanctum');

        Warehouse::create(['name' => 'مستودع الخام', 'code' => 'WH-RAW']);
        $supplier = Supplier::create(['name' => 'مورد', 'phone' => '01000000009', 'debt_amount' => 0]);

        $wood = Material::create([
            'category_id' => MaterialCategory::create(['name' => 'خشب'])->id,
            'name' => 'خشب زان',
            'unit' => 'متر',
            'unit_cost' => 100.00,
            'stock_quantity' => 0,
        ]);

        $table = Product::create([
            'category_id' => ProductCategory::create(['name' => 'طاولات'])->id,
            'name' => 'طاولة',
            'unit' => 'حبة',
            'unit_cost' => 200.00,
            'sale_price' => 400.00,
            'stock_quantity' => 0,
        ]);
        $table->materials()->attach($wood->id, ['quantity' => 2]);

        $poId = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [['material_id' => $wood->id, 'quantity' => 10, 'unit_cost' => 80.00]],
        ])->assertStatus(201)->json('order.id');

        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertStatus(200);

        // Edit the received order with yet another negotiated price
        $this->putJson("/api/purchase-orders/{$poId}", [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [['material_id' => $wood->id, 'quantity' => 10, 'unit_cost' => 70.00]],
        ])->assertStatus(200);

        $this->assertEquals(100.00, (float) $wood->fresh()->unit_cost);
        $this->assertEquals(200.00, (float) $table->fresh()->unit_cost);

        $orderNumber = PurchaseOrder::find($poId)->order_number;
        $latestReceipt = InventoryMovement::where('reference_number', $orderNumber)
            ->where('movement_type', 'Purchase_Receipt')
            ->latest('id')
            ->first();
        $this->assertEquals(70.00, (float) $latestReceipt->unit_cost);
        $this->assertEquals(10.0, (float) $wood->fresh()->stock_quantity);
    }
}
