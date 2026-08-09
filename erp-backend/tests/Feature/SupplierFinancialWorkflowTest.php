<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use App\Models\User;
use App\Models\Supplier;
use App\Models\Material;
use App\Models\MaterialCategory;
use App\Models\Warehouse;
use App\Models\PurchaseOrder;
use App\Models\Expense;
use Tests\TestCase;

class SupplierFinancialWorkflowTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_handles_purchase_order_with_zero_deposit_and_full_debt_lifecycle()
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
        ]);
        $this->actingAs($user);

        // 1. Setup category, warehouse, supplier and material
        $cat = MaterialCategory::create(['name' => 'مواد عامة']);
        Warehouse::create(['name' => 'مستودع الخام', 'code' => 'WH-RAW']);

        $supplier = Supplier::create([
            'name' => 'المورد الأول - اختبار صفر عربون',
            'phone' => '01000000001',
            'debt_amount' => 0.00,
        ]);

        $material = Material::create([
            'category_id' => $cat->id,
            'name' => 'خشب زان ممتاز',
            'code' => 'MAT-ZAN-01',
            'unit' => 'متر مكعب',
            'unit_cost' => 1000.00,
            'stock_quantity' => 0,
        ]);

        // 2. Create Purchase Order with 0 deposit
        $response = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'notes' => 'طلب شراء صفر عربون',
            'deposit_paid' => 0,
            'payment_method' => 'cash',
            'items' => [
                [
                    'material_id' => $material->id,
                    'quantity' => 10,
                    'unit_cost' => 1000.00, // Total = 10,000 EGP
                ]
            ]
        ]);

        $response->assertStatus(201);
        $poData = $response->json('order');
        $poId = $poData['id'];

        $po = PurchaseOrder::find($poId);
        $this->assertEquals(10000.00, (float)$po->total_amount);
        $this->assertEquals(0.00, (float)$po->deposit_paid);
        $this->assertEquals('Pending', $po->status);

        // Debt should still be 0 because PO is Pending
        $supplier->refresh();
        $this->assertEquals(0.00, (float)$supplier->debt_amount);

        // 3. Receive Order -> Status Received, Stock Updated, Debt Incremented to 10,000 EGP
        $receiveRes = $this->postJson("/api/purchase-orders/{$poId}/receive");
        $receiveRes->assertStatus(200);

        $po->refresh();
        $this->assertEquals('Received', $po->status);

        // Re-fetch supplier list to trigger live debt sync
        $suppListRes = $this->getJson('/api/suppliers');
        $suppListRes->assertStatus(200);

        $supplier->refresh();
        $this->assertEquals(10000.00, (float)$supplier->debt_amount);

        // 4. Verify Transactions
        $txRes = $this->getJson("/api/suppliers/{$supplier->id}/transactions");
        $txRes->assertStatus(200);
        $txData = $txRes->json();
        // Should have 1 transaction: the PO itself
        $this->assertCount(1, $txData);
        $this->assertEquals('purchase_order', $txData[0]['type']);
        $this->assertEquals(10000.00, (float)$txData[0]['total_amount']);

        // 5. Pay Partial Debt (4,000 EGP)
        $payRes = $this->postJson("/api/suppliers/{$supplier->id}/settle-bulk-debt", [
            'amount' => 4000.00,
            'payment_method' => 'cash',
            'payment_date' => now()->toDateString(),
            'notes' => 'دفعة جزئية أولى',
        ]);
        $payRes->assertStatus(200);

        $this->getJson('/api/suppliers');
        $supplier->refresh();
        $this->assertEquals(6000.00, (float)$supplier->debt_amount);

        // 6. Pay Remaining Debt (6,000 EGP)
        $payFinalRes = $this->postJson("/api/suppliers/{$supplier->id}/settle-bulk-debt", [
            'amount' => 6000.00,
            'payment_method' => 'instapay',
            'payment_date' => now()->toDateString(),
            'notes' => 'تصفية الدين بالكامل',
        ]);
        $payFinalRes->assertStatus(200);

        $this->getJson('/api/suppliers');
        $supplier->refresh();
        $this->assertEquals(0.00, (float)$supplier->debt_amount);
    }

    #[Test]
    public function it_handles_initial_deposit_without_duplicating_transactions()
    {
        $user = User::create([
            'name' => 'Test User 2',
            'email' => 'test2@example.com',
            'password' => bcrypt('password'),
        ]);
        $this->actingAs($user);

        // 1. Setup category, warehouse, supplier and material
        $cat = MaterialCategory::create(['name' => 'مواد عامة']);
        Warehouse::create(['name' => 'مستودع الخام', 'code' => 'WH-RAW']);

        $supplier = Supplier::create([
            'name' => 'أحمد عبدالله - مورد باختبار العربون',
            'phone' => '01011112222',
            'debt_amount' => 0.00,
        ]);

        $material = Material::create([
            'category_id' => $cat->id,
            'name' => 'ترابيزه فورجيه بنز',
            'code' => 'MAT-TAB-01',
            'unit' => 'ترابيزه',
            'unit_cost' => 1700.00,
            'stock_quantity' => 0,
        ]);

        // 2. Create Purchase Order with 4,000 EGP deposit (Total = 34,000 EGP)
        $response = $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'notes' => 'طلب شراء مع عربون',
            'deposit_paid' => 4000.00,
            'payment_method' => 'cash',
            'items' => [
                [
                    'material_id' => $material->id,
                    'quantity' => 20,
                    'unit_cost' => 1700.00, // Total = 34,000 EGP
                ]
            ]
        ]);

        $response->assertStatus(201);
        $poId = $response->json('order.id');

        // 3. Check Transactions immediately after creation:
        // Must contain EXACTLY 2 rows: 1 PO (+34,000) and 1 Deposit Expense (-4,000). NO DUPLICATE DEPOSIT ROWS!
        $txRes = $this->getJson("/api/suppliers/{$supplier->id}/transactions");
        $txRes->assertStatus(200);
        $txData = $txRes->json();

        $this->assertCount(2, $txData, 'Transactions count must be 2 (1 PO and 1 Deposit Expense), not duplicated');

        $types = collect($txData)->pluck('type')->toArray();
        $this->assertContains('purchase_order', $types);
        $this->assertContains('expense', $types);

        // Verify total expense amount for this supplier is exactly 4000
        $expenseAmounts = collect($txData)->where('type', 'expense')->pluck('amount')->sum();
        $this->assertEquals(4000.00, (float)$expenseAmounts);

        // 4. Receive Order
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertStatus(200);

        // Trigger debt sync
        $this->getJson('/api/suppliers');
        $supplier->refresh();
        $this->assertEquals(30000.00, (float)$supplier->debt_amount); // 34000 - 4000 = 30000

        // 5. Pay partial debt of 10,000 EGP
        $this->postJson("/api/suppliers/{$supplier->id}/settle-bulk-debt", [
            'amount' => 10000.00,
            'payment_method' => 'instapay',
            'payment_date' => now()->toDateString(),
            'notes' => 'دفعة جزئية من حساب المورد',
        ])->assertStatus(200);

        $this->getJson('/api/suppliers');
        $supplier->refresh();
        $this->assertEquals(20000.00, (float)$supplier->debt_amount); // 30000 - 10000 = 20000

        // Transactions count must be EXACTLY 3 (1 PO, 1 initial deposit expense, 1 partial payment expense)
        $txRes2 = $this->getJson("/api/suppliers/{$supplier->id}/transactions");
        $txData2 = $txRes2->json();
        $this->assertCount(3, $txData2, 'Transactions count must be 3, without synthetic duplications');

        // 6. Pay remaining debt of 20,000 EGP
        $this->postJson("/api/suppliers/{$supplier->id}/settle-bulk-debt", [
            'amount' => 20000.00,
            'payment_method' => 'cash',
            'payment_date' => now()->toDateString(),
            'notes' => 'سداد المتبقي',
        ])->assertStatus(200);

        $this->getJson('/api/suppliers');
        $supplier->refresh();
        $this->assertEquals(0.00, (float)$supplier->debt_amount);
    }
}
