'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Phone, Mail, MapPin, Package, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link, Unlink, FileText, Eye, Calendar, Landmark } from 'lucide-react';
import apiClient from '@/lib/api-client';
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';

export default function SupplierCard({
  item, isExpanded, activeTab, currency,
  onToggle, onEdit, onDelete, onAddMaterial, onPayDebt, onRemoveMaterial, onUndoPayment,
}) {
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
            const groupedTransactions = (() => {
              if (!transactions || transactions.length === 0) return [];
              const groups = [];
              const processedIds = new Set();

              // Cleanly extract reference code (e.g. PO-2026-0001, OP-2026-0001, ESO-2026-0001)
              const extractRef = (tx) => {
                // Priority 1: Parent order reference inside parentheses e.g. (PO-2026-0001)
                const descParentMatch = tx.description?.match(/\((PO-\d+-\d+|OP-\d+-\d+|ESO-\d+-\d+|SO-\d+-\d+)\)/i);
                if (descParentMatch) return descParentMatch[1].toUpperCase();

                // Priority 2: Any parent order reference in description e.g. PO-2026-0001
                const generalParentMatch = tx.description?.match(/(PO-\d+-\d+|OP-\d+-\d+|ESO-\d+-\d+|SO-\d+-\d+)/i);
                if (generalParentMatch) return generalParentMatch[0].toUpperCase();

                // Priority 3: If transaction number itself is a parent order number (PO-XXXX, OP-XXXX, ESO-XXXX)
                if (tx.number && /^(PO|OP|ESO|SO)-\d+-\d+/i.test(tx.number)) {
                  return tx.number.toUpperCase();
                }

                // Priority 4: Fallback for standalone expense numbers (EXP-XXXX)
                if (tx.number && /^EXP-\d+-\d+/i.test(tx.number)) {
                  return tx.number.toUpperCase();
                }

                return null;
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

              // First pass: Group transactions with explicit matching order references
              Object.keys(refMap).forEach(ref => {
                const txList = refMap[ref];
                const parent = txList.find(tx => 
                  tx.type === 'production_order' || 
                  tx.type === 'purchase_order' ||
                  tx.type === 'eso' ||
                  tx.category === 'أمر شراء / توريد' ||
                  tx.category === 'أمر تشغيل' ||
                  (tx.description?.includes('أمر تشغيل') && !tx.description?.includes('دفعة') && !tx.description?.includes('تسديد'))
                );

                if (parent) {
                  const children = txList.filter(tx => tx.id !== parent.id);
                  txList.forEach(tx => processedIds.add(tx.id));
                  parentOrders.push({ parent, children, orderRef: ref });
                }
              });

              // Second pass: For standalone payment expenses without explicit PO tag in text, link them to open parent orders if available
              const unassignedExpenses = transactions.filter(tx => 
                !processedIds.has(tx.id) && 
                (tx.type === 'expense' || tx.category === 'تسديد ديون موردين' || tx.description?.includes('تسديد'))
              );

              if (unassignedExpenses.length > 0 && parentOrders.length > 0) {
                unassignedExpenses.forEach(expTx => {
                  // Attach to parent order (prefer matching date or closest parent)
                  const matchingParent = parentOrders.find(p => p.parent.date === expTx.date) || parentOrders[0];
                  if (matchingParent) {
                    matchingParent.children.push(expTx);
                    processedIds.add(expTx.id);
                  }
                });
              }

              // Final pass: Standalone items that are remaining
              transactions.forEach(tx => {
                if (!processedIds.has(tx.id)) {
                  parentOrders.push({ parent: tx, children: [], orderRef: extractRef(tx) });
                }
              });

              return parentOrders;
            })();

            const getShortLabel = (tx) => {
              if (tx.category === 'أمر شراء / توريد' || tx.description?.includes('طلب شراء')) {
                return { short: 'طلب شراء', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
              }
              if (tx.type === 'production_order' || tx.category?.includes('أمر تشغيل') || tx.description?.includes('أمر تشغيل')) {
                return { short: 'أمر تشغيل', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
              }
              if (tx.category === 'شراء مواد خام' || tx.description?.includes('تكلفة دفعة') || tx.description?.includes('تكلفة فاتورة')) {
                return { short: 'تكلفة فاتورة', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
              }
              if (tx.category === 'تسديد ديون موردين' || tx.type === 'deposit' || tx.description?.includes('تسديد') || tx.description?.includes('سداد')) {
                return { short: 'تسديد دفعة', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
              }
              return { short: tx.category || tx.type || 'معاملة', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
            };

            const printPdfReport = (groupsToPrint, isGroupPrint = false, groupTitle = '') => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const isSupplier = activeTab === 'suppliers';
              
              // Calculate total order amount, total paid amount and remaining balance for groups to print
              let totalOrdersAmount = 0;
              let totalPaidAmount = 0;

              groupsToPrint.forEach(grp => {
                const parent = grp.parent;
                totalOrdersAmount += (parseFloat(parent.amount) || 0);
                grp.children.forEach(child => {
                  totalPaidAmount += (parseFloat(child.amount) || 0);
                });
              });

              const remainingBalance = Math.max(0, totalOrdersAmount - totalPaidAmount);

              // Determine order/transaction header label
              let transactionTypeHeader = isSupplier ? 'طلب توريد مواد / خدمة' : 'طلب إنتاج';
              if (isGroupPrint && groupsToPrint.length === 1) {
                const p = groupsToPrint[0].parent;
                const pName = p.items_summary && p.items_summary.length > 0 ? p.items_summary[0].name : '';
                transactionTypeHeader = `طلب إنتاج ${pName ? `- ${pName}` : ''}`;
              }

              let rowsHtml = '';
              groupsToPrint.forEach((grp) => {
                const parent = grp.parent;
                
                // Extract clean product details for parent
                const prodName = parent.items_summary && parent.items_summary.length > 0
                  ? parent.items_summary.map(i => i.name).join(', ')
                  : (parent.description?.match(/منتج:\s*([^|(]+)/)?.[1]?.trim() || parent.category || 'منتج');

                const prodQty = parent.items_summary && parent.items_summary.length > 0
                  ? parent.items_summary.map(i => `${i.quantity} ${i.unit || 'حبة'}`).join(', ')
                  : (parent.description?.match(/\((\d+\s*حبة)\)/)?.[1] || '1 حبة');

                rowsHtml += `
                  <tr style="background-color: #F8FAFC; font-weight: bold; border-bottom: 2px solid #E2E8F0;">
                    <td style="padding: 8px 10px; text-align: center; color: #334155; width: 15%;">${parent.date}</td>
                    <td style="padding: 8px 10px; text-align: right; color: #0F172A; width: 35%;">${prodName}</td>
                    <td style="padding: 8px 10px; text-align: center; color: #475569; width: 12%;">${prodQty}</td>
                    <td style="padding: 8px 10px; text-align: center; color: #D97706; width: 15%;">
                      <span style="background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-size: 11px;">
                        ${isSupplier ? 'طلب توريد' : 'أمر تشغيل'}
                      </span>
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: #64748B; width: 11%;">
                      ${parent.payment_method === 'cash' ? 'نقدي' : parent.payment_method === 'instapay' ? 'انستاباي' : parent.payment_method === 'vodafone_cash' ? 'فودافون كاش' : parent.payment_method || '-'}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: #B45309; font-size: 12px; width: 12%;">
                      +${parseFloat(parent.amount).toFixed(2)} ${currency}
                    </td>
                  </tr>
                `;

                grp.children.forEach(child => {
                  let childLabelText = 'تسديد دفعة';
                  if (child.description?.includes('عربون') || child.category?.includes('عربون')) {
                    childLabelText = 'دفعة عربون';
                  }

                  rowsHtml += `
                    <tr style="background-color: #FFFFFF; border-bottom: 1px solid #F1F5F9;">
                      <td style="padding: 6px 10px; text-align: center; font-size: 10px; color: #64748B;">↳ ${child.date}</td>
                      <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #64748B;" colSpan="2">
                        <span>(دفعة تسديد مرتبطة بالطلب)</span>
                      </td>
                      <td style="padding: 6px 10px; text-align: center;">
                        <span style="background: #F3E8FF; color: #6B21A8; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                          ${childLabelText}
                        </span>
                      </td>
                      <td style="padding: 6px 10px; text-align: center; font-size: 10px; color: #64748B;">
                        ${child.payment_method === 'cash' ? 'نقدي' : child.payment_method === 'instapay' ? 'انستاباي' : child.payment_method === 'vodafone_cash' ? 'فودافون كاش' : child.payment_method || '-'}
                      </td>
                      <td style="padding: 6px 10px; text-align: center; font-weight: bold; color: #15803D; font-size: 11px;">
                        -${parseFloat(child.amount).toFixed(2)} ${currency}
                      </td>
                    </tr>
                  `;
                });
              });

              printWindow.document.write(`
                <html dir="rtl" lang="ar">
                  <head>
                    <title>${isGroupPrint ? `تقرير حركة - ${groupTitle}` : `كشف حساب تفصيلي - ${item.name}`}</title>
                    <style>
                      @media print { @page { size: A4; margin: 10mm; } }
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0F172A; line-height: 1.5; background: #fff; direction: rtl; text-align: right; }
                      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1E1B4B; padding-bottom: 10px; margin-bottom: 15px; }
                      .brand h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1E1B4B; }
                      .brand p { margin: 2px 0 0 0; font-size: 11px; color: #64748B; }
                      .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
                      .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 8px; text-align: right; }
                      .info-card p { margin: 0; font-size: 10px; color: #64748B; font-weight: 600; }
                      .info-card h4 { margin: 2px 0 0 0; font-size: 12px; font-weight: 800; color: #0F172A; }
                      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                      th { background-color: #1E1B4B; color: #ffffff; padding: 8px; text-align: center; font-size: 11px; }
                      .summary-box { margin-top: 15px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
                      .summary-item label { display: block; font-size: 10px; color: #64748B; font-weight: bold; margin-bottom: 2px; }
                      .summary-item span { font-size: 14px; font-weight: 800; }
                      .footer { margin-top: 20px; border-top: 1px solid #E2E8F0; padding-top: 8px; text-align: center; font-size: 10px; color: #94A3B8; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <div class="brand">
                        <h1>نظام إدارة الورشة والإنتاج</h1>
                        <p>${isGroupPrint ? `تقرير تفصيلي للحركة والطلب` : 'كشف حساب تفصيلي للمعاملات والمدفوعات'}</p>
                      </div>
                      <div style="text-align: left;">
                        <p style="margin:0; font-size: 11px; font-weight: bold; color: #334155;">نوع الحساب: ${isSupplier ? 'مورد' : 'عميل'}</p>
                        <p style="margin:2px 0 0 0; font-size: 10px; color: #64748B;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                      </div>
                    </div>

                    <div class="info-grid">
                      <div class="info-card">
                        <p>الجهة / الاسم</p>
                        <h4>${item.name}</h4>
                      </div>
                      <div class="info-card">
                        <p>نوع المعاملة</p>
                        <h4>${transactionTypeHeader}</h4>
                      </div>
                      <div class="info-card" style="border-right: 4px solid ${remainingBalance > 0 ? '#EF4444' : '#10B981'};">
                        <p>${remainingBalance > 0 ? (isSupplier ? 'الدين المتبقي للمورد' : 'المطلوب المتبقي من العميل') : 'الحساب متوازن'}</p>
                        <h4 style="color: ${remainingBalance > 0 ? '#DC2626' : '#059669'};">
                          ${remainingBalance.toFixed(2)} ${currency}
                        </h4>
                      </div>
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th style="width: 15%;">التاريخ</th>
                          <th style="text-align: right; width: 35%;">اسم المنتج / المادة</th>
                          <th style="width: 12%;">الكمية</th>
                          <th style="width: 15%;">نوع الحركة</th>
                          <th style="width: 11%;">طريقة الدفع</th>
                          <th style="width: 12%;">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>

                    <div class="summary-box">
                      <div class="summary-item">
                        <label>إجمالي التكلفة الكلية</label>
                        <span style="color: #D97706;">${totalOrdersAmount.toFixed(2)} ${currency}</span>
                      </div>
                      <div class="summary-item">
                        <label>إجمالي الدفعات المسددة</label>
                        <span style="color: #16A34A;">${totalPaidAmount.toFixed(2)} ${currency}</span>
                      </div>
                      <div class="summary-item">
                        <label>إجمالي المتبقي المستحق</label>
                        <span style="color: ${remainingBalance > 0 ? '#DC2626' : '#059669'};">${remainingBalance.toFixed(2)} ${currency}</span>
                      </div>
                    </div>

                    <div class="footer">
                      <p>تم استخراج هذا التقرير المنظم تلقائياً من نظام إدارة الورشة بتاريخ ${new Date().toLocaleString('ar-EG')}</p>
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
                                    parent.type === 'deposit' || parent.category === 'خدمات خارجية' || parent.category === 'تسديد ديون موردين'
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }`}>
                                    {parent.type === 'deposit' || parent.category === 'خدمات خارجية' || parent.category === 'تسديد ديون موردين' ? '-' : '+'} {parseFloat(parent.amount).toFixed(2)} {currency}
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
                                      {parent.type === 'purchase_order' || parent.category === 'أمر شراء / توريد' || parent.description?.includes('طلب شراء')
                                        ? `طلب شراء ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                        : parent.type === 'eso' || parent.category === 'أمر تشغيل خارجي'
                                        ? `أمر تشغيل خارجي ${grp.orderRef ? `(${grp.orderRef})` : ''}`
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
                                              {itm.quantity} {itm.unit} × EGP {itm.unit_cost} = <strong className="text-emerald-400 font-bold">EGP {(itm.total_cost || itm.quantity * itm.unit_cost).toFixed(2)}</strong>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
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
                                      <td className="py-2 px-3 text-center text-xs text-gray-300">
                                        {child.payment_method === 'cash' ? 'نقدي' : 
                                         child.payment_method === 'instapay' ? 'انستاباي' : 
                                         child.payment_method === 'vodafone_cash' ? 'فودافون كاش' : child.payment_method || '-'}
                                      </td>
                                      <td className="py-2 px-3 text-gray-200 text-xs">
                                        <span>{child.description || childLabel.short}</span>
                                      </td>
                                      <td className="py-2 px-3 text-center whitespace-nowrap">
                                        {onUndoPayment && (child.type === 'expense' || child.category === 'تسديد ديون موردين' || (child.id && child.id.toString().startsWith('exp-'))) && (
                                          <button
                                            onClick={() => onUndoPayment(item.id, child.id.toString().replace('exp-', ''))}
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
                                  .filter(tx => tx.type === 'deposit' || tx.type === 'expense' || tx.type === 'milestone' || (tx.category && (tx.category.includes('تسديد') || tx.category.includes('سداد') || tx.category.includes('عربون'))))
                                  .filter(tx => !tx.id || !tx.id.toString().startsWith('po-') || tx.id.toString().startsWith('po-dep-'))
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
                                parent.type === 'deposit' || parent.category === 'خدمات خارجية' || parent.category === 'تسديد ديون موردين'
                                  ? 'text-emerald-400'
                                  : 'text-amber-300'
                              }`}>
                                {parent.type === 'deposit' || parent.category === 'خدمات خارجية' || parent.category === 'تسديد ديون موردين' ? '-' : '+'} {parseFloat(parent.amount).toFixed(2)} {currency}
                              </span>
                            </div>

                            <div className="text-xs text-[#ECC796] font-semibold">
                              {parent.type === 'purchase_order' || parent.category === 'أمر شراء / توريد' || parent.description?.includes('طلب شراء')
                                ? `طلب شراء ${grp.orderRef ? `(${grp.orderRef})` : ''}`
                                : parent.type === 'eso' || parent.category === 'أمر تشغيل خارجي'
                                ? `أمر تشغيل خارجي ${grp.orderRef ? `(${grp.orderRef})` : ''}`
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
                                        {onUndoPayment && (child.type === 'expense' || child.category === 'تسديد ديون موردين' || (child.id && child.id.toString().startsWith('exp-'))) && (
                                          <button
                                            onClick={() => onUndoPayment(item.id, child.id.toString().replace('exp-', ''))}
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

