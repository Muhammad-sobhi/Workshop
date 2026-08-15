import { X, Calendar, DollarSign, Smartphone, Building2, Landmark, FileText, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { getImageUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';

export default function TransactionDetailsModal({ show, onClose, transaction, currency }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  if (!show || !transaction) return null;

  const isRevenue = transaction.type === 'revenue' || transaction.type === 'inflow' || transaction.type === 'milestone' || transaction.type === 'deposit';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border p-4 space-y-3 shadow-2xl animate-in fade-in max-h-[92vh] overflow-y-auto"
        style={{
          background: isLight ? '#FFFFFF' : '#2F264C',
          borderColor: isLight ? '#EBF0FF' : '#3D3554'
        }}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${isRevenue ? 'bg-green-500/15 text-green-600 font-bold' : 'bg-red-500/15 text-red-600 font-bold'}`}>
              {isRevenue ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
            </span>
            <h3 className="text-sm font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>تفاصيل المعاملة المالية</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2.5 text-xs text-right">
          
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
              <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>نوع المعاملة</span>
              <span className={`font-bold text-xs ${isRevenue ? 'text-emerald-600' : 'text-red-500'}`}>
                {isRevenue ? 'إيراد / توريد' : 'مصروف / سداد'}
              </span>
            </div>
            
            <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
              <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>رقم السند</span>
              <span className="font-mono text-xs font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                {transaction.number || transaction.transaction_number || transaction.revenue_number || transaction.expense_number || transaction.reference_number || '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
              <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>
                {transaction.isHistorical ? 'إجمالي مبلغ المبيعات' : 'مبلغ الإيراد'}
              </span>
              <span className={`text-xs font-black font-mono ${isRevenue ? 'text-emerald-600' : 'text-red-500'}`}>
                {currency} {parseFloat(transaction.full_amount || transaction.amount).toFixed(2)}
              </span>
            </div>

            {isRevenue && (transaction.product_cost > 0 || transaction.cogs > 0) ? (
              <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
                <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>تكلفة البضاعة المباعة (COGS)</span>
                <span className="text-xs font-black font-mono text-amber-500">
                  {currency} {parseFloat(transaction.product_cost || transaction.cogs).toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
                <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الطرف الثاني</span>
                <span className="font-bold text-xs truncate block" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                  {transaction.client_name || transaction.supplier_name || transaction.entity_name || '—'}
                </span>
              </div>
            )}
          </div>

          {/* Highlight Net Treasury Cash Inflow for Historical Opening Sales */}
          {transaction.isHistorical && (
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <div>
                <span className="block text-xs font-bold text-emerald-400">صافي الوارد بالخزينة (السيولة الفعليه)</span>
                <span className="text-[10px] text-gray-300">إجمالي المبيعات (EGP {parseFloat(transaction.full_amount || transaction.amount).toFixed(2)}) - التكلفة (EGP {parseFloat(transaction.product_cost || transaction.cogs || 0).toFixed(2)})</span>
              </div>
              <span className="text-sm font-black font-mono text-emerald-400 whitespace-nowrap">
                + {currency} {parseFloat(transaction.amount).toFixed(2)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
              <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>التاريخ</span>
              <span className="font-semibold text-xs flex items-center gap-1 justify-end" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }} />
                {transaction.date || transaction.transaction_date || transaction.revenue_date || transaction.expense_date || '—'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
              <span className="block mb-0.5 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>طريقة الدفع</span>
              <span className="font-bold text-xs" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                {transaction.payment_method === 'cash' ? 'نقدي (كاش)' :
                 transaction.payment_method === 'instapay' ? 'انستاباي' :
                 transaction.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                 transaction.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                 transaction.payment_method === 'postal_transfer' ? 'حوالة بريدية' : '—'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
            <span className="block mb-1 text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>التصنيف والبيان</span>
            <p className="font-semibold text-xs leading-relaxed" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold ml-2 border" style={{ background: isLight ? '#EFF2FE' : 'rgba(255,255,255,0.1)', color: isLight ? '#4338CA' : '#FFFFFF', borderColor: isLight ? '#EBF0FF' : 'transparent' }}>
                {transaction.category}
              </span>
              {(transaction.description || '').replace(/\s*\(إيصال الدفع:\s*[^)]+\)?/gi, '').trim()}
            </p>
          </div>

          {/* Items breakdown list */}
          {transaction.items_summary && transaction.items_summary.length > 0 && (
            <div className="p-2.5 rounded-xl border space-y-1.5" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
              <span className="block text-[10px] font-bold text-[#ECC796]" style={{ color: isLight ? '#4338CA' : '#ECC796' }}>تفاصيل المواد والمنتجات المطلوبة</span>
              <div className="space-y-1">
                {transaction.items_summary.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-white/5 border border-white/5">
                    <span className="font-semibold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{item.name}</span>
                    <span className="font-mono text-gray-400">
                      {item.quantity} {item.unit} × {item.unit_cost} = <strong className="text-emerald-500 font-bold">{(item.total_cost || item.quantity * item.unit_cost).toFixed(2)} {currency}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt Image / File */}
          {transaction.receipt_path && (
            <div className="p-2.5 rounded-xl border space-y-1.5" style={{ background: isLight ? '#F8FAFF' : '#231B3D', borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
              <span className="block text-[10px] font-semibold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>مستند / صورة الإيصال المرفق</span>
              <div className="relative rounded-lg overflow-hidden border flex items-center justify-center min-h-[120px] p-1" style={{ background: isLight ? '#FFFFFF' : 'rgba(0,0,0,0.2)', borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
                <img
                  src={getImageUrl(transaction.receipt_path)}
                  alt="إيصال المعاملة"
                  className="max-h-36 object-contain w-full"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl font-bold text-xs transition-all hover:opacity-90 shadow-sm text-white"
            style={{
              background: isLight ? '#4F46E5' : '#3D3554',
              color: '#FFFFFF'
            }}
          >
            إغلاق التفاصيل
          </button>
        </div>

      </div>
    </div>
  );
}
