import { Banknote } from 'lucide-react';
import WeeklyTimesheetGrid from '@/components/employees/WeeklyTimesheetGrid';

export default function TimesheetTabPanel({
  selectedEmpId,
  setSelectedEmpId,
  activeEmployees,
  selectedEmployee,
  products,
  inputCls,
  onOpenBulkPayout,
  onWeeklyBulkPayout,
  onSalaryPayout,
}) {
  return (
    <div className="bg-[#231B3D] border border-[#3D3554] rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-xs w-full">
          <label className="block text-xs font-bold text-[#A49EC0] mb-1.5">اختر الموظف لعرض اليوميات</label>
          <select className={inputCls} value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
            <option value="">— اختر الموظف —</option>
            {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenBulkPayout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ECC796] hover:bg-[#ECC796]/90 text-[#201A30] font-black text-xs transition-all shadow-md self-start sm:self-end"
        >
          <Banknote className="w-4 h-4" />
          <span>صرف رواتب الأسبوع لجميع الموظفين (Bulk Payout)</span>
        </button>
      </div>

      {selectedEmployee ? (
        <WeeklyTimesheetGrid
          employee={selectedEmployee}
          products={products}
          onOpenBulkPayout={onWeeklyBulkPayout}
          onSalaryPayout={onSalaryPayout}
        />
      ) : (
        <div className="text-center py-16 text-xs font-bold text-[#A49EC0] bg-[#2F264C] rounded-xl border border-[#3D3554] space-y-3">
          <p>يرجى اختيار موظف من القائمة أعلاه لعرض وتعديل جدول يوميات العمل، أو الضغط على زر صرف الرواتب للكل أعلاه.</p>
          <button
            type="button"
            onClick={onOpenBulkPayout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8F5AE9]/20 border border-[#8F5AE9]/40 text-[#ECC796] hover:bg-[#8F5AE9]/30 font-bold text-xs transition-all"
          >
            <Banknote className="w-4 h-4" />
            <span>فتح نافذة صرف الرواتب لجميع الموظفين</span>
          </button>
        </div>
      )}
    </div>
  );
}
