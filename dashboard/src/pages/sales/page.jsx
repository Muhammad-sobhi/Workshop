'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import {
  Plus,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Search,
  Package,
  History,
  Info,
  Printer,
  Calendar,
  Layers,
  ArrowUpRight,
  Receipt
} from 'lucide-react';
import Pagination from '@/components/Pagination';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { getImageUrl } from '@/lib/config';
import HistoricalSaleModal from '@/components/sales/HistoricalSaleModal';
import CreateSalesInvoiceModal from '@/components/sales/CreateSalesInvoiceModal';

export default function SalesPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'this_month' | 'last_3_months' | 'all'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/sales?page=${p}&per_page=50`),
      apiClient.get('/clients?all=true'),
      apiClient.get('/products?all=true'),
    ])
      .then(([salesRes, clientsRes, prodRes]) => {
        const d = salesRes.data;
        const salesList = Array.isArray(d) ? d : (d?.data ?? []);
        setSales(salesList);
        setPagination({
          currentPage: Array.isArray(d) ? 1 : (d?.current_page ?? 1),
          lastPage: Array.isArray(d) ? 1 : (d?.last_page ?? 1),
          total: Array.isArray(d) ? salesList.length : (d?.total ?? 0),
        });
        setClients(clientsRes.data?.data ?? clientsRes.data ?? []);
        setProducts(prodRes.data?.data ?? prodRes.data ?? []);
      })
      .finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Filtered Sales
  const filtered = useMemo(() => {
    return sales.filter((s) => {
      const saleDate = new Date(s.invoice_date || s.revenue_date || s.created_at);
      const now = new Date();

      if (dateFilter === 'this_month') {
        if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'last_3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        if (saleDate < threeMonthsAgo) {
          return false;
        }
      }

      if (search.trim()) {
        const num = (s.invoice_number || s.revenue_number || '').toLowerCase();
        const desc = (s.description || '').toLowerCase();
        const cat = (s.category || '').toLowerCase();
        const client = (s.client_name || '').toLowerCase();
        const q = search.toLowerCase().trim();
        return num.includes(q) || desc.includes(q) || cat.includes(q) || client.includes(q);
      }

      return true;
    });
  }, [sales, dateFilter, search]);

  const totalSales = filtered.reduce((s, x) => s + (parseFloat(x.amount || x.total_amount) || 0), 0);
  const totalCogs = filtered.reduce((s, x) => s + (parseFloat(x.cogs || x.product_cost) || 0), 0);
  const totalGrossProfit = totalSales - totalCogs;
  const avgSale = filtered.length > 0 ? totalSales / filtered.length : 0;
  const profitMarginPercent = totalSales > 0 ? ((totalGrossProfit / totalSales) * 100).toFixed(1) : 0;

  // Print Official Branded Sales Invoice
  const printSalesInvoicePdf = (sale) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentSettings = settings || useAppStore.getState?.()?.settings || {};
    const companyName = currentSettings.company_name || 'ورشة الأثاث الحديث';
    const companyPhone = currentSettings.phone || '';
    const companyAddress = currentSettings.address || '';
    const companyTaxId = currentSettings.tax_number || '';
    const companyLogo = currentSettings.logo_path ? getImageUrl(currentSettings.logo_path) : '';
    const invoiceFooter = currentSettings.invoice_footer || 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة ضد عيوب الصناعة';

    const invNo = sale.invoice_number || sale.revenue_number || `INV-${sale.id}`;
    const invDate = sale.invoice_date || sale.revenue_date || (sale.created_at ? sale.created_at.substring(0, 10) : new Date().toLocaleDateString('ar-EG'));
    const totalAmount = parseFloat(sale.total_amount ?? sale.amount) || 0;
    const paidAmount = parseFloat(sale.paid_amount !== undefined ? sale.paid_amount : totalAmount) || 0;
    const remainingAmount = parseFloat(sale.remaining_amount !== undefined ? sale.remaining_amount : Math.max(0, totalAmount - paidAmount)) || 0;
    const items = sale.items || [];
    const statusLabel = sale.payment_status_label || (remainingAmount <= 0 ? 'مسددة وخالصة بالكامل' : (paidAmount > 0 ? 'مسددة جزئياً (متبقي دين على العميل)' : 'غير مسددة (دين آجل)'));

    let itemsRowsHtml = '';
    if (items.length > 0) {
      items.forEach((itm, idx) => {
        const qty = parseFloat(itm.quantity) || 1;
        const uPrice = parseFloat(itm.unit_sale_price || itm.unit_price) || (totalAmount / qty);
        const tPrice = parseFloat(itm.total_sale_price || itm.total_price) || (qty * uPrice);

        itemsRowsHtml += `
          <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
            <td style="padding: 9px 12px; text-align: center; color: #64748B; width: 8%;">${idx + 1}</td>
            <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #0F172A; width: 42%;">${itm.product_name || itm.product?.name || 'منتج'}</td>
            <td style="padding: 9px 12px; text-align: center; font-weight: bold; color: #1E1B4B; width: 16%;">${qty} ${itm.unit || 'وحدة'}</td>
            <td style="padding: 9px 12px; text-align: center; color: #475569; width: 17%;">${uPrice.toFixed(2)} ${currency}</td>
            <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #15803D; width: 17%;">+${tPrice.toFixed(2)} ${currency}</td>
          </tr>
        `;
      });
    } else {
      itemsRowsHtml = `
        <tr style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; font-size: 11px;">
          <td style="padding: 9px 12px; text-align: center; color: #64748B; width: 8%;">1</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #0F172A; width: 42%;">${sale.description || 'مبيعات منتجات جاهزة'}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: bold; color: #1E1B4B; width: 16%;">1 شحنة</td>
          <td style="padding: 9px 12px; text-align: center; color: #475569; width: 17%;">${totalAmount.toFixed(2)} ${currency}</td>
          <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #15803D; width: 17%;">+${totalAmount.toFixed(2)} ${currency}</td>
        </tr>
      `;
    }

    const payMethodText = sale.payment_method === 'instapay' ? 'انستاباي' :
      sale.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
        sale.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
          sale.payment_method === 'postal_transfer' ? 'حوالة بريدية' : 'نقدي';

    const paymentsList = (sale.payments && sale.payments.length > 0) ? sale.payments : [];
    let paymentsRowsHtml = '';
    if (paymentsList.length > 0) {
      paymentsRowsHtml = paymentsList.map((p, idx) => {
        const pDate = p.payment_date ? formatDate(p.payment_date) : '-';
        const pMethod = p.payment_method === 'cash' ? 'نقدي' :
          p.payment_method === 'instapay' ? 'انستاباي' :
            p.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
              p.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                p.payment_method === 'postal_transfer' ? 'حوالة بريدية' : p.payment_method || 'نقدي';
        const pDesc = p.notes || (idx === 0 ? 'دفعة عربون مقدم' : 'سداد دفعة من الحساب');
        return `
          <tr style="background-color: #F0FDF4; border-bottom: 1px dashed #BBF7D0; font-size: 10.5px;">
            <td style="padding: 6px 10px; text-align: center; color: #166534; font-weight: bold; width: 18%;">${pDate}</td>
            <td style="padding: 6px 10px; text-align: right; color: #166534; width: 42%;">${pDesc}</td>
            <td style="padding: 6px 10px; text-align: center; color: #166534; width: 20%;">${pMethod}</td>
            <td style="padding: 6px 10px; text-align: center; color: #15803D; font-weight: 900; width: 20%; font-size: 11.5px;">-${parseFloat(p.amount).toFixed(2)} ${currency}</td>
          </tr>
        `;
      }).join('');
    } else if (paidAmount > 0) {
      paymentsRowsHtml = `
        <tr style="background-color: #F0FDF4; border-bottom: 1px dashed #BBF7D0; font-size: 10.5px;">
          <td style="padding: 6px 10px; text-align: center; color: #166534; font-weight: bold; width: 18%;">${formatDate(invDate)}</td>
          <td style="padding: 6px 10px; text-align: right; color: #166534; width: 42%;">دفعة عربون مسددة عند الإصدار</td>
          <td style="padding: 6px 10px; text-align: center; color: #166534; width: 20%;">${payMethodText}</td>
          <td style="padding: 6px 10px; text-align: center; color: #15803D; font-weight: 900; width: 20%; font-size: 11.5px;">-${paidAmount.toFixed(2)} ${currency}</td>
        </tr>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة مبيعات - ${invNo}</title>
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
          .doc-info h2 { margin: 0; font-size: 16px; font-weight: 800; color: #059669; }
          .doc-info p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; }
          
          .info-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 15px; }
          .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 8px; text-align: right; }
          .info-card p { margin: 0; font-size: 10px; color: #64748B; font-weight: 600; }
          .info-card h4 { margin: 2px 0 0 0; font-size: 12px; font-weight: 800; color: #0F172A; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background-color: #1E1B4B; color: #ffffff; padding: 8px 10px; text-align: center; font-size: 11px; font-weight: bold; }
          
          .summary-box { margin-top: 15px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
          .summary-item label { display: block; font-size: 10px; color: #64748B; font-weight: bold; margin-bottom: 2px; }
          .summary-item span { font-size: 14px; font-weight: 900; }
          
          .footer-box { margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          .terms-text { font-size: 10px; color: #475569; margin-bottom: 15px; text-align: center; font-weight: 500; }
          .signatures { display: flex; justify-content: space-between; padding: 0 40px; margin-top: 20px; }
          .sig-box { text-align: center; font-size: 11px; font-weight: bold; color: #334155; }
          .sig-line { width: 140px; border-bottom: 1px dashed #94A3B8; margin-top: 35px; }
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
            <h2>فاتورة مبيعات رسمية (Sales Invoice)</h2>
            <p><strong>رقم الفاتورة:</strong> ${invNo}</p>
            <p><strong>تاريخ الإصدار:</strong> ${formatDate(invDate)}</p>
            <p><strong>الحالة:</strong> ${statusLabel}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <p>بيانات العميل / المشتري</p>
            <h4>${sale.client_name || 'عميل نقدي'}</h4>
          </div>

          <div class="info-card">
            <p>طريقة السداد</p>
            <h4>${payMethodText}</h4>
          </div>

          <div class="info-card" style="border-right: 4px solid ${remainingAmount > 0 ? '#F59E0B' : '#10B981'};">
            <p>${remainingAmount > 0 ? 'المسدد نقداً (العربون)' : 'إجمالي الفاتورة المسدد'}</p>
            <h4 style="color: ${remainingAmount > 0 ? '#D97706' : '#059669'};">
              ${paidAmount.toFixed(2)} ${currency}
            </h4>
            ${remainingAmount > 0 ? `<span style="font-size: 9.5px; color: #DC2626; font-weight: bold; display: block; margin-top: 2px;">المتبقي دين: ${remainingAmount.toFixed(2)} ${currency}</span>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="text-align: right; width: 42%;">اسم الصنف / المنتج</th>
              <th style="width: 16%;">الكمية</th>
              <th style="width: 17%;">سعر الوحدة</th>
              <th style="width: 17%;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        ${paymentsRowsHtml ? `
          <div style="margin-top: 14px;">
            <h4 style="margin: 0 0 6px 0; font-size: 11px; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 4px;">
              <span>💳 تفاصيل الدفعات والمسدد من الفاتورة:</span>
            </h4>
            <table style="margin-top: 0;">
              <thead>
                <tr>
                  <th style="background-color: #14532D; width: 18%;">تاريخ الدفعة</th>
                  <th style="background-color: #14532D; text-align: right; width: 42%;">بيان السداد</th>
                  <th style="background-color: #14532D; width: 20%;">طريقة الدفع</th>
                  <th style="background-color: #14532D; width: 20%;">المبلغ المسدد</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsRowsHtml}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="summary-box">
          <div class="summary-item">
            <label>المبلغ الإجمالي</label>
            <span style="color: #0F172A;">${totalAmount.toFixed(2)} ${currency}</span>
          </div>
          <div class="summary-item">
            <label>المبلغ المسدد (عربون / نقدي)</label>
            <span style="color: #16A34A;">${paidAmount.toFixed(2)} ${currency}</span>
          </div>
          <div class="summary-item">
            <label>المتبقي المستحق (دين)</label>
            <span style="color: ${remainingAmount > 0 ? '#DC2626' : '#059669'};">${remainingAmount.toFixed(2)} ${currency}</span>
          </div>
        </div>

        <div class="footer-box">
          <p class="terms-text">${invoiceFooter}</p>
          
          <div class="signatures">
            <div class="sig-box">
              <span>توقيع العميل والمستلم</span>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <span>اعتماد إدارة المبيعات والختم</span>
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Receipt className="w-6 h-6 text-[#ECC796]" />
                <span>إدارة المبيعات وفواتير العملاء</span>
              </h1>
              <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                حساب COGS فوري ودقيق
              </span>
            </div>
            <p className="text-sm mt-1 text-[#A49EC0]">
              إصدار فواتير بيع المنتجات الجاهزة، تسجيل الإيرادات الفعلية، وخصم المخزون أوتوماتيكياً
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setShowHistorical(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all hover:bg-white/5 shadow-md bg-[#2F264C] border-[#ECC796]/40 text-[#ECC796]"
            >
              <History className="w-4 h-4" />
              <span>مبيعات سابقة / رصيد إفتتاحي</span>
            </button>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4 h-4" />
              <span>فاتورة مبيعات جديدة</span>
            </button>
          </div>
        </div>

        {/* Financial KPIs Bar (4 Glowing Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Revenue */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(16, 185, 129, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">إجمالي الإيرادات (Revenue)</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white">
              {loading ? '...' : `${totalSales.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">إجمالي مبيعات الفواتير</span>
          </div>

          {/* COGS */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(236, 199, 150, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">تكلفة البضاعة المباعة (COGS)</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#ECC796]/10 border border-[#ECC796]/20">
                <Package className="w-4 h-4 text-[#ECC796]" />
              </div>
            </div>
            <h3 className="text-xl font-black text-[#ECC796]">
              {loading ? '...' : `${totalCogs.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">تكلفة الخامات والتصنيع الفعلية</span>
          </div>

          {/* Gross Profit (Glowing Emerald Highlight) */}
          <div
            className="rounded-2xl border p-4 shadow-xl flex flex-col justify-between relative overflow-hidden ring-1 ring-emerald-500/30"
            style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), #2F264C)', borderColor: '#10B981' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">مجمل وصافي الربح</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-emerald-400">
                {loading ? '...' : `+${totalGrossProfit.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                +{profitMarginPercent}% ربح
              </span>
            </div>
            <span className="text-[10px] text-emerald-200/70 mt-1 block">فائض الإيراد بعد خصم التكاليف</span>
          </div>

          {/* Average Invoice */}
          <div
            className="rounded-2xl border p-4 shadow-lg flex flex-col justify-between"
            style={{ background: '#2F264C', borderColor: 'rgba(167, 139, 250, 0.3)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#D4CEEB]">متوسط قيمة الفاتورة</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white">
              {loading ? '...' : `${avgSale.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${currency}`}
            </h3>
            <span className="text-[10px] text-[#A49EC0] mt-1 block">معدل الفاتورة الواحدة</span>
          </div>
        </div>

        {/* Smart Search & Date Presets Bar */}
        <div
          className="rounded-2xl border p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md"
          style={{ background: '#2F264C', borderColor: '#3D3554' }}
        >
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الفاتورة، اسم العميل، أو الصنف..."
              className="w-full rounded-xl py-2 pr-10 pl-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setDateFilter('this_month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${dateFilter === 'this_month'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
                }`}
            >
              هذا الشهر
            </button>

            <button
              onClick={() => setDateFilter('last_3_months')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${dateFilter === 'last_3_months'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
                }`}
            >
              آخر 3 أشهر
            </button>

            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${dateFilter === 'all'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
                }`}
            >
              الكل ({sales.length})
            </button>
          </div>
        </div>

        {/* Invoices Data Table & Mobile Cards */}
        <div className="rounded-2xl border overflow-hidden shadow-xl" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          {loading ? (
            <div className="text-center py-16 text-xs text-[#A49EC0]">جاري تحميل فواتير المبيعات...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#A49EC0]">لا توجد فواتير مبيعات مسجلة في هذه الفترة</div>
          ) : (
            <>
              {/* Mobile Cards View (Zero Horizontal Scrolling) */}
              <div className="block md:hidden divide-y divide-[#3D3554]">
                {filtered.map((sale) => {
                  const revNo = sale.invoice_number || sale.revenue_number || 'INV';
                  const amount = parseFloat(sale.amount || sale.total_amount) || 0;
                  const cogs = parseFloat(sale.cogs || sale.product_cost) || 0;
                  const profit = amount - cogs;
                  const dateStr = sale.invoice_date || sale.revenue_date;
                  const margin = amount > 0 ? ((profit / amount) * 100).toFixed(1) : 0;

                  const payBadge = sale.payment_method === 'instapay' ? 'انستاباي' :
                    sale.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                      sale.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقدي';

                  return (
                    <div key={sale.id} className="p-3.5 space-y-3 bg-[#201A30]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-xs">{revNo}</span>
                            <span className="text-[10px] text-[#D4CEEB] font-mono">{formatDate(dateStr)}</span>
                          </div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-[#ECC796]"></span>
                            <span>{sale.client_name || 'عميل نقدي'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => printSalesInvoicePdf(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 transition-all shadow-sm"
                            title="طباعة فاتورة مبيعات رسمية PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Sold Items Chips */}
                      <div>
                        {sale.items?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {sale.items.map((itm, iIdx) => (
                              <span
                                key={iIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] bg-[#2F264C] text-gray-200 border border-[#3D3554]"
                              >
                                <strong>{itm.product_name || 'منتج'}</strong>
                                <span className="text-[#ECC796]">({itm.quantity})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#D4CEEB] text-[11px] truncate block">
                            {sale.description || 'منتجات جاهزة'}
                          </span>
                        )}
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#3D3554]/60 text-xs">
                        <div className="p-2 rounded-xl bg-[#2F264C] border border-[#3D3554] text-center">
                          <span className="text-[9px] text-[#A49EC0] block">الإجمالي:</span>
                          <span className="font-black text-white text-xs mt-0.5 block">
                            {amount.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}
                          </span>
                          {sale.remaining_amount > 0 && (
                            <span className="text-[8.5px] text-amber-300 font-bold block mt-0.5">
                              متبقي دين: {parseFloat(sale.remaining_amount).toLocaleString('ar-EG')}
                            </span>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-[#2F264C] border border-[#3D3554] text-center">
                          <span className="text-[9px] text-[#A49EC0] block">التكلفة COGS:</span>
                          <span className="font-bold text-[#ECC796] text-xs mt-0.5 block">
                            {cogs.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                          <span className="text-[9px] text-emerald-400 block">الربح ({margin}%):</span>
                          <span className="font-black text-emerald-300 text-xs mt-0.5 block">
                            +{profit.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}
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
                      <th className="py-3.5 px-4 font-semibold text-right">رقم الفاتورة</th>
                      <th className="py-3.5 px-4 font-semibold text-right">التاريخ</th>
                      <th className="py-3.5 px-4 font-semibold text-right">العميل</th>
                      <th className="py-3.5 px-4 font-semibold text-right">الأصناف المباعة</th>
                      <th className="py-3.5 px-4 font-semibold text-center">طريقة الدفع</th>
                      <th className="py-3.5 px-4 font-semibold text-center">تكلفة البضاعة (COGS)</th>
                      <th className="py-3.5 px-4 font-semibold text-center">إجمالي الفاتورة وحالة السداد</th>
                      <th className="py-3.5 px-4 font-semibold text-center">صافي الربح</th>
                      <th className="py-3.5 px-4 font-semibold text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sale) => {
                      const revNo = sale.invoice_number || sale.revenue_number || 'INV';
                      const amount = parseFloat(sale.amount || sale.total_amount) || 0;
                      const cogs = parseFloat(sale.cogs || sale.product_cost) || 0;
                      const profit = amount - cogs;
                      const dateStr = sale.invoice_date || sale.revenue_date;
                      const margin = amount > 0 ? ((profit / amount) * 100).toFixed(1) : 0;

                      const payBadge = sale.payment_method === 'instapay' ? 'انستاباي' :
                        sale.payment_method === 'vodafone_cash' ? 'فودافون كاش' :
                          sale.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                            sale.payment_method === 'postal_transfer' ? 'حوالة بريدية' : 'نقدي';

                      return (
                        <tr
                          key={sale.id}
                          className="border-b hover:bg-white/[0.03] transition-colors align-middle"
                          style={{ borderColor: '#3D3554' }}
                        >
                          {/* Invoice Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                            {revNo}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-[#D4CEEB]">
                            {formatDate(dateStr)}
                          </td>

                          {/* Client */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#ECC796]"></span>
                              <span>{sale.client_name || 'عميل نقدي'}</span>
                            </div>
                          </td>

                          {/* Sold Items Chips */}
                          <td className="py-3.5 px-4 max-w-[240px]">
                            {sale.items?.length ? (
                              <div className="flex flex-wrap gap-1">
                                {sale.items.map((itm, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] bg-[#231B3D] text-gray-200 border border-[#3D3554]"
                                  >
                                    <strong>{itm.product_name || 'منتج'}</strong>
                                    <span className="text-[#ECC796]">({itm.quantity})</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#D4CEEB] text-[11px] truncate block">
                                {sale.description || 'منتجات جاهزة'}
                              </span>
                            )}
                          </td>

                          {/* Payment Method Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#231B3D] text-[#D4CEEB] border border-[#3D3554]">
                              {payBadge}
                            </span>
                          </td>

                          {/* COGS */}
                          <td className="py-3.5 px-4 text-center font-bold text-[#ECC796]">
                            {cogs.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} <small className="text-[9px] font-normal">{currency}</small>
                          </td>

                          {/* Invoice Total & Payment Breakdown */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="font-black text-sm text-white">
                              +{amount.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} <small className="text-[9px] text-[#A49EC0] font-normal">{currency}</small>
                            </div>
                            {sale.remaining_amount > 0 ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                مدفوع: {parseFloat(sale.paid_amount || 0).toLocaleString('ar-EG')} | متبقي: {parseFloat(sale.remaining_amount).toLocaleString('ar-EG')}
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                مسددة بالكامل
                              </span>
                            )}
                          </td>

                          {/* Net Profit & Margin */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <span>+{profit.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}</span>
                              <span className="text-[9px] font-normal">({margin}%)</span>
                            </span>
                          </td>

                          {/* 1-Click Action Buttons */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => printSalesInvoicePdf(sale)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3D3554] text-[#ECC796] hover:bg-[#3D3554]/80 border border-[#ECC796]/30 transition-all shadow-sm"
                                title="طباعة فاتورة مبيعات رسمية PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>PDF فاتورة</span>
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
                {filtered.length} فاتورة مسجلة
              </span>
              <div className="flex items-center gap-5">
                <span className="text-xs text-[#A49EC0]">
                  إجمالي المبيعات:{' '}
                  <strong className="text-white text-sm font-black">
                    +{totalSales.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </span>
                <span className="text-xs text-[#A49EC0]">
                  مجمل الأرباح:{' '}
                  <strong className="text-emerald-400 text-sm font-black">
                    +{totalGrossProfit.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </span>
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

      {/* Create Sale Invoice Modal */}
      <CreateSalesInvoiceModal
        show={showCreate}
        onClose={() => setShowCreate(false)}
        products={products}
        clients={clients}
        currency={currency}
        onSuccess={() => fetchAll(page)}
      />

      {/* Historical Sales Modal */}
      <HistoricalSaleModal
        show={showHistorical}
        onClose={() => setShowHistorical(false)}
        products={products}
        clients={clients}
        currency={currency}
        onSuccess={() => fetchAll(page)}
      />
    </MainLayout>
  );
}
