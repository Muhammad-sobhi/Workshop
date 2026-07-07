'use client';

import { X, CheckCircle2 } from 'lucide-react';

export default function OrderViewModal({ viewOrder, onClose, onReceive }) {
  if (!viewOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تفاصيل أمر الشراء">
      <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b shrink-0" style={{ borderColor: '#3D3554' }}>
          <div>
            <h2 className="text-lg font-bold text-white">تفاصيل أمر الشراء: {viewOrder.order_number}</h2>
            <p className="text-xs mt-1 text-gray-400">المورد: {viewOrder.supplier?.name} • تاريخ الطلب: {new Date(viewOrder.order_date).toLocaleDateString('ar-SA')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                <th className="py-2 text-gray-400">المادة الخام</th>
                <th className="py-2 text-gray-400">الكمية</th>
                <th className="py-2 text-gray-400">التكلفة للوحدة</th>
                <th className="py-2 text-gray-400 text-left">التكلفة الإجمالية</th>
              </tr>
            </thead>
            <tbody>
              {viewOrder.items?.map((item) => (
                <tr key={item.id} className="border-b" style={{ borderColor: '#3D3554' }}>
                  <td className="py-3 font-semibold text-white">
                    {item.material?.name}
                    <p className="text-[10px] text-gray-400 font-normal">{item.material?.sku}</p>
                  </td>
                  <td className="py-3 text-white">{item.quantity} {item.material?.unit}</td>
                  <td className="py-3 text-white">EGP {Number(item.unit_cost || 0).toFixed(2)}</td>
                  <td className="py-3 font-bold text-white text-left">EGP {Number(item.total_cost || 0).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {viewOrder.notes && (
            <div className="p-3 rounded-lg" style={{ background: '#231B3D' }}>
              <p className="text-xs text-gray-400">ملاحظات الفاتورة:</p>
              <p className="text-sm mt-1 text-white">{viewOrder.notes}</p>
            </div>
          )}

          <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: '#231B3D' }}>
            <span className="text-sm text-gray-400">القيمة الإجمالية للفاتورة</span>
            <span className="text-lg font-bold" style={{ color: '#ECC796' }}>EGP {Number(viewOrder.total_amount || 0).toLocaleString('ar-SA')}</span>
          </div>
        </div>

        <div className="pt-4 border-t flex gap-2 shrink-0" style={{ borderColor: '#3D3554' }}>
          {viewOrder.status !== 'Received' ? (
            <button
              onClick={() => onReceive(viewOrder.id)}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{ background: '#10B981' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              استلام الشحنة وتوريدها للمخازن
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
              تم استلام البضائع وتحديث المخزون بنجاح
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-28 py-2.5 rounded-xl font-semibold text-sm border"
            style={{ borderColor: '#3D3554', color: '#A49EC0' }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
