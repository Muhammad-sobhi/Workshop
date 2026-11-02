<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Operation;
use App\Models\OperationPayment;
use App\Models\OperationProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationDemandSummaryTest extends TestCase
{
    use RefreshDatabase;

    private Product $a;
    private Product $b;
    private Client $client;
    private Client $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->client = Client::create(['name' => 'حسين']);
        $this->other = Client::create(['name' => 'عمر']);
        $cat = ProductCategory::create(['name' => 'ترابيزات']);
        $warehouse = Warehouse::create(['name' => 'main', 'code' => 'WH1', 'location' => 'Main']);
        $make = fn ($code) => Product::create(['name' => $code, 'code' => $code, 'category_id' => $cat->id, 'unit' => 'ترابيزه', 'unit_cost' => 10, 'sale_price' => 100]);
        [$this->a, $this->b] = [$make('بنز'), $make('لوكينز')];

        $op = function ($status, $clientId, array $items, $total = 0) use ($warehouse) {
            $o = Operation::create([
                'product_id' => $items[0][0]->id, 'quantity' => $items[0][1], 'warehouse_id' => $warehouse->id,
                'status' => $status, 'client_id' => $clientId, 'total_price' => $total, 'deposit_paid' => 0,
            ]);
            foreach ($items as [$p, $qty]) {
                OperationProduct::create(['operation_id' => $o->id, 'product_id' => $p->id, 'quantity' => $qty]);
            }
            return $o;
        };

        $op('Pending', $this->client->id, [[$this->a, 6]], 600);
        $paid = $op('In_Progress', $this->other->id, [[$this->a, 10], [$this->b, 30]], 1000);
        OperationPayment::create(['operation_id' => $paid->id, 'amount_paid' => 1000, 'payment_date' => now()]);
        $op('Completed', $this->client->id, [[$this->a, 4]]);
        $op('Delivered', $this->client->id, [[$this->a, 100]]);
        $op('Cancelled', $this->client->id, [[$this->a, 100]]);
        $op('Pending', null, [[$this->a, 5]]);
    }

    private function row(array $rows, Product $p): ?array
    {
        return collect($rows)->firstWhere('product_id', $p->id);
    }

    public function test_sums_open_orders_per_product_and_separates_stock()
    {
        $res = $this->getJson('/api/operations/demand-summary')->assertOk()->json();

        $a = $this->row($res['clients'], $this->a);
        $this->assertEquals([20, 6, 10, 4], [$a['total'], $a['Pending'], $a['In_Progress'], $a['Completed']]);
        $this->assertEquals(30, $this->row($res['clients'], $this->b)['total']);
        $this->assertEquals('بنز', $res['clients'][1]['name']); // sorted by total desc
        $this->assertCount(1, $res['stock']);
        $this->assertEquals(5, $this->row($res['stock'], $this->a)['total']);
    }

    public function test_applies_page_filters()
    {
        $byClient = $this->getJson("/api/operations/demand-summary?client={$this->client->id}")->json();
        $this->assertEquals(10, $this->row($byClient['clients'], $this->a)['total']);
        $this->assertEmpty($byClient['stock']);

        $stock = $this->getJson('/api/operations/demand-summary?client=stock')->json();
        $this->assertEmpty($stock['clients']);

        $status = $this->getJson('/api/operations/demand-summary?status=in_progress')->json();
        $this->assertEquals(10, $this->row($status['clients'], $this->a)['total']);

        $delivered = $this->getJson('/api/operations/demand-summary?status=delivered')->json();
        $this->assertEquals(['clients' => [], 'stock' => []], $delivered);

        // The fully paid In_Progress order drops out
        $debt = $this->getJson('/api/operations/demand-summary?status=debt')->json();
        $this->assertEquals(6, $this->row($debt['clients'], $this->a)['total']);
        $this->assertNull($this->row($debt['clients'], $this->b));

        $search = $this->getJson("/api/operations/demand-summary?search=" . urlencode("لوكينز"))->json();
        $this->assertEquals(10, $this->row($search['clients'], $this->a)['total']);
        $this->assertEquals(30, $this->row($search['clients'], $this->b)['total']);

        $this->getJson('/api/operations/demand-summary?status=bogus')->assertStatus(422);
    }

    public function test_list_filters_across_all_pages()
    {
        $ids = fn ($query) => collect($this->getJson('/api/operations?per_page=2&' . $query)->assertOk()->json('data'))->count();
        $total = fn ($query) => $this->getJson('/api/operations?per_page=2&' . $query)->json('total');

        $this->assertEquals(6, $total(''));
        $this->assertEquals(2, $ids(''));
        $this->assertEquals(2, $total('status=pending'));
        $this->assertEquals(1, $total('status=delivered'));
        $this->assertEquals(1, $total('client=stock'));
        $this->assertEquals(4, $total("client={$this->client->id}"));
        $this->assertEquals(1, $total('search=' . urlencode('لوكينز')));
        $this->assertEquals(1, $total('search=' . urlencode('عمر')));
        $this->getJson('/api/operations?client=1%20or%201')->assertStatus(422);
    }

    public function test_status_counts_cover_all_operations()
    {
        $this->getJson('/api/operations/status-counts')->assertOk()->assertExactJson([
            'total' => 6, 'Pending' => 2, 'In_Progress' => 1, 'Completed' => 1, 'Delivered' => 1,
        ]);
    }
}
