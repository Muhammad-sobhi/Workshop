import { ArrowUpRight, ArrowDownRight, DollarSign, Smartphone, Building2, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { exportToCSV, exportToPDF } from '@/lib/utils';

function pmIcon(method) {
  switch (method) {
    case 'cash': return <DollarSign className="w-3 h-3" />;
    case 'instapay':
    case 'vodafone_cash': return <Smartphone className="w-3 h-3" />;
    case 'bank_transfer': return <Building2 className="w-3 h-3" />;
    case 'postal_transfer': return <Landmark className="w-3 h-3" />;
    default: return null;
  }
}

export default function TransactionsTable({ loading, filtered, setFilterType, filterType, paymentMethodFilter, setPaymentMethodFilter, currency, onViewDetails }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#3D3554' }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">سجل المعاملات المالية</h3>
          {paymentMethodFilter && (
            <button
              onClick={() => setPaymentMethodFilter(null)}
              className="px-2 py-0.5 rounded text-[10px] font-bold border transition-colors hover:bg-white/10"
              style={{ borderColor: '#ECC796', color: '#ECC796' }}
            >
              إلغاء تصفية المحفظة ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {['all', 'revenue', 'expense'].map(type => (
              <button key={type} onClick={() => setFilterType(type)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filterType === type ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' } : { background: '#2F264C', color: '#A49EC0' }}>
                {type === 'all' ? 'الكل' : type === 'revenue' ? 'إيرادات' : 'مصروفات'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-[#3D3554]" />
          <button
            onClick={() => {
              const headersMap = {
                'النوع': 'type_ar',
                'رقم السند': 'number',
                'العميل / المورد': 'entity_name',
                'الفئة': 'category',
                'الوصف': 'description',
                'التاريخ': 'date',
                'طريقة الدفع': 'payment_method_ar',
                'المبلغ': 'amount',
              };
              const mappedData = filtered.map(t => ({
                ...t,
                type_ar: t.type === 'revenue' ? 'إيراد' : 'مصروف',
                entity_name: t.client_name || t.supplier_name || '—',
                payment_method_ar:
                  t.payment_method === 'cash' ? 'نقدي' :
                  t.payment_method === 'instapay' ? 'انستاباي' :
                  t.payment_method === 'vodafone_cash' ? 'فودافون' :
                  t.payment_method === 'postal_transfer' ? 'حوالة بريدية' :
                  t.payment_method ? 'بنكي' : '—',
              }));
              exportToCSV(mappedData, 'transactions.csv', headersMap);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2F264C] text-[#ECC796] hover:bg-[#3D3554] transition-all"
          >
            تصدير Excel
          </button>
          <button
            onClick={() => {
              const mappedData = filtered.map(t => ({
                ...t,
                type_ar: t.type === 'revenue' ? 'إيراد' : 'مصروف',
                entity_name: t.client_name || t.supplier_name || '—',
                payment_method_ar:
                  t.payment_method === 'cash' ? 'نقدي' :
                  t.payment_method === 'instapay' ? 'انستاباي' :
                  t.payment_method === 'vodafone_cash' ? 'فودافون' :
                  t.payment_method === 'postal_transfer' ? 'حوالة بريدية' :
                  t.payment_method ? 'بنكي' : '—',
                amount_formatted: (t.type === 'revenue' ? '+' : '-') + parseFloat(t.amount || 0).toFixed(2),
              }));
              exportToPDF(
                'تقرير الحسابات والمعاملات المالية',
                ['النوع', 'رقم السند', 'العميل / المورد', 'الفئة', 'الوصف', 'التاريخ', 'طريقة الدفع', 'المبلغ'],
                mappedData,
                ['type_ar', 'number', 'entity_name', 'category', 'description', 'date', 'payment_method_ar', 'amount_formatted']
              );
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2F264C] text-[#ECC796] hover:bg-[#3D3554] transition-all"
          >
            تصدير PDF
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
                {['النوع', 'رقم السند', 'العميل / المورد', 'الفئة', 'الوصف', 'التاريخ', 'طريقة الدفع', 'المبلغ', 'الخيارات'].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#A49EC0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={`${t.type}-${t.id}`} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: '#3D3554' }}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={t.type === 'revenue' ? { background: 'rgba(16,185,129,0.15)', color: '#10B981' } : { background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      {t.type === 'revenue' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {t.type === 'revenue' ? 'إيراد' : 'مصروف'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white">{t.number}</td>
                  <td className="px-4 py-3 text-xs font-bold text-white">
                    {t.client_name || t.supplier_name || <span className="text-gray-400 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: 'rgba(141,126,200,0.2)', color: '#C4B8F0' }}>{t.category}</span>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: '#D4CEEB' }} title={t.description}>{t.description}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#A49EC0' }}>{new Date(t.date).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">
                    {t.payment_method ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold" style={{
                        background:
                          t.payment_method === 'cash' ? 'rgba(16,185,129,0.15)' :
                          t.payment_method === 'instapay' ? 'rgba(141,126,200,0.15)' :
                          t.payment_method === 'vodafone_cash' ? 'rgba(239,68,68,0.15)' :
                          t.payment_method === 'postal_transfer' ? 'rgba(236,199,150,0.15)' :
                          'rgba(59,130,246,0.15)',
                        color:
                          t.payment_method === 'cash' ? '#10B981' :
                          t.payment_method === 'instapay' ? '#C4B8F0' :
                          t.payment_method === 'vodafone_cash' ? '#EF4444' :
                          t.payment_method === 'postal_transfer' ? '#ECC796' :
                          '#3B82F6',
                      }}>
                        {pmIcon(t.payment_method)}
                        {t.payment_method === 'cash' ? ' نقدي' :
                         t.payment_method === 'instapay' ? ' انستاباي' :
                         t.payment_method === 'vodafone_cash' ? ' فودافون' :
                         t.payment_method === 'postal_transfer' ? ' حوالة بريدية' :
                         ' بنكي'}
                      </span>
                    ) : (
                      <span style={{ color: '#4E4869' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: t.type === 'revenue' ? '#10B981' : '#EF4444' }}>
                    {t.type === 'revenue' ? '+' : '-'}{currency} {parseFloat(t.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <button
                      onClick={() => onViewDetails(t)}
                      className="px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 transition-colors font-bold text-white text-[10px]"
                    >
                      التفاصيل
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد معاملات في هذه الفترة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="flex justify-between items-center px-5 py-4 border-t" style={{ borderColor: '#3D3554' }}>
          <span className="text-sm" style={{ color: '#A49EC0' }}>الإجمالي ({filtered.length} معاملة)</span>
          <span className="text-lg font-bold" style={{ color: '#ECC796' }}>
            {currency} {filtered.reduce((s, t) => s + (t.type === 'revenue' ? (parseFloat(t.amount) || 0) : -(parseFloat(t.amount) || 0)), 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
