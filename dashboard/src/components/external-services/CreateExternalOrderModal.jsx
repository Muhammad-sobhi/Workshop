'use client';

import { useState } from 'react';
import { X, Upload, Check } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function CreateExternalOrderModal({ isOpen, onClose, suppliers, materials, products, onSuccess }) {
  const [form, setForm] = useState({
    supplier_id: '',
    material_id: '',
    product_id: '',
    item_description: '',
    quantity: '1',
    unit: 'قطعة',
    unit_cost: '',
    sent_date: new Date().toISOString().split('T')[0],
    expected_return_date: '',
    notes: '',
    initial_payment: '0',
    payment_method: 'instapay',
    transaction_reference: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const totalCost = (parseFloat(form.quantity || 0) * parseFloat(form.unit_cost || 0)) || 0;
  const initialPay = parseFloat(form.initial_payment || 0) || 0;
  const balance = totalCost - initialPay;

  const handleMaterialSelect = (e) => {
    const matId = e.target.value;
    setForm(prev => {
      const selectedMat = materials.find(m => m.id === parseInt(matId));
      return {
        ...prev,
        material_id: matId,
        item_description: selectedMat ? `${selectedMat.name} (${selectedMat.category || ''})` : prev.item_description,
        unit: selectedMat?.unit || prev.unit,
        unit_cost: selectedMat?.unit_cost ? selectedMat.unit_cost.toString() : prev.unit_cost,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.supplier_id) return setErrorMsg('برجاء اختيار المورد / الورشة الخارجية');
    if (!form.item_description) return setErrorMsg('برجاء كتابة بيان الصنف أو الخدمة');
    if (!form.unit_cost || parseFloat(form.unit_cost) <= 0) return setErrorMsg('برجاء إدخال تكلفة الخدمة');

    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== null && form[key] !== undefined && form[key] !== '') {
          formData.append(key, form[key]);
        }
      });

      if (receiptFile) {
        formData.append('receipt_image', receiptFile);
      }

      await apiClient.post('/external-service-orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء حفظ أمر التشغيل الخارجي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#3D3554] bg-[#2F264C] text-white p-6 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-[#3D3554] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#ECC796]">إضافة أمر تشغيل خارجي جديد</h2>
            <p className="text-xs text-[#A49EC0] mt-0.5">إرسال أصناف أو كراسي أو مواد للورش الخارجية للتشغيل والدهان</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-[#231B3D] text-[#A49EC0] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Supplier Select */}
          <div>
            <label className="block font-semibold mb-1 text-[#D4CEEB]">المورد / الورشة الخارجية *</label>
            <select
              value={form.supplier_id}
              onChange={e => setForm({ ...form, supplier_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
              required
            >
              <option value="">-- اختر الورشة الخارجية / المورد --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Quick Select External Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">اختيار خدمة خارجية مسجلة (اختياري)</label>
              <select
                value={form.material_id}
                onChange={handleMaterialSelect}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
              >
                <option value="">-- تفصيل يدوي / أو اختر خدمة خارجية --</option>
                {materials.filter(m => m.type === 'service').map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.service_location === 'outside' ? '(خارج الورشة)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">بيان الصنف أو الخدمة *</label>
              <input
                type="text"
                placeholder="مثال: دهان كراسي فورجيه لكرسي عادي"
                value={form.item_description}
                onChange={e => setForm({ ...form, item_description: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                required
              />
            </div>
          </div>

          {/* Quantity, Unit, Unit Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">الكمية المرسلة *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">الوحدة *</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">تكلفة القطعة (EGP) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.unit_cost}
                onChange={e => setForm({ ...form, unit_cost: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                required
              />
            </div>
          </div>

          {/* Total Summary Banner */}
          <div className="rounded-xl p-3.5 bg-[#231B3D] border border-[#3D3554] flex items-center justify-between font-semibold">
            <div>
              <p className="text-[11px] text-[#A49EC0]">إجمالي تكلفة أمر التشغيل</p>
              <p className="text-base font-bold text-[#ECC796]">EGP {totalCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#A49EC0]">المدفوع حالياً</p>
              <p className="text-base font-bold text-[#10B981]">EGP {initialPay.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#A49EC0]">المتبقي (مستحق للمورد)</p>
              <p className={`text-base font-bold ${balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                EGP {balance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">تاريخ الإرسال *</label>
              <input
                type="date"
                value={form.sent_date}
                onChange={e => setForm({ ...form, sent_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">تاريخ الاستلام المتوقع (اختياري)</label>
              <input
                type="date"
                value={form.expected_return_date}
                onChange={e => setForm({ ...form, expected_return_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
              />
            </div>
          </div>

          {/* Payment Section */}
          <div className="pt-2 border-t border-[#3D3554] space-y-3">
            <h3 className="font-bold text-sm text-[#ECC796]">تسجيل دفعة مقدماً (اختياري)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">المبلغ المدفوع</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.initial_payment}
                  onChange={e => setForm({ ...form, initial_payment: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">طريقة الدفع</label>
                <select
                  value={form.payment_method}
                  onChange={e => setForm({ ...form, payment_method: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                >
                  <option value="instapay">انستا باي Instapay</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="cash">نقداً Cash</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">رقم العملية / المرجع</label>
                <input
                  type="text"
                  placeholder="رقم مرجع Instapay"
                  value={form.transaction_reference}
                  onChange={e => setForm({ ...form, transaction_reference: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                />
              </div>
            </div>

            {/* File Upload for Instapay Receipt */}
            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB]">رفع صورة الإيصال / إثبات التحويل (اختياري)</label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#231B3D] border border-dashed border-[#3D3554]">
                <Upload className="w-5 h-5 text-[#ECC796] shrink-0" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="text-xs text-[#A49EC0] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#3D3554] file:text-[#ECC796] hover:file:bg-white/10"
                />
              </div>
              {receiptFile && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> تم اختيار: {receiptFile.name}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-[#D4CEEB]">ملاحظات (اختياري)</label>
            <textarea
              rows={2}
              placeholder="أي ملاحظات خاصة بالتسليم أو الجودة..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#3D3554]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#3D3554] text-[#A49EC0] hover:bg-white/5"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وأمر التشغيل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
