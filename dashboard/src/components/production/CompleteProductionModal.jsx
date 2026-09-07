'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { X, CheckCircle2, Trash2, AlertTriangle, Hammer, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function CompleteProductionModal({ showComplete, setShowComplete, materials, fetchAll }) {
  const { isLight } = useAppStore();
  const [wasteItems, setWasteItems] = useState([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [checkingReadiness, setCheckingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState('');

  useEffect(() => {
    if (showComplete) {
      setWasteItems([]);
      setMsg('');
      setReadiness(null);
      setReadinessError('');
      setCheckingReadiness(true);

      apiClient.get(`/operations/${showComplete.id}/readiness-check`)
        .then(res => {
          setReadiness(res.data);
        })
        .catch(err => {
          console.error(err);
          setReadinessError(err?.response?.data?.message || 'تعذر فحص جاهزية أمر التشغيل');
        })
        .finally(() => {
          setCheckingReadiness(false);
        });
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

  const handleComplete = async (e, autoProduceSubs = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!showComplete) return;

    // Filter out empty waste items
    const validWaste = wasteItems.filter(w => w.material_id && w.quantity);

    setSaving(true);
    setMsg('');
    try {
      const res = await apiClient.post(`/operations/${showComplete.id}/complete`, {
        waste_materials: validWaste,
        auto_produce_sub_products: autoProduceSubs
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

        {/* Readiness Check Banner */}
        {checkingReadiness && (
          <div className="p-3 rounded-xl mb-4 text-xs font-semibold text-center bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-[#A49EC0]">
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-[#ECC796] rounded-full animate-spin"></div>
            <span>جاري فحص جاهزية أمر التشغيل ومخزون المنتجات الفرعية والخامات...</span>
          </div>
        )}

        {readinessError && (
          <div className="p-3 rounded-xl mb-4 text-xs font-bold text-center bg-rose-500/15 text-rose-300 border border-rose-500/30">
            {readinessError}
          </div>
        )}

        {!checkingReadiness && readiness && (
          <>
            {/* Hard Block: Raw Materials Missing */}
            {(readiness.missing_materials?.length || 0) > 0 ? (
              <div className="p-3.5 rounded-xl mb-4 text-xs bg-rose-500/15 border border-rose-500/30 text-rose-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-rose-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>لا يمكن إتمام التصنيع — عجز في المواد الخام المطلوبة:</span>
                </div>
                <ul className="space-y-1 mr-1 text-[11px] list-disc list-inside">
                  {readiness.missing_materials.map((mat, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <strong className="text-white">{mat.material_name}</strong>: المطلوب {mat.required}، المتوفر {mat.available} <span className="font-bold text-rose-300">(ينقص {mat.shortage})</span>
                    </li>
                  ))}
                </ul>
                <div className="text-[10px] text-gray-300 border-t border-rose-500/20 pt-1.5 flex items-center gap-1">
                  <span>يرجى شراء أو توريد المواد الخام الناقصة إلى المخزن قبل إتمام هذا الأمر.</span>
                </div>
              </div>
            ) : (readiness.missing_sub_products?.length || 0) > 0 ? (
              /* Sub-Product Shortage with raw materials available: Suggest Auto-Produce */
              <div className="p-3.5 rounded-xl mb-4 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: نقص في المنتجات الفرعية بالمخزن (WSH-P)</span>
                </div>
                <ul className="space-y-1 mr-1 text-[11px] list-disc list-inside">
                  {readiness.missing_sub_products.map((sp, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <strong className="text-white">{sp.product_name}</strong>: المطلوب {sp.required}، المتوفر {sp.available} <span className="font-bold text-amber-300">(ينقص {sp.shortage})</span>
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-emerald-300 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>المواد الخام اللازمة لإنتاجها متوفرة في مخزن المواد الخام ✓</span>
                </div>
              </div>
            ) : readiness.can_complete ? (
              /* Fully Ready */
              <div className="p-3 rounded-xl mb-4 text-xs font-bold text-center bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {readiness.already_in_progress
                    ? 'تم صرف المواد والمنتجات الفرعية للتشغيل مسبقاً — العملية جاهزة للإتمام وتوريد المنتج التام ✓'
                    : 'كافة المنتجات الفرعية والمواد الخام متوفرة بالمخزن وجاهزة للإتمام ✓'}
                </span>
              </div>
            ) : null}
          </>
        )}

        <form onSubmit={(e) => handleComplete(e, false)} className="space-y-4">
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
            {(readiness?.missing_materials?.length || 0) > 0 ? (
              <div className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>الإتمام محظور لنقص المواد الخام</span>
              </div>
            ) : (readiness?.missing_sub_products?.length || 0) > 0 ? (
              <button
                type="button"
                onClick={(e) => handleComplete(e, true)}
                disabled={saving || checkingReadiness}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] text-[#201A30]"
                style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)' }}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <Hammer className="w-4 h-4 shrink-0" />
                )}
                <span>🔨 إنتاج الناقص وإتمام الطلبية</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || checkingReadiness}
                className="flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg disabled:opacity-50"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>تأكيد الإتمام وتوريد المنتجات</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowComplete(null)}
              className="px-6 py-3 rounded-xl text-xs font-bold transition-all border hover:bg-white/5"
              style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554', color: isLight ? '#64748B' : '#A49EC0' }}
            >
              {(readiness?.missing_materials?.length || 0) > 0 ? 'إغلاق' : 'إلغاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
