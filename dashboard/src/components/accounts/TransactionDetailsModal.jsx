'use client';

import { X, Calendar, DollarSign, Smartphone, Building2, Landmark, FileText, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';

export default function TransactionDetailsModal({ show, onClose, transaction, currency }) {
  if (!show || !transaction) return null;

  const isRevenue = transaction.type === 'revenue' || transaction.type === 'milestone' || transaction.type === 'deposit';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl animate-in fade-in" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#3D3554' }}>
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${isRevenue ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isRevenue ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </span>
            <h3 className="text-base font-bold text-white">تفاصيل المعاملة المالية</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10" style={{ color: '#A49EC0' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs text-right">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">نوع المعاملة</span>
              <span className={`font-bold text-sm ${isRevenue ? 'text-green-400' : 'text-red-400'}`}>
                {isRevenue ? 'إيراد / توريد' : 'مصروف / سداد'}
              </span>
            </div>
            
            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">رقم السند</span>
              <span className="font-mono text-sm text-white font-bold">{transaction.number || transaction.revenue_number || transaction.expense_number || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">الطرف الثاني</span>
              <span className="font-bold text-white text-sm">
                {transaction.client_name || transaction.supplier_name || transaction.entity_name || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">المبلغ الإجمالي</span>
              <span className={`text-base font-bold ${isRevenue ? 'text-green-400' : 'text-red-400'}`}>
                {currency} {parseFloat(transaction.amount).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">التاريخ</span>
              <span className="font-semibold text-white flex items-center gap-1.5 justify-end">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {transaction.date || transaction.revenue_date || transaction.expense_date}
              </span>
            </div>

            <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
              <span className="block text-gray-400 mb-1">طريقة الدفع</span>
              <span className="font-bold text-white">
                {transaction.payment_method === 'cash' ? 'نقدي (كاش)' :
                 transaction.payment_method === 'instapay' ? 'انستاباي' :
                 transaction.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                 transaction.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                 transaction.payment_method === 'postal_transfer' ? 'حوالة بريدية' : '—'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: '#231B3D' }}>
            <span className="block text-gray-400 mb-1">التصنيف والبيان</span>
            <p className="text-white font-semibold">
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-normal ml-2">{transaction.category}</span>
              {transaction.description}
            </p>
          </div>

          {/* Receipt Image / File */}
          {transaction.receipt_path && (
            <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
              <span className="block text-gray-400">مستند / صورة الإيصال المرفق</span>
              <div className="relative rounded-lg overflow-hidden border bg-black/20 flex items-center justify-center min-h-[160px]" style={{ borderColor: '#3D3554' }}>
                <img
                  src={`${getApiBaseUrl()}${transaction.receipt_path}`}
                  alt="إيصال المعاملة"
                  className="max-h-60 object-contain w-full"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-5 py-2 bg-[#3D3554] hover:bg-[#4E4869] text-white rounded-xl font-bold text-xs transition-all">
            إغلاق التفاصيل
          </button>
        </div>

      </div>
    </div>
  );
}
