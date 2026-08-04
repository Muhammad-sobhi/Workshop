'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, X, Trash2, Image as ImageIcon, Smartphone, DollarSign, Building2, Landmark, CheckSquare, Square } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';

export default function ProductionOrderForm({ showCreate, setShowCreate, products, warehouses, clients, currency, fetchAll, setConfirmDialog }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const [form, setForm] = useState({
    client_id: '', warehouse_id: '', notes: '',
    total_price: '', deposit_paid: '',
    use_stock: false,
    deposit_payment_method: 'cash',
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [selectedProductForPopup, setSelectedProductForPopup] = useState(null);
  const [popupProductQty, setPopupProductQty] = useState('');

  // Quick Client creation state
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');

  useEffect(() => {
    if (showCreate) {
      setForm({
        client_id: '', warehouse_id: '', notes: '',
        total_price: '', deposit_paid: '',
        use_stock: false,
        deposit_payment_method: 'cash',
      });
      setSelectedProducts([]);
      setMsg('');
      setShowQuickClient(false);
      setQuickClientName('');
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

  const handleQuickClientSubmit = async (e) => {
    e.preventDefault();
    if (!quickClientName.trim()) return;
    try {
      const res = await apiClient.post('/clients', { name: quickClientName });
      const newClient = res.data.client || res.data;
      setForm(f => ({ ...f, client_id: newClient.id.toString() }));
      setShowQuickClient(false);
      setQuickClientName('');
      if (fetchAll) fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message || 'فشل إضافة العميل');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (selectedProducts.length === 0) {
      setMsg('يرجى اختيار منتج واحد على الأقل بالضغط عليه وتحديد الكمية');
      return;
    }
    setSaving(true); setMsg('');
    try {
      const res = await apiClient.post('/operations', {
        ...form,
        client_id: form.client_id || null,
        warehouse_id: form.warehouse_id || null,
        total_price: form.total_price ? parseFloat(form.total_price) : null,
        deposit_paid: form.deposit_paid ? parseFloat(form.deposit_paid) : null,
        use_stock: form.use_stock,
        deposit_payment_method: form.deposit_paid ? form.deposit_payment_method : null,
        products: selectedProducts.map(r => ({ product_id: parseInt(r.product_id), quantity: parseFloat(r.quantity) })),
      });
      setMsg(res.data?.message || 'تم بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false); setMsg('');
        setForm({ client_id: '', warehouse_id: '', notes: '', total_price: '', deposit_paid: '', use_stock: false, deposit_payment_method: 'cash' });
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
        <div
          className="w-full max-w-2xl rounded-2xl border p-6 max-h-[92vh] overflow-y-auto shadow-2xl transition-all"
          style={{
            background: isLight ? '#FFFFFF' : '#2F264C',
            borderColor: isLight ? '#EBF0FF' : '#3D3554'
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>إصدار أمر إنتاج جديد</h2>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-black/5" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold" style={{ color: isLight ? '#1E293B' : '#D1D5DB' }}>العميل</label>
                {!showQuickClient ? (
                  <button
                    type="button"
                    onClick={() => setShowQuickClient(true)}
                    className="text-[10px] hover:underline flex items-center gap-1 font-bold"
                    style={{ color: isLight ? '#4338CA' : '#ECC796' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة عميل جديد
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="اسم العميل الجديد..."
                      value={quickClientName}
                      onChange={e => setQuickClientName(e.target.value)}
                      className="px-2 py-1 rounded text-xs outline-none border"
                      style={{
                        background: isLight ? '#F5F7FF' : '#231B3D',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleQuickClientSubmit}
                      className="px-2.5 py-1 bg-green-600 text-white rounded font-bold"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickClient(false)}
                      className="px-2.5 py-1 bg-red-600 text-white rounded font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>

              {/* Clients selection grid */}
              <div
                className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl"
                style={{
                  background: isLight ? '#F8FAFF' : '#231B3D',
                  border: isLight ? '1px solid #EBF0FF' : '1px solid #3D3554'
                }}
              >
                <label
                  className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:opacity-90"
                  style={{
                    borderColor: isLight ? (form.client_id === '' ? '#4F46E5' : '#EBF0FF') : (form.client_id === '' ? '#ECC796' : '#3D3554'),
                    background: isLight ? (form.client_id === '' ? '#EFF2FE' : '#FFFFFF') : (form.client_id === '' ? 'rgba(236,199,150,0.15)' : 'transparent')
                  }}
                >
                  <input
                    type="radio"
                    name="client"
                    value=""
                    checked={form.client_id === ''}
                    onChange={() => setForm({ ...form, client_id: '' })}
                    className="accent-[#4F46E5] shrink-0"
                  />
                  <span className="text-xs font-semibold truncate" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                    تخزين في المستودع كمخزون (طلب داخلي)
                  </span>
                </label>

                {clients.map(c => {
                  const isSelected = form.client_id === c.id.toString();
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:opacity-90"
                      style={{
                        borderColor: isLight ? (isSelected ? '#4F46E5' : '#EBF0FF') : (isSelected ? '#ECC796' : '#3D3554'),
                        background: isLight ? (isSelected ? '#EFF2FE' : '#FFFFFF') : (isSelected ? 'rgba(236,199,150,0.15)' : 'transparent')
                      }}
                    >
                      <input
                        type="radio"
                        name="client"
                        value={c.id}
                        checked={isSelected}
                        onChange={() => setForm({ ...form, client_id: c.id.toString() })}
                        className="accent-[#4F46E5] shrink-0"
                      />
                      <span className="text-xs font-semibold truncate" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checkbox to use finished product stock first */}
            {form.client_id !== '' && (
              <div
                className="p-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-all border"
                style={{
                  background: isLight ? '#F8FAFF' : 'rgba(236,199,150,0.05)',
                  borderColor: isLight ? '#EBF0FF' : '#3D3554'
                }}
                onClick={() => setForm({ ...form, use_stock: !form.use_stock })}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>استخدام المنتجات المخزنة مسبقاً</p>
                  <p className="text-[10px] mt-0.5" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>
                    في حال تفعيل هذا الخيار، سيتم سحب الكميات المطلوبة المتوفرة في المخازن أولاً وتصنيع المتبقي فقط لتوفير المواد الخام.
                  </p>
                </div>
                <button type="button" className="shrink-0" style={{ color: isLight ? '#4F46E5' : '#ECC796' }}>
                  {form.use_stock ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
              </div>
            )}

            {/* Products grid */}
            <div className="space-y-2 border-t pt-3" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
              <label className="block text-xs font-semibold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                المنتجات المتاحة للتصنيع (اضغط للإضافة):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1.5">
                {products.map((p) => {
                  const isAdded = selectedProducts.some(row => row.product_id === p.id.toString());
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductButtonClick(p)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center hover:scale-[1.02] active:scale-95 text-xs font-semibold"
                      style={{
                        borderColor: isLight ? (isAdded ? '#10B981' : '#EBF0FF') : (isAdded ? '#10B981' : '#3D3554'),
                        background: isLight ? (isAdded ? '#ECFDF5' : '#FFFFFF') : (isAdded ? 'rgba(16,185,129,0.08)' : '#231B3D')
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border"
                        style={{
                          background: isLight ? '#F5F7FF' : '#2F264C',
                          borderColor: isLight ? '#EBF0FF' : 'rgba(61,53,84,0.5)'
                        }}
                      >
                        {p.image_path ? (
                          <img
                            src={p.image_path.startsWith('http') ? p.image_path : `${getApiBaseUrl()}${p.image_path.startsWith('/') ? '' : '/'}${p.image_path}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5" style={{ color: isLight ? '#8288A4' : '#6B7280' }} />
                        )}
                      </div>
                      <span className="text-[11px] font-bold line-clamp-1 w-full" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{p.name}</span>
                      <span className="text-[9px] font-semibold truncate w-full" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>{currency} {p.sale_price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
                <h3 className="text-xs font-semibold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                  المنتجات المحددة لخط الإنتاج ({selectedProducts.length}):
                </h3>
                <div
                  className="overflow-x-auto rounded-xl border max-h-36 overflow-y-auto"
                  style={{
                    borderColor: isLight ? '#EBF0FF' : '#3D3554',
                    background: isLight ? '#F8FAFF' : '#231B3D'
                  }}
                >
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554', background: isLight ? '#F5F7FF' : '#2F264C' }}>
                        <th className="p-2" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>المنتج</th>
                        <th className="p-2" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الكمية</th>
                        <th className="p-2" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>سعر البيع المقترح</th>
                        <th className="p-2" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الإجمالي</th>
                        <th className="p-2 text-center" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map((row, idx) => {
                        const prodObj = products.find(p => p.id.toString() === row.product_id);
                        const unitPrice = parseFloat(prodObj?.sale_price || '0');
                        const qty = parseFloat(row.quantity) || 0;
                        const totalVal = unitPrice * qty;
                        return (
                          <tr key={idx} className="border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
                            <td className="p-2 font-semibold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{prodObj?.name || '—'}</td>
                            <td className="p-2 font-medium" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{row.quantity} {prodObj?.unit}</td>
                            <td className="p-2 font-medium" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{currency} {unitPrice.toFixed(2)}</td>
                            <td className="p-2 font-bold" style={{ color: isLight ? '#4338CA' : '#ECC796' }}>{currency} {totalVal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleProductButtonClick(prodObj)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                  style={{
                                    background: isLight ? '#EFF2FE' : '#3D3554',
                                    color: isLight ? '#4338CA' : '#FFFFFF',
                                    borderColor: isLight ? '#EBF0FF' : 'transparent'
                                  }}
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(idx)}
                                  className="p-1 rounded text-red-500 hover:bg-red-50"
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

            {form.client_id !== '' && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: isLight ? '#1E293B' : '#D4CEEB' }}>مستودع صرف المواد</label>
                <select
                  value={form.warehouse_id}
                  onChange={e => setForm({ ...form, warehouse_id: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none font-semibold"
                  style={{
                    background: isLight ? '#F5F7FF' : '#231B3D',
                    borderColor: isLight ? '#EBF0FF' : '#3D3554',
                    color: isLight ? '#1E293B' : '#FFFFFF'
                  }}
                >
                  <option value="">اختر المستودع...</option>
                  {warehouses.filter(wh => wh.code !== 'WH-FIN' && wh.code !== 'WSH' && !wh.name.includes('منتج')).map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
              </div>
            )}

            {form.client_id !== '' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: isLight ? '#1E293B' : '#D4CEEB' }}>إجمالي سعر الطلب ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.total_price}
                      onChange={e => setForm({ ...form, total_price: e.target.value })}
                      className="w-full rounded-xl px-3 py-2 text-sm border outline-none font-bold"
                      style={{
                        background: isLight ? '#F5F7FF' : '#231B3D',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: isLight ? '#1E293B' : '#D4CEEB' }}>العربون / دفعة أولى ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.deposit_paid}
                      onChange={e => setForm({ ...form, deposit_paid: e.target.value })}
                      className="w-full rounded-xl px-3 py-2 text-sm border outline-none font-bold"
                      style={{
                        background: isLight ? '#F5F7FF' : '#231B3D',
                        borderColor: isLight ? '#EBF0FF' : '#3D3554',
                        color: isLight ? '#1E293B' : '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                {form.deposit_paid && parseFloat(form.deposit_paid) > 0 && (
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: isLight ? '#1E293B' : '#D4CEEB' }}>طريقة دفع العربون *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'cash', label: 'كاش / نقدي', icon: DollarSign },
                        { key: 'instapay', label: 'انستاباي', icon: Smartphone },
                        { key: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone },
                        { key: 'bank_transfer', label: 'تحويل بنكي', icon: Building2 },
                        { key: 'postal_transfer', label: 'حوالة بريدية (البريد)', icon: Landmark },
                      ].map(m => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setForm({ ...form, deposit_payment_method: m.key })}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all"
                          style={{
                            borderColor: isLight ? (form.deposit_payment_method === m.key ? '#4F46E5' : '#EBF0FF') : (form.deposit_payment_method === m.key ? '#ECC796' : '#3D3554'),
                            background: isLight ? (form.deposit_payment_method === m.key ? '#EFF2FE' : '#F5F7FF') : (form.deposit_payment_method === m.key ? 'rgba(236,199,150,0.15)' : '#231B3D'),
                            color: isLight ? (form.deposit_payment_method === m.key ? '#4338CA' : '#8288A4') : (form.deposit_payment_method === m.key ? '#ECC796' : '#A49EC0'),
                          }}
                        >
                          <span><m.icon size={16} /></span>
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {form.client_id === '' && (
              <div
                className="p-3.5 rounded-xl text-xs font-semibold border"
                style={{
                  background: isLight ? '#ECFDF5' : 'rgba(16,185,129,0.1)',
                  borderColor: isLight ? '#A7F3D0' : 'rgba(16,185,129,0.2)',
                  color: isLight ? '#047857' : '#34D399'
                }}
              >
                طلب داخلي للتخزين: سيتم إنتاج هذه الكميات وإضافتها مباشرة إلى مستودع المنتجات الجاهزة كمخزون عام فور إتمام الإنتاج.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: isLight ? '#1E293B' : '#D4CEEB' }}>ملاحظات</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none font-medium"
                style={{
                  background: isLight ? '#F5F7FF' : '#231B3D',
                  borderColor: isLight ? '#EBF0FF' : '#3D3554',
                  color: isLight ? '#1E293B' : '#FFFFFF'
                }}
              />
            </div>

            {msg && <p className={`text-xs text-center py-2 rounded-xl ${msg.includes('نجاح') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{msg}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 shadow-md text-white"
                style={{
                  background: isLight
                    ? (form.client_id === '' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #4F46E5, #3730A3)')
                    : (form.client_id === '' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #ECC796, #D4A660)'),
                  color: isLight ? '#FFFFFF' : (form.client_id === '' ? '#FFFFFF' : '#201A30')
                }}
              >
                {saving ? 'جاري الحفظ...' : form.client_id === '' ? '📦 إضافة للمخزون مباشرة' : 'حفظ كأمر معلق'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm border"
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

      {showProductPopup && selectedProductForPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl animate-in fade-in"
            style={{
              background: isLight ? '#FFFFFF' : '#231B3D',
              borderColor: isLight ? '#EBF0FF' : '#3D3554'
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
              <h3 className="text-sm font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                إدخال الكمية المطلوبة: {selectedProductForPopup.name}
              </h3>
              <button
                type="button"
                onClick={() => { setShowProductPopup(false); setSelectedProductForPopup(null); }}
                className="p-1 rounded hover:bg-black/5"
                style={{ color: isLight ? '#8288A4' : '#A49EC0' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmProductPopup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: isLight ? '#1E293B' : '#D1D5DB' }}>
                  الكمية المطلوبة ({selectedProductForPopup.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={popupProductQty}
                  onChange={e => setPopupProductQty(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none font-bold"
                  style={{
                    background: isLight ? '#F5F7FF' : '#2F264C',
                    borderColor: isLight ? '#EBF0FF' : '#3D3554',
                    color: isLight ? '#1E293B' : '#FFFFFF'
                  }}
                  placeholder="أدخل الكمية..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-sm text-white"
                  style={{
                    background: isLight ? '#4F46E5' : 'linear-gradient(135deg, #ECC796, #D4A660)',
                    color: isLight ? '#FFFFFF' : '#201A30'
                  }}
                >
                  تأكيد الإضافة
                </button>
                <button
                  type="button"
                  onClick={() => { setShowProductPopup(false); setSelectedProductForPopup(null); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border"
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
      )}
    </>
  );
}
