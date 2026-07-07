'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, X, DollarSign, Smartphone, Building2, TrendingUp, ShoppingBag, Search, User, Package } from 'lucide-react';
import Pagination from '@/components/Pagination';

const CARD = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [form, setForm] = useState({
    client_id: '', product_id: '', quantity: '', price: '',
    revenue_date: new Date().toISOString().split('T')[0], notes: '', payment_method: ''
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/sales?page=${p}&per_page=20`),
      apiClient.get('/clients?per_page=200'),
      apiClient.get('/inventory/products?per_page=200'),
    ]).then(([salesRes, clientsRes, prodRes]) => {
      const d = salesRes.data;
      setSales(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setClients(clientsRes.data?.data ?? clientsRes.data ?? []);
      setProducts(prodRes.data?.data ?? prodRes.data ?? []);
    }).finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    if (name === 'product_id') {
      const prod = products.find(p => p.id === parseInt(value));
      if (prod) updatedForm.price = prod.sale_price.toString();
    }
    setForm(updatedForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await apiClient.post('/sales', {
        ...form,
        client_id: parseInt(form.client_id),
        product_id: parseInt(form.product_id),
        quantity: parseFloat(form.quantity),
        price: parseFloat(form.price),
      });
      setMsg('تم تسجيل عملية المبيعات بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false);
        setForm({ client_id: '', product_id: '', quantity: '', price: '', revenue_date: new Date().toISOString().split('T')[0], notes: '', payment_method: '' });
        setMsg('');
      }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  const totalSales = sales.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const thisMonth = sales.filter(s => new Date(s.revenue_date).getMonth() === new Date().getMonth()).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const avgSale = sales.length > 0 ? totalSales / sales.length : 0;

  const filtered = sales.filter(s =>
    s.revenue_number.includes(search) || s.description?.includes(search) || s.category.includes(search)
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المبيعات</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إصدار فواتير بيع المنتجات وتحديث المخزون تلقائياً
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setMsg(''); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            فاتورة مبيعات جديدة
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي المبيعات', value: `EGP ${totalSales.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: '#231B3D', bg: 'rgba(35,27,61,0.15)' },
            { label: 'مبيعات هذا الشهر', value: `EGP ${thisMonth.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: '#231B3D', bg: 'rgba(35,27,61,0.15)' },
            { label: 'عدد الفواتير', value: sales.length, icon: ShoppingBag, color: '#231B3D', bg: 'rgba(35,27,61,0.15)' },
            { label: 'متوسط قيمة الفاتورة', value: `EGP ${avgSale.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: Package, color: '#231B3D', bg: 'rgba(35,27,61,0.15)' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border p-5 flex items-center gap-4 font-semibold" style={CARD}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold truncate" style={{ color: '#231B3D' }}>{loading ? '...' : stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#4E4869' }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الفواتير..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
          />
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 sm:hidden">
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد مبيعات مسجلة</div>
          ) : filtered.map(sale => (
            <div key={sale.id} className="rounded-2xl border p-4" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-xs font-bold" style={{ color: '#3D3554' }}>{sale.revenue_number}</span>
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#3D3554', color: '#ECC796' }}>
                  {sale.category}
                </span>
              </div>
              <p className="text-sm mb-2" style={{ color: '#4E4869' }}>{sale.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: '#4E4869' }}>{new Date(sale.revenue_date).toLocaleDateString('ar-SA')}</span>
                <span className="font-bold text-base text-green-700">
                  +EGP {sale.amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
          {!loading && filtered.length > 0 && (
            <div className="flex justify-between items-center py-3 px-1">
              <span className="text-sm" style={{ color: '#A49EC0' }}>{filtered.length} فاتورة</span>
              <span className="text-base font-bold text-green-400">
                +EGP {filtered.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block rounded-2xl border overflow-hidden" style={CARD}>
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#D4A660' }}>
                    {['رقم الفاتورة', 'التاريخ', 'البيان / العميل', 'الفئة', 'المبلغ الإجمالي'].map(h => (
                      <th key={h} className="text-right px-4 py-4 text-xs font-semibold uppercase" style={{ color: '#4E4869' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sale => (
                    <tr key={sale.id} className="border-b hover:bg-black/5 transition-colors" style={{ borderColor: '#D4A660' }}>
                      <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#231B3D' }}>{sale.revenue_number}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#4E4869' }}>{new Date(sale.revenue_date).toLocaleDateString('ar-SA')}</td>
                      <td className="px-4 py-3 text-xs max-w-[300px] truncate" style={{ color: '#3D3554' }}>{sale.description}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: '#3D3554', color: '#ECC796' }}>
                          {sale.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-700">
                        +EGP {sale.amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12" style={{ color: '#4E4869' }}>لا توجد مبيعات مسجلة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="flex justify-between items-center px-5 py-4 border-t" style={{ borderColor: '#D4A660' }}>
              <span className="text-sm" style={{ color: '#4E4869' }}>{filtered.length} فاتورة</span>
              <span className="text-base font-bold text-green-700">
                +EGP {filtered.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Create Sale Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
              <h2 className="text-lg font-bold text-white">إصدار فاتورة مبيعات</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>العميل <span style={{ color: '#ECC796' }}>*</span></label>
                <select name="client_id" value={form.client_id} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                  <option value="">اختر العميل...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المنتج المباع <span style={{ color: '#ECC796' }}>*</span></label>
                <select name="product_id" value={form.product_id} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                  <option value="">اختر المنتج الجاهز...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (المخزون: {p.stock ?? '?'} حبة)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>الكمية <span style={{ color: '#ECC796' }}>*</span></label>
                  <input type="number" name="quantity" min="1" value={form.quantity} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>سعر البيع/وحدة (EGP) <span style={{ color: '#ECC796' }}>*</span></label>
                  <input type="number" name="price" min="0.01" step="0.01" value={form.price} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                </div>
              </div>
              {form.quantity && form.price && (
                <div className="p-3 rounded-xl text-sm font-bold text-center" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                  إجمالي الفاتورة: EGP {(parseFloat(form.quantity) * parseFloat(form.price)).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>التاريخ <span style={{ color: '#ECC796' }}>*</span></label>
                <input type="date" name="revenue_date" value={form.revenue_date} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>طريقة الدفع <span style={{ color: '#ECC796' }}>*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'cash', label: 'كاش / نقدي', icon: DollarSign },
                    { key: 'instapay', label: 'انستاباي', icon: Smartphone },
                    { key: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone },
                    { key: 'bank_transfer', label: 'تحويل بنكي', icon: Building2 },
                  ].map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setForm({ ...form, payment_method: m.key })}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                      style={{
                        borderColor: form.payment_method === m.key ? '#ECC796' : '#3D3554',
                        background: form.payment_method === m.key ? 'rgba(236,199,150,0.15)' : '#231B3D',
                        color: form.payment_method === m.key ? '#ECC796' : '#A49EC0',
                      }}
                    >
                      <span><m.icon size={16} /></span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
              {msg && (
                <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') || msg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                  {saving ? 'جاري الحفظ...' : 'تسجيل البيع وإصدار الفاتورة'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
