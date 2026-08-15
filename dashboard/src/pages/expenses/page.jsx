'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import {
  Plus,
  X,
  DollarSign,
  Calendar,
  Tag,
  Trash2,
  Search,
  Printer,
  Wrench,
  Building2,
  Zap,
  Users,
  Briefcase,
  Layers,
  ReceiptText,
  AlertCircle
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';
import Pagination from '@/components/Pagination';
import AlertDialog from '@/components/AlertDialog';

const EXPENSE_CATEGORIES = [
  'أجور ورواتب العمال',
  'الرواتب والأجور',
  'صيانة آلات ومعدات',
  'كهرباء ومياه ومرافق',
  'المرافق الخدمية',
  'إيجار مستودع',
  'الإيجار والمقرات',
  'مصاريف تغليف وشحن',
  'مصاريف إدارية وعمومية',
  'أخرى',
];

const categoryIcons = {
  'أجور ورواتب العمال': Users,
  'الرواتب والأجور': Users,
  'صيانة آلات ومعدات': Wrench,
  'كهرباء ومياه ومرافق': Zap,
  'المرافق الخدمية': Zap,
  'إيجار مستودع': Building2,
  'الإيجار والمقرات': Building2,
  'مصاريف إدارية وعمومية': Briefcase,
  'أخرى': Tag,
};

