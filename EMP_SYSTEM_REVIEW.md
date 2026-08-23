# 📋 Comprehensive Review Summary: Workshop ERP Employee & Payroll System

> **Document Purpose:** Complete technical and architectural specification of the Employee & Payroll Management Module for review, audit, and feedback.

---

## 1. Executive Summary & Problem Scope
The Employee & Payroll System is an end-to-end ERP module designed for workshops and manufacturing facilities. It provides an automated, auditable, and flexible workflow to manage staff under diverse compensation structures:
* **Fixed Daily Wages** (`Daily`)
* **Pure Piece-Rate / Production-based** (`Piece-rate`)
* **Hybrid Compensation** (Base Daily Wage + Piece-rate production rewards)
* **Monthly / Periodic Salaries** (`Monthly`, `Weekly`)

The system eliminates financial drift and manual calculation errors through an **Automated Double-Entry Employee General Ledger (`EmployeeLedgerService`)**, ensuring that every daily attendance, piece-rate shift, cash advance, and salary settlement is tracked with a real-time running balance.

---

## 2. Core Architecture & Data Model

### A. Database Tables & Eloquent Models
1. **`employees`**: Master worker records (`name`, `phone`, `job_title`, `salary_cycle`, `rate`, `is_active`).
2. **`employee_attendances`**: Daily timesheet records (`employee_id`, `work_date`, `work_mode`, `daily_wage`, `advance_amount`, `penalty_amount`, `product_id`, `quantity`, `piece_rate`, `task_description`).
3. **`employee_production_logs`**: Piece-rate production shifts (`employee_id`, `product_id`, `work_date`, `quantity`, `piece_rate`, `gross_wage`, `net_wage`, `operation_id`).
4. **`employee_ledger_entries`**: Immutable double-entry financial ledger (`employee_id`, `entry_date`, `type` [`credit` | `debit`], `amount`, `running_balance`, `source_type`, `source_id`, `description`).
5. **`employee_salaries`**: Payout disbursements and cash advance vouchers (`employee_id`, `type` [`salary` | `advance`], `payment_date`, `base_salary`, `bonus`, `deductions`, `net_salary`, `payment_method`, `receipt_path`).
6. **`products` & `operations`**: Manufacturing cost linkage (`labor_cost` on products and operations).

---

## 3. Financial Engine: Employee General Ledger (`EmployeeLedgerService`)

All financial operations run inside atomic `DB::transaction()` blocks using a strict credit/debit model:

* **Credits (`type = credit`) — *Increases Workshop Debt to Employee*:**
  - Daily wages earned from timesheets (`EmployeeAttendance`).
  - Piece-rate manufacturing earnings (`EmployeeProductionLog`).
* **Debits (`type = debit`) — *Decreases Workshop Debt to Employee*:**
  - Daily cash advances taken during the week.
  - Daily disciplinary penalties or deductions.
  - Standalone cash advances issued via the Salary/Advance modal.
  - Net salary payouts and balance disbursements (`EmployeeSalary`).
* **Auditability & Reversals:**
  - Reversals use `revertBySource(sourceType, sourceId)` to safely unwind financial entries when timesheets or production logs are updated or deleted without leaving ghost balances.

---

## 4. Frontend Feature Breakdown (React 19 + Tailwind CSS)

### 👥 Tab 1: Employee Management (`إدارة الموظفين`)
- **Master CRUD**: Create, edit, activate/deactivate, and delete staff.
- **Top 5 KPI Dashboard Cards**:
  1. Total Workforce
  2. Active Employees
  3. Total Salaries Disbursed This Month
  4. Total Deductions / Penalties This Month
  5. **Total Workshop Debt (مستحقات الموظفين)**: Aggregated live debt balance owed to all employees across the business (`stats.total_employee_debt`).
- **Ledger Modal Access**: Instant 1-click button (**كشف حساب**) on every employee row.

### 📅 Tab 2: Interactive Weekly Timesheet Grid (`يوميات العمل`)
- **Standard Work Week**: Saturday to Thursday grid with weekly navigation controls (`<` / `>`).
- **6 Work Modes Supported**:
  1. `Full Day (يوم كامل)`: Auto-assigns standard daily rate.
  2. `Half Day (نصف يوم)`: Auto-assigns 50% daily rate.
  3. `Piece-Rate (بالقطعة)`: Zeroes daily wage, unlocks product selector and quantity inputs.
  4. `Hybrid (مزدوج)`: Combines full daily wage + piece-rate output rewards.
  5. `Leave (إجازة)` & `Absent (غياب)`: Wage set to 0.
