import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Layers,
  History
} from 'lucide-react';
import apiClient from '@/lib/api-client';

const getTodayString = () => new Date().toISOString().split('T')[0];

export default function ProductionLogGrid({ employee, products = [] }) {
  const [logDate, setLogDate] = useState(getTodayString());
  const [rows, setRows] = useState([
    { id: 1, product_id: '', quantity_produced: '', piece_rate: '', notes: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load history on mount or employee change
  const fetchHistory = async () => {
    if (!employee?.id) return;
    setHistoryLoading(true);
    try {
      const res = await apiClient.get('/employees-production-logs', {
        params: { employee_id: employee.id, per_page: 15 }
      });
      setHistory(res.data.data || []);
    } catch (err) {
      console.error('Error fetching production logs history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [employee?.id]);

  // Handle dynamic rows
  const addRow = () => {
    setRows(prev => [
      ...prev,
      { id: Date.now(), product_id: '', quantity_produced: '', piece_rate: '', notes: '' }
    ]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return; // Keep at least one row
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index, field, value) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'product_id') {
        const prod = products.find(p => p.id.toString() === value.toString());
        if (prod) {
          row.piece_rate = prod.labor_cost || prod.cost_price || 0;
        } else {
          row.piece_rate = '';
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Calculations
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = Number(r.quantity_produced) || 0;
      const rate = Number(r.piece_rate) || 0;
      return sum + (q * rate);
    }, 0);
  }, [rows]);

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employee?.id) return;

    // Validate
    const invalidRows = rows.filter(r => !r.product_id || !r.quantity_produced || Number(r.quantity_produced) <= 0);
    if (invalidRows.length > 0) {
      setError('يرجى اختيار المنتج وتحديد كمية أكبر من الصفر لكل صف');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        date: logDate,
        items: rows.map(r => ({
          product_id: Number(r.product_id),
          quantity_produced: Number(r.quantity_produced),
          piece_rate: r.piece_rate ? Number(r.piece_rate) : undefined,
          notes: r.notes || undefined
        }))
      };

      await apiClient.post(`/employees/${employee.id}/production-logs`, payload);
      
      setSuccess('تم تسجيل عمليات الإنتاج وترحيلها لحساب الموظف بنجاح');
      setTimeout(() => setSuccess(null), 3500);

      // Reset form
      setRows([{ id: Date.now(), product_id: '', quantity_produced: '', piece_rate: '', notes: '' }]);
      
      // Refresh history
      fetchHistory();
    } catch (err) {
      console.error('Error recording production logs:', err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الإنتاج');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-xl px-3 py-2 focus:border-[#ECC796] focus:outline-none transition-colors";
  const selectClass = "w-full bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-xl px-3 py-2 focus:border-[#ECC796] focus:outline-none transition-colors";

  return (
    <div className="space-y-6" dir="rtl">
      {/* Form Container */}
      <div className="bg-[#2F264C] p-5 sm:p-6 rounded-xl border border-[#3D3554]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-[#3D3554]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-[#ECC796]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">تسجيل إنتاج بالقطعة</h3>
              <p className="text-xs text-[#A49EC0]">تسجيل إنتاج الموظف وترحيل المستحقات لحسابه فوراً</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                className="bg-[#231B3D] border border-[#3D3554] text-white text-xs font-bold rounded-xl px-3 py-2 focus:border-[#ECC796] focus:outline-none transition-colors w-full"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mt-4 bg-[#13DEB9]/10 border border-[#13DEB9]/30 text-[#13DEB9] p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Dynamic Multi-row Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const rowTotal = (Number(row.quantity_produced) || 0) * (Number(row.piece_rate) || 0);

              return (
                <div 
                  key={row.id} 
                  className="bg-[#231B3D] p-4 rounded-xl border border-[#3D3554] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-[#A49EC0] font-bold mb-1">المنتج *</label>
                    <select
                      className={selectClass}
                      value={row.product_id}
                      onChange={e => handleRowChange(idx, 'product_id', e.target.value)}
                      required
                    >
                      <option value="">— اختر المنتج —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#A49EC0] font-bold mb-1">الكمية *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      className={inputClass}
                      value={row.quantity_produced}
                      onChange={e => handleRowChange(idx, 'quantity_produced', e.target.value)}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#A49EC0] font-bold mb-1">سعر القطعة (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0.00"
                      className={inputClass}
                      value={row.piece_rate}
                      onChange={e => handleRowChange(idx, 'piece_rate', e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-[#A49EC0] font-bold mb-1">ملاحظات</label>
                    <input
                      type="text"
                      placeholder="أمر تشغيل / وردية..."
                      className={inputClass}
                      value={row.notes}
                      onChange={e => handleRowChange(idx, 'notes', e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-1 flex items-center justify-end sm:justify-center pt-2 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="حذف الصف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
            <button
              type="button"
              onClick={addRow}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#231B3D] border border-dashed border-[#8F5AE9] text-[#ECC796] hover:bg-[#8F5AE9]/10 rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج آخر</span>
            </button>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <span className="text-[11px] text-[#A49EC0] font-bold block">إجمالي المستحق:</span>
                <span className="text-base font-black text-[#13DEB9]">
                  {totalAmount.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ECC796] hover:bg-[#ECC796]/90 text-[#1E1735] text-xs font-black transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>حفظ وترحيل المستحق</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* History Log Table */}
      <div className="bg-[#2F264C] rounded-xl border border-[#3D3554] overflow-hidden">
        <div className="p-4 border-b border-[#3D3554] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <History className="w-4 h-4 text-[#ECC796]" />
            <h4 className="text-xs font-bold">سجل العمليات السابقة للموظف</h4>
          </div>
        </div>

        <div className="overflow-x-auto">
          {historyLoading ? (
            <div className="p-8 flex justify-center items-center text-[#A49EC0]">
              <Loader2 className="w-6 h-6 animate-spin text-[#ECC796]" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A49EC0]">
              لا توجد سجلات إنتاج مسجلة لهذا الموظف حتى الآن
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-[#231B3D] text-[#A49EC0] font-bold border-b border-[#3D3554]">
                <tr>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">المنتج</th>
                  <th className="py-3 px-4">الكمية</th>
                  <th className="py-3 px-4">سعر القطعة</th>
                  <th className="py-3 px-4">الإجمالي</th>
                  <th className="py-3 px-4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3554]/40 text-white font-medium">
                {history.map(item => {
                  const itemDate = (item.work_date || item.date || '').split('T')[0];
                  const itemQty = Number(item.quantity ?? item.quantity_produced ?? 0);
                  const itemRate = Number(item.piece_rate ?? 0);
                  const itemTotal = Number(item.net_wage ?? item.gross_wage ?? item.total_amount ?? (itemQty * itemRate));

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-[#A49EC0] font-mono">{itemDate || '—'}</td>
                      <td className="py-3 px-4 font-bold text-white">{item.product?.name || '—'}</td>
                      <td className="py-3 px-4 font-bold text-[#ECC796] font-mono">{itemQty}</td>
                      <td className="py-3 px-4 font-mono">{itemRate.toLocaleString('ar-EG')} ج.م</td>
                      <td className="py-3 px-4 font-black text-[#13DEB9] font-mono">{itemTotal.toLocaleString('ar-EG')} ج.م</td>
                      <td className="py-3 px-4 text-[#A49EC0]">{item.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
