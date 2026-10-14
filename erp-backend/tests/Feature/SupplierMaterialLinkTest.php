<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SupplierMaterialLinkTest extends TestCase
{
    use RefreshDatabase;

    private function setUpData(): array
    {
        $this->actingAs(User::create([
            'name' => 'Admin', 'email' => 'admin@example.com',
            'password' => bcrypt('password'), 'role' => 'admin',
        ]));
        $cat = MaterialCategory::create(['name' => 'أخشاب']);
        $supplier = Supplier::create(['name' => 'مورد', 'phone' => '0100', 'debt_amount' => 0]);
        $m1 = Material::create(['category_id' => $cat->id, 'name' => 'زان', 'code' => 'M1', 'unit' => 'م', 'unit_cost' => 10, 'stock_quantity' => 0]);
        $m2 = Material::create(['category_id' => $cat->id, 'name' => 'أرو', 'code' => 'M2', 'unit' => 'م', 'unit_cost' => 20, 'stock_quantity' => 0]);

        return [$supplier, $m1, $m2];
    }

    #[Test]
    public function it_links_multiple_materials_in_one_request()
    {
        [$supplier, $m1, $m2] = $this->setUpData();

        $this->postJson("/api/suppliers/{$supplier->id}/materials", [
            'materials' => [
                ['material_id' => $m1->id, 'price' => 12],
                ['material_id' => $m2->id, 'price' => 25],
            ],
            'notes' => 'جملة',
        ])->assertOk();

        $linked = $supplier->materials()->get()->keyBy('id');
        $this->assertCount(2, $linked);
        $this->assertEquals(12, $linked[$m1->id]->pivot->price);
        $this->assertEquals(25, $linked[$m2->id]->pivot->price);
        $this->assertEquals('جملة', $linked[$m2->id]->pivot->notes);
    }

    #[Test]
    public function it_still_accepts_a_single_material_id()
    {
        [$supplier, $m1] = $this->setUpData();

        $this->postJson("/api/suppliers/{$supplier->id}/materials", [
            'material_id' => $m1->id, 'price' => 9,
        ])->assertOk();

        $this->assertEquals(9, $supplier->materials()->first()->pivot->price);
    }

    #[Test]
    public function it_rejects_an_empty_request()
    {
        [$supplier] = $this->setUpData();

        $this->postJson("/api/suppliers/{$supplier->id}/materials", ['materials' => []])
            ->assertStatus(422);
    }
}
