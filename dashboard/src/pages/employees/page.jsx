'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';
import {
  Users, Search, Plus, Pencil, Trash2, Wallet,
  Receipt, TrendingDown, Save, X, FileText,
  UserCheck, UserX
} from 'lucide-react';
import AlertDialog from '@/components/AlertDialog';

const CYCLE_LABELS = {
  day: 'يومي',
  few_days: 'بضعة أيام',
  month: 'شهري',
  production: 'بالإنتاج',
};

const PAYMENT_LABELS = {
  cash: 'نقدي',
  instapay: 'إنستاباي',
  vodafone_cash: 'فودافون كاش',
  bank_transfer: 'تحويل بنكي',
  postal_transfer: 'تحويل بريد',
};

function round(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }

export default function EmployeesPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empForm, setEmpForm] = useState({
    name: '', phone: '', salary_cycle: 'day', rate: '', status: 'active', notes: '',
  });
  const [empSaving, setEmpSaving] = useState(false);
  const [empMsg, setEmpMsg] = useState('');

  const [activeEmployees, setActiveEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [salaryForm, setSalaryForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    start_date: '',
    end_date: '',
    days_worked: '',
    production_quantity: '',
    production_rate: '',
    base_salary: '',
    deductions: '',
    deduction_reason: '',
    payment_method: 'cash',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryMsg, setSalaryMsg] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);

  const [alertDialog, setAlertDialog] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchEmployees = (p = 1) => {
    setLoading(true);
    apiClient.get(`/employees?page=${p}&per_page=50`)
      .then(res => { setEmployees(res.data?.data ?? []); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchStats = () => {
    apiClient.get('/employees/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  };

  const fetchActiveEmployees = () => {
    apiClient.get('/employees?per_page=500')
      .then(res => {
        const all = res.data?.data ?? [];
        setActiveEmployees(all.filter(e => e.status === 'active'));
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchEmployees();
    fetchStats();
    fetchActiveEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
      fetchHistory(selectedEmpId);
    } else {
      setHistory([]);
    }
  }, [selectedEmpId]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    return employees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || '').includes(search)
    );
  }, [employees, search]);

  const selectedEmployee = activeEmployees.find(e => e.id.toString() === selectedEmpId.toString());
  const cycle = selectedEmployee?.salary_cycle;

  useEffect(() => {
    if (selectedEmployee) {
      setSalaryForm(prev => ({
        ...prev,
        base_salary: '',
        production_rate: selectedEmployee.rate,
        days_worked: '',
        production_quantity: '',
        start_date: '',
        end_date: '',
        deductions: '',
        deduction_reason: '',
      }));
    }
  }, [selectedEmployee]);

  const baseSalaryCalc = useMemo(() => {
    if (cycle === 'production') {
      const qty = parseFloat(salaryForm.production_quantity) || 0;
      const rate = parseFloat(salaryForm.production_rate) || 0;
      return round(qty * rate);
    }
    const rate = selectedEmployee?.rate || 0;
    const days = parseFloat(salaryForm.days_worked) || 0;
    return round(rate * days);
  }, [cycle, salaryForm.production_quantity, salaryForm.production_rate, salaryForm.days_worked, selectedEmployee]);

  const liveBaseSalary = salaryForm.base_salary !== '' ? parseFloat(salaryForm.base_salary) : baseSalaryCalc;
  const liveNetSalary = round(liveBaseSalary - (parseFloat(salaryForm.deductions) || 0));

  const openCreateEmp = () => {
    setEmpForm({ name: '', phone: '', salary_cycle: 'day', rate: '', status: 'active', notes: '' });
    setEditingEmp(null);
    setEmpMsg('');
    setShowEmpModal(true);
  };

  const openEditEmp = (emp) => {
    setEmpForm({
      name: emp.name,
      phone: emp.phone || '',
      salary_cycle: emp.salary_cycle,
      rate: emp.rate,
      status: emp.status,
      notes: emp.notes || '',
    });
    setEditingEmp(emp);
    setEmpMsg('');
    setShowEmpModal(true);
  };

  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    setEmpSaving(true);
    setEmpMsg('');
    const payload = { ...empForm, rate: parseFloat(empForm.rate) || 0 };
    try {
      if (editingEmp) {
        await apiClient.put(`/employees/${editingEmp.id}`, payload);
        setEmpMsg('تم تحديث بيانات الموظف بنجاح');
      } else {
        await apiClient.post('/employees', payload);
        setEmpMsg('تم إضافة الموظف بنجاح');
      }
      fetchEmployees();
      fetchStats();
      fetchActiveEmployees();
      setTimeout(() => { setShowEmpModal(false); setEmpMsg(''); }, 1000);
    } catch (err) {
      console.error(err);
      const eObj = err?.response?.data?.errors;
      const first = eObj ? Object.values(eObj)[0]?.[0] : null;
      setEmpMsg(first || err?.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setEmpSaving(false);
    }
  };

  const confirmDeleteEmp = (emp) => {
    setAlertDialog({
      type: 'confirm',
      message: `هل أنت متأكد من حذف الموظف ${emp.name}؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/employees/${emp.id}`);
          fetchEmployees();
          fetchStats();
          fetchActiveEmployees();
          setAlertDialog(null);
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message || 'لا يمكن حذف الموظف.' });
        }
      }
    });
  };

  const fetchHistory = (empId) => {
    setHistLoading(true);
    apiClient.get(`/employees/${empId}/salaries?per_page=50`)
      .then(res => setHistory(res.data?.data ?? []))
      .catch(err => console.error(err))
      .finally(() => setHistLoading(false));
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setSalaryMsg('يرجى اختيار موظف أولاً');
      return;
    }
    setSalarySaving(true);
    setSalaryMsg('');

    const formData = new FormData();
    formData.append('payment_date', salaryForm.payment_date);
    formData.append('base_salary', liveBaseSalary.toString());
    formData.append('deductions', (parseFloat(salaryForm.deductions) || 0).toString());
    formData.append('deduction_reason', salaryForm.deduction_reason || '');
    formData.append('payment_method', salaryForm.payment_method);
    formData.append('notes', salaryForm.notes || '');

    if (cycle === 'production') {
      formData.append('production_quantity', salaryForm.production_quantity || '0');
      formData.append('production_rate', salaryForm.production_rate || '0');
    } else {
      formData.append('start_date', salaryForm.start_date || '');
      formData.append('end_date', salaryForm.end_date || '');
    }

    if (receiptFile) {
      formData.append('receipt', receiptFile);
    }

    try {
      await apiClient.post(`/employees/${selectedEmpId}/salaries`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSalaryMsg('تم تسجيل دفعة الراتب بنجاح');
      setSalaryForm({
        payment_date: new Date().toISOString().slice(0, 10),
        start_date: '', end_date: '', days_worked: '',
        production_quantity: '', production_rate: selectedEmployee?.rate || '',
        base_salary: '', deductions: '', deduction_reason: '',
        payment_method: 'cash', notes: '',
      });
      setReceiptFile(null);
      fetchHistory(selectedEmpId);
      fetchStats();
      setTimeout(() => setSalaryMsg(''), 1500);
    } catch (err) {
      console.error(err);
      const eObj = err?.response?.data?.errors;
      const first = eObj ? Object.values(eObj)[0]?.[0] : null;
      setSalaryMsg(first || err?.response?.data?.message || 'حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setSalarySaving(false);
    }
  };

  const confirmDeleteSalary = (empId, salaryId) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من حذف سجل الراتب هذا؟',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/employees/${empId}/salaries/${salaryId}`);
          fetchHistory(empId);
          fetchStats();
          setAlertDialog(null);
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message || 'لا يمكن حذف السجل.' });
        }
      }
    });
  };

  const fmt = (n) => `${Number(n || 0).toLocaleString('ar-EG')} ${currency}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white placeholder-[#A49EC0]/60 outline-none focus:border-[#ECC796] transition-all";
  const labelCls = "block text-xs font-bold text-[#A49EC0] mb-1.5";

  return (
    <MainLayout>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-[#ECC796]" />
              الموظفون والرواتب
            </h1>
            <p className="text-xs mt-1 text-[#A49EC0]">
              إدارة بيانات الموظفين وتسجيل دفعات الرواتب والخصومات والمدفوعات
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <KpiCard icon={Users} label="إجمالي الموظفين" value={stats?.total_employees ?? '—'} color="purple" />
          <KpiCard icon={UserCheck} label="نشط" value={stats?.active_employees ?? '—'} color="emerald" />
          <KpiCard icon={Wallet} label="رواتب الشهر" value={stats ? fmt(stats.total_paid_this_month) : '—'} color="gold" sub />
          <KpiCard icon={TrendingDown} label="خصومات الشهر" value={stats ? fmt(stats.total_deductions_this_month) : '—'} color="red" sub />
        </div>

        <div className="flex items-center gap-2 border-b border-[#3D3554]">
          <TabButton active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={Users} label="إدارة الموظفين" />
          <TabButton active={activeTab === 'salaries'} onClick={() => setActiveTab('salaries')} icon={Wallet} label="تسجيل الرواتب والمدفوعات" />
        </div>

        {activeTab === 'employees' ? (
          <EmployeesTab
            loading={loading}
            employees={filteredEmployees}
            search={search}
            setSearch={setSearch}
            onAdd={openCreateEmp}
            onEdit={openEditEmp}
            onDelete={confirmDeleteEmp}
            currency={currency}
            fmt={fmt}
            CYCLE_LABELS={CYCLE_LABELS}
          />
        ) : (
          <SalariesTab
            activeEmployees={activeEmployees}
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            salaryForm={salaryForm}
            setSalaryForm={setSalaryForm}
            receiptFile={receiptFile}
            setReceiptFile={setReceiptFile}
            cycle={cycle}
            liveBaseSalary={liveBaseSalary}
            liveNetSalary={liveNetSalary}
            salarySaving={salarySaving}
            salaryMsg={salaryMsg}
            onSubmit={handleSalarySubmit}
            history={history}
            histLoading={histLoading}
            onDeleteSalary={confirmDeleteSalary}
            onViewReceipt={(path) => setReceiptPreview(path)}
            fmt={fmt}
            fmtDate={fmtDate}
            PAYMENT_LABELS={PAYMENT_LABELS}
            inputCls={inputCls}
            labelCls={labelCls}
            currency={currency}
          />
        )}
      </div>

      {showEmpModal && (
        <Modal title={editingEmp ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'} onClose={() => setShowEmpModal(false)}>
          <form onSubmit={handleEmpSubmit} className="space-y-4">
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
                  <option value="day">يومي</option>
                  <option value="few_days">بضعة أيام</option>
                  <option value="month">شهري</option>
                  <option value="production">بالإنتاج</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>المعدل (الأجر) *</label>
                <input type="number" step="0.01" min="0" className={inputCls} value={empForm.rate} onChange={e => setEmpForm({ ...empForm, rate: e.target.value })} required />
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
              <button type="button" onClick={() => setShowEmpModal(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all">إلغاء</button>
              <button type="submit" disabled={empSaving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 disabled:opacity-60">
                <Save className="w-4 h-4" /> {empSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {receiptPreview && (
        <Modal title="إيصال الدفعة" onClose={() => setReceiptPreview(null)}>
          <div className="space-y-3">
            {/\.(jpg|jpeg|png|webp)$/i.test(receiptPreview) ? (
              <img src={getImageUrl(receiptPreview)} alt="receipt" className="w-full rounded-xl border border-[#3D3554]" />
            ) : (
              <a href={getImageUrl(receiptPreview)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#2F264C] text-[#ECC796] text-xs font-bold border border-[#3D3554] hover:bg-white/5">
                <FileText className="w-4 h-4" /> فتح ملف الإيصال
              </a>
            )}
          </div>
        </Modal>
      )}

      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    gold: 'bg-[#ECC796]/15 text-[#ECC796] border-[#ECC796]/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex items-center justify-between shadow-md">
      <div className={sub ? '' : 'min-w-0'}>
        <span className="text-xs font-bold text-[#A49EC0]">{label}</span>
        <p className="text-xl font-black font-mono text-white mt-1 truncate">{value}</p>
      </div>
      <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px ${
        active
          ? 'border-[#ECC796] text-[#ECC796]'
          : 'border-transparent text-[#A49EC0] hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#3D3554] bg-[#2F264C] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3D3554] sticky top-0 bg-[#2F264C] z-10">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-[#A49EC0] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function EmployeesTab({ loading, employees, search, setSearch, onAdd, onEdit, onDelete, currency, fmt, CYCLE_LABELS }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف أو رقم الهاتف..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white placeholder-[#A49EC0]/60 outline-none focus:border-[#ECC796] transition-all"
          />
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      <div className="rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0] border-b border-[#3D3554]">
                <th className="text-right px-4 py-3 font-bold">الاسم</th>
                <th className="text-right px-4 py-3 font-bold">الهاتف</th>
                <th className="text-right px-4 py-3 font-bold">الدورة</th>
                <th className="text-right px-4 py-3 font-bold">المعدل</th>
                <th className="text-right px-4 py-3 font-bold">الحالة</th>
                <th className="text-right px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-[#A49EC0]">جاري التحميل...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-[#A49EC0]">لا يوجد موظفون</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} className="border-b border-[#3D3554]/60 hover:bg-white/5">
                    <td className="px-4 py-3 font-bold text-white">{emp.name}</td>
                    <td className="px-4 py-3 text-[#A49EC0]">{emp.phone || '—'}</td>
                    <td className="px-4 py-3 text-[#A49EC0]">{CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle}</td>
                    <td className="px-4 py-3 text-white font-mono">{fmt(emp.rate)}</td>
                    <td className="px-4 py-3">
                      {emp.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <UserCheck className="w-3 h-3" /> نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          <UserX className="w-3 h-3" /> غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onEdit(emp)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-[#ECC796] hover:bg-white/10 transition-colors" aria-label="تعديل">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(emp)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors" aria-label="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalariesTab({
  activeEmployees, selectedEmpId, setSelectedEmpId, salaryForm, setSalaryForm,
  receiptFile, setReceiptFile, cycle, liveBaseSalary, liveNetSalary, salarySaving,
  salaryMsg, onSubmit, history, histLoading, onDeleteSalary, onViewReceipt, fmt, fmtDate,
  PAYMENT_LABELS, inputCls, labelCls, currency
}) {
  const set = (field, value) => setSalaryForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-2xl border border-[#3D3554] bg-[#231B3D] p-5 space-y-4 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>اختيار الموظف *</label>
            <select className={inputCls} value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} required>
              <option value="">— اختر موظفاً —</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.salary_cycle})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>تاريخ الدفع</label>
            <input type="date" className={inputCls} value={salaryForm.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
        </div>

        {cycle && cycle !== 'production' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>تاريخ البداية</label>
              <input type="date" className={inputCls} value={salaryForm.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>تاريخ النهاية</label>
              <input type="date" className={inputCls} value={salaryForm.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>عدد أيام العمل</label>
              <input type="number" min="0" step="0.5" className={inputCls} value={salaryForm.days_worked} onChange={e => set('days_worked', e.target.value)} />
            </div>
          </div>
        )}

        {cycle === 'production' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>كمية الإنتاج</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={salaryForm.production_quantity} onChange={e => set('production_quantity', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>سعر الإنتاج للوحدة</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={salaryForm.production_rate} onChange={e => set('production_rate', e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>الراتب الأساسي (محسوب)</label>
            <input
              type="number"
              step="0.01"
              className={`${inputCls} font-mono`}
              value={liveBaseSalary || ''}
              onChange={e => set('base_salary', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>الخصومات</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={salaryForm.deductions} onChange={e => set('deductions', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>سبب الخصم</label>
            <input className={inputCls} value={salaryForm.deduction_reason} onChange={e => set('deduction_reason', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>طريقة الدفع</label>
            <select className={inputCls} value={salaryForm.payment_method} onChange={e => set('payment_method', e.target.value)}>
              {Object.entries(PAYMENT_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>إيصال الدفع (صورة/PDF)</label>
            <input type="file" accept="image/*,application/pdf" className={`${inputCls} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ECC796] file:text-[#201A30] cursor-pointer`} onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>ملاحظات</label>
          <textarea rows={2} className={inputCls} value={salaryForm.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#3D3554]">
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="text-[#A49EC0]">الصافي: <span className="font-mono text-[#ECC796] mr-1">{fmt(liveNetSalary)}</span></span>
          </div>
          <div className="flex items-center gap-2.5">
            {salaryMsg && <span className={`text-xs font-bold ${salaryMsg.includes('بنجاح') ? 'text-emerald-400' : 'text-red-400'}`}>{salaryMsg}</span>}
            <button type="submit" disabled={salarySaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 disabled:opacity-60">
              <Save className="w-4 h-4" /> {salarySaving ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
        <div className="px-5 py-3 border-b border-[#3D3554] flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#ECC796]" />
          <h3 className="text-sm font-bold text-white">سجل دفعات الرواتب</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0] border-b border-[#3D3554]">
                <th className="text-right px-4 py-3 font-bold">التاريخ</th>
                <th className="text-right px-4 py-3 font-bold">الأساسي</th>
                <th className="text-right px-4 py-3 font-bold">خصومات</th>
                <th className="text-right px-4 py-3 font-bold">الصافي</th>
                <th className="text-right px-4 py-3 font-bold">الطريقة</th>
                <th className="text-right px-4 py-3 font-bold">الإيصال</th>
                <th className="text-right px-4 py-3 font-bold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {!selectedEmpId ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#A49EC0]">اختر موظفاً لعرض سجل الرواتب</td></tr>
              ) : histLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#A49EC0]">جاري التحميل...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#A49EC0]">لا توجد دفعات مسجلة</td></tr>
              ) : (
                history.map(s => (
                  <tr key={s.id} className="border-b border-[#3D3554]/60 hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{fmtDate(s.payment_date)}</td>
                    <td className="px-4 py-3 text-white font-mono">{fmt(s.base_salary)}</td>
                    <td className="px-4 py-3 text-red-400 font-mono">{fmt(s.deductions)}</td>
                    <td className="px-4 py-3 text-[#ECC796] font-mono font-bold">{fmt(s.net_salary)}</td>
                    <td className="px-4 py-3 text-[#A49EC0]">{PAYMENT_LABELS[s.payment_method] || s.payment_method}</td>
                    <td className="px-4 py-3">
                      {s.receipt_path ? (
                        <button onClick={() => onViewReceipt(s.receipt_path)} className="inline-flex items-center gap-1 text-[#ECC796] hover:underline">
                          <FileText className="w-3.5 h-3.5" /> عرض
                        </button>
                      ) : <span className="text-[#A49EC0]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDeleteSalary(s.employee_id, s.id)} className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors" aria-label="حذف">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
