# Workshop ERP System — Analysis, Remediation & Final Report

> **Final report date:** 2026-08-23
> **Scope:** `erp-backend/` (Laravel 12 API), `dashboard/` (React 19 SPA), root docs and scripts.
> **Status:** All identified issues fixed and verified — backend `41 passed (277 assertions)`, frontend `45 passed`, production build green.

---

## 1. Executive Summary

This repository is an **Arabic-first, RTL manufacturing/workshop ERP** covering the full business cycle: procurement → inventory → production (BOM) → sales → treasury/accounting → employee payroll.

| Layer | Technology |
|---|---|
| Backend | PHP ^8.2, Laravel ^12, Sanctum token auth |
| Frontend | React ^19, Vite ^6, Tailwind CSS ^4, zustand, react-router v7, recharts |
| Database | MySQL with per-tenant databases (`arabic_erp_tenant_{id}`) |
| Testing | PHPUnit feature tests (backend), Vitest + Testing Library (frontend) |

An initial analysis identified critical security gaps, correctness bugs, accounting-model deviations, and structure debt. **Every finding has now been remediated** — details below.

---

## 2. Remediation Log

### 🔴 Security

| # | Issue | Fix | Files |
|---|---|---|---|
| S1 | Leaked Sanctum token hardcoded in acceptance runner | Token removed; runner reads `ERP_TOKEN` / `ERP_BASE_URL` from env and exits with instructions if missing | `scripts/system_acceptance_runner.mjs` |
| S2 | Open registration granting blanket permissions, unthrottled | Registration gated by `config('erp.allow_registration')` (`ERP_ALLOW_REGISTRATION` env, returns 403 when closed), throttled `5/min`, permissions sourced from `config('erp.owner_permissions')`; documented in `.env.example` | `AuthController.php`, `routes/api.php`, `config/erp.php` |
| S3 | No route-level permission enforcement | New `CheckPermission` middleware (alias `permission:`) enforcing module permissions on **every state-changing endpoint**: treasury/accounts writes, employees/payroll writes, inventory/materials/products/suppliers/PO writes, production writes, sales/client writes, expenses, external services, categories, settings/user management, backup export/restore. Reads remain open to any authenticated tenant user. `manage_all` and role `admin` bypass; new `manage_employees` permission added to config catalog and frontend user modal | `app/Http/Middleware/CheckPermission.php`, `bootstrap/app.php`, `routes/api.php`, `user-modal.jsx` |

> ⚠️ **Required manual action:** the leaked token remains in **git history** even though it's gone from the working tree. **Revoke it** (delete the personal access token for that user) before sharing the repo, and consider history scrubbing if the repo was ever pushed.

### 🟠 Correctness

| # | Issue | Fix | Files |
|---|---|---|---|
| C1 | Ineffective race guard: `lockForUpdate()->exists()` on a no-match query locks nothing → concurrent double-payout possible | `bulkPayout()` now locks each **employee row** (`Employee::whereKey(...)->lockForUpdate()`) inside the transaction before checking prior settlement — serializing payouts per employee. Payouts are sorted by `employee_id` first for deterministic lock ordering (deadlock prevention). A hard DB unique index was deliberately avoided because salaries use soft deletes and re-settlement after deletion must stay possible | `TimesheetController.php` |
| C2 | ~34 remaining `toISOString().split('T')[0]` UTC-shift bugs in 15 files (payroll-critical timesheet components included) | New shared util `src/lib/dates.js` (`toLocalDateString`, `todayString`, `startOfWeekSaturday`, `addDays`) with zero UTC usage; all 34 occurrences replaced across pages/components. Also fixed a latent bug where `WeeklyTimesheetGrid.getSaturday()` used absolute `setDate(diff)` instead of relative day math | `lib/dates.js` + 17 consumer files |

### 🟠 Accounting Model

Investigation found the gaps from `comparison.md` had already been corrected in code since that document was written:
- ✅ Raw-material purchases capitalize into inventory via FIFO movements (`InventoryService::recordMovement`); deposits/treasury flows recorded separately; `Expense::create` exists only for manual operating expenses (`ExpenseController`).
- ✅ Sale-time COGS snapshotted from real FIFO batches onto `sales_invoices.total_cogs`.
- ✅ Dashboard computes Gross Profit = Revenue − COGS and Net Profit = Gross − Operating Expenses.
- ✅ Supplier debt payments treated as liability settlement (cash outflow), not expense.

