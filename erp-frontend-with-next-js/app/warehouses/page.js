'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, Warehouse, MapPin, Hash, Pencil, Trash2, X, Eye } from 'lucide-react';
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
  const [form, setForm] = useState({ name: '', code: '', description: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [alertDialog, setAlertDialog] = useState(null);

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
    apiClient.get(`/warehouses/${wh.id}`).then(res => setViewItem(res.data));
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
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'لا يمكن حذف المستودع' });
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
                    المخزون الحالي — {viewItem.stocks.length} صنف
                  </p>
                </div>
                <button onClick={() => setViewItem(null)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-6">
                {viewItem.stocks.length === 0 ? (
                  <p className="text-center py-8" style={{ color: '#A49EC0' }}>لا يوجد مخزون في هذا المستودع</p>
                ) : (
                  <div className="space-y-2">
                    {viewItem.stocks.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 rounded-xl"
                        style={{ background: '#231B3D' }}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#A49EC0' }}>
                            {item.category} • {item.type === 'material' ? 'مادة خام' : 'منتج جاهز'}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold" style={{ color: '#ECC796' }}>
                            {item.quantity.toLocaleString('ar-SA')} {item.unit}
                          </p>
                          <p className="text-xs" style={{ color: '#A49EC0' }}>
                            EGP {item.total_cost.toLocaleString('ar-SA')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}
