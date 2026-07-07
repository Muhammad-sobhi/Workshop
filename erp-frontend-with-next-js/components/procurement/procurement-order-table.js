'use client';

import { Eye } from 'lucide-react';

const statusColors = {
  Pending: { label: 'بانتظار الاستلام', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  Received: { label: 'تم الاستلام والمستند', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

export default function ProcurementOrderTable({ orders, loading, onViewOrder }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
      {loading ? (
        <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                {['رقم الفاتورة/الأمر', 'المورد', 'التاريخ', 'القيمة الإجمالية', 'المدفوع مقدماً', 'الدين المتبقي', 'حالة الطلب', 'الخيارات'].map(h => (
                  <th key={h} className="text-right px-4 py-4 text-xs font-semibold uppercase" style={{ color: '#A49EC0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(po => {
                const st = statusColors[po.status] || { label: po.status, color: '#A49EC0', bg: '#3D3554' };
                return (
                  <tr key={po.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: '#3D3554' }}>
                    <td className="px-4 py-3 font-mono text-xs text-white">{po.order_number}</td>
                    <td className="px-4 py-3 font-medium text-white">{po.supplier_name}</td>
                    <td className="px-4 py-3" style={{ color: '#D4CEEB' }}>{new Date(po.order_date).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-3 font-semibold text-white">EGP {Number(po.total_amount).toLocaleString('ar-SA')}</td>
                    <td className="px-4 py-3">
                      {po.deposit_paid > 0 ? (
                        <span className="font-semibold" style={{ color: '#10B981' }}>EGP {Number(po.deposit_paid).toLocaleString('ar-SA')}</span>
                      ) : (
                        <span style={{ color: '#A49EC0' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const debt = Number(po.total_amount) - Number(po.deposit_paid || 0);
                        return debt > 0 ? (
                          <span className="font-bold" style={{ color: '#EF4444' }}>EGP {debt.toLocaleString('ar-SA')}</span>
                        ) : (
                          <span className="font-semibold" style={{ color: '#10B981' }}>مسدد بالكامل</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewOrder(po)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5"
                        style={{ borderColor: '#ECC796', color: '#ECC796' }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        تفاصيل الاستلام
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد طلبات شراء مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
