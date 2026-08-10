'use client';

import { CheckCircle2, Info, CreditCard, ChevronDown, ChevronUp, Wrench, Truck } from 'lucide-react';

const statusColors = {
  Pending: { label: 'معلق', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  In_Progress: { label: 'قيد الإنتاج', color: '#8D7EC8', bg: 'rgba(141,126,200,0.15)' },
  Completed: { label: 'جاهز بالمخزن', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  Delivered: { label: 'تم التسليم للعميل', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
};

export default function ProductionOrderCard({ op, currency, totalPaid, remaining, expandedOp, onToggleExpand, onCheck, onComplete, onShowPayment, onCancel, onDelete, onCreateExternalService, onDeliver, onDeletePayment }) {
  const st = statusColors[op.status] || { label: op.status, color: '#A49EC0', bg: '#3D3554' };
  const paid = totalPaid(op);
  const rem = remaining(op);
  const isExpanded = expandedOp === op.id;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0">
            <p className="text-xs font-mono font-bold" style={{ color: '#ECC796' }}>{op.operation_number}</p>
            <span className="mt-1 inline-block px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {op.client ? op.client.name : <span className="text-emerald-400">📦 تخزين كمخزون</span>}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#ECC796' }}>
              المستودع: {op.warehouse?.name || 'غير محدد'}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: '#A49EC0' }}>
              {(op.operation_products || []).map(p => `${p.product?.name} (${p.quantity})`).join(' • ') || '—'}
            </p>
          </div>
        </div>

        {op.total_price ? (
          <div className="flex sm:flex-col justify-between sm:justify-center sm:text-right shrink-0 py-1 sm:py-0 border-t sm:border-t-0 border-[#3D3554]/50">
            <p className="text-xs font-bold" style={{ color: '#10B981' }}>{currency} {paid.toFixed(2)} مدفوع</p>
            {rem > 0 && <p className="text-xs mt-0.5" style={{ color: '#EF4444' }}>{currency} {rem.toFixed(2)} متبقي</p>}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#3D3554]/50">
          {op.status === 'Pending' && (
            <button onClick={() => onCheck(op)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#ECC796', color: '#ECC796' }}>
              <Info className="w-3.5 h-3.5" /> فحص وبدء
            </button>
          )}
          {op.status === 'In_Progress' && (
            <button onClick={() => onComplete(op.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90" style={{ background: '#10B981', color: '#FFF' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> إتمام التصنيع
            </button>
          )}
          {op.status === 'Completed' && (
            <button
              onClick={() => onDeliver && onDeliver(op)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 bg-blue-600 text-white"
              title="تسليم المنتجات المصنعة من المخزن إلى العميل"
            >
              <Truck className="w-3.5 h-3.5" /> تسليم للعميل
            </button>
          )}
          {op.status !== 'Cancelled' && (
            <button
              onClick={() => onCreateExternalService && onCreateExternalService(op)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5"
              style={{ borderColor: '#ECC796', color: '#ECC796' }}
              title="إرسال جزء/صنف لورشة خارجية للتشغيل أو الدهان"
            >
              <Wrench className="w-3.5 h-3.5" /> + خدمة خارجية
            </button>
          )}
          {op.status !== 'Cancelled' && op.client_id && (
            <button onClick={() => { onShowPayment(op); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#8D7EC8', color: '#C4B8F0' }}>
              <CreditCard className="w-3.5 h-3.5" /> دفعة
            </button>
          )}
          {op.status !== 'Cancelled' && (
            <button onClick={() => onCancel(op.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5 text-red-400 hover:bg-red-400/10" style={{ borderColor: '#F87171' }}>
              إلغاء الأمر
            </button>
          )}
          {op.status !== 'Completed' && (
            <button onClick={() => onDelete(op.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-red-500/10 text-red-500 hover:border-red-500" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
              حذف
            </button>
          )}
          <button onClick={() => onToggleExpand(isExpanded ? null : op.id)} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: '#A49EC0' }}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
          {(op.operation_products || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#A49EC0' }}>المنتجات المطلوبة</p>
              <div className="space-y-1.5">
                {op.operation_products.map(p => {
                  const taken = parseFloat(p.quantity_taken_from_stock) || 0;
                  const totalQty = parseFloat(p.quantity) || 0;
                  const toProduce = Math.max(0, totalQty - taken);

                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: '#231B3D' }}>
                      <span className="text-white font-medium">{p.product?.name}</span>
                      <div className="flex items-center gap-2">
                        {taken > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            📦 {taken} مسحوب من المخزن
                          </span>
                        )}
                        <span style={{ color: '#ECC796' }} className="font-bold">
                          {taken > 0 ? (toProduce > 0 ? `⚙️ ${toProduce} تصنيع متبقي` : 'جاهز بالكامل') : `${totalQty} ${p.product?.unit || 'وحدة'}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {op.total_price && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#A49EC0' }}>ملخص المدفوعات</p>
              <div className="rounded-xl p-3 space-y-2" style={{ background: '#231B3D' }}>
                <div className="flex justify-between text-xs"><span style={{ color: '#A49EC0' }}>إجمالي الطلب</span><span className="font-bold text-white">{currency} {parseFloat(op.total_price).toFixed(2)}</span></div>
                {op.deposit_paid ? <div className="flex justify-between text-xs"><span style={{ color: '#A49EC0' }}>العربون المدفوع</span><span className="font-bold" style={{ color: '#10B981' }}>{currency} {parseFloat(op.deposit_paid).toFixed(2)}</span></div> : null}
                {(op.payments || []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#A49EC0' }}>{p.notes || `دفعة ${i + 1}`} - {p.payment_date}</span>
                      {onDeletePayment && (
                        <button
                          type="button"
                          onClick={() => onDeletePayment(op.id, p.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/40 border border-red-500/30 transition-colors"
                          title="تراجع عن هذه الدفعة"
                        >
                          ↩ تراجع
                        </button>
                      )}
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#10B981' }}>{currency} {parseFloat(p.amount_paid).toFixed(2)}</span>
                  </div>
                ))}
                {rem > 0 && <div className="flex justify-between text-xs border-t pt-2" style={{ borderColor: '#3D3554' }}><span className="font-bold" style={{ color: '#EF4444' }}>المتبقي</span><span className="font-bold" style={{ color: '#EF4444' }}>{currency} {rem.toFixed(2)}</span></div>}
              </div>
            </div>
          )}

          {op.notes && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#231B3D', color: '#A49EC0' }}>{op.notes}</p>}
        </div>
      )}
    </div>
  );
}
