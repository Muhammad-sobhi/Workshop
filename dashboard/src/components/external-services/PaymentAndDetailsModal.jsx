'use client';

import { useState } from 'react';
import { X, Upload, Check, DollarSign, Printer, Image as ImageIcon, Calendar, CreditCard, ExternalLink, Share2, PackageCheck } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getImageUrl } from '@/lib/config';

export default function PaymentAndDetailsModal({ isOpen, onClose, order, onSuccess, onPrint }) {
  const [activeTab, setActiveTab] = useState('details'); // details | payment | returns
  const [form, setForm] = useState({
    amount: '',
    payment_method: 'instapay',
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [returnsForm, setReturnsForm] = useState({
    returned_quantity: order?.returned_quantity ? order.returned_quantity.toString() : '0',
    rejected_quantity: order?.rejected_quantity ? order.rejected_quantity.toString() : '0',
    notes: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !order) return null;

  const totalCost = parseFloat(order.total_cost || 0);
  const totalPaid = parseFloat(order.total_paid || 0);
  const balance = totalCost - totalPaid;
  const returnedQty = parseFloat(order.returned_quantity || 0);
  const rejectedQty = parseFloat(order.rejected_quantity || 0);
  const totalQty = parseFloat(order.quantity || 1);
  const returnPercent = Math.min(100, Math.round(((returnedQty + rejectedQty) / totalQty) * 100));

  const handleWhatsAppShare = () => {
    const phone = order.supplier?.phone ? order.supplier.phone.replace(/[^0-9]/g, '') : '';
    const text = `السلام عليكم ورحمة الله،\nأمر تشغيل خارجي رقم: ${order.order_number}\nالمورد: ${order.supplier?.name || ''}\nبيان الخدمة: ${order.item_description}\nالكمية: ${order.quantity} ${order.unit}\nالتكلفة الإجمالية: ${totalCost} EGP\nالمبلغ المدفوع: ${totalPaid} EGP\nالمتبقي (دين): ${balance} EGP\nتاريخ الإرسال: ${order.sent_date ? new Date(order.sent_date).toLocaleDateString('ar-EG') : ''}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.amount || parseFloat(form.amount) <= 0) {
      return setErrorMsg('برجاء كتابة مبلغ الدفعة');
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', form.amount);
      formData.append('payment_method', form.payment_method);
      if (form.transaction_reference) formData.append('transaction_reference', form.transaction_reference);
      formData.append('payment_date', form.payment_date);
      if (form.notes) formData.append('notes', form.notes);
      if (receiptFile) formData.append('receipt_image', receiptFile);

      await apiClient.post(`/external-service-orders/${order.id}/payments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onSuccess();
      setForm({
        amount: '',
        payment_method: 'instapay',
        transaction_reference: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setReceiptFile(null);
      setActiveTab('details');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReturns = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    setLoading(true);
    try {
      await apiClient.put(`/external-service-orders/${order.id}/returns`, returnsForm);
      onSuccess();
      setActiveTab('details');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء تحديث كمية الاستلام والجودة');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      await apiClient.put(`/external-service-orders/${order.id}/status`, { status: newStatus });
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-[#3D3554] bg-[#2F264C] text-white shadow-2xl overflow-hidden">
        
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-[#3D3554] bg-[#231B3D] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#ECC796]">{order.order_number}</span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796]">
                {order.supplier?.name}
              </span>
            </div>
            <p className="text-xs text-[#A49EC0] mt-0.5">{order.item_description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
              title="مشاركة عبر واتساب"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              واتساب
            </button>
            <button
              onClick={() => onPrint(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2F264C] text-[#ECC796] border border-[#3D3554] hover:bg-white/5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#2F264C] text-[#A49EC0] hover:text-white hover:bg-white/10 transition-colors border border-[#3D3554]"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Tab Buttons */}
          <div className="flex gap-2 border-b border-[#3D3554] pb-px">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-[#ECC796] text-[#ECC796]'
                  : 'border-transparent text-[#A49EC0] hover:text-white'
              }`}
            >
              تفاصيل الأمر والمدفوعات ({order.payments?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'returns'
                  ? 'border-[#ECC796] text-[#ECC796]'
                  : 'border-transparent text-[#A49EC0] hover:text-white'
              }`}
            >
              الاستلام والجودة ({returnedQty}/{totalQty})
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'payment'
                  ? 'border-[#ECC796] text-[#ECC796]'
                  : 'border-transparent text-[#A49EC0] hover:text-white'
              }`}
            >
              +تسجيل دفعة جديدة (Instapay / Cash)
            </button>
          </div>

          {activeTab === 'details' ? (
            <div className="space-y-5 text-xs">
              {/* Financial Status Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#231B3D] border border-[#3D3554] text-center">
                  <p className="text-[#A49EC0]">إجمالي تكلفة الأمر</p>
                  <p className="text-xl font-bold text-[#ECC796] mt-1">EGP {totalCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[11px] text-[#A49EC0] mt-0.5">{order.quantity} {order.unit} × {order.unit_cost} EGP</p>
                </div>

                <div className="p-4 rounded-xl bg-[#231B3D] border border-[#3D3554] text-center">
                  <p className="text-[#A49EC0]">إجمالي المدفوع</p>
                  <p className="text-xl font-bold text-[#10B981] mt-1">EGP {totalPaid.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[11px] text-[#A49EC0] mt-0.5">{order.payments?.length || 0} عملية دفع</p>
                </div>

                <div className="p-4 rounded-xl bg-[#231B3D] border border-[#3D3554] text-center">
                  <p className="text-[#A49EC0]">{balance > 0 ? 'المتبقي (مستحق للمورد)' : balance < 0 ? 'رصيد دائن (لكم لدى المورد)' : 'مسدد بالكامل'}</p>
                  <p className={`text-xl font-bold mt-1 ${balance > 0 ? 'text-red-400' : balance < 0 ? 'text-emerald-400' : 'text-[#ECC796]'}`}>
                    EGP {Math.abs(balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-[#A49EC0] mt-0.5">
                    {balance > 0 ? 'ديون غير مسددة' : balance < 0 ? 'دفعة زائدة' : 'لا تترتب ديون'}
                  </p>
                </div>
              </div>

              {/* Progress & Return Status */}
              <div className="p-3.5 rounded-xl bg-[#231B3D] border border-[#3D3554]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-[#D4CEEB] flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-[#ECC796]" /> نسبة استلام الأصناف من الورشة:
                  </span>
                  <span className="font-bold text-[#ECC796]">{returnPercent}% ({returnedQty} مستلم / {totalQty} {order.unit})</span>
                </div>
                <div className="w-full h-2.5 bg-[#2F264C] rounded-full overflow-hidden border border-[#3D3554]">
                  <div className="h-full bg-gradient-to-r from-[#ECC796] to-emerald-400 transition-all duration-300" style={{ width: `${returnPercent}%` }} />
                </div>
                {rejectedQty > 0 && (
                  <p className="text-[11px] text-red-400 mt-1.5 font-semibold">⚠️ مرفوض للجودة: {rejectedQty} {order.unit}</p>
                )}
              </div>

              {/* Status Change Buttons */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#231B3D] border border-[#3D3554]">
                <span className="font-semibold text-[#D4CEEB]">تحديث حالة الأمر الحالية:</span>
                <div className="flex gap-2">
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange('sent')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      order.status === 'sent' ? 'bg-[#ECC796] text-[#201A30] border-[#ECC796]' : 'bg-[#2F264C] text-[#A49EC0] border-[#3D3554] hover:text-white'
                    }`}
                  >
                    تم الإرسال
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange('partially_received')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      order.status === 'partially_received' ? 'bg-amber-500 text-white border-amber-500' : 'bg-[#2F264C] text-[#A49EC0] border-[#3D3554] hover:text-white'
                    }`}
                  >
                    استلام جزئي
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleStatusChange('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      order.status === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-[#2F264C] text-[#A49EC0] border-[#3D3554] hover:text-white'
                    }`}
                  >
                    مكتمل
                  </button>
                </div>
              </div>

              {/* Payments History List */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-[#ECC796]">سجل الدفعات المسددة</h3>

                {(!order.payments || order.payments.length === 0) ? (
                  <div className="p-6 text-center rounded-xl bg-[#231B3D] border border-[#3D3554] text-[#A49EC0]">
                    لا توجد دفعات مسجلة لهذا الأمر حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {order.payments.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl bg-[#231B3D] border border-[#3D3554] flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-400 text-sm">EGP {parseFloat(p.amount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#3D3554] text-[#ECC796] uppercase font-semibold">
                              {p.payment_method}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#A49EC0] flex items-center gap-3">
                            <span><Calendar className="w-3 h-3 inline ml-1" />{new Date(p.payment_date).toLocaleDateString('ar-EG')}</span>
                            {p.transaction_reference && <span>مرجع: {p.transaction_reference}</span>}
                          </p>
                          {p.notes && <p className="text-[11px] text-[#D4CEEB] italic">{p.notes}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          {p.receipt_image_path && (
                            <a
                              href={getImageUrl(p.receipt_image_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] text-[#ECC796] border border-[#3D3554] hover:bg-white/10 transition-colors text-xs"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              الإيصال
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                              if (!window.confirm('هل أنت متأكد من التراجع عن هذه الدفعة وإلغائها؟')) return;
                              setLoading(true);
                              try {
                                const res = await apiClient.delete(`/external-service-orders/${order.id}/payments/${p.id}`);
                                onRefresh?.();
                                onClose?.();
                              } catch (err) {
                                alert(err?.response?.data?.message || 'فشل في إلغاء الدفعة');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/40 transition-colors text-xs font-bold"
                            title="التراجع عن هذه الدفعة"
                          >
                            ↩ تراجع
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'returns' ? (
            /* Returns & Quality Tab Form */
            <form onSubmit={handleUpdateReturns} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#231B3D] border border-[#3D3554] space-y-2">
                <h3 className="font-bold text-sm text-[#ECC796]">تحديث كميات الاستلام والجودة</h3>
                <p className="text-[#A49EC0] text-xs">إجمالي الكمية المرسلة للورشة: <strong className="text-white">{totalQty} {order.unit}</strong></p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">الكمية المستلمة سليمة *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalQty}
                    value={returnsForm.returned_quantity}
                    onChange={e => setReturnsForm({ ...returnsForm, returned_quantity: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">الكمية المرفوضة لعيوب الجودة</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalQty}
                    value={returnsForm.rejected_quantity}
                    onChange={e => setReturnsForm({ ...returnsForm, rejected_quantity: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">ملاحظات الفحص والجودة (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات حول عيوب الدهان أو حالة الخشب أثناء الاستلام..."
                  value={returnsForm.notes}
                  onChange={e => setReturnsForm({ ...returnsForm, notes: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#3D3554]">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
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
                  {loading ? 'جاري التحديث...' : 'حفظ حالة الاستلام'}
                </button>
              </div>
            </form>
          ) : (
            /* Payment Tab Form */
            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">المبلغ المدفوع (EGP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                    required
                  />
                  {balance > 0 && (
                    <p className="text-[11px] text-[#A49EC0] mt-1">المتبقي المسجل: {balance} EGP</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">طريقة الدفع *</label>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                    required
                  >
                    <option value="instapay">انستا باي Instapay</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="cash">نقداً Cash</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">رقم العملية / المرجع</label>
                  <input
                    type="text"
                    placeholder="رقم مرجع Instapay أو الحساب"
                    value={form.transaction_reference}
                    onChange={e => setForm({ ...form, transaction_reference: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[#D4CEEB]">تاريخ السداد *</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={e => setForm({ ...form, payment_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">رفع إيصال التحويل (اختياري)</label>
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
                    <Check className="w-3.5 h-3.5" /> تم رفع: {receiptFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">ملاحظات الدفعة</label>
                <textarea
                  rows={2}
                  placeholder="تفاصيل الدفعة أو اسم المحول..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#3D3554]">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
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
                  {loading ? 'جاري التسجيل...' : 'تسجيل الدفعة لحساب الأمر'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
