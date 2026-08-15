'use client';

import React from 'react';
import { ShoppingBag, CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function ProcurementStats({ orders = [], loading = false }) {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  
  const receivedOrders = orders.filter(o => o.status === 'Received');
  const receivedAmount = receivedOrders.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  
  const pendingOrders = orders.filter(o => o.status === 'Pending');
  const pendingAmount = pendingOrders.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  
  const totalDebt = orders.reduce((sum, o) => {
    const tot = parseFloat(o.total_amount) || 0;
    const dep = parseFloat(o.deposit_paid) || 0;
    return sum + Math.max(0, tot - dep);
  }, 0);

  const stats = [
    {
      title: 'إجمالي المشتريات',
      count: `${totalOrders} طلب توريد`,
      value: `${totalAmount.toLocaleString('ar-EG')} ${currency}`,
      icon: ShoppingBag,
      color: '#ECC796',
      bgGlow: 'rgba(236, 199, 150, 0.1)',
      borderColor: 'rgba(236, 199, 150, 0.3)',
      subtext: 'القيمة الإجمالية لكافة الأوامر'
    },
    {
      title: 'مشتريات مستلمة بالمخزن',
      count: `${receivedOrders.length} طلب مكتمل`,
      value: `${receivedAmount.toLocaleString('ar-EG')} ${currency}`,
      icon: CheckCircle2,
      color: '#10B981',
      bgGlow: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      subtext: 'تم فحصها وإدخالها المخزون'
    },
    {
      title: 'بانتظار الاستلام والتوريد',
      count: `${pendingOrders.length} شحنة معلقة`,
      value: `${pendingAmount.toLocaleString('ar-EG')} ${currency}`,
      icon: Clock,
      color: '#F59E0B',
      bgGlow: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      subtext: 'في مرحلة الشحن أو التجهيز'
    },
    {
      title: 'ديون الموردين المتبقية',
      count: 'مستحقات واجبة السداد',
      value: `${totalDebt.toLocaleString('ar-EG')} ${currency}`,
      icon: AlertTriangle,
      color: '#EF4444',
      bgGlow: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
      subtext: 'صافي المتبقي للموردين'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.01] relative overflow-hidden shadow-lg"
            style={{
              background: '#2F264C',
              borderColor: stat.borderColor,
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#D4CEEB]">{stat.title}</span>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner"
                style={{ background: stat.bgGlow, border: `1px solid ${stat.borderColor}` }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-extrabold tracking-tight" style={{ color: stat.color }}>
                {loading ? '...' : stat.value}
              </h3>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10.5px]">
              <span className="text-gray-300 font-medium">{stat.count}</span>
              <span className="text-[#A49EC0]">{stat.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
