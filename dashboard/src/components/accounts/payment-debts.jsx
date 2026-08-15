import React from 'react';
import { DollarSign, Smartphone, Building2, Landmark, Users, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils';

const paymentMethods = [
  { key: 'cash', label: 'نقدي (Cash)', icon: DollarSign, color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: '#10B98155' },
  { key: 'instapay', label: 'انستاباي (InstaPay)', icon: Smartphone, color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', border: '#A78BFA55' },
  { key: 'vodafone_cash', label: 'فودافون كاش ومحافظ', icon: Smartphone, color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: '#F8717155' },
  { key: 'bank_transfer', label: 'الحساب البنكي', icon: Building2, color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', border: '#60A5FA55' },
  { key: 'postal_transfer', label: 'حوالة بريدية', icon: Landmark, color: '#ECC796', bg: 'rgba(236,199,150,0.15)', border: '#ECC79655' },
];

function getMethodBalance(transactions, methodKey) {
  const inc = transactions
    .filter(t => (t.type === 'revenue' || t.isDepositOnly) && t.payment_method === methodKey)
    .filter(t => t.isDepositOnly || !t.number?.startsWith('REV-') || !t.description?.includes('أمر الإنتاج'))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const exp = transactions
    .filter(t => t.type === 'expense' && t.payment_method === methodKey)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  return { in: inc, out: exp, net: inc - exp };
}

export default function PaymentDebts({ 
  transactions = [], 
  paymentMethodFilter, 
  setPaymentMethodFilter, 
  debtsLoading = false, 
  clientDebts = [], 
  supplierDebts = [], 
  currency = 'EGP', 
  hidePaymentMethods = false, 
  hideDebts = false 
}) {
  const totalClientDebt = clientDebts.reduce((s, c) => s + (parseFloat(c.debt_amount) || 0), 0);
  const totalSupplierDebt = supplierDebts.reduce((s, s2) => s + (parseFloat(s2.debt_amount) || 0), 0);

  // Total cash balance across all methods
  const allBalances = paymentMethods.map(pm => getMethodBalance(transactions, pm.key).net);
  const totalPositiveCash = allBalances.reduce((sum, b) => sum + Math.max(0, b), 0);

  return (
    <div className="space-y-6">
      
      {/* 1. FINTECH DIGITAL WALLET CARDS */}
      {!hidePaymentMethods && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ECC796]" />
              <span>محافظ وطرق الدفع والسيولة النقدية</span>
            </h3>
            {paymentMethodFilter && (
              <button
                onClick={() => setPaymentMethodFilter(null)}
                className="text-xs text-[#ECC796] hover:underline font-semibold"
              >
                إلغاء التصفية (عرض جميع المحافظ)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {paymentMethods.map((pm, idx) => {
              const bal = getMethodBalance(transactions, pm.key);
              const isSelected = paymentMethodFilter === pm.key;
              const sharePct = totalPositiveCash > 0 && bal.net > 0 ? (bal.net / totalPositiveCash) * 100 : 0;

              return (
                <div
                  key={pm.key}
                  onClick={() => setPaymentMethodFilter(isSelected ? null : pm.key)}
                  className={`rounded-2xl border p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-lg relative overflow-hidden group ${
                    isSelected ? 'ring-2 ring-[#ECC796] scale-[1.02]' : 'hover:-translate-y-0.5'
                  }`}
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, #2D2447, #231B3D)' : '#231B3D',
                    borderColor: isSelected ? '#ECC796' : '#3D3554',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#2F264C] text-[#A49EC0]">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{pm.label}</span>
                      </div>
                      <div className="p-2 rounded-xl" style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.border}` }}>
                        <pm.icon size={16} />
                      </div>
                    </div>

                    <div className="my-1">
                      <p className="text-xs text-[#A49EC0]">الرصيد المتاح:</p>
                      <p className={`text-lg font-black font-mono mt-0.5 ${bal.net >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {currency} {bal.net.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#3D3554]/60 mt-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" /> +{bal.in.toLocaleString('ar-SA')}
                      </span>
                      <span className="text-rose-400 flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" /> -{bal.out.toLocaleString('ar-SA')}
                      </span>
                    </div>

                    {/* Liquidity share bar */}
                    <div className="h-1.5 w-full rounded-full bg-[#1D172E] overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, sharePct))}%`, background: pm.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. DEBTS BREAKDOWN (CLIENTS & SUPPLIERS) */}
      {!hideDebts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Client Debts */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#3D3554]" style={{ background: '#2F264C' }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">ديون العملاء (مستحقات للورشة)</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {currency} {totalClientDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="divide-y divide-[#3D3554] max-h-48 overflow-y-auto">
              {debtsLoading ? (
                <div className="text-center py-6 text-xs text-[#A49EC0]">جاري التحميل...</div>
              ) : clientDebts.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#A49EC0]">لا توجد ديون مستحقة من عملاء ✨</div>
              ) : clientDebts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-all">
                  <div>
                    <p className="text-xs font-bold text-white">{c.name}</p>
                    {c.debt_due_date && <p className="text-[10px] text-amber-400">استحقاق: {formatDate(c.debt_due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {currency} {parseFloat(c.debt_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </span>
                    <Link to={`/suppliers?tab=clients`} className="px-2 py-1 bg-[#2F264C] hover:bg-[#3D3554] transition-all rounded-lg text-[10px] font-bold text-[#ECC796] border border-[#3D3554]">
                      كشف حساب
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier Debts */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between p-4 border-b border-[#3D3554]" style={{ background: '#2F264C' }}>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white">ديون الموردين (التزامات على الورشة)</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
                {currency} {totalSupplierDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="divide-y divide-[#3D3554] max-h-48 overflow-y-auto">
              {debtsLoading ? (
                <div className="text-center py-6 text-xs text-[#A49EC0]">جاري التحميل...</div>
              ) : supplierDebts.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#A49EC0]">لا توجد ديون مستحقة للموردين ✨</div>
              ) : supplierDebts.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-all">
                  <div>
                    <p className="text-xs font-bold text-white">{s.name}</p>
                    {s.debt_due_date && <p className="text-[10px] text-amber-400">استحقاق: {formatDate(s.debt_due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold font-mono text-rose-400">
                      {currency} {parseFloat(s.debt_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </span>
                    <Link to={`/suppliers?tab=suppliers`} className="px-2 py-1 bg-[#2F264C] hover:bg-[#3D3554] transition-all rounded-lg text-[10px] font-bold text-[#ECC796] border border-[#3D3554]">
                      كشف حساب
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
