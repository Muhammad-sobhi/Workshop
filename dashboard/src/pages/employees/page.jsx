'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import {
  Users, Wallet,
  TrendingDown, UserCheck, Calendar, Settings, FileSpreadsheet
} from 'lucide-react';
import EmployeesTab from '@/components/employees/EmployeesTab';
import SalariesTab from '@/components/employees/SalariesTab';
import TimesheetTabPanel from '@/components/employees/TimesheetTabPanel';
import ProductionTabPanel from '@/components/employees/ProductionTabPanel';
import EmployeeFormModal from '@/components/employees/EmployeeFormModal';
import SalaryRecordModal from '@/components/employees/SalaryRecordModal';
import ReceiptPreviewModal from '@/components/employees/ReceiptPreviewModal';
import EmployeeLedgerModal from '@/components/employees/EmployeeLedgerModal';
import BulkTimesheetPayoutModal from '@/components/employees/BulkTimesheetPayoutModal';
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
  const [ledgerEmp, setLedgerEmp] = useState(null);
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
    type: 'salary',
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
  const [showBulkPayoutModal, setShowBulkPayoutModal] = useState(false);
  const [bulkWeekStart, setBulkWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

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
  useEffect(() => {
    setReceiptFile(null);
    setFileInputKey(Date.now());
    if (selectedEmployee) {
      const empBalance = Number(selectedEmployee.balance ?? selectedEmployee.outstanding_balance ?? 0);
      const empRate = Number(selectedEmployee.rate ?? 0);

      // If employee is production-based, fetch their latest production log to auto-fill product, quantity, and rate!
      if (selectedEmployee.salary_cycle === 'production') {
        apiClient.get('/employees-production-logs', { params: { employee_id: selectedEmployee.id, per_page: 1 } })
          .then(res => {
            const logs = res.data?.data ?? [];
            if (logs.length > 0) {
              const latest = logs[0];
              const pId = latest.product_id ? latest.product_id.toString() : '';
              const pQty = Number(latest.quantity ?? latest.quantity_produced ?? 0);
              const pRate = Number(latest.piece_rate ?? empRate ?? 0);
              const pTotal = Number(latest.net_wage ?? latest.gross_wage ?? (pQty * pRate));
              const amountToPay = empBalance > 0 ? empBalance : pTotal;

              setSalaryForm(prev => ({
                ...prev,
                type: prev.type || 'salary',
                product_id: pId,
                production_quantity: pQty > 0 ? pQty.toString() : '',
                production_rate: pRate > 0 ? pRate.toString() : (empRate > 0 ? empRate.toString() : ''),
                base_salary: amountToPay > 0 ? amountToPay.toString() : '',
                payment_date: prev.payment_date || getTodayString(),
                payment_method: prev.payment_method || 'cash',
                notes: `صرف مستحقات إنتاج (${pQty} قطعة - ${latest.product?.name || 'منتج'}) للموظف ${selectedEmployee.name}`
              }));
            } else {
              // No logs yet, fallback to rate
              setSalaryForm(prev => ({
                ...prev,
                type: prev.type || 'salary',
                production_rate: empRate > 0 ? empRate.toString() : '',
                base_salary: empBalance > 0 ? empBalance.toString() : (empRate > 0 ? empRate.toString() : ''),
                payment_date: prev.payment_date || getTodayString(),
                payment_method: prev.payment_method || 'cash',
                notes: `صرف مستحقات الموظف (${selectedEmployee.name})`
              }));
            }
          })
          .catch(() => {
            setSalaryForm(prev => ({
              ...prev,
              type: prev.type || 'salary',
              production_rate: empRate > 0 ? empRate.toString() : '',
              base_salary: empBalance > 0 ? empBalance.toString() : (empRate > 0 ? empRate.toString() : ''),
              payment_date: prev.payment_date || getTodayString(),
              payment_method: prev.payment_method || 'cash',
              notes: `صرف مستحقات الموظف (${selectedEmployee.name})`
            }));
          });
      } else {
        const defaultAmount = empBalance > 0 ? empBalance : (empRate > 0 ? empRate : '');
        setSalaryForm(prev => ({
          ...prev,
          type: prev.type || 'salary',
          base_salary: defaultAmount !== '' ? defaultAmount.toString() : '',
          production_rate: empRate > 0 ? empRate.toString() : '',
          product_id: '',
          production_quantity: '',
          payment_date: prev.payment_date || getTodayString(),
          payment_method: prev.payment_method || 'cash',
          notes: (empBalance > 0
            ? `صرف مستحقات الموظف (${selectedEmployee.name}) - رصيد كشف الحساب: ${fmt(empBalance)}`
            : `صرف راتب الموظف (${selectedEmployee.name})`
          )
        }));
      }
    }
  }, [selectedEmpId, selectedEmployee]);

  // Handle product selection in Salary modal
  const handleSalaryProductChange = (productId) => {
    const prod = products.find(p => p.id.toString() === productId.toString());
    const newRate = prod ? (prod.labor_cost || prod.cost_price || selectedEmployee?.rate || 0) : (selectedEmployee?.rate || 0);
    const qty = parseFloat(salaryForm.production_quantity) || 0;

    setSalaryForm(prev => ({
      ...prev,
      product_id: productId,
      production_rate: newRate > 0 ? newRate.toString() : prev.production_rate,
      base_salary: qty > 0 && newRate > 0 ? round(qty * newRate).toString() : prev.base_salary
    }));
  };

  // Auto calculate when dates or production quantities change
  useEffect(() => {
    if (!selectedEmployee) return;
    const rate = parseFloat(selectedEmployee.rate) || 0;

    if (cycle === 'production') {
      const qty = parseFloat(salaryForm.production_quantity) || 0;
      const pRate = parseFloat(salaryForm.production_rate) || rate;
      if (qty > 0 && pRate > 0) {
        setSalaryForm(prev => ({ ...prev, base_salary: round(qty * pRate).toString() }));
      }
    } else if (salaryForm.start_date && salaryForm.end_date) {
      const start = new Date(salaryForm.start_date);
      const end = new Date(salaryForm.end_date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        let calculated = rate;
        if (cycle === 'day' || cycle === 'few_days') calculated = round(rate * diffDays);
        else if (cycle === 'week') calculated = round(rate * (diffDays / 7));
        else if (cycle === 'month') calculated = round(rate * (diffDays / 30));

        setSalaryForm(prev => ({ ...prev, base_salary: calculated.toString() }));
      }
    } else if (salaryForm.days_worked) {
      const days = parseFloat(salaryForm.days_worked) || 0;
      let calculated = rate * days;
      if (cycle === 'week') calculated = round(rate * (days / 7));
      else if (cycle === 'month') calculated = round(rate * (days / 30));
      else calculated = round(rate * days);

      setSalaryForm(prev => ({ ...prev, base_salary: calculated.toString() }));
    }
  }, [cycle, salaryForm.start_date, salaryForm.end_date, salaryForm.production_quantity, salaryForm.production_rate, salaryForm.days_worked]);

  // Open Salary Modal
  const openNewSalaryModal = () => {
    setSelectedEmpId('');
    setReceiptFile(null);
    setFileInputKey(Date.now());
    setSalaryMsg('');
    setSalaryForm({
      type: 'salary',
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

  const liveBaseSalary = parseFloat(salaryForm.base_salary) || 0;
  const liveNetSalary = round(Math.max(0, liveBaseSalary - (parseFloat(salaryForm.deductions) || 0)));

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
      const paymentType = salaryForm.type === 'advance' ? 'advance' : 'salary';
      const baseSalaryNum = parseFloat(salaryForm.base_salary) || 0;

      const fd = new FormData();
      fd.append('payment_date', salaryForm.payment_date || getTodayString());
      if (salaryForm.start_date) fd.append('start_date', salaryForm.start_date);
      if (salaryForm.end_date) fd.append('end_date', salaryForm.end_date);
      fd.append('base_salary', baseSalaryNum);
      if (salaryForm.deductions) fd.append('deductions', salaryForm.deductions);
      if (salaryForm.deduction_reason) fd.append('deduction_reason', salaryForm.deduction_reason);
      fd.append('payment_method', salaryForm.payment_method || 'cash');
      if (salaryForm.notes) fd.append('notes', salaryForm.notes);
      fd.append('type', paymentType);
      if (paymentType === 'advance') {
        fd.append('amount', baseSalaryNum);
      }

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

  const openBulkPayoutModal = () => setShowBulkPayoutModal(true);

  const handleWeeklyBulkPayout = (wStart) => {
    if (wStart) setBulkWeekStart(wStart);
    setShowBulkPayoutModal(true);
  };

  const handleTimesheetSalaryPayout = (data) => {
    setSelectedEmpId(data.employee.id.toString());
    setSalaryForm(prev => ({
      ...prev,
      type: 'salary',
      base_salary: data.net_salary,
      start_date: data.week_start,
      end_date: data.week_end,
      payment_date: getTodayString(),
      payment_method: 'cash',
      notes: `تسوية راتب أسبوع: من ${data.week_start} إلى ${data.week_end}`
    }));
    setShowSalaryModal(true);
  };

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
          <KpiCard icon={FileSpreadsheet} label="مستحقات الموظفين (دين)" value={stats ? fmt(stats.total_employee_debt) : '—'} color="red" sub />
        </div>

        <div className="flex items-center gap-2 border-b border-[#3D3554] overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={Users} label="إدارة الموظفين" />
          <TabButton active={activeTab === 'timesheet'} onClick={() => setActiveTab('timesheet')} icon={Calendar} label="يوميات العمل" />
          <TabButton active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={Settings} label="سجل الإنتاج" />
          <TabButton active={activeTab === 'salaries'} onClick={() => setActiveTab('salaries')} icon={Wallet} label="سجل الرواتب والسلف" />
        </div>

        {activeTab === 'employees' && (
          <EmployeesTab
            loading={loading}
            employees={filteredEmployees}
            search={search}
            setSearch={setSearch}
            onAdd={openCreateEmp}
            onEdit={openEditEmp}
            onDelete={confirmDeleteEmp}
            onOpenLedger={(emp) => setLedgerEmp(emp)}
            currency={currency}
            fmt={fmt}
            CYCLE_LABELS={CYCLE_LABELS}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetTabPanel
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            activeEmployees={activeEmployees}
            selectedEmployee={selectedEmployee}
            products={products}
            inputCls={inputCls}
            onOpenBulkPayout={openBulkPayoutModal}
            onWeeklyBulkPayout={handleWeeklyBulkPayout}
            onSalaryPayout={handleTimesheetSalaryPayout}
          />
        )}

        {activeTab === 'production' && (
          <ProductionTabPanel
            selectedEmpId={selectedEmpId}
            setSelectedEmpId={setSelectedEmpId}
            activeEmployees={activeEmployees}
            selectedEmployee={selectedEmployee}
            products={products}
            inputCls={inputCls}
          />
        )}

        {activeTab === 'salaries' && (
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
        <EmployeeFormModal
          title={editingEmp ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
          onClose={() => setShowEmpModal(false)}
          onSubmit={handleEmpSubmit}
          empForm={empForm}
          setEmpForm={setEmpForm}
          empSaving={empSaving}
          empMsg={empMsg}
          inputCls={inputCls}
          labelCls={labelCls}
        />
      )}

      {/* Record New Salary Modal */}
      {showSalaryModal && (
        <SalaryRecordModal
          onClose={() => setShowSalaryModal(false)}
          onSubmit={handleSalarySubmit}
          salaryForm={salaryForm}
          setSalaryForm={setSalaryForm}
          selectedEmpId={selectedEmpId}
          setSelectedEmpId={setSelectedEmpId}
          activeEmployees={activeEmployees}
          selectedEmployee={selectedEmployee}
          cycle={cycle}
          products={products}
          onProductChange={handleSalaryProductChange}
          fileInputKey={fileInputKey}
          setReceiptFile={setReceiptFile}
          salarySaving={salarySaving}
          salaryMsg={salaryMsg}
          liveNetSalary={liveNetSalary}
          fmt={fmt}
          inputCls={inputCls}
          labelCls={labelCls}
          CYCLE_LABELS={CYCLE_LABELS}
          PAYMENT_LABELS={PAYMENT_LABELS}
        />
      )}

      {/* Receipt Image/PDF Preview Modal */}
      {receiptPreview && (
        <ReceiptPreviewModal path={receiptPreview} onClose={() => setReceiptPreview(null)} />
      )}

      <EmployeeLedgerModal isOpen={!!ledgerEmp} employee={ledgerEmp} onClose={() => setLedgerEmp(null)} />
      <BulkTimesheetPayoutModal
        isOpen={showBulkPayoutModal}
        onClose={() => setShowBulkPayoutModal(false)}
        weekStart={bulkWeekStart}
        onSuccess={() => {
          fetchEmployees();
          fetchStats();
          fetchActiveEmployees();
        }}
      />
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
