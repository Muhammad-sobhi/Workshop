import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Wallet,
  Printer
} from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function EmployeeLedgerModal({ employee, isOpen, onClose }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (isOpen && employee?.id) {
      fetchLedger();
    }
  }, [isOpen, employee?.id, page, dateFrom, dateTo]);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/employees/${employee.id}/ledger`, {
        params: {
          page,
          start_date: dateFrom || undefined,
          end_date: dateTo || undefined,
          per_page: 20
        }
      });
      setStatement(res.data.statement);
    } catch (err) {
      console.error('Error fetching ledger:', err);
      setError('تعذر تحميل كشف الحساب. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    if (!statement?.data) return { credit: 0, debit: 0, balance: 0 };
    
    let credit = 0;
    let debit = 0;
    
    statement.data.forEach(row => {
      const amt = Number(row.amount) || 0;
      if (row.type === 'credit') credit += amt;
      else debit += amt;
    });
    
    const balance = credit - debit;
    return { credit, debit, balance };
  }, [statement]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة (Pop-ups) لطباعة الكشف');
      return;
    }

    const html = `
      <html dir="rtl">
        <head>
          <title>كشف حساب الموظف - ${employee.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { 
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
              direction: rtl; 
              color: #000; 
              background: #fff;
              margin: 0;
            }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: 900; margin: 0; }
            .meta { font-size: 11px; color: #555; margin: 4px 0 0; }
            .kpis { display: flex; gap: 16px; margin-bottom: 16px; }
            .kpi-box { border: 1px solid #ccc; border-radius: 6px; padding: 8px 14px; flex: 1; text-align: center; }
            .kpi-label { font-size: 10px; color: #555; display: block; }
            .kpi-value { font-size: 15px; font-weight: 900; display: block; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: right; font-weight: 700; }
            td { border: 1px solid #ddd; padding: 5px 8px; text-align: right; }
            tr:nth-child(even) td { background: #fafafa; }
            .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">كشف حساب الموظف — ${employee.name}</h1>
            <p class="meta">الفترة: ${periodLabel} &nbsp;|&nbsp; تاريخ الطباعة: ${today}</p>
          </div>
          
          <div class="kpis">
            <div class="kpi-box">
              <span class="kpi-label">إجمالي المستحقات (دائن)</span>
              <span class="kpi-value">${totals.credit.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">إجمالي المنصرف (مدين)</span>
              <span class="kpi-value">${totals.debit.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">الرصيد المتبقي (صافي دين)</span>
              <span class="kpi-value">${totals.balance.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          ${statement?.data && statement.data.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>المصدر</th>
                  <th>البيان</th>
                  <th>المبلغ (ج.م)</th>
                  <th>الرصيد التراكمي (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                ${statement.data.map(row => `
                  <tr>
                    <td>${row.entry_date}</td>
                    <td>${row.type === 'credit' ? 'مستحق (دائن)' : 'منصرف (مدين)'}</td>
                    <td>${SOURCE_TYPE_LABELS[row.source_type] || row.source_type || '—'}</td>
                    <td>${row.description || '—'}</td>
                    <td>${(Number(row.amount) || 0).toLocaleString('ar-EG')}</td>
                    <td>${(Number(row.running_balance) || 0).toLocaleString('ar-EG')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <p style="text-align: center; color: #999; margin-top: 30px;">لا توجد حركات مسجلة لهذه الفترة</p>
          `}

          <div class="footer">
            <span>نظام إدارة الورشة</span>
            <span>موظف: ${employee.name}</span>
          </div>

          <script>
            window.onload = () => { 
              window.print(); 
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!isOpen || !employee) return null;

  const SOURCE_TYPE_LABELS = {
    'timesheet': 'يوميات عمل',
    'production_log': 'تسجيل إنتاج',
    'salary_payout': 'صرف راتب',
    'advance': 'سلفة نقدية',
    'manual': 'قيد يدوي'
  };

  const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const periodLabel = dateFrom || dateTo
    ? `${dateFrom || '—'} → ${dateTo || '—'}`
    : 'كل الفترات';

  return (
    <>

      {/* ===== ON-SCREEN MODAL (unchanged appearance) ===== */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
        <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#3D3554] bg-[#231B3D] shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#3D3554] sticky top-0 bg-[#231B3D] z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#2F264C] border border-[#3D3554] text-[#ECC796]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">كشف حساب الأستاذ العام للموظف</h3>
                <p className="text-xs text-[#A49EC0]">
                  {employee.name} • {employee.job_title || 'موظف'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#A49EC0] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#2F264C] p-4 rounded-xl border border-[#3D3554] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#A49EC0] block mb-1">إجمالي المستحقات (دائن)</span>
                  <span className="text-lg font-black text-[#13DEB9]">
                    {totals.credit.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#13DEB9]/15 border border-[#13DEB9]/30 flex items-center justify-center text-[#13DEB9]">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#2F264C] p-4 rounded-xl border border-[#3D3554] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#A49EC0] block mb-1">إجمالي المنصرف (مدين)</span>
                  <span className="text-lg font-black text-red-400">
                    {totals.debit.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#2F264C] p-4 rounded-xl border border-[#3D3554] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#A49EC0] block mb-1">الرصيد المتبقي (صافي دين)</span>
                  <span className={`text-lg font-black ${totals.balance >= 0 ? 'text-[#ECC796]' : 'text-red-400'}`}>
                    {totals.balance.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#ECC796]/15 border border-[#ECC796]/30 flex items-center justify-center text-[#ECC796]">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="bg-[#2F264C] p-3.5 rounded-xl border border-[#3D3554] flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-[#A49EC0]">
                <Calendar className="w-4 h-4 text-[#ECC796]" />
                <span>تصفية حسب التاريخ:</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A49EC0]">من:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className="bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-lg px-2.5 py-1 focus:border-[#ECC796] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A49EC0]">إلى:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className="bg-[#231B3D] border border-[#3D3554] text-white text-xs rounded-lg px-2.5 py-1 focus:border-[#ECC796] focus:outline-none"
                />
              </div>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                  className="text-xs text-[#ECC796] hover:underline mr-auto"
                >
                  إلغاء التصفية
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Statement Table */}
            <div className="bg-[#2F264C] rounded-xl border border-[#3D3554] overflow-hidden">
              {loading ? (
                <div className="p-12 flex justify-center items-center text-[#A49EC0]">
                  <Loader2 className="w-7 h-7 animate-spin text-[#ECC796]" />
                </div>
              ) : statement?.data && statement.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#231B3D] text-[#A49EC0] font-bold border-b border-[#3D3554]">
                      <tr>
                        <th className="py-3 px-4">التاريخ</th>
                        <th className="py-3 px-4">النوع</th>
                        <th className="py-3 px-4">المصدر</th>
                        <th className="py-3 px-4">البيان</th>
                        <th className="py-3 px-4">المبلغ</th>
                        <th className="py-3 px-4">الرصيد التراكمي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3D3554]/40 text-white font-medium">
                      {statement.data.map(row => {
                        const isCredit = row.type === 'credit';
                        return (
                          <tr key={row.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap text-[#A49EC0]">{row.entry_date}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                isCredit 
                                  ? 'bg-[#13DEB9]/15 text-[#13DEB9] border-[#13DEB9]/30' 
                                  : 'bg-red-500/15 text-red-400 border-red-500/30'
                              }`}>
                                {isCredit ? 'مستحق (دائن)' : 'منصرف (مدين)'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-[#A49EC0]">
                              {SOURCE_TYPE_LABELS[row.source_type] || row.source_type || '—'}
                            </td>
                            <td className="py-3 px-4 text-white">
                              {row.description || '—'}
                            </td>
                            <td className={`py-3 px-4 font-black ${isCredit ? 'text-[#13DEB9]' : 'text-red-400'}`}>
                              {(Number(row.amount) || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="py-3 px-4 font-bold text-[#ECC796]">
                              {(Number(row.running_balance) || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-[#A49EC0]">
                  لا توجد حركات مسجلة في كشف الحساب لهذه الفترة
                </div>
              )}

              {/* Pagination */}
              {statement?.last_page > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#3D3554] bg-[#231B3D] text-xs text-[#A49EC0]">
                  <div>
                    صفحة {statement.current_page} من {statement.last_page} (إجمالي {statement.total} حركة)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={statement.current_page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      disabled={statement.current_page >= statement.last_page}
                      onClick={() => setPage(p => p + 1)}
                      className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] hover:bg-white/5 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#3D3554] bg-[#231B3D] flex items-center justify-between">
            {/* Print button */}
            <button
              onClick={handlePrint}
              disabled={loading || !statement?.data?.length}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#ECC796]/10 border border-[#ECC796]/40 text-[#ECC796] hover:bg-[#ECC796]/20 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ كـ PDF
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#2F264C] border border-[#3D3554] text-[#A49EC0] hover:bg-white/5 text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>
    </>
  );
}



