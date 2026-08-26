# Feature Plan: Buying Products for Resale & Selling Raw Materials

> Status: **REVIEWED BY CODEX (GPT-5.6 Terra - High Effort) & UPDATED.**
> Goal: Implement all three features cleanly and safely without breaking any existing workflow.

---

## 1. Executive Summary & Review Verdict

Codex reviewed the initial proposal against the actual codebase (`erp-backend/` & `dashboard/`). Verdict was **CONCERNS**: the reuse strategy is sound, but Codex flagged real risks that are addressed below either as implemented safeguards (§3) or explicit scope decisions (§4).

---

## 2. Core Requirements (What We Are Building)

### Feature 1 — Buying Ready-Made Products for Resale (Trading)
- Buy **finished goods** from suppliers at a specific **purchase price**.
- Store them in **WSH-P** (Products Warehouse) alongside manufactured products.
- Product cost is **the actual purchase price** (via FIFO layers), **completely isolated from raw material/BOM calculations**.
- The purchase amount enters **supplier debt** and is settled via the existing payment system.
- Resale products are displayed on a **dedicated tab/section** on the Products page showing their purchase price and sale price.

### Feature 2 — Selling Raw Materials at a Markup
- Sell **raw materials** directly from stock at a price higher than their purchase cost.
- Stock is deducted from **WSH-M** (Raw Materials Warehouse) using FIFO valuation.
- COGS equals the actual FIFO purchase cost, generating accurate gross profit margins.
- Buyer is registered as a **Client** to reuse standard accounts receivable and credit limits.

### Feature 3 — Client Debt Deduction (خصم / حسم عند السداد)
- When settling a client's debt, the user may optionally enter a **deduction amount** (خصم/حسم).
- **Example**: Client owes 11,000 → deduction = 1,000 → cash collected = 10,000 → total debt reduced by **11,000** (fully cleared).
- The deduction is **NOT an Expense** (expenses = workshop expenses only). It is stored per-payment on `client_payments.deduction_amount`.
- On the **accounts page financial calculations**, all deductions are summed from payments and shown as a separate line **"الخصومات / الحسم"**, subtracted from Net Profit: `Net Profit = Gross Profit - Expenses - Deductions`.
- Treasury records **only the actual cash collected** (10,000), never the deducted portion.
- Invoice allocation reduces invoice balances by `(amount + deduction)` combined, so the debt is cleared correctly.
- Sale prices on invoices are **never touched** — discounts happen at payment time only.

---

## 3. Critical Code Realities & Safeguards (Codex Insights)

| Issue / Finding | Risk if Ignored | Concrete Safeguard in Plan |
|---|---|---|
| **1. Warehouse Routing** | Direct sales currently default to WSH-P. Selling raw materials from WSH-P would cause stock errors. | `SalesService` and `PurchaseOrderController` will automatically route by item type: `product` → `WSH-P`, `material` → `WSH-M`. |
| **2. Material Stock Outgoing Types** | `Material::calculateStock()` did not include `Sales_Issue` in its list of outgoing movements. | Add `'Sales_Issue'` to `Material::calculateStock()` so material inventory reports deduct sales accurately across all screens. |
| **3. Sourcing Integrity (BOM Isolation)** | Attaching a BOM to a resale product would corrupt its costing. | Backend validation will strictly prevent adding BOM materials to any product where `is_resale = true`. |
| **4. Cost Display Precision** | `getCostPricingAnalysis()` returns the **oldest active FIFO layer** (next unit COGS). Once stock reaches 0, FIFO layers are empty. | On PO receipt of a resale product, also update `products.unit_cost = purchase_unit_cost` so when stock is 0, the last purchase price is preserved as the fallback reference. |
| **5. Credit Sales Debtor Enforcement** | Direct sales permitted `client_id = null` even when `paid_amount < total_amount`. | Enforce `client_id` as `required` whenever `remaining_amount > 0` (credit sales), preventing orphaned receivables. |
| **6. Concurrent Receive / Sale Locks** | Two simultaneous clicks could cause double receipt or overselling. | Use `lockForUpdate()` inside `DB::transaction` for PO receipt and stock pre-check during direct sales. |
| **7. Eager Loading & Serialization** | PO and Sales endpoints only serialized `items.material` or `items.product`. | Update resource formatting and eager-loading in controllers (`PurchaseOrderController`, `SalesController`) to handle both item types dynamically. |
| **8. Debt Payment vs Deduction Split** | If treasury records the full 11,000, cash is inflated by the deducted 1,000; if the deduction is invisible to reports, profit is misstated. | In `SalesService::payClientDebt()`: Treasury inflow = `amount` only. Invoice allocation & `recalculateDebt()` use `amount + deduction`. The deduction lives on `client_payments.deduction_amount` (NOT an expense) and the accounts page sums it into a separate **"الخصومات / الحسم"** line subtracted from Net Profit. |
| **9. Deduction on Undo** | Deleting a payment must not leave a stale deduction behind in reports. | The deduction is stored on the `ClientPayment` row itself, so deleting the payment removes its deduction automatically. `deleteClientPayment()` stays inside one `DB::transaction`, reverts the Treasury inflow and calls `$client->recalculateDebt()`. |

