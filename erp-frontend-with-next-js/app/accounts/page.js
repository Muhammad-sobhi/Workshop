'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Calendar, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import KpiCards from '@/components/accounts/kpi-cards';
import ChartsPanel from '@/components/accounts/charts-panel';
import PaymentDebts from '@/components/accounts/payment-debts';
import TransactionsTable from '@/components/accounts/transactions-table';

const arabicMonths = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
};

function buildChartData(transactions) {
  const map = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!map[key]) {
      map[key] = { month: arabicMonths[d.getMonth() + 1], revenue: 0, expense: 0 };
    }
    if (t.type === 'revenue') map[key].revenue += parseFloat(t.amount) || 0;
    else map[key].expense += parseFloat(t.amount) || 0;
  });
  return Object.values(map).slice(-6);
}

export default function AccountsPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'ر.س';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [clientDebts, setClientDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(true);

  const fetchTransactions = (sd, ed) => {
    setLoading(true);
    const params = {};
    if (sd) params.start_date = sd;
    if (ed) params.end_date = ed;
    Promise.all([
      apiClient.get('/sales', { params }),
      apiClient.get('/expenses', { params }),
    ]).then(([salesRes, expRes]) => {
      const mapped = [
        ...(salesRes.data?.data ?? salesRes.data ?? []).map((s) => ({
          id: s.id, type: 'revenue',
          number: s.revenue_number, category: s.category,
          description: s.description, amount: s.amount, date: s.revenue_date,
          payment_method: s.payment_method,
        })),
        ...(expRes.data?.data ?? expRes.data ?? []).map((e) => ({
          id: e.id, type: 'expense',
          number: e.expense_number, category: e.category,
          description: e.description, amount: e.amount, date: e.expense_date,
          payment_method: e.payment_method,
        })),
      ];
      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(mapped);
    }).finally(() => setLoading(false));
  };

  const fetchDebts = () => {
    setDebtsLoading(true);
    Promise.all([
      apiClient.get('/clients').catch(() => ({ data: [] })),
      apiClient.get('/suppliers').catch(() => ({ data: [] })),
    ]).then(([clientRes, suppRes]) => {
      const cData = clientRes.data?.data ?? [];
      const sData = suppRes.data?.data ?? [];
      setClientDebts(cData.filter((c) => (parseFloat(c.debt_amount) || 0) > 0));
      setSupplierDebts(sData.filter((s) => (parseFloat(s.debt_amount) || 0) > 0));
    }).finally(() => setDebtsLoading(false));
  };

  useEffect(() => { fetchTransactions(); fetchDebts(); }, []);

  const handleFilter = () => fetchTransactions(startDate, endDate);
  const handleReset = () => { setStartDate(''); setEndDate(''); fetchTransactions(); };

  useEffect(() => {
    if (page > Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))) {
      setPage(1);
    }
  }, [filterType, paymentMethodFilter, transactions]);

  const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';
  const chartData = buildChartData(transactions);
  const filtered = transactions.filter(t =>
    (filterType === 'all' || t.type === filterType) &&
    (!paymentMethodFilter || t.payment_method === paymentMethodFilter)
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const expenseByCategory = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + (parseFloat(t.amount) || 0);
  });
  const expCatData = Object.entries(expenseByCategory).map(([cat, val]) => ({ name: cat, value: val }));

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">الحسابات المالية</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>ملخص الإيرادات والمصروفات والديون خلال فترة محددة</p>
          </div>
          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#A49EC0' }} />
              <input id="accounts-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs bg-transparent outline-none border-none" style={{ color: startDate ? '#FFF' : '#A49EC0', minWidth: 110 }} />
            </div>
            <span className="text-xs" style={{ color: '#A49EC0' }}>—</span>
            <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#A49EC0' }} />
              <input id="accounts-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs bg-transparent outline-none border-none" style={{ color: endDate ? '#FFF' : '#A49EC0', minWidth: 110 }} />
            </div>
            <button onClick={handleFilter} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>تطبيق</button>
            {(startDate || endDate) && (
              <button onClick={handleReset} className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إعادة تعيين</button>
            )}
          </div>
        </div>

        {startDate || endDate ? (
          <div className="px-4 py-2 rounded-xl text-xs flex items-center gap-2" style={{ background: 'rgba(141,126,200,0.15)', color: '#C4B8F0', border: '1px solid rgba(141,126,200,0.25)' }}>
            <AlertCircle className="w-3.5 h-3.5" />
            عرض الفترة من {startDate || 'البداية'} إلى {endDate || 'الآن'}
          </div>
        ) : null}

        <KpiCards loading={loading} totalRevenue={totalRevenue} totalExpense={totalExpense} netProfit={netProfit} profitMargin={profitMargin} currency={currency} />
        <ChartsPanel loading={loading} chartData={chartData} expCatData={expCatData} totalExpense={totalExpense} currency={currency} />
        <PaymentDebts transactions={transactions} paymentMethodFilter={paymentMethodFilter} setPaymentMethodFilter={setPaymentMethodFilter} debtsLoading={debtsLoading} clientDebts={clientDebts} supplierDebts={supplierDebts} currency={currency} />
        <TransactionsTable loading={loading} filtered={pagedFiltered} setFilterType={setFilterType} filterType={filterType} paymentMethodFilter={paymentMethodFilter} setPaymentMethodFilter={setPaymentMethodFilter} currency={currency} />
        <Pagination
          currentPage={page}
          lastPage={lastPage}
          total={filtered.length}
          loading={loading}
          onPageChange={(p) => { setPage(p); }}
        />
      </div>
    </MainLayout>
  );
}
