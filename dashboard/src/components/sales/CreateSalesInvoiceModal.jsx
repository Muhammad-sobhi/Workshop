import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { X, Plus, Trash2, Calendar, DollarSign, Smartphone, Building2, ShoppingBag, Info } from 'lucide-react';

export default function CreateSalesInvoiceModal({ show, onClose, products = [], clients = [], currency = 'EGP', onSuccess }) {
  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_sale_price: '' }]);
  const [paidAmount, setPaidAmount] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      setClientId('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('cash');
      setNotes('');
      setItems([{ product_id: '', quantity: 1, unit_sale_price: '' }]);
      setPaidAmount('0');
      setError(null);
    }
  }, [show]);

  if (!show) return null;

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'product_id') {
      const prod = products.find((p) => p.id.toString() === value.toString());
      if (prod) {
        updated[index].unit_sale_price = prod.sale_price ? prod.sale_price.toString() : '';
      }
    }
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_sale_price: '' }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const totalInvoice = items.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unit_sale_price) || 0;
    return sum + q * p;
  }, 0);

  const effectivePaid = Math.max(0, parseFloat(paidAmount) || 0);
  const remainingDebt = Math.max(0, totalInvoice - effectivePaid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validItems = items.filter(
      (i) => i.product_id && parseFloat(i.quantity) > 0 && parseFloat(i.unit_sale_price) >= 0
    );

    if (validItems.length === 0) {
      setError('يرجى اختيار منتج واحد على الأقل وتحديد الكمية وسعر البيع');
      return;
    }

    // Strict Inventory Stock Validation - Never allow selling with 0 or negative stock
    for (const item of validItems) {
      const prod = products.find((p) => p.id.toString() === item.product_id.toString());
      const availableStock = prod ? (parseFloat(prod.stock ?? prod.stock_quantity ?? 0)) : 0;
      const requestedQty = parseFloat(item.quantity);

      if (availableStock < requestedQty) {
        setError(`عذراً، المخزون المتوفر من (${prod?.name || 'المنتج'}) غير كافٍ. المتوفر بالمخزن: ${availableStock} ${prod?.unit || 'وحدة'}، المطلوب: ${requestedQty}. يجب تصنيع المنتج في قسم الإنتاج أولاً قبل البيع.`);
        return;
      }
    }

    if (remainingDebt > 0 && !clientId) {
      setError('عند وجود مبلغ متبقي (أجل)، يجب اختيار العميل لتسجيل المتبقي كدين عليه');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/sales', {
        client_id: clientId ? parseInt(clientId) : null,
        invoice_date: invoiceDate,
        payment_method: paymentMethod,
        paid_amount: effectivePaid,
        notes,
        items: validItems.map((i) => ({
          product_id: parseInt(i.product_id),
          quantity: parseFloat(i.quantity),
          unit_sale_price: parseFloat(i.unit_sale_price),
        })),
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border p-6 max-h-[92vh] overflow-y-auto shadow-2xl"
        style={{ background: '#201A30', borderColor: '#3D3554' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(236,199,150,0.1)',
                border: '1px solid rgba(236,199,150,0.3)',
                color: '#ECC796',
              }}
            >
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إصدار فاتورة بيع منتجات</h3>
              <p className="text-xs" style={{ color: '#A49EC0' }}>
                خصم فوري للمنتجات من المخزن + تسجيل الإيراد وتكلفة البضاعة في الخزينة والأرباح
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A49EC0] hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">العميل (اختياري للبيع النقدي)</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border text-xs text-white outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              >
                <option value="">عميل نقدي / بدون حساب</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">تاريخ الفاتورة *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border text-xs text-white outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">الأصناف المباعة *</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-bold text-[#ECC796] hover:underline"
              >
                <Plus size={14} /> إضافة صنف آخر
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const selectedProd = products.find((p) => p.id.toString() === item.product_id.toString());
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_sale_price) || 0);

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                    style={{ background: '#2F264C', borderColor: '#3D3554' }}
                  >
                    {/* Product select */}
                    <div className="flex-1">
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border text-xs text-white outline-none"
                        style={{ background: '#201A30', borderColor: '#3D3554' }}
                      >
                        <option value="">اختر المنتج...</option>
                        {products.map((p) => {
                          const avail = Math.max(0, parseFloat(p.stock ?? p.stock_quantity ?? 0));
                          const isOutOfStock = avail <= 0;
                          return (
                            <option key={p.id} value={p.id} disabled={isOutOfStock}>
                              {p.name} {isOutOfStock ? `(⛔ غير متوفر بالمخزن - 0 ${p.unit || 'وحدة'})` : `(المتوفر: ${avail} ${p.unit || 'وحدة'})`} - سعر البيع: {p.sale_price || 0} {currency}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs text-white text-center outline-none"
                        style={{ background: '#201A30', borderColor: '#3D3554' }}
                      />
                    </div>

                    {/* Unit Sale Price */}
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        placeholder="سعر البيع"
                        value={item.unit_sale_price}
                        onChange={(e) => handleItemChange(idx, 'unit_sale_price', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs text-white text-center outline-none"
                        style={{ background: '#201A30', borderColor: '#3D3554' }}
                      />
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-left font-bold text-xs text-emerald-400">
                      {lineTotal.toFixed(2)} {currency}
                    </div>

                    {/* Delete */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Method & Paid Amount */}
          <div className="p-3.5 rounded-xl border space-y-3" style={{ background: '#261F3B', borderColor: '#3D3554' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">طريقة تحصيل النقدية *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs text-white outline-none"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                >
                  <option value="cash">كاش / نقدي</option>
                  <option value="instapay">انستاباي</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="postal_transfer">حوالة بريدية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  المبلغ المدفوع نقداً الآن ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs text-white outline-none"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                />
              </div>
            </div>

            {/* Financial Totals Summary */}
            <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: '#3D3554' }}>
              <div>
                <span style={{ color: '#A49EC0' }}>إجمالي الفاتورة: </span>
                <span className="font-bold text-white">
                  {totalInvoice.toFixed(2)} {currency}
                </span>
              </div>
              <div>
                <span style={{ color: '#A49EC0' }}>المسدد للخزينة: </span>
                <span className="font-bold text-emerald-400">
                  {effectivePaid.toFixed(2)} {currency}
                </span>
              </div>
              {remainingDebt > 0 && (
                <div>
                  <span style={{ color: '#EF4444' }}>المتبقي (دين على العميل): </span>
                  <span className="font-bold text-rose-400">
                    {remainingDebt.toFixed(2)} {currency}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">ملاحظات الفاتورة</label>
            <input
              type="text"
              placeholder="مثال: تسليم فوري مع المعاينة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border text-xs text-white placeholder-[#A49EC0]/50 outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554' }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: '#3D3554' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5"
              style={{ borderColor: '#3D3554', color: '#A49EC0' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || totalInvoice <= 0}
              className="px-6 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30]"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وإصدار الفاتورة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
