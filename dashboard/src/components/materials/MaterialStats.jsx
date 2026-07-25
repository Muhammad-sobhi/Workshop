'use client';

import { formatDecimal } from '@/lib/utils';

const cardStyle = { background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' };

export default function MaterialStats({ materials, loading, activeTab, currency }) {
  const items = materials.filter(m => m.type === activeTab);
  const totalValue = items.reduce((sum, m) => sum + (m.unit_cost * (m.stock || 0)), 0);
  const lowStockCount = items.filter(m => m.stock > 0 && m.stock < (m.low_stock_limit || 10)).length;
  const zeroStockCount = items.filter(m => m.stock <= 0).length;

  const stats = [
    {
      label: activeTab === 'material' ? 'إجمالي المواد' : 'إجمالي الخدمات',
      value: items.length,
      color: '#ECC796',
    },
    {
      label: activeTab === 'material' ? 'قيمة مخزون المواد' : 'تكلفة الخدمات الإجمالية',
      value: `${currency || 'ر.س'} ${formatDecimal(totalValue)}`,
      color: '#FFFFFF',
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-xl border p-2.5 text-center font-semibold animate-in fade-in" style={cardStyle}>
          <p className="text-base font-bold truncate" style={{ color: stat.color }}>
            {loading ? '...' : stat.value}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
