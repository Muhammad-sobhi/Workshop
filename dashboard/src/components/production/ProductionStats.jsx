'use client';

import React from 'react';
import { Layers, Clock, Cog, PackageCheck, Truck } from 'lucide-react';

export default function ProductionStats({ operations = [], loading = false, activeFilter = 'all', onSelectFilter }) {
  const totalCount = operations.length;
  const pendingCount = operations.filter(o => o.status === 'Pending').length;
  const inProgressCount = operations.filter(o => o.status === 'In_Progress').length;
  const completedCount = operations.filter(o => o.status === 'Completed').length;
  const deliveredCount = operations.filter(o => o.status === 'Delivered').length;

  const stats = [
    {
      id: 'all',
      label: 'إجمالي الطلبات',
      count: totalCount,
      icon: Layers,
      color: '#ECC796',
      bgGlow: 'rgba(236, 199, 150, 0.1)',
      border: 'rgba(236, 199, 150, 0.3)',
    },
    {
      id: 'pending',
      label: 'قيد الانتظار',
      count: pendingCount,
      icon: Clock,
      color: '#F59E0B',
      bgGlow: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.3)',
    },
    {
      id: 'in_progress',
      label: 'قيد التصنيع',
      count: inProgressCount,
      icon: Cog,
      color: '#8D7EC8',
      bgGlow: 'rgba(141, 126, 200, 0.12)',
      border: 'rgba(141, 126, 200, 0.35)',
    },
    {
      id: 'completed',
      label: 'جاهز في المخزن',
      count: completedCount,
      icon: PackageCheck,
      color: '#10B981',
      bgGlow: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.3)',
    },
    {
      id: 'delivered',
      label: 'تم التسليم',
      count: deliveredCount,
      icon: Truck,
      color: '#3B82F6',
      bgGlow: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.3)',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        const isActive = activeFilter === s.id;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(s.id)}
            className={`rounded-2xl border p-3.5 text-right transition-all duration-200 hover:scale-[1.02] relative overflow-hidden shadow-md flex flex-col justify-between ${
              isActive ? 'ring-2 ring-[#ECC796] shadow-lg' : ''
            }`}
            style={{
              background: '#2F264C',
              borderColor: s.border,
            }}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[11.5px] font-semibold text-[#D4CEEB]">{s.label} ({s.count})</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: s.bgGlow }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
            </div>

            <div className="flex items-baseline justify-end w-full">
              <h3 className="text-2xl font-black tracking-tight" style={{ color: s.color }}>
                {loading ? '...' : s.count}
              </h3>
            </div>
          </button>
        );
      })}
    </div>
  );
}