export default function ExpensesPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dateFilter, setDateFilter] = useState('this_month'); // 'this_month' | 'last_3_months' | 'all'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [form, setForm] = useState({
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'مصاريف إدارية وعمومية',
    description: '',
    reference_number: '',
    payment_method: 'cash',
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);

  const fetchAll = (p = 1) => {
    setLoading(true);
    apiClient
      .get(`/expenses?page=${p}&per_page=50`)
      .then((res) => {
        const d = res.data;
        const expList = Array.isArray(d) ? d : d?.data ?? [];
        setExpenses(expList);
        setPagination({
          currentPage: Array.isArray(d) ? 1 : d?.current_page ?? 1,
          lastPage: Array.isArray(d) ? 1 : d?.last_page ?? 1,
          total: Array.isArray(d) ? expList.length : d?.total ?? 0,
        });
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = (id, number) => {
    setAlertDialog({
      type: 'confirm',
      message: `هل تريد حذف سند المصروف رقم "${number}"؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/expenses/${id}`);
          fetchAll(page);
        } catch (e) {
          console.error(e);
        }
      },
    });
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await apiClient.post('/expenses', {
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        category: form.category,
        description: form.description || null,
        reference_number: form.reference_number || null,
        payment_method: form.payment_method || 'cash',
      });
      setMsg('تم تسجيل سند المصروف بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false);
        setForm({
          amount: '',
          expense_date: new Date().toISOString().split('T')[0],
          category: 'مصاريف إدارية وعمومية',
          description: '',
          reference_number: '',
          payment_method: 'cash',
        });
        setMsg('');
      }, 1000);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const operatingExpenses = useMemo(() => {
    return expenses.filter(
      (e) =>
        e.category !== 'تسديد ديون موردين' &&
        e.category !== 'تسديد ديون عملاء' &&
        !e.category?.includes('تسديد ديون') &&
        !e.category?.includes('سداد دين') &&
        e.category !== 'خدمات خارجية'
    );
  }, [expenses]);

  // Filtered Expenses
  const filtered = useMemo(() => {
    return operatingExpenses.filter((e) => {
      const expDate = new Date(e.expense_date || e.created_at);
      const now = new Date();

      if (dateFilter === 'this_month') {
        if (expDate.getMonth() !== now.getMonth() || expDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        if (expDate < threeMonthsAgo) {
          return false;
        }
      }

      const matchSearch =
        search.trim() === '' ||
        e.category?.toLowerCase().includes(search.toLowerCase().trim()) ||
        e.description?.toLowerCase().includes(search.toLowerCase().trim()) ||
        e.expense_number?.toLowerCase().includes(search.toLowerCase().trim()) ||
        e.reference_number?.toLowerCase().includes(search.toLowerCase().trim());

      const matchCat = filterCat === 'all' ? true : e.category === filterCat;

      return matchSearch && matchCat;
    });
  }, [operatingExpenses, dateFilter, search, filterCat]);

  // KPI Calculations
  const now = new Date();
  const thisMonthExpenses = operatingExpenses
    .filter((e) => {
      const d = new Date(e.expense_date || e.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const rentExpenses = operatingExpenses
    .filter((e) => e.category?.includes('إيجار') || e.category?.includes('مرافق') || e.category?.includes('كهرباء'))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const maintenanceExpenses = operatingExpenses
    .filter((e) => e.category?.includes('صيانة') || e.category?.includes('تشغيل') || e.category?.includes('تغليف'))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const totalFilteredAmount = filtered.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Print Official Expense Voucher PDF (سند صرف رسمي بالهوية)
  const printExpenseVoucherPdf = (exp) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentSettings = settings || useAppStore.getState?.()?.settings || {};
    const companyName = currentSettings.company_name || 'ورشة الأثاث الحديث';
    const companyPhone = currentSettings.phone || '';
    const companyAddress = currentSettings.address || '';
    const companyTaxId = currentSettings.tax_number || '';
    const companyLogo = currentSettings.logo_path ? getImageUrl(currentSettings.logo_path) : '';
    const invoiceFooter = currentSettings.invoice_footer || 'تم تسجيل واعتماد سند الصرف رسمياً بنظام الورشة';

    const expAmount = parseFloat(exp.amount) || 0;
    const payMethodText = exp.payment_method === 'instapay' ? 'انستاباي' : 
                         exp.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                         exp.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>سند صرف نقدية - ${exp.expense_number}</title>
        <style>
          @media print {
            @page { size: A4; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0F172A; line-height: 1.5; background: #fff; direction: rtl; text-align: right; }
          .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1E1B4B; padding-bottom: 12px; margin-bottom: 15px; }
          .workshop-info h1 { margin: 0; font-size: 20px; font-weight: 900; color: #1E1B4B; }
          .workshop-info p { margin: 2px 0 0 0; font-size: 11px; color: #64748B; font-weight: 500; }
          .doc-info { text-align: left; }
          .doc-info h2 { margin: 0; font-size: 16px; font-weight: 800; color: #EF4444; }
          .doc-info p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; }
          
          .voucher-card { background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 20px; margin-top: 15px; }
          .amount-banner { background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px; }
          .amount-banner span { font-size: 11px; color: #991B1B; font-weight: bold; display: block; }
          .amount-banner h3 { font-size: 24px; font-weight: 900; color: #DC2626; margin: 4px 0 0 0; }
          
          .grid-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .field-box { border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; }
          .field-box label { font-size: 11px; color: #64748B; font-weight: bold; display: block; }
          .field-box p { font-size: 13px; font-weight: 700; color: #0F172A; margin: 4px 0 0 0; }
          
          .footer-box { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 15px; }
          .terms-text { font-size: 10px; color: #475569; margin-bottom: 25px; text-align: center; font-weight: 500; }
          .signatures { display: flex; justify-content: space-between; padding: 0 40px; }
          .sig-box { text-align: center; font-size: 11px; font-weight: bold; color: #334155; }
          .sig-line { width: 140px; border-bottom: 1px dashed #94A3B8; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${companyLogo ? `<img src="${companyLogo}" style="max-height: 55px; max-width: 120px; object-fit: contain;" />` : ''}
            <div class="workshop-info">
              <h1>${companyName}</h1>
              ${companyPhone ? `<p>📞 هاتف: ${companyPhone}</p>` : ''}
              ${companyAddress ? `<p>📍 ${companyAddress}</p>` : ''}
              ${companyTaxId ? `<p>📜 ${companyTaxId}</p>` : ''}
            </div>
          </div>

          <div class="doc-info">
            <h2>سند صرف نقدية (Payment Voucher)</h2>
            <p><strong>رقم السند:</strong> ${exp.expense_number}</p>
            <p><strong>تاريخ الصرف:</strong> ${formatDate(exp.expense_date)}</p>
          </div>
        </div>

        <div class="voucher-card">
          <div class="amount-banner">
            <span>المبلغ المصروف المعتمد</span>
            <h3>${expAmount.toFixed(2)} ${currency}</h3>
          </div>

          <div class="grid-fields">
            <div class="field-box">
              <label>فئة / بند المصروف</label>
              <p>${exp.category}</p>
            </div>

            <div class="field-box">
              <label>وسيلة ومحفظة الصرف</label>
              <p>${payMethodText}</p>
            </div>

            <div class="field-box" style="grid-column: span 2;">
              <label>بيان وتفاصيل المصروف</label>
              <p>${exp.description || 'مصروفات تشغيلية وعمومية للورشة'}</p>
            </div>

            ${exp.reference_number ? `
              <div class="field-box" style="grid-column: span 2;">
                <label>رقم المستند / المرجع الخارجي</label>
                <p>${exp.reference_number}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="footer-box">
          <p class="terms-text">${invoiceFooter}</p>
          
          <div class="signatures">
            <div class="sig-box">
              <span>توقيع المستلم</span>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <span>اعتماد المحاسب / الإدارة</span>
              <div class="sig-line"></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-6 h-6 text-[#ECC796]" />
              <span>المصروفات والتكاليف التشغيلية</span>
            </h1>
            <p className="text-sm mt-1 text-[#A49EC0]">
              تسجيل ومتابعة جميع مصاريف الورشة، الإيجارات، الصيانة، وسندات الصرف
            </p>
          </div>

          <button
            onClick={() => {
              setShowCreate(true);
              setMsg('');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 hover:opacity-90 self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>

        {/* 4 Glowing KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total This Month */}
          <div
            className="rounded-2xl border p-4 shadow-xl flex flex-col justify-between relative overflow-hidden ring-1 ring-red-500/30"
            style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), #2F264C)', borderColor: '#EF4444' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-300">إجمالي المصروفات هذا الشهر</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/20 border border-red-500/40">
                <DollarSign className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-red-400">
              {loading ? '...' : `${thisMonthExpenses.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-red-200/70 mt-1 block">تكاليف الشهر الجاري</span>
          </div>

          {/* Maintenance & Ops */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(236, 199, 150, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">تكلفة التشغيل والصيانة</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#ECC796]/10 border border-[#ECC796]/20">
                <Wrench className="w-4 h-4 text-[#ECC796]" />
              </div>
            </div>
            <h3 className="text-xl font-black text-[#ECC796]">
              {loading ? '...' : `${maintenanceExpenses.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">صيانة المعدات والتغليف</span>
          </div>

          {/* Rent & Utilities */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(141, 126, 200, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">الإيجار والمرافق</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20">
                <Building2 className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white">
              {loading ? '...' : `${rentExpenses.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">إيجار الورشة والكهرباء</span>
          </div>

          {/* Total Records */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(59, 130, 246, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">عدد سندات الصرف</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white">
              {loading ? '...' : operatingExpenses.length} <small className="text-xs font-normal text-[#A49EC0]">سند</small>
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">إجمالي السندات المسجلة</span>
          </div>
        </div>

        {/* Smart Category Filter Pills & Search Bar */}
        <div
          className="rounded-2xl border p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md"
          style={{ background: '#2F264C', borderColor: '#3D3554' }}
        >
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالفئة، الوصف، أو رقم السند..."
              className="w-full rounded-xl py-2 pr-10 pl-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterCat('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterCat === 'all'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
              }`}
            >
              الكل ({operatingExpenses.length})
            </button>

            <button
              onClick={() => setFilterCat('إيجار مستودع')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterCat === 'إيجار مستودع'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-[#231B3D] text-purple-300 hover:bg-purple-500/10 border border-purple-500/30'
              }`}
            >
              إيجار ومرافق
            </button>

            <button
              onClick={() => setFilterCat('صيانة آلات ومعدات')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterCat === 'صيانة آلات ومعدات'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#ECC796] hover:bg-[#ECC796]/10 border border-[#ECC796]/30'
              }`}
            >
              صيانة ومعدات
            </button>

            <button
              onClick={() => setFilterCat('أجور ورواتب العمال')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterCat === 'أجور ورواتب العمال'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#231B3D] text-blue-300 hover:bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              رواتب ونثريات
            </button>
          </div>
        </div>

        {/* Expenses Data Table & Mobile Cards */}
        <div className="rounded-2xl border overflow-hidden shadow-xl" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          {loading ? (
            <div className="text-center py-16 text-xs text-[#A49EC0]">جاري تحميل سندات المصروفات...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#A49EC0]">
              لا توجد مصروفات مطابقة للبحث أو الفلتر المختار
            </div>
          ) : (
            <>
              {/* Mobile Cards View (Zero Horizontal Scrolling) */}
              <div className="block md:hidden divide-y divide-[#3D3554]">
                {filtered.map((exp) => {
                  const amount = parseFloat(exp.amount) || 0;
                  const Icon = categoryIcons[exp.category] || Tag;
                  const payBadge = exp.payment_method === 'instapay' ? 'انستاباي' : 
                                  exp.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                  exp.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي';

                  return (
                    <div key={exp.id} className="p-3.5 space-y-3 bg-[#201A30]">
                      {/* Top row: Voucher Number + Date + Category */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-xs">{exp.expense_number}</span>
                            <span className="text-[10px] text-[#D4CEEB] font-mono">{formatDate(exp.expense_date)}</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#2F264C] text-[#ECC796] border border-[#3D3554] mt-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{exp.category}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => printExpenseVoucherPdf(exp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 transition-all shadow-sm"
                            title="طباعة سند صرف رسمي PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => handleDelete(exp.id, exp.expense_number)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                            title="حذف سند المصروف"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description & Reference */}
                      <div>
                        <p className="text-xs font-medium text-white">{exp.description || 'مصروف عام'}</p>
                        {exp.reference_number && (
                          <span className="text-[10px] text-[#A49EC0] font-mono mt-0.5 block">
                            مرجع: {exp.reference_number}
                          </span>
                        )}
                      </div>

                      {/* Financial info grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3D3554]/60 text-xs">
                        <div className="p-2 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                          <span className="text-[10px] text-[#A49EC0] block">المبلغ المصروف:</span>
                          <p className="font-black text-red-400 text-sm font-mono mt-0.5">
                            -{amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} {currency}
                          </p>
                        </div>

                        <div className="p-2 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                          <span className="text-[10px] text-[#A49EC0] block">طريقة الصرف:</span>
                          <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#231B3D] text-[#D4CEEB] border border-[#3D3554]">
                            {payBadge}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-[#231B3D] text-[#A49EC0]" style={{ borderColor: '#3D3554' }}>
                      <th className="py-3.5 px-4 font-semibold text-right">رقم السند</th>
                      <th className="py-3.5 px-4 font-semibold text-right">التاريخ</th>
                      <th className="py-3.5 px-4 font-semibold text-right">فئة المصروف</th>
                      <th className="py-3.5 px-4 font-semibold text-right">البيان والوصف</th>
                      <th className="py-3.5 px-4 font-semibold text-center">طريقة الصرف</th>
                      <th className="py-3.5 px-4 font-semibold text-center">المبلغ المصروف</th>
                      <th className="py-3.5 px-4 font-semibold text-center">الإجراءات والطباعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((exp) => {
                      const amount = parseFloat(exp.amount) || 0;
                      const Icon = categoryIcons[exp.category] || Tag;
                      const payBadge = exp.payment_method === 'instapay' ? 'انستاباي' : 
                                      exp.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 
                                      exp.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي';

                      return (
                        <tr
                          key={exp.id}
                          className="border-b hover:bg-white/[0.03] transition-colors align-middle"
                          style={{ borderColor: '#3D3554' }}
                        >
                          {/* Voucher Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                            {exp.expense_number}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-[#D4CEEB]">
                            {formatDate(exp.expense_date)}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#231B3D] text-[#ECC796] border border-[#3D3554]">
                              <Icon className="w-3.5 h-3.5" />
                              <span>{exp.category}</span>
                            </span>
                          </td>

                          {/* Description & Reference */}
                          <td className="py-3.5 px-4 max-w-[280px]">
                            <div className="font-semibold text-white truncate">{exp.description || 'مصروف عام'}</div>
                            {exp.reference_number && (
                              <div className="text-[10px] text-[#A49EC0] font-mono mt-0.5">مرجع: {exp.reference_number}</div>
                            )}
                          </td>

                          {/* Payment Method Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#231B3D] text-[#D4CEEB] border border-[#3D3554]">
                              {payBadge}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-center font-black text-sm text-red-400">
                            -{amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} <small className="text-[9px] font-normal">{currency}</small>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => printExpenseVoucherPdf(exp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 transition-all shadow-sm"
                                title="طباعة سند صرف رسمي PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>PDF سند</span>
                              </button>

                              <button
                                onClick={() => handleDelete(exp.id, exp.expense_number)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                                title="حذف سند المصروف"
                                aria-label="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Table Summary Footer */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center px-5 py-3.5 border-t bg-[#231B3D] gap-2" style={{ borderColor: '#3D3554' }}>
              <span className="text-xs font-semibold text-[#A49EC0]">
                {filtered.length} سند صرف مسجل
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A49EC0]">إجمالي المصروفات:</span>
                <strong className="text-red-400 text-sm font-black">
                  -{totalFilteredAmount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} {currency}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Create Expense Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative"
            style={{ background: '#201A30', borderColor: '#3D3554' }}
          >
            <div className="flex items-center justify-between pb-4 border-b mb-5" style={{ borderColor: '#3D3554' }}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#ECC796]" />
                <span>تسجيل سند مصروف جديد</span>
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-[#A49EC0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                    المبلغ المصروف ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="مثال: 500"
                    className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                    تاريخ الصرف *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                    فئة المصروف *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                    وسيلة ومحفظة الصرف
                  </label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                  >
                    <option value="cash">نقدي</option>
                    <option value="instapay">انستاباي</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="bank_transfer">الحساب البنكي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                  بيان وتفاصيل المصروف
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="مثال: فاتورة كهرباء ورشة القص لشهر يوليو"
                  className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">
                  رقم المرجع أو الإيصال الخارجي (اختياري)
                </label>
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                  placeholder="مثال: REC-9842"
                  className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
                />
              </div>

              {msg && (
                <p className={`text-xs font-semibold text-center ${msg.includes('نجاح') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {msg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#3D3554]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#A49EC0] hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ سند المصروف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertDialog && (
        <AlertDialog
          alertDialog={alertDialog}
          onClose={() => setAlertDialog(null)}
        />
      )}
    </MainLayout>
  );
}
