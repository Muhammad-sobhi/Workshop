'use client';

import { Phone, Mail, MapPin, Package, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link, Unlink, FileText, Eye, Calendar, Landmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';

export default function SupplierCard({
  item, isExpanded, activeTab, currency,
  onToggle, onEdit, onDelete, onAddMaterial, onPayDebt, onRemoveMaterial,
}) {
  const hasDebt = parseFloat(item.debt_amount) > 0;
  const cardStyle = { background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' };

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(activeTab === 'suppliers' ? 'materials' : 'transactions');

  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxDetails, setShowTxDetails] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      if (activeTab === 'clients') {
        setActiveSubTab('transactions');
      }
      if (activeSubTab === 'transactions') {
        setTxLoading(true);
        const url = activeTab === 'suppliers'
          ? `/suppliers/${item.id}/transactions`
          : `/clients/${item.id}/transactions`;
        apiClient.get(url)
          .then(res => {
            setTransactions(res.data || []);
          })
          .catch(err => console.error(err))
          .finally(() => setTxLoading(false));
      }
    }
  }, [isExpanded, activeSubTab, item.id, activeTab]);

  return (
    <div className="rounded-xl border overflow-hidden" style={cardStyle}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: '#3D3554', color: '#ECC796' }}>
            {item.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold flex items-center gap-2 text-white">
              {item.name}
              {parseFloat(item.debt_amount) !== 0 && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  parseFloat(item.debt_amount) > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {parseFloat(item.debt_amount) > 0
                    ? `${activeTab === 'clients' ? 'مطلوب مديونية' : 'دين'}: ${parseFloat(item.debt_amount).toFixed(2)} ${currency}`
                    : `رصيد دائن (لصالح المورد/العميل): ${Math.abs(parseFloat(item.debt_amount)).toFixed(2)} ${currency}`}
                  {item.debt_due_date ? ` (${item.debt_due_date})` : ''}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {item.contact_person && (
                <span className="text-[10px] font-medium" style={{ color: '#A49EC0' }}>{item.contact_person}</span>
              )}
              {item.phone && (
                <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#A49EC0' }}>
                  <Phone className="w-2.5 h-2.5" />{item.phone}
                </span>
              )}
              {item.email && (
                <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#A49EC0' }}>
                  <Mail className="w-2.5 h-2.5" />{item.email}
                </span>
              )}
              {item.address && (
                <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#A49EC0' }}>
                  <MapPin className="w-2.5 h-2.5" />{item.address}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          {activeTab === 'suppliers' && (
            <>
              <div className="text-center px-2">
                <p className="text-xs font-bold" style={{ color: '#ECC796' }}>{item.materials?.length || 0}</p>
                <p className="text-[9px] font-semibold" style={{ color: '#A49EC0' }}>مادة</p>
              </div>
              <button
                onClick={() => onAddMaterial(item.id)}
                className="p-1.5 rounded-md text-[10px] transition-all flex items-center gap-1"
                style={{ background: '#3D3554', color: '#10B981' }}
                aria-label="ربط مادة بهذا المورد"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeTab === 'suppliers' && hasDebt && (
            <button
              onClick={() => onPayDebt(item)}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all hover:opacity-90 flex items-center gap-1"
              style={{ background: '#10B981', color: '#FFF' }}
            >
              سداد الدين
            </button>
          )}

          {activeTab === 'clients' && (
            <button
              onClick={() => onPayDebt(item)}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all hover:opacity-90 flex items-center gap-1"
              style={{ background: '#10B981', color: '#FFF' }}
            >
              دفع عربون / مرحلة
            </button>
          )}

          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-md transition-all"
            style={{ background: '#3D3554', color: '#ECC796' }}
            aria-label="تعديل"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(item.id, item.name)}
            className="p-1.5 rounded-md transition-all"
            style={{ background: '#3D3554', color: '#EF4444' }}
            aria-label="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={() => onToggle(item.id)}
            className="p-1.5 rounded-md transition-all"
            style={{ background: '#3D3554', color: '#A49EC0' }}
            aria-label={isExpanded ? 'طي التفاصيل' : 'عرض التفاصيل'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: 'rgba(35, 27, 61, 0.15)' }}>
          {activeTab === 'suppliers' && (
            <div className="flex gap-2 border-b border-[#3D3554] pb-2 mb-4">
              <button
                onClick={() => setActiveSubTab('materials')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'materials'
                    ? 'bg-[#3D3554] text-[#ECC796] border border-[#ECC796]/30'
                    : 'text-[#A49EC0] hover:text-white hover:bg-white/5'
                }`}
              >
                المواد المرتبطة
              </button>
              <button
                onClick={() => setActiveSubTab('transactions')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'transactions'
                    ? 'bg-[#3D3554] text-[#ECC796] border border-[#ECC796]/30'
                    : 'text-[#A49EC0] hover:text-white hover:bg-white/5'
                }`}
              >
                كشف الحساب والمدفوعات
              </button>
            </div>
          )}

          {activeSubTab === 'materials' && activeTab === 'suppliers' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-white">
                  <Package className="w-4 h-4 text-[#ECC796]" />
                  المواد التي يوفرها هذا المورد
                </h4>
                <button
                  onClick={() => onAddMaterial(item.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                  style={{ background: '#3D3554', color: '#ECC796' }}
                >
                  <Plus className="w-3 h-3" />
                  إضافة مادة
                </button>
              </div>
              {!item.materials || item.materials.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>
                  لم يتم ربط أي مادة بهذا المورد بعد. اضغط "إضافة مادة" لربط المواد التي يوفرها.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {item.materials.map(mat => (
                    <div key={mat.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#3D3554', color: '#ffffff' }}>
                      <div>
                        <p className="text-sm font-semibold text-white">{mat.name}</p>
                        <p className="text-xs mt-0.5 text-gray-200">
                          {mat.unit}
                          {mat.pivot?.price ? ` • EGP ${parseFloat(mat.pivot.price).toFixed(2)}/وحدة` : ''}
                        </p>
                        {mat.pivot?.notes && (
                          <p className="text-xs mt-0.5 text-gray-300">{mat.pivot.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveMaterial(item.id, mat.id, mat.name)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.1)', color: '#FCA5A5' }}
                        aria-label="إلغاء الربط"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'transactions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-white">
                  <FileText className="w-4 h-4 text-[#ECC796]" />
                  كشف الحركة المالية والمدفوعات
                </h4>
                {transactions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) return;
                        const formattedDebt = parseFloat(item.debt_amount || 0);
                        const isSupplier = activeTab === 'suppliers';

                        const totalTransactionsAmount = transactions.reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);

                        const rows = transactions.map(tx => {
                          const itemsHtml = tx.items_summary && tx.items_summary.length > 0
                            ? `<div style="margin-top: 4px; padding: 4px 8px; background: #F3F4F6; border-radius: 4px; font-size: 11px; color: #374151;">
                                 <strong>تفاصيل البنود / المواد:</strong><br/>
                                 ${tx.items_summary.map(i => `• ${i.name}: ${i.quantity} ${i.unit} × ${i.unit_cost} = ${(i.total_cost || i.quantity * i.unit_cost).toFixed(2)} ${currency}`).join('<br/>')}
                               </div>`
                            : '';

                          return `
                          <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center;">${tx.date}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center;">
                              <span style="background: #EEF2FF; color: #4338CA; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">${tx.category || tx.type}</span>
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; font-family: monospace; font-weight: bold;">${tx.number || '-'}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: left; font-weight: bold; color: ${tx.type === 'revenue' || tx.type === 'milestone' || tx.type === 'deposit' ? '#059669' : '#D97706'};">
                              ${parseFloat(tx.amount).toFixed(2)} ${currency}
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center;">
                              ${tx.payment_method === 'cash' ? 'نقدي' : tx.payment_method === 'instapay' ? 'انستاباي' : tx.payment_method === 'vodafone_cash' ? 'فودافون كاش' : tx.payment_method || '-'}
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">
                              ${tx.description || '-'}
                              ${itemsHtml}
                            </td>
                          </tr>
                        `;
                        }).join('');

                        printWindow.document.write(`
                          <html dir="rtl" lang="ar">
                            <head>
                              <title>كشف حساب حركة تفصيلية - ${item.name}</title>
                              <style>
                                @media print { @page { size: A4; margin: 12mm; } }
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1F2937; line-height: 1.5; background: #fff; }
                                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2F264C; padding-bottom: 12px; margin-bottom: 18px; }
                                .brand h1 { margin: 0; font-size: 22px; font-weight: 800; color: #2F264C; }
                                .brand p { margin: 2px 0 0 0; font-size: 12px; color: #6B7280; }
                                .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                                .info-card { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 10px 12px; border-radius: 8px; }
                                .info-card p { margin: 0; font-size: 10px; color: #6B7280; font-weight: 600; }
                                .info-card h4 { margin: 3px 0 0 0; font-size: 13px; font-weight: 800; color: #111827; }
                                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                                th { background-color: #2F264C; color: #ffffff; padding: 9px; text-align: center; font-size: 11px; }
                                .footer { margin-top: 25px; border-top: 1px solid #E5E7EB; padding-top: 10px; text-align: center; font-size: 10px; color: #9CA3AF; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <div class="brand">
                                  <h1>نظام إدارة الورشة والإنتاج</h1>
                                  <p>تقرير كشف حساب تفصيلي للمعاملات والمنتجات/المواد والمدفوعات</p>
                                </div>
                                <div style="text-align: left;">
                                  <p style="margin:0; font-size: 11px; font-weight: bold; color: #374151;">نوع الحساب: ${isSupplier ? 'مورد' : 'عميل'}</p>
                                  <p style="margin:2px 0 0 0; font-size: 10px; color: #6B7280;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                                </div>
                              </div>

                              <div class="info-grid">
                                <div class="info-card">
                                  <p>الجهة / الاسم</p>
                                  <h4>${item.name}</h4>
                                  <span style="font-size: 10px; color: #4B5563;">${item.phone ? 'الهاتف: ' + item.phone : ''}</span>
                                </div>
                                <div class="info-card">
                                  <p>عدد المعاملات والطلبات</p>
                                  <h4>${transactions.length} معاملة</h4>
                                </div>
                                <div class="info-card">
                                  <p>إجمالي المدفوعات/المبالغ</p>
                                  <h4 style="color: #059669;">${totalTransactionsAmount.toFixed(2)} ${currency}</h4>
                                </div>
                                <div class="info-card" style="border-right: 4px solid ${formattedDebt > 0 ? '#EF4444' : formattedDebt < 0 ? '#10B981' : '#3B82F6'};">
                                  <p>${formattedDebt > 0 ? (isSupplier ? 'الدين المتبقي للمورد' : 'المطلوب من العميل') : formattedDebt < 0 ? 'رصيد دائن لصالح الجهة' : 'الحساب متوازن'}</p>
                                  <h4 style="color: ${formattedDebt > 0 ? '#DC2626' : formattedDebt < 0 ? '#059669' : '#2563EB'};">
                                    ${Math.abs(formattedDebt).toFixed(2)} ${currency}
                                  </h4>
                                </div>
                              </div>

                              <table>
                                <thead>
                                  <tr>
                                    <th style="width: 80px;">التاريخ</th>
                                    <th style="width: 100px;">نوع الحركة</th>
                                    <th style="width: 90px;">الرقم المرجعي</th>
                                    <th style="width: 90px;">المبلغ</th>
                                    <th style="width: 80px;">طريقة الدفع</th>
                                    <th style="text-align: right;">البيان وتفاصيل المواد/المنتجات والكميات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${rows}
                                </tbody>
                              </table>

                              <div class="footer">
                                <p>تم استخراج هذا الكشف التفصيلي تلقائياً من نظام إدارة الورشة بتاريخ ${new Date().toLocaleString('ar-EG')}</p>
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 flex items-center gap-1"
                    >
                      طباعة / PDF
                    </button>
                    <button
                      onClick={() => {
                        const headers = ['التاريخ', 'نوع الحركة', 'الرقم المرجعي', 'المبلغ', 'طريقة الدفع', 'البيان'];
                        const rows = transactions.map(tx => [
                          `"${tx.date}"`,
                          `"${tx.category || tx.type}"`,
                          `"${tx.number || ''}"`,
                          `"${tx.amount}"`,
                          `"${tx.payment_method || ''}"`,
                          `"${(tx.description || '').replace(/"/g, '""')}"`
                        ]);
                        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `statement_${item.name}_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-[#3D3554] text-white hover:bg-white/10 border border-[#3D3554] flex items-center gap-1"
                    >
                      تصدير CSV
                    </button>
                  </div>
                )}
              </div>
              {txLoading ? (
                <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>جاري تحميل كشف الحساب...</p>
              ) : transactions.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>لا توجد معاملات مسجلة بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right text-[#D4CEEB] font-medium">
                    <thead>
                      <tr className="border-b border-[#3D3554] text-[#A49EC0]">
                        <th className="py-2.5 px-2">التاريخ</th>
                        <th className="py-2.5 px-2">نوع الحركة</th>
                        <th className="py-2.5 px-2 text-center">الرقم المرجعي</th>
                        <th className="py-2.5 px-2 text-left">المبلغ</th>
                        <th className="py-2.5 px-2">طريقة الدفع</th>
                        <th className="py-2.5 px-2">البيان وتفاصيل المواد/المنتجات</th>
                        <th className="py-2.5 px-2 text-center">الإيصال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b border-[#3D3554]/50 hover:bg-white/5 transition-colors align-top">
                          <td className="py-2.5 px-2 whitespace-nowrap text-white">{tx.date}</td>
                          <td className="py-2.5 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === 'revenue' || tx.type === 'milestone' || tx.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                              {tx.category || tx.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-[#A49EC0]">{tx.number}</td>
                          <td className={`py-2.5 px-2 text-left font-bold ${tx.type === 'revenue' || tx.type === 'milestone' || tx.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {tx.type === 'revenue' || tx.type === 'milestone' || tx.type === 'deposit' ? '+' : '-'} {parseFloat(tx.amount).toFixed(2)} {currency}
                          </td>
                          <td className="py-2.5 px-2 text-[#D4CEEB]">
                            {tx.payment_method === 'cash' ? 'نقدي' : 
                             tx.payment_method === 'instapay' ? 'انستاباي' : 
                             tx.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                             tx.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 
                             tx.payment_method === 'postal_transfer' ? 'حوالة بريدية' : tx.payment_method || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-white">
                            <p className="font-medium text-xs">{tx.description}</p>
                            {tx.items_summary && tx.items_summary.length > 0 && (
                              <div className="mt-1.5 p-2 rounded-lg bg-black/20 border border-white/5 space-y-1">
                                <span className="block text-[10px] font-bold text-[#ECC796]">تفاصيل البنود والكميات:</span>
                                {tx.items_summary.map((itm, iIdx) => (
                                  <div key={iIdx} className="flex items-center justify-between text-[11px] text-gray-300">
                                    <span>• {itm.name}</span>
                                    <span className="font-mono text-[10px]">
                                      {itm.quantity} {itm.unit} × EGP {itm.unit_cost} = <strong className="text-emerald-400">EGP {(itm.total_cost || itm.quantity * itm.unit_cost).toFixed(2)}</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedTx({
                                  ...tx,
                                  client_name: activeTab === 'clients' ? item.name : '',
                                  supplier_name: activeTab === 'suppliers' ? item.name : '',
                                });
                                setShowTxDetails(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 transition-colors rounded text-[10px] font-bold border border-[#ECC796]/30"
                            >
                              <Eye className="w-3 h-3" />
                              التفاصيل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#ECC796]/40 bg-[#231B3D]">
                        <td colSpan={3} className="py-3 px-3 font-extrabold text-white text-xs">
                          إجمالي كشف الحساب ({transactions.length} معاملة)
                        </td>
                        <td className="py-3 px-2 text-left font-black text-emerald-400 text-sm font-mono">
                          {transactions.reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0).toFixed(2)} {currency}
                        </td>
                        <td colSpan={3} className="py-3 px-3 text-left font-bold text-xs">
                          {parseFloat(item.debt_amount || 0) > 0 ? (
                            <span className="text-red-400 font-extrabold">
                              {activeTab === 'clients' ? 'إجمالي المطلوب من العميل: ' : 'إجمالي الدين المستحق للمورد: '}
                              {parseFloat(item.debt_amount).toFixed(2)} {currency}
                            </span>
                          ) : parseFloat(item.debt_amount || 0) < 0 ? (
                            <span className="text-emerald-400 font-extrabold">
                              رصيد دائن (لصالح الجهة): {Math.abs(parseFloat(item.debt_amount)).toFixed(2)} {currency}
                            </span>
                          ) : (
                            <span className="text-blue-400 font-bold">الحساب متوازن (0.00 {currency})</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {item.notes && (
            <div className="mt-3 p-3 rounded-xl text-xs font-semibold" style={{ background: '#3D3554', color: '#ffffff' }}>
              <span className="font-bold text-[#ECC796]">ملاحظات: </span>{item.notes}
            </div>
          )}
        </div>
      )}

      <TransactionDetailsModal
        show={showTxDetails}
        onClose={() => { setShowTxDetails(false); setSelectedTx(null); }}
        transaction={selectedTx}
        currency={currency}
      />
    </div>
  );
}
