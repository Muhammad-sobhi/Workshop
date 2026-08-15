import React from 'react';
import { 
  X, Calendar, DollarSign, Smartphone, Building2, Landmark, 
  FileText, ArrowUpRight, ArrowDownRight, User, Hash, Tag, 
  CheckCircle2, Clock, Layers, Phone, Eye, ExternalLink, ShieldCheck
} from 'lucide-react';
import { getImageUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';

function getPaymentMethodInfo(method) {
  switch (method) {
    case 'cash':
      return { label: 'نقدي (Cash)', icon: <DollarSign className="w-3.5 h-3.5" />, color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
    case 'instapay':
      return { label: 'انستاباي (InstaPay)', icon: <Smartphone className="w-3.5 h-3.5" />, color: '#C4B8F0', bg: 'rgba(141,126,200,0.15)' };
    case 'vodafone_cash':
      return { label: 'فودافون كاش (Vodafone)', icon: <Smartphone className="w-3.5 h-3.5" />, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
    case 'bank_transfer':
      return { label: 'تحويل بنكي (Bank)', icon: <Building2 className="w-3.5 h-3.5" />, color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' };
    case 'postal_transfer':
      return { label: 'حوالة بريدية (Postal)', icon: <Landmark className="w-3.5 h-3.5" />, color: '#ECC796', bg: 'rgba(236,199,150,0.15)' };
    default:
      return { label: method || '—', icon: null, color: '#A49EC0', bg: 'rgba(255,255,255,0.05)' };
  }
}

export default function TransactionDetailsModal({ show, onClose, transaction, currency = 'EGP' }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  if (!show || !transaction) return null;

  const isIncome = transaction.type === 'revenue' || transaction.type === 'inflow' || transaction.type === 'milestone' || transaction.type === 'deposit';
  
  const txNumber = transaction.number || transaction.transaction_number || transaction.reference_number || '—';
  const txDate = transaction.date || transaction.transaction_date || transaction.payment_date || transaction.created_at;
  let entityName = transaction.client_name || transaction.supplier_name || transaction.entity_name || '';
  if (!entityName || entityName === '—') {
    const match = (transaction.description || '').match(/(?:العميل|المورد)\s*\(?([^\)\-\–\—\:]+)\)?/i);
    if (match && match[1]) {
      entityName = match[1].replace(/[\(\)]/g, '').trim();
    }
  }

  const entityPhone = transaction.entity_phone || transaction.client_phone || transaction.phone;
  const refNumber = transaction.resolved_reference || transaction.reference_number || transaction.operation_number || transaction.order_number;
  const pmInfo = getPaymentMethodInfo(transaction.payment_method);
  const userName = transaction.user_name || transaction.user?.name || 'مدير النظام';

  const orderTotal = transaction.order_total ?? transaction.full_amount ?? null;
  const orderPaid = transaction.order_paid ?? null;
  const orderRemaining = transaction.order_remaining ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl animate-in fade-in max-h-[94vh] flex flex-col overflow-hidden"
        style={{
          background: isLight ? '#FFFFFF' : '#1C162E',
          borderColor: isLight ? '#E2E8F0' : '#3D3554',
          color: isLight ? '#1E293B' : '#FFFFFF',
        }}
      >
        
        {/* Modal Header */}
        <div 
          className="flex items-center justify-between p-4 sm:p-5 border-b"
          style={{ borderColor: isLight ? '#E2E8F0' : '#3D3554', background: isLight ? '#F8FAFC' : '#231B3D' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm"
              style={{
                background: isIncome ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                color: isIncome ? '#10B981' : '#EF4444',
                border: `1px solid ${isIncome ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}
            >
              {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span>تفاصيل المعاملة والقيد المالي</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md font-semibold bg-black/20 border border-white/10 text-[#ECC796]">
                  {txNumber}
                </span>
              </h3>
              <p className="text-[11px]" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                سجل تدفق السيولة النقدية وبيانات الحركة بالخزينة
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/10 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-right custom-scrollbar">
          
          {/* Main Hero Amount Card */}
          <div 
            className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner"
            style={{
              background: isIncome 
                ? (isLight ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))')
                : (isLight ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))'),
              borderColor: isIncome ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'
            }}
          >
            <div>
              <span className="block text-[11px] font-bold mb-1" style={{ color: isIncome ? '#059669' : '#DC2626' }}>
                {isIncome ? '🟢 إيراد / تدفق نقدي وارد (Cash Inflow)' : '🔴 مصروف / منصرف من الخزينة (Cash Outflow)'}
              </span>
              <div className="text-2xl font-black font-mono tracking-tight" style={{ color: isIncome ? '#10B981' : '#EF4444' }}>
                {isIncome ? '+' : '-'}{currency} {parseFloat(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border"
                style={{ background: pmInfo.bg, color: pmInfo.color, borderColor: `${pmInfo.color}40` }}
              >
                {pmInfo.icon}
                <span>{pmInfo.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-[#ECC796]" />
                <span>{formatDate(txDate) || '—'}</span>
              </span>
            </div>
          </div>

          {/* Primary Metadata 2x2 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Party / Entity */}
            <div className="p-3 rounded-xl border space-y-1" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                <User className="w-3.5 h-3.5 text-[#ECC796]" />
                <span>الطرف الثاني (العميل / المورد)</span>
              </span>
              <div className="font-extrabold text-sm text-white flex items-center justify-between">
                <span>{entityName !== '—' ? entityName : 'معاملة عامة بالخزينة'}</span>
                {entityPhone && (
                  <span className="text-[10px] font-mono font-normal text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{entityPhone}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Reference Order */}
            <div className="p-3 rounded-xl border space-y-1" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                <Hash className="w-3.5 h-3.5 text-[#ECC796]" />
                <span>المرجع / أمر التشغيل المرتبط</span>
              </span>
              <div className="font-extrabold text-sm font-mono text-[#ECC796]">
                {refNumber || <span className="text-gray-400 font-sans font-normal text-xs">قيد خزينة مباشر</span>}
              </div>
            </div>

            {/* Category */}
            <div className="p-3 rounded-xl border space-y-1" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                <Tag className="w-3.5 h-3.5 text-[#ECC796]" />
                <span>التصنيف المالي</span>
              </span>
              <div className="font-bold text-xs text-white">
                <span className="px-2 py-0.5 rounded-md font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  {transaction.category || 'عام'}
                </span>
              </div>
            </div>

            {/* Registered By */}
            <div className="p-3 rounded-xl border space-y-1" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                <ShieldCheck className="w-3.5 h-3.5 text-[#ECC796]" />
                <span>المسؤول المسجل للقيد</span>
              </span>
              <div className="font-bold text-xs text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{userName}</span>
              </div>
            </div>

          </div>

          {/* Linked Order Financial Balance (If order exists) */}
          {orderTotal !== null && orderTotal > 0 && (
            <div 
              className="p-3.5 rounded-xl border space-y-2"
              style={{ background: 'rgba(236,199,150,0.06)', borderColor: 'rgba(236,199,150,0.25)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#ECC796] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>المركز المالي لأمر التشغيل ({refNumber})</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-center">
                  <span className="block text-[10px] text-gray-400">إجمالي الأمر</span>
                  <strong className="text-xs font-mono text-white font-black">
                    {currency} {orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="block text-[10px] text-emerald-400">المسدد فعلياً</span>
                  <strong className="text-xs font-mono text-emerald-400 font-black">
                    {currency} {(orderPaid || parseFloat(transaction.amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                  <span className="block text-[10px] text-rose-400">المتبقي على العميل</span>
                  <strong className="text-xs font-mono text-rose-400 font-black">
                    {currency} {(orderRemaining !== null ? orderRemaining : Math.max(0, orderTotal - (orderPaid || parseFloat(transaction.amount || 0)))).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Description & Statement */}
          <div className="p-3 rounded-xl border space-y-1.5" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">البيان والشرح المحاسبي</span>
            <p className="font-semibold text-xs leading-relaxed text-gray-200">
              {(transaction.description || 'لا يوجد بيان إضافي مسجل').replace(/\s*\(إيصال الدفع:\s*[^)]+\)?/gi, '').trim()}
            </p>
          </div>

          {/* Products / Materials Detailed Items Table */}
          {transaction.items_summary && transaction.items_summary.length > 0 && (
            <div className="p-3 rounded-xl border space-y-2" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#ECC796] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>تفاصيل بنود ومنتجات المعاملة</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  {transaction.items_summary.length} بند
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {transaction.items_summary.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] bg-indigo-500/20 text-indigo-300">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white">{item.name}</span>
                    </div>
                    <div className="font-mono text-left flex items-center gap-2">
                      <span className="text-gray-400 text-[11px]">
                        {item.quantity} {item.unit || 'وحدة'} × {parseFloat(item.unit_cost || 0).toLocaleString('en-US')}
                      </span>
                      <span className="text-emerald-400 font-extrabold text-xs">
                        = {currency} {(parseFloat(item.total_cost) || (parseFloat(item.quantity) * parseFloat(item.unit_cost || 0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt Document Attachment */}
          {transaction.receipt_path && (
            <div className="p-3 rounded-xl border space-y-2" style={{ background: isLight ? '#F8FAFC' : '#261F3D', borderColor: isLight ? '#E2E8F0' : '#3D3554' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#ECC796] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>مستند / صورة الإيصال المرفق</span>
                </span>
                <a 
                  href={getImageUrl(transaction.receipt_path)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <span>فتح الصورة بحجم كامل</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative rounded-lg overflow-hidden border flex items-center justify-center min-h-[140px] p-2 bg-black/30 border-white/10">
                <img
                  src={getImageUrl(transaction.receipt_path)}
                  alt="إيصال المعاملة"
                  className="max-h-44 object-contain w-full rounded-md shadow-md"
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div 
          className="flex items-center justify-between p-3.5 sm:p-4 border-t"
          style={{ borderColor: isLight ? '#E2E8F0' : '#3D3554', background: isLight ? '#F8FAFC' : '#231B3D' }}
        >
          <span className="text-[11px] text-gray-400">
            تم توثيق القيد بالخزينة الرئيسية
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-md text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}
