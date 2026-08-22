# Implementation Plan — Employee Labor Financial Integration (Treasury + Product Costing)

> Source specification: [.agents/decision-map.md](.agents/decision-map.md)
> Scope: financial integration of employee labor (time-based **and** production-based) into the unified treasury and product costing, plus the two new UI views (Weekly Timesheet, Production Log).
> **This document is a plan only — no source code has been modified.**

---

## Table of Contents

1. [Current State Summary (verified)](#1-current-state-summary)
2. [Resolved Design Decisions](#2-resolved-design-decisions)
3. [Target Architecture & Money Flows](#3-target-architecture--money-flows)
4. [Phase 1 — Database Schema Modifications](#4-phase-1--database-schema-modifications)
5. [Phase 2 — Backend Models & Services](#5-phase-2--backend-models--services)
6. [Phase 3 — API Routes & Controller Logic](#6-phase-3--api-routes--controller-logic)
7. [Phase 4 — Product Costing Integration](#7-phase-4--product-costing-integration)
8. [Phase 5 — Frontend Components](#8-phase-5--frontend-components)
9. [Edge Cases, Guards & Data Integrity Rules](#9-edge-cases-guards--data-integrity-rules)
10. [Testing & Acceptance Checklist](#10-testing--acceptance-checklist)
11. [Rollback & Backward Compatibility](#11-rollback--backward-compatibility)
12. [Task Order & Effort Estimate](#12-task-order--effort-estimate)

---

## 1. Current State Summary

Verified facts about the codebase that constrain this plan:

### Backend — `erp-backend/` (Laravel 12, PHP 8.2, MySQL, Sanctum)

| Concern | Status | Location |
|---|---|---|
| `employees` | `salary_cycle` enum: `day, few_days, week, month, production`; `rate` decimal(12,2) | `database/migrations/2026_08_21_000000_create_employees_table.php`, `2026_08_21_065141_add_week_to_salary_cycle_in_employees.php` |
| `employee_salaries` | Single payment record only (base, deductions, net, product_id, production qty/rate) | `2026_08_21_000001_create_employee_salaries_table.php`, `2026_08_21_000002_add_product_id_to_employee_salaries_table.php` |
| `treasury_transactions` | Unified ledger: `type` inflow/outflow, `payment_method` (5 methods), `category`, `source_type`/`source_id`, auto `TRX-{year}-{n}` numbering | `2026_08_14_000000_create_unified_treasury_and_sales_tables.php` |
| Treasury writes | Only via `TreasuryService::recordInflow / recordOutflow / revertBySource / getBalances` | `app/Services/TreasuryService.php` |
| **Salary → treasury gap** | `EmployeeController@recordSalary` creates the `employee_salaries` row but does **NOT** create a treasury outflow (marked STUB) | `app/Http/Controllers/Api/EmployeeController.php:96` |
| **No attendance / timesheet / production-log / employee-ledger tables** | Confirmed absent everywhere (models, migrations, controllers, routes, frontend) | — |
| Services ("خدمات") | Modeled as rows in `materials` with `type='service'` (e.g., تصنيع / تنجيد) — there is no dedicated services table | `Material` model |
| Product cost | `products.unit_cost` = BOM Σ(material.unit_cost × pivot qty), auto-recalced on material price change; read-time FIFO analysis in `Product::getCostPricingAnalysis()`; sale-time COGS snapshotted onto `sales_invoice_items` | `Product.php`, `ProductController.php`, `InventoryService.php` |
| Production orders | `operations` + `operation_products`; completion consumes materials FIFO (`Production_Consumption`) and receives finished goods FIFO layer (`Production_Receipt`) whose `unit_cost` currently holds **material cost only — no labor** | `OperationController.php` |
| Multi-tenancy | `TenantMiddleware` switches DB to `arabic_erp_tenant_{id}` for tenant users | `app/Http/Middleware/TenantMiddleware.php` |

### Frontend — `dashboard/` (React 19, Vite 6, JSX, Tailwind v4, zustand, axios, react-router v7)

| Concern | Status | Location |
|---|---|---|
| Employees page | Two tabs (Employees / Salaries history) + "تسجيل دفعة راتب جديدة" modal — this is what we replace/extend | `src/pages/employees/page.jsx` (1293 lines; salary modal lines 524–754) |
| API layer | Single axios instance with Sanctum token interceptor; plain `useEffect` fetching (no react-query) | `src/lib/api-client.jsx` |
| Grid pattern | Responsive dual-render: mobile stacked cards + desktop `<table>`; see `src/components/accounts/transactions-table.jsx` | — |
| Modal pattern | No shared Modal; local overlay recipe per feature (`fixed inset-0 z-[50] … bg-[#2F264C]`) | `pages/employees/page.jsx:812` |
| RTL/Arabic | `<html lang="ar" dir="rtl">`; labels are hardcoded Arabic strings (no i18n calls) | `index.html`, all pages |
| Timesheet / production-log UI | Does not exist anywhere | — |

---

## 2. Resolved Design Decisions

The decision map lists three "Frontier" blockers. They are resolved here as follows (rationale included so implementers do not re-litigate):

### D1 — Data Model: dedicated ledger + attendance + production-log tables ✅

**Decision:** Create three new tables and leave `employee_salaries` as the *payment* record (extended with a `type` column):

```
employee_attendance        → one row per employee per day (presence + daily advance + penalty)
employee_production_logs   → one row per employee-product-day (pieces × piece-rate)
employee_ledger_entries    → append-only debt ledger (credit = labor accrued, debit = cash paid)
```

**Why not expand `employee_salaries` / `employee_timesheets` only:**
- `employee_salaries` is a *cash settlement* record; labor accrual is a different economic event that can exist without any payment (unpaid week = pure liability). Mixing them makes deletion/reversal logic ambiguous.
- A dedicated `employee_ledger_entries` mirrors the proven treasury design in this codebase: **append-only journal, balance computed by SUM, never a mutable running-balance column** (`TreasuryService::getBalances()` works exactly this way). It also gives us free polymorphic traceability (`source_type`/`source_id`) back to whichever business document caused the entry.
- The weekly timesheet becomes a **UI/view concern** (a grouped query over `employee_attendance` for a Saturday→Thursday window), not a stored aggregate — so editing a single day never corrupts a stored weekly blob.

### D2 — Product Cost Mechanism: hybrid (accumulate on operation → fold into FIFO receipt; aggregate for reporting) ✅

**Decision:**
1. `operations` gains a `labor_cost` column. Every production log tied to an operation increments it (and decrements on delete).
2. When `OperationController@complete` creates the finished-goods FIFO `Production_Receipt` movement, the layer's `unit_cost` becomes **material blended cost + (operation.labor_cost ÷ produced quantity)**. This makes labor automatically flow into sale-time COGS with zero changes to sales/inventory read paths.
3. For production logs **not** tied to an operation (ad-hoc piece work), labor is exposed as a read-time aggregate (`labor_cost_total` / `labor_cost_avg_per_unit`) in `ProductController@show/stats` — reported but not pushed into `products.unit_cost`, keeping the stored master cost deterministic (BOM-driven).
4. Double-count guard: internal labor services (تصنيع/تنجيد) get an `is_labor_based` flag on `materials`. When true, their static `unit_cost` is **excluded** from theoretical BOM pricing wherever actual labor exists for that product (see §7.4). If the flag is off, the old behavior is preserved and the UI shows a warning that labor may be counted twice.

**Why not mutate `products.unit_cost` on every produced piece:** `products.unit_cost` is the *master BOM price*, auto-recalculated by the `Material::updated` hook — writing labor into it would be overwritten on the next material price change and would corrupt the "theoretical vs actual" comparison that `getCostPricingAnalysis()` provides. The FIFO-receipt approach matches how material cost already enters COGS.

### D3 — Advances vs Salaries: one treasury outflow per real cash handout ✅

**Decision:** Every actual movement of cash to an employee produces exactly **one** `treasury_transactions` outflow:
- A daily advance typed into Tuesday's cell → outflow dated Tuesday, category `سلفة موظف`, source `EmployeeSalary {type:'advance'}`.
- The Thursday net payout → one outflow dated Thursday, category `راتب أسبوعي`, source `EmployeeSalary {type:'salary'}`.
- Monthly salaries → existing flow, now also generating the outflow.

Rationale: the treasury is defined in this codebase as the *"Single Source of Truth for Cash Flow"*. Batching a week of advances into one Thursday transaction would misstate daily liquidity. (If batching is ever desired, it is a UI-side choice to leave cells empty until Thursday — no backend change needed.)

---

## 3. Target Architecture & Money Flows

### 3.1 Ledger conventions

`employee_ledger_entries` (debt owed **by the workshop to the employee**, positive = we owe more):

| Entry type | Trigger | Source document |
|---|---|---|
| `credit` (+) | Weekly timesheet saved with earned days (net of penalties) | `EmployeeAttendance::class` (one entry per day with `daily_wage > 0`) |
| `credit` (+) | Production log row saved (gross_wage net of per-row deduction) | `EmployeeProductionLog::class` |
| `debit` (−) | Any payment: advance, weekly net, monthly salary, bonus | `EmployeeSalary::class` |

Outstanding balance = `SUM(credit) − SUM(debit)` per employee (computed live, indexed by `[employee_id, entry_date]`).

### 3.2 Unified Weekly Timesheet Flow (Supports Time-based, Piece-rate & Hybrid per Images 4–6)

An employee can be compensated under three daily modes within the same weekly sheet:
1. **Time-based (Full/Half Day)**: Task logged (e.g., "صيانة ماكينات"), `daily_wage` accrued (full or half rate).
2. **Piece-rate**: Product produced (e.g., "بنطلون جينز"), `quantity × piece_rate` accrued.
3. **Hybrid (Combined)**: Half-day task ("جرد مخازن" = 75 EGP) + remaining day production (25 shirts × 5 EGP = 125 EGP) $\rightarrow$ Day Total = 200 EGP.

```
Save weekly timesheet (Sat..Thu grid)
 ├─ UPSERT 6 × employee_attendance (work_date, work_mode, task_description, daily_wage, advance_amount, notes)
 ├─ FOR EACH day with production data (Piece-rate or Hybrid):
 │    ├─ UPSERT employee_production_logs {employee_id, work_date, product_id, quantity, piece_rate, gross_wage, ...}
 │    └─ UPSERT employee_ledger_entry {credit, amount=gross_wage, source EmployeeProductionLog}
 ├─ FOR EACH day with daily_wage > 0 (Time-based or Hybrid):
 │    └─ UPSERT employee_ledger_entry {credit, amount=(daily_wage − penalty), source EmployeeAttendance}
 ├─ FOR EACH day with advance_amount > 0:
 │    ├─ INSERT/UPDATE employee_salaries {type:'advance', payment_date=day, net_salary=advance}
 │    ├─ TreasuryService::recordOutflow(..., category 'سلفة موظف', sourceType EmployeeSalary::class, sourceId)
 │    └─ INSERT/UPDATE employee_ledger_entry {debit, amount=advance, source EmployeeSalary}
 └─ RETURN grid totals & settlement summary (Image 6):
      • Total Time-based Wages (إجمالي مستحقات اليومية)
      • Total Piece-rate Wages (إجمالي مستحقات القطعة)
      • Total Gross Wages (مجموع الأجر الإجمالي)
      • Total Weekly Advances (إجمالي السلف الأسبوعية)
      • Net Payable Thursday Salary (الصافي النهائي الصالح للصرف)

Thursday payout ("صرف صافي الراتب")
 ├─ INSERT employee_salaries {type:'salary', start_date=week_start, end_date=thursday,
 │                            base_salary=gross_total, deductions=advances+penalties,
 │                            net_salary=net_payable}
 ├─ TreasuryService::recordOutflow(..., category 'راتب أسبوعي')
 └─ INSERT employee_ledger_entry {debit, amount=net_payable, source EmployeeSalary}
```

### 3.3 Flow B — Standalone Production Log Entry (Ad-hoc batch logging)

For direct workshop logging outside the weekly sheet:
```
Save production log row(s)
 ├─ INSERT employee_production_logs {product_id, operation_id?, quantity, piece_rate, gross_wage=qty×rate, deductions, net_wage}
 ├─ INSERT employee_ledger_entry {credit, amount=net_wage, source EmployeeProductionLog}
 ├─ IF operation_id: UPDATE operations SET labor_cost = labor_cost + gross_wage
 └─ IF operation completed later:
      Production_Receipt.unit_cost = material_blended_unit_cost + (operations.labor_cost ÷ operation.quantity)
```

### 3.4 Invariant

At any moment: `employee outstanding balance == SUM(employee_ledger_entries)` and every debit entry has a matching soft-deleted-able treasury outflow with `source_type='App\Models\EmployeeSalary'`, `source_id=<salary id>`.

---

## 4. Phase 1 — Database Schema Modifications

All files under `erp-backend/database/migrations/`. Every migration must implement a working `down()` (drop created tables/columns) and must be tenant-safe (see §9.6).

### 4.1 `2026_08_22_000001_create_employee_attendances_table.php`

```php
Schema::create('employee_attendances', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
    $table->date('work_date');
    $table->string('work_mode', 20)->default('full_day');    // full_day|half_day|piece_rate|hybrid|absent|leave
    $table->string('task_description')->nullable();           // free-text task label (for time-based / hybrid days)
    $table->enum('status', ['present', 'absent', 'half_day', 'leave', 'holiday'])->default('present');
    $table->decimal('daily_wage', 12, 2)->default(0);        // wage ACCRUED for this day (snapshot)
    $table->decimal('penalty_amount', 12, 2)->default(0);    // reduces the accrued wage
    $table->string('penalty_reason')->nullable();
    $table->decimal('advance_amount', 12, 2)->default(0);    // cash HANDED this day (settles debt)
    $table->foreignId('advance_salary_id')->nullable()       // -> employee_salaries (created if advance>0)
          ->constrained('employee_salaries')->nullOnDelete();
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->unique(['employee_id', 'work_date']);            // one row per person/day
    $table->index('work_date');
    $table->index(['employee_id', 'status']);
});
```

### 4.2 `2026_08_22_000002_create_employee_production_logs_table.php`

```php
Schema::create('employee_production_logs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
    $table->date('work_date');
    $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
    $table->foreignId('operation_id')->nullable()->constrained('operations')->nullOnDelete();
    $table->foreignId('labor_service_id')->nullable()       // materials.id where type='service'
          ->constrained('materials')->nullOnDelete();       //   (تصنيع / تنجيد classification)
    $table->decimal('quantity', 10, 2);
    $table->decimal('piece_rate', 12, 2)->default(0);       // SNAPSHOT at save time
    $table->decimal('gross_wage', 12, 2)->default(0);       // quantity × piece_rate (stored)
    $table->decimal('deductions', 12, 2)->default(0);
    $table->string('deduction_reason')->nullable();
    $table->decimal('net_wage', 12, 2)->default(0);         // gross_wage − deductions (stored)
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->index(['employee_id', 'work_date']);
    $table->index('product_id');
    $table->index('operation_id');
});
```

### 4.3 `2026_08_22_000003_create_employee_ledger_entries_table.php`

```php
Schema::create('employee_ledger_entries', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
    $table->date('entry_date');
    $table->string('type', 10);                              // 'credit' = labor accrued (+debt), 'debit' = paid (-debt)
    $table->decimal('amount', 12, 2);
    $table->text('description')->nullable();
    $table->string('source_type')->nullable();               // App\Models\EmployeeAttendance |
    $table->unsignedBigInteger('source_id')->nullable();     // EmployeeProductionLog | EmployeeSalary
    $table->unsignedBigInteger('created_by')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->index(['employee_id', 'entry_date']);
    $table->index(['source_type', 'source_id']);
});
```

### 4.4 `2026_08_22_000004_extend_employee_salaries_for_advances_table.php`

```php
Schema::table('employee_salaries', function (Blueprint $table) {
    $table->string('type', 20)->default('salary')->after('employee_id'); // 'salary' or 'advance' (string used instead of ENUM to avoid MySQL table-locking on live tables and guarantee SQLite test compatibility)
    $table->date('week_start')->nullable()->after('end_date'); // anchor for weekly payouts
});
```
Notes:
- Existing rows keep `type='salary'` via default → fully backward compatible.
- String column (`varchar(20)`) is used consistently with `TreasuryTransaction::type` to prevent metadata/table locks on live MySQL instances.
- `production_quantity` / `production_rate` / `product_id` remain usable for ad-hoc production payouts.

### 4.5 `2026_08_22_000005_add_labor_cost_to_operations_table.php`

```php
Schema::table('operations', function (Blueprint $table) {
    $table->decimal('labor_cost', 15, 2)->default(0)->after('total_price');
});
```

### 4.6 `2026_08_22_000006_add_labor_flags_to_materials_and_products.php`

```php
Schema::table('materials', function (Blueprint $table) {
    $table->boolean('is_labor_based')->default(false)->after('service_location'); // تصنيع/تنجيد
});
Schema::table('products', function (Blueprint $table) {
    $table->decimal('actual_labor_cost_cache', 15, 2)->default(0)->after('unit_cost'); // optional read cache
});
```
(`actual_labor_cost_cache` is a denormalized convenience figure refreshed when logs change; the authoritative value is always recomputable from `employee_production_logs`. If the team prefers zero denormalization, drop this column — see §7.4.)

---

## 5. Phase 2 — Backend Models & Services

New files under `erp-backend/app/`.

### 5.1 `app/Models/EmployeeAttendance.php`

```php
class EmployeeAttendance extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'employee_id','work_date','work_mode','task_description','status','daily_wage',
        'penalty_amount','penalty_reason','advance_amount',
        'advance_salary_id','notes',
    ];
    protected $casts = ['work_date' => 'date', 'daily_wage' => 'decimal:2',
                        'penalty_amount' => 'decimal:2', 'advance_amount' => 'decimal:2'];

    public function employee(): BelongsTo  { return $this->belongsTo(Employee::class); }
    public function advance(): BelongsTo   { return $this->belongsTo(EmployeeSalary::class, 'advance_salary_id'); }
    public function ledgerEntries(): MorphMany { return $this->morphMany(EmployeeLedgerEntry::class, 'source'); }
}
```

### 5.2 `app/Models/EmployeeProductionLog.php`

Same pattern; fillable per §4.2; relations `employee()`, `product()`, `operation()`, `laborService()` (belongsTo `Material`), `ledgerEntries(): morphMany`.

### 5.3 `app/Models/EmployeeLedgerEntry.php`

```php
class EmployeeLedgerEntry extends Model
{
    use HasFactory, SoftDeletes;

    const TYPE_CREDIT = 'credit'; // labor accrued — we owe more to employee
    const TYPE_DEBIT  = 'debit';  // cash paid — debt reduced

    protected $fillable = ['employee_id','entry_date','type','amount',
                           'description','source_type','source_id','created_by'];
    protected $casts = ['entry_date' => 'date', 'amount' => 'decimal:2'];

    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function source(): MorphTo     { return $this->morphTo(); }

    public function scopeCredits($q) { return $q->where('type', self::TYPE_CREDIT); }
    public function scopeDebits($q)  { return $q->where('type', self::TYPE_DEBIT); }
}
```

### 5.4 Extend `app/Models/Employee.php`

```php
public function attendances(): HasMany      { return $this->hasMany(EmployeeAttendance::class); }
public function productionLogs(): HasMany   { return $this->hasMany(EmployeeProductionLog::class); }
public function ledgerEntries(): HasMany    { return $this->hasMany(EmployeeLedgerEntry::class); }

// Outstanding balance the workshop owes the employee (live, single employee lookup only)
// NOTE: For bulk listings or stats, NEVER call this in a loop; use EmployeeLedgerService grouped queries instead to prevent N+1 queries.
public function outstandingBalance(): float
{
    return EmployeeLedgerService::outstandingBalance($this->id);
}
```
(The canonical implementation lives in `EmployeeLedgerService::outstandingBalance($employeeId)` — a single `SELECT SUM(CASE …)`; the model helper delegates to it.)

### 5.5 New `app/Services/EmployeeLedgerService.php` — single write gateway

All ledger mutations go through this service (mirrors how all cash goes through `TreasuryService`). Methods:

```php
class EmployeeLedgerService
{
    /** Credit: labor accrued. Returns the entry. */
    public static function credit(int $employeeId, float $amount, string $date,
        string $description, ?string $sourceType = null, ?int $sourceId = null): EmployeeLedgerEntry;

    /** Debit: cash paid out (advance/salary). */
    public static function debit(int $employeeId, float $amount, string $date,
        string $description, ?string $sourceType = null, ?int $sourceId = null): EmployeeLedgerEntry;

    /** Soft-delete all entries for a source doc (used when reverting). */
    public static function revertBySource(string $sourceType, int $sourceId): void;

    /** SUM(credit) - SUM(debit), soft-delete aware. */
    public static function outstandingBalance(int $employeeId): float;

    /** Statement rows + running balance for UI (ordered by entry_date, id). */
    public static function statement(int $employeeId, ?string $from, ?string $to, int $perPage = 50): LengthAwarePaginator;
}
```
Rules baked into the service:
- Throws `InvalidArgumentException` when `amount <= 0` (skip silently at call sites for zero-value days).
- Defaults `entry_date` to today, `created_by` to `auth()->id()`.
- **Must always be called inside the caller's `DB::transaction`** together with the source-document insert and the treasury call — one atomic unit.
- **`outstandingBalance` must exclude soft-deleted entries** — the `SoftDeletes` global scope handles this by default; never use `withTrashed()` in the balance query. The `destroy` guard in `ProductionLogController` relies on this: `outstandingBalance() - log->net_wage < 0` is only meaningful when reverted entries are already excluded.

### 5.6 Extend `app/Models/Material.php`

- Add `is_labor_based` to `$fillable` and casts.
- Adjust the `updated` hook: when a labor-based service's `unit_cost` changes, **do not** force `recalculateCost()` on products that have actual labor logged (flag-controlled; §7.4). Keep behavior identical when flag is false.

---

## 6. Phase 3 — API Routes & Controller Logic

### 6.1 Routes — additions to `erp-backend/routes/api.php`

Inside the existing protected group (`auth:sanctum` + `TenantMiddleware`), next to the current employee block (routes/api.php lines ~44–54):

```php
// ---- Employee Labor: Timesheets (weekly grid, Sat→Thu) ----
Route::get('/employees/{id}/timesheet',        [TimesheetController::class, 'show']);   // ?week_start=YYYY-MM-DD
Route::post('/employees/{id}/timesheet',       [TimesheetController::class, 'save']);   // bulk upsert 7 days
Route::delete('/employees/{id}/timesheet',     [TimesheetController::class, 'destroy']);// ?week_start=… revert whole week

// ---- Employee Labor: Production Logs ----
Route::get('/employees-production-logs',            [ProductionLogController::class, 'index']);  // filters: employee_id, product_id, operation_id, date_from/to, per_page
Route::post('/employees/{id}/production-logs',      [ProductionLogController::class, 'store']);  // accepts single row OR {rows:[…]}
Route::put('/employees-production-logs/{log}',      [ProductionLogController::class, 'update']);
Route::delete('/employees-production-logs/{log}',   [ProductionLogController::class, 'destroy']);

// ---- Employee Debt Ledger ----
Route::get('/employees-ledger',                 [EmployeeLedgerController::class, 'index']);   // all employees + outstanding balances
Route::get('/employees/{id}/ledger',            [EmployeeLedgerController::class, 'statement']);// paginated entries + running balance

// ---- Modified existing endpoints ----
Route::post('/employees/{id}/salaries', …);      // EmployeeController@recordSalary — EXTENDED (§6.4)
Route::delete('/employees/{id}/salaries/{sid}', …);// EmployeeController@deleteSalary — EXTENDED (§6.4)
Route::get('/employees/stats', …);               // EXTENDED: total_employee_debt
```

Naming follows the existing kebab convention (`employees-salaries`, `/pay-debt`, …).

### 6.2 New `app/Http/Controllers/Api/TimesheetController.php` (Hybrid Cycle Support)

**`show($id)`** — `GET /employees/{id}/timesheet?week_start=2026-08-22`
- Normalize `week_start` to the **Saturday** of the requested week using `Carbon::parse($request->week_start)->startOfWeek(Carbon::SATURDAY)` (no helper class needed). Range is `[week_start, week_start->copy()->addDays(5)]` (Saturday to Thursday = 6 days). Friday is the automatic weekly holiday.
- Eager-load `employee_attendance` (with `advance`) and `employee_production_logs` within this week window.
- Response payload:
```json
{
  "employee": {"id":1,"name":"…","salary_cycle":"day","rate":150},
  "week_start":"2026-08-22",
  "days":[
    {
      "date":"2026-08-22",
      "weekday_ar":"السبت",
      "work_mode":"full_day",
      "task_description":"صيانة ماكينات",
      "daily_wage":150,
      "production":null,
      "advance_amount":50,
      "day_net":100
    },
    {
      "date":"2026-08-23",
      "weekday_ar":"الأحد",
      "work_mode":"hybrid",
      "task_description":"جرد مخازن",
      "daily_wage":75,
      "production":{
        "product_id":12,
        "product_name":"قميص رجالي",
        "quantity":25,
        "piece_rate":5,
        "gross_wage":125
      },
      "advance_amount":0,
      "day_net":200
    },
    {
      "date":"2026-08-24",
      "weekday_ar":"الإثنين",
      "work_mode":"piece_rate",
      "task_description":null,
      "daily_wage":0,
      "production":{
        "product_id":8,
        "product_name":"بنطلون جينز",
        "quantity":40,
        "piece_rate":7,
        "gross_wage":280
      },
      "advance_amount":100,
      "day_net":180
    }
  ],
  "settlement_summary": {
    "total_daily_wages": 375,
    "total_piece_wages": 845,
    "gross_total": 1220,
    "total_advances": 200,
    "net_thursday_salary": 1020
  },
  "settled": false
}
```

**`save($id)`** — `POST /employees/{id}/timesheet`
Request body contains `week_start` and an array of daily objects containing `work_mode`, `task_description`, `daily_wage`, optional `production` object `{product_id, quantity, piece_rate}`, and `advance_amount`.

Logic (atomic `DB::transaction` with `lockForUpdate`):
```
// 1. Lock existing attendance and production rows for this employee & week
$existingAttendance = EmployeeAttendance::where('employee_id', $employeeId)
    ->whereBetween('work_date', [$weekStart, $weekEnd])
    ->lockForUpdate()->get()->keyBy(fn($r) => $r->work_date->toDateString());

$existingProduction = EmployeeProductionLog::where('employee_id', $employeeId)
    ->whereBetween('work_date', [$weekStart, $weekEnd])
    ->lockForUpdate()->get()->keyBy(fn($r) => $r->work_date->toDateString());

foreach days as d:
    // Attendance & Daily Wage
    $att = EmployeeAttendance::updateOrCreate(
        ['employee_id' => $employeeId, 'work_date' => d.date],
        ['work_mode' => d.work_mode, 'task_description' => d.task_description, 'daily_wage' => d.daily_wage, 'advance_amount' => d.advance_amount]
    );
    // Sync Attendance Credit in Ledger
    EmployeeLedgerService::revertBySource(EmployeeAttendance::class, $att->id);
    if (d.daily_wage > 0) {
        EmployeeLedgerService::credit($employeeId, d.daily_wage, d.date, "أجر يومية: " . (d.task_description ?? d.date), EmployeeAttendance::class, $att->id);
    }

    // Production Logging & Credit in Ledger
    if (!empty(d.production) && d.production.quantity > 0) {
        $pLog = EmployeeProductionLog::updateOrCreate(
                    ['employee_id' => $employeeId, 'work_date' => d.date, 'product_id' => d.production.product_id],  // keyed on product too — multiple products/day is valid
                    ['quantity' => d.production.quantity, 'piece_rate' => d.production.piece_rate, 'gross_wage' => d.production.gross_wage, 'net_wage' => d.production.gross_wage]
        );
        EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $pLog->id);
        EmployeeLedgerService::credit($employeeId, pLog.net_wage, d.date, "أجر إنتاج: " . d.production.product_name, EmployeeProductionLog::class, $pLog->id);
    } else {
        // Clear old production if mode changed away from piece/hybrid
        if ($oldP = $existingProduction->get(d.date)) {
            EmployeeLedgerService::revertBySource(EmployeeProductionLog::class, $oldP->id);
            $oldP->delete();
        }
    }

    // Advance Handling (Debit & Treasury Outflow)
    ...
```

**`destroy($id)`** — `DELETE /employees/{id}/timesheet?week_start=…`
Within a transaction: for each of the 6 attendance rows (Sat–Thu; no Friday row exists) → if `advance_salary_id` set: `TreasuryService::revertBySource(EmployeeSalary::class, id)` + `EmployeeLedgerService::revertBySource(EmployeeSalary::class, id)` + soft-delete the salary row; `EmployeeLedgerService::revertBySource(EmployeeAttendance::class, att->id)`; soft-delete attendance. Blocked (409) if the week's Thursday salary payout already exists (`week_start` match on `employee_salaries.type='salary'`).

### 6.3 New `app/Http/Controllers/Api/ProductionLogController.php`

**`index()`** — global filterable list (mirrors `EmployeeController@allSalaries` pagination/filter style). Eager loads `employee:id,name`, `product:id,name`, `operation:id,operation_number`, `laborService:id,name`. Filter params: `employee_id`, `product_id`, `operation_id`, `date_from`, `date_to`, `per_page`. Adds a `totals` meta block (Σ quantity, Σ gross, Σ deductions, Σ net) for the current filter.

**`store($id)`** — accepts `{rows:[{work_date, product_id?, operation_id?, labor_service_id?, quantity, piece_rate?, deductions?, deduction_reason?, notes?}]}` or a single object.
Validation (`StoreProductionLogRequest`): `quantity > 0`; `piece_rate` defaults to `employees.rate` when null (**snapshotted**); `product_id` must exist when provided; `operation_id` must belong to a non-cancelled operation; `work_date` required.
Per row, inside one `DB::transaction`:
```
log = EmployeeProductionLog::create([... gross_wage=round(qty*rate,2),
                                     net_wage=gross_wage−deductions, piece_rate=snapshot])
EmployeeLedgerService::credit(employeeId, log->net_wage, work_date,
                              "إنتاج {qty} قطعة — {product.name}",
                              EmployeeProductionLog::class, log->id)
if operation_id: Operation::whereKey(op)->increment('labor_cost', log->gross_wage)
```

**`update($log)` / `destroy($log)`**
- Update: recompute wages; adjust the linked credit entry (revert-by-source then re-credit); adjust `operations.labor_cost` by the delta of `gross_wage`.
- Destroy: **guard** — refuse (409 with `لا يمكن حذف سجل إنتاج تم صرف مستحقاته`) if deleting this log would cause the employee's current outstanding balance to drop below zero (`EmployeeLedgerService::outstandingBalance($log->employee_id) - $log->net_wage < 0`). On success: revert credit entry, decrement `operations.labor_cost`, soft-delete log.

### 6.4 Modified `EmployeeController` — close the treasury gap

> **⚠ Lane 5 (Claude Opus 4.6) — Security Trigger:** `recordSalary` contains file upload handling (`receipt` storage). File uploads are on the security trigger list. Do NOT delegate this method to a free model.

**`recordSalary()`** (currently the STUB at `EmployeeController.php:96`) — extend the existing `DB::transaction`:
```
… existing EmployeeSalary::create(...) …
TreasuryService::recordOutflow(
    amount:      net_salary,
    paymentMethod: validated payment_method,
    category:    type==='advance' ? 'سلفة موظف' : 'رواتب وأجور الموظفين',
    description: "{type label} — {employee.name}" . (period ? " — {$start}→{$end}" : ''),
    sourceType:  EmployeeSalary::class, sourceId: salary->id,
    transactionDate: payment_date,
    receiptPath: uploaded receipt path)
EmployeeLedgerService::debit(employee_id, net_salary, payment_date, description,
                             EmployeeSalary::class, salary->id)
```
Add to `StoreSalaryPaymentRequest`: `type` sometimes-in `salary,advance` (default `salary`); when `type=advance`, relax `base_salary` to nullable and force `net_salary = base_salary(0) − deductions + requested amount` — concretely, for advances accept a single `amount` field mapped onto `net_salary`. Response now returns the salary **plus** `treasury_transaction_number` and the employee's fresh `outstanding_balance` so the UI can flash the new debt.

**`deleteSalary()`** — extend to: `TreasuryService::revertBySource(EmployeeSalary::class, id)` + `EmployeeLedgerService::revertBySource(EmployeeSalary::class, id)` before the existing soft-delete. If the salary being deleted was an advance referenced by `employee_attendances.advance_salary_id`, null those references first.

**`stats()`** — add `total_employee_debt = SUM over employees of EmployeeLedgerService::outstandingBalance()` (one grouped query, not N+1: `EmployeeLedgerEntry::query()->selectRaw("employee_id, SUM(CASE type WHEN 'credit' THEN amount ELSE -amount END) bal")->groupBy('employee_id')`).

**`index()` (employees list)** — extend the `GET /employees` response to include `outstanding_balance` per employee using the same one-shot grouped query (keyed by `employee_id`), then merged into the paginated collection. Do **not** call `Employee::outstandingBalance()` inside a collection loop — that is an N+1 violation.

**`salaries($id)` / `allSalaries()`** — eager-load nothing new; add `type` to the JSON resources so the history tab can badge سلفة vs راتب.

### 6.5 Modified `TreasuryController@transactions` — resolve the new source

Extend the per-row source resolver switch with:
```php
case \App\Models\EmployeeSalary::class:
    $row['entity_name']  = $salary->employee->name;      // eager: preload ids → Employee::find
    $row['entity_phone'] = $salary->employee->phone;
    $row['resolved_reference'] = 'EMP-' . str_pad($salary->employee_id, 4, '0');
    $row['items_summary'] = [$salary->type === 'advance' ? 'سلفة' : 'راتب'];
    break;
```

### 6.6 Form Requests (new)

| Class | Key rules |
|---|---|
| `StoreTimesheetRequest` | §6.2 above; authorizes via `manage_employees` permission pattern used elsewhere |
| `StoreProductionLogRequest` | §6.3 above |

---

## 7. Phase 4 — Product Costing Integration

### 7.1 Fold labor into finished-goods FIFO at operation completion

Modify `OperationController` completion path (where the `Production_Receipt` movement is currently written with material-blended `unit_cost`):

```php
$materialUnitCost = $fifoResult['blended_unit_cost'];           // existing calc
$laborPerUnit = $operation->quantity > 0
    ? round((float)$operation->labor_cost / (float)$operation->quantity, 2)
    : 0;
$receiptUnitCost = round($materialUnitCost + $laborPerUnit, 2);  // NEW layer unit_cost
```

Consequences (all automatic downstream):
- `InventoryService::consumeFifoQuantity` picks up the higher layer cost → sale-time COGS includes labor → gross profit in dashboards becomes truthful.
- `Product::getCostPricingAnalysis()` `cost_source='finished_goods_fifo'` now reports the labor-inclusive active cost; `next_cost` (theoretical) remains material-only unless §7.4 applies — the diff between them now *means* “labor + variance”, which is desirable.
- Guard: only add labor when `$operation->labor_cost > 0` (legacy operations unchanged). Log a warning when `labor_per_unit > materialUnitCost` (data-quality signal).

### 7.2 Ad-hoc production (no operation) — read-time aggregates

In `ProductController@show` and `stats()`, join aggregates:
```php
$laborAgg = EmployeeProductionLog::where('product_id', $product->id)
    ->selectRaw('COALESCE(SUM(gross_wage),0) labor_total, COALESCE(SUM(quantity),0) qty_total')
    ->first();
// expose: labor_cost_total, labor_cost_per_unit = qty_total>0 ? labor_total/qty_total : 0
```

### 7.3 `products.stats` extension

Add per-product `labor_cost_total` (same aggregate) so the stats modal shows labor next to COGS.

### 7.4 Double-count protection (تصنيع / تنجيد as BOM services)

Scenario: a product BOM contains the `materials` row "تنجيد" priced at, say, 200/unit **and** workers log upholstery labor against the same product → labor counted twice.

Rule implemented in `ProductController` theoretical-cost builder **and** `Product::recalculateCost()`:
- If BOM item material `is_labor_based === true` **and** the product has ≥ 1 `employee_production_logs` row with `labor_service_id = that material` → substitute the **average actual net_wage per unit** for that material/service in place of `material.unit_cost` in the BOM sum.
- If no actual logs yet → keep static `unit_cost` (estimate) — cost never regresses to zero.
- `Material::updated` hook skips `recalculateCost()` propagation for `is_labor_based` materials whose products have actual logs (they self-correct from logs instead).
- **Concurrency guard:** `recalculateCost()` calls triggered by log creation/update must acquire `Product::lockForUpdate()` on the target product row before reading log aggregates. This prevents a race where two simultaneous log writes each compute the average against a partial sibling write. The lock is already inside the caller's `DB::transaction`.
- Admin surface: checkbox `is_labor_based` (“تكلفة عمالة فعلية”) on the material form for تصنيع/تنجيد-type services; default off preserves current behavior.

### 7.5 Explicitly out of scope (documented to prevent scope creep)

- Allocating *time-based* (attendance) labor cost to specific products/operations — attendance is workshop overhead unless a future spec links shifts to operations. (Extension point noted: `employee_attendances.operation_id` nullable column, same increment pattern.)
- Retroactive re-pricing of already-received FIFO layers when logs are edited after completion — accepted approximation; documented in §9.

---

## 8. Phase 5 — Frontend Components

All under `dashboard/src/`. Conventions to follow (verified in codebase): hardcoded Arabic strings, axios via `@/lib/api-client`, responsive dual-render grids, local overlay-modal recipe, dark purple/gold palette classes, `dir="ltr"` islands for numbers where useful, `Number(n).toLocaleString('ar-EG')` formatting.

### 8.1 Rework `src/pages/employees/page.jsx`

- Tabs become four: **الموظفون** | **الجدول الأسبوعي** (timesheet) | **سجل الإنتاج** (production log) | **الرواتب** (existing history).
- Tab state: `const [tab, setTab] = useState('employees')`.
- Selected-employee state shared by the two labor tabs (`activeEmployeeId`), defaulted to first active employee whose `salary_cycle !== 'month'` for the timesheet tab / `=== 'production'` for production tab.
- KPI cards gain a fifth card: **ديون مستحقة للموظفين** ← `stats.total_employee_debt` (gold accent).
- Salaries history table gains a `النوع` pill column (`راتب` green / `سلفة` amber) reading `type`.
- The existing "Record New Salary" modal is kept but upgraded (it remains the payout instrument):
  - New `النوع` select (راتب / سلفة).
  - Header strip showing `الرصيد المستحق الحالي: {outstanding_balance} ج.م` fetched from `GET /employees/{id}/ledger`.
  - After success, toast displays `تم تسجيل الصرف في الخزينة: {treasury_transaction_number}`.

### 8.2 New `src/components/employees/WeeklyTimesheetGrid.jsx` (Images 4, 5 & 6 Layout)

Props: `{ employee, products, onSuccess }`.

Layout:
- **Header Bar**:
  - Employee selector + Week picker (Saturday→Thursday range displayed) + `السابق` / `التالي` navigation buttons.
- **Unified Timesheet Desktop Table (`hidden md:block`)**:
  - Columns (matching Images 4 & 5):
    1. `اليوم` (السبت, الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس)
    2. `نظام العمل` (Select: يومية كاملة `full_day` | نصف يوم `half_day` | بالقطعة `piece_rate` | مشترك `hybrid` | إجازة `leave` | غائب `absent`)
    3. `نوع المنتج / المهمة` (Text/Select: Product dropdown if piece/hybrid, task name if day)
    4. `أجر اليومية المستحق` (Active if full_day/half_day/hybrid)
    5. `عدد القطع` (Active if piece_rate/hybrid)
    6. `سعر القطعة` (Autofills product/employee default rate, editable)
    7. `إجمالي أجر القطعة` (Live calculated: `qty × rate`, read-only)
    8. `السلف اليومية` (Number input)
    9. `صافي أجر اليوم` (Live calculated: `(daily_wage + piece_wage) - advance_amount`)
- **Mobile Responsive Cards (`md:hidden`)**:
  - Stacked collapsible card per day with mode pill and dynamic inputs.
- **Settlement Summary Box (أسفل الجدول - صورة 6)**:
  - 4-Card Summary breakdown:
    - **إجمالي مستحقات اليومية**: Σ `daily_wage`
    - **إجمالي مستحقات القطعة**: Σ `piece_wage`
    - **مجموع الأجر الإجمالي**: `daily_total + piece_total`
    - **إجمالي السلف الأسبوعية**: Σ `advance_amount`
    - **الصافي النهائي الصالح للصرف**: `gross_total - advances_total`
- **Actions Bar**:
  - Primary button: `حفظ الجدول` $\rightarrow$ `POST /employees/{id}/timesheet`.
  - Secondary gold button: `صرف صافي الراتب` (pre-fills the payout modal with exact settlement numbers).
  - Danger button: `حذف الأسبوع`.

### 8.3 New `src/components/employees/ProductionLogGrid.jsx`

Props: `{ employee, products, operations, onSuccess }` (Images 3 layout).
- Editable row model: `[{work_date, product_id, operation_id?, labor_service_id?, quantity, piece_rate, deductions, deduction_reason}]`; buttons `+ إضافة صف`, per-row trash icon.
- `piece_rate` autofills from `employee.rate` (placeholder text `المعدل الافتراضي {rate}`) and stays editable; `gross`/`net` cells live-computed and read-only.
- Footer totals: إجمالي القطع | إجمالي الأجور | إجمالي الاستقطاعات | صافي الأجور.
- Submit → `POST /employees/{id}/production-logs` with `{rows:[…]}`; success refreshes parent + flashes treasury-safe confirmation (accrual only — no cash moves here; copy: “تم تسجيل الإنتاج وإضافته لمستحقات الموظف”).
- Below the editor: read-only recent-log table (mobile cards/desktop table) fed by `GET /employees-production-logs?employee_id=&date_from=&date_to=` with delete icon per row (AlertDialog confirm; server enforces paid-guard).

### 8.4 New `src/components/employees/EmployeeLedgerModal.jsx`

Opened from an icon button on each employee row (and from the salary modal header).
- Fetch `GET /employees/{id}/ledger?page=&from=&to=`.
- Top: three mini-cards — إجمالي المستحقات (Σ credit) | إجمالي المصروف (Σ debit) | **الرصيد المستحق** (gold).
- Body: statement table (التاريخ | البيان | نوع (له/عليه colored) | المبلغ | الرصيد بعد الحركة) with `Pagination` component reuse; mobile card variant.
- Rows linkify by source: `EmployeeSalary` → opens salary receipt preview (reuse existing receipt modal), `EmployeeProductionLog` → highlights row in production tab.

### 8.5 Small touch-points elsewhere

| File | Change |
|---|---|
| `src/components/accounts/transactions-table.jsx` | Category filter pills gain `رواتب وأجور الموظفين` / `سلفة موظف`; rows resolve entity name already returned by backend (§6.5) |
| `src/components/products/ProductFormModal.jsx` / `BOMViewerModal.jsx` | Show `🛠 تكلفة عمالة فعلية: X ج.م/وحدة` line when product has labor logs (from `show` payload) |
| `src/pages/products/page.jsx` `ProductCard.jsx` | Cost line reads `active_cost` (already labor-inclusive post-§7.1) — no structural change; add tooltip when `cost_source='finished_goods_fifo'` |
| `src/components/materials/*` (form) | Checkbox `تكلفة عمالة فعلية (is_labor_based)` visible when `type==='service'` |
| `src/pages/operations/` (operation detail view) | Add read-only `تكلفة العمالة: {labor_cost} ج.م` field next to the existing total_price display; sourced from `operations.labor_cost` returned in the operation show endpoint. No structural change — display only (T8). |

---

## 9. Edge Cases, Guards & Data Integrity Rules

1. **Atomicity:** every write path (timesheet save, production log CRUD, salary record/delete, week delete) runs in a single `DB::transaction` covering source doc + ledger entry + treasury call. Never let the ledger and treasury diverge.
2. **Rate changes mid-week:** `daily_wage` and `piece_rate` are snapshots on their rows — historical weeks never shift when `employees.rate` changes.
3. **Duplicate prevention:** `unique(employee_id, work_date)` on attendance; production allows multiple rows/day (different products) — enforce max 20 rows/request.
4. **Paid-state locks:** cannot delete/edit an attendance day or production log whose value has been settled if doing so would push the employee balance negative (server returns 409 `لا يمكن تعديل سجل تم صرفه — احذف الدفعة أولاً`). Week-level delete blocked once the Thursday payout exists.
5. **Zero-value rows skipped:** days with `daily_wage − penalty ≤ 0` produce no ledger entry; advances of 0 produce no salary/treasury row.
6. **Tenancy:** migrations run against the default connection; verify `TenantMiddleware` tenant DBs receive the same schema (check how `arabic_erp_tenant_*` databases are provisioned/migrated — if a tenant-provisioning migration runner exists, register the new files there too; add this verification as task T1 in §12).
7. **Treasury insufficiency:** consistent with existing controllers (expenses/supplier payments do not hard-block on low balance) → record the outflow regardless; the treasury page's negative-balance styling surfaces the shortfall. Do NOT invent a blocking rule here unilaterally.
8. **Soft-delete symmetry:** reversals use `TreasuryService::revertBySource()` + `EmployeeLedgerService::revertBySource()` (both soft-delete aware), so historical reports stay reconstructible and `deleted_at` filtering matches treasury behavior.
9. **Permission checks:** reuse the `manage_employees` permission gate pattern already applied to the employees route group; ledger viewing allowed for `manage_accounts` holders.
10. **Timezone/dates:** all dates stored as `Y-m-d`; week boundaries computed server-side with `Carbon::parse` (app timezone), Saturday constant `Carbon::SATURDAY`.

---

## 10. Testing & Acceptance Checklist

Automated where the project's test setup allows (`php artisan test`, sqlite in-memory per `.env.testing`), otherwise scripted manual passes:

| # | Case | Expected |
|---|---|---|
| A1 | Save timesheet: 6 present days @150, Tuesday advance 100 | 6 credit entries (900 total), 1 debit (100), 1 treasury outflow `TRX-…`, `net_thursday=800` |
| A2 | Re-save same week with Wednesday marked absent | Wednesday credit removed; totals drop to 750; no duplicate entries |
| A3 | Increase Tuesday advance 100→150 | Old advance salary+treaury+debit reverted; new trio created |
| A4 | Thursday payout 800 | Salary row `type=salary`, outflow category `راتب أسبوعي`, debit 800, balance = 900−100−800 = 0 |
| A5 | Delete week after payout | 409 blocked |
| B1 | Production log 10 pcs × 25, op-linked | credit 250; `operations.labor_cost=250` |
| B2 | Complete operation (materials blended cost 500/10u) | `Production_Receipt.unit_cost = 50 + 25 = 75` |
| B3 | Sell 4 units | invoice items `unit_cost=75`, `total_cogs=300` |
| B4 | Delete unpaid log row | credit reverted; `labor_cost` decremented |
| B5 | Delete paid log row | 409 |
| C1 | Legacy monthly salary via recordSalary | behaves as before **plus** outflow+debit; old rows unaffected |
| C2 | Delete a salary | treasury trx soft-deleted, debit entry soft-deleted, balance restored |
| C3 | `GET /treasury/transactions` shows the outflows with employee name/entity resolved | ✓ |
| C4 | `employees/stats.total_employee_debt` equals Σ balances | ✓ |
| D1 | UI: full Sat→Thu grid renders RTL on desktop + mobile cards; totals live-update | ✓ |
| D2 | UI: production grid add/remove rows, autofill rate, submit, list refresh | ✓ |
| D3 | Ledger modal running balance math correct across mixed entries | ✓ |
| E1 | Regression: expenses, supplier payments, sales still post to treasury (untouched paths) | ✓ |

---

## 11. Rollback & Backward Compatibility

- Every new migration has a functional `down()`; the `employee_salaries.type` addition defaults to `'salary'` so pre-migration data reads identically.
- Feature is additive: disabling the two new tabs (frontend) and ignoring the new endpoints restores today's behavior; the only modified legacy behavior is `recordSalary` gaining a treasury outflow — if a temporary kill-switch is desired, gate the two new calls behind `config('features.employee_treasury_integration', true)`.
- No existing column is dropped or retyped except the additive `type`/`week_start` (safe) — the `salary_cycle` enum is untouched.

---

## 12. Task Order & Effort Estimate

| Task | Depends on | Est. |
|---|---|---|
| T1 Verify tenant-DB migration provisioning; wire new migrations if needed | — | 0.5 d |
| T2 Migrations §4.1–4.6 + models §5.1–5.6 | T1 | 1 d |
| T3 `EmployeeLedgerService` + unit tests (balance math, revert) | T2 | 1 d |
| T4 TimesheetController + request + routes + tests (A1–A5) | T3 | 2 d |
| T5 ProductionLogController + request + routes + tests (B1, B4, B5) | T3 | 1.5 d |
| T6 Extend `recordSalary`/`deleteSalary`/`stats` + tests (C1, C2, C4) | T3 | 1 d |
| T7 Treasury transactions source resolution (C3) | T6 | 0.5 d |
| T8 Operation completion labor folding + product aggregates + labor-based service substitution + tests (B2, B3, §7.4) | T5 | 1.5 d |
| T9 Frontend: page tab refactor + upgraded salary modal | T6 | 1 d |
| T10 Frontend: `WeeklyTimesheetGrid` | T4, T9 | 2 d |
| T11 Frontend: `ProductionLogGrid` | T5, T9 | 1.5 d |
| T12 Frontend: `EmployeeLedgerModal` + treasury/products touch-points | T7 | 1 d |
| T13 Full acceptance pass (§10) + fixes | all | 1 d |
| **Total** | | **≈ 16 dev-days** |

**Suggested merge order:** T1–T3 (schema+ledger core) → T4+T6+T7 (money paths) → T5+T8 (production+costing) → T9–T12 (frontend) → T13.
