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

export function exportToPDF(title, columns, data, keys) {
  const printWindow = window.open('', '_blank');
  
  let tableHeadersHtml = columns.map(col => `<th>${col}</th>`).join('');
  let tableRowsHtml = data.map(row => {
    let cells = keys.map(key => `<td>${row[key] !== null && row[key] !== undefined ? row[key] : '—'}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #333; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background-color: #fafafa; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead>
          <tr>${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        }
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}