A bilingual status addendum was added to the top of `comparison.md` so the doc matches reality.

### 🟡 Structure

| # | Issue | Fix | Result |
|---|---|---|---|
| T1 | Fat controllers (Operation 948 L, Sales 951 L) | Extracted `SalesService::createDirectSale/payClientDebt` and `OperationService::startProduction/completeProduction/cancelProduction` following the existing service conventions; transactions live in services, controllers keep validation/HTTP concerns. Arabic strings, treasury/inventory call arguments, and response shapes preserved verbatim | Sales 951→664 L, Operation 948→594 L |
| T2 | Employees page monolith (1,514 lines) | Decomposed into focused components: `EmployeesTab`, `SalariesTab`, `TimesheetTabPanel`, `ProductionTabPanel`, `EmployeeFormModal`, `SalaryRecordModal`, `ReceiptPreviewModal`, shared `ModalShell`. State/effects/callbacks preserved exactly; page is now an orchestrator | page.jsx 1,514→694 L |
| T3 | Duplicate supplier-debt route + frontend alias usage | Removed `/suppliers/{id}/settle-bulk-debt` alias; frontend now calls canonical `/suppliers/{id}/pay-debt` | `routes/api.php`, `suppliers/page.jsx`, `SettleDebtModal.jsx` |
| T4 | Dead i18n scaffolding (broken import path, provider never mounted, unused locales/deps) | Deleted `dashboard/i18n.js`, `src/components/i18n-provider.jsx`, `public/locales/`; uninstalled i18next/react-i18next/i18next-resources-to-backend | package.json pruned |

### 🟢 Testing (was near-zero)

| Area | Before | After |
|---|---|---|
| Backend feature tests | 33 tests / 237 assertions | **41 tests / 277 assertions** — added `AuthRegistrationTest` (3: registration success + owner permissions, 403 gate when closed, 422 validation), `DirectSaleCogsTest` (2: FIFO blended COGS snapshot math incl. treasury inflow, insufficient-stock rejection), `BulkPayoutSettlementTest` (3: payout creates one salary, duplicate same-week payout skipped, different week settles independently) |
| Frontend tests | **0** | Vitest + jsdom + React Testing Library installed; `vitest.config.js` + setup; **45 passing tests**: `dates.test.js` (21 — local-TZ formatting, Saturday-week invariant across 336 dates, midnight/DST immunity, month/year rollovers) and `wage-utils.test.js` (24 — every work mode of the timesheet wage math, table-driven edge cases). Wage logic extracted verbatim into testable `wage-utils.js` (`applyWorkModeChange`, `computeDayWage`, `computeRowTotals`, `computeWeekSummary`) |

Test-suite adaptations worth knowing: registration tests stub the MySQL driver so tenant provisioning runs against isolated in-memory SQLite without touching real MySQL; SQLite date semantics required datetime-format week payloads in the payout test (guard logic untouched).

---

## 3. Verification Results (final run)

```
Backend:   php artisan test --compact
           Tests: 41 passed (277 assertions)

Frontend:  npm test
           Test Files 2 passed (2) / Tests 45 passed (45)
           npm run build → ✓ built (no errors)
```

Also verified clean: no `toISOString().split` date bugs remain, no `i18next` references remain, duplicate route removed, `php -l` clean on refactored files.

---

## 4. Remaining Recommendations (not blocking)

1. **Revoke the leaked token** in Sanctum (see §2 warning) — the only item requiring human action outside the repo.
2. Set `ERP_ALLOW_REGISTRATION=false` in production once initial accounts exist.
3. Tighten CORS (`config/cors.php` still allows `*` origins) before exposing beyond localhost.
4. Move tenant DB provisioning off the request cycle (queued job) — registration currently runs migrations/seeds inline.
5. Consider API versioning (`/api/v1`) before external consumers appear.
6. Optional next quality gates: PHPStan/Pint + ESLint in CI, and porting `system_acceptance_runner.mjs` phases into automated tests over time.

---

## 5. Conclusion

The system entered this cycle with solid financial primitives (FIFO inventory, unified treasury, double-entry employee ledger) but carried critical security holes, an ineffective concurrency guard, widespread timezone bugs, and heavy structural debt. It now has enforced authorization on every mutating endpoint, gated/throttled registration, correct pessimistic-locking semantics for payroll payouts, timezone-safe date handling everywhere, thinner controllers/pages backed by services and extracted utilities, a corrected-and-documented accounting model, and a real test suite on both sides of the stack — all verified green.
