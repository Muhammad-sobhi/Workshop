'use client';

import { formatDecimal } from '@/lib/utils';

const cardStyle = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

export default function MaterialStats({ materials, loading, activeTab, currency }) {
  const items = materials.filter(m => m.type === activeTab);
  const totalValue = items.reduce((sum, m) => sum + (m.unit_cost * (m.stock || 0)), 0);
  const lowStockCount = items.filter(m => m.stock > 0 && m.stock < (m.low_stock_limit || 10)).length;
  const zeroStockCount = items.filter(m => m.stock <= 0).length;

  const stats = [
    {
      label: activeTab === 'material' ? 'إجمالي المواد' : 'إجمالي الخدمات',
      value: items.length,
      color: '#8D7EC8',
    },
    {
      label: activeTab === 'material' ? 'قيمة مخزون المواد' : 'تكلفة الخدمات الإجمالية',
      value: `${currency || 'ر.س'} ${formatDecimal(totalValue)}`,
      color: '#231B3D',
    },
    {
      label: 'مخزون منخفض',
      value: activeTab === 'material' ? lowStockCount : '—',
      color: '#F59E0B',
    },
    {
      label: 'نفد المخزون',
      value: activeTab === 'material' ? zeroStockCount : '—',
      color: '#EF4444',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-2xl border p-4 text-center font-semibold animate-in fade-in" style={cardStyle}>
          <p className="text-xl font-bold" style={{ color: stat.color === '#ECC796' ? '#231B3D' : stat.color }}>
            {loading ? '...' : stat.value}
          </p>
          <p className="text-[11px] mt-1" style={{ color: '#4E4869' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
