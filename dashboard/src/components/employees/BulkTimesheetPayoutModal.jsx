import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Banknote, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Users, 
  Layers, 
  Wallet,
  CheckSquare,
  Square,
  ArrowRightLeft
} from 'lucide-react';
import apiClient from '@/lib/api-client';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقدي (الخزينة الرئيسية)' },
  { value: 'instapay', label: 'انستاباي (InstaPay)' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'postal_transfer', label: 'حوالة بريدية' },
];

const CYCLE_LABELS = {
  day: 'يومي',
  few_days: 'عدة أيام',
  week: 'أسبوعي',
  month: 'شهري',
  production: 'بالقطعة'
};

export default function BulkTimesheetPayoutModal({ isOpen, onClose, weekStart, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [employeesData, setEmployeesData] = useState([]);
  const [weekEnd, setWeekEnd] = useState('');

  // Fetch preview data whenever modal opens or weekStart changes
  useEffect(() => {
    if (isOpen && weekStart) {
      fetchPreview();
    }
  }, [isOpen, weekStart]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/timesheets/bulk-preview', {
        params: { week_start: weekStart }
      });

      const list = res.data?.employees || [];
      setWeekEnd(res.data?.week_end || '');

      // Initialize form state for each employee
      const mapped = list.map(emp => {
        const hasOld = emp.prior_balance > 0;
        const isSettled = emp.already_settled;
        const hasWork = emp.week_net > 0 || emp.has_activity;

        // Default mode: If settled or no activity/balance, exclude. Else week_only.
        let defaultMode = 'week_only';
        if (isSettled || (!hasWork && !hasOld)) {
          defaultMode = 'exclude';
        }

        let defaultAmount = emp.week_net;
        if (defaultMode === 'exclude') {
          defaultAmount = 0;
        }

        return {
          ...emp,
          payout_mode: defaultMode,
          amount: defaultAmount,
          selected: defaultMode !== 'exclude',
          notes: ''
        };
      });

      setEmployeesData(mapped);
    } catch (err) {
      console.error('Error fetching bulk preview:', err);
      setError('تعذر تحميل بيانات رواتب الأسبوع. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  // Change payout mode for a specific employee
  const handleModeChange = (empId, newMode) => {
    setEmployeesData(prev => prev.map(item => {
      if (item.employee_id !== empId) return item;

      let newAmount = item.amount;
      let isSelected = true;

      if (newMode === 'week_only') {
        newAmount = item.week_net;
        isSelected = true;
      } else if (newMode === 'week_plus_old') {
        newAmount = Number((item.week_net + (item.prior_balance || 0)).toFixed(2));
        isSelected = true;
      } else if (newMode === 'exclude') {
        newAmount = 0;
        isSelected = false;
      }

      return {
        ...item,
        payout_mode: newMode,
        amount: newAmount,
        selected: isSelected
      };
    }));
  };

  // Toggle selection checkbox
  const handleToggleSelect = (empId) => {
    setEmployeesData(prev => prev.map(item => {
      if (item.employee_id !== empId) return item;

      const nextSelected = !item.selected;
      const nextMode = nextSelected ? (item.payout_mode === 'exclude' ? 'week_only' : item.payout_mode) : 'exclude';
      let nextAmount = 0;

      if (nextSelected) {
        nextAmount = nextMode === 'week_plus_old' 
          ? Number((item.week_net + (item.prior_balance || 0)).toFixed(2))
          : item.week_net;
      }

      return {
        ...item,
        selected: nextSelected,
        payout_mode: nextMode,
        amount: nextAmount
      };
    }));
  };

  // Custom amount adjustment
  const handleAmountChange = (empId, val) => {
    const num = parseFloat(val) || 0;
    setEmployeesData(prev => prev.map(item => {
      if (item.employee_id !== empId) return item;
      return {
        ...item,
        amount: num,
        selected: num > 0,
        payout_mode: num > 0 && item.payout_mode === 'exclude' ? 'week_only' : item.payout_mode
      };
    }));
  };

  // Select all / Deselect all
  const handleSelectAll = (select) => {
    setEmployeesData(prev => prev.map(item => {
      if (select) {
        const mode = item.payout_mode === 'exclude' ? 'week_only' : item.payout_mode;
        const amt = mode === 'week_plus_old' ? (item.week_net + (item.prior_balance || 0)) : item.week_net;
        return { ...item, selected: true, payout_mode: mode, amount: amt };
      } else {
        return { ...item, selected: false, payout_mode: 'exclude', amount: 0 };
      }
    }));
  };

  // Set all employees with old balances to week_only or week_plus_old
  const handleSetGlobalOldBalanceMode = (mode) => {
    setEmployeesData(prev => prev.map(item => {
      if (item.prior_balance <= 0 || item.already_settled) return item;

      let amt = item.amount;
      if (mode === 'week_only') amt = item.week_net;
      else if (mode === 'week_plus_old') amt = Number((item.week_net + item.prior_balance).toFixed(2));
      else if (mode === 'exclude') amt = 0;

      return {
        ...item,
        payout_mode: mode,
        selected: mode !== 'exclude',
        amount: amt
      };
    }));
  };

  // Calculations
  const summary = useMemo(() => {
    const activePayouts = employeesData.filter(e => e.selected && (parseFloat(e.amount) || 0) > 0);
    const count = activePayouts.length;
    const totalAmount = activePayouts.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalWeekNet = employeesData.reduce((sum, e) => sum + (e.week_net || 0), 0);
    const totalPrior = employeesData.reduce((sum, e) => sum + (e.prior_balance || 0), 0);

    return { count, totalAmount, totalWeekNet, totalPrior };
  }, [employeesData]);

  // Submit bulk payouts
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (summary.count === 0) {
      setError('يرجى اختيار موظف واحد على الأقل لصرف راتبه.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        week_start: weekStart,
        week_end: weekEnd,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        payouts: employeesData
          .filter(e => e.selected && (parseFloat(e.amount) || 0) > 0)
          .map(e => ({
            employee_id: e.employee_id,
            payout_mode: e.payout_mode,
            amount: parseFloat(e.amount) || 0,
            notes: e.notes || (e.payout_mode === 'week_plus_old' 
              ? ('صرف راتب أسبوع + رصيد مستحق سابق للموظف ' + e.employee_name)
              : ('صرف راتب أسبوع من ' + weekStart + ' إلى ' + weekEnd)
            )
          }))
      };

      const res = await apiClient.post('/timesheets/bulk-payout', payload);
      setSuccessMsg(res.data?.message || 'تم صرف رواتب الأسبوع بنجاح.');

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error executing bulk payout:', err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء صرف الرواتب.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      <div className="bg-[#201A30] border border-[#3D3554] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#2F264C] border-b border-[#3D3554] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#ECC796]/15 border border-[#ECC796]/30 text-[#ECC796]">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                صرف رواتب الأسبوع لجميع الموظفين
              </h2>
              <p className="text-xs text-[#A49EC0] mt-0.5">
                فترة الأسبوع: من السبت <span className="font-mono text-white font-bold">{weekStart}</span> إلى الجمعة <span className="font-mono text-white font-bold">{weekEnd}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A49EC0] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Controls & Summary */}
        <div className="p-4 sm:p-5 bg-[#231B3D]/70 border-b border-[#3D3554] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <div>
            <label className="block text-[11px] font-bold text-[#A49EC0] mb-1">تاريخ الدفع *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white focus:border-[#ECC796] outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#A49EC0] mb-1">طريقة الصرف *</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white focus:border-[#ECC796] outline-none"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-[#2F264C] rounded-xl border border-[#3D3554] flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#A49EC0]">عدد الموظفين المشمولين</span>
            <span className="text-base font-black text-white">{summary.count} / {employeesData.length} موظف</span>
          </div>

          <div className="p-3 bg-[#2F264C] rounded-xl border border-[#13DEB9]/30 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#13DEB9]">إجمالي المبلغ الإجمالي للصرف</span>
            <span className="text-lg font-black text-[#13DEB9] font-mono">
              {summary.totalAmount.toLocaleString('ar-EG')} ج.م
            </span>
          </div>
        </div>

        {/* Quick Batch Filter Actions */}
        <div className="px-4 py-2.5 bg-[#2F264C]/50 border-b border-[#3D3554] flex flex-wrap justify-between items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="px-2.5 py-1 rounded-lg bg-[#231B3D] border border-[#3D3554] text-[#A49EC0] hover:text-white font-bold text-[11px] transition-colors"
            >
              تحديد الكل
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="px-2.5 py-1 rounded-lg bg-[#231B3D] border border-[#3D3554] text-[#A49EC0] hover:text-white font-bold text-[11px] transition-colors"
            >
              إلغاء تحديد الكل
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#A49EC0] font-bold">للموظفين ذوي الأرصدة القديمة:</span>
            <button
              type="button"
              onClick={() => handleSetGlobalOldBalanceMode('week_only')}
              className="px-2.5 py-1 rounded-lg bg-[#8F5AE9]/15 border border-[#8F5AE9]/30 text-[#ECC796] hover:bg-[#8F5AE9]/25 font-bold text-[11px] transition-colors"
            >
              1. صرف الأسبوع فقط
            </button>
            <button
              type="button"
              onClick={() => handleSetGlobalOldBalanceMode('week_plus_old')}
              className="px-2.5 py-1 rounded-lg bg-[#13DEB9]/15 border border-[#13DEB9]/30 text-[#13DEB9] hover:bg-[#13DEB9]/25 font-bold text-[11px] transition-colors"
            >
              2. صرف الأسبوع + القديم
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="m-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="m-4 p-3.5 rounded-xl bg-[#13DEB9]/10 border border-[#13DEB9]/30 text-[#13DEB9] text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-20 flex flex-col justify-center items-center gap-3 text-[#A49EC0]">
              <Loader2 className="w-8 h-8 animate-spin text-[#ECC796]" />
              <span className="text-xs">جاري احتساب يوميات وأرصدة الموظفين للأسبوع...</span>
            </div>
          ) : employeesData.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#A49EC0]">
              لا يوجد موظفون نشطون مسجلون في النظام.
            </div>
          ) : (
            <div className="bg-[#231B3D] border border-[#3D3554] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#2F264C] text-[#A49EC0] font-bold border-b border-[#3D3554]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={employeesData.length > 0 && employeesData.every(e => e.selected)}
                          onChange={e => handleSelectAll(e.target.checked)}
                          className="rounded text-[#ECC796] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">الموظف</th>
                      <th className="py-3 px-3">نظام الراتب</th>
                      <th className="py-3 px-3">مستحق هذا الأسبوع</th>
                      <th className="py-3 px-3">رصيد سابق / قديم</th>
                      <th className="py-3 px-3 w-64">خيارات الصرف</th>
                      <th className="py-3 px-3 w-32">المبلغ المنصرف</th>
                      <th className="py-3 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3D3554]/40 text-white font-medium">
                    {employeesData.map((emp) => {
                      const hasOldBalance = emp.prior_balance > 0;

                      return (
                        <tr 
                          key={emp.employee_id} 
                          className={"hover:bg-white/5 transition-colors " + (!emp.selected ? 'opacity-50 bg-[#1E1735]/60' : '')}
                        >
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={emp.selected}
                              onChange={() => handleToggleSelect(emp.employee_id)}
                              className="rounded text-[#ECC796] focus:ring-0 cursor-pointer"
                            />
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-white text-sm">{emp.employee_name}</div>
                            {emp.already_settled && (
                              <span className="text-[10px] text-amber-400 font-bold block">
                                (تم تسجيل راتب سابق لهذا الأسبوع)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap text-[#A49EC0]">
                            {CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap font-mono font-bold text-white">
                            {emp.week_net > 0 ? (
                              <span className="text-[#13DEB9]">{emp.week_net.toLocaleString('ar-EG')} ج.م</span>
                            ) : (
                              <span className="text-[#A49EC0]">0 ج.م</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap font-mono">
                            {hasOldBalance ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
                                +{emp.prior_balance.toLocaleString('ar-EG')} ج.م
                              </span>
                            ) : (
                              <span className="text-[#A49EC0]/60">—</span>
                            )}
                          </td>

                          {/* Action Selector */}
                          <td className="py-3.5 px-3">
                            {hasOldBalance ? (
                              <select
                                value={emp.payout_mode}
                                onChange={e => handleModeChange(emp.employee_id, e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#2F264C] border border-[#ECC796]/40 text-[#ECC796] font-bold focus:border-[#ECC796] outline-none"
                              >
                                <option value="week_only">1. صرف هذا الأسبوع فقط ({emp.week_net} ج.م)</option>
                                <option value="week_plus_old">2. صرف الأسبوع + الرصيد القديم ({(emp.week_net + emp.prior_balance).toLocaleString('ar-EG')} ج.م)</option>
                                <option value="exclude">3. استبعاد الموظف من الصرف</option>
                              </select>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleModeChange(emp.employee_id, emp.payout_mode === 'exclude' ? 'week_only' : 'exclude')}
                                  className={"px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors " + (
                                    emp.payout_mode !== 'exclude'
                                      ? 'bg-[#13DEB9]/15 border-[#13DEB9]/40 text-[#13DEB9]'
                                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                                  )}
                                >
                                  {emp.payout_mode !== 'exclude' ? 'مشمول في الصرف' : 'مستبعد'}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Payout Amount */}
                          <td className="py-3.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!emp.selected}
                              value={emp.amount}
                              onChange={e => handleAmountChange(emp.employee_id, e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#2F264C] border border-[#3D3554] text-white font-mono font-bold focus:border-[#ECC796] outline-none disabled:opacity-30 text-left"
                            />
                          </td>

                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {emp.already_settled ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                مسدد
                              </span>
                            ) : emp.selected ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#13DEB9]/15 text-[#13DEB9] text-[10px] font-bold border border-[#13DEB9]/30">
                                جاهز للصرف
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/30">
                                مستبعد
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#2F264C] border-t border-[#3D3554] flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="text-xs text-[#A49EC0] flex items-center gap-2">
            <span>إجمالي المبالغ المنصرفة:</span>
            <span className="font-mono font-black text-white text-sm">
              {summary.totalAmount.toLocaleString('ar-EG')} ج.م
            </span>
            <span className="text-[11px]">({summary.count} موظف مشمول)</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#231B3D] border border-[#3D3554] text-[#A49EC0] hover:text-white text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || summary.count === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ECC796] hover:bg-[#ECC796]/90 text-[#201A30] text-xs font-black transition-all shadow-lg disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              <span>تأكيد صرف رواتب الأسبوع ({summary.totalAmount.toLocaleString('ar-EG')} ج.م)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