---

## 4. Implementation Steps (Step-by-Step)

### Step 1: Database Migrations (100% Additive & Safe)
1. **Migration 1 (`add_is_resale_to_products_table`)**:
   - Add `is_resale` (`boolean`, default `false`, indexed).
2. **Migration 2 (`modify_purchase_order_items_for_products`)**:
   - Make `material_id` nullable.
   - Add nullable foreign key `product_id` → `products`.
   - Add DB check / validation rule: exactly one of `material_id` or `product_id` must be present.
3. **Migration 3 (`modify_sales_invoice_items_for_materials`)**:
   - Make `product_id` nullable.
   - Add nullable foreign key `material_id` → `materials`.
   - Add `item_type` (`enum: ['product', 'material']`, default `'product'`).
4. **Migration 4 (`add_deduction_to_client_payments_table`)** *(Feature 3)*:
   - Add `deduction_amount` (`decimal(12,2)`, default `0`) to `client_payments`.

### Step 2: Backend Business Logic
1. **`Material.php` Model**:
   - Add `'Sales_Issue'` to the `$outgoingTypes` in `calculateStock()`.
2. **`ProductController.php`**:
   - Block BOM assignment/updates if `is_resale === true`.
   - Support filtering: `/api/products?is_resale=1` and `/api/products?is_resale=0`.
3. **`PurchaseOrderController.php`**:
   - Widen PO creation validation to accept `product_id` or `material_id`.
   - In `receiveOrder()`:
     - Wrap in `DB::transaction` with `lockForUpdate()`.
     - If line is `material`: record movement in `WSH-M` (Raw Materials Warehouse).
     - If line is `product`: record movement in `WSH-P` (Products Warehouse), and sync `product.unit_cost = purchase_price`.
   - Eager-load `items.product` alongside `items.material`.
4. **`SalesService.php` & `SalesController.php`**:
   - In `createDirectSale()`:
     - Determine warehouse per item: `product` → `WSH-P`, `material` → `WSH-M`.
     - Consume FIFO via `InventoryService::consumeFifoQuantity($itemType, $itemId, $warehouseId, $qty)`.
     - Record `Sales_Issue` inventory movement.
      - Validate: `client_id` is mandatory if `remaining_amount > 0`.
    - Format response to include product or material metadata.
5. **Client Debt Deduction** *(Feature 3)*:
   - **`SalesController::payClientDebt()`**: add validation rule `deduction` → `nullable|numeric|min:0` and enforce `deduction <= client's current debt - amount` (cannot deduct more than what remains unpaid).
   - **`SalesService::payClientDebt()`**:
     - Store `deduction_amount` on the created `ClientPayment`.
     - Allocate `(amount + deduction)` across open invoices (FIFO oldest-first) so invoice balances & client debt are reduced by the full 11,000 in the example.
     - Treasury inflow records **only** `amount`.
     - **No Expense record is created** — expenses remain workshop-only.
     - All inside the existing `DB::transaction`.
   - **Accounts/financial summary endpoint**: sum deductions via `ClientPayment::sum('deduction_amount')` (date-filtered, soft-delete aware) and expose it as a dedicated **"الخصومات"** value so the accounts page can compute `Net Profit = Gross Profit - Expenses - Deductions`.

### Step 3: Frontend Dashboard (Pure React .jsx)
1. **Procurement Form (`procurement-form.jsx`)**:
   - Add line item selector: **"خامة"** or **"منتج جاهز"**.
   - If "منتج جاهز" selected, choose from existing products or create a resale product on the fly.
2. **Products Page (`pages/products/page.jsx`)**:
   - Add a dedicated tab / filter: **"منتجات مصنعة" (Manufactured)** vs **"منتجات مشتراة للبيع" (Resale / Trading)**.
   - For resale products, display:
     - **سعر الشراء الأخير** (Last Purchase Price)
     - **تكلفة الوحدة النشطة FIFO** (Active FIFO Cost)
     - **سعر البيع** (Selling Price)
     - **هامش الربح** (Profit Margin)
   - Hide/disable BOM configuration button for resale items to prevent errors.
3. **Sales Page (`pages/sales/page.jsx`)**:
   - Invoice line selector allows picking **"منتج"** or **"خامة"**.
   - Real-time stock display and validation against the appropriate warehouse.
