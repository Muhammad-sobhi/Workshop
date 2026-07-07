'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

const INCOMING_TYPES = ['Initial_Balance', 'Purchase_Receipt', 'Transfer_In'];

export default function LedgerPage() {
  const params = useParams();
  const type = params.type;
  const id = params.id;
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/inventory/ledger/${type}/${id}`)
      .then(res => setLedgerData(res.data))
      .finally(() => setLoading(false));
  }, [type, id]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/inventory"
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            style={{ color: '#A49EC0' }}
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {loading ? 'دفتر الحركة' : `دفتر حركة: ${ledgerData?.item?.name}`}
            </h1>
            {ledgerData && (
              <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
                {ledgerData.item.sku} • {ledgerData.item.type === 'material' ? 'مادة خام' : 'منتج جاهز'}
              </p>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {ledgerData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border p-5 font-semibold" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#4E4869' }}>الرصيد الحالي</p>
              <p className="text-2xl font-bold" style={{ color: ledgerData.item.current_stock > 0 ? '#065F46' : '#EF4444' }}>
                {ledgerData.item.current_stock.toLocaleString('ar-SA')}
              </p>
              <p className="text-xs mt-1" style={{ color: '#4E4869' }}>{ledgerData.item.unit}</p>
            </div>
            <div className="rounded-2xl border p-5 font-semibold" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#4E4869' }}>تكلفة الوحدة</p>
              <p className="text-2xl font-bold" style={{ color: '#231B3D' }}>
                EGP {ledgerData.item.unit_cost.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border p-5 font-semibold" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#4E4869' }}>القيمة الإجمالية</p>
              <p className="text-2xl font-bold" style={{ color: '#231B3D' }}>
                EGP {(ledgerData.item.current_stock * ledgerData.item.unit_cost).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                    {['التاريخ', 'نوع الحركة', 'المستودع', 'وارد', 'صادر', 'الرصيد', 'المرجع', 'ملاحظات'].map(h => (
                      <th key={h} className="text-right px-4 py-4 text-xs font-semibold uppercase" style={{ color: '#A49EC0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ledgerData?.ledger ?? []).map((entry, idx) => {
                    const isIn = INCOMING_TYPES.includes(entry.movement_type);
                    return (
                      <tr key={entry.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: '#3D3554' }}>
                        <td className="px-4 py-3 text-white whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ background: isIn ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isIn ? '#10B981' : '#EF4444' }}>
                            {entry.movement_type_text}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: '#D4CEEB' }}>{entry.warehouse_name}</td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#10B981' }}>
                          {entry.quantity_in > 0 ? (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {entry.quantity_in.toLocaleString('ar-SA')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#EF4444' }}>
                          {entry.quantity_out > 0 ? (
                            <span className="flex items-center gap-1">
                              <TrendingDown className="w-3.5 h-3.5" />
                              {entry.quantity_out.toLocaleString('ar-SA')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          {entry.running_balance.toLocaleString('ar-SA')}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#A49EC0' }}>
                          {entry.reference_number}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px] truncate" style={{ color: '#A49EC0' }}>
                          {entry.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!ledgerData?.ledger || ledgerData.ledger.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد حركات مسجلة لهذه المادة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
