'use client';

export default function ProductionStats({ operations, loading }) {
  const stats = [
    { label: 'إجمالي الأوامر', value: operations.length, color: '#ECC796' },
    { label: 'معلق', value: operations.filter(o => o.status === 'Pending').length, color: '#F59E0B' },
    { label: 'قيد التصنيع', value: operations.filter(o => o.status === 'In_Progress').length, color: '#3B82F6' },
    { label: 'مكتمل', value: operations.filter(o => o.status === 'Completed').length, color: '#10B981' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border p-2.5 text-center font-semibold" style={{ background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' }}>
          <p className="text-base font-bold truncate" style={{ color: s.color }}>{loading ? '...' : s.value}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}
