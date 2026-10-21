import apiClient from '@/lib/api-client';
import { exportToCSV } from '@/lib/utils';

// Columns each bulk-import endpoint accepts. The header row may use the Arabic label or any alias.
export const IMPORT_SPECS = {
  materials: {
    endpoint: '/materials/bulk-import',
    template: 'نموذج_استيراد_الخامات.csv',
    columns: [
      { key: 'name', label: 'الاسم', aliases: ['name', 'اسم'], required: true },
      { key: 'unit', label: 'الوحدة', aliases: ['unit'], required: true },
      { key: 'unit_cost', label: 'التكلفة', aliases: ['unit_cost', 'cost', 'تكلفة الوحدة'], required: true, number: true },
      { key: 'category', label: 'الفئة', aliases: ['category', 'التصنيف'], required: true },
      { key: 'description', label: 'الوصف', aliases: ['description'] },
    ],
  },
  products: {
    endpoint: '/products/bulk-import',
    template: 'نموذج_استيراد_المنتجات.csv',
    columns: [
      { key: 'name', label: 'الاسم', aliases: ['name', 'اسم'], required: true },
      { key: 'unit', label: 'الوحدة', aliases: ['unit'], required: true },
      { key: 'sale_price', label: 'سعر البيع', aliases: ['sale_price', 'price', 'السعر'], required: true, number: true },
      { key: 'category', label: 'الفئة', aliases: ['category', 'التصنيف'], required: true },
      { key: 'description', label: 'الوصف', aliases: ['description'] },
    ],
  },
  suppliers: {
    endpoint: '/suppliers/bulk-import',
    template: 'نموذج_استيراد_الموردين.csv',
    columns: [
      { key: 'name', label: 'الاسم', aliases: ['name', 'اسم'], required: true },
      { key: 'phone', label: 'الهاتف', aliases: ['phone', 'التليفون', 'الموبايل'] },
      { key: 'email', label: 'البريد الإلكتروني', aliases: ['email', 'البريد'] },
      { key: 'debt_amount', label: 'المديونية', aliases: ['debt_amount', 'debt', 'الرصيد الافتتاحي'], number: true },
    ],
  },
  clients: {
    endpoint: '/clients/bulk-import',
    template: 'نموذج_استيراد_العملاء.csv',
    columns: [
      { key: 'name', label: 'الاسم', aliases: ['name', 'اسم'], required: true },
      { key: 'phone', label: 'الهاتف', aliases: ['phone', 'التليفون', 'الموبايل'] },
      { key: 'email', label: 'البريد الإلكتروني', aliases: ['email', 'البريد'] },
      { key: 'debt_amount', label: 'المديونية', aliases: ['debt_amount', 'debt', 'الرصيد الافتتاحي'], number: true },
    ],
  },
};

const normalize = (h) => String(h ?? '').replace(/^﻿/, '').trim().toLowerCase();

/** Split CSV text into rows of cells (quoted cells, "" escapes, CRLF; comma, semicolon or tab). */
export function parseCsv(text) {
  const clean = String(text ?? '').replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delimiter = [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** Turn CSV text into the items array an endpoint expects, with readable errors (row numbers as in Excel). */
export function buildItems(spec, text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], errors: ['الملف فاضي أو مفيهوش غير سطر العناوين.'] };

  const header = rows[0].map(normalize);
  const indexOf = {};
  const errors = [];
  for (const col of spec.columns) {
    const names = [col.label, col.key, ...(col.aliases || [])].map(normalize);
    const idx = header.findIndex(h => names.includes(h));
    if (idx >= 0) indexOf[col.key] = idx;
    else if (col.required) errors.push(`العمود "${col.label}" مش موجود في أول سطر.`);
  }
  if (errors.length) return { items: [], errors };

  const items = [];
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const item = {};
    for (const col of spec.columns) {
      if (indexOf[col.key] === undefined) continue;
      let value = String(cells[indexOf[col.key]] ?? '').trim();
      if (value === '') {
        if (col.required) errors.push(`سطر ${line}: "${col.label}" فاضي.`);
        continue;
      }
      if (col.number) {
        const num = Number(value.replace(/[,\s]/g, ''));
        if (!Number.isFinite(num)) { errors.push(`سطر ${line}: "${col.label}" لازم يكون رقم.`); continue; }
        value = num;
      }
      item[col.key] = value;
    }
    items.push(item);
  });
  return { items, errors };
}

/** Read a CSV file as UTF-8, falling back to Windows-1256 (Arabic Excel "CSV" without UTF-8). */
async function readCsvText(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1256').decode(buffer);
  } catch {
    return utf8;
  }
}

/** Parse the file and send its rows; resolves with the API message, rejects with a readable message. */
export async function importCsvFile(file, type) {
  const spec = IMPORT_SPECS[type];
  const { items, errors } = buildItems(spec, await readCsvText(file));
  if (errors.length) {
    const shown = errors.slice(0, 5).join(' • ');
    throw new Error(errors.length > 5 ? `${shown} • … و${errors.length - 5} أخطاء أخرى` : shown);
  }
  try {
    const res = await apiClient.post(spec.endpoint, { items });
    return res.data?.message || 'تم استيراد البيانات بنجاح';
  } catch (err) {
    const fieldErrors = err?.response?.data?.errors;
    if (fieldErrors) {
      // Laravel reports "items.3.email": point at the Excel row (header is row 1)
      const first = Object.entries(fieldErrors).slice(0, 5).map(([field, msgs]) => {
        const m = field.match(/^items\.(\d+)\./);
        return m ? `سطر ${Number(m[1]) + 2}: ${msgs[0]}` : msgs[0];
      });
      throw new Error(first.join(' • '));
    }
    throw new Error(err?.response?.data?.message || 'فشل في استيراد الملف');
  }
}

/** Download an empty CSV with the column headers of an import. */
export function downloadImportTemplate(type) {
  const spec = IMPORT_SPECS[type];
  const headerMap = Object.fromEntries(spec.columns.map(c => [c.label, c.key]));
  exportToCSV([], spec.template, headerMap);
}
