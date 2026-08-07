'use client';

import { useState } from 'react';
import { X, Upload, Check, DollarSign, Printer, Image as ImageIcon, Calendar, CreditCard, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getImageUrl } from '@/lib/config';

export default function PaymentAndDetailsModal({ isOpen, onClose, order, onSuccess, onPrint }) {
  const [activeTab, setActiveTab] = useState('details'); // details | payment
  const [form, setForm] = useState({
    amount: '',
    payment_method: 'instapay',
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !order) return null;

  const totalCost = parseFloat(order.total_cost || 0);
  const totalPaid = parseFloat(order.total_paid || 0);
  const balance = totalCost - totalPaid;

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

      if (receiptFile) {
        formData.append('receipt_image', receiptFile);
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#3D3554] bg-[#2F264C] text-white p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3D3554] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#ECC796]">{order.order_number}</span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796]">
                {order.supplier?.name}
              </span>
            </div>
            <p className="text-xs text-[#A49EC0] mt-1">{order.item_description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#231B3D] text-[#ECC796] border border-[#3D3554] hover:bg-white/5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة الإيصال PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-[#231B3D] text-[#A49EC0] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
                  {balance > 0 ? 'دين متبقي' : balance < 0 ? 'دفع زائد' : 'مكتمل الحساب'}
                </p>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#231B3D] border border-[#3D3554]">
              <span className="font-semibold text-[#D4CEEB]">حالة الأمر الحالية:</span>
              <div className="flex gap-2">
                {[
                  { key: 'sent', label: 'بالخارج (قيد التشغيل)' },
                  { key: 'partially_received', label: 'مستلم جزئياً' },
                  { key: 'completed', label: 'تم الاستلام بالكامل' },
                ].map(st => (
                  <button
                    key={st.key}
                    onClick={() => handleStatusChange(st.key)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      order.status === st.key
                        ? 'bg-[#ECC796] text-[#201A30] border-[#ECC796]'
                        : 'bg-[#2F264C] text-[#A49EC0] border-[#3D3554] hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment History List */}
            <div className="space-y-2">
              <h3 className="font-bold text-[#ECC796] text-sm flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                سجل المدفوعات والإيصالات المرفقة
              </h3>

              <div className="rounded-xl border border-[#3D3554] overflow-hidden bg-[#231B3D]">
                {order.payments && order.payments.length > 0 ? (
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#3D3554] text-[#A49EC0]">
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3">رقم المرجع / Instapay</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3 text-center">الإيصال المرفق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.payments.map((p, idx) => (
                        <tr key={p.id || idx} className="border-b border-[#3D3554]/50 hover:bg-white/5">
                          <td className="p-3 text-white font-medium">{p.payment_date}</td>
                          <td className="p-3 text-[#D4CEEB]">
                            {p.payment_method === 'instapay' ? 'انستا باي Instapay' : p.payment_method === 'vodafone_cash' ? 'فودافون كاش' : p.payment_method === 'cash' ? 'نقداً' : 'تحويل بنكي'}
                          </td>
                          <td className="p-3 font-mono text-[#A49EC0]">{p.transaction_reference || '—'}</td>
                          <td className="p-3 font-bold text-emerald-400">EGP {parseFloat(p.amount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">
                            {p.receipt_image_path ? (
                              <a
                                href={getImageUrl(p.receipt_image_path.startsWith('storage/') ? p.receipt_image_path : 'storage/' + p.receipt_image_path)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2F264C] text-[#ECC796] border border-[#3D3554] hover:bg-white/10"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                عرض الإيصال
                              </a>
                            ) : (
                              <span className="text-[#A49EC0]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-[#A49EC0]">لا توجد مدفوعات مسجلة لهذا الأمر بعد</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Payment Form Tab */
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">المبلغ المدفوع (EGP) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder={`المتبقي الحالي: ${balance}`}
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                  required
                />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">رقم العملية / المرجع (Instapay Ref)</label>
                <input
                  type="text"
                  placeholder="مثال: Ref #94827104"
                  value={form.transaction_reference}
                  onChange={e => setForm({ ...form, transaction_reference: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB]">تاريخ الدفع *</label>
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
              <label className="block font-semibold mb-1 text-[#D4CEEB]">رفع صورة الإيصال / سكرين شوت Instapay (اختياري)</label>
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
  );
}
