'use client';

import { X } from 'lucide-react';

const emptyForm = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '', debt_amount: '', debt_due_date: '' };

const fieldGroups = (activeTab, editing) => [
  { label: activeTab === 'suppliers' ? 'اسم المورد *' : 'اسم العميل *', key: 'name', required: true, col: 'col-span-2' },
  { label: 'المسؤول/جهة الاتصال', key: 'contact_person', required: false },
  { label: 'رقم الهاتف', key: 'phone', required: false },
  { label: 'البريد الإلكتروني', key: 'email', required: false, type: 'email' },
  { label: 'العنوان', key: 'address', required: false },
  ...(editing ? [
    { label: 'مبلغ الدين المستحق (EGP)', key: 'debt_amount', required: false, type: 'number' },
    { label: 'تاريخ استحقاق الدين', key: 'debt_due_date', required: false, type: 'date' },
  ] : []),
];

export default function SupplierClientForm({
  show, activeTab, editing, form, saving, msg,
  onClose, onSubmit, onFormChange,
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing ? 'تعديل بيانات' : 'إضافة جديد'}>
      <div className="w-full max-w-lg rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-lg font-bold text-white">
            {editing
              ? (activeTab === 'suppliers' ? 'تعديل بيانات المورد' : 'تعديل بيانات العميل')
              : (activeTab === 'suppliers' ? 'إضافة مورد جديد' : 'إضافة عميل جديد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fieldGroups(activeTab, editing).map(field => (
              <div key={field.key} className={field.col || ''}>
                <label htmlFor={`supplier-${field.key}`} className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>
                  {field.label}
                </label>
                <input
                  id={`supplier-${field.key}`}
                  type={field.type || 'text'}
                  required={field.required}
                  value={form[field.key]}
                  onChange={e => onFormChange({ ...form, [field.key]: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
                  style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="supplier-notes" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
            <textarea
              id="supplier-notes"
              value={form.notes}
              onChange={e => onFormChange({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none resize-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>
          {msg && (
            <p className={`text-sm text-center py-2 rounded-xl ${msg.includes('نجاح') || msg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {saving ? 'جاري الحفظ...' : (editing ? 'تحديث البيانات' : 'إضافة')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm border"
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
