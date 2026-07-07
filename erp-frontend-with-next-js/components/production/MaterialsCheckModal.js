'use client';

import apiClient from '@/lib/api-client';
import { AlertTriangle, CheckCircle2, ShoppingCart, X, Play } from 'lucide-react';

export default function MaterialsCheckModal({ showCheck, setShowCheck, warehouses, fetchAll, setConfirmDialog }) {
  if (!showCheck) return null;

  const startOperation = async (id) => {
    setConfirmDialog({
      type: 'confirm',
      message: 'هل تريد صرف المواد والبدء بالإنتاج؟',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/operations/${id}/start`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll(); setShowCheck(null);
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في بدء عملية الإنتاج' });
        }
      }
    });
  };

  const autoProcure = async (suggestions, warehouseId) => {
    setConfirmDialog({
      type: 'confirm',
      message: 'هل تريد إنشاء أمر شراء تلقائي للمواد الناقصة؟',
      onConfirm: async () => {
        try {
          const supRes = await apiClient.get('/suppliers');
          const supplierId = supRes.data && supRes.data.length > 0 ? supRes.data[0].id : 1;

          const items = suggestions.map(s => ({
            material_id: s.material_id,
            quantity: s.shortage_qty,
            unit_cost: s.estimated_cost / Math.max(s.shortage_qty, 1)
          }));

          await apiClient.post('/purchase-orders', {
            supplier_id: supplierId,
            warehouse_id: warehouseId || 1,
            order_date: new Date().toISOString().split('T')[0],
            items,
            notes: 'طلب شراء تلقائي ناتج عن عجز مواد في خط الإنتاج'
          });
          setConfirmDialog({ type: 'alert', message: 'تم إنشاء أمر الشراء التلقائي بنجاح! يمكنك مراجعته في صفحة المشتريات.' });
          setShowCheck(null);
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء الشراء التلقائي' });
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b shrink-0" style={{ borderColor: '#3D3554' }}>
          <div>
            <h2 className="text-lg font-bold text-white">فحص توفر المواد الخام</h2>
            <p className="text-xs mt-1 text-gray-400">أمر: {showCheck.operation_number}</p>
          </div>
          <button onClick={() => setShowCheck(null)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="p-4 rounded-xl space-y-2 border" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <label className="block text-xs font-semibold text-gray-300">مستودع صرف المواد للعملية:</label>
            <div className="flex gap-2">
              <select
                value={showCheck.warehouse_id || ''}
                onChange={async (e) => {
                  const newWarehouseId = e.target.value;
                  if (!newWarehouseId) return;
                  try {
                    await apiClient.put(`/operations/${showCheck.operation_id}`, {
                      warehouse_id: parseInt(newWarehouseId)
                    });
                    const res = await apiClient.get(`/operations/${showCheck.operation_id}/check-materials`);
                    setShowCheck(res.data);
                    fetchAll();
                  } catch (err) {
                    setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء تعديل المستودع' });
                  }
                }}
                className="flex-1 rounded-lg px-3 py-2 text-xs border outline-none font-semibold text-white"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              >
                <option value="">اختر المستودع...</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>
          {showCheck.has_shortage ? (
            <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-400 text-sm">عجز في المواد الخام</h4>
                <p className="text-xs text-gray-300 mt-1">المخزون الحالي لا يكفي. يرجى توفير العجز أو استخدام الشراء التلقائي.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-green-400 text-sm">جميع المواد متوفرة</h4>
                <p className="text-xs text-gray-300 mt-1">المستودع جاهز لبدء الإنتاج.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">تفصيل المواد:</h3>
            {(showCheck.materials || []).map((m) => {
              const isShort = m.shortage_quantity > 0;
              return (
                <div key={m.id} className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: '#231B3D' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs mt-0.5 text-gray-400">{m.sku}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400">المطلوب: {m.required_quantity} {m.unit}</p>
                    <p className="text-xs text-gray-400">المتوفر: {m.available_quantity} {m.unit}</p>
                    {isShort && <p className="text-sm font-bold text-red-400 mt-1">العجز: -{m.shortage_quantity} {m.unit}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-3 shrink-0" style={{ borderColor: '#3D3554' }}>
          {showCheck.has_shortage && (showCheck.suggestions || []).length > 0 && (
            <div className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: '#231B3D' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-300">إنشاء طلب شراء للمواد الناقصة</span>
              </div>
              <button onClick={() => autoProcure(showCheck.suggestions, showCheck.warehouse_id)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shrink-0" style={{ background: '#D4A660' }}>
                شراء تلقائي
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button disabled={showCheck.has_shortage} onClick={() => startOperation(showCheck.operation_id)} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#10B981' }}>
              <Play className="w-4 h-4" /> بدء وصرف المواد
            </button>
            <button onClick={() => setShowCheck(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  );
}
