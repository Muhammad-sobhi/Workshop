'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';

export default function ProductionOrderForm({ showCreate, setShowCreate, products, warehouses, clients, currency, fetchAll, setConfirmDialog }) {
  const [form, setForm] = useState({
    client_id: '', warehouse_id: '', notes: '',
    total_price: '', deposit_paid: '',
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [selectedProductForPopup, setSelectedProductForPopup] = useState(null);
  const [popupProductQty, setPopupProductQty] = useState('');

  useEffect(() => {
    if (showCreate) {
      setForm({ client_id: '', warehouse_id: '', notes: '', total_price: '', deposit_paid: '' });
      setSelectedProducts([]);
      setMsg('');
    }
  }, [showCreate]);

  const recalculateTotal = (rows) => {
    let computedTotal = 0;
    rows.forEach(row => {
      const prod = products.find(p => p.id === parseInt(row.product_id));
      const qty = parseFloat(row.quantity) || 0;
      if (prod) {
        computedTotal += (parseFloat(prod.sale_price) || 0) * qty;
      }
    });
    setForm(f => ({ ...f, total_price: computedTotal > 0 ? computedTotal.toFixed(2) : '' }));
  };

  const handleProductButtonClick = (prod) => {
    setSelectedProductForPopup(prod);
    const existing = selectedProducts.find(p => p.product_id === prod.id.toString());
    setPopupProductQty(existing ? existing.quantity : '');
    setShowProductPopup(true);
  };

  const handleConfirmProductPopup = (e) => {
    e.preventDefault();
    if (!selectedProductForPopup) return;
    const qtyNum = parseFloat(popupProductQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setConfirmDialog({ type: 'alert', message: 'يرجى إدخال كمية صحيحة' });
      return;
    }

    const existingIndex = selectedProducts.findIndex(p => p.product_id === selectedProductForPopup.id.toString());
    let updated = [...selectedProducts];
    if (existingIndex > -1) {
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: popupProductQty
      };
    } else {
      updated.push({
        product_id: selectedProductForPopup.id.toString(),
        quantity: popupProductQty
      });
    }

    setSelectedProducts(updated);
    recalculateTotal(updated);
    setShowProductPopup(false);
    setSelectedProductForPopup(null);
  };

  const handleRemoveProduct = (index) => {
    const updated = selectedProducts.filter((_, idx) => idx !== index);
    setSelectedProducts(updated);
    recalculateTotal(updated);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (selectedProducts.length === 0) {
      setMsg('يرجى اختيار منتج واحد على الأقل بالضغط عليه وتحديد الكمية');
      return;
    }
    setSaving(true); setMsg('');
    try {
      await apiClient.post('/operations', {
        ...form,
        client_id: form.client_id || null,
        warehouse_id: form.warehouse_id || null,
        total_price: form.total_price ? parseFloat(form.total_price) : null,
        deposit_paid: form.deposit_paid ? parseFloat(form.deposit_paid) : null,
        products: selectedProducts.map(r => ({ product_id: parseInt(r.product_id), quantity: parseFloat(r.quantity) })),
      });
      setMsg('تم إنشاء أمر الإنتاج بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false); setMsg('');
        setForm({ client_id: '', warehouse_id: '', notes: '', total_price: '', deposit_paid: '' });
        setSelectedProducts([]);
      }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally { setSaving(false); }
  };

  if (!showCreate) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">إصدار أمر إنتاج جديد</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">العميل</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl" style={{ background: '#231B3D', border: '1px solid #3D3554' }}>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:bg-white/5" style={{ borderColor: form.client_id === '' ? '#ECC796' : '#3D3554', background: form.client_id === '' ? 'rgba(236,199,150,0.15)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="client"
                    value=""
                    checked={form.client_id === ''}
                    onChange={() => setForm({ ...form, client_id: '' })}
                    className="accent-[#ECC796] shrink-0"
                  />
                  <span className="text-xs font-semibold text-white truncate">بدون عميل (طلب داخلي)</span>
                </label>
                {clients.map(c => {
                  const isSelected = form.client_id === c.id.toString();
                  return (
                    <label key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:bg-white/5" style={{ borderColor: isSelected ? '#ECC796' : '#3D3554', background: isSelected ? 'rgba(236,199,150,0.15)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="client"
                        value={c.id}
                        checked={isSelected}
                        onChange={() => setForm({ ...form, client_id: c.id.toString() })}
                        className="accent-[#ECC796] shrink-0"
                      />
                      <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 border-t pt-3" style={{ borderColor: '#3D3554' }}>
              <label className="block text-xs font-semibold text-white">المنتجات المتاحة للتصنيع (اضغط للإضافة):</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1.5">
                {products.map((p) => {
                  const isAdded = selectedProducts.some(row => row.product_id === p.id.toString());
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductButtonClick(p)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center hover:scale-[1.02] hover:bg-white/5 active:scale-95 text-xs font-semibold"
                      style={{
                        borderColor: isAdded ? '#10B981' : '#3D3554',
                        background: isAdded ? 'rgba(16,185,129,0.08)' : '#231B3D'
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2F264C]/50 flex items-center justify-center shrink-0">
                        {p.image_path ? (
                          <img
                            src={`${getApiBaseUrl()}${p.image_path}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <span className="text-[11px] text-white line-clamp-1 w-full">{p.name}</span>
                      <span className="text-[9px] text-gray-400 truncate w-full">{currency} {p.sale_price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: '#3D3554' }}>
                <h3 className="text-xs font-semibold text-white">المنتجات المحددة لخط الإنتاج ({selectedProducts.length}):</h3>
                <div className="overflow-x-auto rounded-xl border max-h-36 overflow-y-auto" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
                        <th className="p-2 text-gray-400">المنتج</th>
                        <th className="p-2 text-gray-400">الكمية</th>
                        <th className="p-2 text-gray-400">سعر البيع المقترح</th>
                        <th className="p-2 text-gray-400">الإجمالي</th>
                        <th className="p-2 text-center text-gray-400">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map((row, idx) => {
                        const prodObj = products.find(p => p.id.toString() === row.product_id);
                        const unitPrice = parseFloat(prodObj?.sale_price || '0');
                        const qty = parseFloat(row.quantity) || 0;
                        const totalVal = unitPrice * qty;
                        return (
                          <tr key={idx} className="border-b" style={{ borderColor: '#3D3554' }}>
                            <td className="p-2 text-white font-medium">{prodObj?.name || '—'}</td>
                            <td className="p-2 text-white">{row.quantity} {prodObj?.unit}</td>
                            <td className="p-2 text-white">{currency} {unitPrice.toFixed(2)}</td>
                            <td className="p-2 text-[#ECC796] font-bold">{currency} {totalVal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleProductButtonClick(prodObj)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-[#3D3554]"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(idx)}
                                  className="p-1 rounded text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>مستودع صرف المواد</label>
              <select value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}>
                <option value="">اختر المستودع...</option>
                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>إجمالي سعر الطلب ({currency})</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.total_price} onChange={e => setForm({ ...form, total_price: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>العربون / دفعة أولى ({currency})</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.deposit_paid} onChange={e => setForm({ ...form, deposit_paid: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
            </div>

            {msg && <p className={`text-xs text-center py-2 rounded-xl ${msg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                {saving ? 'جاري الحفظ...' : 'حفظ كأمر معلق'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>

      {showProductPopup && selectedProductForPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl animate-in fade-in" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#3D3554' }}>
              <h3 className="text-sm font-bold text-white">إدخال الكمية المطلوبة: {selectedProductForPopup.name}</h3>
              <button type="button" onClick={() => { setShowProductPopup(false); setSelectedProductForPopup(null); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#A49EC0' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmProductPopup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-300 font-medium">الكمية المطلوبة ({selectedProductForPopup.unit}) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={popupProductQty}
                  onChange={e => setPopupProductQty(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none font-semibold text-white"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                  placeholder="أدخل الكمية..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                  تأكيد الإضافة
                </button>
                <button type="button" onClick={() => { setShowProductPopup(false); setSelectedProductForPopup(null); }} className="flex-1 py-2 rounded-xl text-xs font-bold border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
