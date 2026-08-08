'use client';

import { useState } from 'react';
import { X, DollarSign, Check } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function SettleDebtModal({ isOpen, onClose, supplier, onSuccess }) {
  const [form, setForm] = useState({
    amount: supplier?.debt_amount ? Math.max(0, parseFloat(supplier.debt_amount)).toString() : '',
    payment_method: 'instapay',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_reference: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !supplier) return null;

  const currentDebt = parseFloat(supplier.debt_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.amount || parseFloat(form.amount) <= 0) {
      return setErrorMsg('برجاء إدخال مبلغ صحيح لتسديد الدفعة');
    }

    setLoading(true);
    try {
      await apiClient.post(`/suppliers/${supplier.id}/settle-bulk-debt`, form);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء تسديد الدفعة للمورد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-[#3D3554] bg-[#2F264C] text-white shadow-2xl overflow-hidden">
        
        {/* Sticky Header */}
        <div className="px-4 py-3 border-b border-[#3D3554] bg-[#231B3D] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#ECC796]">تسديد دفعة حساب مجمعة</h2>
            <p className="text-[11px] text-[#A49EC0]">المورد: {supplier.name} {supplier.company ? `(${supplier.company})` : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#2F264C] text-[#A49EC0] hover:text-white hover:bg-white/10 transition-colors border border-[#3D3554]"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Current Debt / Credit Banner */}
            <div className="p-3 rounded-xl bg-[#231B3D] border border-[#3D3554] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#A49EC0]">
                  {currentDebt > 0 ? 'إجمالي الدين المستحق للمورد حالياً' : currentDebt < 0 ? 'رصيد دائن للمورد (مدفوع سابقاً بالزيادة)' : 'حساب المورد متوازن'}
                </p>
                <p className={`text-lg font-bold ${currentDebt > 0 ? 'text-red-400' : currentDebt < 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  EGP {Math.abs(currentDebt).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  {currentDebt < 0 && <span className="text-xs font-normal text-emerald-300 block"> (رصيد دائن)</span>}
                </p>
              </div>
              <div className="text-left text-[11px] text-[#A49EC0]">
                {currentDebt > 0 
                  ? 'سيتم تسديد الديون المستحقة بالأقدمية، وأي زيادة تصبح رصيداً دائناً للمورد'
                  : 'أي مبالغ إضافية يتم دفعها تضاف فوراً لرصيد المورد الدائن لاستخدامها في الطلبيات القادمة'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB] text-[11px]">المبلغ المدفوع (EGP) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB] text-[11px]">طريقة الدفع *</label>
                <select
                  value={form.payment_method}
                  onChange={e => setForm({ ...form, payment_method: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none text-xs"
                  required
                >
                  <option value="instapay">انستا باي Instapay</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="cash">نقداً Cash</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB] text-[11px]">رقم المرجع / العملية</label>
                <input
                  type="text"
                  placeholder="مرجع Instapay"
                  value={form.transaction_reference}
                  onChange={e => setForm({ ...form, transaction_reference: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#D4CEEB] text-[11px]">تاريخ السداد *</label>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm({ ...form, payment_date: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#D4CEEB] text-[11px]">ملاحظات السداد (اختياري)</label>
              <textarea
                rows={1}
                placeholder="تفاصيل الحساب أو اسم المحول..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-white outline-none resize-none text-xs"
              />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="p-3 px-4 border-t border-[#3D3554] bg-[#231B3D] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold border border-[#3D3554] text-[#A49EC0] hover:bg-white/5"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {loading ? 'جاري التسديد...' : 'تأكيد تسديد الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
