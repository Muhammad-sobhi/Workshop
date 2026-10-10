<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Operation;
use App\Models\OperationProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientStatementOperationPricesTest extends TestCase
{
    use RefreshDatabase;

    public function test_statement_uses_stored_unit_price_per_operation_product()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $client = Client::create(['name' => 'عميل اختبار']);
        $cat = ProductCategory::create(['name' => 'كراسي']);
        $warehouse = Warehouse::create(['name' => 'main', 'code' => 'WH1', 'location' => 'Main']);
        $make = fn($code) => Product::create(['name' => $code, 'code' => $code, 'category_id' => $cat->id, 'unit' => 'كرسي', 'unit_cost' => 10, 'sale_price' => 100]);
        [$a, $b, $c] = [$make('A'), $make('B'), $make('C')];

        // 600×580 + 300×480 + 50×350 = 509,500
        $op = Operation::create([
            'product_id' => $a->id, 'quantity' => 600, 'warehouse_id' => $warehouse->id,
            'status' => 'Pending', 'client_id' => $client->id, 'total_price' => 509500,
        ]);
        foreach ([[$a, 600, 580], [$b, 300, 480], [$c, 50, 350]] as [$p, $qty, $price]) {
            OperationProduct::create(['operation_id' => $op->id, 'product_id' => $p->id, 'quantity' => $qty, 'unit_price' => $price]);
        }

        $row = collect($this->getJson("/api/clients/{$client->id}/transactions")->assertOk()->json())
            ->firstWhere('id', 'op-' . $op->id);

        $items = collect($row['items_summary'])->map(fn($i) => [$i['unit_cost'], $i['total_cost']])->all();
        $this->assertEquals([[580, 348000], [480, 144000], [350, 17500]], $items);
    }

    public function test_legacy_products_without_unit_price_share_the_remaining_total()
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $client = Client::create(['name' => 'عميل قديم']);
        $cat = ProductCategory::create(['name' => 'كراسي']);
        $warehouse = Warehouse::create(['name' => 'main', 'code' => 'WH1', 'location' => 'Main']);
        $make = fn($code) => Product::create(['name' => $code, 'code' => $code, 'category_id' => $cat->id, 'unit' => 'كرسي', 'unit_cost' => 10, 'sale_price' => 100]);
        [$a, $b] = [$make('A'), $make('B')];

        $op = Operation::create([
            'product_id' => $a->id, 'quantity' => 20, 'warehouse_id' => $warehouse->id,
            'status' => 'Pending', 'client_id' => $client->id, 'total_price' => 40500,
        ]);
        OperationProduct::create(['operation_id' => $op->id, 'product_id' => $a->id, 'quantity' => 20, 'unit_price' => 1150]);
        OperationProduct::create(['operation_id' => $op->id, 'product_id' => $b->id, 'quantity' => 50, 'unit_price' => null]);

        $row = collect($this->getJson("/api/clients/{$client->id}/transactions")->assertOk()->json())
            ->firstWhere('id', 'op-' . $op->id);

        $items = collect($row['items_summary'])->map(fn($i) => [$i['unit_cost'], $i['total_cost']])->all();
        $this->assertEquals([[1150, 23000], [350, 17500]], $items);
    }
}
