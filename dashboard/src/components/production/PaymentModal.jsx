'use client';

import { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api-client';
import { X, DollarSign, Smartphone, Building2, Upload } from 'lucide-react';

export default function PaymentModal({ showPayment, setShowPayment, currency, totalPaid, remaining, fetchAll }) {
  const [payForm, setPayForm] = useState({ amount: '', note: '', payment_date: new Date().toISOString().split('T')[0], payment_method: '' });
  const [payFile, setPayFile] = useState(null);
  const [payMsg, setPayMsg] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (showPayment) {
      setPayForm({ amount: '', note: '', payment_date: new Date().toISOString().split('T')[0], payment_method: '' });
      setPayFile(null);
      setPayMsg('');
    }
  }, [showPayment]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!showPayment) return;
    setPaySaving(true); setPayMsg('');
    try {
      const fd = new FormData();
      fd.append('amount', payForm.amount);
      fd.append('note', payForm.note);
      fd.append('payment_date', payForm.payment_date);
      if (payForm.payment_method) fd.append('payment_method', payForm.payment_method);
      if (payFile) fd.append('receipt', payFile);
      await apiClient.post(`/operations/${showPayment.id}/payments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPayMsg('تم تسجيل الدفعة بنجاح');
      fetchAll();
      setTimeout(() => { setShowPayment(null); setPayMsg(''); setPayForm({ amount: '', note: '', payment_date: new Date().toISOString().split('T')[0], payment_method: '' }); setPayFile(null); }, 1200);
    } catch (err) {
      setPayMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally { setPaySaving(false); }
  };

  if (!showPayment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">إضافة دفعة مالية</h2>
            <p className="text-xs mt-0.5" style={{ color: '#A49EC0' }}>أمر: {showPayment.operation_number} • {showPayment.client?.name || 'بدون عميل'}</p>
          </div>
          <button onClick={() => setShowPayment(null)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}><X className="w-5 h-5" /></button>
        </div>

        {showPayment.total_price && (
          <div className="mb-4 p-3 rounded-xl grid grid-cols-3 text-center gap-2" style={{ background: '#231B3D' }}>
            <div>
              <p className="text-xs" style={{ color: '#A49EC0' }}>الإجمالي</p>
              <p className="text-sm font-bold text-white">{currency} {parseFloat(showPayment.total_price).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#A49EC0' }}>المدفوع</p>
              <p className="text-sm font-bold" style={{ color: '#10B981' }}>{currency} {totalPaid(showPayment).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#A49EC0' }}>المتبقي</p>
              <p className="text-sm font-bold" style={{ color: remaining(showPayment) > 0 ? '#EF4444' : '#10B981' }}>{currency} {remaining(showPayment).toFixed(2)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleAddPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>مبلغ الدفعة ({currency}) <span style={{ color: '#ECC796' }}>*</span></label>
              <input type="number" min="0.01" step="0.01" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>تاريخ الدفعة</label>
              <input type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظة الدفعة</label>
            <input type="text" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="مثال: دفعة ثانية - تسليم" className="w-full rounded-xl px-3 py-2 text-sm border outline-none" style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFF' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>طريقة الدفع <span style={{ color: '#ECC796' }}>*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'cash', label: 'كاش / نقدي', Icon: DollarSign },
                { key: 'instapay', label: 'انستاباي', Icon: Smartphone },
                { key: 'vodafone_cash', label: 'فودافون كاش', Icon: Smartphone },
                { key: 'bank_transfer', label: 'تحويل بنكي', Icon: Building2 },
              ].map(m => {
                const IconComp = m.Icon;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPayForm({ ...payForm, payment_method: m.key })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                    style={{
                      borderColor: payForm.payment_method === m.key ? '#ECC796' : '#3D3554',
                      background: payForm.payment_method === m.key ? 'rgba(236,199,150,0.15)' : '#231B3D',
                      color: payForm.payment_method === m.key ? '#ECC796' : '#A49EC0',
                    }}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>إيصال الدفع (صورة)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl px-4 py-3 text-xs border outline-none cursor-pointer flex items-center gap-2 hover:bg-white/5 transition-colors"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#A49EC0' }}
            >
              <Upload className="w-4 h-4" />
              <span>{payFile ? payFile.name : 'انقر لرفع صورة الإيصال...'}</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setPayFile(e.target.files?.[0] || null)} />
          </div>

          {payMsg && <p className={`text-xs text-center py-2 rounded-xl ${payMsg.includes('نجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{payMsg}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={paySaving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}>
              {paySaving ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
            </button>
            <button type="button" onClick={() => setShowPayment(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: '#3D3554', color: '#A49EC0' }}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
