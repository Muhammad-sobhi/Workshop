import { Save } from 'lucide-react';
import Modal from '@/components/employees/ModalShell';

export default function EmployeeFormModal({
  title,
  onClose,
  onSubmit,
  empForm,
  setEmpForm,
  empSaving,
  empMsg,
  inputCls,
  labelCls,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>الاسم *</label>
          <input className={inputCls} value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>رقم الهاتف</label>
            <input className={inputCls} value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>دورة الراتب *</label>
            <select className={inputCls} value={empForm.salary_cycle} onChange={e => setEmpForm({ ...empForm, salary_cycle: e.target.value })}>
              <option value="day">يومي (Daily)</option>
              <option value="few_days">بضعة أيام (Few Days)</option>
              <option value="week">أسبوعي (Weekly)</option>
              <option value="month">شهري (Monthly)</option>
              <option value="production">بالإنتاج (Production)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              {empForm.salary_cycle === 'day' && 'الأجر اليومي *'}
              {empForm.salary_cycle === 'few_days' && 'الأجر اليومي / للفترة *'}
              {empForm.salary_cycle === 'week' && 'الراتب الأسبوعي *'}
              {empForm.salary_cycle === 'month' && 'الراتب الشهري *'}
              {empForm.salary_cycle === 'production' && 'أجر القطعة التلقائي (اختياري)'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={empForm.rate}
              onChange={e => setEmpForm({ ...empForm, rate: e.target.value })}
              required={empForm.salary_cycle !== 'production'}
            />
          </div>
          <div>
            <label className={labelCls}>الحالة</label>
            <select className={inputCls} value={empForm.status} onChange={e => setEmpForm({ ...empForm, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>ملاحظات</label>
          <textarea rows={3} className={inputCls} value={empForm.notes} onChange={e => setEmpForm({ ...empForm, notes: e.target.value })} />
        </div>

        {empMsg && <p className={`text-xs font-bold ${empMsg.includes('بنجاح') ? 'text-emerald-400' : 'text-red-400'}`}>{empMsg}</p>}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all">إلغاء</button>
          <button type="submit" disabled={empSaving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 disabled:opacity-60">
            <Save className="w-4 h-4" /> {empSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
