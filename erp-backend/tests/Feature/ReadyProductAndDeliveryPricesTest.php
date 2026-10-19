<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Operation;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReadyProductAndDeliveryPricesTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $whRaw;
    private Warehouse $whProd;
    private Warehouse $whFin;
    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->actingAs(\App\Models\User::factory()->create(['role' => 'admin']));

        $this->whRaw  = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $this->whProd = Warehouse::create(['name' => 'مخزن المنتجات', 'code' => 'WSH-P']);
        $this->whFin  = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);
        $this->client = Client::create(['name' => 'عميل', 'phone' => '01000000000']);
    }

    // ── Delivery invoice keeps each line's own price ──────────────────────

    public function test_delivery_invoice_keeps_each_lines_own_unit_price()
    {
        [$invoice, $a, $b] = $this->deliverTwoProductOrder();

        $this->assertEquals([500, 75000], $this->line($invoice, $a));
        $this->assertEquals([415, 41500], $this->line($invoice, $b));

        $row = collect($this->getJson("/api/clients/{$this->client->id}/transactions")->assertOk()->json())
            ->firstWhere('id', 'inv-' . $invoice->id);
        $this->assertEquals([[500, 75000], [415, 41500]],
            collect($row['items_summary'])->map(fn ($i) => [$i['unit_cost'], $i['total_cost']])->all());
    }

    public function test_fix_command_restores_averaged_delivery_line_prices()
    {
        [$invoice, $a, $b] = $this->deliverTwoProductOrder();
        // Old bug: 116500 ÷ 250 = 466 on every line
        foreach ($invoice->items as $item) {
            $item->update(['unit_sale_price' => 466, 'total_sale_price' => 466 * (float) $item->quantity]);
        }

        $this->artisan('sales:fix-delivery-line-prices', ['--dry-run' => true])->assertSuccessful();
        $this->assertEquals([466, 69900], $this->line($invoice, $a));

        $this->artisan('sales:fix-delivery-line-prices')->assertSuccessful();
        $this->assertEquals([500, 75000], $this->line($invoice, $a));
        $this->assertEquals([415, 41500], $this->line($invoice, $b));
        $this->assertEquals(116500, (float) $invoice->fresh()->total_amount);
    }

    // ── Ready (purchased) product without a BOM ───────────────────────────

    public function test_product_without_bom_cannot_be_manufactured_from_nothing()
    {
        $table = $this->purchasedProduct(20, 300);
        $opId  = $this->createOrder($table, 1, 0);

        $check = $this->getJson("/api/operations/{$opId}/check-materials")->assertOk()->json();
        $this->assertTrue($check['has_shortage']);
        $this->assertCount(1, $check['products_without_bom']);

        $this->assertFalse($this->getJson("/api/operations/{$opId}/readiness-check")->json('can_complete'));
        $this->postJson("/api/operations/{$opId}/start")->assertStatus(422);
        $this->postJson("/api/operations/{$opId}/complete")->assertStatus(422);

        $this->assertEquals('Pending', Operation::find($opId)->status);
        $this->assertEquals(20, InventoryService::getStock('product', $table->id, $this->whProd->id));
        $this->assertEquals(0, InventoryMovement::where('movement_type', 'Production_Receipt')->count());
    }

    public function test_product_without_bom_taken_from_stock_is_delivered_from_purchased_stock()
    {
        $table = $this->purchasedProduct(20, 300);
        $opId  = $this->createOrder($table, 1, 1);

        $this->postJson("/api/operations/{$opId}/deliver")->assertOk();

        $this->assertEquals(19, InventoryService::getStock('product', $table->id, $this->whProd->id));
        $invoice = SalesInvoice::where('operation_id', $opId)->with('items')->first();
        $this->assertEquals(300, (float) $invoice->items->first()->unit_cost);
    }

    public function test_fix_command_moves_purchased_stock_for_phantom_production()
    {
        $table = $this->purchasedProduct(20, 300);
        $opId  = $this->createOrder($table, 1, 0);
        $op    = Operation::find($opId);

        // Old bug: receipt into the client-orders warehouse with nothing issued
        InventoryService::recordMovement($this->whFin->id, null, $table->id, 'Production_Receipt', 1, 0, $op->operation_number);
        $op->update(['status' => 'Completed']);
        $this->postJson("/api/operations/{$opId}/deliver")->assertOk();
        $this->assertEquals(20, InventoryService::getStock('product', $table->id, $this->whProd->id));

        $this->artisan('operations:fix-phantom-production', ['--dry-run' => true])->assertSuccessful();
        $this->assertEquals(20, InventoryService::getStock('product', $table->id, $this->whProd->id));

        $this->artisan('operations:fix-phantom-production')->assertSuccessful();

        $this->assertEquals(19, InventoryService::getStock('product', $table->id, $this->whProd->id));
        $this->assertEquals(0, InventoryService::getStock('product', $table->id, $this->whFin->id));
        $this->assertEquals(0, InventoryMovement::where('movement_type', 'Production_Receipt')->count());
        $invoice = SalesInvoice::where('operation_id', $opId)->with('items')->first();
        $this->assertEquals(300, (float) $invoice->items->first()->unit_cost);
        $this->assertEquals(300, (float) $invoice->total_cogs);

        // Running again finds nothing to do
        $this->artisan('operations:fix-phantom-production')->expectsOutput('No phantom production receipts found.');
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private function purchasedProduct(float $qty, float $cost): Product
    {
        $product = Product::create([
            'name' => 'ترابيزه بوفيه', 'unit' => 'ترابيزه', 'unit_cost' => $cost, 'sale_price' => 1000,
            'category_id' => \App\Models\ProductCategory::create(['name' => 'جاهز'])->id, 'is_resale' => true,
        ]);
        InventoryService::recordMovement($this->whProd->id, null, $product->id, 'Purchase_Receipt', $qty, $cost, 'PO-TEST');
        return $product;
    }

    private function createOrder(Product $product, float $qty, float $fromStock): int
    {
        return $this->postJson('/api/operations', [
            'client_id'    => $this->client->id,
            'warehouse_id' => $this->whRaw->id,
            'total_price'  => 1000 * $qty,
            'products'     => [[
                'product_id' => $product->id, 'quantity' => $qty,
                'quantity_taken_from_stock' => $fromStock, 'unit_price' => 1000,
            ]],
        ])->assertStatus(201)->json('operation.id');
    }

    private function deliverTwoProductOrder(): array
    {
        $mat = Material::create([
            'name' => 'خشب', 'unit' => 'متر', 'unit_cost' => 10, 'stock_quantity' => 1000,
            'category_id' => \App\Models\MaterialCategory::create(['name' => 'خامات'])->id,
            'warehouse_id' => $this->whRaw->id,
        ]);
        $cat = \App\Models\ProductCategory::create(['name' => 'كراسي']);
        $make = function ($name) use ($mat, $cat) {
            $p = Product::create(['name' => $name, 'unit' => 'كرسي', 'unit_cost' => 0, 'sale_price' => 0, 'category_id' => $cat->id]);
            $p->materials()->attach($mat->id, ['quantity' => 1]);
            return $p;
        };
        $a = $make('كرسي بيضاوي كبير');
        $b = $make('كرسي عروسة عادي');

        $opId = $this->postJson('/api/operations', [
            'client_id'    => $this->client->id,
            'warehouse_id' => $this->whRaw->id,
            'total_price'  => 116500,
            'products'     => [
                ['product_id' => $a->id, 'quantity' => 150, 'unit_price' => 500],
                ['product_id' => $b->id, 'quantity' => 100, 'unit_price' => 415],
            ],
        ])->assertStatus(201)->json('operation.id');

        $this->postJson("/api/operations/{$opId}/start")->assertOk();
        $this->postJson("/api/operations/{$opId}/complete")->assertOk();
        $this->postJson("/api/operations/{$opId}/deliver")->assertOk();

        return [SalesInvoice::where('operation_id', $opId)->with('items')->first(), $a, $b];
    }

    private function line(SalesInvoice $invoice, Product $product): array
    {
        $item = $invoice->items()->where('product_id', $product->id)->first();
        return [(float) $item->unit_sale_price, (float) $item->total_sale_price];
    }
}
