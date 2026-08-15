'use client';

import { useState } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, ShieldCheck, 
  Package, Users, Building2, Minus, Plus, Equal, ArrowDownRight, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function KpiCards({
  loading,
  totalRevenue = 0,
  totalCogs = 0,
  totalExpense = 0,
  grossProfit,
  netProfit,
  profitMargin = 0,
  inventoryValue = 0,
  cashInHand: cashInHandProp,
  currency = 'EGP',
  clientDebts = [],
  supplierDebts = [],
  transactions = []
}) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const [showFormulaHelp, setShowFormulaHelp] = useState(false);

  const calculatedGrossProfit = grossProfit ?? (totalRevenue - totalCogs);
  const calculatedNetProfit = netProfit ?? (calculatedGrossProfit - totalExpense);

  const totalClientDebt = clientDebts.reduce((sum, c) => sum + (parseFloat(c.debt_amount) || 0), 0);
  const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + (parseFloat(s.debt_amount) || 0), 0);

  // Cash in hand from transactions or balance
  const totalCashCollected = transactions.length > 0 ? transactions
    .filter(t => (t.type === 'revenue' || t.type === 'inflow' || t.isDepositOnly) && (t.isDepositOnly || !t.number?.startsWith('REV-') || !t.description?.includes('أمر الإنتاج')))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : totalRevenue;

  const totalCashExpenses = transactions.length > 0 ? transactions
    .filter(t => t.type === 'expense' || t.type === 'outflow')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : totalExpense;

  const calculatedCashInHand = Math.max(0, totalCashCollected - totalCashExpenses);
  const cashInHand = (cashInHandProp !== undefined && cashInHandProp !== null && !isNaN(cashInHandProp)) 
    ? Math.max(0, parseFloat(cashInHandProp)) 
    : calculatedCashInHand;

  // Total Assets = Inventory + Client Debts (Receivables) + Cash in Hand
  const invVal = parseFloat(inventoryValue) || 0;
  const totalAssets = invVal + totalClientDebt + cashInHand;

  // Net Equity = Total Assets - Supplier Debts (Payables)
  const netEquity = totalAssets - totalSupplierDebt;

  // Formatted Margin Clean (e.g., -3.4% or +18.5%)
  const cleanMargin = Number.isFinite(profitMargin) ? Number(profitMargin).toFixed(1) : '0.0';
  const isProfit = calculatedNetProfit >= 0;

  return (
    <div className="space-y-6">
      
      {/* 1. TOP 4 CORE EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Sales Revenue */}
        <div
          className="rounded-2xl border p-4.5 transition-all duration-200 hover:shadow-lg relative overflow-hidden"
          style={{
            background: isLight ? 'linear-gradient(135deg, #FFFFFF, #F0FDF4)' : 'linear-gradient(135deg, #241D3A, #1B2E28)',
            borderColor: isLight ? '#E2E8F0' : '#10B98133',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              إيرادات المبيعات
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#A49EC0]">إجمالي المبيعات المحققة</p>
          <p className="text-xl font-black font-mono mt-1 text-emerald-400">
            {loading ? '...' : `${currency} ${Number(totalRevenue).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-[11px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span className="text-[#A49EC0]">فواتير المبيعات والتسليم</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> مبيعات الفترة
            </span>
          </div>
        </div>

        {/* Card 2: Net Profit with Clean Margin */}
        <div
          className="rounded-2xl border p-4.5 transition-all duration-200 hover:shadow-lg relative overflow-hidden"
          style={{
            background: isLight 
              ? (isProfit ? 'linear-gradient(135deg, #FFFFFF, #F0FDF4)' : 'linear-gradient(135deg, #FFFFFF, #FEF2F2)') 
              : (isProfit ? 'linear-gradient(135deg, #241D3A, #1C2D37)' : 'linear-gradient(135deg, #241D3A, #381A28)'),
            borderColor: isLight ? '#E2E8F0' : (isProfit ? '#3B82F633' : '#EF444433'),
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isProfit 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}>
              هامش الربح {cleanMargin}%
            </span>
            <div className={`p-2 rounded-xl ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <p className="text-xs font-semibold text-[#A49EC0]">صافي الأرباح النهائي (Net Profit)</p>
          <p className={`text-xl font-black font-mono mt-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {loading ? '...' : `${currency} ${Number(calculatedNetProfit).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-[11px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span className="text-[#A49EC0]">مجمل الربح - المصروفات</span>
            <span className={`font-semibold flex items-center gap-0.5 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? 'ربح تشغيلي صافي' : 'عجز في أرباح الفترة'}
            </span>
          </div>
        </div>

        {/* Card 3: Treasury Cash in Hand */}
        <div
          className="rounded-2xl border p-4.5 transition-all duration-200 hover:shadow-lg relative overflow-hidden"
          style={{
            background: isLight ? 'linear-gradient(135deg, #FFFFFF, #EFF6FF)' : 'linear-gradient(135deg, #241D3A, #1C2740)',
            borderColor: isLight ? '#E2E8F0' : '#3B82F633',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
              السيولة النقدية المتاحة
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#A49EC0]">رصيد النقدية بالخزينة (Cash)</p>
          <p className="text-xl font-black font-mono mt-1 text-blue-400">
            {loading ? '...' : `${currency} ${Number(cashInHand).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-[11px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span className="text-[#A49EC0]">كاش جاهز للصرف الفوري</span>
            <span className="font-semibold text-blue-400">سيولة الخزينة</span>
          </div>
        </div>

        {/* Card 4: Net Equity / Net Worth */}
        <div
          className="rounded-2xl border p-4.5 transition-all duration-200 hover:shadow-lg relative overflow-hidden"
          style={{
            background: isLight ? 'linear-gradient(135deg, #FFFFFF, #FFFBEB)' : 'linear-gradient(135deg, #241D3A, #34281A)',
            borderColor: isLight ? '#E2E8F0' : '#ECC79644',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
              صافي ثروة الورشة
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#ECC796]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#A49EC0]">صافي حقوق الملكية (Net Equity)</p>
          <p className={`text-xl font-black font-mono mt-1 ${netEquity >= 0 ? 'text-[#ECC796]' : 'text-rose-400'}`}>
            {loading ? '...' : `${currency} ${Number(netEquity).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-[11px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span className="text-[#A49EC0]">الأصول مطروحاً منها الديون</span>
            <span className="font-bold text-[#ECC796]">المركز المالي</span>
          </div>
        </div>

      </div>

      {/* 2. VISUAL FINANCIAL EQUATION BAR (شريط المعادلة المالية البصري) */}
      <div 
        className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
        style={{
          background: isLight ? '#FAF9F6' : '#231B3D',
          borderColor: isLight ? '#E2E8F0' : '#3D3554',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>🏛️ ميزانية الأصول والمركز المالي</span>
              <span className="text-xs font-normal text-[#A49EC0]">(Balance Sheet Equation)</span>
            </h3>
          </div>
          <button 
            onClick={() => setShowFormulaHelp(!showFormulaHelp)}
            className="text-[11px] font-semibold text-[#ECC796] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showFormulaHelp ? 'إخفاء الشرح' : 'كيف تحسب هذه المعادلة؟'}
          </button>
        </div>

        {showFormulaHelp && (
          <div className="mb-4 p-3 rounded-xl bg-black/20 border border-white/5 text-xs text-[#D4CEEB] space-y-1">
            <p className="font-bold text-[#ECC796]">قانون الميزانية العمومية:</p>
            <p>
              • <strong>الأصول المملوكة (Assets):</strong> بضاعة وخامات المخازن + النقدية بالخزينة + ديونك لدى العملاء = <strong>{currency} {totalAssets.toLocaleString('ar-SA')}</strong>
            </p>
            <p>
              • <strong>الالتزامات والديون (Liabilities):</strong> ديون الموردين الواجبة السداد = <strong>{currency} {totalSupplierDebt.toLocaleString('ar-SA')}</strong>
            </p>
            <p>
              • <strong>صافي الثروة (Net Equity):</strong> ما يتبقى لك كقيمة حقيقية للورشة بعد سداد جميع الموردين = <strong>{currency} {netEquity.toLocaleString('ar-SA')}</strong>
            </p>
          </div>
        )}

        {/* The Equation Flow Container */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]">
          
          {/* Group 1: What We Own (Assets) */}
          <div className="flex-1 rounded-xl p-3 border space-y-2 bg-[#201A30]/80 border-[#3D3554]">
            <div className="flex items-center justify-between border-b border-[#3D3554] pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                مجموع الأصول والممتلكات
              </span>
              <span className="text-xs font-mono font-bold text-blue-300">
                {currency} {totalAssets.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1.5 rounded-lg bg-[#2F264C]/50 border border-white/5">
                <p className="text-[10px] text-[#A49EC0] flex items-center justify-center gap-1">
                  <Package className="w-3 h-3 text-emerald-400" /> المخزون
                </p>
                <p className="text-xs font-bold font-mono text-white mt-0.5">
                  {currency} {invVal.toLocaleString('ar-SA')}
                </p>
              </div>

              <div className="p-1.5 rounded-lg bg-[#2F264C]/50 border border-white/5">
                <p className="text-[10px] text-[#A49EC0] flex items-center justify-center gap-1">
                  <Wallet className="w-3 h-3 text-blue-400" /> كاش الخزينة
                </p>
                <p className="text-xs font-bold font-mono text-white mt-0.5">
                  {currency} {cashInHand.toLocaleString('ar-SA')}
                </p>
              </div>

              <div className="p-1.5 rounded-lg bg-[#2F264C]/50 border border-white/5">
                <p className="text-[10px] text-[#A49EC0] flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-amber-400" /> ديون العملاء
                </p>
                <p className="text-xs font-bold font-mono text-white mt-0.5">
                  {currency} {totalClientDebt.toLocaleString('ar-SA')}
                </p>
              </div>
            </div>
          </div>

          {/* Minus Operator Sign */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
              <Minus className="w-4 h-4" />
            </div>
          </div>

          {/* Group 2: What We Owe (Liabilities) */}
          <div className="w-full lg:w-64 rounded-xl p-3 border space-y-2 bg-[#201A30]/80 border-[#3D3554]">
            <div className="flex items-center justify-between border-b border-[#3D3554] pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                ديون الموردين (الالتزامات)
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#2F264C]/50 border border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-[#A49EC0] flex items-center gap-1">
                <Building2 className="w-3 h-3 text-rose-400" /> مستحقات الموردين
              </span>
              <span className="text-xs font-bold font-mono text-rose-400">
                {currency} {totalSupplierDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Equals Operator Sign */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#ECC796]/20 text-[#ECC796] border border-[#ECC796]/30 flex items-center justify-center font-bold">
              <Equal className="w-4 h-4" />
            </div>
          </div>

          {/* Group 3: Net Worth Result Box */}
          <div 
            className="w-full lg:w-72 rounded-xl p-3 border text-center space-y-1"
            style={{
              background: netEquity >= 0 ? 'linear-gradient(135deg, #10B98122, #05966944)' : 'linear-gradient(135deg, #EF444422, #DC262644)',
              borderColor: netEquity >= 0 ? '#10B981' : '#EF4444',
            }}
          >
            <p className="text-[11px] font-bold text-white flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: netEquity >= 0 ? '#10B981' : '#EF4444' }} />
              صافي ثروة الورشة الحالية
            </p>
            <p className="text-lg font-black font-mono" style={{ color: netEquity >= 0 ? '#10B981' : '#EF4444' }}>
              {currency} {netEquity.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-gray-300">
              {netEquity >= 0 ? '✨ وضع مالي ممتاز وقيمة موجبة' : '⚠️ التزامات تفوق الأصول الحالية'}
            </p>
          </div>

        </div>
      </div>

      {/* 3. P&L WATERFALL BREAKDOWN (شلال قائمة الدخل المعيارية) */}
      <div 
        className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
        style={{
          background: isLight ? '#FAF9F6' : '#231B3D',
          borderColor: isLight ? '#E2E8F0' : '#3D3554',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#3D3554] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>📊 شلال قائمة الدخل والأرباح (P&L Income Waterfall)</span>
            </h3>
            <p className="text-xs text-[#A49EC0] mt-0.5">
              كيف يتشكل صافي الربح من المبيعات عبر خصم تكلفة الإنتاج والمصروفات التشغيلية
            </p>
          </div>
        </div>

        {/* 5 Waterfall Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Step 1: Revenue */}
          <div className="rounded-xl border p-3.5 bg-[#201A30] border-[#3D3554] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-1">
              <span>١. إجمالي المبيعات</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">+ الإيراد</span>
            </div>
            <p className="text-[11px] text-[#A49EC0] mb-2">قيمة فواتير وتسليمات الفترة</p>
            <p className="text-sm font-black font-mono text-emerald-400 border-t border-[#3D3554] pt-2">
              {currency} {Number(totalRevenue).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Step 2: COGS */}
          <div className="rounded-xl border p-3.5 bg-[#201A30] border-[#3D3554] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-rose-400 mb-1">
              <span>٢. تكلفة البضاعة (COGS)</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-[10px]">- التكلفة</span>
            </div>
            <p className="text-[11px] text-[#A49EC0] mb-2">تكاليف خامات وتصنيع ما تم بيعه</p>
            <p className="text-sm font-black font-mono text-rose-400 border-t border-[#3D3554] pt-2">
              {currency} {Number(totalCogs).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Step 3: Gross Profit */}
          <div className="rounded-xl border p-3.5 bg-[#201A30] border-[#3D3554] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-blue-400 mb-1">
              <span>٣. مجمل الربح</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[10px]">= الفارق</span>
            </div>
            <p className="text-[11px] text-[#A49EC0] mb-2">المبيعات ناقص تكلفة البضاعة</p>
            <p className={`text-sm font-black font-mono border-t border-[#3D3554] pt-2 ${calculatedGrossProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
              {currency} {Number(calculatedGrossProfit).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Step 4: OPEX */}
          <div className="rounded-xl border p-3.5 bg-[#201A30] border-[#3D3554] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-1">
              <span>٤. المصروفات التشغيلية</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px]">- مصاريف</span>
            </div>
            <p className="text-[11px] text-[#A49EC0] mb-2">أجور، إيجارات، مرافق، ونثريات</p>
            <p className="text-sm font-black font-mono text-amber-400 border-t border-[#3D3554] pt-2">
              {currency} {Number(totalExpense).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Step 5: Final Net Profit */}
          <div 
            className="rounded-xl border p-3.5 flex flex-col justify-between ring-1"
            style={{
              background: isProfit ? '#142E24' : '#331924',
              borderColor: isProfit ? '#10B981' : '#EF4444',
            }}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1" style={{ color: isProfit ? '#10B981' : '#EF4444' }}>
              <span>٥. صافي الربح النهائي</span>
              <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px]">النتيجة</span>
            </div>
            <p className="text-[11px] text-gray-300 mb-2">مجمل الربح ناقص المصروفات</p>
            <p className="text-sm font-black font-mono border-t border-white/10 pt-2" style={{ color: isProfit ? '#10B981' : '#EF4444' }}>
              {currency} {Number(calculatedNetProfit).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
