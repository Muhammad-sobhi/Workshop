'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, X, DollarSign, Calendar, Tag, Trash2, Search, TrendingDown } from 'lucide-react';
import Pagination from '@/components/Pagination';

const EXPENSE_CATEGORIES = [
  'شراء مواد خام',
  'صيانة آلات ومعدات',
  'أجور ورواتب العمال',
  'الرواتب والأجور',
  'كهرباء ومياه ومرافق',
  'المرافق الخدمية',
  'إيجار مستودع',
  'الإيجار والمقرات',
  'مصاريف تغليف وشحن',
  'أخرى',
];

const CARD = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [form, setForm] = useState({
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    reference_number: '',
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = (p = 1) => {
    setLoading(true);
    apiClient.get(`/expenses?page=${p}&per_page=20`).then(res => {
      const d = res.data;
      setExpenses(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
    }).finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await apiClient.post('/expenses', {
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        category: form.category,
        description: form.description || null,
        reference_number: form.reference_number || null,
      });
      setMsg('تم تسجيل المصروف بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false);
        setForm({ amount: '', expense_date: new Date().toISOString().split('T')[0], category: '', description: '', reference_number: '' });
        setMsg('');
      }, 1000);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const filtered = expenses.filter(e => {
    const matchSearch = e.category.includes(search) || e.description?.includes(search) || e.expense_number.includes(search);
    const matchCat = filterCat ? e.category === filterCat : true;
    return matchSearch && matchCat;
  });

  const totalAll = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalFiltered = filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Category totals for display
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0); });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">المصروفات</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>تسجيل ومتابعة جميع المصاريف والتكاليف التشغيلية</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setMsg(''); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            تسجيل مصروف جديد
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي المصروفات', value: `EGP ${totalAll.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, color: '#EF4444' },
            { label: 'عدد السجلات', value: expenses.length, color: '#8D7EC8' },
            { label: 'أعلى فئة مصروف', value: topCat?.[0] ?? '—', color: '#3D3554' },
            { label: 'هذا الشهر', value: `EGP ${expenses.filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth()).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, color: '#3D3554' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border p-4 text-center font-semibold" style={CARD}>
              <p className="text-xl font-bold truncate" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
              <p className="text-xs mt-1" style={{ color: '#4E4869' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالفئة أو الوصف أو الرقم..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: '#2F264C', borderColor: '#3D3554', color: filterCat ? '#FFFFFF' : '#A49EC0' }}
          >
            <option value="">جميع الفئات</option>
            {Object.keys(catTotals).sort().map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 sm:hidden">
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد مصروفات مطابقة</div>
          ) : filtered.map(exp => (
            <div key={exp.id} className="rounded-2xl border p-4" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-xs font-bold" style={{ color: '#3D3554' }}>{exp.expense_number}</span>
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: '#3D3554', color: '#ECC796' }}>
                  {exp.category}
                </span>
              </div>
              {exp.description && <p className="text-sm mb-2" style={{ color: '#4E4869' }}>{exp.description}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: '#4E4869' }}>{new Date(exp.expense_date).toLocaleDateString('ar-SA')}</span>
                <span className="font-bold text-base" style={{ color: '#EF4444' }}>
                  EGP {exp.amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
          {!loading && filtered.length > 0 && (
            <div className="flex justify-between items-center py-3 px-1">
              <span className="text-sm" style={{ color: '#A49EC0' }}>{filtered.length} سجل</span>
              <span className="text-base font-bold" style={{ color: '#EF4444' }}>
                الإجمالي: EGP {totalFiltered.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
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
                  <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                    {['رقم السند', 'الفئة', 'الوصف', 'المرجع', 'التاريخ', 'المبلغ'].map(h => (
                      <th key={h} className="text-right px-4 py-4 text-xs font-semibold uppercase" style={{ color: '#4E4869' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => (
                    <tr key={exp.id} className="border-b hover:bg-black/5 transition-colors" style={{ borderColor: '#D4A660' }}>
                      <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#231B3D' }}>{exp.expense_number}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: '#3D3554', color: '#ECC796' }}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: '#4E4869' }}>{exp.description ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#3D3554' }}>{exp.reference_number ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#4E4869' }}>{new Date(exp.expense_date).toLocaleDateString('ar-SA')}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: '#EF4444' }}>
                        EGP {exp.amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12" style={{ color: '#4E4869' }}>لا توجد مصروفات مطابقة</td></tr>
                  )}
                </tbody>
              </table>
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

      {/* Create Expense Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
              <h2 className="text-lg font-bold text-white">تسجيل مصروف جديد</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المبلغ (EGP) <span style={{ color: '#ECC796' }}>*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>التاريخ <span style={{ color: '#ECC796' }}>*</span></label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    required
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>الفئة <span style={{ color: '#ECC796' }}>*</span></label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                  style={{ background: '#231B3D', borderColor: '#3D3554', color: form.category ? '#FFFFFF' : '#A49EC0' }}
                >
                  <option value="">اختر الفئة...</option>
                  {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>الوصف</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none"
                  style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  placeholder="وصف المصروف..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>رقم المرجع (اختياري)</label>
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={e => setForm({ ...form, reference_number: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                  style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  placeholder="رقم فاتورة أو مستند مرجعي..."
                />
              </div>

              {msg && (
                <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') || msg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                >
                  {saving ? 'جاري الحفظ...' : 'تسجيل المصروف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: '#3D3554', color: '#A49EC0' }}
                >
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
