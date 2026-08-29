# ERP System — Latest Implementation Plan
> Date: August 29, 2026
> Status: Approved, pending execution
> Rule: Do NOT execute any item without explicit user instruction per item.

---

## Execution Order (least risky → most risky)

| Priority | # | Item | Risk |
|---|---|---|---|
| 1 | 4 | Material price auto-update (1 line) | Trivial |
| 2 | 5 | Accounts page deduction card position | Trivial |
| 3 | 6 | Historical sale paid_amount + treasury fix | Small |
| 4 | 1 | Client debt: zero until Delivered | Medium |
| 5 | 3 | Supplier debt: pending PO deposit as credit | Medium |
| 6 | 9 | Client PDF: show deposit + payments as child rows | Small |
| 7 | 10 | Supplier PO PDF: pending = deposit-only view | Small |
| 8 | 8 | Opening balance for clients & suppliers | Medium |
| 9 | 7 | Sales invoice delete + full undo | High |

---

## Item 4 — Material Price Auto-Update on Supplier Form

**Problem:** When attaching a material to a supplier, if you select a material, then change to a different material, the price field keeps the old material's price and does not update. It only auto-fills if the price field is empty.

**Root cause:** `MaterialLinkForm.jsx` line 91:
```js
if (m && !matPrice) onMatPriceChange(m.unit_cost.toString())
```
The `!matPrice` condition prevents overwriting once a price exists.

**Fix:**
- File: `dashboard/src/components/suppliers/MaterialLinkForm.jsx`
- Line 91: Remove `!matPrice` condition
- Change: `if (m && !matPrice) onMatPriceChange(...)` → `if (m) onMatPriceChange(m.unit_cost.toString())`

**Result:** Every time a new material is selected, the price field always updates to that material's stored unit_cost.

---

## Item 5 — Accounts Page: Move Deduction Card to Position 2

**Problem:** In the P&L Waterfall section of the accounts page, the deduction card ("الخصومات / الحسم") is currently at Step 5 (after Operating Expenses). You want it at Step 2 (immediately after Total Sales).

**Current order in `kpi-cards.jsx`:**
1. إجمالي المبيعات (Revenue)
2. تكلفة البضاعة / COGS
3. مجمل الربح (Gross Profit)
4. المصروفات التشغيلية (Operating Expenses)
5. **الخصومات / الحسم** ← move this to position 2
6. صافي الربح (Net Profit)

**Fix:**
- File: `dashboard/src/pages/accounts/kpi-cards.jsx` (inside the P&L Waterfall grid)
- Pure JSX reorder, no logic change
- Move the deduction card JSX block from position 5 to position 2

---

## Item 6 — Historical Opening Sale: Add paid_amount Field + Fix Treasury Formula

**Problem (two parts):**

**Part A — No paid_amount field:**
The historical sale form (`HistoricalSaleModal.jsx`) has no field for how much the client already paid. It always marks the invoice as fully paid (`paid_amount = totalAmount, remaining_amount = 0`). The `payment_method` is also hardcoded to `cash` with no UI dropdown.

**Part B — Wrong treasury formula:**
The backend (`SalesController::storeHistoricalSale`) records only `netProfit` (gross profit) in treasury, ignoring whether the client actually paid in full or partially.

**Correct formula:**
```
treasury_inflow = paid_amount - (total_cogs × paid_amount / total_amount)
               = net profit on the collected portion only
```

Example:
- total_amount = 10,000 | total_cogs = 6,000 | gross_profit = 4,000
- client paid 7,000 → remaining = 3,000
- treasury = 7,000 - (6,000 × 7,000/10,000) = 7,000 - 4,200 = **2,800**
- client debt = 3,000

**Frontend changes — `HistoricalSaleModal.jsx`:**
- Add `paid_amount` number input field (default = full total, user can reduce it)
- Add `payment_method` dropdown (currently hardcoded to 'cash' with no UI)
- Send `paid_amount` in payload to backend

**Backend changes — `SalesController::storeHistoricalSale`:**
- Accept `paid_amount` from request (validate: nullable|numeric|min:0, max = totalAmount)
- Default `paid_amount` to `totalAmount` if not provided (backward compatible)
- Set `invoice.paid_amount = paid_amount`
- Set `invoice.remaining_amount = totalAmount - paid_amount`
- Compute treasury inflow as proportional net profit:
  ```php
  $collectionRatio = $totalAmount > 0 ? ($paidAmount / $totalAmount) : 1;
  $proportionalCogs = round($totalCogs * $collectionRatio, 2);
  $treasuryInflow = round($paidAmount - $proportionalCogs, 2);
  ```
- Only record treasury inflow if `$paidAmount > 0` AND `$treasuryInflow > 0`
- Call `$client->recalculateDebt()` if a client is linked

---

