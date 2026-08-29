# ERP System — Latest Implementation Plan
> Date: August 29, 2026
> Status: Approved, pending execution

---

## Execution Order (least risky → most risky)

| Priority | # | Item | Risk |
|---|---|---|---|
| 1 | 4 | Material price auto-update (1 line) | Trivial |
| 2 | 5 | Accounts page deduction card position | Trivial |
| 3 | 6 | Historical sale paid_amount + treasury fix | Small |
| 4 | 9 | Client PDF: show deposit + payments as child rows | Small |
| 5 | 10 | Supplier PO PDF: pending = deposit-only view | Small |
| 6 | 8 | Opening balance for clients & suppliers | Medium |
| 7 | 3 | Supplier debt: pending PO deposit as credit | Medium |
| 8 | 7 | Sales invoice delete + full undo | High |
| 9 | 11 | Universal Edit System (Modify any process) | Very High |

---

## Item 4 — Material Price Auto-Update on Supplier Form

**Problem:** When attaching a material to a supplier, if you select a material, then change to a different material, the price field keeps the old material's price and does not update. It only auto-fills if the price field is empty.

**Fix:**
- File: `dashboard/src/components/suppliers/MaterialLinkForm.jsx`
- Line 91: Remove `!matPrice` condition
- Change: `if (m && !matPrice) onMatPriceChange(...)` → `if (m) onMatPriceChange(m.unit_cost.toString())`

---

## Item 5 — Accounts Page: Move Deduction Card to Position 2

**Problem:** In the P&L Waterfall section of the accounts page, the deduction card is currently at Step 5. You want it at Step 2 (immediately after Total Sales).

**Fix:**
- File: `dashboard/src/pages/accounts/kpi-cards.jsx` 
- Pure JSX reorder: Move the deduction card JSX block from position 5 to position 2.

---

## Item 6 — Historical Opening Sale: Add paid_amount Field + Fix Treasury Formula

**Problem:** No `paid_amount` field on frontend. Backend records `gross_profit` into treasury instead of calculating based on what was actually paid.

**Correct formula:**
```
treasury_inflow = net_profit - remaining_amount
```
*Example: total = 10,000 | COGS = 6,000 | net_profit = 4,000 | paid = 7,000 | remaining = 3,000*
*Resulting treasury inflow = 4,000 - 3,000 = **1,000***

**Frontend changes — `HistoricalSaleModal.jsx`:**
- Add `paid_amount` number input field (default = full total, user can reduce it).
- Add `payment_method` dropdown.

**Backend changes — `SalesController::storeHistoricalSale`:**
- Accept `paid_amount` from request.
- Set `invoice.paid_amount = paid_amount` and `invoice.remaining_amount = totalAmount - paid_amount`.
- Compute treasury inflow:
  ```php
  $netProfit = round($totalAmount - $totalCogs, 2);
  $remainingAmount = round($totalAmount - $paidAmount, 2);
  $treasuryInflow = round($netProfit - $remainingAmount, 2);
  ```
- Call `$client->recalculateDebt()`.

---

## Item 9 — Client PDF: Show Deposit + Stage Payments as Child Rows

**Problem:** The PDF doesn't nest payments under their specific production orders. You want the order to show as a debt immediately, with its deposits and payments nested as credits.

**Desired PDF structure per production order:**
```
[Row]  2026-08-15  أمر إنتاج OP-2026-0001   +10,000    —        10,000
[Row]     ↳ عربون مقدم (نقدي)               —       -2,000     8,000
[Row]     ↳ دفعة جزئية (نقدي)              —       -3,000     5,000
```

**Frontend changes — `SupplierCard.jsx::printPdfReport()`:**
- Improve row rendering logic to visually group payment rows that have `parent_id` or `operation_id` matching an operation.
- Use indentation (↳ prefix), green background for payments, and slightly smaller font.

---

## Item 10 — Supplier PO PDF: Pending Shows Deposit Only, Received Shows Full

**Problem:** `printPurchaseOrderPdf()` always shows the full items table regardless of PO status.

**Frontend changes — `procurement-order-table.jsx::printPurchaseOrderPdf(po)`:**
- If `Pending`: Render header, supplier info card, and a deposit-only row (shown as credit/negative) with note "في انتظار الاستلام". No items table.
- If `Received`: Current full rendering.

