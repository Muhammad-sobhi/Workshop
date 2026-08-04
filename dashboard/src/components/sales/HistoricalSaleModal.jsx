import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { X, Plus, Trash2, Calendar, DollarSign, Smartphone, Building2, Landmark, History } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function HistoricalSaleModal({ show, onClose, products, clients, currency, onSuccess }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const [form, setForm] = useState({
    client_id: '',
    revenue_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: '',
  });

  const [items, setItems] = useState([
    { product_id: '', quantity: '', sale_price: '' }
  ]);

  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setForm({
        client_id: '',
        revenue_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        notes: '',
      });
      setItems([{ product_id: '', quantity: '', sale_price: '' }]);
      setMsg('');
    }
  }, [show]);

  if (!show) return null;

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'product_id') {
      const prod = products.find(p => p.id.toString() === value.toString());
      if (prod) {
        updated[index].sale_price = prod.sale_price ? prod.sale_price.toString() : '';
      }
    }
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { product_id: '', quantity: '', sale_price: '' }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.sale_price) || 0;
      return sum + (q * p);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0 && parseFloat(i.sale_price) >= 0);
    if (validItems.length === 0) {
      setMsg('يرجى اختيار منتج واحد على الأقل وتحديد الكمية والسعر الصحيح');
      return;
    }

    setSaving(true);
    setMsg('');

    try {
      const payload = {
        client_id: form.client_id || null,
        revenue_date: form.revenue_date,
        payment_method: form.payment_method,
        notes: form.notes,
        items: validItems.map(i => ({
          product_id: parseInt(i.product_id),
          quantity: parseFloat(i.quantity),
          sale_price: parseFloat(i.sale_price),
        })),
      };

      const res = await apiClient.post('/sales/historical', payload);
      setMsg(res.data?.message || 'تم تسجيل المبيعات السابقة بنجاح');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message || 'حدث خطأ أثناء حفظ المبيعات السابقة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-2xl border p-5 max-h-[92vh] overflow-y-auto shadow-2xl transition-all"
        style={{
          background: isLight ? '#FFFFFF' : '#2F264C',
          borderColor: isLight ? '#EBF0FF' : '#3D3554'
        }}
      >
        <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
              <History className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                تسجيل مبيعات سابقة / رصيد إفتتاحي
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
                إدخال المبيعات والإيرادات التي تمت قبل تشغيل هذا النظام لحساب المالية بدقة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: isLight ? '#1E293B' : '#D1D5DB' }}>
                تاريخ البيع السابق *
              </label>
              <input
                type="date"
                required
                value={form.revenue_date}
                onChange={e => setForm({ ...form, revenue_date: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-xs border outline-none font-medium"
                style={{
                  background: isLight ? '#F5F7FF' : '#231B3D',
                  borderColor: isLight ? '#EBF0FF' : '#3D3554',
                  color: isLight ? '#1E293B' : '#FFFFFF'
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: isLight ? '#1E293B' : '#D1D5DB' }}>
                العميل (اختياري)
              </label>
              <select
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-xs border outline-none font-medium"
                style={{
                  background: isLight ? '#F5F7FF' : '#231B3D',
                  borderColor: isLight ? '#EBF0FF' : '#3D3554',
                  color: isLight ? '#1E293B' : '#FFFFFF'
                }}
              >
                <option value="">عميل غير محدد / عام</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic items selection */}
          <div className="space-y-2 border-t pt-3" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                المنتجات المباعة سابقاً:
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-[11px] font-bold flex items-center gap-1 hover:underline"
                style={{ color: isLight ? '#4338CA' : '#ECC796' }}
              >
                <Plus className="w-3.5 h-3.5" /> إضافة صنف آخر
              </button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto p-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border"
                  style={{
                    background: isLight ? '#F8FAFF' : '#231B3D',
                    borderColor: isLight ? '#EBF0FF' : '#3D3554'
                  }}
                >
                  <div className="col-span-5 sm:col-span-5">
                    <label className="block text-[10px] mb-0.5" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>المنتج</label>
                    <select
                      value={item.product_id}
                      onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs border outline-none font-semibold"
                      style={{
                        background: isLight ? '#FFFFFF' : '#2F264C',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    >
                      <option value="">اختر المنتج...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <label className="block text-[10px] mb-0.5" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الكمية</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="مثلاً 2000"
                      value={item.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs border outline-none font-bold"
                      style={{
                        background: isLight ? '#FFFFFF' : '#2F264C',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <label className="block text-[10px] mb-0.5" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>سعر البيع ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.sale_price}
                      onChange={e => handleItemChange(idx, 'sale_price', e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs border outline-none font-bold"
                      style={{
                        background: isLight ? '#FFFFFF' : '#2F264C',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pt-3 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total calculation indicator */}
            <div
              className="p-3 rounded-xl flex items-center justify-between text-xs font-bold border"
              style={{
                background: isLight ? '#EFF2FE' : 'rgba(236,199,150,0.1)',
                borderColor: isLight ? '#EBF0FF' : '#3D3554',
                color: isLight ? '#4338CA' : '#ECC796'
              }}
            >
              <span>إجمالي قيمة المبيعات السابقة:</span>
              <span className="text-sm font-mono font-black">
                {currency} {calculateTotal().toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: isLight ? '#1E293B' : '#D1D5DB' }}>
              ملاحظات / بيان الإيراد السابق
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="مثلاً: مبيعات سابقة لعدد 2000 كرسي عروسة عادي قبل تفعيل هذا النظام..."
              className="w-full rounded-xl px-3 py-2 text-xs border outline-none resize-none font-medium"
              style={{
                background: isLight ? '#F5F7FF' : '#231B3D',
                borderColor: isLight ? '#EBF0FF' : '#3D3554',
                color: isLight ? '#1E293B' : '#FFFFFF'
              }}
            />
          </div>

          {msg && (
            <p className={`text-xs text-center py-2 rounded-xl font-bold ${msg.includes('نجاح') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {msg}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs transition-all hover:opacity-90 shadow-md text-white"
              style={{
                background: isLight ? '#4F46E5' : 'linear-gradient(135deg, #ECC796, #D4A660)',
                color: isLight ? '#FFFFFF' : '#201A30'
              }}
            >
              {saving ? 'جاري التسجيل...' : 'تأكيد وحفظ المبيعات السابقة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs border"
              style={{
                borderColor: isLight ? '#EBF0FF' : '#3D3554',
                background: isLight ? '#F5F7FF' : 'transparent',
                color: isLight ? '#1E293B' : '#A49EC0'
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
