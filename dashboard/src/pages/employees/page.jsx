'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';
import {
  Users, Search, Plus, Pencil, Trash2, Wallet,
  Receipt, TrendingDown, Save, X, FileText,
  UserCheck, UserX, RefreshCw
} from 'lucide-react';
import AlertDialog from '@/components/AlertDialog';

const CYCLE_LABELS = {
  day: 'يومي',
  few_days: 'بضعة أيام',
  week: 'أسبوعي',
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

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EmployeesPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Employee Modal (Create/Edit)
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empForm, setEmpForm] = useState({
    name: '', phone: '', salary_cycle: 'day', rate: '', status: 'active', notes: '',
  });
  const [empSaving, setEmpSaving] = useState(false);
  const [empMsg, setEmpMsg] = useState('');

  // Active employees for salary selection
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [products, setProducts] = useState([]);

  // Salaries Tab state & filters
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [filterEmpId, setFilterEmpId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // New Salary Modal state
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [salaryForm, setSalaryForm] = useState({
    payment_date: getTodayString(),
    start_date: '',
    end_date: '',
    days_worked: '',
    production_quantity: '',
    production_rate: '',
    product_id: '',
    base_salary: '',
    deductions: '',
    deduction_reason: '',
    payment_method: 'cash',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryMsg, setSalaryMsg] = useState('');

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

  const fetchHistory = () => {
    setHistLoading(true);
    apiClient.get('/employees-salaries', {
      params: {
        employee_id: filterEmpId || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        per_page: 50
      }
    })
      .then(res => setHistory(res.data?.data ?? []))
      .catch(err => console.error(err))
      .finally(() => setHistLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
    fetchStats();
    fetchActiveEmployees();
    apiClient.get('/products?all=1')
      .then(res => setProducts(res.data?.data ?? res.data ?? []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (activeTab === 'salaries') {
      fetchHistory();
    }
  }, [filterEmpId, filterDateFrom, filterDateTo, activeTab]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    return employees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || '').includes(search)
    );
  }, [employees, search]);

  const selectedEmployee = useMemo(() => {
    return activeEmployees.find(e => e.id.toString() === selectedEmpId.toString()) || null;
  }, [activeEmployees, selectedEmpId]);

  const cycle = selectedEmployee?.salary_cycle;

  // Whenever selected employee changes in Salary Modal:
  // Reset receipt and initialize rates/dates/product_id
  useEffect(() => {
    setReceiptFile(null);
    setFileInputKey(Date.now());
    if (selectedEmployee) {
      setSalaryForm(prev => ({
        ...prev,
        base_salary: '',
        product_id: '',
        production_rate: selectedEmployee.rate || '',
        days_worked: '',
        production_quantity: '',
        start_date: '',
        end_date: '',
        deductions: '',
        deduction_reason: '',
      }));
    }
  }, [selectedEmpId, selectedEmployee]);

  // Open Salary Modal
  const openNewSalaryModal = () => {
    setSelectedEmpId('');
    setReceiptFile(null);
    setFileInputKey(Date.now());
    setSalaryMsg('');
    setSalaryForm({
      payment_date: getTodayString(),
      start_date: '',
      end_date: '',
      days_worked: '',
      production_quantity: '',
      production_rate: '',
      product_id: '',
      base_salary: '',
      deductions: '',
      deduction_reason: '',
      payment_method: 'cash',
      notes: '',
    });
    setShowSalaryModal(true);
  };

  // Auto calculate salary based on dates or quantities
  const baseSalaryCalc = useMemo(() => {
    if (!selectedEmployee) return 0;
    const rate = parseFloat(selectedEmployee.rate) || 0;

    if (cycle === 'production') {
      const qty = parseFloat(salaryForm.production_quantity) || 0;
      const pRate = parseFloat(salaryForm.production_rate) || 0;
      return round(qty * pRate);
    }

    if (salaryForm.start_date && salaryForm.end_date) {
      const start = new Date(salaryForm.start_date);
      const end = new Date(salaryForm.end_date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (cycle === 'day' || cycle === 'few_days') {
          return round(rate * diffDays);
        }
        if (cycle === 'week') {
          return round(rate * (diffDays / 7));
        }
        if (cycle === 'month') {
          return round(rate * (diffDays / 30));
        }
      }
    }

    if (salaryForm.days_worked) {
      const days = parseFloat(salaryForm.days_worked) || 0;
      if (cycle === 'week') return round(rate * (days / 7));
      if (cycle === 'month') return round(rate * (days / 30));
      return round(rate * days);
    }

    return round(rate);
  }, [cycle, salaryForm.start_date, salaryForm.end_date, salaryForm.production_quantity, salaryForm.production_rate, salaryForm.days_worked, selectedEmployee]);

  const liveBaseSalary = salaryForm.base_salary !== '' ? parseFloat(salaryForm.base_salary) : baseSalaryCalc;
  const liveNetSalary = round(Math.max(0, (liveBaseSalary || 0) - (parseFloat(salaryForm.deductions) || 0)));

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

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setSalaryMsg('يرجى اختيار الموظف أولاً');
      return;
    }
    setSalarySaving(true);
    setSalaryMsg('');

    try {
      const fd = new FormData();
      fd.append('payment_date', salaryForm.payment_date);
      if (salaryForm.start_date) fd.append('start_date', salaryForm.start_date);
      if (salaryForm.end_date) fd.append('end_date', salaryForm.end_date);
      fd.append('base_salary', liveBaseSalary);
      if (salaryForm.deductions) fd.append('deductions', salaryForm.deductions);
      if (salaryForm.deduction_reason) fd.append('deduction_reason', salaryForm.deduction_reason);
      fd.append('payment_method', salaryForm.payment_method);
      if (salaryForm.notes) fd.append('notes', salaryForm.notes);

      if (cycle === 'production') {
        if (salaryForm.production_quantity) fd.append('production_quantity', salaryForm.production_quantity);
        if (salaryForm.production_rate) fd.append('production_rate', salaryForm.production_rate);
        if (salaryForm.product_id) fd.append('product_id', salaryForm.product_id);
      }

      if (receiptFile) {
        fd.append('receipt', receiptFile);
      }

      await apiClient.post(`/employees/${selectedEmpId}/salaries`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSalaryMsg('تم تسجيل دفعة الراتب بنجاح');
      setReceiptFile(null);
      setFileInputKey(Date.now());
      fetchHistory();
      fetchStats();
      setTimeout(() => {
        setShowSalaryModal(false);
        setSalaryMsg('');
      }, 1000);
    } catch (err) {
      console.error(err);
      const eObj = err?.response?.data?.errors;
      const first = eObj ? Object.values(eObj)[0]?.[0] : null;
      setSalaryMsg(first || err?.response?.data?.message || 'حدث خطأ أثناء حفظ الدفعة');
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
          fetchHistory();
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

        <div className="flex items-center gap-2 border-b border-[#3D3554] overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={Users} label="إدارة الموظفين" />
          <TabButton active={activeTab === 'salaries'} onClick={() => setActiveTab('salaries')} icon={Wallet} label="سجل دفعات الرواتب" />
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
            history={history}
            histLoading={histLoading}
            filterEmpId={filterEmpId}
            setFilterEmpId={setFilterEmpId}
            filterDateFrom={filterDateFrom}
            setFilterDateFrom={setFilterDateFrom}
            filterDateTo={filterDateTo}
            setFilterDateTo={setFilterDateTo}
            onOpenNewSalary={openNewSalaryModal}
            onDeleteSalary={confirmDeleteSalary}
            onViewReceipt={(path) => setReceiptPreview(path)}
            fmt={fmt}
            fmtDate={fmtDate}
            PAYMENT_LABELS={PAYMENT_LABELS}
            CYCLE_LABELS={CYCLE_LABELS}
            inputCls={inputCls}
            currency={currency}
          />
        )}
      </div>

      {/* Employee Create / Edit Modal */}
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
              <button type="button" onClick={() => setShowEmpModal(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all">إلغاء</button>
              <button type="submit" disabled={empSaving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 disabled:opacity-60">
                <Save className="w-4 h-4" /> {empSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record New Salary Modal */}
      {showSalaryModal && (
        <Modal title="تسجيل دفعة راتب جديدة" onClose={() => setShowSalaryModal(false)}>
          <form onSubmit={handleSalarySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="p-3 rounded-xl bg-[#231B3D] border border-[#3D3554] text-xs text-[#A49EC0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-white">{selectedEmployee.name}</span>
                  <span className="mr-2">({CYCLE_LABELS[cycle] || cycle})</span>
                </div>
                {cycle !== 'production' && (
                  <div className="font-mono text-[#ECC796] font-bold">
                    المعدل: {fmt(selectedEmployee.rate)}
                  </div>
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
                    onChange={e => setSalaryForm(prev => ({ ...prev, product_id: e.target.value }))}
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
                <label className={labelCls}>الراتب الأساسي *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputCls} font-mono font-bold text-[#ECC796]`}
                  value={liveBaseSalary || ''}
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
                  onClick={() => setShowSalaryModal(false)}
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
      )}

      {/* Receipt Image/PDF Preview Modal */}
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
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
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
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* Mobile Cards View (hidden on md and larger) */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          <div className="text-center py-10 text-xs text-[#A49EC0]">جاري التحميل...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#A49EC0]">لا يوجد موظفون مطابقة للبحث</div>
        ) : (
          employees.map(emp => (
            <div key={`m-emp-${emp.id}`} className="rounded-2xl border border-[#3D3554] bg-[#231B3D] p-4 shadow-md space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-black text-sm text-white">{emp.name}</h4>
                  <p className="text-xs text-[#A49EC0] mt-0.5" dir="ltr">{emp.phone || '—'}</p>
                </div>
                {emp.status === 'active' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <UserCheck className="w-3 h-3" /> نشط
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                    <UserX className="w-3 h-3" /> غير نشط
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                  <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">دورة الراتب</span>
                  <span className="font-bold text-white">{CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                  <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الراتب الأساسي / المعدل</span>
                  <span className="font-black font-mono text-[#ECC796]">{fmt(emp.rate)}</span>
                </div>
              </div>

              {emp.notes && (
                <p className="text-[11px] text-[#A49EC0] bg-[#1E1735]/40 p-2 rounded-lg border border-[#3D3554]/40">
                  {emp.notes}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3D3554]/60">
                <button
                  onClick={() => onEdit(emp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-[#ECC796] text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => onDelete(emp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
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
                    <td className="px-4 py-3 text-[#A49EC0]" dir="ltr">{emp.phone || '—'}</td>
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
  activeEmployees,
  history,
  histLoading,
  filterEmpId,
  setFilterEmpId,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  onOpenNewSalary,
  onDeleteSalary,
  onViewReceipt,
  fmt,
  fmtDate,
  PAYMENT_LABELS,
  CYCLE_LABELS,
  inputCls,
  currency,
}) {
  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#231B3D] p-4 rounded-2xl border border-[#3D3554]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-2xl">
          <div>
            <select
              className={inputCls}
              value={filterEmpId}
              onChange={e => setFilterEmpId(e.target.value)}
            >
              <option value="">كل الموظفين</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              className={inputCls}
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              title="من تاريخ"
            />
          </div>
          <div>
            <input
              type="date"
              className={inputCls}
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              title="إلى تاريخ"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(filterEmpId || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterEmpId(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="px-3 py-2.5 rounded-xl text-xs font-bold bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          )}

          <button
            onClick={onOpenNewSalary}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20"
          >
            <Receipt className="w-4 h-4" />
            <span>تسجيل راتب جديد</span>
          </button>
        </div>
      </div>

      {/* Mobile Cards (Shown on mobile screens) */}
      <div className="flex flex-col gap-3 md:hidden">
        {histLoading ? (
          <div className="text-center py-12 text-xs text-[#A49EC0]">جاري تحميل سجلات الرواتب...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-xs text-[#A49EC0]">لا توجد دفعات رواتب مسجلة تطابق معايير البحث</div>
        ) : (
          history.map(s => {
            const emp = s.employee;
            const empName = emp?.name || `موظف #${s.employee_id}`;
            const empPhone = emp?.phone || '—';
            const empCycle = emp?.salary_cycle ? (CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle) : '—';
            const empRate = emp?.rate != null ? fmt(emp.rate) : '—';
            const empStatus = emp?.status || 'active';

            return (
              <div key={`m-salary-${s.id}`} className="rounded-2xl border border-[#3D3554] bg-[#231B3D] p-4 shadow-md space-y-3">
                {/* Header: 1- Employee Name + 6- Status */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-sm text-white">{empName}</h4>
                    <p className="text-xs text-[#A49EC0] mt-0.5" dir="ltr">{empPhone}</p>
                  </div>
                  {empStatus === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <UserCheck className="w-3 h-3" /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                      <UserX className="w-3 h-3" /> غير نشط
                    </span>
                  )}
                </div>

                {/* Grid: 3- Cycle, 4- Basic Salary, 5- Paid Salary */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                    <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الدورة</span>
                    <span className="font-bold text-white truncate block">{empCycle}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#2F264C]/70 border border-[#3D3554]/60">
                    <span className="text-[10px] font-bold text-[#A49EC0] block mb-0.5">الأساسي المسجل</span>
                    <span className="font-bold font-mono text-white truncate block">{empRate}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#ECC796]/10 border border-[#ECC796]/30">
                    <span className="text-[10px] font-bold text-[#ECC796] block mb-0.5">المدفوع بالمعاملة</span>
                    <span className="font-black font-mono text-[#ECC796] truncate block">{fmt(s.net_salary)}</span>
                  </div>
                </div>

                {/* Additional transaction details */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A49EC0] bg-[#1E1735]/40 p-2.5 rounded-xl border border-[#3D3554]/40">
                  <div>
                    <span>تاريخ الدفع: <strong className="text-white">{fmtDate(s.payment_date)}</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#2F264C] text-white text-[10px] font-bold border border-[#3D3554]">
                    {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                  </span>
                </div>

                {s.product && (
                  <p className="text-[11px] text-gray-300 bg-[#2F264C]/40 p-2 rounded-lg border border-[#3D3554]/40">
                    المنتج: <strong className="text-white">{s.product.name}</strong> {s.production_quantity ? `(${s.production_quantity} قطعة)` : ''}
                  </p>
                )}

                {parseFloat(s.deductions) > 0 && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    خصومات: {fmt(s.deductions)} {s.deduction_reason ? `(${s.deduction_reason})` : ''}
                  </p>
                )}

                {s.notes && (
                  <p className="text-[11px] text-[#A49EC0]">
                    ملاحظات: {s.notes}
                  </p>
                )}

                {/* 7- Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#3D3554]/60">
                  <div>
                    {s.receipt_path ? (
                      <button
                        onClick={() => onViewReceipt(s.receipt_path)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F264C] text-[#ECC796] hover:bg-white/10 text-xs font-bold border border-[#3D3554]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>عرض الإيصال</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#A49EC0]/50">بدون إيصال</span>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteSalary(s.employee_id, s.id)}
                    className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="حذف الدفعة"
                    title="حذف الدفعة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (Hidden on mobile screens) */}
      <div className="hidden md:block rounded-2xl border border-[#3D3554] bg-[#231B3D] overflow-hidden shadow-md">
        <div className="px-5 py-3.5 border-b border-[#3D3554] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#ECC796]" />
            <h3 className="text-xs font-black text-white">سجل دفعات الرواتب المسجلة</h3>
          </div>
          <span className="text-[11px] text-[#A49EC0]">
            إجمالي السجلات: {history.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0] border-b border-[#3D3554] bg-[#1E1735]/50">
                <th className="text-right px-4 py-3 font-bold">اسم الموظف</th>
                <th className="text-right px-4 py-3 font-bold">رقم الهاتف</th>
                <th className="text-right px-4 py-3 font-bold">دورة الراتب</th>
                <th className="text-right px-4 py-3 font-bold">الراتب الأساسي المسجل</th>
                <th className="text-right px-4 py-3 font-bold">المدفوع في المعاملة</th>
                <th className="text-right px-4 py-3 font-bold">الحالة</th>
                <th className="text-right px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A49EC0]">
                    جاري تحميل سجلات الرواتب...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A49EC0]">
                    لا توجد دفعات رواتب مسجلة تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                history.map(s => {
                  const emp = s.employee;
                  const empName = emp?.name || `موظف #${s.employee_id}`;
                  const empPhone = emp?.phone || '—';
                  const empCycle = emp?.salary_cycle ? (CYCLE_LABELS[emp.salary_cycle] || emp.salary_cycle) : '—';
                  const empRate = emp?.rate != null ? fmt(emp.rate) : '—';
                  const empStatus = emp?.status || 'active';

                  return (
                    <tr key={s.id} className="border-b border-[#3D3554]/60 hover:bg-white/5 transition-colors">
                      {/* 1- Employee Name */}
                      <td className="px-4 py-3 font-bold text-white">
                        <div>
                          <span>{empName}</span>
                          <span className="text-[10px] text-[#A49EC0] block mt-0.5">
                            {fmtDate(s.payment_date)} • {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                          </span>
                        </div>
                      </td>

                      {/* 2- Phone */}
                      <td className="px-4 py-3 text-[#A49EC0]" dir="ltr">
                        {empPhone}
                      </td>

                      {/* 3- Salary Cycle */}
                      <td className="px-4 py-3 text-white font-medium">
                        {empCycle}
                      </td>

                      {/* 4- Basic Salary */}
                      <td className="px-4 py-3 text-white font-mono">
                        {empRate}
                      </td>

                      {/* 5- Paid Salary (Net in this transaction) */}
                      <td className="px-4 py-3 text-[#ECC796] font-mono font-bold">
                        <div>
                          <span>{fmt(s.net_salary)}</span>
                          {parseFloat(s.deductions) > 0 && (
                            <span className="text-[10px] text-red-400 block font-normal">
                              خصم: {fmt(s.deductions)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6- Status */}
                      <td className="px-4 py-3">
                        {empStatus === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <UserCheck className="w-3 h-3" /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <UserX className="w-3 h-3" /> غير نشط
                          </span>
                        )}
                      </td>

                      {/* 7- Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {s.receipt_path ? (
                            <button
                              onClick={() => onViewReceipt(s.receipt_path)}
                              className="inline-flex items-center gap-1 text-[#ECC796] hover:underline font-bold"
                              title="عرض الإيصال"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>إيصال</span>
                            </button>
                          ) : (
                            <span className="text-[#A49EC0]/40">—</span>
                          )}

                          <button
                            onClick={() => onDeleteSalary(s.employee_id, s.id)}
                            className="p-1.5 rounded-lg bg-[#2F264C] border border-[#3D3554] text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="حذف الدفعة"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
