'use client';

export default function SupplierStats({ loading, currentList, totalDebt, currency, activeTab }) {
  const cardStyle = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[
        { label: activeTab === 'suppliers' ? 'إجمالي الموردين' : 'إجمالي العملاء', value: currentList.length },
        { label: activeTab === 'suppliers' ? 'إجمالي الديون للموردين' : 'إجمالي الديون على العملاء', value: `${currency} ${totalDebt.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}` },
        { label: 'جهات معلقة الديون', value: currentList.filter(s => parseFloat(s.debt_amount) > 0).length },
      ].map((stat, i) => (
        <div key={i} className="rounded-2xl border p-4 text-center font-semibold" style={cardStyle}>
          <p className="text-2xl font-bold" style={{ color: '#231B3D' }}>{loading ? '...' : stat.value}</p>
          <p className="text-xs mt-1" style={{ color: '#4E4869' }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
