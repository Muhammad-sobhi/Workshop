'use client';

import { DollarSign, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';

export default function ProcurementStats({ orders, loading }) {
  const totalAmount = orders.reduce((sum, item) => sum + item.total_amount, 0);
  const receivedAmount = orders.filter(o => o.status === 'Received').reduce((sum, item) => sum + item.total_amount, 0);
  const pendingAmount = orders.filter(o => o.status === 'Pending').reduce((sum, item) => sum + item.total_amount, 0);
  const totalDebt = orders.filter(o => o.status === 'Received').reduce((sum, o) => sum + (Number(o.total_amount) - Number(o.deposit_paid || 0)), 0);

  const stats = [
    { label: 'إجمالي المشتريات', value: `EGP ${totalAmount.toLocaleString('ar-SA')}`, icon: DollarSign, dark: false },
    { label: 'مشتريات مستلمة', value: `EGP ${receivedAmount.toLocaleString('ar-SA')}`, icon: CheckCircle2, dark: false },
    { label: 'بانتظار الاستلام', value: `EGP ${pendingAmount.toLocaleString('ar-SA')}`, icon: FileText, dark: false },
    { label: 'ديون الموردين المتبقية', value: `EGP ${totalDebt.toLocaleString('ar-SA')}`, icon: AlertTriangle, dark: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="rounded-2xl border p-5 flex items-center gap-4 font-semibold"
          style={{
            background: stat.dark ? '#2F264C' : 'rgb(236, 199, 150)',
            borderColor: stat.dark ? '#EF4444' : '#ECC796',
            color: stat.dark ? '#EF4444' : '#231B3D',
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: stat.dark ? 'rgba(239,68,68,0.1)' : 'rgba(35,27,61,0.15)' }}
          >
            <stat.icon className="w-5 h-5" style={{ color: stat.dark ? '#EF4444' : '#231B3D' }} />
          </div>
          <div>
            <p className="text-xl font-bold">{loading ? '...' : stat.value}</p>
            <p className="text-xs" style={{ color: stat.dark ? '#A49EC0' : '#4E4869' }}>{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
