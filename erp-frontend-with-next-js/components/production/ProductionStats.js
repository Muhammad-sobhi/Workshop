'use client';

export default function ProductionStats({ operations, loading }) {
  const stats = [
    { label: 'إجمالي الأوامر', value: operations.length },
    { label: 'معلق', value: operations.filter(o => o.status === 'Pending').length },
    { label: 'قيد التصنيع', value: operations.filter(o => o.status === 'In_Progress').length },
    { label: 'مكتمل', value: operations.filter(o => o.status === 'Completed').length },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div key={i} className="rounded-2xl border p-5 font-semibold" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
          <p className="text-2xl font-bold">{loading ? '...' : s.value}</p>
          <p className="text-xs mt-1" style={{ color: '#4E4869' }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}
