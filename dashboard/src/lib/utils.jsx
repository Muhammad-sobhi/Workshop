import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDecimal(val) {
  if (val === null || val === undefined) return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export function formatDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('ar-EG', { calendar: 'gregory' });
}


export function exportToCSV(data, filename, headerMap) {
  const headers = Object.keys(headerMap);
  const keys = Object.values(headerMap);
  
  const csvRows = [];
  csvRows.push(headers.join(','));

  data.forEach(row => {
    const values = keys.map(key => {
      let val = row[key];
      if (val === null || val === undefined) val = '';
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

import { useAppStore } from './store';
import { getImageUrl } from './config';

export function exportToPDF(title, columns, data, keys) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const settings = useAppStore.getState()?.settings || {};
  const companyName = settings.company_name || 'ورشة الأثاث الحديث';
  const phone = settings.phone || '';
  const address = settings.address || '';
  const logoUrl = settings.logo_path ? getImageUrl(settings.logo_path) : '';
  const invoiceFooter = settings.invoice_footer || 'تم إصدار هذا المستند تلقائياً من نظام إدارة الورشة';

  let tableHeadersHtml = columns.map(col => `<th style="background-color: #1E1B4B; color: #ffffff; padding: 8px 10px; font-size: 11px; font-weight: bold; border: 1px solid #CBD5E1;">${col}</th>`).join('');
  let tableRowsHtml = data.map((row, idx) => {
    let cells = keys.map(key => `<td style="padding: 7px 10px; font-size: 11px; border: 1px solid #E2E8F0; text-align: center;">${row[key] !== null && row[key] !== undefined ? row[key] : '—'}</td>`).join('');
    return `<tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">${cells}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title} - ${companyName}</title>
      <style>
        @media print {
          @page { size: A4; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          button { display: none; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0F172A; line-height: 1.5; background: #fff; direction: rtl; text-align: right; }
        .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1E1B4B; padding-bottom: 10px; margin-bottom: 15px; }
        .workshop-info h1 { margin: 0; font-size: 18px; font-weight: 900; color: #1E1B4B; }
        .workshop-info p { margin: 2px 0 0 0; font-size: 11px; color: #64748B; font-weight: 500; }
        .doc-info { text-align: left; }
        .doc-info h2 { margin: 0; font-size: 15px; font-weight: 800; color: #D97706; }
        .doc-info p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .footer { margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 8px; text-align: center; font-size: 10px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${logoUrl ? `<img src="${logoUrl}" style="max-height: 50px; max-width: 120px; object-fit: contain;" />` : ''}
          <div class="workshop-info">
            <h1>${companyName}</h1>
            ${phone ? `<p>📞 هاتف: ${phone}</p>` : ''}
            ${address ? `<p>📍 ${address}</p>` : ''}
          </div>
        </div>
        <div class="doc-info">
          <h2>${title}</h2>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <p>${invoiceFooter} • تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}
