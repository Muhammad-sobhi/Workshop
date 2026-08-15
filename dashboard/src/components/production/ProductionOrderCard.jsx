'use client';

import React from 'react';
import {
  CheckCircle2,
  Info,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Wrench,
  Truck,
  Printer,
  Calendar,
  Building2,
  Trash2,
  AlertTriangle,
  Package,
  Layers
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';

const statusConfig = {
  Pending: { label: 'قيد الانتظار', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
  In_Progress: { label: 'قيد التصنيع', color: '#8D7EC8', bg: 'rgba(141, 126, 200, 0.15)', border: 'rgba(141, 126, 200, 0.3)' },
  Completed: { label: 'جاهز في المخزن', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  Delivered: { label: 'تم التسليم للعميل', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
  Cancelled: { label: 'ملغي', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
};

export default function ProductionOrderCard({
  op,
  currency = 'EGP',
  totalPaid,
  remaining,
  expandedOp,
  onToggleExpand,
  onCheck,
  onComplete,
  onShowPayment,
  onCancel,
  onDelete,
  onCreateExternalService,
  onDeliver,
  onDeletePayment
}) {
  const { settings } = useAppStore();
  const st = statusConfig[op.status] || { label: op.status, color: '#A49EC0', bg: '#3D3554', border: '#3D3554' };
  const paid = totalPaid ? totalPaid(op) : (parseFloat(op.deposit_paid) || 0);
  const rem = remaining ? remaining(op) : (parseFloat(op.total_price) || 0) - paid;
  const isExpanded = expandedOp === op.id;
  const products = op.operation_products || [];

  // Print Official Production Order Voucher (كارت تشغيل وتصنيع رسمي للعمال والفنيين)
  const printProductionOrderPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentSettings = settings || useAppStore.getState?.()?.settings || {};
    const companyName = currentSettings.company_name || 'ورشة الأثاث الحديث';
    const companyPhone = currentSettings.phone || '';
    const companyAddress = currentSettings.address || '';
    const companyLogo = currentSettings.logo_path ? getImageUrl(currentSettings.logo_path) : '';
    const invoiceFooter = currentSettings.invoice_footer || 'يرجى الالتزام بمعايير الجودة ومطابقة الرسومات الهندسية';

    let productRowsHtml = '';
    products.forEach((p, idx) => {
      const taken = parseFloat(p.quantity_taken_from_stock) || 0;
      const totalQty = parseFloat(p.quantity) || 0;
      const toProduce = Math.max(0, totalQty - taken);

      productRowsHtml += `
        <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
          <td style="padding: 9px 12px; text-align: center; color: #64748B; width: 8%;">${idx + 1}</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #0F172A; width: 42%;">${p.product?.name || 'منتج'}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: bold; color: #1E1B4B; width: 25%;">${totalQty} ${p.product?.unit || 'وحدة'}</td>
          <td style="padding: 9px 12px; text-align: center; color: #475569; width: 25%;">
            ${taken > 0 ? `<span style="color:#D97706; font-weight:bold;">${taken} جاهز بالمخزن</span><br>` : ''}
            <span style="color:#16A34A; font-weight:bold;">${toProduce} قيد التصنيع بالورشة</span>
          </td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>كارت أمر تشغيل وإنتاج - ${op.operation_number}</title>
        <style>
          @media print {
            @page { size: A4; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0F172A; line-height: 1.5; background: #fff; direction: rtl; text-align: right; }
          .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1E1B4B; padding-bottom: 12px; margin-bottom: 15px; }
          .workshop-info h1 { margin: 0; font-size: 20px; font-weight: 900; color: #1E1B4B; }
          .workshop-info p { margin: 2px 0 0 0; font-size: 11px; color: #64748B; font-weight: 500; }
          .doc-info { text-align: left; }
          .doc-info h2 { margin: 0; font-size: 16px; font-weight: 800; color: #8D7EC8; }
          .doc-info p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; }
          
          .info-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 15px; }
          .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 8px; text-align: right; }
          .info-card p { margin: 0; font-size: 10px; color: #64748B; font-weight: 600; }
          .info-card h4 { margin: 2px 0 0 0; font-size: 12px; font-weight: 800; color: #0F172A; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background-color: #1E1B4B; color: #ffffff; padding: 8px 10px; text-align: center; font-size: 11px; font-weight: bold; }
          
          .summary-box { margin-top: 15px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
          .summary-item label { display: block; font-size: 10px; color: #64748B; font-weight: bold; margin-bottom: 2px; }
          .summary-item span { font-size: 14px; font-weight: 900; }
          
          .footer-box { margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          .terms-text { font-size: 10px; color: #475569; margin-bottom: 15px; text-align: center; font-weight: 500; }
          .signatures { display: flex; justify-content: space-between; padding: 0 40px; margin-top: 20px; }
          .sig-box { text-align: center; font-size: 11px; font-weight: bold; color: #334155; }
          .sig-line { width: 140px; border-bottom: 1px dashed #94A3B8; margin-top: 35px; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${companyLogo ? `<img src="${companyLogo}" style="max-height: 55px; max-width: 120px; object-fit: contain;" />` : ''}
            <div class="workshop-info">
              <h1>${companyName}</h1>
              ${companyPhone ? `<p>📞 هاتف: ${companyPhone}</p>` : ''}
              ${companyAddress ? `<p>📍 ${companyAddress}</p>` : ''}
            </div>
          </div>

          <div class="doc-info">
            <h2>كارت أمر تشغيل وإنتاج (Production Order)</h2>
            <p><strong>رقم الأمر:</strong> ${op.operation_number}</p>
            <p><strong>تاريخ الأمر:</strong> ${op.start_date || (op.created_at ? op.created_at.substring(0, 10) : new Date().toLocaleDateString('ar-EG'))}</p>
            <p><strong>الحالة:</strong> ${st.label}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <p>الجهة الطالبة / العميل</p>
            <h4>${op.client ? op.client.name : '📦 تصنيع كمخزون للمعرض'}</h4>
            ${op.client?.phone ? `<span style="font-size: 10px; color: #64748B;">الهاتف: ${op.client.phone}</span>` : ''}
          </div>

          <div class="info-card">
            <p>مستودع الوجهة / الصرف</p>
            <h4>${op.warehouse?.name || 'مستودع الورشة الرئيسي'}</h4>
          </div>

          <div class="info-card" style="border-right: 4px solid ${rem > 0 ? '#EF4444' : '#10B981'};">
            <p>${rem > 0 ? 'المتبقي المالي المستحق' : 'الحساب المالي مسدد'}</p>
            <h4 style="color: ${rem > 0 ? '#DC2626' : '#059669'};">
              ${rem.toFixed(2)} ${currency}
            </h4>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="text-align: right; width: 42%;">اسم المنتج / الموديل المطلوبة تصنيعه</th>
              <th style="width: 25%;">الكمية الإجمالية</th>
              <th style="width: 25%;">حالة التجهيز</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml}
          </tbody>
        </table>

        ${op.notes ? `
          <div style="margin-top: 15px; padding: 10px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; font-size: 11px; color: #92400E;">
            <strong>ملاحظات ومواصفات خاصة:</strong> ${op.notes}
          </div>
        ` : ''}

        <div class="footer-box">
          <p class="terms-text">${invoiceFooter}</p>
          
          <div class="signatures">
            <div class="sig-box">
              <span>توقيع المشرف الفني والتشغيل</span>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <span>اعتماد استلام المستودع / الجودة</span>
              <div class="sig-line"></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div
      className="rounded-2xl border transition-all duration-200 hover:border-[#ECC796]/40 shadow-lg relative overflow-hidden flex flex-col justify-between"
      style={{ background: '#201A30', borderColor: '#3D3554' }}
    >
      {/* Top Header Card Info */}
      <div className="p-4 space-y-3">
        {/* Row 1: Order Ref & Status Badge */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-sm tracking-wide text-[#ECC796]">{op.operation_number}</span>
          </div>
          <span
            className="px-2.5 py-0.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 shadow-sm"
            style={{ background: st.bg, color: st.color, borderColor: st.border }}
          >
            {st.label}
          </span>
        </div>

        {/* Row 2: Client & Warehouse */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              {op.client ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#ECC796]"></span>
                  <span>{op.client.name}</span>
                </>
              ) : (
                <span className="text-emerald-400 font-semibold">📦 تخزين كمخزون</span>
              )}
            </h4>
            <p className="text-[11px] text-[#A49EC0] mt-0.5 flex items-center gap-1">
              <span>المستودع:</span>
              <strong className="text-gray-300 font-normal">{op.warehouse?.name || 'الورشة الرئيسية'}</strong>
            </p>
          </div>

          {op.created_at && (
            <div className="text-left shrink-0">
              <span className="text-[10px] text-[#A49EC0] block">تاريخ الإنشاء</span>
              <span className="text-xs font-mono text-gray-300">{op.start_date || op.created_at.substring(0, 10)}</span>
            </div>
          )}
        </div>

        {/* Row 3: Product details chips */}
        <div className="pt-1">
          {products.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {products.map((p, idx) => {
                const taken = parseFloat(p.quantity_taken_from_stock) || 0;
                return (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-[#2F264C] text-gray-200 border border-[#3D3554]"
                  >
                    <span className="font-semibold">{p.product?.name || 'منتج'}</span>
                    <span className="font-bold text-[#ECC796]">({parseFloat(p.quantity)} {p.product?.unit || 'وحدة'})</span>
                    {taken > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        {taken} مخزن
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-[#A49EC0]">لا توجد منتجات محددة</span>
          )}
        </div>

        {/* Row 4: Financial Summary Box */}
        {op.total_price ? (
          <div className="rounded-xl p-2.5 border bg-[#2F264C] border-[#3D3554] flex items-center justify-between text-center">
            <div className="flex-1">
              <span className="block text-[10px] text-[#A49EC0] font-semibold">إجمالي الطلب</span>
              <span className="font-extrabold text-xs text-white">
                {parseFloat(op.total_price).toLocaleString('ar-EG')} <small className="text-[9px] font-normal">{currency}</small>
              </span>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="flex-1">
              <span className="block text-[10px] text-[#A49EC0] font-semibold">المدفوع</span>
              <span className="font-extrabold text-xs text-emerald-400">
                {paid.toLocaleString('ar-EG')} <small className="text-[9px] font-normal">{currency}</small>
              </span>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="flex-1">
              <span className="block text-[10px] text-[#A49EC0] font-semibold">المتبقي</span>
              <span className={`font-black text-xs ${rem > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {rem.toLocaleString('ar-EG')} <small className="text-[9px] font-normal">{currency}</small>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action Footer Bar */}
      <div className="p-3 bg-[#231B3D] border-t border-[#3D3554] space-y-2">
        {/* Primary Action Button (Prominent & Clear) */}
        <div>
          {op.status === 'Pending' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onCheck && onCheck(op)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 hover:bg-white/5 text-[#ECC796] border-[#ECC796]/40"
              >
                <Info className="w-3.5 h-3.5" />
                <span>فحص وبدء</span>
              </button>
              <button
                onClick={() => onComplete && onComplete(op.id)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:opacity-90 bg-emerald-600 text-white shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>إتمام التصنيع</span>
              </button>
            </div>
          )}

          {op.status === 'In_Progress' && (
            <button
              onClick={() => onComplete && onComplete(op.id)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 hover:opacity-90 bg-emerald-600 text-white shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>إتمام التصنيع وتوريد للمخزن</span>
            </button>
          )}

          {op.status === 'Completed' && op.client_id ? (
            <button
              onClick={() => onDeliver && onDeliver(op)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 hover:opacity-90 bg-blue-600 text-white shadow-md"
              title="تسليم المنتجات المصنعة من المخزن إلى العميل"
            >
              <Truck className="w-4 h-4" />
              <span>تسليم للعميل الآن</span>
            </button>
          ) : op.status === 'Completed' && !op.client_id ? (
            <div className="w-full py-2 px-3 rounded-xl text-xs font-bold text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              📦 جاهز بالمخزن ومتاح للبيع
            </div>
          ) : null}

          {op.status === 'Delivered' && (
            <div className="w-full py-2 px-3 rounded-xl text-xs font-bold text-center bg-blue-500/10 text-blue-400 border border-blue-500/20">
              ✓ تم تسليم الطلبية للعميل بنجاح
            </div>
          )}
        </div>

        {/* Secondary Actions Row */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* PDF Production Card */}
            <button
              onClick={printProductionOrderPdf}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#2F264C] text-[#ECC796] hover:bg-white/10 border border-[#ECC796]/30 transition-all"
              title="طباعة كارت أمر التشغيل والتصنيع للورشة"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF كارت تشغيل</span>
            </button>

            {/* External Service */}
            {op.status !== 'Cancelled' && (
              <button
                onClick={() => onCreateExternalService && onCreateExternalService(op)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#2F264C] text-gray-300 hover:bg-white/10 border border-[#3D3554] transition-all"
                title="إرسال جزء لورشة خارجية للتشغيل أو الدهان"
              >
                <Wrench className="w-3 h-3 text-[#ECC796]" />
                <span>+ ورشة خارجية</span>
              </button>
            )}

            {/* Payment Button */}
            {op.status !== 'Cancelled' && op.client_id && rem > 0 && (
              <button
                onClick={() => onShowPayment && onShowPayment(op)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#2F264C] text-purple-300 hover:bg-purple-500/10 border border-purple-500/30 transition-all"
                title="سداد دفعة جديدة من العميل"
              >
                <CreditCard className="w-3 h-3" />
                <span>سداد دفعة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Cancel */}
            {op.status !== 'Cancelled' && op.status !== 'Delivered' && (
              <button
                onClick={() => onCancel && onCancel(op.id)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                title="إلغاء أمر التشغيل"
              >
                إلغاء
              </button>
            )}

            {/* Delete */}
            {op.status !== 'Completed' && op.status !== 'Delivered' && (
              <button
                onClick={() => onDelete && onDelete(op.id)}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                title="حذف نهائي"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Toggle Drawer */}
            <button
              onClick={() => onToggleExpand && onToggleExpand(isExpanded ? null : op.id)}
              className="p-1.5 rounded-lg text-[#A49EC0] hover:bg-white/10 transition-colors"
              title={isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل والمدفوعات'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4 text-[#ECC796]" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Expanded Drawer */}
      {isExpanded && (
        <div className="border-t px-4 py-4 space-y-4 bg-[#2F264C] border-[#3D3554]">
          {/* Detailed Product Breakdown */}
          {products.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 text-[#A49EC0]">تفاصيل خطة التصنيع والمخزون</p>
              <div className="space-y-1.5">
                {products.map(p => {
                  const taken = parseFloat(p.quantity_taken_from_stock) || 0;
                  const totalQty = parseFloat(p.quantity) || 0;
                  const toProduce = Math.max(0, totalQty - taken);

                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs rounded-xl px-3 py-2 bg-[#231B3D] border border-white/5">
                      <span className="text-white font-medium">{p.product?.name}</span>
                      <div className="flex items-center gap-2">
                        {taken > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            📦 {taken} مسحوب من المخزن
                          </span>
                        )}
                        <span className="font-bold text-[#ECC796]">
                          {taken > 0 ? (toProduce > 0 ? `⚙️ ${toProduce} تصنيع متبقي` : 'جاهز بالكامل') : `${totalQty} ${p.product?.unit || 'وحدة'}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment History */}
          {op.total_price && (
            <div>
              <p className="text-xs font-semibold mb-2 text-[#A49EC0]">سجل الدفعات والتحصيل</p>
              <div className="rounded-xl p-3 space-y-2 bg-[#231B3D] border border-white/5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A49EC0]">إجمالي الطلب</span>
                  <span className="font-bold text-white">{parseFloat(op.total_price).toFixed(2)} {currency}</span>
                </div>
                {op.deposit_paid ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A49EC0]">العربون المسدد</span>
                    <span className="font-bold text-emerald-400">{parseFloat(op.deposit_paid).toFixed(2)} {currency}</span>
                  </div>
                ) : null}
                {(op.payments || []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#A49EC0]">{p.notes || `دفعة ${i + 1}`} - {p.payment_date}</span>
                      {onDeletePayment && (
                        <button
                          type="button"
                          onClick={() => onDeletePayment(op.id, p.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/40 border border-red-500/30 transition-colors"
                          title="تراجع عن هذه الدفعة"
                        >
                          ↩ تراجع
                        </button>
                      )}
                    </div>
                    <span className="text-sm font-bold text-emerald-400">{parseFloat(p.amount_paid).toFixed(2)} {currency}</span>
                  </div>
                ))}
                {rem > 0 && (
                  <div className="flex justify-between text-xs border-t pt-2 border-[#3D3554]">
                    <span className="font-bold text-red-400">المتبقي النهائي</span>
                    <span className="font-bold text-red-400">{rem.toFixed(2)} {currency}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {op.notes && (
            <div className="text-xs rounded-xl px-3 py-2 bg-[#231B3D] text-[#A49EC0] border border-white/5">
              <strong>ملاحظات:</strong> {op.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
