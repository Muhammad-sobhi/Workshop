'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { X, CheckCircle2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function CompleteProductionModal({ showComplete, setShowComplete, materials, fetchAll }) {
  const { isLight } = useAppStore();
  const [wasteItems, setWasteItems] = useState([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showComplete) {
      setWasteItems([]);
      setMsg('');
    }
  }, [showComplete]);

  const handleAddWaste = () => {
    setWasteItems([...wasteItems, { material_id: '', quantity: '', notes: '' }]);
  };

  const handleRemoveWaste = (idx) => {
    setWasteItems(wasteItems.filter((_, i) => i !== idx));
  };

  const handleWasteChange = (idx, field, val) => {
    const updated = [...wasteItems];
    updated[idx][field] = val;
    setWasteItems(updated);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!showComplete) return;

    // Filter out empty waste items
    const validWaste = wasteItems.filter(w => w.material_id && w.quantity);

    setSaving(true);
    setMsg('');
    try {
      const res = await apiClient.post(`/operations/${showComplete.id}/complete`, {
        waste_materials: validWaste
      });
      setMsg(res.data.message || 'تم بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowComplete(null);
        setMsg('');
        setWasteItems([]);
      }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'فشل في إكمال عملية الإنتاج');
    } finally {
      setSaving(false);
    }
  };

  if (!showComplete) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" 
        style={{ 
          background: isLight ? '#FFFFFF' : '#2F264C', 
          borderColor: isLight ? '#EBF0FF' : '#3D3554' 
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
              إتمام الإنتاج وتسجيل هالك (اختياري)
            </h2>
            <p className="text-xs mt-1" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
              أمر رقم {showComplete.operation_number}
            </p>
          </div>
          <button 
            onClick={() => setShowComplete(null)} 
            className="p-2 rounded-xl hover:bg-black/5 transition-all"
            style={{ color: isLight ? '#64748B' : '#A49EC0' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-bold text-center ${msg.includes('نجاح') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
            {msg}
          </div>
        )}

        <form onSubmit={handleComplete} className="space-y-4">
          <div className="p-4 rounded-xl border" style={{ background: isLight ? '#F8FAFC' : '#231B3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-amber-500">تسجيل هالك المواد (WSH-WASTE)</h3>
              <button
                type="button"
                onClick={handleAddWaste}
                className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-all"
              >
                + إضافة صنف هالك
              </button>
            </div>
            
            {wasteItems.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: isLight ? '#94A3B8' : '#A49EC0' }}>
                لا يوجد هالك مسجل لهذه العملية. يمكنك إضافة خامات تالفة إن وجدت.
              </p>
            ) : (
              <div className="space-y-3">
                {wasteItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <select
                      value={item.material_id}
                      onChange={e => handleWasteChange(idx, 'material_id', e.target.value)}
                      required
                      className="w-full sm:flex-1 rounded-xl px-3 py-2 text-xs border outline-none font-bold"
                      style={{ background: isLight ? '#FFFFFF' : '#2F264C', borderColor: isLight ? '#EBF0FF' : '#3D3554', color: isLight ? '#1E293B' : '#FFFFFF' }}
                    >
                      <option value="">اختر الخامة التالفة</option>
                      {materials.filter(m => m.type !== 'service').map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit}) - مخزون: {m.stock_quantity}</option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={e => handleWasteChange(idx, 'quantity', e.target.value)}
                      required
                      placeholder="الكمية"
                      className="w-full sm:w-24 rounded-xl px-3 py-2 text-xs border outline-none font-bold text-center"
                      style={{ background: isLight ? '#FFFFFF' : '#2F264C', borderColor: isLight ? '#EBF0FF' : '#3D3554', color: isLight ? '#1E293B' : '#FFFFFF' }}
                    />
                    
                    <input
                      type="text"
                      value={item.notes}
                      onChange={e => handleWasteChange(idx, 'notes', e.target.value)}
                      placeholder="ملاحظات (سبب التلف)"
                      className="w-full sm:flex-1 rounded-xl px-3 py-2 text-xs border outline-none font-bold"
                      style={{ background: isLight ? '#FFFFFF' : '#2F264C', borderColor: isLight ? '#EBF0FF' : '#3D3554', color: isLight ? '#1E293B' : '#FFFFFF' }}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveWaste(idx)}
                      className="p-2 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all border border-rose-500/20 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <CheckCircle2 className="w-4 h-4" />}
              <span>تأكيد الإتمام وتوريد المنتجات</span>
            </button>
            <button
              type="button"
              onClick={() => setShowComplete(null)}
              className="px-6 py-3 rounded-xl text-xs font-bold transition-all border hover:bg-white/5"
              style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554', color: isLight ? '#64748B' : '#A49EC0' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
