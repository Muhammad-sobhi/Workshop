'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Calendar, RefreshCw, Sparkles, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import KpiCards from '@/components/accounts/kpi-cards';
import ChartsPanel from '@/components/accounts/charts-panel';

export default function AccountsPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('this_month'); // 'this_month' | 'last_3_months' | 'this_year' | 'all' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [clientDebts, setClientDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);

  // Financial KPIs
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    totalExpense: 0,
    netProfit: 0,
    inventoryValue: 0,
    cashInHand: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [expCatData, setExpCatData] = useState([]);

  // Apply Date Presets
  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'this_month') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_3_months') {
      const firstDay = new Date(y, m - 2, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'this_year') {
      const firstDay = `${y}-01-01`;
      const lastDay = `${y}-12-31`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    applyPreset('this_month');
  }, []);

  const fetchFinancials = () => {
    setLoading(true);
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    Promise.all([
      apiClient.get('/dashboard', { params: { date: endDate || undefined } }).catch(() => ({ data: {} })),
      apiClient.get('/treasury/summary', { params }).catch(() => ({ data: null })),
      apiClient.get('/treasury/transactions', { params: { ...params, per_page: 1000 } }).catch(() => ({ data: [] })),
      apiClient.get('/clients', { params: { all: true } }).catch(() => ({ data: [] })),
      apiClient.get('/suppliers', { params: { all: true } }).catch(() => ({ data: [] })),
    ])
      .then(([dashRes, treasurySumRes, txRes, clientRes, suppRes]) => {
        const d = dashRes.data || {};
        const sum = treasurySumRes.data || {};
        const txList = txRes.data?.data ?? txRes.data ?? [];
        const cData = clientRes.data?.data ?? clientRes.data ?? [];
        const sData = suppRes.data?.data ?? suppRes.data ?? [];

        // Parse KPIs
        let rev = 0, cogs = 0, gross = 0, opex = 0, net = 0, inv = d.inventory_value || 0;
        if (Array.isArray(d.kpis)) {
          d.kpis.forEach(k => {
            const num = parseFloat((k.value || '').toString().replace(/[^0-9.-]/g, '')) || 0;
            if (k.label?.includes('إجمالي الإيرادات')) rev = num;
            if (k.label?.includes('COGS') || k.label?.includes('تكلفة البضاعة')) cogs = num;
            if (k.label?.includes('مجمل الربح')) gross = num;
            if (k.label?.includes('المصروفات')) opex = num;
            if (k.label?.includes('صافي الربح')) net = num;
            if (k.label?.includes('المخزون')) inv = num;
          });
        }

        setKpis({
          totalRevenue: rev,
          totalCogs: cogs,
          grossProfit: gross,
          totalExpense: opex,
          netProfit: net,
          inventoryValue: inv,
          cashInHand: sum.total_balance ?? 0,
        });

        if (Array.isArray(d.revenueChart)) {
          setChartData(d.revenueChart);
        }

        if (Array.isArray(d.expenseByCategory)) {
          setExpCatData(d.expenseByCategory);
        } else if (Array.isArray(d.expense_by_category)) {
          setExpCatData(d.expense_by_category);
        } else {
          setExpCatData([]);
        }

        setTransactions(txList);
        setClientDebts(cData.filter(c => (parseFloat(c.debt_amount) || 0) > 0));
        setSupplierDebts(sData.filter(s => (parseFloat(s.debt_amount) || 0) > 0));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFinancials();
  }, [startDate, endDate]);

  const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + (parseFloat(s.debt_amount) || 0), 0);
  const totalClientDebt = clientDebts.reduce((sum, c) => sum + (parseFloat(c.debt_amount) || 0), 0);
  const totalAssets = (parseFloat(kpis.inventoryValue) || 0) + totalClientDebt + Math.max(0, kpis.cashInHand);
  const netEquity = totalAssets - totalSupplierDebt;
  const isHealthy = netEquity >= 0 && kpis.netProfit >= 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* Header & Date Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">المركز المالي والحسابات التنفيذية</h1>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border ${
                isHealthy 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {isHealthy ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {isHealthy ? 'وضع مالي سليم ومتوازن' : 'تنبيه: التزامات تحتاج متابعة'}
              </span>
            </div>
            <p className="text-xs mt-1 text-[#A49EC0]">
              الميزانية العمومية، حقوق الملكية، أرباح التشغيل، وشلال قائمة الدخل (P&L) بدقة 100%
            </p>
          </div>

          {/* Quick Date Presets & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#2F264C] border border-[#3D3554]">
              <button
                onClick={() => applyPreset('this_month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === 'this_month' ? 'bg-[#ECC796] text-[#201A30]' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => applyPreset('last_3_months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === 'last_3_months' ? 'bg-[#ECC796] text-[#201A30]' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                آخر 3 أشهر
              </button>
              <button
                onClick={() => applyPreset('this_year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === 'this_year' ? 'bg-[#ECC796] text-[#201A30]' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                هذا العام
              </button>
              <button
                onClick={() => setDatePreset('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === 'custom' ? 'bg-[#ECC796] text-[#201A30]' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                مخصص
              </button>
            </div>

            {/* Custom Date Pickers */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 bg-[#2F264C] border-[#3D3554]">
                  <Calendar className="w-3.5 h-3.5 text-[#A49EC0]" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="text-xs bg-transparent outline-none border-none text-white"
                  />
                </div>
                <span className="text-xs text-[#A49EC0]">—</span>
                <div className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 bg-[#2F264C] border-[#3D3554]">
                  <Calendar className="w-3.5 h-3.5 text-[#A49EC0]" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="text-xs bg-transparent outline-none border-none text-white"
                  />
                </div>
              </div>
            )}

            <button
              onClick={fetchFinancials}
              className="p-2.5 rounded-xl border transition-all hover:bg-white/5 text-[#A49EC0] bg-[#2F264C] border-[#3D3554]"
              title="تحديث البيانات المالية"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 1. Core KPIs, Visual Financial Equation & P&L Waterfall */}
        <KpiCards
          loading={loading}
          totalRevenue={kpis.totalRevenue}
          totalCogs={kpis.totalCogs}
          totalExpense={kpis.totalExpense}
          grossProfit={kpis.grossProfit}
          netProfit={kpis.netProfit}
          profitMargin={kpis.totalRevenue > 0 ? (kpis.netProfit / kpis.totalRevenue) * 100 : 0}
          inventoryValue={kpis.inventoryValue}
          cashInHand={kpis.cashInHand}
          currency={currency}
          clientDebts={clientDebts}
          supplierDebts={supplierDebts}
          transactions={transactions}
        />

        {/* 2. 6-Month Cashflow Area Chart & Expense Distribution */}
        <ChartsPanel
          chartData={chartData}
          expCatData={expCatData}
          totalRevenue={kpis.totalRevenue}
          totalExpense={kpis.totalExpense}
          currency={currency}
          loading={loading}
        />

      </div>
    </MainLayout>
  );
}
