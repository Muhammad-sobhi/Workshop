<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulkImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    public function test_supplier_and_client_debt_is_imported_as_an_opening_balance_that_survives_recalculation()
    {
        $this->postJson('/api/suppliers/bulk-import', ['items' => [['name' => 'مورد', 'phone' => '010', 'debt_amount' => 1500]]])->assertOk();
        $this->postJson('/api/clients/bulk-import', ['items' => [['name' => 'عميل', 'debt_amount' => 800]]])->assertOk();

        $supplier = Supplier::where('name', 'مورد')->firstOrFail();
        $client = Client::where('name', 'عميل')->firstOrFail();
        $this->assertEquals(1500, (float) $supplier->opening_balance);
        $this->assertEquals(1500, (float) $supplier->debt_amount);
        $this->assertEquals(800, (float) $client->opening_balance);

        // Opening the statements recalculates the debt: it must not drop to zero
        $this->getJson("/api/suppliers/{$supplier->id}/transactions")->assertOk();
        $this->getJson("/api/clients/{$client->id}/transactions")->assertOk();
        $this->assertEquals(1500, (float) $supplier->fresh()->debt_amount);
        $this->assertEquals(800, (float) $client->fresh()->debt_amount);
    }

    public function test_names_already_in_the_system_or_repeated_in_the_file_are_skipped()
    {
        Material::create(['name' => 'خشب زان', 'unit' => 'متر', 'unit_cost' => 10, 'stock_quantity' => 0, 'category_id' => MaterialCategory::create(['name' => 'أخشاب'])->id]);
        Supplier::create(['name' => 'مورد قديم', 'debt_amount' => 0]);

        $res = $this->postJson('/api/materials/bulk-import', ['items' => [
            ['name' => ' خشب زان ', 'unit' => 'متر', 'unit_cost' => 12, 'category' => 'أخشاب'],
            ['name' => 'مسمار', 'unit' => 'حبة', 'unit_cost' => 1, 'category' => 'خردوات'],
            ['name' => 'مسمار', 'unit' => 'حبة', 'unit_cost' => 1, 'category' => 'خردوات'],
        ]])->assertOk();
        $this->assertEquals([1, 2], [$res->json('imported'), $res->json('skipped')]);
        $this->assertEquals(2, Material::count());
        $this->assertEquals(10, (float) Material::where('name', 'خشب زان')->value('unit_cost'));

        $res = $this->postJson('/api/products/bulk-import', ['items' => [
            ['name' => 'كرسي', 'unit' => 'حبة', 'sale_price' => 100, 'category' => 'كراسي'],
        ]])->assertOk();
        $this->assertEquals(1, $res->json('imported'));
        $this->postJson('/api/products/bulk-import', ['items' => [
            ['name' => 'كرسي', 'unit' => 'حبة', 'sale_price' => 100, 'category' => 'كراسي'],
        ]])->assertOk()->assertJsonPath('skipped', 1);
        $this->assertEquals(1, Product::count());

        $this->postJson('/api/suppliers/bulk-import', ['items' => [['name' => 'مورد قديم'], ['name' => 'مورد جديد']]])
            ->assertOk()->assertJsonPath('imported', 1)->assertJsonPath('skipped', 1);
        $this->assertEquals(2, Supplier::count());
    }
}
