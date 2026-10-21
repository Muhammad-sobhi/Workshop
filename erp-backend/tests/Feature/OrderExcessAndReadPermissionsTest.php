<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\OperationPayment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\SalesInvoice;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderExcessAndReadPermissionsTest extends TestCase
{
    use RefreshDatabase;

    private function deliveredOrderSetup(): array
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $raw = Warehouse::create(['name' => 'مخزن المواد الخام', 'code' => 'WSH-M']);
        $prod = Warehouse::create(['name' => 'معرض', 'code' => 'WSH-P']);
        Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);
        $mat = Material::create(['name' => 'خشب', 'unit' => 'متر', 'unit_cost' => 10, 'stock_quantity' => 0, 'category_id' => MaterialCategory::create(['name' => 'x'])->id]);
        InventoryService::recordMovement(warehouseId: $raw->id, materialId: $mat->id, productId: null, movementType: 'Initial_Balance', quantity: 100, unitCost: 10, referenceNumber: 'I');
        $p = Product::create(['name' => 'كرسي', 'unit' => 'حبة', 'unit_cost' => 0, 'sale_price' => 100, 'stock_quantity' => 0, 'category_id' => ProductCategory::create(['name' => 'y'])->id]);
        $p->materials()->attach($mat->id, ['quantity' => 2]);
        InventoryService::recordMovement(warehouseId: $prod->id, materialId: null, productId: $p->id, movementType: 'Initial_Balance', quantity: 10, unitCost: 10, referenceNumber: 'I2');

        $client = Client::create(['name' => 'عميل']);
        // An older unpaid invoice of 700
        $this->postJson('/api/sales', ['client_id' => $client->id, 'product_id' => $p->id, 'quantity' => 7, 'price' => 100, 'invoice_date' => '2026-10-01',
            'payment_method' => 'cash', 'paid_amount' => 0, 'warehouse_id' => $prod->id])->assertStatus(201);
        $op = $this->postJson('/api/operations', ['client_id' => $client->id, 'warehouse_id' => $raw->id, 'product_id' => $p->id, 'quantity' => 3, 'total_price' => 300])
            ->assertStatus(201)->json('operation.id');

        return [$client, $op];
    }

    public function test_paying_more_than_the_order_keeps_the_excess_as_client_credit_after_delivery()
    {
        [$client, $op] = $this->deliveredOrderSetup();

        // The client pays 1000 on the 300 order to settle the older 700 invoice as well
        $this->postJson("/api/operations/{$op}/payments", ['amount' => 1000, 'payment_date' => '2026-10-05', 'payment_method' => 'cash'])->assertStatus(201);
        $this->assertEquals(-300, $client->fresh()->recalculateDebt()); // before delivery: 700 owed - 1000 collected

        $this->postJson("/api/operations/{$op}/complete")->assertOk();
        $this->postJson("/api/operations/{$op}/deliver")->assertOk();

        // After delivery: 700 + 300 invoiced, 300 paid on the delivery invoice, 700 excess is credit → 0
        $this->assertEquals(0, $client->fresh()->recalculateDebt());
        $this->assertEquals(0, (float) SalesInvoice::whereNotNull('operation_id')->value('remaining_amount'));

        // Deleting the payment: delivery invoice back to fully unpaid, no excess left
        $this->deleteJson("/api/operations/{$op}/payments/" . OperationPayment::first()->id)->assertOk();
        $this->assertEquals(300, (float) SalesInvoice::whereNotNull('operation_id')->value('remaining_amount'));
        $this->assertEquals(1000, $client->fresh()->recalculateDebt());
    }

    public function test_deleting_one_of_several_payments_keeps_the_delivery_invoice_capped()
    {
        [$client, $op] = $this->deliveredOrderSetup();
        $this->postJson("/api/operations/{$op}/payments", ['amount' => 300, 'payment_date' => '2026-10-05', 'payment_method' => 'cash'])->assertStatus(201);
        $this->postJson("/api/operations/{$op}/payments", ['amount' => 100, 'payment_date' => '2026-10-06', 'payment_method' => 'cash'])->assertStatus(201);
        $this->postJson("/api/operations/{$op}/complete")->assertOk();
        $this->postJson("/api/operations/{$op}/deliver")->assertOk();

        $this->deleteJson("/api/operations/{$op}/payments/" . OperationPayment::where('amount_paid', 100)->value('id'))->assertOk();

        // 300 still collected = the whole order total
        $this->assertEquals(0, (float) SalesInvoice::whereNotNull('operation_id')->value('remaining_amount'));
        $this->assertEquals(700, $client->fresh()->recalculateDebt());
    }

    public function test_payments_on_cancelled_orders_are_still_refused()
    {
        [, $op] = $this->deliveredOrderSetup();
        $this->postJson("/api/operations/{$op}/cancel")->assertOk();
        $this->postJson("/api/operations/{$op}/payments", ['amount' => 50, 'payment_date' => '2026-10-05', 'payment_method' => 'cash'])->assertStatus(422);
    }

    public function test_statements_and_sales_need_the_page_permission()
    {
        $client = Client::create(['name' => 'عميل']);
        $supplier = Supplier::create(['name' => 'مورد', 'debt_amount' => 0]);

        $sales = User::factory()->create(['role' => 'worker', 'permissions' => ['manage_sales']]);
        $warehouse = User::factory()->create(['role' => 'manager', 'permissions' => ['manage_inventory', 'manage_production']]);
        $production = User::factory()->create(['role' => 'worker', 'permissions' => ['manage_production']]);

        $this->actingAs($sales);
        $this->getJson('/api/sales')->assertOk();
        $this->getJson("/api/clients/{$client->id}/transactions")->assertOk();
        $this->getJson("/api/suppliers/{$supplier->id}/transactions")->assertStatus(403);

        $this->actingAs($warehouse);
        $this->getJson("/api/clients/{$client->id}/transactions")->assertOk();
        $this->getJson("/api/clients/{$client->id}/open-invoices")->assertOk();
        $this->getJson("/api/suppliers/{$supplier->id}/transactions")->assertOk();
        $this->getJson('/api/sales')->assertStatus(403);

        $this->actingAs($production);
        $this->getJson('/api/clients')->assertOk(); // client list for production orders stays open
        $this->getJson('/api/sales')->assertStatus(403);
        $this->getJson("/api/clients/{$client->id}/transactions")->assertStatus(403);
        $this->getJson("/api/suppliers/{$supplier->id}/transactions")->assertStatus(403);
    }
}
