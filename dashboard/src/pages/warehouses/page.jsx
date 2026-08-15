'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, Warehouse, MapPin, Hash, Pencil, Trash2, X, Eye, ArrowLeftRight } from 'lucide-react';
import AlertDialog from '@/components/AlertDialog';

const InputField = ({ label, name, value, onChange, required = false, textarea = false }) => (
  <div>
    <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>
      {label} {required && <span style={{ color: '#ECC796' }}>*</span>}
    </label>
    {textarea ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors resize-none"
        style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
      />
    ) : (
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
        style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
      />
    )}
  </div>
);

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [transferTargetItem, setTransferTargetItem] = useState(null);
  const [transferQty, setTransferQty] = useState('');
  const [targetWhId, setTargetWhId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [alertDialog, setAlertDialog] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedBatches, setExpandedBatches] = useState({});

  const fetchWarehouses = () => {
    setLoading(true);
    apiClient.get('/warehouses')
      .then(res => setWarehouses(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWarehouses(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', code: '', description: '', address: '', notes: '' });
    setShowForm(true);
    setMsg('');
  };

  const openEdit = (wh) => {
    setEditItem(wh);
    setForm({ name: wh.name, code: wh.code, description: wh.description ?? '', address: wh.address ?? '', notes: wh.notes ?? '' });
    setShowForm(true);
    setMsg('');
  };

  const openView = (wh) => {
    setSelectedCategory('ALL');
    setExpandedBatches({});
    apiClient.get(`/warehouses/${wh.id}`).then(res => setViewItem(res.data));
  };

  const openQuickTransfer = (item) => {
    const isMaterial = item.type !== 'product';
    let defaultTarget = null;

    if (isMaterial) {
      // If it's a raw material, default target is WSH-M (المواد الخام)
      defaultTarget = warehouses.find(w => (w.code === 'WSH-M' || w.name.includes('خام') || w.name.includes('مواد')) && w.id !== viewItem?.warehouse?.id);
    } else {
      // If it's a product
      if (viewItem?.warehouse?.code === 'WH-FIN') {
        defaultTarget = warehouses.find(w => (w.code === 'WSH-P' || w.name.includes('منتج')) && w.id !== viewItem?.warehouse?.id);
      } else {
        defaultTarget = warehouses.find(w => (w.code === 'WH-FIN' || w.name.includes('طلبيات')) && w.id !== viewItem?.warehouse?.id);
      }
    }

    if (!defaultTarget) {
      defaultTarget = warehouses.find(w => w.id !== viewItem?.warehouse?.id);
    }

    setTransferTargetItem(item);
    setTransferQty(item.quantity.toString());
    setTargetWhId(defaultTarget ? defaultTarget.id.toString() : '');
  };

  const handleQuickTransfer = async (e) => {
    e.preventDefault();
    if (!transferTargetItem || !viewItem || !targetWhId || !transferQty) return;

    setTransferring(true);
    try {
      const isProduct = transferTargetItem.type === 'product';
      const payload = {
        movement_type: 'Transfer',
        warehouse_id: viewItem.warehouse.id,
        target_warehouse_id: parseInt(targetWhId),
        item_type: isProduct ? 'product' : 'material',
        item_id: transferTargetItem.id,
        quantity: parseFloat(transferQty),
        unit_cost: parseFloat(transferTargetItem.unit_cost || 0),
        notes: `تحويل مباشر بين المستودعات بطلب المستخدم للصنف ${transferTargetItem.name}`,
      };

      await apiClient.post('/inventory/movements', payload);
      setTransferTargetItem(null);
      setAlertDialog({ type: 'alert', message: 'تم التحويل بين المستودعين بنجاح!' });
      openView(viewItem.warehouse);
      fetchWarehouses();
    } catch (err) {
      setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في عملية التحويل' });
    } finally {
      setTransferring(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editItem) {
        await apiClient.put(`/warehouses/${editItem.id}`, form);
        setMsg('تم تحديث المستودع بنجاح');
      } else {
        await apiClient.post('/warehouses', form);
        setMsg('تم إنشاء المستودع بنجاح');
      }
      fetchWarehouses();
      setTimeout(() => { setShowForm(false); setMsg(''); }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من حذف هذا المستودع؟',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/warehouses/${id}`);
          fetchWarehouses();
        } catch (err) {
          if (err?.response?.status === 409 && err?.response?.data?.has_movements) {
            // Warehouse has movements — ask for force delete
            setAlertDialog({
              type: 'confirm',
              message: err.response.data.message,
              onConfirm: async () => {
                try {
                  await apiClient.delete(`/warehouses/${id}?force=true`);
                  fetchWarehouses();
                } catch (err2) {
                  setAlertDialog({ type: 'alert', message: err2?.response?.data?.message ?? 'لا يمكن حذف المستودع' });
                }
              }
            });
          } else {
            setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'لا يمكن حذف المستودع' });
          }
        }
      }
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المستودعات</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              {warehouses.length} مستودع مسجل في النظام
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            مستودع جديد
          </button>
        </div>

        {/* Warehouse Cards */}
        {loading ? (
          <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {warehouses.map(wh => (
              <div
                key={wh.id}
                className="rounded-2xl border p-5 transition-all hover:scale-[1.01]"
                style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(35, 27, 61, 0.15)' }}
                    >
                      <Warehouse className="w-5 h-5" style={{ color: '#231B3D' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#231B3D]">{wh.name}</h3>
                      <span className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#4E4869' }}>
                        <Hash className="w-3 h-3" />
                        {wh.code}
                      </span>
                    </div>
                  </div>
                </div>

                {wh.address && (
                  <p className="flex items-start gap-1.5 text-sm mb-3" style={{ color: '#4E4869' }}>
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {wh.address}
                  </p>
                )}

                {wh.description && (
                  <p className="text-sm mb-4 leading-relaxed font-medium" style={{ color: '#3D3554' }}>{wh.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-3 text-center" style={{ background: '#3D3554', color: '#ffffff' }}>
                    <p className="text-xl font-bold text-white">{wh.items_in_stock}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#D4CEEB' }}>أصناف بالمخزون</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#3D3554', color: '#ffffff' }}>
                    <p className="text-xl font-bold text-white">{wh.movements_count}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#D4CEEB' }}>حركة مسجلة</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openView(wh)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all text-white"
                    style={{ background: '#3D3554', color: '#ECC796' }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    عرض المخزون
                  </button>
                  <button
                    onClick={() => openEdit(wh)}
                    className="p-2 rounded-xl transition-all"
                    style={{ background: '#3D3554', color: '#ECC796' }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="p-2 rounded-xl transition-all hover:opacity-80"
                    style={{ background: '#7f1d1d', color: '#fca5a5' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editItem ? 'تعديل المستودع' : 'إنشاء مستودع جديد'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField label="اسم المستودع" name="name" value={form.name} onChange={handleChange} required />
                <InputField label="كود المستودع" name="code" value={form.code} onChange={handleChange} required />
                <InputField label="العنوان" name="address" value={form.address} onChange={handleChange} />
                <InputField label="الوصف" name="description" value={form.description} onChange={handleChange} textarea />
                <InputField label="ملاحظات" name="notes" value={form.notes} onChange={handleChange} textarea />

                {msg && (
                  <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                    {msg}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                  >
                    {saving ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/5"
                    style={{ borderColor: '#3D3554', color: '#A49EC0' }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Warehouse Stock Modal */}
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div className="flex items-center justify-between p-6 border-b shrink-0" style={{ borderColor: '#3D3554' }}>
                <div>
                  <h2 className="text-lg font-bold text-white">{viewItem.warehouse.name}</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#A49EC0' }}>
                    المخزون الحالي — {viewItem.stocks.length} صنف مسجل
                  </p>
                </div>
                <button onClick={() => setViewItem(null)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Classification / Category Filter Tabs */}
              {Array.isArray(viewItem.categories) && viewItem.categories.length > 0 && (
                <div className="px-6 pt-4 pb-2 border-b flex flex-wrap items-center gap-2 shrink-0" style={{ borderColor: '#3D3554', background: '#261F3D' }}>
                  <span className="text-xs font-semibold text-[#A49EC0]">التصنيف:</span>
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${selectedCategory === 'ALL' ? 'bg-[#ECC796] text-[#201A30] border-[#ECC796]' : 'text-[#D4CEEB] border-[#3D3554] hover:bg-white/5'}`}
                  >
                    الكل ({viewItem.stocks.length})
                  </button>
                  {viewItem.categories.map((cat, i) => {
                    const count = viewItem.stocks.filter(s => s.category === cat).length;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-[#ECC796] text-[#201A30] border-[#ECC796]' : 'text-[#D4CEEB] border-[#3D3554] hover:bg-white/5'}`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="overflow-y-auto p-6 space-y-3">
                {viewItem.stocks.length === 0 ? (
                  <p className="text-center py-8" style={{ color: '#A49EC0' }}>لا يوجد مخزون في هذا المستودع</p>
                ) : (
                  <div className="space-y-3">
                    {viewItem.stocks
                      .filter(item => selectedCategory === 'ALL' || item.category === selectedCategory)
                      .map((item, idx) => {
                        const isExpanded = !!expandedBatches[idx];
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border transition-all overflow-hidden"
                            style={{ background: '#231B3D', borderColor: '#3D3554' }}
                          >
                            <div className="flex items-center justify-between p-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-white">{item.name}</p>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#3D3554] text-[#ECC796]">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="text-xs mt-1" style={{ color: '#A49EC0' }}>
                                  كود: <span className="font-mono text-gray-300">{item.sku || item.code}</span> • {item.item_kind === 'product' ? 'منتج تام الصنع' : 'مادة خام'}
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-left">
                                  <p className="text-sm font-bold text-emerald-400">
                                    {item.quantity.toLocaleString('ar-SA')} {item.unit}
                                  </p>
                                  <p className="text-xs" style={{ color: '#A49EC0' }}>
                                    إجمالي التكلفة: EGP {item.total_cost.toLocaleString('ar-SA')}
                                  </p>
                                </div>

                                {Array.isArray(item.batches) && item.batches.length > 0 && (
                                  <button
                                    onClick={() => setExpandedBatches(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5"
                                    style={{ borderColor: isExpanded ? '#ECC796' : '#3D3554', color: isExpanded ? '#ECC796' : '#A49EC0' }}
                                    title="عرض تفاصيل طبقات وتواريخ الدفعات التكليفية FIFO"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{item.batches.length} دفعة FIFO</span>
                                  </button>
                                )}

                                {item.item_kind === 'product' ? (
                                  <button
                                    onClick={() => openQuickTransfer(item)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border hover:bg-white/10"
                                    style={{ borderColor: '#ECC796', color: '#ECC796' }}
                                    title="تحويل هذا المنتج الجاهز لمستودع آخر"
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5" /> تحويل
                                  </button>
                                ) : (
                                  <span className="text-[10px] px-2 py-1 rounded-lg border text-[#A49EC0] border-[#3D3554] bg-[#201A30]" title="المواد الخام مخصصة لمستودع الخامات">
                                    خامات مثبتة
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* FIFO Layers / Batches Sub-Table */}
                            {isExpanded && Array.isArray(item.batches) && item.batches.length > 0 && (
                              <div className="border-t p-3 space-y-2" style={{ borderColor: '#3D3554', background: '#1D172E' }}>
                                <p className="text-[11px] font-bold text-[#ECC796] flex items-center justify-between">
                                  <span>تفاصيل طبقات الدفعات المخزنية وتكلفتها (FIFO Inventory Layers):</span>
                                  <span className="text-gray-400 font-normal">الوارد أولاً يصرف أولاً</span>
                                </p>

                                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#3D3554' }}>
                                  <table className="w-full text-xs text-right">
                                    <thead>
                                      <tr className="border-b" style={{ borderColor: '#3D3554', background: '#271F3E', color: '#A49EC0' }}>
                                        <th className="p-2">نوع الدفعة</th>
                                        <th className="p-2">تاريخ التوريد</th>
                                        <th className="p-2">الرصيد المتبقي</th>
                                        <th className="p-2">تكلفة الوحدة (Cost)</th>
                                        {item.item_kind === 'product' && <th className="p-2">سعر البيع (Price)</th>}
                                        <th className="p-2">إجمالي قيمة الدفعة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.batches.map((b, bIdx) => (
                                        <tr key={bIdx} className="border-b last:border-0 border-[#3D3554]/50">
                                          <td className="p-2 font-semibold text-white">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                              {b.type_label || b.movement_type}
                                            </span>
                                          </td>
                                          <td className="p-2 text-gray-300 font-mono text-[11px]">{b.movement_date}</td>
                                          <td className="p-2 font-bold text-emerald-400">{b.remaining_quantity} {item.unit}</td>
                                          <td className="p-2 font-bold text-amber-300">EGP {Number(b.unit_cost).toFixed(2)}</td>
                                          {item.item_kind === 'product' && (
                                            <td className="p-2 font-bold text-blue-300">
                                              {b.sale_price ? `EGP ${Number(b.sale_price).toFixed(2)}` : '—'}
                                            </td>
                                          )}
                                          <td className="p-2 font-bold text-white">EGP {Number(b.total_cost).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Transfer Modal */}
        {transferTargetItem && viewItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" style={{ color: '#ECC796' }} />
                  تحويل صنف بين المستودعات
                </h2>
                <button onClick={() => setTransferTargetItem(null)} className="p-1 rounded-lg hover:bg-white/10" style={{ color: '#A49EC0' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl p-3 space-y-1" style={{ background: '#231B3D' }}>
                <p className="text-xs text-amber-300 font-bold">الصنف المراد تحويله: {transferTargetItem.name}</p>
                <p className="text-xs" style={{ color: '#A49EC0' }}>
                  من المستودع: <span className="text-white font-semibold">{viewItem.warehouse.name}</span> (المتفر حالياً: {transferTargetItem.quantity} {transferTargetItem.unit})
                </p>
              </div>

              <form onSubmit={handleQuickTransfer} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#D4CEEB' }}>إلى المستودع <span style={{ color: '#ECC796' }}>*</span></label>
                  <select
                    value={targetWhId}
                    onChange={(e) => setTargetWhId(e.target.value)}
                    required
                    className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  >
                    <option value="">اختر المستودع المستهدف...</option>
                    {warehouses.filter(w => w.id !== viewItem.warehouse.id).map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#D4CEEB' }}>الكمية المراد تحويلها <span style={{ color: '#ECC796' }}>*</span></label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    required
                    min="0.01"
                    max={transferTargetItem.quantity}
                    step="0.01"
                    className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={transferring}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                  >
                    {transferring ? 'جاري التحويل...' : 'إتمام التحويل الفوري'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferTargetItem(null)}
                    className="py-2.5 px-4 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/5"
                    style={{ borderColor: '#3D3554', color: '#A49EC0' }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}