---

## Item 8 — Opening Balance for Clients & Suppliers

**Problem:** No mechanism exists to record pre-system debt when onboarding mid-business.

**Changes:**
1. **Migration:** Add `opening_balance` decimal(15,2) default 0.00 to `clients` and `suppliers` tables.
2. **Backend:** Add `$this->opening_balance` to the final formula in `Client::recalculateDebt()` and `Supplier::recalculateDebt()`.
3. **Frontend:** Add "رصيد افتتاحي" field to Client and Supplier create/edit forms.

---

## Item 3 — Supplier Debt: Pending PO Deposit Shows as Negative (Credit to Us)

**Problem:** If a PO is `Pending` and we paid a deposit, the deposit disappears from accounts (leaves treasury but doesn't reduce supplier debt).

**Backend changes — `Supplier.php::recalculateDebt()`:**
- Add logic: Pending POs where we pre-paid a deposit count as a credit against the supplier.
- `finalDebt = $receivedDebt - $pendingCredit - $directStandalonePayments;`

---

## Item 7 — Sales Invoice Delete + Full Undo

**Problem:** Cannot delete a direct sales invoice.

**Required undo steps (must all run in one DB transaction):**
1. Restore inventory: create a reverse `Sales_Return` movement.
2. Revert treasury inflow via `TreasuryService`.
3. If linked to an operation: restore operation status to `Completed`, clear `delivered_at`.
4. Call `$client->recalculateDebt()`.
5. Force-delete the invoice + items.

**Changes:**
- Backend: Add `destroy` method to `SalesController` and route `DELETE /sales/{id}`.
- Frontend: Add delete button on `page.jsx`, with confirmation dialog.

---

## Item 11 — Universal Edit System (Modify Any Process)

**Problem:** The user needs to edit the details of *any* saved process (Sales Invoices, Production Orders, Purchase Orders, Expenses) at any time.

**Required Logic for Editing (The "Revert & Reapply" Pattern):**
Because changing quantities or prices affects inventory, treasury, and debt, every "Edit" action must strictly follow this pattern inside a DB Transaction:
1. **Revert Old:** Reverse the old inventory movements, undo old treasury entries, and subtract the old totals from debt.
2. **Update Record:** Save the new items, new quantities, and new prices to the DB.
3. **Apply New:** Create new inventory movements, new treasury entries, and recalculate the final debt.

**Scope of Implementation:**
- **Sales Invoices:** Convert the Create Invoice form to accept an `initialData` prop. Add `update` method to `SalesController`.
- **Production Orders:** Convert the Create Order form to accept `initialData`. Add `update` method to `OperationController`.
- **Purchase Orders:** Convert the Create PO form to accept `initialData`. Add `update` method to `PurchaseOrderController`.
- **Expenses & Payments:** Add standard Edit forms and backend `update` routes.
- **Frontend UI:** Add an "Edit" (✏️) button to every data table across all these pages.

---

## Files Index

| File | Items |
|---|---|
| `erp-backend/app/Models/Client.php` | 8 |
| `erp-backend/app/Models/Supplier.php` | 3, 8 |
| `erp-backend/app/Http/Controllers/Api/SalesController.php` | 6, 7, 11 |
| `erp-backend/app/Http/Controllers/Api/OperationController.php` | 11 |
| `erp-backend/app/Http/Controllers/Api/PurchaseOrderController.php` | 11 |
| `erp-backend/routes/api.php` | 7, 11 |
| `erp-backend/database/migrations/` | 8 (new migration) |
| `dashboard/src/components/suppliers/MaterialLinkForm.jsx` | 4 |
| `dashboard/src/pages/accounts/kpi-cards.jsx` | 5 |
| `dashboard/src/components/sales/HistoricalSaleModal.jsx` | 6 |
| `dashboard/src/pages/sales/page.jsx` | 7, 11 |
| `dashboard/src/components/suppliers/SupplierCard.jsx` | 9 |
| `dashboard/src/components/procurement/procurement-order-table.jsx` | 10, 11 |
| `dashboard/src/pages/production/page.jsx` | 11 |