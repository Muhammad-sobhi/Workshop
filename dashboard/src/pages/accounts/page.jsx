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
import TransactionDetailsModal from '@/components/accounts/TransactionDetailsModal';

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
  const PAGE_SIZE = 10;

  const [clientDebts, setClientDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [inventoryValue, setInventoryValue] = useState(0);

  // Modal states
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxDetails, setShowTxDetails] = useState(false);

  const fetchTransactions = (sd, ed) => {
    setLoading(true);
    const params = {};
    if (sd) params.start_date = sd;
    if (ed) params.end_date = ed;
    Promise.all([
      apiClient.get('/sales', { params: { ...params, per_page: 9999 } }).catch(() => ({ data: [] })),
      apiClient.get('/expenses', { params: { ...params, per_page: 9999 } }).catch(() => ({ data: [] })),
      apiClient.get('/purchase-orders', { params: { ...params, per_page: 9999 } }).catch(() => ({ data: [] })),
      apiClient.get('/operations', { params: { ...params, per_page: 9999 } }).catch(() => ({ data: [] })),
      apiClient.get('/external-service-orders', { params: { ...params, per_page: 9999 } }).catch(() => ({ data: [] })),
      apiClient.get('/dashboard').catch(() => ({ data: {} })),
      apiClient.get('/inventory').catch(() => ({ data: [] })),
    ]).then(([salesRes, expRes, poRes, opRes, esoRes, dashRes, invRes]) => {
      const expList = expRes.data?.data ?? expRes.data ?? [];

      // PO deposits: only include if NOT already tracked in expenses (prevents double-counting)
      const poList = poRes.data?.data ?? poRes.data ?? [];
      const poDeposits = poList
        .filter(po => (parseFloat(po.deposit_paid) || 0) > 0)
        .filter(po => {
          // Check if any expense record already covers this PO's deposit
          const alreadyInExpenses = expList.some(e => {
            // Match by reference_number
            if (e.reference_number && e.reference_number === po.order_number) return true;
            // Match by description containing PO order number
            if (e.description && e.description.includes(po.order_number)) return true;
            // Match by supplier name + similar amount (for supplier debt payments)
            const expSupName = (e.supplier_name || '').trim();
            const poSupName = (po.supplier_name || '').trim();
            if (expSupName && poSupName && expSupName === poSupName && 
                e.category?.includes('تسديد') &&
                Math.abs((parseFloat(e.amount) || 0) - (parseFloat(po.deposit_paid) || 0)) < 0.01) {
              return true;
            }
            return false;
          });
          return !alreadyInExpenses;
        })
        .map(po => ({
          id: 'po-' + po.id,
          type: 'expense',
          isInventoryAsset: true,
          number: po.order_number,
          category: 'مشتريات مواد خام (دفعة مقدمة)',
          description: `دفعة مقدمة لشراء مواد خام لأمر ${po.order_number}` + (po.supplier_name ? ` - المورد: ${po.supplier_name}` : ''),
          amount: parseFloat(po.deposit_paid),
          date: po.order_date,
          payment_method: po.payment_method || 'cash',
          client_name: '',
          supplier_name: po.supplier_name || '',
          receipt_path: null,
        }));

      // ESO payments: extract from orders.data (nested paginated response) or flat array
      const esoRaw = esoRes.data?.orders?.data ?? esoRes.data?.data ?? esoRes.data ?? [];
      const esoOrders = Array.isArray(esoRaw) ? esoRaw : [];
      const esoPayments = esoOrders
        .filter(eso => eso.status !== 'cancelled')
        .flatMap(eso => {
          const items = [];
          if (Array.isArray(eso.payments) && eso.payments.length > 0) {
            eso.payments.forEach(p => {
              items.push({
                id: 'eso-pay-' + p.id,
                type: 'expense',
                isEsoPayment: true,
                number: eso.order_number,
                category: 'خدمات خارجية / ورش',
                description: `دفعة أمر تشغيل خارجي (${eso.order_number}) - ${eso.item_description}` + (eso.supplier?.name ? ` - الورشة: ${eso.supplier.name}` : ''),
                amount: parseFloat(p.amount) || 0,
                date: p.payment_date ? p.payment_date.split('T')[0] : (eso.sent_date ? eso.sent_date.split('T')[0] : ''),
                payment_method: p.payment_method || 'instapay',
                client_name: '',
                supplier_name: eso.supplier?.name || '',
                receipt_path: p.receipt_image_path || null,
              });
            });
          } else if ((parseFloat(eso.total_paid) || 0) > 0) {
            items.push({
              id: 'eso-dep-' + eso.id,
              type: 'expense',
              isEsoPayment: true,
              number: eso.order_number,
              category: 'خدمات خارجية / ورش',
              description: `دفعة أمر تشغيل خارجي (${eso.order_number}) - ${eso.item_description}` + (eso.supplier?.name ? ` - الورشة: ${eso.supplier.name}` : ''),
              amount: parseFloat(eso.total_paid) || 0,
              date: eso.sent_date ? eso.sent_date.split('T')[0] : '',
              payment_method: eso.payment_method || 'instapay',
              client_name: '',
              supplier_name: eso.supplier?.name || '',
              receipt_path: null,
            });
          }
          return items;
        });

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
                category: 'دفعة عميل على أمر تشغيل',
                description: `دفعة مستلمة لأمر التشغيل ${op.operation_number}` + (op.client?.name ? ` - العميل: ${op.client.name}` : ''),
                amount: parseFloat(p.amount_paid) || 0,
                product_cost: 0,
                date: p.payment_date,
                payment_method: p.payment_method || 'cash',
                client_name: op.client?.name || '',
                supplier_name: '',
                receipt_path: p.receipt_path || null,
              });
            });
          }
          return items;
        });

      const mapped = [
        ...(salesRes.data?.data ?? salesRes.data ?? []).map((s) => {
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
            cogs: cogsAmount,
            isHistorical: isHistorical,
            date: s.revenue_date,
            payment_method: s.payment_method || 'cash',
            client_name: s.client_name || '',
            supplier_name: s.supplier_name || '',
            receipt_path: s.receipt_path || null,
          };
        }),
        ...expList.map((e) => ({
          id: e.id, type: 'expense',
          number: e.expense_number, category: e.category,
          description: e.description, amount: e.amount, date: e.expense_date,
          payment_method: e.payment_method,
          client_name: e.client_name || '',
          supplier_name: e.supplier_name || '',
          receipt_path: e.receipt_path || null,
        })),
        ...poDeposits,
        ...esoPayments,
        ...opPayments,
      ];
      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(mapped);

      // Calculate total live inventory value directly from /inventory items with robust fallback to /dashboard
      const invItems = Array.isArray(invRes.data?.data) ? invRes.data.data : (Array.isArray(invRes.data) ? invRes.data : []);
      let totalInvVal = 0;
      if (invItems.length > 0) {
        totalInvVal = invItems.reduce((sum, item) => {
          const qty = Math.max(0, parseFloat(item.quantity) || 0);
          const price = parseFloat(item.price || item.unit_cost || item.sale_price) || 0;
          return sum + (qty * price);
        }, 0);
      }

      if (totalInvVal <= 0) {
        if (dashRes.data?.inventory_value !== undefined) {
          totalInvVal = parseFloat(dashRes.data.inventory_value) || 0;
        } else {
          const kpis = dashRes.data?.kpis ?? [];
          const invKpi = kpis.find(k => k.label?.includes('المخزون'));
          if (invKpi) {
            const valStr = (invKpi.value || '').replace(/[^0-9.]/g, '');
            totalInvVal = parseFloat(valStr) || 0;
          }
        }
      }
      setInventoryValue(totalInvVal);
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

  // Independent inventory value loader — runs separately so it's never blocked by other API failures
  const fetchInventoryValue = () => {
    apiClient.get('/inventory').then(res => {
      const items = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      let total = 0;
      if (items.length > 0) {
        total = items.reduce((sum, item) => {
          const qty = Math.max(0, parseFloat(item.quantity) || 0);
          const price = parseFloat(item.price || item.unit_cost || item.sale_price) || 0;
          return sum + (qty * price);
        }, 0);
      }
      if (total > 0) {
        setInventoryValue(total);
      } else {
        // Fallback to dashboard API
        apiClient.get('/dashboard').then(dashRes => {
          let fallbackVal = 0;
          if (dashRes.data?.inventory_value !== undefined) {
            fallbackVal = parseFloat(dashRes.data.inventory_value) || 0;
          } else {
            const kpis = dashRes.data?.kpis ?? [];
            const invKpi = kpis.find(k => k.label?.includes('المخزون'));
            if (invKpi) {
              const valStr = (invKpi.value || '').replace(/[^0-9.]/g, '');
              fallbackVal = parseFloat(valStr) || 0;
            }
          }
          if (fallbackVal > 0) setInventoryValue(fallbackVal);
        }).catch(() => {});
      }
    }).catch(() => {
      // If /inventory fails, try dashboard
      apiClient.get('/dashboard').then(dashRes => {
        let fallbackVal = 0;
        if (dashRes.data?.inventory_value !== undefined) {
          fallbackVal = parseFloat(dashRes.data.inventory_value) || 0;
        } else {
          const kpis = dashRes.data?.kpis ?? [];
          const invKpi = kpis.find(k => k.label?.includes('المخزون'));
          if (invKpi) {
            const valStr = (invKpi.value || '').replace(/[^0-9.]/g, '');
            fallbackVal = parseFloat(valStr) || 0;
          }
        }
        if (fallbackVal > 0) setInventoryValue(fallbackVal);
      }).catch(() => {});
    });
  };

  useEffect(() => { fetchTransactions(); fetchDebts(); fetchInventoryValue(); }, []);

  const handleFilter = () => fetchTransactions(startDate, endDate);
  const handleReset = () => { setStartDate(''); setEndDate(''); fetchTransactions(); };

  useEffect(() => {
    if (page > Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))) {
      setPage(1);
    }
  }, [filterType, paymentMethodFilter, transactions]);

  const totalRevenue = transactions.filter(t => t.type === 'revenue' && !t.isDepositOnly).reduce((s, t) => s + (parseFloat(t.full_amount || t.amount) || 0), 0);

  // Cost of Goods Sold (COGS) for products sold
  const totalCogs = transactions
    .filter(t => t.type === 'revenue' && !t.isDepositOnly)
    .reduce((s, t) => s + (parseFloat(t.product_cost) || 0), 0);

  // Operating Expenses (Rent, Salaries, Utilities, etc.)
  const totalExpense = transactions
    .filter(t => t.type === 'expense' && !t.isInventoryAsset)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - totalExpense;
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

  // Date filtered debts
  const filteredClients = clientDebts.filter(c => {
    if (startDate && c.debt_due_date && c.debt_due_date < startDate) return false;
    if (endDate && c.debt_due_date && c.debt_due_date > endDate) return false;
    return true;
  });
  const filteredSuppliers = supplierDebts.filter(s => {
    if (startDate && s.debt_due_date && s.debt_due_date < startDate) return false;
    if (endDate && s.debt_due_date && s.debt_due_date > endDate) return false;
    return true;
  });

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

        <KpiCards loading={loading} totalRevenue={totalRevenue} totalCogs={totalCogs} totalExpense={totalExpense} grossProfit={grossProfit} netProfit={netProfit} profitMargin={profitMargin} inventoryValue={inventoryValue} currency={currency} clientDebts={clientDebts} supplierDebts={supplierDebts} transactions={transactions} />
        <ChartsPanel loading={loading} chartData={chartData} expCatData={expCatData} totalExpense={totalExpense} currency={currency} />
        <PaymentDebts hidePaymentMethods={true} transactions={transactions} paymentMethodFilter={paymentMethodFilter} setPaymentMethodFilter={setPaymentMethodFilter} debtsLoading={debtsLoading} clientDebts={filteredClients} supplierDebts={filteredSuppliers} currency={currency} />

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
