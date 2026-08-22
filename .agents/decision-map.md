# Decision Map: Employee Salary Cycle & Treasury Integration

## 1. Destination
A complete financial integration of employee labor (time-based and production-based) into the unified treasury system and product costing. The system must track employee labor as accrued debt (liability), update product costs with manufacturing/upholstery labor, and reduce employee debt via treasury outflows when salaries or advances are paid. The UI must be updated to match the weekly timesheet and production log formats provided in the reference images.

## 2. Core Understanding & Requirements
1. **New Services**: "تصنيع" (Manufacturing) and "تنجيد" (Upholstery) have been added as services. These are internal services performed by employees.
2. **Labor as Debt**: When an employee works (daily attendance) or produces pieces (production cycle), the value of this labor is recorded as a **Debt** owed by the workshop to the employee.
3. **Product Costing**: The cost of this labor must be factored into the overall cost of the products being manufactured or upholstered.
4. **Treasury Integration**: Paying a salary or a daily advance to an employee must record an `outflow` in the `treasury_transactions` table. This treasury outflow pays down the accrued employee debt.
5. **UI Re-design (The 3 Images)**: 
   - **Time-based Employees**: A weekly timesheet showing daily attendance and daily advances (Saturday to Thursday), total days, total wages, total advances, penalties, and net Thursday salary.
   - **Production Employees**: A log showing product type, pieces produced, piece price, total daily wage, deductions, and net wage.

## 3. Analysis & Proposed Architectural Changes

### A. Database Changes (Backend)
- **Employee Ledgers (`employee_ledgers` or `employee_account_transactions`)**: We need a ledger to track the running balance (Debt) for each employee.
  - *Credit*: Labor performed (increases debt owed to employee).
  - *Debit*: Payments made (advances/salaries - decreases debt).
- **Daily Attendance & Production Tracking**: The current `employee_salaries` table only records a single payment. We need tables like `employee_attendances` (tracking daily presence and daily advances) and `employee_productions` (tracking pieces produced per product) to support the weekly timesheet UI.
- **Treasury Link**: Payments must reference `TreasuryTransaction` (`source_type` = 'employee_payment').

### B. Business Logic (Controllers)
- **Labor Logging**: When saving a weekly timesheet, the system calculates total labor value -> Credits Employee Ledger -> Updates Product Cost (if applicable).
- **Payment Processing**: When saving an advance or salary payout -> Debits Employee Ledger -> Creates Outflow in Treasury.

### C. Frontend Changes (React)
- Replace the current simple "Record New Salary" modal with two dedicated views:
  1. **Weekly Timesheet View**: A grid matching Image 1 & 2 for time-based workers (Saturday-Thursday attendance/advances).
  2. **Production Log View**: A grid matching Image 3 for piece-rate workers (Product, Quantity, Rate).

## 4. Frontier (Immediate Blockers to Resolve Next)
- [ ] **Data Model Finalization**: Do we create a dedicated `employee_ledgers` table, or do we expand `employee_salaries` and add `employee_timesheets`?
- [ ] **Product Cost Mechanism**: How exactly is the labor cost added to the product? Is it added dynamically when a piece is produced, or is the product's `cost` field updated?
- [ ] **Advances vs. Salaries**: Do daily advances generate separate treasury transactions per day, or one bulk transaction on Thursday?

## 5. Next Steps for Implementation
1. Review this decision map to ensure complete alignment.
2. Switch to **Claude Opus 4.6 Thinking** or **Claude Sonnet 4.6 Thinking** via the UI dropdown.
3. Ask Claude to generate the exact database schema modifications and the implementation plan based on this analysis.
