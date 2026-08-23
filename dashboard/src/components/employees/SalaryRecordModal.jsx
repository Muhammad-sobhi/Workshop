import { Save } from 'lucide-react';
import Modal from '@/components/employees/ModalShell';

export default function SalaryRecordModal({
  onClose,
  onSubmit,
  salaryForm,
  setSalaryForm,
  selectedEmpId,
  setSelectedEmpId,
  activeEmployees,
  selectedEmployee,
  cycle,
  products,
  onProductChange,
  fileInputKey,
  setReceiptFile,
  salarySaving,
  salaryMsg,
  liveNetSalary,
  fmt,
  inputCls,
  labelCls,
  CYCLE_LABELS,
  PAYMENT_LABELS,
}) {
  return (
    <Modal title="تسجيل دفعة راتب جديدة" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>نوع المعاملة *</label>
            <select
              className={inputCls}
              value={salaryForm.type}
              onChange={e => setSalaryForm(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="salary">راتب / دفعة مستحقات</option>
              <option value="advance">سلفة</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>اختيار الموظف *</label>
            <select
              className={inputCls}
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(e.target.value)}
              required
            >
              <option value="">— اختر الموظف —</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({CYCLE_LABELS[e.salary_cycle] || e.salary_cycle})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>تاريخ الدفع *</label>
            <input
              type="date"
              className={inputCls}
              value={salaryForm.payment_date}
              onChange={e => setSalaryForm(prev => ({ ...prev, payment_date: e.target.value }))}
              required
            />
          </div>
        </div>

        {selectedEmployee && (
          <div className="p-3.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedEmployee.name}</span>
                <span className="text-[#A49EC0]">({CYCLE_LABELS[cycle] || cycle})</span>
              </div>
              {selectedEmployee.balance !== undefined && (
                <div className="mt-1 text-xs flex items-center gap-1.5">
                  <span className="text-[#A49EC0]">الرصيد المستحق في كشف الحساب:</span>
                  <span className="font-black text-[#13DEB9]">{fmt(selectedEmployee.balance)}</span>
                </div>
              )}
            </div>
            {selectedEmployee.balance > 0 && salaryForm.type === 'salary' && (
              <button
                type="button"
                onClick={() => setSalaryForm(prev => ({
                  ...prev,
                  base_salary: selectedEmployee.balance,
                  notes: prev.notes || `صرف كامل الرصيد المستحق في كشف الحساب: ${fmt(selectedEmployee.balance)}`
                }))}
                className="px-3 py-1.5 rounded-lg bg-[#ECC796]/15 border border-[#ECC796]/30 text-[#ECC796] hover:bg-[#ECC796]/25 font-bold text-xs transition-colors self-end sm:self-auto"
              >
                صرف كامل الرصيد ({fmt(selectedEmployee.balance)})
              </button>
            )}
          </div>
        )}

        {/* Date range for auto-calculation */}
        {cycle && cycle !== 'production' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>الفترة من (اختياري)</label>
              <input
                type="date"
                className={inputCls}
                value={salaryForm.start_date}
                onChange={e => setSalaryForm(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>الفترة إلى (اختياري)</label>
              <input
                type="date"
                className={inputCls}
                value={salaryForm.end_date}
                onChange={e => setSalaryForm(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>عدد الأيام (يدوي)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="مثال: 5"
                className={inputCls}
                value={salaryForm.days_worked}
                onChange={e => setSalaryForm(prev => ({ ...prev, days_worked: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* Production fields */}
        {cycle === 'production' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>المنتج</label>
              <select
                className={inputCls}
                value={salaryForm.product_id}
                onChange={e => onProductChange(e.target.value)}
              >
                <option value="">— اختر المنتج —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>كمية الإنتاج</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={salaryForm.production_quantity}
                onChange={e => setSalaryForm(prev => ({ ...prev, production_quantity: e.target.value }))}
                placeholder="العدد"
              />
            </div>
            <div>
              <label className={labelCls}>سعر الوحدة</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={salaryForm.production_rate}
                onChange={e => setSalaryForm(prev => ({ ...prev, production_rate: e.target.value }))}
                placeholder="السعر"
              />
            </div>
          </div>
        )}

        {/* Base Salary & Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>{salaryForm.type === 'advance' ? 'قيمة السلفة *' : 'الراتب الأساسي *'}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={`${inputCls} font-mono font-bold text-[#ECC796]`}
              value={salaryForm.base_salary}
              onChange={e => setSalaryForm(prev => ({ ...prev, base_salary: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={labelCls}>الخصومات (اختياري)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`${inputCls} text-red-400 font-mono`}
              value={salaryForm.deductions}
              onChange={e => setSalaryForm(prev => ({ ...prev, deductions: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={labelCls}>سبب الخصم (اختياري)</label>
            <input
              type="text"
              className={inputCls}
              value={salaryForm.deduction_reason}
              onChange={e => setSalaryForm(prev => ({ ...prev, deduction_reason: e.target.value }))}
              placeholder="غياب / تأخير / تلفيات..."
            />
          </div>
        </div>

        {/* Payment Method & Receipt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>طريقة الدفع *</label>
            <select
              className={inputCls}
              value={salaryForm.payment_method}
              onChange={e => setSalaryForm(prev => ({ ...prev, payment_method: e.target.value }))}
              required
            >
              {Object.entries(PAYMENT_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>إيصال الدفع (اختياري)</label>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*,application/pdf"
              className={`${inputCls} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:bg-[#ECC796] file:text-[#201A30] file:font-bold file:text-xs cursor-pointer`}
              onChange={e => setReceiptFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>ملاحظات</label>
          <textarea
            rows={2}
            className={inputCls}
            value={salaryForm.notes}
            onChange={e => setSalaryForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="أي ملاحظات إضافية..."
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#3D3554]">
          <div className="text-xs font-bold text-[#A49EC0]">
            صافي المستحق للدفعة: <span className="font-mono text-[#ECC796] text-base mr-1">{fmt(liveNetSalary)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={salarySaving || !selectedEmpId}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {salarySaving ? 'جاري الحفظ...' : 'تسجيل الراتب'}
            </button>
          </div>
        </div>

        {salaryMsg && (
          <p className={`text-xs text-center font-bold mt-2 ${salaryMsg.includes('بنجاح') ? 'text-emerald-400' : 'text-red-400'}`}>{salaryMsg}</p>
        )}
      </form>
    </Modal>
  );
}
