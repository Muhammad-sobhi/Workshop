import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Calendar, Wallet, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, FileSpreadsheet, FileText } from 'lucide-react';
import { DollarSign, Smartphone, Building2, Landmark, Users } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import PaymentDebts from '@/components/accounts/payment-debts';
import TransactionsTable from '@/components/accounts/transactions-table';
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

export default function TreasuryPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'revenue' | 'expense'
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [currency] = useState('EGP');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxDetails, setShowTxDetails] = useState(false);

  const [clientDebts, setClientDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(true);

  useEffect(() => {
    fetchTreasuryData();
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    setDebtsLoading(true);
    try {
      const [clientRes, suppRes] = await Promise.all([
        apiClient.get('/clients').catch(() => ({ data: [] })),
        apiClient.get('/suppliers').catch(() => ({ data: [] })),
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

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const [salesRes, expRes, poRes, opRes] = await Promise.all([
        apiClient.get('/sales').catch(() => ({ data: [] })),
        apiClient.get('/expenses').catch(() => ({ data: [] })),
        apiClient.get('/purchase-orders').catch(() => ({ data: [] })),
        apiClient.get('/operations').catch(() => ({ data: [] })),
      ]);

      // 1. PO Cash Deposits Paid Out to Suppliers
      const poDeposits = (poRes.data?.data ?? poRes.data ?? [])
        .filter(po => po.status !== 'Cancelled' && (parseFloat(po.deposit_paid) || 0) > 0)
        .map(po => {
          const ordNo = po.order_number || po.po_number || 'PO';
          const supName = po.supplier_name || po.supplier?.name || '';
          return {
            id: 'po-dep-' + po.id,
            type: 'expense',
            isInventoryAsset: true,
            number: ordNo,
            category: 'دفعة مقدمة لشراء خامات (مورد)',
            description: `دفعة مقدمة لشراء مواد خام لأمر شراء ${ordNo}` + (supName ? ` - المورد: ${supName}` : ''),
            amount: parseFloat(po.deposit_paid),
            date: po.order_date ? po.order_date.split('T')[0] : (po.created_at ? po.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            payment_method: po.payment_method || 'cash',
            client_name: '',
            supplier_name: supName,
            receipt_path: po.receipt_path || null,
          };
        });

      // 2. Production Order Deposits & Milestone Cash Payments Received
      const opPayments = (opRes.data?.data ?? opRes.data ?? [])
        .filter(op => op.status !== 'Cancelled')
        .flatMap(op => {
          const items = [];
          if ((parseFloat(op.deposit_paid) || 0) > 0) {
            items.push({
              id: 'op-dep-' + op.id,
              type: 'revenue',
              isDepositOnly: true,
              number: op.operation_number,
              category: 'عربون أمر تشغيل',
              description: `عربون مستلم لأمر التشغيل ${op.operation_number}` + (op.client?.name ? ` - العميل: ${op.client.name}` : ''),
              amount: parseFloat(op.deposit_paid),
              product_cost: 0,
              date: op.created_at ? op.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              payment_method: op.deposit_payment_method || 'cash',
              client_name: op.client?.name || '',
              supplier_name: '',
              receipt_path: null,
            });
          }
          if (Array.isArray(op.payments)) {
            op.payments.forEach(p => {
              items.push({
                id: 'op-pay-' + p.id,
                type: 'revenue',
                isDepositOnly: true,
                number: op.operation_number,
                category: 'دفعة مرحلية من عميل',
                description: `دفعة مستلمة لأمر التشغيل ${op.operation_number}` + (p.notes ? ` - ${p.notes}` : ''),
                amount: parseFloat(p.amount_paid) || 0,
                product_cost: 0,
                date: p.payment_date ? p.payment_date.split('T')[0] : new Date().toISOString().split('T')[0],
                payment_method: p.payment_method || 'cash',
                client_name: op.client?.name || '',
                supplier_name: '',
                receipt_path: p.receipt_path || null,
              });
            });
          }
          return items;
        });

      // 3. Direct Sales Counter Revenues (Excluding Order Delivery Invoices)
      const directRevenues = (salesRes.data?.data ?? salesRes.data ?? [])
        .filter((s) => !s.id?.toString().startsWith('op-sales-') && !s.reference_number?.startsWith('OP-') && !s.description?.includes('أمر الإنتاج'))
        .map((s) => {
          const isHistorical = s.category?.includes('مبيعات سابقة') || s.revenue_number?.startsWith('HIST-');
          const fullAmount = parseFloat(s.amount) || 0;
          let cogsAmount = parseFloat(s.cogs) || parseFloat(s.product_cost) || 0;
          if (isHistorical && cogsAmount === 0 && s.description) {
            const costMatch = s.description.match(/\[COST:\s*(\d+(?:\.\d+)?)\]/i);
            if (costMatch) cogsAmount = parseFloat(costMatch[1]);
          }
          const netCashAmount = isHistorical ? Math.max(0, fullAmount - cogsAmount) : fullAmount;
          return {
            id: s.id,
            type: 'revenue',
            number: s.revenue_number,
            category: s.category,
            description: s.description,
            amount: netCashAmount,
            full_amount: fullAmount,
            product_cost: cogsAmount,
            date: s.revenue_date,
            payment_method: s.payment_method || 'cash',
            client_name: s.client_name || '',
            supplier_name: s.supplier_name || '',
            receipt_path: s.receipt_path || null,
          };
        });

      // 4. Operating Expenses
      const expenses = (expRes.data?.data ?? expRes.data ?? []).map((e) => ({
        id: e.id,
        type: 'expense',
        number: e.expense_number,
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.expense_date,
        payment_method: e.payment_method || 'cash',
        client_name: e.client_name || '',
        supplier_name: e.supplier_name || '',
        receipt_path: e.receipt_path || null,
      }));

      // Combine ONLY REAL CASH FLOW TRANSACTIONS
      const allCashTransactions = [
        ...directRevenues,
        ...expenses,
        ...poDeposits,
        ...opPayments,
      ];

      allCashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allCashTransactions);
    } catch (err) {
      console.error('Error fetching treasury data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    let filtered = [...transactions];
    if (startDate) {
      filtered = filtered.filter(t => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(t => t.date <= endDate);
    }
    setTransactions(filtered);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    fetchTreasuryData();
  };

  // Filtered transactions for the table
  const filtered = transactions.filter(t =>
    (startDate ? t.date >= startDate : true) &&
    (endDate ? t.date <= endDate : true) &&
    (filterType === 'all' || t.type === filterType) &&
    (!paymentMethodFilter || t.payment_method === paymentMethodFilter)
  );

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Wallet className="w-6 h-6 text-[#ECC796]" />
              الخزينة والسيولة النقدية
            </h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إدارة وسائل وسندات السداد النقدي، رصيد المحافظ المالية، وسجل المعاملات الحقيقية
            </p>
          </div>

          {/* Date Filter & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#A49EC0' }} />
              <input id="treasury-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs bg-transparent outline-none border-none text-white" style={{ minWidth: 110 }} />
            </div>
            <span className="text-xs text-[#A49EC0]">—</span>
            <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#A49EC0' }} />
              <input id="treasury-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs bg-transparent outline-none border-none text-white" style={{ minWidth: 110 }} />
            </div>
            <button onClick={handleFilter} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30]">تطبيق</button>
            {(startDate || endDate) && (
              <button onClick={handleReset} className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إعادة تعيين</button>
            )}
          </div>
        </div>

        {/* Payment Method Cards & Debts Breakdown */}
        <PaymentDebts
          transactions={transactions}
          paymentMethodFilter={paymentMethodFilter}
          setPaymentMethodFilter={setPaymentMethodFilter}
          debtsLoading={debtsLoading}
          clientDebts={clientDebts}
          supplierDebts={supplierDebts}
          currency={currency}
        />

        {/* Real Cash Transactions Table */}
        <TransactionsTable
          loading={loading}
          filtered={pagedFiltered}
          setFilterType={setFilterType}
          filterType={filterType}
          paymentMethodFilter={paymentMethodFilter}
          setPaymentMethodFilter={setPaymentMethodFilter}
          currency={currency}
          onViewDetails={(tx) => { setSelectedTx(tx); setShowTxDetails(true); }}
        />

        <Pagination
          currentPage={page}
          lastPage={lastPage}
          total={filtered.length}
          loading={loading}
          onPageChange={(p) => setPage(p)}
        />

        <TransactionDetailsModal
          show={showTxDetails}
          onClose={() => { setShowTxDetails(false); setSelectedTx(null); }}
          transaction={selectedTx}
          currency={currency}
        />
      </div>
    </MainLayout>
  );
}
