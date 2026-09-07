'use client';

export default function SupplierStats({ loading, stats, currency, activeTab }) {
  const cardStyle = { background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' };

  const totalCount = stats?.total_count ?? 0;
  const totalDebt = stats?.total_debt ?? 0;
  const indebtedCount = stats?.indebted_count ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { 
          label: activeTab === 'suppliers' ? 'إجمالي الموردين' : 'إجمالي العملاء', 
          value: totalCount, 
          color: '#ECC796' 
        },
        { 
          label: activeTab === 'suppliers' ? 'إجمالي الديون للموردين' : 'إجمالي الديون على العملاء', 
          value: `${currency} ${Number(totalDebt).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, 
          color: '#EF4444' 
        },
        { 
          label: 'جهات معلقة الديون', 
          value: indebtedCount, 
          color: '#FFFFFF' 
        },
      ].map((stat, i) => (
        <div key={i} className="rounded-xl border p-2.5 text-center font-semibold" style={cardStyle}>
          <p className="text-base font-bold truncate" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
