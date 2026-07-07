import { DollarSign, Smartphone, Building2, Users } from 'lucide-react';

const paymentMethods = [
  { key: 'cash', label: 'كاش / نقدي', icon: DollarSign, color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  { key: 'instapay', label: 'انستاباي', icon: Smartphone, color: '#8D7EC8', bg: 'rgba(141,126,200,0.1)', border: 'rgba(141,126,200,0.3)' },
  { key: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  { key: 'bank_transfer', label: 'تحويل بنكي', icon: Building2, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
];

function getMethodBalance(transactions, methodKey) {
  const inc = transactions.filter(t => t.type === 'revenue' && t.payment_method === methodKey).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const exp = transactions.filter(t => t.type === 'expense' && t.payment_method === methodKey).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  return { in: inc, out: exp, net: inc - exp };
}

export default function PaymentDebts({ transactions, paymentMethodFilter, setPaymentMethodFilter, debtsLoading, clientDebts, supplierDebts, currency }) {
  const totalClientDebt = clientDebts.reduce((s, c) => s + (parseFloat(c.debt_amount) || 0), 0);
  const totalSupplierDebt = supplierDebts.reduce((s, s2) => s + (parseFloat(s2.debt_amount) || 0), 0);

  return (
    <>
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
        <div className="p-4 border-b" style={{ borderColor: '#3D3554' }}>
          <h3 className="text-sm font-semibold text-white">رصيد كل محفظة / طريقة دفع</h3>
          <p className="text-xs mt-0.5" style={{ color: '#A49EC0' }}>صافي الوارد مطروحاً منه الصادر لكل وسيلة</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y" style={{ borderColor: '#3D3554' }}>
          {paymentMethods.map(pm => {
            const bal = getMethodBalance(transactions, pm.key);
            const isSelected = paymentMethodFilter === pm.key;
            return (
              <div
                key={pm.key}
                onClick={() => setPaymentMethodFilter(isSelected ? null : pm.key)}
                className="p-5 flex flex-col gap-3 cursor-pointer transition-all hover:bg-white/5"
                style={{
                  background: isSelected ? 'rgba(236,199,150,0.05)' : 'transparent',
                  boxShadow: isSelected ? 'inset 0 0 0 1px #ECC796' : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: pm.bg, border: `1px solid ${isSelected ? '#ECC796' : pm.border}` }}>
                    <pm.icon size={18} />
                  </div>
                  <span className="text-sm font-semibold text-white">{pm.label}</span>
                  {isSelected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ECC796] text-[#201A30] font-bold mr-auto">نشط</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#A49EC0' }}>داخل</span>
                    <span style={{ color: '#10B981' }}>+{currency} {bal.in.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#A49EC0' }}>خارج</span>
                    <span style={{ color: '#EF4444' }}>-{currency} {bal.out.toFixed(2)}</span>
                  </div>
                  <div className="h-px mt-1" style={{ background: '#3D3554' }} />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold" style={{ color: '#D4CEEB' }}>رصيد</span>
                    <span className="text-sm font-bold" style={{ color: bal.net >= 0 ? pm.color : '#EF4444' }}>
                      {currency} {bal.net.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#3D3554' }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: '#10B981' }} />
              <h3 className="text-sm font-semibold text-white">ديون العملاء (لم يدفعوا بعد)</h3>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
              {currency} {totalClientDebt.toFixed(2)}
            </span>
          </div>
          <div className="divide-y divide-[#3D3554]">
            {debtsLoading ? (
              <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : clientDebts.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>لا توجد ديون مستحقة من عملاء</div>
            ) : clientDebts.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  {c.debt_due_date && <p className="text-xs mt-0.5" style={{ color: '#F59E0B' }}>استحقاق: {new Date(c.debt_due_date).toLocaleDateString('ar-SA')}</p>}
                </div>
                <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{currency} {parseFloat(c.debt_amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: '#201A30', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#3D3554' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <h3 className="text-sm font-semibold text-white">ديون الموردين (لم ندفع بعد)</h3>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              {currency} {totalSupplierDebt.toFixed(2)}
            </span>
          </div>
          <div className="divide-y divide-[#3D3554]">
            {debtsLoading ? (
              <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : supplierDebts.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>لا توجد ديون مستحقة للموردين</div>
            ) : supplierDebts.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{s.name}</p>
                  {s.debt_due_date && <p className="text-xs mt-0.5" style={{ color: '#F59E0B' }}>استحقاق: {new Date(s.debt_due_date).toLocaleDateString('ar-SA')}</p>}
                </div>
                <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{currency} {parseFloat(s.debt_amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