## Item 1 — Client Debt: Zero Until Delivered, Deposit = Negative Credit

**Problem:** `Client::recalculateDebt()` currently adds the full `total_price - payments_made` of any Pending/Active/In_Progress operation to client debt immediately at order creation. This is wrong — the client did not receive goods yet so no debt should exist.

**Correct business rules:**
- `Pending` / `Active` / `In_Progress` / `Completed` operations → contribute **zero** positive debt
- Deposits and stage payments collected on these uninvoiced operations → show as **negative debt** (client is in credit, money received but no goods delivered yet)
- Only `Delivered` operations (which create a `SalesInvoice` with `invoice_type = 'order_delivery'`) → show as positive debt via `invoiceDebt`

**Example:**
- Order created: total = 10,000, deposit paid = 2,000 → client debt = **-2,000** (credit)
- After delivery: invoice created with remaining = 8,000 → client debt = **+8,000**

**Backend changes — `Client.php::recalculateDebt()` (lines 91–124):**
- Remove the section that adds `total_price - paid_so_far` for Pending/Active/In_Progress ops to `$opDebt`
- For uninvoiced (non-Delivered) operations: sum all collected payments (deposit + stage payments) and subtract from debt as credit
- `$invoiceDebt` already correctly handles Delivered operations via `SalesInvoice.remaining_amount` — keep that
- Remove the `$opDebt -= $totalCollected` for Completed ops (they will now be handled the same as Pending)

**New `$opDebt` logic (simplified):**
```php
// For ALL uninvoiced operations (Pending, Active, In_Progress, Completed without invoice):
//   credit = deposit_paid + sum(operation_payments)
//   these reduce overall debt (client pre-paid before delivery)
$opCredit = 0;
foreach ($uninvoicedOps as $op) {
    $collected = $op->deposit_paid + $op->payments->sum('amount_paid');
    $opCredit += $collected;
}
// $opCredit will be subtracted from total debt (client is in credit for this amount)
```

**Final formula:**
```
finalDebt = invoiceDebt - opCredit - directPayments
```

---

## Item 3 — Supplier Debt: Pending PO Deposit Shows as Negative (Credit to Us)

**Problem:** `Supplier::recalculateDebt()` only counts `Received` POs in the debt calculation. If a PO is `Pending` and we paid a deposit, the deposit disappears from accounts — it leaves the treasury but shows nowhere as a credit against the supplier.

**Correct business rules:**
- `Pending` PO with deposit paid → supplier owes us that deposit back (or we will receive goods worth that amount) → show as **negative supplier debt** (credit to us)
- `Received` PO → `total_amount - deposit_paid` = remaining we owe supplier (positive debt)

**Backend changes — `Supplier.php::recalculateDebt()`:**
- For `Pending` POs: subtract `deposit_paid` from total (adds to our credit)
- Formula:
  ```php
  // Received POs: we owe total_amount - all_payments_made
  $receivedDebt = sum of (total_amount - payments) for Received POs;

  // Pending POs: we pre-paid deposit, this is a credit against supplier
  $pendingCredit = sum of deposit_paid for Pending POs;

  $finalDebt = $receivedDebt - $pendingCredit - $directStandalonePayments;
  ```

---

## Item 9 — Client PDF: Show Deposit + Stage Payments as Child Rows

**Problem:** The existing `printPdfReport()` in `SupplierCard.jsx` shows production orders, but deposits and stage payments are not clearly nested under their parent operation in the PDF. The user wants to see the full payment history for each order clearly:

**Desired PDF structure per production order:**
```
[Row]  2026-08-15  أمر إنتاج OP-2026-0001   +10,000    —        10,000
[Row]     ↳ عربون مقدم (نقدي)               —       -2,000     8,000
[Row]     ↳ دفعة جزئية (نقدي)              —       -3,000     5,000
```

**Frontend changes — `SupplierCard.jsx::printPdfReport()`:**
- The `getClientTransactions` API already returns all transactions sorted chronologically with `running_debt`
- Improve the row rendering logic to visually group payment rows that have `parent_id` or `operation_id` matching an operation, using indentation (↳ prefix, green background, slightly smaller font)
- No backend changes needed — data is already there

---

## Item 10 — Supplier PO PDF: Pending Shows Deposit Only, Received Shows Full

**Problem:** `printPurchaseOrderPdf()` in `procurement-order-table.jsx` always shows the full items table regardless of PO status. You want:
- **Pending PO:** PDF shows header + supplier info + only the deposit line as a credit (negative) with note "في انتظار الاستلام"
- **Received PO:** PDF shows full items table + summary (current behavior)

