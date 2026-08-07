'use client';

import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';

export default function PrintVoucherModal({ isOpen, onClose, order }) {
  const printRef = useRef(null);
  const { settings } = useAppStore();

  if (!isOpen || !order) return null;

  const logoUrl = getImageUrl(settings?.logo_path);
  const companyName = settings?.company_name || 'الورشة الفنية لتصنيع الأثاث والكرسي';
  const phone = settings?.phone || '';
  const address = settings?.address || '';

  const totalCost = parseFloat(order.total_cost || 0);
  const totalPaid = parseFloat(order.total_paid || 0);
  const balance = totalCost - totalPaid;

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>إيصال أمر تشغيل خارجي - ${order.order_number}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            body { font-family: 'Cairo', sans-serif; background: #fff; color: #111; padding: 20px; font-size: 13px; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 20px; }
            .header-info { text-align: right; }
            .header-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0; }
            .logo { max-height: 60px; object-fit: contain; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: #f3f4f6; border: 1px solid #d1d5db; font-weight: 700; font-size: 12px; }
            .box-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #f9fafb; text-align: center; }
            .box-title { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
            .box-value { font-size: 16px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: right; }
            th { background: #f3f4f6; font-weight: 700; font-size: 12px; }
            .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; pt: 15px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; color: #4b5563; }
            .stamp-box { height: 60px; border: 1px dashed #9ca3af; border-radius: 8px; margin-top: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 10px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#3D3554] bg-[#2F264C] text-white p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#3D3554] pb-3">
          <h3 className="font-bold text-lg text-[#ECC796]">معاينة وتصدير أمر التشغيل PDF</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ECC796] text-[#201A30] shadow hover:opacity-90"
            >
              <Printer className="w-4 h-4" />
              طباعة الآن
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-[#231B3D] text-[#A49EC0] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable View Container */}
        <div className="bg-white text-slate-900 p-6 rounded-xl overflow-y-auto max-h-[70vh]" ref={printRef}>
          <div className="header">
            <div className="header-info">
              <h1 className="header-title">{companyName}</h1>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '11px' }}>
                {address} {phone ? `| هاتف: ${phone}` : ''}
              </p>
            </div>
            {logoUrl && <img src={logoUrl} alt="Logo" className="logo" />}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0', color: '#111827' }}>
                إيصال / بيان أمر تشغيل خارجي
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#4b5563' }}>
                رقم الأمر: <strong>{order.order_number}</strong> | التاريخ: <strong>{order.sent_date}</strong>
              </p>
            </div>
            <div className="badge" style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
              المورد: {order.supplier?.name}
            </div>
          </div>

          {/* Details Table */}
          <table>
            <thead>
              <tr>
                <th>بيان الخدمة / الصنف</th>
                <th>الكمية المرسلة</th>
                <th>تكلفة الوحدة</th>
                <th>التكلفة الإجمالية</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: '700' }}>{order.item_description}</td>
                <td>{order.quantity} {order.unit}</td>
                <td>{parseFloat(order.unit_cost).toFixed(2)} EGP</td>
                <td style={{ fontWeight: '800', color: '#1e1b4b' }}>{parseFloat(order.total_cost).toFixed(2)} EGP</td>
              </tr>
            </tbody>
          </table>

          {/* Summary Boxes */}
          <div className="box-grid">
            <div className="box">
              <div className="box-title">إجمالي التكلفة</div>
              <div className="box-value" style={{ color: '#1f2937' }}>
                EGP {totalCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="box">
              <div className="box-title">إجمالي المسدد</div>
              <div className="box-value" style={{ color: '#059669' }}>
                EGP {totalPaid.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="box">
              <div className="box-title">{balance > 0 ? 'المتبقي (دين)' : 'الرصيد الدائن'}</div>
              <div className="box-value" style={{ color: balance > 0 ? '#dc2626' : '#059669' }}>
                EGP {Math.abs(balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Payment Log Table */}
          <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: '#374151' }}>
            سجل المدفوعات والتحويلات المباشرة:
          </h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>وسيلة الدفع</th>
                <th>رقم المرجع / Instapay</th>
                <th>المبلغ المدفوع</th>
              </tr>
            </thead>
            <tbody>
              {order.payments && order.payments.length > 0 ? (
                order.payments.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td>{idx + 1}</td>
                    <td>{p.payment_date}</td>
                    <td>{p.payment_method === 'instapay' ? 'انستا باي Instapay' : p.payment_method === 'vodafone_cash' ? 'فودافون كاش' : p.payment_method === 'cash' ? 'نقداً' : 'تحويل بنكي'}</td>
                    <td>{p.transaction_reference || '—'}</td>
                    <td style={{ fontWeight: '700', color: '#059669' }}>EGP {parseFloat(p.amount).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af' }}>لا توجد مدفوعات مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>

          {order.notes && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#4b5563' }}>
              <strong>ملاحظات:</strong> {order.notes}
            </div>
          )}

          <div className="footer">
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', margin: '0' }}>توقيع واستلام الورشة / المورد</p>
              <div className="stamp-box">التوقيع والخاتم</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', margin: '0' }}>يعتمد مسؤول الورشة</p>
              <div className="stamp-box">الإدارة والاعتماد</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
