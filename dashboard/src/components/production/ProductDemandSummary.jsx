'use client';

import React, { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { ClipboardList, Users, Package } from 'lucide-react';

const columns = [
  { key: 'Pending', label: 'قيد الانتظار', color: '#F59E0B' },
  { key: 'In_Progress', label: 'قيد التصنيع', color: '#8D7EC8' },
  { key: 'Completed', label: 'جاهز في المخزن', color: '#10B981' },
];

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

  return (
    <div className="rounded-2xl border p-4 shadow-md space-y-3" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-[#ECC796]" />
        <h2 className="text-sm font-bold text-white">الكميات المطلوبة من كل منتج</h2>
        <span className="text-[11px] text-[#A49EC0]">(بدون المُسلَّم والملغي)</span>
      </div>
      {loading ? (
        <p className="text-center py-6 text-xs text-[#A49EC0]">جاري الحساب...</p>
      ) : error ? (
        <p className="text-center py-6 text-xs text-red-400">تعذر تحميل ملخص الكميات</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <SummaryTable title="طلبات العملاء" icon={Users} rows={summary.clients} />
          <SummaryTable title="تصنيع كمخزون للمعرض" icon={Package} rows={summary.stock} />
        </div>
      )}
    </div>
  );
}
