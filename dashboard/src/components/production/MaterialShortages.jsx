'use client';

import React, { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { AlertTriangle, CheckCircle2, Layers, ShoppingCart, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react';

const fmt = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

function CountChip({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border bg-[#231B3D] border-red-500/30">
      <Icon className="w-3.5 h-3.5 text-red-400" />
      <span className="text-[#A49EC0]">{label}:</span>
      <span className="font-black text-red-400">{count}</span>
    </div>
  );
}

function ShortageTable({ title, icon: Icon, nameLabel, rows }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: '#3D3554' }}>
        <Icon className="w-4 h-4 text-[#ECC796]" />
        <h3 className="text-xs font-bold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#A49EC0]">
              <th className="text-right font-semibold px-4 py-2">{nameLabel}</th>
              <th className="text-center font-semibold px-3 py-2">المطلوب</th>
              <th className="text-center font-semibold px-3 py-2">المتاح</th>
              <th className="text-center font-semibold px-3 py-2 text-red-400">الناقص</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const open = openId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr
                    className="border-t cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ borderColor: '#3D3554' }}
                    onClick={() => setOpenId(open ? null : r.id)}
                  >
                    <td className="text-right px-4 py-2 font-bold text-[#D4CEEB]">
                      <button type="button" aria-expanded={open} className="flex items-center gap-1.5 text-right">
                        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#ECC796]" /> : <ChevronLeft className="w-3.5 h-3.5 text-[#A49EC0]" />}
                        <span>{r.name}</span>
                      </button>
                    </td>
                    <td className="text-center px-3 py-2 text-[#D4CEEB]">{fmt(r.required)}</td>
                    <td className="text-center px-3 py-2 text-[#D4CEEB]">{fmt(r.available)}</td>
                    <td className="text-center px-3 py-2 font-black text-red-400 whitespace-nowrap">
                      {fmt(r.shortage)} <span className="font-normal text-[10px] text-[#A49EC0]">{r.unit}</span>
                    </td>
                  </tr>
                  {open && (
                    <tr style={{ background: '#1C1532' }}>
                      <td colSpan={4} className="px-4 py-2">
                        <p className="text-[11px] text-[#A49EC0] mb-1.5">الأوامر التي تحتاجه:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {r.orders.map(o => (
                            <span key={o.operation_id} className="px-2 py-1 rounded-lg text-[11px] border border-[#3D3554] text-[#D4CEEB]">
                              {o.operation_number} · {o.client_name || 'مخزون'} ·{' '}
                              <span className="font-bold text-[#ECC796]">{fmt(o.quantity)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Shortages are computed by the API across all pending orders together.
export default function MaterialShortages({ refreshKey }) {
  const [data, setData] = useState({ orders_count: 0, materials: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    apiClient.get('/operations/material-shortages')
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const hasShortage = data.materials.length > 0 || data.products.length > 0;

  return (
    <div className="rounded-2xl border p-4 shadow-md space-y-3" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#ECC796]" />
          <h2 className="text-sm font-bold text-white">النواقص لأوامر قيد الانتظار</h2>
          {!loading && !error && (
            <span className="text-[11px] text-[#A49EC0]">({data.orders_count} أمر)</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="text-xs text-[#A49EC0]">جاري الحساب...</span>
          ) : error ? (
            <span className="text-xs text-red-400">تعذر تحميل النواقص</span>
          ) : !hasShortage ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border bg-[#231B3D] border-emerald-500/30 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>المخزون يغطي كل الأوامر</span>
            </div>
          ) : (
            <>
              {data.materials.length > 0 && <CountChip icon={Layers} label="خامات ناقصة" count={data.materials.length} />}
              {data.products.length > 0 && <CountChip icon={ShoppingCart} label="منتجات للشراء" count={data.products.length} />}
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#ECC796]/40 text-[#ECC796] hover:bg-[#ECC796]/10 transition-all"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && !loading && !error && hasShortage && (
        <div className={`grid grid-cols-1 gap-3 ${data.materials.length > 0 && data.products.length > 0 ? 'xl:grid-cols-2' : ''}`}>
          {data.materials.length > 0 && (
            <ShortageTable title="خامات ناقصة" icon={Layers} nameLabel="الخامة" rows={data.materials} />
          )}
          {data.products.length > 0 && (
            <ShortageTable title="منتجات جاهزة ناقصة (شراء)" icon={ShoppingCart} nameLabel="المنتج" rows={data.products} />
          )}
        </div>
      )}
    </div>
  );
}
