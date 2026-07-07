'use client';

import { CheckCircle2, Info, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

const statusColors = {
  Pending: { label: 'معلق', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  In_Progress: { label: 'قيد الإنتاج', color: '#8D7EC8', bg: 'rgba(141,126,200,0.15)' },
  Completed: { label: 'مكتمل', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

export default function ProductionOrderCard({ op, currency, totalPaid, remaining, expandedOp, onToggleExpand, onCheck, onComplete, onShowPayment }) {
  const st = statusColors[op.status] || { label: op.status, color: '#A49EC0', bg: '#3D3554' };
  const paid = totalPaid(op);
  const rem = remaining(op);
  const isExpanded = expandedOp === op.id;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0">
            <p className="text-xs font-mono font-bold" style={{ color: '#ECC796' }}>{op.operation_number}</p>
            <span className="mt-1 inline-block px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {op.client ? op.client.name : 'بدون عميل'}
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
          <div className="text-right shrink-0">
            <p className="text-xs font-bold" style={{ color: '#10B981' }}>{currency} {paid.toFixed(2)} مدفوع</p>
            {rem > 0 && <p className="text-xs mt-0.5" style={{ color: '#EF4444' }}>{currency} {rem.toFixed(2)} متبقي</p>}
          </div>
        ) : null}

        <div className="flex items-center gap-2 shrink-0">
          {op.status === 'Pending' && (
            <button onClick={() => onCheck(op)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#ECC796', color: '#ECC796' }}>
              <Info className="w-3.5 h-3.5" /> فحص وبدء
            </button>
          )}
          {op.status === 'In_Progress' && (
            <button onClick={() => onComplete(op.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90" style={{ background: '#10B981', color: '#FFF' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> إتمام
            </button>
          )}
          <button onClick={() => { onShowPayment(op); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#8D7EC8', color: '#C4B8F0' }}>
            <CreditCard className="w-3.5 h-3.5" /> دفعة
          </button>
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
                {op.operation_products.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: '#231B3D' }}>
                    <span className="text-white">{p.product?.name}</span>
                    <span style={{ color: '#ECC796' }}>{p.quantity} حبة</span>
                  </div>
                ))}
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
                  <div key={i} className="flex justify-between text-xs">
                    <span style={{ color: '#A49EC0' }}>{p.notes || `دفعة ${i + 1}`} - {p.payment_date}</span>
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
