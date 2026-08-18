import React, { useState, useEffect, Fragment } from 'react';
import { Phone, Mail, MapPin, Package, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link, Unlink, FileText, Eye, Calendar, Landmark } from 'lucide-react';
import apiClient from '@/lib/api-client';
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';

export default function SupplierCard({
  item, isExpanded, activeTab, currency,
  onToggle, onEdit, onDelete, onAddMaterial, onPayDebt, onRemoveMaterial, onUndoPayment,
}) {
  const { settings } = useAppStore();
  const hasDebt = parseFloat(item.debt_amount) > 0;
  const cardStyle = { background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' };

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(activeTab === 'suppliers' ? 'materials' : 'transactions');

  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxDetails, setShowTxDetails] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

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
  }, [isExpanded, activeSubTab, item.id, activeTab, item.debt_amount]);

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
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shadow-sm ${parseFloat(item.debt_amount) > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                  {parseFloat(item.debt_amount) > 0
                    ? `${activeTab === 'clients' ? 'مطلوب مديونية' : 'دين مستحق للمورد'}: ${parseFloat(item.debt_amount).toFixed(2)} ${currency}`
                    : `${activeTab === 'clients' ? 'رصيد دائن للعميل (دفعة مقدمة)' : 'رصيد دائن لصالحنا (دفعة مقدمة)'}: ${Math.abs(parseFloat(item.debt_amount)).toFixed(2)} ${currency}`}
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

          {activeTab === 'suppliers' && (
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
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${activeSubTab === 'materials'
                    ? 'bg-[#3D3554] text-[#ECC796] border border-[#ECC796]/30'
                    : 'text-[#A49EC0] hover:text-white hover:bg-white/5'
                  }`}
              >
                المواد المرتبطة
              </button>
              <button
                onClick={() => setActiveSubTab('transactions')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${activeSubTab === 'transactions'
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

          {activeSubTab === 'transactions' && (() => {
            const isPaymentTx = (tx) => {
              if (!tx) return false;
              if (typeof tx.is_payment === 'boolean') return tx.is_payment;
              if (tx.type === 'invoice' || tx.type === 'revenue' || tx.type === 'purchase_order' || tx.type === 'production_order' || tx.type === 'eso') {
                return false;
              }
              return tx.type === 'payment' || tx.type === 'deposit' || tx.type === 'expense';
            };

            const extractRef = (tx) => {
              if (!tx) return null;
              const combined = `${tx.number || ''} ${tx.reference_number || ''} ${tx.description || ''} ${tx.notes || ''}`;
              const match = combined.match(/(PO-\d+-\d+|OP-\d+-\d+|ESO-\d+-\d+|SO-\d+-\d+|INV-\d+-\d+)/i);
              return match ? match[0].toUpperCase() : null;
            };

            const getShortLabel = (tx) => {
              if (isPaymentTx(tx)) {
                if (tx.is_deposit || tx.type === 'deposit' || tx.category?.includes('عربون') || tx.description?.includes('عربون')) {
                  return { short: 'دفعة عربون مقدم', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
                }
                return { short: 'تسديد دفعة', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
              }
              if (tx.type === 'revenue' || tx.type === 'invoice' || tx.category?.includes('مبيعات') || tx.description?.includes('فاتورة مبيعات')) {
                return { short: 'فاتورة مبيعات', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
              }
              if (tx.type === 'purchase_order' || tx.category === 'أمر شراء / توريد' || tx.description?.includes('طلب شراء')) {
                return { short: 'طلب شراء', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
              }
              if (tx.type === 'production_order' || tx.category?.includes('أمر تشغيل')) {
                return { short: 'أمر تشغيل', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
              }
              if (tx.type === 'eso' || tx.category?.includes('تشغيل خارجي')) {
                return { short: 'تشغيل خارجي', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
              }
              return { short: tx.category || tx.type || 'معاملة', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
            };

            const transactionsList = transactions || [];

            const printPdfReport = (transactionsToPrint, isSinglePrint = false, singleTitle = '') => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const isSupplier = activeTab === 'suppliers';

              const currentSettings = settings || useAppStore.getState?.()?.settings || {};
              const companyName = currentSettings.company_name || 'ورشة الأثاث الحديث';
              const companyPhone = currentSettings.phone || '';
              const companyAddress = currentSettings.address || '';
              const companyTaxId = currentSettings.tax_number || '';
              const companyLogo = currentSettings.logo_path ? getImageUrl(currentSettings.logo_path) : '';
              const invoiceFooter = currentSettings.invoice_footer || 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة ضد عيوب الصناعة';

              let totalOrdersAmount = 0;
              let totalPaidAmount = 0;

              transactionsToPrint.forEach(tx => {
                const amt = (parseFloat(tx.total_amount ?? tx.amount) || 0);
                if (!isPaymentTx(tx)) {
                  totalOrdersAmount += amt;
                } else {
                  totalPaidAmount += amt;
                }
              });

              const remainingBalance = Math.max(0, totalOrdersAmount - totalPaidAmount);
              let documentTitle = isSupplier ? 'كشف حساب مورد تفصيلي' : 'كشف حساب عميل تفصيلي';
              if (isSinglePrint && transactionsToPrint.length === 1) {
                const p = transactionsToPrint[0];
                if (isSupplier) {
                  documentTitle = p.type === 'eso' ? 'أمر تشغيل خارجي' : 'أمر شراء وتوريد مواد خام (PO)';
                } else {
                  documentTitle = p.type === 'revenue' || p.type === 'invoice' || p.category?.includes('مبيعات') ? 'فاتورة مبيعات رسمية' : 'أمر تشغيل وإنتاج للعميل';
                }
              }

              let rowsHtml = '';
              transactionsToPrint.forEach((tx) => {
                const isPay = isPaymentTx(tx);
                const amt = parseFloat(tx.amount || tx.total_amount) || 0;
                const items = tx.items_summary || [];
                const txLabel = getShortLabel(tx);

                const payMethodLabel = tx.payment_method === 'cash' ? 'نقدي' :
                  tx.payment_method === 'instapay' ? 'انستاباي' :
                    tx.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                      tx.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                        tx.payment_method === 'postal_transfer' ? 'حوالة بريدية' : tx.payment_method || '-';

                if (isPay) {
                  rowsHtml += `
                    <tr style="background-color: #F0FDF4; border-bottom: 1px dashed #BBF7D0; font-size: 11px;">
                      <td style="padding: 8px 10px; text-align: center; color: #166534; font-weight: bold; width: 13%;">↳ ${tx.date}</td>
                      <td style="padding: 8px 10px; text-align: right; color: #166534; font-weight: bold; width: 33%;">↳ ${tx.description || `${txLabel.short} (${payMethodLabel})`}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 8%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 12%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 11%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #15803D; font-size: 12px; font-weight: 800; width: 11%;">
                        -${amt.toFixed(2)} ${currency}
                      </td>
                      <td style="padding: 8px 10px; text-align: center; color: #166534; font-size: 12px; font-weight: 900; width: 12%; background-color: #DCFCE7;">
                        ${(tx.running_debt !== undefined ? tx.running_debt : 0).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                } else if (items.length > 0) {
                  items.forEach((itm, iIdx) => {
                    const unitPrice = parseFloat(itm.unit_cost) || 0;
                    const itemTotal = (parseFloat(itm.total_cost) > 0) ? parseFloat(itm.total_cost) : (itm.quantity * unitPrice);
                    const isLastItem = iIdx === items.length - 1;

                    rowsHtml += `
                      <tr style="background-color: ${iIdx === 0 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
                        <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 13%;">
                          ${iIdx === 0 ? `${tx.date}<br><small style="color:#64748B; font-weight:normal;">${tx.number || tx.reference_number || ''}</small>` : ''}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; color: #0F172A; font-weight: bold; width: 33%;">
                          ${itm.name}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 8%;">
                          ${itm.quantity} ${itm.unit || 'وحدة'}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #64748B; font-weight: 600; width: 12%;">
                          ${unitPrice.toFixed(2)} ${currency}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #B45309; font-size: 12px; font-weight: 800; width: 11%;">
                          +${itemTotal.toFixed(2)} ${currency}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 11%;">
                          —
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #0F172A; font-size: 12px; font-weight: 900; width: 12%; background-color: #FEF3C7;">
                          ${isLastItem ? `${(tx.running_debt !== undefined ? tx.running_debt : 0).toFixed(2)} ${currency}` : '...'}
                        </td>
                      </tr>
                    `;
                  });
                } else {
                  rowsHtml += `
                    <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0; font-size: 11px;">
                      <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 13%;">${tx.date}<br><small style="color:#64748B;">${tx.number || ''}</small></td>
                      <td style="padding: 8px 10px; text-align: right; color: #0F172A; font-weight: bold; width: 33%;">${tx.description || tx.category || 'معاملة مالية'}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #334155; width: 8%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 12%;">${amt.toFixed(2)} ${currency}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #B45309; font-size: 12px; font-weight: 800; width: 11%;">
                        +${amt.toFixed(2)} ${currency}
                      </td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 11%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #0F172A; font-size: 12px; font-weight: 900; width: 12%; background-color: #FEF3C7;">
                        ${(tx.running_debt !== undefined ? tx.running_debt : 0).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                }
              });

              printWindow.document.write(`
                <html dir="rtl" lang="ar">
                  <head>
                    <title>${isSinglePrint ? `${documentTitle} - ${item.name}` : `كشف حساب تفصيلي - ${item.name}`}</title>
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
                        <h2>${documentTitle}</h2>
                        <p><strong>نوع الحساب:</strong> ${isSupplier ? 'مورد معتمد' : 'عميل'}</p>
                        <p><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
                        <p><strong>التوقيت:</strong> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div class="info-grid">
                      <div class="info-card">
                        <p>${isSupplier ? 'بيانات المورد / الجهة' : 'بيانات العميل / الجهة الطالبة'}</p>
                        <h4>${item.name}</h4>
                        ${item.phone ? `<span style="font-size: 10px; color: #64748B;">الهاتف: ${item.phone}</span>` : ''}
                        ${item.address ? `<span style="font-size: 10px; color: #64748B; margin-right: 8px;">• ${item.address}</span>` : ''}
                      </div>

                      <div class="info-card">
                        <p>نوع المعاملات</p>
                        <h4>${isSinglePrint ? 'طلب محدد' : 'كشف حساب شامل لكافة المعاملات'}</h4>
                      </div>

                      <div class="info-card" style="border-right: 4px solid ${remainingBalance > 0 ? '#EF4444' : '#10B981'};">
                        <p>${remainingBalance > 0 ? (isSupplier ? 'صافي الدين المتبقي للمورد' : 'صافي المطلوب المتبقي من العميل') : 'الحساب خالص بالكامل'}</p>
                        <h4 style="color: ${remainingBalance > 0 ? '#DC2626' : '#059669'};">
                          ${remainingBalance.toFixed(2)} ${currency}
                        </h4>
                      </div>
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th style="width: 13%;">التاريخ / المرجع</th>
                          <th style="text-align: right; width: 33%;">اسم البند / الصنف أو البيان</th>
                          <th style="width: 8%;">الكمية</th>
                          <th style="width: 12%;">سعر الوحدة</th>
                          <th style="width: 11%;">المطلوب (+)</th>
                          <th style="width: 11%;">المسدد (-)</th>
                          <th style="width: 12%;">الرصيد المتبقي</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>

                    <div class="summary-box">
                      <div class="summary-item">
                        <label>إجمالي قيمة الطلبيات (+)</label>
                        <span style="color: #D97706;">${totalOrdersAmount.toFixed(2)} ${currency}</span>
                      </div>
                      <div class="summary-item">
                        <label>إجمالي المدفوعات المسددة (-)</label>
                        <span style="color: #16A34A;">${totalPaidAmount.toFixed(2)} ${currency}</span>
                      </div>
                      <div class="summary-item">
                        <label>صافي الرصيد المتبقي المستحق</label>
                        <span style="color: ${remainingBalance > 0 ? '#DC2626' : '#059669'};">${remainingBalance.toFixed(2)} ${currency}</span>
                      </div>
                    </div>

                    <div class="footer-box">
                      <p class="terms-text">${invoiceFooter}</p>
                      
                      <div class="signatures">
                        <div class="sig-box">
                          <span>توقيع المستلم / العميل</span>
                          <div class="sig-line"></div>
                        </div>
                        <div class="sig-box">
                          <span>اعتماد إدارة الورشة والختم</span>
                          <div class="sig-line"></div>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
              `);
              printWindow.document.close();
              printWindow.print();
            };

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-white">
                    <FileText className="w-4 h-4 text-[#ECC796]" />
                    كشف الحركة المالية والمدفوعات المنظمة
                  </h4>
                  {transactionsList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printPdfReport(transactionsList, false, '')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 flex items-center gap-1"
                      >
                        طباعة كشف الحساب الكامل (PDF)
                      </button>
                    </div>
                  )}
                </div>
                {txLoading ? (
                  <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>جاري تحميل كشف الحساب...</p>
                ) : transactionsList.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>لا توجد معاملات مسجلة بعد.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs text-right text-[#D4CEEB] font-medium border-collapse">
                        <thead>
                          <tr className="border-b border-[#3D3554] text-[#A49EC0] bg-[#231B3D]">
                            <th className="py-2.5 px-3 text-right">التاريخ</th>
                            <th className="py-2.5 px-3 text-center">نوع الحركة</th>
                            <th className="py-2.5 px-3 text-left">المبلغ</th>
                            <th className="py-2.5 px-3 text-center">الرصيد المتبقي (متبقي الدين)</th>
                            <th className="py-2.5 px-3 text-center">طريقة الدفع</th>
                            <th className="py-2.5 px-3 text-right">البيان وتفاصيل المواد/المنتجات</th>
                            <th className="py-2.5 px-3 text-center">الإجراءات والطباعة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactionsList.map((tx, idx) => {
                            const isPay = isPaymentTx(tx);
                            const txLabel = getShortLabel(tx);

                            return (
                              <tr key={tx.id || `tx-${idx}`} className={`border-b border-[#3D3554]/60 hover:bg-white/5 transition-colors align-middle ${isPay ? 'bg-[#251E38]' : 'bg-[#2F264C]'}`}>
                                <td className="py-3 px-3 whitespace-nowrap text-white font-semibold">
                                  <div className="flex items-center gap-1.5">
                                    {isPay && <span className="text-emerald-400 font-bold">↳</span>}
                                    <span>{tx.date}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${txLabel.color}`}>
                                    {txLabel.short}
                                  </span>
                                </td>
                                <td className={`py-3 px-3 text-left font-bold text-sm ${isPay ? 'text-emerald-400' : 'text-amber-300'}`}>
                                  {isPay ? '-' : '+'} {parseFloat(tx.amount || tx.total_amount || 0).toFixed(2)} {currency}
                                </td>
                                <td className="py-3 px-3 text-center font-extrabold text-xs">
                                  <span className={`px-2 py-1 rounded border font-mono ${isPay ? 'bg-[#1C162E] text-emerald-300 border-emerald-500/30' : 'bg-[#231B3D] text-[#ECC796] border-[#ECC796]/30'}`}>
                                    {(tx.running_debt !== undefined ? tx.running_debt : 0).toFixed(2)} {currency}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center text-[#D4CEEB]">
                                  {tx.payment_method === 'cash' ? 'نقدي' :
                                    tx.payment_method === 'instapay' ? 'انستاباي' :
                                      tx.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                                        tx.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                                          tx.payment_method === 'postal_transfer' ? 'حوالة بريدية' : tx.payment_method || '-'}
                                </td>
                                <td className="py-3 px-3 text-white">
                                  <div className="font-semibold text-xs text-[#ECC796]">
                                    {isPay
                                      ? (tx.description || `${txLabel.short}`)
                                      : tx.type === 'purchase_order' || tx.category === 'أمر شراء / توريد' || tx.description?.includes('طلب شراء')
                                        ? `طلب شراء ${tx.number ? `(${tx.number})` : ''}`
                                        : tx.type === 'eso' || tx.category === 'أمر تشغيل خارجي'
                                          ? `أمر تشغيل خارجي ${tx.number ? `(${tx.number})` : ''}`
                                          : tx.type === 'revenue' || tx.type === 'invoice' || tx.category?.includes('مبيعات') || tx.description?.includes('فاتورة مبيعات')
                                            ? `فاتورة مبيعات ${tx.number ? `(${tx.number})` : ''}`
                                            : tx.type === 'production_order' || tx.category?.includes('أمر تشغيل') || (tx.description?.includes('أمر تشغيل') && !tx.description?.includes('تسديد'))
                                              ? `تكلفة أمر تشغيل ${tx.number ? `(${tx.number})` : ''}`
                                              : `${txLabel.short} ${tx.number ? `(${tx.number})` : ''}`}
                                  </div>
                                  {tx.type === 'invoice' && tx.payment_status_label && (
                                    <div className="text-[10px] mt-0.5 text-gray-300">
                                      <span className="font-semibold text-[#A49EC0]">حالة السداد: </span>
                                      <span className={tx.remaining_amount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                        {tx.payment_status_label}
                                      </span>
                                    </div>
                                  )}
                                  {tx.items_summary && tx.items_summary.length > 0 && (
                                    <div className="transaction-items-box mt-1.5 p-2 rounded-lg bg-black/30 border border-white/10 space-y-1">
                                      <span className="transaction-items-title block text-[10px] font-bold text-[#ECC796]">تفاصيل البنود والكميات:</span>
                                      {tx.items_summary.map((itm, iIdx) => (
                                        <div key={iIdx} className="flex items-center justify-between text-[11px]">
                                          <span className="font-semibold text-gray-200">• {itm.name}</span>
                                          <span className="font-mono text-[10px] text-gray-300">
                                            {itm.quantity} {itm.unit} × EGP {itm.unit_cost} = <strong className="text-emerald-400 font-bold">EGP {(itm.total_cost && parseFloat(itm.total_cost) > 0 ? parseFloat(itm.total_cost) : itm.quantity * itm.unit_cost).toFixed(2)}</strong>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {onUndoPayment && isPay && (
                                      <button
                                        onClick={() => onUndoPayment(item.id, tx.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors rounded text-[10px] font-bold border border-red-500/30"
                                        title="التراجع عن هذا السداد وإلغاء القيد المالي"
                                      >
                                        ↩ تراجع
                                      </button>
                                    )}
                                    {!isPay && (
                                      <button
                                        onClick={() => printPdfReport([tx], true, txLabel.short)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 transition-colors rounded text-[10px] font-bold border border-[#ECC796]/30"
                                        title="طباعة PDF لهذه المعاملة فقط"
                                      >
                                        <FileText className="w-3 h-3" />
                                        PDF
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedTx({
                                          ...tx,
                                          client_name: activeTab === 'clients' ? item.name : '',
                                          supplier_name: activeTab === 'suppliers' ? item.name : '',
                                        });
                                        setShowTxDetails(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-white hover:bg-white/20 transition-colors rounded text-[10px] font-bold"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#ECC796]/40 bg-[#231B3D]">
                            <td colSpan={2} className="py-3 px-3 font-extrabold text-white text-xs">
                              إجمالي كشف الحساب ({transactionsList.length} حركة مسجلة)
                            </td>
                            <td className="py-3 px-2 text-left font-black text-emerald-400 text-sm font-mono">
                              {(() => {
                                const totalPaid = transactionsList
                                  .filter(tx => isPaymentTx(tx))
                                  .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
                                return `إجمالي المدفوع: ${totalPaid.toFixed(2)} ${currency}`;
                              })()}
                            </td>
                            <td colSpan={4} className="py-3 px-3 text-left font-bold text-xs">
                              {parseFloat(item.debt_amount || 0) > 0 ? (
                                <span className="text-red-400 font-extrabold">
                                  {activeTab === 'clients' ? 'إجمالي المطلوب من العميل: ' : 'إجمالي الدين المستحق للمورد: '}
                                  {parseFloat(item.debt_amount).toFixed(2)} {currency}
                                </span>
                              ) : parseFloat(item.debt_amount || 0) < 0 ? (
                                <span className="text-emerald-400 font-extrabold">
                                  {activeTab === 'clients' ? 'رصيد دائن للعميل (دفعة مقدمة): ' : 'رصيد دائن لصالحنا (دفعة مقدمة): '}
                                  {Math.abs(parseFloat(item.debt_amount)).toFixed(2)} {currency}
                                </span>
                              ) : (
                                <span className="text-blue-400 font-bold">الحساب متوازن (0.00 {currency})</span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2 mt-2">
                      {transactionsList.map((tx, idx) => {
                        const isPay = isPaymentTx(tx);
                        const txLabel = getShortLabel(tx);
                        return (
                          <div key={tx.id || `m-tx-${idx}`} className={`p-3 rounded-xl border ${isPay ? 'bg-[#251E38] border-emerald-500/30' : 'bg-[#2F264C] border-[#3D3554]'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                {isPay && <span className="text-emerald-400 font-bold">↳</span>}
                                {tx.date}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${txLabel.color}`}>
                                {txLabel.short}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className={`font-black ${isPay ? 'text-emerald-400' : 'text-amber-300'}`}>
                                {isPay ? '-' : '+'} {parseFloat(tx.amount || tx.total_amount || 0).toFixed(2)} {currency}
                              </span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1C162E] text-[#ECC796] border border-[#ECC796]/30">
                                المتبقي: {(tx.running_debt !== undefined ? tx.running_debt : 0).toFixed(2)} {currency}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-300 mb-2">{tx.description || txLabel.short}</p>
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                              {onUndoPayment && isPay && (
                                <button
                                  onClick={() => onUndoPayment(item.id, tx.id)}
                                  className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-[10px] font-bold border border-red-500/30"
                                >
                                  ↩ تراجع
                                </button>
                              )}
                              {!isPay && (
                                <button
                                  onClick={() => printPdfReport([tx], true, txLabel.short)}
                                  className="px-2 py-1 bg-[#3D3554] text-[#ECC796] rounded text-[10px] font-bold border border-[#ECC796]/30"
                                >
                                  PDF
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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

