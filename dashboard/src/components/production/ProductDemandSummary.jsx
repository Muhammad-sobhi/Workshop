'use client';

import React, { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { ClipboardList, Users, Package, ChevronDown, ChevronUp } from 'lucide-react';

const columns = [
  { key: 'Pending', label: 'قيد الانتظار', color: '#F59E0B' },
  { key: 'In_Progress', label: 'قيد التصنيع', color: '#8D7EC8' },
  { key: 'Completed', label: 'جاهز في المخزن', color: '#10B981' },
];

function TotalChip({ icon: Icon, label, products, qty }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border bg-[#231B3D] border-[#3D3554]">
      <Icon className="w-3.5 h-3.5 text-[#ECC796]" />
      <span className="text-[#A49EC0]">{label}:</span>
      <span className="font-black text-[#ECC796]">{qty}</span>
      <span className="text-[#A49EC0]">قطعة من {products} منتج</span>
    </div>
  );
}

function SummaryTable({ title, icon: Icon, rows }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: '#3D3554' }}>
        <Icon className="w-4 h-4 text-[#ECC796]" />
        <h3 className="text-xs font-bold text-white">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-center py-6 text-xs text-[#A49EC0]">لا توجد كميات مطلوبة</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#A49EC0]">
                <th className="text-right font-semibold px-4 py-2">المنتج</th>
                <th className="text-center font-semibold px-3 py-2 text-[#ECC796]">الإجمالي المطلوب</th>
                {columns.map(c => (
                  <th key={c.key} className="text-center font-semibold px-3 py-2 whitespace-nowrap" style={{ color: c.color }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.product_id} className="border-t" style={{ borderColor: '#3D3554' }}>
                  <td className="text-right px-4 py-2 font-bold text-[#D4CEEB]">{r.name || 'منتج'}</td>
                  <td className="text-center px-3 py-2 font-black text-[#ECC796] whitespace-nowrap">
                    {r.total} <span className="font-normal text-[10px] text-[#A49EC0]">{r.unit}</span>
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className="text-center px-3 py-2 text-[#D4CEEB]">
                      {r[c.key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Totals come from the API so they cover all orders, not just the loaded page.
export default function ProductDemandSummary({ status = 'all', client = 'all', search = '', refreshKey }) {
  const [summary, setSummary] = useState({ clients: [], stock: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      apiClient.get('/operations/demand-summary', { params: { status, client, search: search.trim() } })
        .then(res => { if (!cancelled) setSummary(res.data); })
        .catch(() => { if (!cancelled) setError(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [status, client, search, refreshKey]);

  const totals = (rows) => ({
    products: rows.length,
    qty: Math.round(rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0) * 100) / 100,
  });
  const clientTotals = totals(summary.clients);
  const stockTotals = totals(summary.stock);

  return (
    <div className="rounded-2xl border p-4 shadow-md space-y-3" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#ECC796]" />
          <h2 className="text-sm font-bold text-white">الكميات المطلوبة من كل منتج</h2>
          <span className="text-[11px] text-[#A49EC0]">(بدون المُسلَّم والملغي)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="text-xs text-[#A49EC0]">جاري الحساب...</span>
          ) : error ? (
            <span className="text-xs text-red-400">تعذر تحميل ملخص الكميات</span>
          ) : (
            <>
              <TotalChip icon={Users} label="طلبات العملاء" {...clientTotals} />
              <TotalChip icon={Package} label="كمخزون" {...stockTotals} />
            </>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            disabled={loading || error}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#ECC796]/40 text-[#ECC796] hover:bg-[#ECC796]/10 transition-all disabled:opacity-40"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
          </button>
        </div>
      </div>

      {expanded && !loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <SummaryTable title="طلبات العملاء" icon={Users} rows={summary.clients} />
          <SummaryTable title="تصنيع كمخزون للمعرض" icon={Package} rows={summary.stock} />
        </div>
      )}
    </div>
  );
}
