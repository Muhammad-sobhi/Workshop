import { useState } from 'react';
import { Scale, TrendingUp, Box, DollarSign, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function KpiCards({ loading, totalRevenue, totalCogs = 0, totalExpense = 0, grossProfit, netProfit, profitMargin, inventoryValue = 0, currency, clientDebts = [], supplierDebts = [], transactions = [] }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState('assets'); // 'assets' | 'pnl'

  const calculatedGrossProfit = grossProfit ?? (totalRevenue - totalCogs);
  const calculatedNetProfit = netProfit ?? (calculatedGrossProfit - totalExpense);

  const totalClientDebt = clientDebts.reduce((sum, c) => sum + (parseFloat(c.debt_amount) || 0), 0);
  const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + (parseFloat(s.debt_amount) || 0), 0);

  // Physical Cash in hand = Total Cash Collected (Deposits + Milestone Payments + Cash Counter Sales) - Total Cash Outflows
  const totalCashCollected = transactions.length > 0 ? transactions
    .filter(t => (t.type === 'revenue' || t.isDepositOnly) && (t.isDepositOnly || !t.number?.startsWith('REV-') || !t.description?.includes('أمر الإنتاج')))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : totalRevenue;

  const totalCashExpenses = transactions.length > 0 ? transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : totalExpense;

  const cashInHand = totalCashCollected - totalCashExpenses;

  // Total Assets = Inventory Value + Accounts Receivable (Client Debts) + Cash in Hand
  const invVal = parseFloat(inventoryValue) || 0;
  const totalAssets = invVal + totalClientDebt + Math.max(0, cashInHand);

  // Net Equity = Total Assets - Accounts Payable (Supplier Debts)
  const netEquity = totalAssets - totalSupplierDebt;

  // 1. Balance Sheet & Assets Steps
  const assetSteps = [
    { num: '١', title: 'قيمة المخزون الإجمالية', subtitle: 'خامات ومنتجات جاهزة في المستودعات', value: invVal, color: '#3B82F6', sign: '+' },
    { num: '٢', title: 'مستحقات العملاء (Receivables)', subtitle: 'الديون المتبقية للشركة لدى العملاء', value: totalClientDebt, color: '#10B981', sign: '+' },
    { num: '٣', title: 'السيولة النقدية المتاحة (Cash)', subtitle: 'الإيرادات المحصلة - المصروفات', value: Math.max(0, cashInHand), color: '#8D7EC8', sign: '+' },
    { num: '٤', title: 'إجمالي أصول الشركة (Total Assets)', subtitle: 'المخزون + ديون العملاء + النقدية بالخزينة', value: totalAssets, color: '#ECC796', isResult: true, isFinal: true },
    { num: '٥', title: 'التزامات الموردين (Payables)', subtitle: 'ديون الموردين الواجبة السداد', value: totalSupplierDebt, color: '#EF4444', sign: '-' },
    { num: '٦', title: 'صافي ثروة الشركة (Net Equity)', subtitle: 'إجمالي الأصول - ديون الموردين', value: netEquity, color: netEquity >= 0 ? '#10B981' : '#EF4444', isResult: true },
  ];

  // 2. P&L Statement Steps
  const pnlSteps = [
    { num: '١', title: 'إيرادات المبيعات', subtitle: 'إجمالي المبيعات المحققة للفترة', value: totalRevenue, color: '#10B981', sign: '+' },
    { num: '٢', title: 'تكلفة البضاعة المباعة (COGS)', subtitle: 'التكلفة المباشرة للمنتجات المباعة', value: totalCogs, color: '#EF4444', sign: '-' },
    { num: '٣', title: 'مجمل الربح (Gross Profit)', subtitle: 'إيرادات المبيعات - تكلفة البضاعة المباعة', value: calculatedGrossProfit, color: calculatedGrossProfit >= 0 ? '#3B82F6' : '#EF4444', isResult: true },
    { num: '٤', title: 'المصروفات التشغيلية', subtitle: 'أجور، إيجار، مرافق، وأي مصاريف تشغيلية', value: totalExpense, color: '#F59E0B', sign: '-' },
    { num: '٥', title: 'صافي الربح النهائي (Net Profit)', subtitle: 'مجمل الربح - المصروفات التشغيلية', value: calculatedNetProfit, color: calculatedNetProfit >= 0 ? '#10B981' : '#EF4444', isResult: true, isFinal: true },
  ];

  const activeSteps = activeTab === 'assets' ? assetSteps : pnlSteps;

  return (
    <div className="space-y-5">
      {/* 1. TOP EXECUTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Assets */}
        <div
          className="rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg relative overflow-hidden group cursor-pointer"
          onClick={() => setActiveTab('assets')}
          style={{
            background: activeTab === 'assets' 
              ? (isLight ? 'linear-gradient(135deg, #FEF3C7, #FFF9EB)' : 'linear-gradient(135deg, #2D2447, #231B3D)') 
              : (isLight ? '#FFFFFF' : '#2F264C'),
            borderColor: activeTab === 'assets' ? '#ECC796' : (isLight ? '#EBF0FF' : '#3D3554'),
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ECC796]/20 text-[#ECC796]">
              الميزانية العمومية
            </span>
            <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#ECC796' }}>
              <Box className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xs font-semibold" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
            إجمالي أصول الشركة (Total Assets)
          </h3>
          <p className="text-lg font-black font-mono mt-1 text-[#ECC796]">
            {loading ? '...' : `${currency} ${totalAssets.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span style={{ color: isLight ? '#64748B' : '#A49EC0' }}>المخزون + الديون + النقدية</span>
            <span className="font-bold text-[#ECC796] flex items-center gap-0.5">عرض التفاصيل <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Card 2: Sales Revenue */}
        <div
          className="rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg relative overflow-hidden group cursor-pointer"
          onClick={() => setActiveTab('pnl')}
          style={{
            background: activeTab === 'pnl' 
              ? (isLight ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #1C382F, #162E27)') 
              : (isLight ? '#FFFFFF' : '#2F264C'),
            borderColor: activeTab === 'pnl' ? '#10B981' : (isLight ? '#EBF0FF' : '#3D3554'),
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              إيرادات المبيعات
            </span>
            <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#10B981' }}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xs font-semibold" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
            إجمالي المبيعات المحصلة
          </h3>
          <p className="text-lg font-black font-mono mt-1 text-emerald-400">
            {loading ? '...' : `${currency} ${totalRevenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span style={{ color: isLight ? '#64748B' : '#A49EC0' }}>المبيعات المحققة بالفترة</span>
            <span className="font-bold text-emerald-400 flex items-center gap-0.5">قائمة الدخل P&L <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div
          className="rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg relative overflow-hidden group cursor-pointer"
          onClick={() => setActiveTab('pnl')}
          style={{
            background: isLight ? '#FFFFFF' : '#2F264C',
            borderColor: isLight ? '#EBF0FF' : '#3D3554',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
              هامش الربح {profitMargin}%
            </span>
            <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#3B82F6' }}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xs font-semibold" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
            صافي الربح النهائي (Net Profit)
          </h3>
          <p className={`text-lg font-black font-mono mt-1 ${calculatedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {loading ? '...' : `${currency} ${calculatedNetProfit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span style={{ color: isLight ? '#64748B' : '#A49EC0' }}>مجمل الربح - المصروفات</span>
            <span className="font-bold text-blue-400 flex items-center gap-0.5">تفاصيل الربحية <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>

        {/* Card 4: Supplier Payables */}
        <div
          className="rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg relative overflow-hidden group cursor-pointer"
          onClick={() => setActiveTab('assets')}
          style={{
            background: isLight ? '#FFFFFF' : '#2F264C',
            borderColor: isLight ? '#EBF0FF' : '#3D3554',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
              التزامات واجبة السداد
            </span>
            <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#EF4444' }}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xs font-semibold" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
            ديون الموردين (Payables)
          </h3>
          <p className="text-lg font-black font-mono mt-1 text-rose-400">
            {loading ? '...' : `${currency} ${totalSupplierDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
            <span style={{ color: isLight ? '#64748B' : '#A49EC0' }}>مستحقات الموردين الحالية</span>
            <span className="font-bold text-rose-400 flex items-center gap-0.5">عرض التفاصيل <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>

      </div>

      {/* 2. UNIFIED STATEMENT CONTAINER WITH INTERACTIVE TABS */}
      <div 
        className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
        style={{
          background: isLight ? '#FAF9F6' : 'rgb(47, 38, 76)',
          borderColor: isLight ? '#E2E8F0' : '#3D3554',
        }}
      >
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 mb-4 gap-3" style={{ borderColor: isLight ? '#CBD5E1' : '#3D3554' }}>
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
              {activeTab === 'assets' && '🏛️ الميزانية العمومية وإجمالي أصول الشركة (Total Assets & Balance Sheet)'}
              {activeTab === 'pnl' && '📊 قائمة الأرباح والخسائر المعيارية (P&L Income Statement)'}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
              {activeTab === 'assets' && 'القيمة الإجمالية لممتلكات الشركة (المخزون + المستحقات + النقدية) مطروحاً منها الديون'}
              {activeTab === 'pnl' && 'تحليل الأرباح بناءً على المبيعات وتكلفة البضاعة المباعة (COGS) والمصروفات التشغيلية'}
            </p>
          </div>

          {/* Sleek Tab Switcher Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/20 border border-white/5 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('assets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'assets'
                  ? 'bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md'
                  : 'text-[#A49EC0] hover:text-white hover:bg-white/5'
              }`}
            >
              🏛️ الأصول والميزانية
            </button>

            <button
              onClick={() => setActiveTab('pnl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pnl'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'text-[#A49EC0] hover:text-white hover:bg-white/5'
              }`}
            >
              📊 قائمة الدخل (P&L)
            </button>
          </div>
        </div>

        {/* Dynamic Card Steps Grid */}
        <div className={`grid grid-cols-1 gap-3 ${activeSteps.length === 6 ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
          {activeSteps.map((st, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all relative ${
                st.isFinal ? 'ring-2 ring-[#ECC796]' : ''
              }`}
              style={{
                background: isLight ? (st.isFinal ? '#FEF3C7' : '#FFFFFF') : (st.isFinal ? '#2D2447' : '#231B3D'),
                borderColor: isLight ? '#E2E8F0' : '#3D3554',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border" style={{ borderColor: st.color, color: st.color }}>
                  {st.num}
                </span>
                {st.sign && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/20" style={{ color: st.color }}>
                    {st.sign}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold mb-0.5 truncate" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }} title={st.title}>
                  {st.title}
                </h3>
                <p className="text-[10px] leading-tight mb-2 min-h-[26px]" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                  {st.subtitle}
                </p>
              </div>

              <div className="border-t pt-2 mt-auto" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
                <p className="text-xs font-black font-mono" style={{ color: st.color }}>
                  {loading ? '...' : `${currency} ${st.value.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
