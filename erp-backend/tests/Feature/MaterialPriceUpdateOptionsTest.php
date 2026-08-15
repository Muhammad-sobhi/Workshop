<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaterialPriceUpdateOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_price_impact_calculation_and_suggested_sale_prices()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'sanctum');

        $matCat = MaterialCategory::create(['name' => 'حديد']);
        $prodCat = ProductCategory::create(['name' => 'أثاث معدني']);

        $iron = Material::create([
            'name' => 'حديد مواسير 1 بوصة',
            'unit' => 'متر',
            'unit_cost' => 50.00,
            'stock_quantity' => 100,
            'category_id' => $matCat->id,
        ]);

        $chair = Product::create([
            'name' => 'كرسي بار حديد',
            'unit' => 'حبة',
            'unit_cost' => 150.00, // 3 meters of iron * 50 = 150
            'sale_price' => 250.00, // Margin = (250 - 150) / 250 = 40%
            'stock_quantity' => 10,
            'category_id' => $prodCat->id,
        ]);

        $chair->materials()->attach($iron->id, ['quantity' => 3]);

        // Get impact when iron price increases from 50 to 70 (+20 per meter -> +60 per chair)
        $impactRes = $this->getJson("/api/materials/{$iron->id}/price-impact?new_unit_cost=70");
        $impactRes->assertStatus(200);

        // Material stock difference: 100 meters * 20 = +2000 EGP
        $this->assertEquals(2000.0, (float) $impactRes->json('material.stock_value_diff'));
        $impactRes->assertJsonPath('total_affected_products', 1);

        // Chair new cost should be 150 + (3 * 20) = 210 EGP
        $this->assertEquals(210.0, (float) $impactRes->json('affected_products.0.new_calculated_unit_cost'));
        $this->assertEquals(60.0, (float) $impactRes->json('affected_products.0.cost_difference'));
        $this->assertEquals(40.0, (float) $impactRes->json('affected_products.0.current_margin_percent'));

        // Suggested sale price keeping 40% margin: 210 / (1 - 0.40) = 350 EGP
        $this->assertEquals(350.0, (float) $impactRes->json('affected_products.0.suggested_sale_price'));
    }

    public function test_option_1_and_2_apply_bom_and_update_sale_prices()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'sanctum');

        $matCat = MaterialCategory::create(['name' => 'أخشاب']);
        $prodCat = ProductCategory::create(['name' => 'طاولات']);

        $wood = Material::create([
            'name' => 'خشب سويد',
            'unit' => 'لوح',
            'unit_cost' => 100.00,
            'stock_quantity' => 20,
            'category_id' => $matCat->id,
        ]);

        $table = Product::create([
            'name' => 'طاولة طعام مودرن',
            'unit' => 'قطعة',
            'unit_cost' => 200.00, // 2 boards * 100 = 200
            'sale_price' => 350.00,
            'category_id' => $prodCat->id,
        ]);

        $table->materials()->attach($wood->id, ['quantity' => 2]);

        // Update wood price to 150 (+50), apply to BOM and update table sale_price to 480
        $updateRes = $this->postJson("/api/materials/{$wood->id}/update-price", [
            'new_unit_cost' => 150.00,
            'apply_to_material_stock' => true,
            'apply_to_products_bom' => true,
            'apply_future_only' => false,
            'notes' => 'زيادة أسعار الأخشاب من الموردين بنسبة 50%',
            'product_prices' => [
                ['product_id' => $table->id, 'sale_price' => 480.00]
            ]
        ]);

        $updateRes->assertStatus(200);

        // Wood price is 150
        $this->assertEquals(150.00, $wood->fresh()->unit_cost);

        // Table unit_cost automatically recalculated to 300 (2 * 150)
        $this->assertEquals(300.00, $table->fresh()->unit_cost);

        // Table sale_price updated to 480
        $this->assertEquals(480.00, $table->fresh()->sale_price);

        // History entry verified
        $this->assertDatabaseHas('material_price_histories', [
            'material_id' => $wood->id,
            'old_unit_cost' => 100.00,
            'new_unit_cost' => 150.00,
            'apply_to_products_bom' => true,
        ]);
    }

    public function test_option_3_future_orders_only_skips_existing_bom_recalculation()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'sanctum');

        $matCat = MaterialCategory::create(['name' => 'أقمشة']);
        $prodCat = ProductCategory::create(['name' => 'صالونات']);

        $fabric = Material::create([
            'name' => 'قماش مخملي تركي',
            'unit' => 'متر',
            'unit_cost' => 80.00,
            'stock_quantity' => 30,
            'category_id' => $matCat->id,
        ]);

        $sofa = Product::create([
            'name' => 'كنبة كابوتونيه 3 مقاعد',
            'unit' => 'قطعة',
            'unit_cost' => 400.00, // 5 meters * 80 = 400
            'sale_price' => 800.00,
            'category_id' => $prodCat->id,
        ]);

        $sofa->materials()->attach($fabric->id, ['quantity' => 5]);

        // Update fabric price to 120, BUT select Option 3: Future Orders Only (keep existing sofa cost at 400)
        $updateRes = $this->postJson("/api/materials/{$fabric->id}/update-price", [
            'new_unit_cost' => 120.00,
            'apply_to_material_stock' => false,
            'apply_to_products_bom' => false,
            'apply_future_only' => true,
            'notes' => 'تحديث سعر الكتالوج للطلبيات القادمة فقط دون تعديل تكلفة الكنب الجاهز الحالي',
        ]);

        $updateRes->assertStatus(200);

        // Fabric standard price is 120
        $this->assertEquals(120.00, $fabric->fresh()->unit_cost);

        // Sofa cost remained at 400 (NOT changed to 600)
        $this->assertEquals(400.00, $sofa->fresh()->unit_cost);

        // History entry verified
        $this->assertDatabaseHas('material_price_histories', [
            'material_id' => $fabric->id,
            'old_unit_cost' => 80.00,
            'new_unit_cost' => 120.00,
            'apply_future_only' => true,
            'apply_to_products_bom' => false,
        ]);
    }
}
