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
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shadow-sm ${
                  parseFloat(item.debt_amount) > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {parseFloat(item.debt_amount) > 0
                    ? `${activeTab === 'clients' ? 'مطلوب مديونية' : 'دين مستحق للمورد'}: ${parseFloat(item.debt_amount).toFixed(2)} ${currency}`
                    : `${activeTab === 'clients' ? 'رصيد دائن للعميل' : 'رصيد دائن للمورد (مدفوع زيادات)'}: ${Math.abs(parseFloat(item.debt_amount)).toFixed(2)} ${currency}`}
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

          {activeSubTab === 'transactions' && (() => {
            const isPaymentTx = (tx) => {
              if (!tx) return false;
              return tx.type === 'payment' || 
                     tx.type === 'deposit' || 
                     tx.type === 'expense' || 
                     tx.category?.includes('سداد') || 
                     tx.category?.includes('تسديد') || 
                     tx.category?.includes('عربون') || 
                     tx.category?.includes('دفعة') || 
                     tx.description?.includes('سداد') || 
                     tx.description?.includes('تسديد') || 
                     tx.description?.includes('عربون') || 
                     tx.description?.includes('دفعة');
            };

            const groupedTransactions = (() => {
              if (!transactions || transactions.length === 0) return [];
              const processedIds = new Set();

              const extractRef = (tx) => {
                const combined = `${tx.number || ''} ${tx.reference_number || ''} ${tx.description || ''} ${tx.notes || ''}`;
                const match = combined.match(/(PO-\d+-\d+|OP-\d+-\d+|ESO-\d+-\d+|SO-\d+-\d+|INV-\d+-\d+)/i);
                return match ? match[0].toUpperCase() : null;
              };

              const refMap = {};
              const parentOrders = [];

              transactions.forEach(tx => {
                const ref = extractRef(tx);
                if (ref) {
                  if (!refMap[ref]) refMap[ref] = [];
                  refMap[ref].push(tx);
                }
              });

              Object.keys(refMap).forEach(ref => {
                const txList = refMap[ref];
                const parent = txList.find(tx => !isPaymentTx(tx)) || txList[0];

                if (parent) {
                  const children = txList.filter(tx => tx.id !== parent.id);
                  children.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                  txList.forEach(tx => processedIds.add(tx.id));
                  parentOrders.push({ parent, children, orderRef: ref });
                }
              });

              const unassignedPayments = transactions.filter(tx => !processedIds.has(tx.id) && isPaymentTx(tx));
              if (unassignedPayments.length > 0 && parentOrders.length > 0) {
                unassignedPayments.forEach(payTx => {
                  const matchingParent = parentOrders.find(p => p.parent.date === payTx.date) || parentOrders[0];
                  if (matchingParent) {
                    matchingParent.children.push(payTx);
                    processedIds.add(payTx.id);
                  }
                });
              }

              parentOrders.forEach(grp => {
                grp.children.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              });

              transactions.forEach(tx => {
                if (!processedIds.has(tx.id)) {
                  parentOrders.push({ parent: tx, children: [], orderRef: extractRef(tx) });
                }
              });

              return parentOrders;
            })();

            const getShortLabel = (tx) => {
              if (isPaymentTx(tx)) {
                return { short: 'تسديد دفعة', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
              }
              if (tx.type === 'revenue' || tx.type === 'invoice' || tx.category?.includes('مبيعات') || tx.description?.includes('فاتورة مبيعات') || tx.description?.includes('بيع')) {
                return { short: 'فاتورة مبيعات', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
              }
              if (tx.type === 'purchase_order' || tx.category === 'أمر شراء / توريد' || tx.description?.includes('طلب شراء')) {
                return { short: 'طلب شراء', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
              }
              if (tx.type === 'production_order' || tx.category?.includes('أمر تشغيل') || tx.description?.includes('أمر تشغيل')) {
                return { short: 'أمر تشغيل', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
              }
              if (tx.type === 'eso' || tx.category?.includes('تشغيل خارجي')) {
                return { short: 'تشغيل خارجي', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
              }
              return { short: tx.category || tx.type || 'معاملة', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
            };

            const printPdfReport = (groupsToPrint, isGroupPrint = false, groupTitle = '') => {
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

              groupsToPrint.forEach(grp => {
                const parent = grp.parent;
                if (!isPaymentTx(parent)) {
                  totalOrdersAmount += (parseFloat(parent.amount) || 0);
                } else {
                  totalPaidAmount += (parseFloat(parent.amount) || 0);
                }
                grp.children.forEach(child => {
                  totalPaidAmount += (parseFloat(child.amount) || 0);
                });
              });

              const remainingBalance = Math.max(0, totalOrdersAmount - totalPaidAmount);

              let documentTitle = isSupplier ? 'كشف حساب مورد' : 'كشف حساب عميل';
              if (isGroupPrint && groupsToPrint.length === 1) {
                const p = groupsToPrint[0].parent;
                if (isSupplier) {
                  documentTitle = p.type === 'eso' ? 'أمر تشغيل خارجي' : 'أمر شراء وتوريد مواد خام (PO)';
                } else {
                  documentTitle = p.type === 'revenue' || p.type === 'invoice' || p.category?.includes('مبيعات') ? 'فاتورة مبيعات رسمية' : 'أمر تشغيل وإنتاج للعميل';
                }
              }

              let rowsHtml = '';
              groupsToPrint.forEach((grp, gIdx) => {
                const parent = grp.parent;
                const items = parent.items_summary || [];

                let orderBadge = isSupplier ? 'أمر توريد / شراء' : parent.type === 'revenue' || parent.type === 'invoice' || parent.category?.includes('مبيعات') ? 'فاتورة مبيعات' : 'أمر تشغيل وإنتاج';
                if (parent.type === 'eso') orderBadge = 'تشغيل خارجي';

                const payMethodLabel = parent.payment_method === 'cash' ? 'نقدي' : 
                                      parent.payment_method === 'instapay' ? 'انستاباي' : 
                                      parent.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                      parent.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 
                                      parent.payment_method === 'postal_transfer' ? 'حوالة بريدية' : parent.payment_method || '-';

                if (isPaymentTx(parent)) {
                  rowsHtml += `
                    <tr style="background-color: #F0FDF4; border-bottom: 1px dashed #BBF7D0; font-size: 11px;">
                      <td style="padding: 8px 10px; text-align: center; color: #166534; font-weight: bold; width: 14%;">${parent.date}</td>
                      <td style="padding: 8px 10px; text-align: right; color: #166534; font-weight: bold; width: 30%;">سداد دفعة حساب (${payMethodLabel})</td>
                      <td style="padding: 8px 10px; text-align: center; color: #334155; width: 14%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 14%;">—</td>
                      <td style="padding: 8px 10px; text-align: center; width: 14%;">
                        <span style="background: #DCFCE7; color: #15803D; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">تسديد دفعة</span>
                      </td>
                      <td style="padding: 8px 10px; text-align: center; color: #15803D; font-size: 12px; font-weight: 800; width: 14%;">
                        -${parseFloat(parent.amount).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                } else if (items.length > 0) {
                  items.forEach((itm, iIdx) => {
                    const unitPrice = parseFloat(itm.unit_cost) || 0;
                    const itemTotal = (parseFloat(itm.total_cost) > 0) ? parseFloat(itm.total_cost) : (itm.quantity * unitPrice);

                    rowsHtml += `
                      <tr style="background-color: ${iIdx === 0 ? '#F8FAFC' : '#FFFFFF'}; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
                        <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 14%;">
                          ${iIdx === 0 ? `${parent.date}<br><small style="color:#64748B; font-weight:normal;">${grp.orderRef || parent.number || ''}</small>` : ''}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; color: #0F172A; font-weight: bold; width: 30%;">
                          ${itm.name}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 14%;">
                          ${itm.quantity} ${itm.unit || 'وحدة'}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #64748B; font-weight: 600; width: 14%;">
                          ${unitPrice.toFixed(2)} ${currency}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #D97706; width: 14%;">
                          ${iIdx === 0 ? `<span style="background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${orderBadge}</span>` : ''}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; color: #B45309; font-size: 12px; font-weight: 800; width: 14%;">
                          +${itemTotal.toFixed(2)} ${currency}
                        </td>
                      </tr>
                    `;
                  });
                } else {
                  const prodName = parent.description?.match(/منتج:\s*([^|(]+)/)?.[1]?.trim() || parent.category || 'معاملة مالية';
                  const prodQty = parent.description?.match(/\((\d+\s*[\w\u0600-\u06FF]+)\)/)?.[1] || '1 وحدة';

                  rowsHtml += `
                    <tr style="background-color: #F8FAFC; border-bottom: 2px solid #E2E8F0; font-size: 11px;">
                      <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: bold; width: 14%;">${parent.date}</td>
                      <td style="padding: 8px 10px; text-align: right; color: #0F172A; font-weight: bold; width: 30%;">${prodName}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #334155; width: 14%;">${prodQty}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 14%;">${parseFloat(parent.amount).toFixed(2)} ${currency}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #D97706; width: 14%;">
                        <span style="background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${orderBadge}</span>
                      </td>
                      <td style="padding: 8px 10px; text-align: center; color: #B45309; font-size: 12px; font-weight: 800; width: 14%;">
                        +${parseFloat(parent.amount).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                }

                grp.children.forEach(child => {
                  let childLabelText = 'تسديد دفعة';
                  if (child.description?.includes('عربون') || child.category?.includes('عربون') || child.type === 'deposit') {
                    childLabelText = 'دفعة عربون مقدم';
                  }

                  const childPayMethod = child.payment_method === 'cash' ? 'نقدي' : 
                                        child.payment_method === 'instapay' ? 'انستاباي' : 
                                        child.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                        child.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 
                                        child.payment_method === 'postal_transfer' ? 'حوالة بريدية' : child.payment_method || 'نقدي';

                  rowsHtml += `
                    <tr style="background-color: #F0FDF4; border-bottom: 1px dashed #BBF7D0;">
                      <td style="padding: 6px 10px; text-align: center; font-size: 10px; color: #166534; font-weight: 600;">↳ ${child.date}</td>
                      <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #166534;" colspan="2">
                        <span><strong>(دفعة مسددة للطلب أعلاه)</strong> • طريقة الدفع: ${childPayMethod}</span>
                      </td>
                      <td style="padding: 6px 10px; text-align: center;" colspan="2">
                        <span style="background: #DCFCE7; color: #15803D; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                          ${childLabelText}
                        </span>
                      </td>
                      <td style="padding: 6px 10px; text-align: center; font-weight: bold; color: #15803D; font-size: 12px;">
                        -${parseFloat(child.amount).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                });
              });

              printWindow.document.write(`
                <html dir="rtl" lang="ar">
                  <head>
                    <title>${isGroupPrint ? `${documentTitle} - ${item.name}` : `كشف حساب تفصيلي - ${item.name}`}</title>
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
                        <h4>${isGroupPrint ? 'طلب محدد' : 'كشف حساب شامل لكافة الطلبيات'}</h4>
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
                          <th style="width: 14%;">التاريخ / المرجع</th>
                          <th style="text-align: right; width: 30%;">اسم البند / الصنف</th>
                          <th style="width: 14%;">الكمية المطلوبة</th>
                          <th style="width: 14%;">سعر الوحدة</th>
                          <th style="width: 14%;">نوع الحركة</th>
                          <th style="width: 14%;">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>

                    <div class="summary-box">
                      <div class="summary-item">
                        <label>إجمالي قيمة الطلبيات</label>
                        <span style="color: #D97706;">${totalOrdersAmount.toFixed(2)} ${currency}</span>
                      </div>
                      <div class="summary-item">
                        <label>إجمالي المدفوعات المسددة</label>
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
                  {groupedTransactions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printPdfReport(groupedTransactions, false, '')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 flex items-center gap-1"
                      >
                        طباعة كشف الحساب الكامل (PDF)
                      </button>
                    </div>
                  )}
                </div>
                {txLoading ? (
                  <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>جاري تحميل كشف الحساب...</p>
                ) : groupedTransactions.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#A49EC0' }}>لا توجد معاملات مسجلة بعد.</p>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs text-right text-[#D4CEEB] font-medium border-collapse">
                        <thead>
                          <tr className="border-b border-[#3D3554] text-[#A49EC0] bg-[#231B3D]">
                            <th className="py-2.5 px-3 text-right">التاريخ</th>
                            <th className="py-2.5 px-3 text-center">نوع الحركة</th>
                            <th className="py-2.5 px-3 text-left">المبلغ</th>
                            <th className="py-2.5 px-3 text-center">طريقة الدفع</th>
                            <th className="py-2.5 px-3 text-right">البيان وتفاصيل المواد/المنتجات</th>
                            <th className="py-2.5 px-3 text-center">الإجراءات والطباعة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedTransactions.map((grp, gIdx) => {
                            const parent = grp.parent;
                            const parentLabel = getShortLabel(parent);
                            const isGrpExpanded = expandedGroups[gIdx] !== false;
                            const hasChildren = grp.children.length > 0;

                            return (
                              <Fragment key={`group-${gIdx}`}>
                                <tr className="border-b border-[#3D3554]/60 hover:bg-white/5 transition-colors align-middle bg-[#2F264C]">
                                  <td className="py-3 px-3 whitespace-nowrap text-white font-semibold">
                                    <div className="flex items-center gap-2">
                                      {hasChildren && (
                                        <button
                                          onClick={() => toggleGroup(gIdx)}
                                          className="p-1 rounded bg-[#3D3554] text-[#ECC796] hover:bg-white/10"
                                          title={isGrpExpanded ? 'إخفاء الدفعات المرتبطة' : 'عرض الدفعات المرتبطة'}
                                        >
                                          {isGrpExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                      <span>{parent.date}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${parentLabel.color}`}>
                                      {parentLabel.short}
                                    </span>
                                  </td>
                                  <td className={`py-3 px-3 text-left font-bold text-sm ${
                                    isPaymentTx(parent)
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }`}>
                                    {isPaymentTx(parent) ? '-' : '+'} {parseFloat(parent.amount).toFixed(2)} {currency}
                                  </td>
                                  <td className="py-3 px-3 text-center text-[#D4CEEB]">
                                    {parent.payment_method === 'cash' ? 'نقدي' : 
                                     parent.payment_method === 'instapay' ? 'انستاباي' : 
                                     parent.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                     parent.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 
                                     parent.payment_method === 'postal_transfer' ? 'حوالة بريدية' : parent.payment_method || '-'}
                                  </td>
                                  <td className="py-3 px-3 text-white">
                                    <div className="font-semibold text-xs text-[#ECC796]">
                                      {isPaymentTx(parent)
                                        ? `سداد دفعة حساب ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : parent.type === 'purchase_order' || parent.category === 'أمر شراء / توريد' || parent.description?.includes('طلب شراء')
                                        ? `طلب شراء ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : parent.type === 'eso' || parent.category === 'أمر تشغيل خارجي'
                                        ? `أمر تشغيل خارجي ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : parent.type === 'revenue' || parent.type === 'invoice' || parent.category?.includes('مبيعات') || parent.description?.includes('فاتورة مبيعات')
                                        ? `فاتورة مبيعات ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : parent.type === 'production_order' || parent.category?.includes('أمر تشغيل') || (parent.description?.includes('أمر تشغيل') && !parent.description?.includes('تسديد'))
                                        ? `تكلفة أمر تشغيل ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : `${parentLabel.short} ${grp.orderRef ? `(${grp.orderRef})` : ''}`}
                                    </div>
                                    {parent.items_summary && parent.items_summary.length > 0 && (
                                      <div className="transaction-items-box mt-1.5 p-2 rounded-lg bg-black/30 border border-white/10 space-y-1">
                                        <span className="transaction-items-title block text-[10px] font-bold text-[#ECC796]">تفاصيل البنود والكميات:</span>
                                        {parent.items_summary.map((itm, iIdx) => (
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
                                      {onUndoPayment && isPaymentTx(parent) && (
                                        <button
                                          onClick={() => onUndoPayment(item.id, parent.id)}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors rounded text-[10px] font-bold border border-red-500/30"
                                          title="التراجع عن هذا السداد وإلغاء القيد المالي"
                                        >
                                          ↩ تراجع
                                        </button>
                                      )}
                                      <button
                                        onClick={() => printPdfReport([grp], true, parentLabel.short)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 transition-colors rounded text-[10px] font-bold border border-[#ECC796]/30"
                                        title="طباعة PDF لهذه المجموعة فقط"
                                      >
                                        <FileText className="w-3 h-3" />
                                        PDF لمجموعة
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedTx({
                                            ...parent,
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

                                {hasChildren && isGrpExpanded && grp.children.map((child, cIdx) => {
                                  const childLabel = getShortLabel(child);
                                  return (
                                    <tr key={`child-${gIdx}-${cIdx}`} className="border-b border-[#3D3554]/40 bg-[#251E38] hover:bg-white/5 transition-colors align-middle">
                                      <td className="py-2 px-3 pr-8 whitespace-nowrap text-gray-300 text-[11px]">
                                        <span className="text-[#ECC796] font-bold ml-1">↳</span> {child.date}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${childLabel.color}`}>
                                          {childLabel.short}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-left font-bold text-xs text-emerald-400">
                                        - {parseFloat(child.amount).toFixed(2)} {currency}
                                      </td>
                                      <td className="py-2 px-3 text-center text-xs text-[#D4CEEB]">
                                        {child.payment_method === 'cash' ? 'نقدي' : 
                                         child.payment_method === 'instapay' ? 'انستاباي' : 
                                         child.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                         child.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 
                                         child.payment_method === 'postal_transfer' ? 'حوالة بريدية' : child.payment_method || '-'}
                                      </td>
                                      <td className="py-2 px-3 text-gray-300 text-[11px]">
                                        <div className="flex items-center gap-1 text-emerald-300">
                                          <span>↳</span>
                                          <span>{child.description || 'دفعة مسددة لهذا الطلب'}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-center whitespace-nowrap">
                                        {onUndoPayment && (
                                          <button
                                            onClick={() => onUndoPayment(item.id, child.id)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors rounded text-[10px] font-bold border border-red-500/30"
                                            title="التراجع عن هذا السداد وإلغاء القيد المالي"
                                          >
                                            ↩ تراجع
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#ECC796]/40 bg-[#231B3D]">
                            <td colSpan={2} className="py-3 px-3 font-extrabold text-white text-xs">
                              إجمالي كشف الحساب ({groupedTransactions.length} مجموعة حركات)
                            </td>
                            <td className="py-3 px-2 text-left font-black text-emerald-400 text-sm font-mono">
                              {(() => {
                                const totalPaid = transactions
                                  .filter(tx => isPaymentTx(tx))
                                  .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
                                return `إجمالي المدفوع: ${totalPaid.toFixed(2)} ${currency}`;
                              })()}
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

                    {/* Mobile Responsive Cards */}
                    <div className="block md:hidden space-y-3">
                      {groupedTransactions.map((grp, gIdx) => {
                        const parent = grp.parent;
                        const parentLabel = getShortLabel(parent);
                        const isGrpExpanded = !!expandedGroups[gIdx];
                        const hasChildren = grp.children.length > 0;

                        return (
                          <div key={`mob-group-${gIdx}`} className="bg-[#2F264C] border border-[#3D3554] rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${parentLabel.color}`}>
                                  {parentLabel.short}
                                </span>
                                <span className="text-xs font-semibold text-white">{parent.date}</span>
                              </div>
                              <span className={`font-bold text-sm ${
                                isPaymentTx(parent)
                                  ? 'text-emerald-400'
                                  : 'text-amber-300'
                              }`}>
                                {isPaymentTx(parent) ? '-' : '+'} {parseFloat(parent.amount).toFixed(2)} {currency}
                              </span>
                            </div>

                            <div className="text-xs text-[#ECC796] font-semibold">
                              {parent.type === 'purchase_order' || parent.category === 'أمر شراء / توريد' || parent.description?.includes('طلب شراء')
                                ? `طلب شراء ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                : parent.type === 'eso' || parent.category === 'أمر تشغيل خارجي'
                                ? `أمر تشغيل خارجي ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                : parent.type === 'revenue' || parent.category?.includes('مبيعات') || parent.description?.includes('فاتورة مبيعات')
                                ? `فاتورة مبيعات ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                : parent.type === 'production_order' || parent.category?.includes('أمر تشغيل') || (parent.description?.includes('أمر تشغيل') && !parent.description?.includes('تسديد'))
                                ? `تكلفة أمر تشغيل ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                : `${parentLabel.short} ${grp.orderRef ? `(${grp.orderRef})` : ''}`}
                            </div>

                            {parent.items_summary && parent.items_summary.length > 0 && (
                              <div className="p-2 rounded-lg bg-black/40 border border-white/10 space-y-1">
                                <span className="block text-[10px] font-bold text-[#ECC796]">التفاصيل والبنود:</span>
                                {parent.items_summary.map((itm, iIdx) => (
                                  <div key={iIdx} className="flex items-center justify-between text-[10px]">
                                    <span className="text-gray-200">{itm.name}</span>
                                    <span className="text-emerald-400 font-bold">{itm.quantity} {itm.unit} × {itm.unit_cost}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-[#3D3554]/50">
                              <span className="text-[10px] text-gray-400">
                                الدفع: {parent.payment_method === 'cash' ? 'نقدي' : parent.payment_method === 'instapay' ? 'انستاباي' : parent.payment_method === 'vodafone_cash' ? 'فودافون كاش' : parent.payment_method || '-'}
                              </span>

                              <div className="flex items-center gap-2">
                                {onUndoPayment && isPaymentTx(parent) && (
                                  <button
                                    onClick={() => onUndoPayment(item.id, parent.id)}
                                    className="px-2 py-1 bg-red-600/80 text-white rounded text-[10px] font-bold"
                                  >
                                    تراجع
                                  </button>
                                )}

                                {hasChildren && (
                                  <button
                                    onClick={() => toggleGroup(gIdx)}
                                    className="px-2 py-1 rounded bg-[#3D3554] text-[#ECC796] text-[10px] font-bold flex items-center gap-1"
                                  >
                                    <span>{grp.children.length} دفعات</span>
                                    {isGrpExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}

                                <button
                                  onClick={() => printPdfReport([grp], true, parentLabel.short)}
                                  className="px-2 py-1 bg-[#3D3554] text-[#ECC796] rounded text-[10px] font-bold border border-[#ECC796]/30 flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  PDF
                                </button>
                              </div>
                            </div>

                            {/* Nested Mobile Payments */}
                            {hasChildren && isGrpExpanded && (
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-2 pr-2 border-r-2 border-r-[#ECC796]">
                                {grp.children.map((child, cIdx) => {
                                  const childLabel = getShortLabel(child);
                                  return (
                                    <div key={`mob-child-${gIdx}-${cIdx}`} className="bg-[#211A35] p-2 rounded-lg text-xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-gray-400">↳ {child.date}</span>
                                        <span className="font-bold text-emerald-400">-{parseFloat(child.amount).toFixed(2)} {currency}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-gray-300">{child.description || childLabel.short}</span>
                                        {onUndoPayment && (
                                          <button
                                            onClick={() => onUndoPayment(item.id, child.id)}
                                            className="px-1.5 py-0.5 bg-red-600/80 text-white rounded text-[9px]"
                                          >
                                            تراجع
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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

