import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, PlusCircle, MinusCircle, Wallet, Paperclip } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { todayString } from '@/lib/dates';

// Notes typed by the user, without the "from (...) to (...)" prefix the server adds to transfers
const transferNotes = (description = '') => {
  const i = description.indexOf(') - ');
  return i >= 0 ? description.slice(i + 4) : '';
};

export default function TreasuryActionModal({ show, mode, transaction = null, onClose, onSuccess, currency = 'EGP' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [fromMethod, setFromMethod] = useState('instapay');
  const [toMethod, setToMethod] = useState('cash');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayString());
  const [receipt, setReceipt] = useState(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  const isEdit = !!transaction;

  // Fresh form every time the modal opens: empty for a new entry, prefilled when editing
  useEffect(() => {
    if (!show) return;
    setError(null);
    setLoading(false);
    setReceipt(null);
    setRemoveReceipt(false);
    if (transaction) {
      setAmount(String(parseFloat(transaction.amount) || ''));
      setTransactionDate(transaction.date || (transaction.transaction_date || '').slice(0, 10) || todayString());
      setPaymentMethod(transaction.payment_method || 'cash');
      setFromMethod(transaction.transfer_from || 'instapay');
      setToMethod(transaction.transfer_to || 'cash');
      setCategory(transaction.category || '');
      setDescription(transaction.is_transfer ? transferNotes(transaction.description) : (transaction.description || ''));
    } else {
      setAmount('');
      setTransactionDate(todayString());
      setPaymentMethod('cash');
      setFromMethod('instapay');
      setToMethod('cash');
      setCategory('');
      setDescription('');
    }
  }, [show, mode, transaction]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'transfer' && fromMethod === toMethod) {
      setError('يرجى اختيار وسيلتين مختلفتين للتحويل بينهما');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'transfer') {
        const payload = {
          amount: parseFloat(amount),
          from_method: fromMethod,
          to_method: toMethod,
          notes: description,
          transaction_date: transactionDate,
        };
        if (isEdit) {
          await apiClient.put(`/treasury/transactions/${transaction.id}`, payload);
        } else {
          await apiClient.post('/treasury/transfer', payload);
        }
      } else {
        const fd = new FormData();
        fd.append('amount', parseFloat(amount));
        fd.append('payment_method', paymentMethod);
        fd.append('category', category || (mode === 'deposit' ? 'إيداع نقدي مباشر' : 'مسحوبات نقدية'));
        fd.append('description', description);
        fd.append('transaction_date', transactionDate);
        if (receipt) fd.append('receipt', receipt);

        const config = { headers: { 'Content-Type': 'multipart/form-data' } };
        if (isEdit) {
          // PHP only parses multipart bodies on POST, so the update is sent as a spoofed PUT
          fd.append('_method', 'PUT');
          if (removeReceipt && !receipt) fd.append('remove_receipt', '1');
          await apiClient.post(`/treasury/transactions/${transaction.id}`, fd, config);
        } else {
          await apiClient.post(mode === 'deposit' ? '/treasury/deposit' : '/treasury/withdraw', fd, config);
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const errors = err.response?.data?.errors;
      setError((errors && Object.values(errors)[0]?.[0]) || err.response?.data?.message || 'حدث خطأ أثناء تنفيذ العملية، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    deposit: 'إيداع نقدية / رصيد في الخزينة',
    withdraw: 'سحب نقدي من الخزينة / مسحوبات',
    transfer: 'تحويل سيولة بين المحافظ المالية',
  };

  const icons = {
    deposit: PlusCircle,
    withdraw: MinusCircle,
    transfer: ArrowRightLeft,
  };

  const IconComponent = icons[mode] || Wallet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{ background: '#201A30', borderColor: '#3D3554' }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: '#3D3554' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236,199,150,0.1)', border: '1px solid rgba(236,199,150,0.3)', color: '#ECC796' }}>
              <IconComponent size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{isEdit ? `تعديل: ${titles[mode]}` : titles[mode]}</h3>
              <p className="text-xs" style={{ color: '#A49EC0' }}>{isEdit ? `تعديل القيد ${transaction.number || transaction.transaction_number || ''}` : 'تسجيل قيد مالي مباشر بالخزينة'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#A49EC0] hover:text-white hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">المبلغ ({currency}) *</label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              placeholder="مثال: 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-white placeholder-[#A49EC0]/50 outline-none transition-all focus:border-[#ECC796]"
              style={{ background: '#2F264C', borderColor: '#3D3554' }}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">تاريخ الحركة *</label>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-white outline-none transition-all focus:border-[#ECC796]"
              style={{ background: '#2F264C', borderColor: '#3D3554' }}
            />
          </div>

          {/* Payment Method / Transfer Selectors */}
          {mode === 'transfer' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">من محفظة *</label>
                <select
                  value={fromMethod}
                  onChange={(e) => setFromMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-xs text-white outline-none"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                >
                  <option value="instapay">انستاباي</option>
                  <option value="cash">كاش / نقدي</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="postal_transfer">حوالة بريدية</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">إلى محفظة *</label>
                <select
                  value={toMethod}
                  onChange={(e) => setToMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-xs text-white outline-none"
                  style={{ background: '#2F264C', borderColor: '#3D3554' }}
                >
                  <option value="cash">كاش / نقدي</option>
                  <option value="instapay">انستاباي</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="postal_transfer">حوالة بريدية</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">طريقة الدفع / المحفظة *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-xs text-white outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              >
                <option value="cash">كاش / نقدي</option>
                <option value="instapay">انستاباي</option>
                <option value="vodafone_cash">فودافون كاش</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="postal_transfer">حوالة بريدية</option>
              </select>
            </div>
          )}

          {/* Category */}
          {mode !== 'transfer' && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">البند / التصنيف</label>
              <input
                type="text"
                placeholder={mode === 'deposit' ? 'مثال: رصيد إفتتاحي، إيداع رأس مال' : 'مثال: سحب أرباح، مسحوبات شخصية'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border text-xs text-white placeholder-[#A49EC0]/50 outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              />
            </div>
          )}

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">ملاحظات وبيان العملية</label>
            <textarea
              rows={2}
              placeholder="اكتب أي تفاصيل توضيحية إضافية..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border text-xs text-white placeholder-[#A49EC0]/50 outline-none resize-none"
              style={{ background: '#2F264C', borderColor: '#3D3554' }}
            />
          </div>

          {/* Receipt attachment (deposit / withdrawal) */}
          {mode !== 'transfer' && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">صورة الإيصال / المستند (اختياري)</label>
              <label
                className="flex items-center gap-2 w-full px-3.5 py-2 rounded-xl border text-xs cursor-pointer hover:border-[#ECC796] transition-all"
                style={{ background: '#2F264C', borderColor: '#3D3554', color: receipt ? '#FFFFFF' : '#A49EC0' }}
              >
                <Paperclip size={14} />
                <span className="truncate">{receipt ? receipt.name : 'اختر صورة أو ملف PDF'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                />
              </label>
              {isEdit && transaction.receipt_path && !receipt && (
                <label className="flex items-center gap-2 mt-1.5 text-[11px]" style={{ color: '#A49EC0' }}>
                  <input type="checkbox" checked={removeReceipt} onChange={(e) => setRemoveReceipt(e.target.checked)} />
                  حذف الإيصال المرفق حالياً
                </label>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t" style={{ borderColor: '#3D3554' }}>
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
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30]"
            >
              {loading ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
