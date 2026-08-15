import React, { useState } from 'react';
import { X, ArrowRightLeft, PlusCircle, MinusCircle, Wallet } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function TreasuryActionModal({ show, mode, onClose, onSuccess, currency = 'EGP' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [fromMethod, setFromMethod] = useState('instapay');
  const [toMethod, setToMethod] = useState('cash');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'deposit') {
        await apiClient.post('/treasury/deposit', {
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          category: category || 'إيداع نقدي مباشر',
          description,
          transaction_date: transactionDate,
        });
      } else if (mode === 'withdraw') {
        await apiClient.post('/treasury/withdraw', {
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          category: category || 'مسحوبات نقدية',
          description,
          transaction_date: transactionDate,
        });
      } else if (mode === 'transfer') {
        if (fromMethod === toMethod) {
          setError('يرجى اختيار وسيلتين مختلفتين للتحويل بينهما');
          setLoading(false);
          return;
        }
        await apiClient.post('/treasury/transfer', {
          amount: parseFloat(amount),
          from_method: fromMethod,
          to_method: toMethod,
          notes: description,
          transaction_date: transactionDate,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء تنفيذ العملية، يرجى المحاولة مرة أخرى');
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
              <h3 className="text-base font-bold text-white">{titles[mode]}</h3>
              <p className="text-xs" style={{ color: '#A49EC0' }}>تسجيل قيد مالي مباشر بالخزينة</p>
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
