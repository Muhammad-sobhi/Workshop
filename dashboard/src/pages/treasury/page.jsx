'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/main-layout';
import { 
  Calendar, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, 
  PlusCircle, MinusCircle, ArrowRightLeft, ShieldCheck, Sparkles, HelpCircle, AlertTriangle
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import PaymentDebts from '@/components/accounts/payment-debts';
import TransactionsTable from '@/components/accounts/transactions-table';
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';
import TreasuryActionModal from '@/components/accounts/TreasuryActionModal';
import Pagination from '@/components/Pagination';
import { toLocalDateString, todayString } from '@/lib/dates';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 1000;

// Table filter -> API "type" (transfers between wallets are neither revenue nor expense)
const TYPE_PARAM = { revenue: 'inflow', expense: 'outflow', transfer: 'transfer' };

export default function TreasuryPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [txMeta, setTxMeta] = useState({ lastPage: 1, total: 0, totals: null });
  const [summary, setSummary] = useState({
    total_balance: 0,
    total_inflow: 0,
    total_outflow: 0,
    methods: {
      cash: { balance: 0, inflow: 0, outflow: 0 },
      instapay: { balance: 0, inflow: 0, outflow: 0 },
      vodafone_cash: { balance: 0, inflow: 0, outflow: 0 },
      bank_transfer: { balance: 0, inflow: 0, outflow: 0 },
      postal_transfer: { balance: 0, inflow: 0, outflow: 0 },
    }
  });

  const [datePreset, setDatePreset] = useState('this_month'); // 'this_month' | 'last_3_months' | 'this_year' | 'all' | 'custom'
  // Start on "this month" directly so the first fetch already uses the right period
  const [startDate, setStartDate] = useState(() => { const n = new Date(); return toLocalDateString(new Date(n.getFullYear(), n.getMonth(), 1)); });
  const [endDate, setEndDate] = useState(() => { const n = new Date(); return toLocalDateString(new Date(n.getFullYear(), n.getMonth() + 1, 0)); });

  const [filterType, setFilterType] = useState('all'); // 'all' | 'revenue' | 'expense' | 'transfer'
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [currency] = useState('EGP');

  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxDetails, setShowTxDetails] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'deposit' | 'withdraw' | 'transfer' | null
  const [editingTx, setEditingTx] = useState(null);

  const [clientDebts, setClientDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [showDebts, setShowDebts] = useState(false);

  // Apply Date Presets
  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'this_month') {
      const firstDay = toLocalDateString(new Date(y, m, 1));
      const lastDay = toLocalDateString(new Date(y, m + 1, 0));
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_3_months') {
      const firstDay = toLocalDateString(new Date(y, m - 2, 1));
      const lastDay = toLocalDateString(new Date(y, m + 1, 0));
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

  const fetchDebts = async () => {
    setDebtsLoading(true);
    try {
      const [clientRes, suppRes] = await Promise.all([
        apiClient.get('/clients', { params: { all: true } }).catch(() => ({ data: [] })),
        apiClient.get('/suppliers', { params: { all: true } }).catch(() => ({ data: [] })),
      ]);
      const cData = clientRes.data?.data ?? clientRes.data ?? [];
      const sData = suppRes.data?.data ?? suppRes.data ?? [];
      setClientDebts(cData.filter(c => (parseFloat(c.debt_amount) || 0) > 0));
      setSupplierDebts(sData.filter(s => (parseFloat(s.debt_amount) || 0) > 0));
    } catch (err) {
      console.error(err);
    } finally {
      setDebtsLoading(false);
    }
  };

  const dateParams = () => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  };

  const txParams = () => {
    const params = dateParams();
    if (TYPE_PARAM[filterType]) params.type = TYPE_PARAM[filterType];
    if (paymentMethodFilter) params.payment_method = paymentMethodFilter;
    return params;
  };

  const summaryRequestId = useRef(0);
  const fetchSummary = async () => {
    const requestId = ++summaryRequestId.current;
    try {
      const res = await apiClient.get('/treasury/summary', { params: dateParams() });
      if (res.data && requestId === summaryRequestId.current) setSummary(res.data);
    } catch (err) {
      console.error('Error fetching treasury summary:', err);
    }
  };

  // Ignore responses of requests superseded by a newer filter / page change
  const txRequestId = useRef(0);
  const fetchTransactions = async () => {
    const requestId = ++txRequestId.current;
    setLoading(true);
    try {
      const res = await apiClient.get('/treasury/transactions', { params: { ...txParams(), page, per_page: PAGE_SIZE } });
      if (requestId !== txRequestId.current) return;
      setTransactions(res.data?.data ?? []);
      setTxMeta({
        lastPage: res.data?.last_page ?? 1,
        total: res.data?.total ?? 0,
        totals: res.data?.totals ?? null,
      });
    } catch (err) {
      if (requestId === txRequestId.current) {
        console.error('Error fetching treasury transactions:', err);
        setTransactions([]);
        setTxMeta({ lastPage: 1, total: 0, totals: null });
      }
    } finally {
      if (requestId === txRequestId.current) setLoading(false);
    }
  };

  // Every row matching the current filters, for export
  const fetchAllRows = async () => {
    const rows = [];
    let current = 1;
    let last = 1;
    do {
      const res = await apiClient.get('/treasury/transactions', { params: { ...txParams(), page: current, per_page: EXPORT_PAGE_SIZE } });
      rows.push(...(res.data?.data ?? []));
      last = res.data?.last_page ?? 1;
      current++;
    } while (current <= last);
    return rows;
  };

  const refreshAll = () => {
    fetchSummary();
    fetchTransactions();
    fetchDebts();
  };

  // Debts do not depend on the period
  useEffect(() => {
    fetchDebts();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [startDate, endDate]);

  // Any filter change starts again from the first page
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, filterType, paymentMethodFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate, filterType, paymentMethodFilter, page]);

  const handleDeleteTx = async (tx) => {
    const what = tx.is_transfer ? 'هذا التحويل (سيتم حذف طرفيه الصادر والوارد)' : 'هذه الحركة';
    if (!window.confirm(`هل أنت متأكد من حذف ${what} نهائياً من الخزينة؟`)) return;
    try {
      await apiClient.delete(`/treasury/transactions/${tx.id}`);
      setShowTxDetails(false);
      setSelectedTx(null);
      refreshAll();
    } catch (err) {
      const errors = err?.response?.data?.errors;
      alert((errors && Object.values(errors)[0]?.[0]) || err?.response?.data?.message || 'تعذر حذف الحركة');
    }
  };

  const handleEditTx = (tx) => {
    setShowTxDetails(false);
    setSelectedTx(null);
    setEditingTx(tx);
    setModalMode(tx.is_transfer ? 'transfer' : (tx.type === 'inflow' ? 'deposit' : 'withdraw'));
  };

  const totalBalance = summary.total_balance ?? 0;
  const totalInflow = summary.total_inflow ?? 0;
  const totalOutflow = summary.total_outflow ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* Header & Date Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                <Wallet className="w-6 h-6 text-[#ECC796]" />
                إدارة الخزينة والسيولة النقدية
              </h1>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                حسابات نقدية فعلية 100%
              </span>
            </div>
            <p className="text-xs mt-1 text-[#A49EC0]">
              تتبع رصيد الخزينة، تدفقات الكاش الواردة والصادرة لحظياً، وتغذية المحافظ المالية
            </p>
          </div>

          {/* Quick Date Presets & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => applyPreset('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === 'all' ? 'bg-[#ECC796] text-[#201A30]' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                الكل
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
              onClick={refreshAll}
              className="p-2.5 rounded-xl border transition-all hover:bg-white/5 text-[#A49EC0] bg-[#2F264C] border-[#3D3554]"
              title="تحديث بيانات الخزينة"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 1. TOP HERO LIQUIDITY CARD & QUICK ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Main Hero Card (8 cols) */}
          <div 
            className="lg:col-span-8 rounded-2xl border p-5 flex flex-col justify-between relative overflow-hidden shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #2A2146, #1D172E)',
              borderColor: '#3D3554',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#ECC796]/20 text-[#ECC796] border border-[#ECC796]/30">
                  إجمالي السيولة النقدية المتوفرة (Total Cash in Hand)
                </span>
                <p className="text-2xl sm:text-3xl font-black font-mono text-[#ECC796] mt-2">
                  {loading ? '...' : `${currency} ${Number(totalBalance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
                </p>
                <p className="text-xs text-[#A49EC0] mt-0.5">
                  رصيد السيولة الفعلي الجاهز للصرف عبر جميع المحافظ وطرق الدفع
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                <button
                  onClick={() => { setEditingTx(null); setModalMode('deposit'); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                >
                  <PlusCircle size={15} />
                  + إيداع نقدي
                </button>
                <button
                  onClick={() => { setEditingTx(null); setModalMode('withdraw'); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 bg-rose-500 text-white shadow-md shadow-rose-500/20"
                >
                  <MinusCircle size={15} />
                  - سحب نقدية
                </button>
                <button
                  onClick={() => { setEditingTx(null); setModalMode('transfer'); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 bg-purple-500 text-white shadow-md shadow-purple-500/20"
                >
                  <ArrowRightLeft size={15} />
                  ⇄ تحويل محافظ
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#3D3554]/60 text-xs text-[#A49EC0]">
              <span>💡 يشمل مبيعات المعرض، عربون الطلبيات، والمصروفات التشغيلية المباشرة.</span>
              <button 
                onClick={() => setShowDebts(!showDebts)}
                className="text-xs font-bold text-[#ECC796] hover:underline"
              >
                {showDebts ? 'إخفاء الديون المعلقة' : 'عرض ديون العملاء والموردين المعلقة 👥'}
              </button>
            </div>
          </div>

          {/* Inflow Card (2 cols) */}
          <div 
            className="lg:col-span-2 rounded-2xl border p-4.5 flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, #1C3529, #152A20)',
              borderColor: '#10B98144',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-400">الوارد للفترة</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <p className="text-lg font-black font-mono text-emerald-400">
                +{currency} {Number(totalInflow).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[10px] text-gray-300 pt-2 border-t border-[#10B98133]">
              المقبوضات والتحصيلات
            </p>
          </div>

          {/* Outflow Card (2 cols) */}
          <div 
            className="lg:col-span-2 rounded-2xl border p-4.5 flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, #371C27, #29151D)',
              borderColor: '#EF444444',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-rose-400">المنصرف للفترة</span>
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <ArrowDownRight size={16} />
                </div>
              </div>
              <p className="text-lg font-black font-mono text-rose-400">
                -{currency} {Number(totalOutflow).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[10px] text-gray-300 pt-2 border-t border-[#EF444433]">
              المدفوعات والمصروفات
            </p>
          </div>

        </div>

        {/* 2. FINTECH DIGITAL WALLET CARDS & OPTIONAL DEBTS */}
        <PaymentDebts
          transactions={transactions}
          methodBalances={summary.methods}
          paymentMethodFilter={paymentMethodFilter}
          setPaymentMethodFilter={setPaymentMethodFilter}
          debtsLoading={debtsLoading}
          clientDebts={clientDebts}
          supplierDebts={supplierDebts}
          currency={currency}
          hidePaymentMethods={false}
          hideDebts={!showDebts}
        />

        {/* 3. REAL CASH TRANSACTIONS LEDGER TABLE */}
        <div className="space-y-3">
          <TransactionsTable
            loading={loading}
            filtered={transactions}
            total={txMeta.total}
            totals={txMeta.totals}
            fetchAllRows={fetchAllRows}
            setFilterType={setFilterType}
            filterType={filterType}
            paymentMethodFilter={paymentMethodFilter}
            setPaymentMethodFilter={setPaymentMethodFilter}
            currency={currency}
            onViewDetails={(tx) => { setSelectedTx(tx); setShowTxDetails(true); }}
          />

          <Pagination
            currentPage={page}
            lastPage={txMeta.lastPage}
            total={txMeta.total}
            loading={loading}
            onPageChange={(p) => setPage(p)}
          />
        </div>

        {/* Modals */}
        <TransactionDetailsModal
          show={showTxDetails}
          onClose={() => { setShowTxDetails(false); setSelectedTx(null); }}
          transaction={selectedTx}
          currency={currency}
          onEdit={handleEditTx}
          onDelete={handleDeleteTx}
        />

        {/* Modal for Manual Deposit / Withdraw / Transfer */}
        <TreasuryActionModal
          show={!!modalMode}
          mode={modalMode}
          transaction={editingTx}
          currency={currency}
          onClose={() => { setModalMode(null); setEditingTx(null); }}
          onSuccess={refreshAll}
        />

      </div>
    </MainLayout>
  );
}
