'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, X, ArrowLeftRight } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { formatDate } from '@/lib/utils';

const MOVEMENT_TYPES = [
  { value: 'Initial_Balance', label: 'رصيد أول المدة' },
  { value: 'Stock_Adjustment', label: 'تسوية مخزنية' },
  { value: 'Damaged', label: 'إتلاف / تالف' },
  { value: 'Supplier_Return', label: 'مرتجع للمورد' },
  { value: 'Transfer', label: 'تحويل بين مستودعين' },
];

const INCOMING = ['Initial_Balance', 'Purchase_Receipt', 'Transfer_In'];

export default function MovementsPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [form, setForm] = useState({
    warehouse_id: '',
    item_id: '',
    item_type: 'material',
    movement_type: 'Initial_Balance',
    quantity: '',
    unit_cost: '',
    notes: '',
    reference_number: '',
    target_warehouse_id: '',
  });

  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 6 is Sat
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1); // Monday of this week
    const startOfWeek = new Date(now.setDate(diffToMon));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday of this week

    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0],
    };
  };

  const defaultWeek = getWeekRange();
  const [startDate, setStartDate] = useState(defaultWeek.start);
  const [endDate, setEndDate] = useState(defaultWeek.end);

  const [products, setProducts] = useState([]);

  const fetchAll = (p = 1, sDate = startDate, eDate = endDate) => {
    setLoading(true);
    let url = `/inventory/movements?page=${p}&per_page=20`;
    if (sDate) url += `&start_date=${sDate}`;
    if (eDate) url += `&end_date=${eDate}`;

    Promise.all([
      apiClient.get(url),
      apiClient.get('/inventory/materials?per_page=200'),
      apiClient.get('/inventory/products?per_page=200'),
      apiClient.get('/warehouses?per_page=200'),
    ]).then(([mvRes, matRes, prodRes, whRes]) => {
      const d = mvRes.data;
      setMovements(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setMaterials(matRes.data?.data ?? matRes.data ?? []);
      setProducts(prodRes.data?.data ?? prodRes.data ?? []);
      setWarehouses(whRes.data?.data ?? whRes.data ?? []);
    }).finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p, startDate, endDate);
  };

  const handleDateFilter = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    setPage(1);
    fetchAll(1, newStart, newEnd);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        warehouse_id: parseInt(form.warehouse_id),
        quantity: parseFloat(form.quantity),
        unit_cost: parseFloat(form.unit_cost),
      };
      if (form.target_warehouse_id) payload.target_warehouse_id = parseInt(form.target_warehouse_id);
      
      await apiClient.post('/inventory/movements', payload);
      setMsg('تم تسجيل الحركة بنجاح');
      fetchAll(page, startDate, endDate);
      setTimeout(() => { setShowForm(false); setMsg(''); }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const mvTypeColor = (type) => {
    if (INCOMING.includes(type)) return { color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">حركات المخزون</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>سجل كامل لجميع حركات المخزون</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 border text-xs" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <span style={{ color: '#A49EC0' }}>من:</span>
              <input type="date" value={startDate} onChange={(e) => handleDateFilter(e.target.value, endDate)} className="bg-transparent text-white outline-none text-xs" />
              <span style={{ color: '#A49EC0' }}>إلى:</span>
              <input type="date" value={endDate} onChange={(e) => handleDateFilter(startDate, e.target.value)} className="bg-transparent text-white outline-none text-xs" />
              {(startDate || endDate) && (
                <button onClick={() => { const w = getWeekRange(); handleDateFilter(w.start, w.end); }} className="text-[10px] text-[#ECC796] hover:underline mr-1">هذا الأسبوع</button>
              )}
            </div>
            <button
              onClick={() => { setShowForm(true); setMsg(''); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4 h-4" />
              حركة جديدة
            </button>
          </div>
        </div>

        {/* Movements Container */}
        <div>
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد حركات مسجلة</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                        {['التاريخ', 'المستودع', 'المادة / المنتج', 'النوع', 'الكمية', 'التكلفة'].map(h => (
                          <th key={h} className="text-right px-4 py-4 text-xs font-semibold uppercase" style={{ color: '#A49EC0' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map(mv => {
                        const { color, bg } = mvTypeColor(mv.movement_type);
                        return (
                          <tr key={mv.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: '#3D3554' }}>
                            <td className="px-4 py-3 text-white">{formatDate(mv.movement_date)}</td>
                            <td className="px-4 py-3" style={{ color: '#D4CEEB' }}>{mv.warehouse_name}</td>
                            <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate">{mv.item_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: bg, color }}>
                                {mv.movement_type_text}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold" style={{ color: INCOMING.includes(mv.movement_type) ? '#10B981' : '#EF4444' }}>
                              {INCOMING.includes(mv.movement_type) ? '+' : '-'}{mv.quantity.toLocaleString('ar-SA')}
                            </td>
                            <td className="px-4 py-3" style={{ color: '#ECC796' }}>
                              EGP {mv.total_cost.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Responsive Cards */}
              <div className="block md:hidden space-y-3">
                {movements.map(mv => {
                  const { color, bg } = mvTypeColor(mv.movement_type);
                  const isIncoming = INCOMING.includes(mv.movement_type);
                  return (
                    <div key={`mob-mv-${mv.id}`} className="rounded-2xl border p-4 space-y-2 font-semibold" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: bg, color }}>
                          {mv.movement_type_text}
                        </span>
                        <span className="text-xs" style={{ color: '#A49EC0' }}>{formatDate(mv.movement_date)}</span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white">{mv.item_name}</h4>
                        <p className="text-xs text-[#D4CEEB] mt-0.5">المستودع: {mv.warehouse_name}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#3D3554]/50">
                        <span className="text-xs font-bold" style={{ color: '#ECC796' }}>
                          التكلفة: EGP {mv.total_cost.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="font-bold text-sm" style={{ color: isIncoming ? '#10B981' : '#EF4444' }}>
                          الكمية: {isIncoming ? '+' : '-'}{mv.quantity.toLocaleString('ar-SA')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />

        {/* Add Movement Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">تسجيل حركة مخزون</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Movement Type */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>نوع الحركة <span style={{ color: '#ECC796' }}>*</span></label>
                  <select name="movement_type" value={form.movement_type} onChange={handleChange} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                    {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المستودع <span style={{ color: '#ECC796' }}>*</span></label>
                  <select
                    name="warehouse_id"
                    value={form.warehouse_id}
                    onChange={(e) => {
                      const selectedWhId = e.target.value;
                      const selectedWh = warehouses.find(w => w.id == selectedWhId);
                      let autoType = form.item_type;
                      if (selectedWh) {
                        if (selectedWh.code === 'WH-FIN' || selectedWh.code === 'WSH-P' || selectedWh.name.includes('منتج')) {
                          autoType = 'product';
                        } else if (selectedWh.name.includes('خام')) {
                          autoType = 'material';
                        }
                      }
                      setForm({ ...form, warehouse_id: selectedWhId, item_type: autoType, item_id: '' });
                    }}
                    required
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  >
                    <option value="">اختر المستودع...</option>
                    {warehouses.map((wh) => <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>)}
                  </select>
                </div>

                {/* Target Warehouse (Transfer only) */}
                {form.movement_type === 'Transfer' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المستودع المستهدف <span style={{ color: '#ECC796' }}>*</span></label>
                    <select name="target_warehouse_id" value={form.target_warehouse_id} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                      <option value="">اختر المستودع المستهدف...</option>
                      {warehouses.filter((wh) => wh.id != parseInt(form.warehouse_id)).map((wh) => <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>)}
                    </select>
                  </div>
                )}

                {/* Item Type Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>نوع الصنف المخزني <span style={{ color: '#ECC796' }}>*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, item_type: 'material', item_id: '' })}
                      className="py-2 rounded-xl text-xs font-bold transition-all border"
                      style={form.item_type === 'material'
                        ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', borderColor: '#ECC796', color: '#201A30' }
                        : { background: '#231B3D', borderColor: '#3D3554', color: '#A49EC0' }
                      }
                    >
                      📦 مادة خام
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, item_type: 'product', item_id: '' })}
                      className="py-2 rounded-xl text-xs font-bold transition-all border"
                      style={form.item_type === 'product'
                        ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', borderColor: '#ECC796', color: '#201A30' }
                        : { background: '#231B3D', borderColor: '#3D3554', color: '#A49EC0' }
                      }
                    >
                      🛋️ منتج جاهز
                    </button>
                  </div>
                </div>

                {/* Dynamic Item Select */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>
                    {form.item_type === 'product' ? 'المنتج الجاهز' : 'المادة الخام'} <span style={{ color: '#ECC796' }}>*</span>
                  </label>
                  <select name="item_id" value={form.item_id} onChange={handleChange} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                    <option value="">{form.item_type === 'product' ? 'اختر المنتج...' : 'اختر المادة...'}</option>
                    {form.item_type === 'product'
                      ? products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit || 'وحدة'})</option>)
                      : materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit || 'وحدة'})</option>)
                    }
                  </select>
                </div>

                {/* Quantity & Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>الكمية <span style={{ color: '#ECC796' }}>*</span></label>
                    <input type="number" name="quantity" value={form.quantity} onChange={handleChange} required min="0.01" step="0.01" className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>تكلفة الوحدة <span style={{ color: '#ECC796' }}>*</span></label>
                    <input type="number" name="unit_cost" value={form.unit_cost} onChange={handleChange} required min="0" step="0.01" className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                  </div>
                </div>

                {/* Reference & Notes */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>الرقم المرجعي</label>
                  <input type="text" name="reference_number" value={form.reference_number} onChange={handleChange} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
                </div>

                {msg && (
                  <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
                )}

                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                    {saving ? 'جاري الحفظ...' : 'تسجيل الحركة'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
