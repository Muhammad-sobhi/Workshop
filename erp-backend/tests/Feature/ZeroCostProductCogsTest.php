<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Product;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\User;
use App\Models\Warehouse;

class ZeroCostProductCogsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Warehouse::create([
            'id' => 1,
            'name' => 'المستودع الرئيسي للمنتجات',
            'code' => 'WSH-P',
            'type' => 'products',
            'is_active' => true,
        ]);
        Warehouse::create([
            'id' => 2,
            'name' => 'مستودع الخامات',
            'code' => 'WSH-RM',
            'type' => 'materials',
            'is_active' => true,
        ]);
    }

    public function test_product_with_zero_cost_and_sale_price_returns_zero_stored_unit_cost(): void
    {
        $category = \App\Models\ProductCategory::create(['name' => 'ترابيزات']);

        $product = Product::create([
            'name' => 'ترابيزه بوفيه موكيت',
            'code' => 'PROD-6982',
            'sku' => 'SKU-PROD-6982',
            'category_id' => $category->id,
            'unit_cost' => 0.00,
            'sale_price' => 1000.00,
            'unit' => 'ترابيزة',
        ]);

        $this->assertEquals(0.00, $product->calculateStoredUnitCost());
    }

    public function test_artisan_fix_zero_cost_cogs_repairs_corrupted_items_and_invoices(): void
    {
        $user = User::factory()->create();
        $category = \App\Models\ProductCategory::create(['name' => 'ترابيزات']);

        $product = Product::create([
            'name' => 'ترابيزه بوفيه موكيت',
            'code' => 'PROD-6982',
            'sku' => 'SKU-PROD-6982',
            'category_id' => $category->id,
            'unit_cost' => 0.00,
            'sale_price' => 1000.00,
            'unit' => 'ترابيزة',
        ]);

        // Create an invoice with old corrupted item where unit_cost was mistakenly set to sale_price (1000.00)
        $invoice = SalesInvoice::create([
            'invoice_number' => 'HIST-2026-0026',
            'invoice_date' => '2026-09-11',
            'invoice_type' => 'historical_opening',
            'total_amount' => 950.00,
            'total_cogs' => 1000.00,
            'paid_amount' => 950.00,
            'remaining_amount' => 0.00,
            'payment_method' => 'cash',
            'created_by' => $user->id,
        ]);

        $item = SalesInvoiceItem::create([
            'sales_invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'item_type' => 'product',
            'quantity' => 1.0,
            'unit_sale_price' => 1000.00,
            'unit_cost' => 1000.00, // Corrupted: was taking sale_price
            'total_sale_price' => 950.00,
            'total_cost' => 1000.00,
        ]);

        // Run the artisan fix command
        $this->artisan('sales:fix-zero-cost-cogs')
            ->assertExitCode(0);

        // Verify the item is corrected
        $item->refresh();
        $this->assertEquals(0.00, (float)$item->unit_cost);
        $this->assertEquals(0.00, (float)$item->total_cost);

        // Verify the invoice total_cogs is corrected
        $invoice->refresh();
        $this->assertEquals(0.00, (float)$invoice->total_cogs);
    }
}
