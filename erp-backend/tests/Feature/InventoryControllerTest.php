<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_returns_product_total_value_based_on_unit_cost()
    {
        $user = User::factory()->create();
        $category = ProductCategory::create(['name' => 'Chairs']);

        $product = Product::create([
            'name' => 'Test Product',
            'code' => 'PROD-100',
            'sku' => 'SKU-PROD-100',
            'unit' => 'piece',
            'unit_cost' => 150.00,
            'sale_price' => 250.00,
            'stock_quantity' => 10,
            'category_id' => $category->id,
        ]);

        $response = $this->actingAs($user)->getJson('/api/inventory');

        $response->assertStatus(200);
        
        $data = $response->json();
        $prodData = collect($data)->firstWhere('id', $product->id);

        $this->assertNotNull($prodData);
        $this->assertEquals(150.00, $prodData['price']);
        $this->assertEquals(150.00, $prodData['unit_cost']);
        $this->assertEquals(250.00, $prodData['sale_price']);
    }
}
