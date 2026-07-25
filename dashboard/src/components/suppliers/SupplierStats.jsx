'use client';

export default function SupplierStats({ loading, currentList, totalDebt, currency, activeTab }) {
  const cardStyle = { background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { label: activeTab === 'suppliers' ? 'إجمالي الموردين' : 'إجمالي العملاء', value: currentList.length, color: '#ECC796' },
        { label: activeTab === 'suppliers' ? 'إجمالي الديون للموردين' : 'إجمالي الديون على العملاء', value: `${currency} ${totalDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, color: '#EF4444' },
        { label: 'جهات معلقة الديون', value: currentList.filter(s => parseFloat(s.debt_amount) > 0).length, color: '#FFFFFF' },
      ].map((stat, i) => (
        <div key={i} className="rounded-xl border p-2.5 text-center font-semibold" style={cardStyle}>
          <p className="text-base font-bold truncate" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
