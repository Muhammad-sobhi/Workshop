import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  Trash2, 
  Banknote, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  Users
} from 'lucide-react';
import apiClient from '@/lib/api-client';

// Helper to get the Saturday of the current week (or preceding Saturday)
const getSaturday = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day - (day === 6 ? 0 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

const WEEKDAYS_AR = [
  { id: 6, label: 'السبت' },
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الإثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
];

const WORK_MODES = [
  { value: 'full_day', label: 'يوم كامل' },
  { value: 'half_day', label: 'نصف يوم' },
  { value: 'piece_rate', label: 'بالقطعة' },
  { value: 'hybrid', label: 'مزدوج (يومية+قطعة)' },
  { value: 'leave', label: 'إجازة' },
  { value: 'absent', label: 'غياب' },
];

export default function WeeklyTimesheetGrid({ employee, products = [], onSalaryPayout, onOpenBulkPayout }) {
  const [weekStart, setWeekStart] = useState(getSaturday());
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settled, setSettled] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Calculate week end (Thursday)
  const weekEnd = useMemo(() => {
    if (!weekStart) return '';
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 5); // Sat + 5 days = Thu
    return d.toISOString().split('T')[0];
  }, [weekStart]);

  const initEmptyDays = () => {
    return WEEKDAYS_AR.map((wd, index) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + index);
      return {
        date: d.toISOString().split('T')[0],
        weekday_ar: wd.label,
        work_mode: 'full_day',
        task_description: '',
        daily_wage: employee?.rate || 0,
        product_id: '',
        quantity: '',
        piece_rate: '',
        advance_amount: 0,
        penalty_amount: 0
      };
    });
  };

  const fetchTimesheet = async () => {
    if (!employee?.id || !weekStart) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/employees/${employee.id}/timesheet`, {
        params: { week_start: weekStart }
      });
      
      const payload = response.data?.data || response.data || {};
      const fetchedDays = payload.days || response.data?.days;

      if (fetchedDays && fetchedDays.length > 0) {
        setDays(fetchedDays.map((d, index) => ({
          date: d.date,
          weekday_ar: d.weekday_ar || WEEKDAYS_AR[index]?.label,
          work_mode: d.work_mode || 'full_day',
          task_description: d.task_description || '',
          daily_wage: d.daily_wage !== undefined ? d.daily_wage : (employee?.rate || 0),
          product_id: d.product_id || '',
          quantity: d.quantity || '',
          piece_rate: d.piece_rate || '',
          advance_amount: d.advance_amount || 0,
          penalty_amount: d.penalty_amount || 0,
        })));
        setSettled(payload.settled || false);
        setIsSaved(true);
      } else {
        setDays(initEmptyDays());
        setSettled(false);
        setIsSaved(false);
      }
    } catch (err) {
      console.error('Error fetching timesheet:', err);
      setDays(initEmptyDays());
      setSettled(false);
      setIsSaved(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheet();
  }, [employee?.id, weekStart]);

  // Week navigation
  const navigateWeek = (offsetWeeks) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + (offsetWeeks * 7));
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const resetToCurrentWeek = () => {
    setWeekStart(getSaturday());
  };

  // Row update handlers
  const handleFieldChange = (index, field, value) => {
    setIsSaved(false); // Mark as unsaved changes
    setDays(prevDays => {
      const newDays = [...prevDays];
      const row = { ...newDays[index], [field]: value };

      if (field === 'work_mode') {
        if (value === 'full_day') {
          row.daily_wage = employee?.rate || 0;
          row.product_id = '';
          row.quantity = '';
          row.piece_rate = '';
        } else if (value === 'half_day') {
          row.daily_wage = (employee?.rate || 0) / 2;
          row.product_id = '';
          row.quantity = '';
          row.piece_rate = '';
        } else if (value === 'piece_rate') {
          row.daily_wage = 0;
        } else if (value === 'hybrid') {
          row.daily_wage = row.daily_wage || employee?.rate || 0;
        } else if (value === 'leave' || value === 'absent') {
          row.daily_wage = 0;
          row.product_id = '';
          row.quantity = '';
          row.piece_rate = '';
        }
      }

      if (field === 'product_id') {
        const prod = products.find(p => p.id.toString() === value.toString());
        if (prod) {
          row.piece_rate = prod.labor_cost || prod.cost_price || 0;
        } else {
          row.piece_rate = '';
        }
      }

      newDays[index] = row;
      return newDays;
    });
  };

  // Actions
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        week_start: weekStart,
        days: days.map(d => ({
          date: d.date,
          work_mode: d.work_mode,
          task_description: d.task_description || null,
          daily_wage: Number(d.daily_wage) || 0,
          product_id: d.product_id ? Number(d.product_id) : null,
          quantity: d.quantity ? Number(d.quantity) : null,
          piece_rate: d.piece_rate ? Number(d.piece_rate) : null,
          advance_amount: Number(d.advance_amount) || 0,
          penalty_amount: Number(d.penalty_amount) || 0,
        }))
      };

      await apiClient.post(`/employees/${employee.id}/timesheet`, payload);
      setIsSaved(true);
      setSuccess('✓ تم حفظ يوميات الأسبوع وترحيل القيود المالية بنجاح');
      setTimeout(() => setSuccess(null), 4000);
      fetchTimesheet();
    } catch (err) {
      console.error('Error saving timesheet:', err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من حذف سجلات هذا الأسبوع؟')) return;

    setDeleting(true);
    setError(null);
    
    try {
      await apiClient.delete(`/employees/${employee.id}/timesheet`, {
        params: { week_start: weekStart }
      });
      setSuccess('تم حذف بيانات الأسبوع بنجاح');
      setTimeout(() => setSuccess(null), 3000);
      setDays(initEmptyDays());
      setSettled(false);
      setIsSaved(false);
    } catch (err) {
      console.error('Error deleting timesheet:', err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setDeleting(false);
    }
  };

  // Calculations
  const summary = useMemo(() => {
    let totalDailyWage = 0;
    let totalPieceWage = 0;
    let totalAdvances = 0;
    let totalPenalties = 0;

    days.forEach(day => {
      const daily = Number(day.daily_wage) || 0;
      const q = Number(day.quantity) || 0;
      const pr = Number(day.piece_rate) || 0;
      const pieceTotal = q * pr;
      const adv = Number(day.advance_amount) || 0;
      const pen = Number(day.penalty_amount) || 0;

      totalDailyWage += daily;
      totalPieceWage += pieceTotal;
      totalAdvances += adv;
      totalPenalties += pen;
    });

    const grossTotal = totalDailyWage + totalPieceWage;
    const netPayable = grossTotal - totalAdvances - totalPenalties;

    return { totalDailyWage, totalPieceWage, grossTotal, totalAdvances, totalPenalties, netPayable };
  }, [days]);

  const inputClass = "w-full bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#ECC796] focus:outline-none transition-colors";
  const selectClass = "w-full bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-lg px-2 py-1.5 focus:border-[#ECC796] focus:outline-none transition-colors";

  return (
    <div className="space-y-5" dir="rtl">
      {/* Navigation & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#2F264C] p-4 rounded-xl border border-[#3D3554]">
        <div className="flex items-center gap-2.5 text-white flex-wrap">
          <div className="p-2 rounded-lg bg-[#231B3D] border border-[#3D3554] text-[#ECC796]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-[#A49EC0] block">فترة الأسبوع</span>
            <span className="font-bold text-sm text-white">
              من {weekStart} إلى {weekEnd}
            </span>
          </div>

          {settled ? (
            <span className="bg-[#13DEB9]/15 border border-[#13DEB9]/30 text-[#13DEB9] text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 mr-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              تم الصرف
            </span>
          ) : isSaved ? (
            <span className="bg-[#8F5AE9]/15 border border-[#8F5AE9]/30 text-[#ECC796] text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 mr-3">
              <Check className="w-3.5 h-3.5 text-[#13DEB9]" />
              الأسبوع محفوظ
            </span>
          ) : (
            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full font-bold mr-3">
              تغييرات غير محفوظة
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => navigateWeek(-1)}
            className="p-2 bg-[#231B3D] border border-[#3D3554] text-[#A49EC0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="الأسبوع السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={resetToCurrentWeek}
            className="px-3 py-1.5 text-xs font-bold bg-[#231B3D] border border-[#3D3554] text-[#ECC796] hover:bg-[#ECC796]/10 rounded-lg transition-colors flex-1 sm:flex-none text-center"
          >
            الأسبوع الحالي
          </button>
          
          <button 
            onClick={() => navigateWeek(1)}
            className="p-2 bg-[#231B3D] border border-[#3D3554] text-[#A49EC0] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="الأسبوع القادم"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {onOpenBulkPayout && (
            <button
              type="button"
              onClick={() => onOpenBulkPayout(weekStart)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8F5AE9]/20 border border-[#8F5AE9]/40 text-[#ECC796] hover:bg-[#8F5AE9]/30 text-xs font-bold transition-all mr-2 whitespace-nowrap"
              title="صرف رواتب الأسبوع لجميع الموظفين"
            >
              <Users className="w-4 h-4" />
              <span>صرف رواتب الأسبوع للكل</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-[#13DEB9]/10 border border-[#13DEB9]/30 text-[#13DEB9] p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Table & Mobile Cards */}
      <div className="bg-[#2F264C] rounded-xl border border-[#3D3554] overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center text-[#A49EC0]">
            <Loader2 className="w-7 h-7 animate-spin text-[#ECC796]" />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#231B3D] text-[#A49EC0] font-bold border-b border-[#3D3554]">
                  <tr>
                    <th className="py-3 px-3">اليوم والتاريخ</th>
                    <th className="py-3 px-3 w-32">طبيعة الدوام</th>
                    <th className="py-3 px-3">البيان / المهام</th>
                    <th className="py-3 px-3 w-24">يومية (ج.م)</th>
                    <th className="py-3 px-3 w-36">المنتج (إن وجد)</th>
                    <th className="py-3 px-3 w-20">الكمية</th>
                    <th className="py-3 px-3 w-24">سعر القطعة</th>
                    <th className="py-3 px-3 w-24">إجمالي الإنتاج</th>
                    <th className="py-3 px-3 w-20">سلفة</th>
                    <th className="py-3 px-3 w-20">خصم</th>
                    <th className="py-3 px-3 w-24 text-left">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3554]/40 text-white font-medium">
                  {days.map((day, idx) => {
                    const rowPieceTotal = (Number(day.quantity) || 0) * (Number(day.piece_rate) || 0);
                    const rowNet = ((Number(day.daily_wage) || 0) + rowPieceTotal) - (Number(day.advance_amount) || 0) - (Number(day.penalty_amount) || 0);
                    const isPieceOnly = day.work_mode === 'piece_rate';
                    const isHybrid = day.work_mode === 'hybrid';
                    const isInactive = day.work_mode === 'leave' || day.work_mode === 'absent';

                    return (
                      <tr key={day.date} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-white">{day.weekday_ar}</div>
                          <div className="text-[10px] text-[#A49EC0]">{day.date}</div>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            disabled={settled}
                            className={selectClass}
                            value={day.work_mode}
                            onChange={e => handleFieldChange(idx, 'work_mode', e.target.value)}
                          >
                            {WORK_MODES.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled}
                            type="text"
                            placeholder="وصف المهام..."
                            className={inputClass}
                            value={day.task_description || ''}
                            onChange={e => handleFieldChange(idx, 'task_description', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled || isPieceOnly || isInactive}
                            type="number"
                            min="0"
                            className={`${inputClass} ${(isPieceOnly || isInactive) ? 'opacity-40 bg-[#1e1735]' : ''}`}
                            value={day.daily_wage}
                            onChange={e => handleFieldChange(idx, 'daily_wage', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <select
                            disabled={settled || (!isPieceOnly && !isHybrid)}
                            className={`${selectClass} ${(!isPieceOnly && !isHybrid) ? 'opacity-40 bg-[#1e1735]' : ''}`}
                            value={day.product_id || ''}
                            onChange={e => handleFieldChange(idx, 'product_id', e.target.value)}
                          >
                            <option value="">— اختر —</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled || (!isPieceOnly && !isHybrid)}
                            type="number"
                            min="0"
                            placeholder="0"
                            className={`${inputClass} ${(!isPieceOnly && !isHybrid) ? 'opacity-40 bg-[#1e1735]' : ''}`}
                            value={day.quantity || ''}
                            onChange={e => handleFieldChange(idx, 'quantity', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled || (!isPieceOnly && !isHybrid)}
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="0.00"
                            className={`${inputClass} ${(!isPieceOnly && !isHybrid) ? 'opacity-40 bg-[#1e1735]' : ''}`}
                            value={day.piece_rate || ''}
                            onChange={e => handleFieldChange(idx, 'piece_rate', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-[#ECC796]">
                          {rowPieceTotal > 0 ? rowPieceTotal.toLocaleString('ar-EG') : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled}
                            type="number"
                            min="0"
                            className={`${inputClass} text-red-400`}
                            value={day.advance_amount}
                            onChange={e => handleFieldChange(idx, 'advance_amount', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            disabled={settled}
                            type="number"
                            min="0"
                            className={`${inputClass} text-red-400`}
                            value={day.penalty_amount}
                            onChange={e => handleFieldChange(idx, 'penalty_amount', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3 text-left font-black text-sm">
                          <span className={rowNet >= 0 ? 'text-[#13DEB9]' : 'text-red-400'}>
                            {rowNet.toLocaleString('ar-EG')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden divide-y divide-[#3D3554]/50">
              {days.map((day, idx) => {
                const rowPieceTotal = (Number(day.quantity) || 0) * (Number(day.piece_rate) || 0);
                const rowNet = ((Number(day.daily_wage) || 0) + rowPieceTotal) - (Number(day.advance_amount) || 0) - (Number(day.penalty_amount) || 0);
                const isPieceOnly = day.work_mode === 'piece_rate';
                const isHybrid = day.work_mode === 'hybrid';
                const isInactive = day.work_mode === 'leave' || day.work_mode === 'absent';

                return (
                  <div key={day.date} className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-black text-white text-sm ml-2">{day.weekday_ar}</span>
                        <span className="text-xs text-[#A49EC0]">{day.date}</span>
                      </div>
                      <div className="text-left font-black text-sm">
                        <span className={rowNet >= 0 ? 'text-[#13DEB9]' : 'text-red-400'}>
                          {rowNet.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-[#A49EC0] mb-1 block">طبيعة الدوام</label>
                        <select
                          disabled={settled}
                          className={selectClass}
                          value={day.work_mode}
                          onChange={e => handleFieldChange(idx, 'work_mode', e.target.value)}
                        >
                          {WORK_MODES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#A49EC0] mb-1 block">يومية (ج.م)</label>
                        <input
                          disabled={settled || isPieceOnly || isInactive}
                          type="number"
                          min="0"
                          className={inputClass}
                          value={day.daily_wage}
                          onChange={e => handleFieldChange(idx, 'daily_wage', e.target.value)}
                        />
                      </div>
                    </div>

                    {(isPieceOnly || isHybrid) && (
                      <div className="p-3 bg-[#231B3D] rounded-xl border border-[#3D3554] space-y-2.5">
                        <span className="text-xs font-bold text-[#ECC796] block">تسجيل عمل بالقطعة:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-[#A49EC0] block mb-1">المنتج</label>
                            <select
                              disabled={settled}
                              className={selectClass}
                              value={day.product_id || ''}
                              onChange={e => handleFieldChange(idx, 'product_id', e.target.value)}
                            >
                              <option value="">— اختر المنتج —</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-[#A49EC0] block mb-1">الكمية</label>
                            <input
                              disabled={settled}
                              type="number"
                              min="0"
                              className={inputClass}
                              value={day.quantity || ''}
                              onChange={e => handleFieldChange(idx, 'quantity', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#A49EC0] block mb-1">سعر القطعة</label>
                            <input
                              disabled={settled}
                              type="number"
                              min="0"
                              className={inputClass}
                              value={day.piece_rate || ''}
                              onChange={e => handleFieldChange(idx, 'piece_rate', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-red-400 mb-1 block">سلفة (ج.م)</label>
                        <input
                          disabled={settled}
                          type="number"
                          min="0"
                          className={`${inputClass} text-red-400`}
                          value={day.advance_amount}
                          onChange={e => handleFieldChange(idx, 'advance_amount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-red-400 mb-1 block">خصم (ج.م)</label>
                        <input
                          disabled={settled}
                          type="number"
                          min="0"
                          className={`${inputClass} text-red-400`}
                          value={day.penalty_amount}
                          onChange={e => handleFieldChange(idx, 'penalty_amount', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <input
                        disabled={settled}
                        type="text"
                        placeholder="بيان المهام أو ملاحظات..."
                        className={inputClass}
                        value={day.task_description || ''}
                        onChange={e => handleFieldChange(idx, 'task_description', e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Summary Box & Actions */}
      <div className="bg-[#2F264C] p-5 rounded-xl border border-[#3D3554] flex flex-col md:flex-row justify-between items-center gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
          <div className="bg-[#231B3D] p-3 rounded-xl border border-[#3D3554]">
            <span className="text-[11px] text-[#A49EC0] font-bold block">إجمالي اليوميات</span>
            <span className="text-sm font-black text-white">{summary.totalDailyWage.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="bg-[#231B3D] p-3 rounded-xl border border-[#3D3554]">
            <span className="text-[11px] text-[#A49EC0] font-bold block">إجمالي القطعة</span>
            <span className="text-sm font-black text-[#ECC796]">{summary.totalPieceWage.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="bg-[#231B3D] p-3 rounded-xl border border-[#3D3554]">
            <span className="text-[11px] text-red-400 font-bold block">سلف وخصومات</span>
            <span className="text-sm font-black text-red-400">{(summary.totalAdvances + summary.totalPenalties).toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="bg-[#231B3D] p-3 rounded-xl border border-[#13DEB9]/30">
            <span className="text-[11px] text-[#13DEB9] font-bold block">الصافي المستحق للأسبوع</span>
            <span className="text-base font-black text-[#13DEB9]">{summary.netPayable.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            disabled={deleting || settled}
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف</span>
          </button>

          <button
            disabled={saving || settled}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#231B3D] border border-[#3D3554] text-[#ECC796] hover:bg-[#ECC796]/10 text-xs font-bold transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ الأسبوع</span>
          </button>

          {onSalaryPayout && (
            <button
              disabled={settled || summary.netPayable <= 0}
              onClick={() => onSalaryPayout({
                employee,
                week_start: weekStart,
                week_end: weekEnd,
                net_salary: summary.netPayable
              })}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#ECC796] hover:bg-[#ECC796]/90 text-[#1E1735] text-xs font-black transition-all shadow-md disabled:opacity-40"
            >
              <Banknote className="w-4 h-4" />
              <span>صرف راتب الأسبوع</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