- **Live Computations**: Auto-calculates `Total Daily Wages + Total Piece Earnings - Advances - Penalties = Net Payable`.
- **State Feedback**: Live badges for `الأسبوع محفوظ` (Saved), `تغييرات غير محفوظة` (Unsaved Changes), and `تم الصرف` (Settled).
- **1-Click Weekly Payout**: Clicking **صرف راتب الأسبوع** opens the salary modal pre-filled with the calculated net amount, week dates, and notes.

### ⚙️ Tab 3: Piece-Rate Production Log (`سجل الإنتاج`)
- **Batch Manufacturing Logging**: For workers without a strict 6-day attendance schedule.
- **Dynamic Multi-Row Input**: Allows adding multiple manufactured items per worker shift with unit piece rates auto-populated from product labor costs.
- **Instant Ledger Posting**: Submitting records the shift, updates workshop product costing, and credits the worker’s ledger immediately.
- **Shift History Table**: Real-time log of previous piece-rate operations.

### 💼 Tab 4: Salaries & Advances (`سجل الرواتب والسلف`)
- **Dual Transaction Support**:
  - **Salary Settlement (`راتب / دفعة مستحقات`)**: Disburses earnings and clears period debt.
  - **Cash Advance (`سلفة`)**: Records lent cash, updates treasury, and debits the worker’s balance.
- **Receipt Vouchers**: Upload and preview signed payment receipts (images/PDFs).
- **Multi-Week Settlement Workflow**:
  - For employees paid every 3 or 4 weeks, the modal displays their **Accumulated General Ledger Balance**.
  - A 1-click button **"صرف كامل الرصيد"** sets the payout to their entire multi-week accumulated balance in one transaction.

### 📊 Feature 5: General Ledger Statement Modal (`كشف الحساب`)
- **3 Top Mini-KPIs**: `Total Credits (المستحقات)` | `Total Debits (المنصرف)` | `Net Outstanding Balance (الرصيد المتبقي)`.
- **Custom Date Range Filter**: Generates printable statements for custom periods.
- **Auditable Transaction Table**: Displays transaction date, type (Credit/Debit), source module, description, amount, and exact running balance after each entry.

---

## 5. RESTful API Specification Summary

| HTTP Method | Route Endpoint | Purpose | Key Parameters |
|---|---|---|---|
| `GET` | `/api/employees` | List employees with calculated running balance | `search`, `page`, `per_page` |
| `GET` | `/api/employees/stats` | Top KPIs including workshop debt | — |
| `GET` | `/api/employees/{id}/timesheet` | Fetch 6-day attendance & production for week | `week_start` |
| `POST` | `/api/employees/{id}/timesheet` | Atomic save of 6-day attendance & wages | `week_start`, `days[]` |
| `DELETE` | `/api/employees/{id}/timesheet` | Wipe timesheet and revert ledger entries | `week_start` |
| `GET` | `/api/employees-production-logs`| List piece-rate production shifts | `employee_id`, `page` |
| `POST` | `/api/employees/{id}/production-logs` | Batch post production items & credit ledger | `date`, `items[]` |
| `GET` | `/api/employees/{id}/ledger` | Paginated General Ledger statement | `start_date`, `end_date`, `page` |
| `POST` | `/api/employees/{id}/salaries` | Record salary payout or cash advance | `type`, `amount`, `payment_date`, `receipt` |

---

## 6. Suggested Questions / Focus Areas for Claude's Review
1. **Accounting & Ledger Integrity**: *Does the double-entry credit/debit structure provide adequate protection against balance drift and duplicate payments across multiple weeks?*
2. **Edge Cases in Multi-Week Settlements**: *Are there any potential race conditions or edge cases when settling a 4-week balance in a single salary payout while individual weekly timesheets remain saved?*
3. **Database Concurrency & Locks**: *Are the `DB::transaction()` blocks and `revertBySource()` patterns optimal for high-concurrency environments?*
4. **UI/UX Ergonomics**: *Does the tab layout effectively balance daily timesheet logging, piece-rate batch entries, and monthly payout auditing?*
