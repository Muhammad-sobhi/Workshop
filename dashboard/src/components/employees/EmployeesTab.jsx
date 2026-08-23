import { Search, Plus, Pencil, Trash2, UserCheck, UserX, FileSpreadsheet } from 'lucide-react';

export default function EmployeesTab({ loading, employees, search, setSearch, onAdd, onEdit, onDelete, onOpenLedger, currency, fmt, CYCLE_LABELS }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف أو رقم الهاتف..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white placeholder-[#A49EC0]/60 outline-none focus:border-[#ECC796] transition-all"
          />
        </div>
        <button
          onClick={onAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* Mobile Cards View (hidden on md and larger) */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          <div className="text-center py-10 text-xs text-[#A49EC0]">جاري التحميل...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#A49EC0]">لا يوجد موظفون مطابقة للبحث</div>
        ) : (
          employees.map(emp => (
            <div key={`m-emp-${emp.id}`} className="rounded-2xl border border-[#3D3554] bg-[#231B3D] p-4 shadow-md space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-black text-sm text-white">{emp.name}</h4>
                  <p className="text-xs text-[#A49EC0] mt-0.5" dir="ltr">{emp.phone || '—'}</p>
                </div>
                {emp.status === 'active' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <UserCheck className="w-3 h-3" /> نشط
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                    <UserX className="w-3 h-3" /> غير نشط
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                  <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">دورة الراتب</span>
                  <span className="font-bold text-white">{CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                  <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الراتب الأساسي / المعدل</span>
                  <span className="font-black font-mono text-[#ECC796]">{fmt(emp.rate)}</span>
                </div>
              </div>

              {emp.notes && (
                <p className="text-[11px] text-[#A49EC0] bg-[#1E1735]/40 p-2 rounded-lg border border-[#3D3554]/40">
                  {emp.notes}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3D3554]/60">
                <button
                  onClick={() => onOpenLedger(emp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-indigo-400 text-xs font-bold hover:bg-indigo-500/10 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>كشف حساب</span>
                </button>
                <button
                  onClick={() => onEdit(emp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-[#ECC796] text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => onDelete(emp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0] border-b border-[#3D3554]">
                <th className="text-right px-4 py-3 font-bold">الاسم</th>
                <th className="text-right px-4 py-3 font-bold">الهاتف</th>
                <th className="text-right px-4 py-3 font-bold">الدورة</th>
                <th className="text-right px-4 py-3 font-bold">المعدل</th>
                <th className="text-right px-4 py-3 font-bold">الحالة</th>
                <th className="text-right px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-[#A49EC0]">جاري التحميل...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-[#A49EC0]">لا يوجد موظفون</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} className="border-b border-[#3D3554]/60 hover:bg-white/5">
                    <td className="px-4 py-3 font-bold text-white">{emp.name}</td>
                    <td className="px-4 py-3 text-[#A49EC0]" dir="ltr">{emp.phone || '—'}</td>
                    <td className="px-4 py-3 text-[#A49EC0]">{CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle}</td>
                    <td className="px-4 py-3 text-white font-mono">{fmt(emp.rate)}</td>
                    <td className="px-4 py-3">
                      {emp.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <UserCheck className="w-3 h-3" /> نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          <UserX className="w-3 h-3" /> غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onOpenLedger(emp)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-indigo-400 hover:bg-indigo-500/10 transition-colors" aria-label="كشف حساب">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onEdit(emp)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-[#ECC796] hover:bg-white/10 transition-colors" aria-label="تعديل">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(emp)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors" aria-label="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
