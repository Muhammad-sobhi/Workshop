<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Models\TreasuryTransaction;
use App\Models\SalesInvoice;
use App\Services\InventoryService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompleteSystemIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
    }

    public function test_treasury_summary_and_manual_deposit_and_transfer()
    {
        // 1. Initial Deposit
        $res = $this->postJson('/api/treasury/deposit', [
            'amount' => 50000,
            'payment_method' => 'instapay',
            'category' => 'رصيد إفتتاحي',
            'transaction_date' => '2026-08-14',
            'description' => 'إيداع رأس مال بالإنستاباي',
        ]);
        $res->assertStatus(201);

        // 2. Check Treasury Summary
        $sumRes = $this->getJson('/api/treasury/summary');
        $sumRes->assertStatus(200)
            ->assertJsonPath('total_balance', 50000)
            ->assertJsonPath('methods.instapay.balance', 50000);

        // 3. Transfer 10000 from InstaPay to Cash
        $trfRes = $this->postJson('/api/treasury/transfer', [
            'from_method' => 'instapay',
            'to_method' => 'cash',
            'amount' => 10000,
            'transaction_date' => '2026-08-14',
            'notes' => 'سحب كاش للمصروفات اليومية',
        ]);
        $trfRes->assertStatus(200);

        // 4. Verify Balances after Transfer
        $sumAfter = $this->getJson('/api/treasury/summary');
        $sumAfter->assertStatus(200)
            ->assertJsonPath('total_balance', 50000)
            ->assertJsonPath('methods.instapay.balance', 40000)
            ->assertJsonPath('methods.cash.balance', 10000);
    }

    public function test_sales_invoice_with_exact_cogs_and_inventory_and_treasury_sync()
    {
        $whProd = Warehouse::create(['name' => 'مخزن المنتجات', 'code' => 'WSH-P']);
        $prodCat = ProductCategory::create(['name' => 'غرف نوم']);

        $product = Product::create([
            'name' => 'كرسي فورجيه ملكي',
            'unit' => 'حبة',
            'unit_cost' => 300.00,
            'sale_price' => 700.00,
            'category_id' => $prodCat->id,
            'stock_quantity' => 0,
        ]);

        // Add 10 items to inventory
        InventoryService::recordMovement(
            warehouseId: $whProd->id,
            materialId: null,
            productId: $product->id,
            movementType: 'Initial_Balance',
            quantity: 10,
            unitCost: 300.00
        );

        $this->assertEquals(10, InventoryService::getStock('product', $product->id, $whProd->id));

        $client = Client::create(['name' => 'معرض السلطان']);

        // Issue Sales Invoice for 4 items @ 700 EGP = 2800 EGP (COGS = 4 * 300 = 1200 EGP)
        $saleRes = $this->postJson('/api/sales', [
            'client_id' => $client->id,
            'invoice_date' => '2026-08-14',
            'payment_method' => 'instapay',
            'paid_amount' => 2800,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 4,
                    'unit_sale_price' => 700.00,
                ]
            ]
        ]);

        $saleRes->assertStatus(201);

        // 1. Verify Stock Reduced to 6
        $this->assertEquals(6, InventoryService::getStock('product', $product->id, $whProd->id));

        // 2. Verify Treasury Inflow
        $treasurySummary = $this->getJson('/api/treasury/summary');
        $treasurySummary->assertJsonPath('total_balance', 2800)
            ->assertJsonPath('methods.instapay.balance', 2800);

        // 3. Verify Dashboard KPIs: Revenue = 2800, COGS = 1200, Gross Profit = 1600
        $dashRes = $this->getJson('/api/dashboard');
        $dashRes->assertStatus(200);
        $kpis = collect($dashRes->json('kpis'))->keyBy('label');
        $this->assertEquals('EGP 2,800.00', $kpis['إجمالي الإيرادات']['value']);
        $this->assertEquals('EGP 1,200.00', $kpis['تكلفة البضاعة المباعة (COGS)']['value']);
        $this->assertEquals('EGP 1,600.00', $kpis['مجمل الربح']['value']);
    }

    public function test_production_order_full_lifecycle_and_cancellation_rollback()
    {
        $whRaw = Warehouse::create(['name' => 'المواد الخام', 'code' => 'WSH-M']);
        $whFin = Warehouse::create(['name' => 'طلبيات', 'code' => 'WH-FIN']);
        $whProd = Warehouse::create(['name' => 'المنتجات', 'code' => 'WSH-P']);

        $matCat = MaterialCategory::create(['name' => 'حديد']);
        $prodCat = ProductCategory::create(['name' => 'كراسي']);

        $iron = Material::create([
            'name' => 'مواسير حديد 1 بوصة',
            'unit' => 'متر',
            'unit_cost' => 50.00,
            'category_id' => $matCat->id,
        ]);

        $chair = Product::create([
            'name' => 'كرسي بار حديد',
            'unit' => 'حبة',
            'unit_cost' => 150.00,
            'sale_price' => 400.00,
            'category_id' => $prodCat->id,
        ]);

        $chair->materials()->attach($iron->id, ['quantity' => 3]); // 3 meters of iron per chair

        // Add 100 meters of iron
        InventoryService::recordMovement(
            warehouseId: $whRaw->id,
            materialId: $iron->id,
            productId: null,
            movementType: 'Initial_Balance',
            quantity: 100,
            unitCost: 50.00
        );

        $client = Client::create(['name' => 'كافيه الأهرام']);

        // 1. Create Production Order for 10 chairs with 1000 EGP deposit
        $opRes = $this->postJson('/api/operations', [
            'client_id' => $client->id,
            'warehouse_id' => $whRaw->id,
            'total_price' => 4000.00,
            'deposit_paid' => 1000.00,
            'deposit_payment_method' => 'vodafone_cash',
            'products' => [
                ['product_id' => $chair->id, 'quantity' => 10]
            ]
        ]);
        $opRes->assertStatus(201);
        $opId = $opRes->json('operation.id');

        // Check Treasury has 1000 Vodafone cash
        $sumRes = $this->getJson('/api/treasury/summary');
        $sumRes->assertJsonPath('methods.vodafone_cash.balance', 1000);

        // 2. Start and Complete Production (Consumes 30m iron, produces 10 chairs into WH-FIN)
        $this->postJson("/api/operations/{$opId}/start")->assertStatus(200);
        $this->postJson("/api/operations/{$opId}/complete")->assertStatus(200);

        $this->assertEquals(70, InventoryService::getStock('material', $iron->id, $whRaw->id));
        $this->assertEquals(10, InventoryService::getStock('product', $chair->id, $whFin->id));

        // 3. Cancel Production Order after completion (Option 2: Manufactured products transferred to Showroom WH-PROD)
        $cancelRes = $this->postJson("/api/operations/{$opId}/cancel", ['refund_deposit' => true]);
        $cancelRes->assertStatus(200);

        // Iron remains 70 (because chairs are already manufactured and sitting in showroom)
        // Chairs in WH-FIN released to 0, Chairs in WSH-P received as 10 (ready to sell!)
        $this->assertEquals(70, InventoryService::getStock('material', $iron->id, $whRaw->id));
        $this->assertEquals(0, InventoryService::getStock('product', $chair->id, $whFin->id));
        $this->assertEquals(10, InventoryService::getStock('product', $chair->id, $whProd->id));
        
        // Vodafone Cash refunded as requested
        $sumAfterCancel = $this->getJson('/api/treasury/summary');
        $sumAfterCancel->assertJsonPath('methods.vodafone_cash.balance', 0);
    }

    public function test_historical_opening_sale_deposits_only_net_profit_to_treasury()
    {
        $cat = ProductCategory::create(['name' => 'كراسي']);
        $product = Product::create([
            'name' => 'كرسي عروسة عدي',
            'unit' => 'حبة',
            'unit_cost' => 326.51,
            'sale_price' => 360.00,
            'category_id' => $cat->id,
            'stock_quantity' => 0,
        ]);

        // Historical opening sale for 1000 items @ 360 EGP = 360,000 EGP (Cost = 326,510 EGP, Profit = +33,490 EGP)
        $res = $this->postJson('/api/sales/historical', [
            'revenue_date' => '2026-08-01',
            'payment_method' => 'cash',
            'notes' => 'مبيعات سابقة رصيد إفتتاحي',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1000,
                    'sale_price' => 360.00,
                ]
            ]
        ]);

        $res->assertStatus(201);
        $res->assertJsonPath('invoice.total_amount', 360000);
        $res->assertJsonPath('invoice.cogs', 326510);

        // Verify Treasury transaction recorded ONLY net profit (33,490 EGP)
        $tx = TreasuryTransaction::where('source_type', SalesInvoice::class)->latest('id')->first();
        $this->assertNotNull($tx);
        $this->assertEquals(33490.00, (float) $tx->amount);
        $this->assertEquals('inflow', $tx->type);
        $this->assertEquals('cash', $tx->payment_method);

        // Verify Treasury Summary balance is 33,490 EGP
        $sumRes = $this->getJson('/api/treasury/summary');
        $sumRes->assertJsonPath('methods.cash.balance', 33490);
    }

    public function test_supplier_overpayment_creates_credit_balance()
    {
        $whRaw = Warehouse::create(['name' => 'مستودع الخامات', 'code' => 'WSH-R']);
        $matCat = MaterialCategory::create(['name' => 'إسفنج']);
        $supplier = Supplier::create([
            'name' => 'عمرو مهابه',
            'debt_amount' => 0.00,
        ]);

        $mat = Material::create([
            'name' => 'إسفنج ضهر عروسة',
            'code' => 'MAT-SPONGE',
            'unit' => 'كعبة',
            'unit_cost' => 2.50,
            'current_stock' => 0,
            'category_id' => $matCat->id,
        ]);

        // 1. Purchase Order of 25.00 EGP (10 * 2.50)
        $poRes = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => '2026-08-15',
            'payment_method' => 'cash',
            'deposit_paid' => 0,
            'items' => [
                [
                    'material_id' => $mat->id,
                    'quantity' => 10,
                    'unit_cost' => 2.50,
                ]
            ]
        ]);
        $poRes->assertStatus(201);
        $poId = $poRes->json('order.id');

        // Receive order (supplier debt becomes 25.00 EGP)
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertStatus(200);
        $this->assertEquals(25.00, (float) $supplier->fresh()->debt_amount);

        // 2. Pay 65.00 EGP (overpayment of 40.00 EGP)
        $payRes = $this->postJson("/api/suppliers/{$supplier->id}/pay-debt", [
            'amount' => 65.00,
            'payment_method' => 'cash',
            'payment_date' => '2026-08-15',
            'notes' => 'سداد دفعة لحساب المورد',
        ]);
        $payRes->assertStatus(200);

        // 3. Supplier debt amount should be -40.00 (advance credit balance)
        $this->assertEquals(-40.00, (float) $supplier->fresh()->debt_amount);
    }
}