4. **Client Debt Payment Form** *(Feature 3 — in the clients/debts UI)*:
   - Add optional **"خصم / حسم"** input next to the payment amount field.
   - Show live helper text: total debt reduction = `amount + deduction`, cash collected = `amount`.
   - Validate client-side that `amount + deduction <= current debt`.
5. **Accounts Page (`pages/accounts/page.jsx`)** *(Feature 3)*:
   - Show a dedicated **"الخصومات / الحسم"** line in the financial calculations (fed by summed `client_payments.deduction_amount`).
   - Formula displayed: `Net Profit = Gross Profit - Expenses - Deductions`. Expenses list remains workshop expenses only.

---

## 5. Locked Decisions Summary

1. **Buyer for material sales = Client**: Material sales use standard client profiles for accounts receivable tracking.
2. **Warehouse Storage**: Resale products stored in `WSH-P`, raw materials in `WSH-M`.
3. **Display**: Resale products displayed on a dedicated tab with explicit purchase price and margin metrics.
4. **Manual Pricing**: Sale prices entered manually without auto-markup.
5. **Deductions at Payment Time Only, Not Expenses**: Client discounts are never applied by editing invoice prices; they are stored on the debt settlement (`client_payments.deduction_amount`) and reported on the accounts page as a separate **"الخصومات / الحسم"** line. `Net Profit = Gross Profit - Expenses - Deductions`. Expenses remain workshop expenses only. Treasury only ever receives actual cash.

---

## 6. Full File Touch-Points Checklist

| Layer | File Path | Scope of Change |
|---|---|---|
| **DB** | `erp-backend/database/migrations/*` (4 new migrations) | Additive columns & indexes |
| **Model** | `erp-backend/app/Models/ClientPayment.php` | Add `deduction_amount` to `$fillable` + `$casts` *(Feature 3)* |
| **Model** | `erp-backend/app/Models/Material.php` | Add `Sales_Issue` to stock outgoing types |
| **Model** | `erp-backend/app/Models/PurchaseOrderItem.php` | Fillable + relations |
| **Model** | `erp-backend/app/Models/SalesInvoiceItem.php` | Fillable + relations |
| **Backend** | `erp-backend/app/Http/Controllers/Api/PurchaseOrderController.php` | Lock on receive + route to WSH-P/WSH-M |
| **Backend** | `erp-backend/app/Http/Controllers/Api/ProductController.php` | Filter by `is_resale` + guard BOM |
| **Backend** | `erp-backend/app/Services/SalesService.php` | Dual-type item handling + warehouse routing + deduction split in `payClientDebt()` *(Feature 3)* |
| **Backend** | `erp-backend/app/Http/Controllers/Api/SalesController.php` | Eager load & format material items + deduction validation *(Feature 3)* |
| **Backend** | `erp-backend/app/Http/Controllers/Api/DashboardController.php` (or accounts summary endpoint) | Sum deductions & expose **"الخصومات"** value for `Net Profit = Gross Profit - Expenses - Deductions` *(Feature 3)* |
| **Frontend** | `dashboard/src/components/procurement/procurement-form.jsx` | Add product/material line selector |
| **Frontend** | `dashboard/src/pages/products/page.jsx` | Resale tab + purchase price & margin columns |
| **Frontend** | `dashboard/src/pages/sales/page.jsx` | Dual-item invoice rows |
| **Frontend** | Client debt payment form (clients/debts UI) | Optional "خصم / حسم" field with live totals *(Feature 3)* |
| **Frontend** | `dashboard/src/pages/accounts/page.jsx` | Dedicated "الخصومات / الحسم" line in financial calculations *(Feature 3)* |

---

## 7. Verification & Testing Gate

- [ ] Run backend tests: `php artisan test` (ensure 0 regressions on existing suites).
- [ ] Test 1: Create PO for raw materials → receive → verify stock in WSH-M & supplier debt.
- [ ] Test 2: Create PO for resale products → receive → verify stock in WSH-P, supplier debt, and purchase price sync.
- [ ] Test 3: Sell manufactured product → verify standard BOM/FIFO deduction.
- [ ] Test 4: Sell resale product → verify COGS equals purchase price & correct profit.
- [ ] Test 5: Sell raw material to a client on credit → verify WSH-M stock deduction, COGS = purchase price, and client receivable balance.
- [ ] Test 6: Verify attempt to add BOM to resale product is blocked.
- [ ] Test 7 *(Feature 3)*: Client owes 11,000 → settle with amount=10,000 + deduction=1,000 → client debt = 0, treasury inflow = 10,000 only.
- [ ] Test 8 *(Feature 3)*: Accounts page shows **"الخصومات"** = 1,000 and `Net Profit = Gross Profit - Expenses - Deductions` (Net Profit drops by exactly 1,000). No new Expense record is created.
- [ ] Test 9 *(Feature 3)*: Delete the payment → deduction disappears from accounts page, client debt restored to 11,000, treasury inflow reversed.
