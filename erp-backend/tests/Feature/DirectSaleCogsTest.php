<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DirectSaleCogsTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Warehouse $warehouse;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($this->user);

        $this->warehouse = Warehouse::create([
            'name' => 'معرض المنتجات الجاهزة',
            'code' => 'WSH-P',
        ]);

        $cat = ProductCategory::create(['name' => 'كراسي']);
        $this->product = Product::create([
            'name' => 'كرسي فورجيه كلاسيك',
            'code' => 'PRD-COGS-01',
            'category_id' => $cat->id,
            'unit' => 'كرسي',
            'unit_cost' => 10.00,
            'sale_price' => 30.00,
            'stock_quantity' => 0,
        ]);

        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $this->product->id,
            movementType: 'Initial_Balance',
            quantity: 100,
            unitCost: 10.00,
            referenceNumber: 'INIT-001'
        );

        InventoryService::recordMovement(
            warehouseId: $this->warehouse->id,
            materialId: null,
            productId: $this->product->id,
            movementType: 'Production_Receipt',
            quantity: 100,
            unitCost: 20.00,
            referenceNumber: 'INIT-002'
        );
    }

    public function test_direct_sale_snapshots_fifo_blended_cogs()
    {
        $res = $this->postJson('/api/sales', [
            'product_id' => $this->product->id,
            'quantity' => 120,
            'price' => 30,
            'invoice_date' => '2026-08-23',
            'payment_method' => 'cash',
        ]);

        $res->assertStatus(201);
        $this->assertEquals(3600.0, $res->json('invoice.total_amount'));
        $this->assertEquals(1400.0, $res->json('invoice.cogs'));
        $this->assertEquals(3600.0, $res->json('invoice.paid_amount'));
        $this->assertEquals(11.67, $res->json('invoice.items.0.unit_cost'));
        $this->assertEquals(1400.0, $res->json('invoice.items.0.total_cost'));

        $invoice = SalesInvoice::first();
        $this->assertEquals(3600.0, (float) $invoice->total_amount);
        $this->assertEquals(1400.0, (float) $invoice->total_cogs);

        $this->assertDatabaseHas('treasury_transactions', [
            'type' => 'inflow',
            'amount' => 3600.00,
            'payment_method' => 'cash',
            'reference_number' => $invoice->invoice_number,
        ]);
    }

    public function test_direct_sale_rejects_insufficient_stock_and_creates_nothing()
    {
        $res = $this->postJson('/api/sales', [
            'product_id' => $this->product->id,
            'quantity' => 300,
            'price' => 30,
            'invoice_date' => '2026-08-23',
            'payment_method' => 'cash',
        ]);

        $res->assertStatus(400);
        $this->assertDatabaseCount('sales_invoices', 0);
        $this->assertDatabaseCount('sales_invoice_items', 0);
    }
}
