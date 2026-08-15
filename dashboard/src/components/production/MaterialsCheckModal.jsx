'use client';

import apiClient from '@/lib/api-client';
import { AlertTriangle, CheckCircle2, X, Play } from 'lucide-react';

export default function MaterialsCheckModal({ showCheck, setShowCheck, warehouses, fetchAll, setConfirmDialog }) {
  if (!showCheck) return null;

  // Filter out finished products warehouse (WH-FIN) — only show materials warehouses
  const materialWarehouses = warehouses.filter(wh => wh.code !== 'WH-FIN' && wh.code !== 'WSH' && !wh.name.includes('منتج'));

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
                {materialWarehouses.map(wh => (
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
                <p className="text-xs text-gray-300 mt-1">المخزون الحالي لا يكفي. يرجى توفير المواد الناقصة من صفحة المشتريات أولاً.</p>
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

          {/* Products Allocation Breakdown */}
          {Array.isArray(showCheck.products_allocation) && showCheck.products_allocation.length > 0 && (
            <div className="p-3.5 rounded-xl border space-y-2" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>توزيع الكميات المطلوبة وخطة السحب من المخزون:</span>
              </h4>
              <div className="space-y-1.5">
                {showCheck.products_allocation.map((pa, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#2F264C]">
                    <span className="font-semibold text-white">{pa.product_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">الإجمالي: <strong>{pa.total_quantity} {pa.unit}</strong></span>
                      {pa.quantity_from_stock > 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          📦 {pa.quantity_from_stock} من المخزن
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ⚙️ {pa.quantity_to_manufacture} تصنيع جديد
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#A49EC0]">
                * المواد الخام المحسوبة بالأسفل تم تخصيصها فقط للكميات المطلوب تصنيعها جديداً دون استهلاك خامات للكميات المسحوبة من المخزن.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">تفصيل المواد الخام المطلوبة:</h3>
            {(!showCheck.materials || showCheck.materials.length === 0) ? (
              <div className="p-4 rounded-xl text-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <p className="font-bold">📦 لا توجد خامات مطلوبة للصرف</p>
                <p className="text-gray-300">جميع كميات هذه الطلبية تم تخصيصها وسحبها من المخزن وجاهزة للتسليم للعميل مباشرة.</p>
              </div>
            ) : (
              showCheck.materials.map((m) => {
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
              })
            )}
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-3 shrink-0" style={{ borderColor: '#3D3554' }}>
          <div className="flex gap-2">
            {(!showCheck.materials || showCheck.materials.length === 0) ? (
              <button
                onClick={async () => {
                  try {
                    await apiClient.post(`/operations/${showCheck.operation_id}/complete`);
                    fetchAll();
                    setShowCheck(null);
                  } catch (err) {
                    setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل التحديث' });
                  }
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 bg-emerald-600 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> تجهيز وتأكيد للتسليم الفوري
              </button>
            ) : (
              <button
                disabled={showCheck.has_shortage}
                onClick={() => startOperation(showCheck.operation_id)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#10B981' }}
              >
                <Play className="w-4 h-4" /> بدء وصرف المواد
              </button>
            )}
            <button onClick={() => setShowCheck(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  );
}
