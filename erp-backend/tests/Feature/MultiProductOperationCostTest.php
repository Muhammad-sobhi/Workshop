<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Operation;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiProductOperationCostTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_product_in_operation_is_charged_only_its_own_materials()
    {
        [$opNumber, $productA, $productB] = $this->completeTwoProductOperation();

        $this->assertEquals(75.00, (float) $this->receipt($opNumber, $productA)->unit_cost);
        $this->assertEquals(100.00, (float) $this->receipt($opNumber, $productB)->unit_cost);
        $this->assertEquals(75.00, (float) $productA->fresh()->unit_cost);
        $this->assertEquals(100.00, (float) $productB->fresh()->unit_cost);
    }

    public function test_recost_command_repairs_receipts_costed_with_whole_operation_consumption()
    {
        [$opNumber, $productA, $productB] = $this->completeTwoProductOperation();

        // Old bug: whole operation consumption (480) ÷ own qty, plus A's service (5)
        $this->receipt($opNumber, $productA)->update(['unit_cost' => 125.00, 'total_cost' => 500.00]);
        $this->receipt($opNumber, $productB)->update(['unit_cost' => 240.00, 'total_cost' => 480.00]);
        Product::where('id', $productA->id)->update(['unit_cost' => 125.00]);
        Product::where('id', $productB->id)->update(['unit_cost' => 240.00]);

        $this->artisan('operations:recost-receipts', ['operation_number' => $opNumber, '--dry-run' => true])->assertSuccessful();
        $this->assertEquals(125.00, (float) $this->receipt($opNumber, $productA)->unit_cost);

        $this->artisan('operations:recost-receipts', ['operation_number' => $opNumber])->assertSuccessful();

        $this->assertEquals(75.00, (float) $this->receipt($opNumber, $productA)->unit_cost);
        $this->assertEquals(300.00, (float) $this->receipt($opNumber, $productA)->total_cost);
        $this->assertEquals(100.00, (float) $this->receipt($opNumber, $productB)->unit_cost);
        $this->assertEquals(75.00, (float) $productA->fresh()->unit_cost);
        $this->assertEquals(100.00, (float) $productB->fresh()->unit_cost);
    }

    private function receipt(string $opNumber, Product $product): InventoryMovement
    {
        return InventoryMovement::where('reference_number', $opNumber)
            ->where('movement_type', 'Production_Receipt')
            ->where('product_id', $product->id)
            ->first();
    }

    private function completeTwoProductOperation(): array
    {
        $this->withoutMiddleware();

        $whRaw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);

        $matCat  = \App\Models\MaterialCategory::create(['name' => 'خامات']);
        $prodCat = \App\Models\ProductCategory::create(['name' => 'منتجات']);

        $makeMat = fn ($name, $cost) => Material::create([
            'name' => $name, 'unit' => 'متر', 'unit_cost' => $cost, 'stock_quantity' => 100,
            'category_id' => $matCat->id, 'warehouse_id' => $whRaw->id,
        ]);
        $shared = $makeMat('خشب مشترك', 10);
        $onlyA  = $makeMat('حديد', 50);
        $onlyB  = $makeMat('قماش', 30);
        $service = Material::create([
            'name' => 'تصنيع', 'unit' => 'كمية', 'unit_cost' => 5, 'type' => 'service',
            'category_id' => $matCat->id, 'warehouse_id' => $whRaw->id,
        ]);

        $makeProd = fn ($name) => Product::create([
            'name' => $name, 'unit' => 'حبة', 'unit_cost' => 0, 'sale_price' => 1000,
            'category_id' => $prodCat->id, 'stock_quantity' => 0,
        ]);
        $productA = $makeProd('طقطوقة');
        $productB = $makeProd('ترابيزة');

        // A: 2 shared + 1 onlyA + service = 20 + 50 + 5 = 75 per unit
        $productA->materials()->attach($shared->id, ['quantity' => 2]);
        $productA->materials()->attach($onlyA->id, ['quantity' => 1]);
        $productA->materials()->attach($service->id, ['quantity' => 1]);
        // B: 1 shared + 3 onlyB = 10 + 90 = 100 per unit
        $productB->materials()->attach($shared->id, ['quantity' => 1]);
        $productB->materials()->attach($onlyB->id, ['quantity' => 3]);

        $client = Client::create(['name' => 'عميل', 'phone' => '01000000000']);

        $opId = $this->postJson('/api/operations', [
            'client_id'    => $client->id,
            'warehouse_id' => $whRaw->id,
            'total_price'  => 5000,
            'deposit_paid' => 0,
            'products'     => [
                ['product_id' => $productA->id, 'quantity' => 4],
                ['product_id' => $productB->id, 'quantity' => 2],
            ],
        ])->assertStatus(201)->json('operation.id');

        $this->postJson("/api/operations/{$opId}/start")->assertStatus(200);
        $this->postJson("/api/operations/{$opId}/complete")->assertStatus(200);

        return [Operation::find($opId)->operation_number, $productA, $productB];
    }
}