**Frontend changes — `procurement-order-table.jsx::printPurchaseOrderPdf(po)`:**
- Add conditional on `po.status`:
  ```js
  if (po.status === 'Pending') {
    // Render: header, supplier info card, deposit-only row (shown as credit/negative)
    // No items table
    // Summary shows: deposit paid as "مبلغ مقدم مسدد" + "في انتظار استلام البضاعة"
  } else {
    // Current full rendering (keep as-is)
  }
  ```

---

## Item 8 — Opening Balance for Clients & Suppliers

**Problem:** No mechanism exists to record pre-system debt. When you onboard the system mid-business, existing client debts and supplier debts have no way to be entered.

**Design:**
- Add `opening_balance` decimal column to `clients` and `suppliers` tables
- Positive = they owe us (client) / we owe them (supplier)
- Negative = they are in credit (client pre-paid) / supplier owes us (they pre-delivered)
- This is a one-time fixed snapshot — not recalculated dynamically
- `recalculateDebt()` on both models: `finalDebt += opening_balance`

**Changes:**
1. **New migration:** `add_opening_balance_to_clients_and_suppliers`
   - `clients`: add `opening_balance` decimal(15,2) default 0.00
   - `suppliers`: add `opening_balance` decimal(15,2) default 0.00

2. **Backend — `Client.php::recalculateDebt()`:**
   - Add `+ $this->opening_balance` to final formula

3. **Backend — `Supplier.php::recalculateDebt()`:**
   - Add `+ $this->opening_balance` to final formula

4. **Backend — `SalesController::storeClient()` & `updateClient()`:**
   - Accept `opening_balance` in validated fields

5. **Backend — `SupplierController::store()` & `update()`:**
   - Accept `opening_balance` in validated fields

6. **Frontend — Client create/edit form:**
   - Add "رصيد افتتاحي" number input with note: موجب = يدين لنا / سالب = له رصيد دائن

7. **Frontend — Supplier create/edit form:**
   - Add "رصيد افتتاحي" number input with note: موجب = نحن مدينون له / سالب = له رصيد مدفوع مسبقاً

---

## Item 7 — Sales Invoice Delete + Full Undo

**Problem:** There is no way to delete a direct sales invoice. The route `DELETE /sales/{id}` does not exist. Once a sale is recorded, it cannot be undone.

**Required undo steps (must all run in one DB transaction):**
1. Restore inventory: for each `SalesInvoiceItem`, create a reverse `Sales_Return` movement (add stock back to the warehouse it was deducted from)
2. Revert treasury inflow: `TreasuryService::revertBySource(SalesInvoice::class, $invoice->id)`
3. If linked to a production operation (`operation_id` on invoice): restore operation status to `Completed` (from `Delivered`), clear `delivered_at`
4. Call `$client->recalculateDebt()`
5. Force-delete the invoice + its items

**Backend changes:**
- `SalesController`: add `destroy(string $id): JsonResponse` method
- `routes/api.php`: add `Route::delete('/sales/{id}', ...)` inside `manage_sales` middleware group

**Frontend changes:**
- `dashboard/src/pages/sales/page.jsx`: add delete button on each invoice row
- Show confirmation dialog before deleting
- Refresh list on success

**Scope:** High complexity — touches inventory, treasury, client debt, and potentially operation status. Must be tested carefully.

---

## Key Business Rules Summary (for reference during implementation)

| Scenario | Client Debt Effect | Treasury Effect |
|---|---|---|
| Production order created, no deposit | 0 | 0 |
| Production order created, deposit paid | **-deposit** (credit) | +deposit inflow |
| Stage payment added to active order | **-payment** (more credit) | +payment inflow |
| Order delivered (deliver button pressed) | **+remaining_after_payments** (positive debt) | 0 (already collected) |
| Direct sale invoice | **+remaining** (if not fully paid) | +paid_amount inflow |
| Historical sale, partially paid | **+remaining** | +proportional net profit on paid portion |
| PO created, pending, deposit paid | Supplier: **-deposit** (credit to us) | -deposit outflow |
| PO received | Supplier: **+(total - deposit)** | 0 (treasury already paid) |

---

## Files Index

| File | Items |
|---|---|
| `erp-backend/app/Models/Client.php` | 1, 8 |
| `erp-backend/app/Models/Supplier.php` | 3, 8 |
| `erp-backend/app/Http/Controllers/Api/SalesController.php` | 6, 7 |
| `erp-backend/routes/api.php` | 7 |
| `erp-backend/database/migrations/` | 8 (new migration) |
| `dashboard/src/components/suppliers/MaterialLinkForm.jsx` | 4 |
| `dashboard/src/pages/accounts/kpi-cards.jsx` | 5 |
| `dashboard/src/components/sales/HistoricalSaleModal.jsx` | 6 |
| `dashboard/src/pages/sales/page.jsx` | 7 |
| `dashboard/src/components/suppliers/SupplierCard.jsx` | 9 |
| `dashboard/src/components/procurement/procurement-order-table.jsx` | 10 |
