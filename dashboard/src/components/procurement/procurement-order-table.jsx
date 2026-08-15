'use client';

import React, { useState, useMemo } from 'react';
import { Eye, Trash2, Printer, Search, CheckCircle2, Clock, AlertTriangle, Package, Filter, ArrowUpDown } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';

const statusColors = {
  Pending: { label: 'بانتظار الاستلام', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  Received: { label: 'تم الاستلام بالمخزن', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
};

export default function ProcurementOrderTable({
  orders = [],
  suppliers = [],
  loading = false,
  onViewOrder,
  onEditOrder,
  onDeleteOrder,
  onReceiveOrder
}) {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'received' | 'debt'

  // Counts for pills
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const receivedCount = orders.filter(o => o.status === 'Received').length;
  const debtCount = orders.filter(o => {
    const tot = parseFloat(o.total_amount) || 0;
    const dep = parseFloat(o.deposit_paid) || 0;
    return (tot - dep) > 0;
  }).length;

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      // Status filter
      if (statusFilter === 'pending' && po.status !== 'Pending') return false;
      if (statusFilter === 'received' && po.status !== 'Received') return false;
      if (statusFilter === 'debt') {
        const debt = (parseFloat(po.total_amount) || 0) - (parseFloat(po.deposit_paid) || 0);
        if (debt <= 0) return false;
      }

      // Supplier filter
      if (selectedSupplier !== 'all' && String(po.supplier_id) !== String(selectedSupplier)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = po.order_number?.toLowerCase().includes(q);
        const suppMatch = po.supplier_name?.toLowerCase().includes(q);
        const notesMatch = po.notes?.toLowerCase().includes(q);
        const itemsMatch = po.items?.some(i => i.material_name?.toLowerCase().includes(q));
        if (!numMatch && !suppMatch && !notesMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, selectedSupplier, searchQuery]);

  // Official PO PDF Generator
  const printPurchaseOrderPdf = (po) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentSettings = settings || useAppStore.getState?.()?.settings || {};
    const companyName = currentSettings.company_name || 'ورشة الأثاث الحديث';
    const companyPhone = currentSettings.phone || '';
    const companyAddress = currentSettings.address || '';
    const companyTaxId = currentSettings.tax_number || '';
    const companyLogo = currentSettings.logo_path ? getImageUrl(currentSettings.logo_path) : '';
    const invoiceFooter = currentSettings.invoice_footer || 'شكراً لتعاملكم معنا • يرجى الالتزام بمطابقة المواصفات القياسية';

    const items = po.items || [];
    const totalAmount = parseFloat(po.total_amount) || 0;
    const depositPaid = parseFloat(po.deposit_paid) || 0;
    const remainingDebt = Math.max(0, totalAmount - depositPaid);

    let rowsHtml = '';
    items.forEach((itm, idx) => {
      const uPrice = parseFloat(itm.unit_cost) || 0;
      const tPrice = parseFloat(itm.total_cost) || (itm.quantity * uPrice);
      rowsHtml += `
        <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
          <td style="padding: 9px 12px; text-align: center; color: #64748B; width: 8%;">${idx + 1}</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #0F172A; width: 40%;">${itm.material_name}</td>
          <td style="padding: 9px 12px; text-align: center; color: #1E1B4B; font-weight: bold; width: 16%;">${itm.quantity} ${itm.unit || 'وحدة'}</td>
          <td style="padding: 9px 12px; text-align: center; color: #475569; width: 18%;">${uPrice.toFixed(2)} ${currency}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #B45309; width: 18%;">+${tPrice.toFixed(2)} ${currency}</td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>أمر شراء رسمي - ${po.order_number}</title>
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
          .doc-info h2 { margin: 0; font-size: 16px; font-weight: 800; color: #D97706; }
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
              ${companyTaxId ? `<p>📜 ${companyTaxId}</p>` : ''}
            </div>
          </div>

          <div class="doc-info">
            <h2>أمر شراء وتوريد مواد خام (PO)</h2>
            <p><strong>رقم الأمر:</strong> ${po.order_number}</p>
            <p><strong>تاريخ الطلب:</strong> ${po.order_date}</p>
            <p><strong>حالة التوريد:</strong> ${po.status === 'Received' ? 'مستلم بالمخزن' : 'قيد التوريد والتجهيز'}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <p>بيانات المورد المعتمد</p>
            <h4>${po.supplier_name}</h4>
            ${po.supplier_phone ? `<span style="font-size: 10px; color: #64748B;">الهاتف: ${po.supplier_phone}</span>` : ''}
            ${po.supplier_address ? `<span style="font-size: 10px; color: #64748B; margin-right: 8px;">• ${po.supplier_address}</span>` : ''}
          </div>

          <div class="info-card">
            <p>طريقة الدفع المسجلة</p>
            <h4>${po.payment_method === 'cash' ? 'نقدي' : po.payment_method === 'instapay' ? 'انستاباي' : po.payment_method === 'vodafone_cash' ? 'فودافون كاش' : po.payment_method || 'نقدي'}</h4>
          </div>

          <div class="info-card" style="border-right: 4px solid ${remainingDebt > 0 ? '#EF4444' : '#10B981'};">
            <p>${remainingDebt > 0 ? 'صافي المتبقي للمورد' : 'أمر شراء مسدد بالكامل'}</p>
            <h4 style="color: ${remainingDebt > 0 ? '#DC2626' : '#059669'};">
              ${remainingDebt.toFixed(2)} ${currency}
            </h4>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="text-align: right; width: 40%;">اسم الخامة / الصنف</th>
              <th style="width: 16%;">الكمية المطلوبة</th>
              <th style="width: 18%;">سعر الوحدة</th>
              <th style="width: 18%;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-item">
            <label>إجمالي قيمة أمر الشراء</label>
            <span style="color: #D97706;">${totalAmount.toFixed(2)} ${currency}</span>
          </div>
          <div class="summary-item">
            <label>المسدد مقدماً (عربون)</label>
            <span style="color: #16A34A;">${depositPaid.toFixed(2)} ${currency}</span>
          </div>
          <div class="summary-item">
            <label>صافي الدين المتبقي</label>
            <span style="color: ${remainingDebt > 0 ? '#DC2626' : '#059669'};">${remainingDebt.toFixed(2)} ${currency}</span>
          </div>
        </div>

        <div class="footer-box">
          <p class="terms-text">${invoiceFooter}</p>
          
          <div class="signatures">
            <div class="sig-box">
              <span>توقيع مندوب المورد والاستلام</span>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <span>اعتماد مسؤول مشتريات الورشة</span>
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
    <div className="space-y-4">
      {/* Smart Search & Quick Filter Bar */}
      <div
        className="rounded-2xl border p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md"
        style={{ background: '#2F264C', borderColor: '#3D3554' }}
      >
        {/* Search & Supplier selector */}
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الأمر، المورد، الخامة..."
              className="w-full rounded-xl py-2 pr-10 pl-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full rounded-xl py-2 px-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-[#D4CEEB] focus:border-[#ECC796]"
            >
              <option value="all">كل الموردين ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[#ECC796] text-[#201A30] shadow'
                : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
            }`}
          >
            <span>الكل</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">{orders.length}</span>
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow'
                : 'bg-[#231B3D] text-amber-300 hover:bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>بانتظار الاستلام</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-bold">{pendingCount}</span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('received')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'received'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-[#231B3D] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>مستلمة بالمخزن</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-700/50 text-white font-bold">{receivedCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('debt')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'debt'
                ? 'bg-red-600 text-white shadow'
                : 'bg-[#231B3D] text-red-400 hover:bg-red-500/10 border border-red-500/30'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>عليها ديون</span>
            {debtCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-700 text-white font-bold">{debtCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Procurement Table */}
      <div className="rounded-2xl border overflow-hidden shadow-xl" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        {loading ? (
          <div className="text-center py-16 text-xs" style={{ color: '#A49EC0' }}>جاري تحميل أوامر الشراء...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b bg-[#231B3D] text-[#A49EC0]" style={{ borderColor: '#3D3554' }}>
                  <th className="py-3.5 px-4 font-semibold text-right">رقم الأمر والتاريخ</th>
                  <th className="py-3.5 px-4 font-semibold text-right">المورد</th>
                  <th className="py-3.5 px-4 font-semibold text-right">المواد والأصناف المشتراة</th>
                  <th className="py-3.5 px-4 font-semibold text-center">القيمة الإجمالية</th>
                  <th className="py-3.5 px-4 font-semibold text-center">المدفوع مقدماً</th>
                  <th className="py-3.5 px-4 font-semibold text-center">الدين المتبقي</th>
                  <th className="py-3.5 px-4 font-semibold text-center">حالة الطلب</th>
                  <th className="py-3.5 px-4 font-semibold text-center">الإجراءات والطباعة</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(po => {
                  const st = statusColors[po.status] || { label: po.status, color: '#A49EC0', bg: '#3D3554', border: '#3D3554' };
                  const tot = parseFloat(po.total_amount) || 0;
                  const dep = parseFloat(po.deposit_paid) || 0;
                  const debt = Math.max(0, tot - dep);
                  const items = po.items || [];

                  return (
                    <tr
                      key={po.id}
                      className="border-b hover:bg-white/[0.03] transition-colors align-middle"
                      style={{ borderColor: '#3D3554' }}
                    >
                      {/* Order Number & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-xs">{po.order_number}</div>
                        <div className="text-[11px] text-[#A49EC0] mt-0.5">{formatDate(po.order_date)}</div>
                      </td>

                      {/* Supplier */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#ECC796]"></span>
                          <span>{po.supplier_name}</span>
                        </div>
                        {po.supplier_phone && (
                          <div className="text-[10px] text-[#A49EC0] mt-0.5">{po.supplier_phone}</div>
                        )}
                      </td>

                      {/* Items Summary chips */}
                      <td className="py-3.5 px-4">
                        {items.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {items.map((itm, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#231B3D] text-gray-200 border border-[#3D3554]"
                                title={`سعر الوحدة: ${itm.unit_cost} ${currency}`}
                              >
                                <strong>{itm.material_name}</strong>
                                <span className="text-[#ECC796]">({itm.quantity} {itm.unit})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#A49EC0] text-[11px]">
                            {po.notes ? po.notes : `${po.items_count || 1} خامات`}
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-center font-bold text-sm text-white">
                        {tot.toLocaleString('ar-EG')} <span className="text-[10px] text-[#A49EC0] font-normal">{currency}</span>
                      </td>

                      {/* Deposit Paid */}
                      <td className="py-3.5 px-4 text-center">
                        {dep > 0 ? (
                          <span className="font-bold text-emerald-400 text-xs">
                            {dep.toLocaleString('ar-EG')} <small className="font-normal text-[10px]">{currency}</small>
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold">—</span>
                        )}
                      </td>

                      {/* Remaining Debt */}
                      <td className="py-3.5 px-4 text-center">
                        {debt > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30 inline-block">
                            {debt.toLocaleString('ar-EG')} {currency}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
                            مسدد بالكامل
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1 shadow-sm"
                          style={{ background: st.bg, color: st.color, borderColor: st.border }}
                        >
                          {po.status === 'Received' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{st.label}</span>
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Official PO PDF Button */}
                          <button
                            onClick={() => printPurchaseOrderPdf(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 transition-all shadow-sm"
                            title="طباعة أمر الشراء الرسمي PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          {/* View details */}
                          <button
                            onClick={() => onViewOrder(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#231B3D] text-[#D4CEEB] hover:bg-white/10 border border-[#3D3554] transition-all"
                            title="عرض تفاصيل الاستلام"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#ECC796]" />
                            <span>تفاصيل</span>
                          </button>

                          {/* Fast Receive for Pending orders */}
                          {po.status === 'Pending' && onReceiveOrder && (
                            <button
                              onClick={() => onReceiveOrder(po.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow"
                              title="استلام الشحنة وإدخالها المستودع فوراً"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>استلام</span>
                            </button>
                          )}

                          {/* Edit button for Pending orders */}
                          {po.status === 'Pending' && onEditOrder && (
                            <button
                              onClick={() => onEditOrder(po)}
                              className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-[#231B3D] text-amber-300 hover:bg-amber-500/10 border border-amber-500/30 transition-all"
                              title="تعديل الكميات"
                            >
                              تعديل
                            </button>
                          )}

                          {/* Delete button */}
                          {onDeleteOrder && (
                            <button
                              onClick={() => onDeleteOrder(po.id, po.order_number)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                              title="حذف أمر الشراء"
                              aria-label="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[#A49EC0]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="w-8 h-8 text-[#3D3554]" />
                        <span>لا توجد طلبات شراء مطابقة للبحث أو الفلتر المختار</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
