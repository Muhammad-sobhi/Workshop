'use client';

import { DollarSign, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';

export default function ProcurementStats({ orders, loading }) {
  const totalAmount = orders.reduce((sum, item) => sum + item.total_amount, 0);
  const receivedAmount = orders.filter(o => o.status === 'Received').reduce((sum, item) => sum + item.total_amount, 0);
  const pendingAmount = orders.filter(o => o.status === 'Pending').reduce((sum, item) => sum + item.total_amount, 0);
  const totalDebt = orders.filter(o => o.status === 'Received').reduce((sum, o) => sum + (Number(o.total_amount) - Number(o.deposit_paid || 0)), 0);

  const stats = [
    { label: 'إجمالي المشتريات', value: `EGP ${totalAmount.toLocaleString('ar-SA')}`, icon: DollarSign, color: '#ECC796' },
    { label: 'مشتريات مستلمة', value: `EGP ${receivedAmount.toLocaleString('ar-SA')}`, icon: CheckCircle2, color: '#10B981' },
    { label: 'بانتظار الاستلام', value: `EGP ${pendingAmount.toLocaleString('ar-SA')}`, icon: FileText, color: '#F59E0B' },
    { label: 'ديون الموردين المتبقية', value: `EGP ${totalDebt.toLocaleString('ar-SA')}`, icon: AlertTriangle, color: '#EF4444' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="rounded-xl border p-2.5 flex items-center gap-3 font-semibold"
          style={{
            background: 'rgb(47, 38, 76)',
            borderColor: '#3D3554',
            color: '#FFFFFF',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#3D3554' }}
          >
            <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
