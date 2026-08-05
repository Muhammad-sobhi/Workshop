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
                        const rows = transactions.map(tx => `
                          <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${tx.date}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${tx.category || tx.type}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${tx.number || '-'}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${parseFloat(tx.amount).toFixed(2)} ${currency}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${tx.description || '-'}</td>
                          </tr>
                        `).join('');
                        printWindow.document.write(`
                          <html dir="rtl" lang="ar">
                            <head>
                              <title>كشف حساب - ${item.name}</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 20px; text-align: right; }
                                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                th { background-color: #2F264C; color: #fff; padding: 10px; border: 1px solid #ddd; }
                                h2, h3 { margin: 5px 0; }
                              </style>
                            </head>
                            <body>
                              <h2>كشف حساب حركة مالية</h2>
                              <h3>الجهة: ${item.name}</h3>
                              <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                              <table>
                                <thead>
                                  <tr>
                                    <th>التاريخ</th>
                                    <th>نوع الحركة</th>
                                    <th>الرقم المرجعي</th>
                                    <th>المبلغ</th>
                                    <th>البيان</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${rows}
                                </tbody>
                              </table>
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
                        <th className="py-2.5 px-2">البيان</th>
                        <th className="py-2.5 px-2 text-center">الإيصال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b border-[#3D3554]/50 hover:bg-white/5 transition-colors">
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
                          <td className="py-2.5 px-2 max-w-[200px] truncate text-white" title={tx.description}>{tx.description}</td>
                          <td className="py-2.5 px-2 text-center">
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
                              عرض التفاصيل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
