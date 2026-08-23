import { RefreshCw, Receipt, UserCheck, UserX, FileText, Trash2 } from 'lucide-react';

export default function SalariesTab({
  activeEmployees,
  history,
  histLoading,
  filterEmpId,
  setFilterEmpId,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  onOpenNewSalary,
  onDeleteSalary,
  onViewReceipt,
  fmt,
  fmtDate,
  PAYMENT_LABELS,
  CYCLE_LABELS,
  inputCls,
  currency,
}) {
  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#231B3D] p-4 rounded-2xl border border-[#3D3554]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-2xl">
          <div>
            <select
              className={inputCls}
              value={filterEmpId}
              onChange={e => setFilterEmpId(e.target.value)}
            >
              <option value="">كل الموظفين</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              className={inputCls}
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              title="من تاريخ"
            />
          </div>
          <div>
            <input
              type="date"
              className={inputCls}
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              title="إلى تاريخ"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(filterEmpId || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterEmpId(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="px-3 py-2.5 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          )}

          <button
            onClick={onOpenNewSalary}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20"
          >
            <Receipt className="w-4 h-4" />
            <span>تسجيل راتب جديد</span>
          </button>
        </div>
      </div>

      {/* Mobile Cards (Shown on mobile screens) */}
      <div className="flex flex-col gap-3 md:hidden">
        {histLoading ? (
          <div className="text-center py-12 text-xs text-[#A49EC0]">جاري تحميل سجلات الرواتب...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-xs text-[#A49EC0]">لا توجد دفعات رواتب مسجلة تطابق معايير البحث</div>
        ) : (
          history.map(s => {
            const emp = s.employee;
            const empName = emp?.name || `موظف #${s.employee_id}`;
            const empPhone = emp?.phone || '—';
            const empCycle = emp?.salary_cycle ? (CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle) : '—';
            const empRate = emp?.rate != null ? fmt(emp.rate) : '—';
            const empStatus = emp?.status || 'active';

            return (
              <div key={`m-salary-${s.id}`} className="rounded-2xl border border-[#3D3554] bg-[#231B3D] p-4 shadow-md space-y-3">
                {/* Header: 1- Employee Name + 6- Status */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-sm text-white">{empName}</h4>
                    <p className="text-xs text-[#A49EC0] mt-0.5" dir="ltr">{empPhone}</p>
                  </div>
                  {empStatus === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <UserCheck className="w-3 h-3" /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                      <UserX className="w-3 h-3" /> غير نشط
                    </span>
                  )}
                </div>

                {/* Grid: 3- Cycle, 4- Basic Salary, 5- Paid Salary */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                    <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الدورة</span>
                    <span className="font-bold text-white truncate block">{empCycle}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                    <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الأساسي المسجل</span>
                    <span className="font-bold font-mono text-white truncate block">{empRate}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECC796]/10 border border-[#ECC796]/30">
                    <span className="text-[10px] font-bold text-[#ECC796] block mb-0.5">المدفوع بالمعاملة</span>
                    <span className="font-black font-mono text-[#ECC796] truncate block">{fmt(s.net_salary)}</span>
                  </div>
                </div>

                {/* Additional transaction details */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A49EC0] bg-[#1E1735]/40 p-2.5 rounded-xl border border-[#3D3554]/40">
                  <div>
                    <span>تاريخ الدفع: <strong className="text-white">{fmtDate(s.payment_date)}</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#2F264C] text-white text-[10px] font-bold border border-[#3D3554]">
                    {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                  </span>
                </div>

                {s.product && (
                  <p className="text-[11px] text-gray-300 bg-[#2F264C]/40 p-2 rounded-lg border border-[#3D3554]/40">
                    المنتج: <strong className="text-white">{s.product.name}</strong> {s.production_quantity ? `(${s.production_quantity} قطعة)` : ''}
                  </p>
                )}

                {parseFloat(s.deductions) > 0 && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    خصومات: {fmt(s.deductions)} {s.deduction_reason ? `(${s.deduction_reason})` : ''}
                  </p>
                )}

                {s.notes && (
                  <p className="text-[11px] text-[#A49EC0]">
                    ملاحظات: {s.notes}
                  </p>
                )}

                {/* 7- Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#3D3554]/60">
                  <div>
                    {s.receipt_path ? (
                      <button
                        onClick={() => onViewReceipt(s.receipt_path)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] text-[#ECC796] hover:bg-white/10 text-xs font-bold border border-[#3D3554]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>عرض الإيصال</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#A49EC0]/50">بدون إيصال</span>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteSalary(s.employee_id, s.id)}
                    className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="حذف الدفعة"
                    title="حذف الدفعة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (Hidden on mobile screens) */}
      <div className="hidden md:block rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
        <div className="px-5 py-3.5 border-b border-[#3D3554] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#ECC796]" />
            <h3 className="text-xs font-black text-white">سجل دفعات الرواتب المسجلة</h3>
          </div>
          <span className="text-[11px] text-[#A49EC0]">
            إجمالي السجلات: {history.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0] border-b border-[#3D3554] bg-[#1E1735]/50">
                <th className="text-right px-4 py-3 font-bold">اسم الموظف</th>
                <th className="text-right px-4 py-3 font-bold">رقم الهاتف</th>
                <th className="text-right px-4 py-3 font-bold">دورة الراتب</th>
                <th className="text-right px-4 py-3 font-bold">الراتب الأساسي المسجل</th>
                <th className="text-right px-4 py-3 font-bold">المدفوع في المعاملة</th>
                <th className="text-right px-4 py-3 font-bold">الحالة</th>
                <th className="text-right px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A49EC0]">
                    جاري تحميل سجلات الرواتب...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A49EC0]">
                    لا توجد دفعات رواتب مسجلة تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                history.map(s => {
                  const emp = s.employee;
                  const empName = emp?.name || `موظف #${s.employee_id}`;
                  const empPhone = emp?.phone || '—';
                  const empCycle = emp?.salary_cycle ? (CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle) : '—';
                  const empRate = emp?.rate != null ? fmt(emp.rate) : '—';
                  const empStatus = emp?.status || 'active';

                  return (
                    <tr key={s.id} className="border-b border-[#3D3554]/60 hover:bg-white/5 transition-colors">
                      {/* 1- Employee Name */}
                      <td className="px-4 py-3 font-bold text-white">
                        <div>
                          <span>{empName}</span>
                          <span className="text-[10px] text-[#A49EC0] block mt-0.5">
                            {fmtDate(s.payment_date)} • {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                          </span>
                        </div>
                      </td>

                      {/* 2- Phone */}
                      <td className="px-4 py-3 text-[#A49EC0]" dir="ltr">
                        {empPhone}
                      </td>

                      {/* 3- Salary Cycle */}
                      <td className="px-4 py-3 text-white font-medium">
                        {empCycle}
                      </td>

                      {/* 4- Basic Salary */}
                      <td className="px-4 py-3 text-white font-mono">
                        {empRate}
                      </td>

                      {/* 5- Paid Salary (Net in this transaction) */}
                      <td className="px-4 py-3 text-[#ECC796] font-mono font-bold">
                        <div>
                          <span>{fmt(s.net_salary)}</span>
                          {parseFloat(s.deductions) > 0 && (
                            <span className="text-[10px] text-red-400 block font-normal">
                              خصم: {fmt(s.deductions)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6- Status */}
                      <td className="px-4 py-3">
                        {empStatus === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <UserCheck className="w-3 h-3" /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <UserX className="w-3 h-3" /> غير نشط
                          </span>
                        )}
                      </td>

                      {/* 7- Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {s.receipt_path ? (
                            <button
                              onClick={() => onViewReceipt(s.receipt_path)}
                              className="inline-flex items-center gap-1 text-[#ECC796] hover:underline font-bold"
                              title="عرض الإيصال"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>إيصال</span>
                            </button>
                          ) : (
                            <span className="text-[#A49EC0]/40">—</span>
                          )}

                          <button
                            onClick={() => onDeleteSalary(s.employee_id, s.id)}
                            className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="حذف الدفعة"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
