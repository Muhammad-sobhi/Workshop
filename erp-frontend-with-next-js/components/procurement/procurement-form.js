'use client';

import { useState } from 'react';
import { Plus, X, Wrench, Layers, Trash2, DollarSign, Smartphone, Building2 } from 'lucide-react';

export default function ProcurementForm({
  showCreate,
  onClose,
  suppliers,
  materials,
  supplierId,
  setSupplierId,
  orderDate,
  setOrderDate,
  notes,
  setNotes,
  items,
  setItems,
  depositPaid,
  setDepositPaid,
  depositPaymentMethod,
  setDepositPaymentMethod,
  msg,
  saving,
  onSubmit,
  setAlertDialog,
}) {
  const [showItemPopup, setShowItemPopup] = useState(false);
  const [selectedMaterialForPopup, setSelectedMaterialForPopup] = useState(null);
  const [popupQty, setPopupQty] = useState('');
  const [popupCost, setPopupCost] = useState('');

  const supplierMaterials = supplierId
    ? (suppliers.find(s => s.id === parseInt(supplierId))?.materials ?? materials)
    : materials;

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleAddOrUpdateItem = (e) => {
    e.preventDefault();
    if (!selectedMaterialForPopup) return;

    const qtyNum = parseFloat(popupQty);
    const costNum = parseFloat(popupCost);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setAlertDialog({ type: 'alert', message: 'يرجى إدخال كمية صحيحة' });
      return;
    }

    const existingIndex = items.findIndex(item => item.material_id === selectedMaterialForPopup.id.toString());
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: popupQty,
        unit_cost: popupCost,
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          material_id: selectedMaterialForPopup.id.toString(),
          quantity: popupQty,
          unit_cost: popupCost,
        },
      ]);
    }

    setShowItemPopup(false);
    setSelectedMaterialForPopup(null);
  };

  const openItemPopup = (m) => {
    setSelectedMaterialForPopup(m);
    const existing = items.find(item => item.material_id === m.id.toString());
    setPopupQty(existing ? existing.quantity : '');
    setPopupCost(existing ? existing.unit_cost : (m.pivot?.price || m.unit_cost || 0).toString());
    setShowItemPopup(true);
  };

  if (!showCreate) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="إنشاء أمر شراء">
        <div className="w-full max-w-3xl rounded-2xl border p-6 max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between pb-4 border-b shrink-0" style={{ borderColor: '#3D3554' }}>
            <h2 className="text-lg font-bold text-white">إنشاء أمر شراء مواد خام</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-sm font-medium text-gray-300">
                  المورد <span style={{ color: '#ECC796' }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl" style={{ background: '#231B3D', border: '1px solid #3D3554' }}>
                  {suppliers.map(s => {
                    const isSelected = supplierId === s.id.toString();
                    return (
                      <label key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:bg-white/5" style={{ borderColor: isSelected ? '#ECC796' : '#3D3554', background: isSelected ? 'rgba(236,199,150,0.15)' : 'transparent' }}>
                        <input
                          id={`supplier-radio-${s.id}`}
                          type="radio"
                          name="supplier"
                          value={s.id}
                          checked={isSelected}
                          onChange={() => { setSupplierId(s.id.toString()); setItems([]); }}
                          className="accent-[#ECC796] shrink-0"
                          required
                        />
                        <span className="text-xs font-semibold text-white truncate">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="procurement-date" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>التاريخ <span style={{ color: '#ECC796' }}>*</span></label>
                <input id="procurement-date" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} required className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3" style={{ borderColor: '#3D3554' }}>
              <label className="block text-sm font-semibold text-white">المواد والخدمات المتاحة لدى المورد (اضغط للإضافة):</label>
              {!supplierId ? (
                <div className="p-4 rounded-xl text-center text-xs text-[#ECC796]" style={{ background: '#231B3D' }}>
                  الرجاء تحديد مورد أولاً لعرض المواد والخدمات الخاصة به.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1.5">
                  {supplierMaterials.map((m) => {
                    const isService = m.type === 'service';
                    const isAdded = items.some(item => item.material_id === m.id.toString());
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => openItemPopup(m)}
                        className="flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center hover:scale-[1.02] hover:bg-white/5 active:scale-95 text-xs font-semibold"
                        style={{
                          borderColor: isAdded ? '#10B981' : '#3D3554',
                          background: isAdded ? 'rgba(16,185,129,0.08)' : '#231B3D',
                        }}
                      >
                        {isService ? (
                          <Wrench className="w-5 h-5 text-[#8D7EC8] shrink-0" />
                        ) : (
                          <Layers className="w-5 h-5 text-[#ECC796] shrink-0" />
                        )}
                        <span className="text-xs text-white line-clamp-1 w-full">{m.name}</span>
                        <span className="text-[10px] text-gray-400 truncate w-full">EGP {m.pivot?.price || m.unit_cost || 0} / {m.unit}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: '#3D3554' }}>
                <h3 className="text-xs font-semibold text-white">المواد المحددة للطلب ({items.length}):</h3>
                <div className="overflow-x-auto rounded-xl border max-h-36 overflow-y-auto" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
                        <th className="p-2 text-gray-400">المادة/الخدمة</th>
                        <th className="p-2 text-gray-400">الكمية</th>
                        <th className="p-2 text-gray-400">سعر الوحدة</th>
                        <th className="p-2 text-gray-400">إجمالي السعر</th>
                        <th className="p-2 text-center text-gray-400">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const matObj = supplierMaterials.find((m) => m.id.toString() === item.material_id) || materials.find((m) => m.id.toString() === item.material_id);
                        const totalCost = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
                        return (
                          <tr key={idx} className="border-b" style={{ borderColor: '#3D3554' }}>
                            <td className="p-2 text-white font-medium">{matObj?.name || '—'}</td>
                            <td className="p-2 text-white">{item.quantity} {matObj?.unit}</td>
                            <td className="p-2 text-white">EGP {parseFloat(item.unit_cost).toFixed(2)}</td>
                            <td className="p-2 text-[#ECC796] font-bold">EGP {totalCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openItemPopup(matObj)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-[#3D3554]"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 rounded text-red-400 hover:bg-red-500/10"
                                  aria-label="إزالة المادة"
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

            <div className="border-t pt-3 space-y-3" style={{ borderColor: '#3D3554' }}>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(236,199,150,0.08)', border: '1px solid rgba(236,199,150,0.2)' }}>
                <label htmlFor="procurement-deposit" className="block text-xs font-semibold mb-1.5" style={{ color: '#ECC796' }}>العربون / الدفعة المقدمة (اختياري)</label>
                <p className="text-[11px] mb-2" style={{ color: '#A49EC0' }}>إذا دفعت جزءاً من المبلغ مسبقاً، أدخله هنا — سيتم احتساب الباقي كدَين على المورد تلقائياً عند الاستلام.</p>
                <input
                  id="procurement-deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={depositPaid}
                  onChange={e => setDepositPaid(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none font-semibold"
                  style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                />
                {depositPaid && items.length > 0 && (() => {
                  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0);
                  const paid = parseFloat(depositPaid) || 0;
                  const remainingLocal = total - paid;
                  return remainingLocal > 0 ? (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: '#EF4444' }}>الدين المتبقي على المورد: EGP {remainingLocal.toFixed(2)}</p>
                  ) : (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: '#10B981' }}>مدفوع بالكامل ✓</p>
                  );
                })()}
                {depositPaid && parseFloat(depositPaid) > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>طريقة دفع العربون</label>
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
                          onClick={() => setDepositPaymentMethod(m.key)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all"
                          style={{
                            borderColor: depositPaymentMethod === m.key ? '#ECC796' : '#3D3554',
                            background: depositPaymentMethod === m.key ? 'rgba(236,199,150,0.15)' : '#231B3D',
                            color: depositPaymentMethod === m.key ? '#ECC796' : '#A49EC0',
                          }}
                        >
                          <span><m.icon size={16} /></span>
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="procurement-notes" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
                <textarea id="procurement-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }} />
              </div>
            </div>

            {msg && (
              <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
              </button>
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>

      {showItemPopup && selectedMaterialForPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="إدخال الكمية">
          <div className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl animate-in fade-in" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#3D3554' }}>
              <h3 className="text-sm font-bold text-white">إدخال الكمية والتكلفة: {selectedMaterialForPopup.name}</h3>
              <button type="button" onClick={() => { setShowItemPopup(false); setSelectedMaterialForPopup(null); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddOrUpdateItem} className="space-y-4">
              <div>
                <label htmlFor="popup-qty" className="block text-xs font-semibold mb-1 text-gray-300">الكمية المطلوبة ({selectedMaterialForPopup.unit}) <span className="text-red-400">*</span></label>
                <input
                  id="popup-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={popupQty}
                  onChange={e => setPopupQty(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none font-semibold text-white"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                  placeholder="أدخل الكمية..."
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="popup-cost" className="block text-xs font-semibold mb-1 text-gray-300">سعر الوحدة (EGP) <span className="text-red-400">*</span></label>
                <input
                  id="popup-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={popupCost}
                  onChange={e => setPopupCost(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none font-semibold text-white"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                  placeholder="سعر الوحدة..."
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
                  تأكيد الإضافة
                </button>
                <button type="button" onClick={() => { setShowItemPopup(false); setSelectedMaterialForPopup(null); }} className="flex-1 py-2 rounded-xl text-xs font-bold border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>
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
