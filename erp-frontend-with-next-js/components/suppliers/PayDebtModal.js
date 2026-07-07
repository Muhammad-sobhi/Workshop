'use client';

import { X, DollarSign, Smartphone, Building2 } from 'lucide-react';

export default function PayDebtModal({
  showPayDebt,
  payDebtForm,
  payDebtFile,
  payDebtMsg,
  payDebtSaving,
  currency,
  onClose,
  onFormChange,
  onFileChange,
  onSubmit,
}) {
  if (!showPayDebt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تسديد دين">
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <div>
            <h2 className="text-base font-bold text-white">تسديد جزء أو كامل الدين للمورد</h2>
            <p className="text-xs mt-0.5 text-gray-400">المورد: {showPayDebt.name} • إجمالي الدين: {parseFloat(showPayDebt.debt_amount).toFixed(2)} {currency}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-debt-amount" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>مبلغ السداد ({currency}) *</label>
              <input
                id="pay-debt-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={showPayDebt.debt_amount}
                required
                value={payDebtForm.amount}
                onChange={e => onFormChange({ ...payDebtForm, amount: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }}
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="pay-debt-date" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>التاريخ</label>
              <input
                id="pay-debt-date"
                type="date"
                required
                value={payDebtForm.payment_date}
                onChange={e => onFormChange({ ...payDebtForm, payment_date: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>طريقة الدفع *</label>
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
                  onClick={() => onFormChange({ ...payDebtForm, payment_method: m.key })}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                  style={{
                    borderColor: payDebtForm.payment_method === m.key ? '#ECC796' : '#3D3554',
                    background: payDebtForm.payment_method === m.key ? 'rgba(236,199,150,0.15)' : '#231B3D',
                    color: payDebtForm.payment_method === m.key ? '#ECC796' : '#A49EC0',
                  }}
                >
                  <span><m.icon size={16} /></span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="pay-debt-notes" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
            <input
              id="pay-debt-notes"
              type="text"
              value={payDebtForm.notes}
              onChange={e => onFormChange({ ...payDebtForm, notes: e.target.value })}
              placeholder="مثال: دفعة من الحساب"
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }}
            />
          </div>

          <div>
            <label htmlFor="pay-debt-file-input" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>إيصال الدفع (صورة / ملف - اختياري)</label>
            <div
              onClick={() => {
                const el = document.getElementById('pay-debt-file-input');
                if (el) el.click();
              }}
              className="w-full rounded-xl px-4 py-3 text-xs border outline-none cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#A49EC0' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-upload w-4 h-4" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
              </svg>
              <span>{payDebtFile ? payDebtFile.name : 'انقر لرفع صورة الإيصال...'}</span>
            </div>
            <input
              id="pay-debt-file-input"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => onFileChange(e.target.files?.[0] || null)}
            />
          </div>

          {payDebtMsg && (
            <p className={`text-xs text-center py-2 rounded-xl ${payDebtMsg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{payDebtMsg}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={payDebtSaving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {payDebtSaving ? 'جاري الحفظ...' : 'تسجيل السداد'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm border"
              style={{ borderColor: '#3D3554', color: '#A49EC0' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
