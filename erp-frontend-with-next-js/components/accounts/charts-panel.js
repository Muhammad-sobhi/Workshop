import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CARD = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

export default function ChartsPanel({ loading, chartData, expCatData, totalExpense, currency }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-2xl border p-5" style={CARD}>
        <h3 className="text-sm font-semibold text-white mb-4">الإيرادات مقابل المصروفات (آخر 6 أشهر)</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D3554" />
              <XAxis dataKey="month" tick={{ fill: '#A49EC0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#A49EC0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#2F264C', border: '1px solid #3D3554', borderRadius: '12px', color: '#fff', fontSize: 12 }} formatter={(val) => [`${currency} ${Number(val).toLocaleString('ar-SA')}`, '']} />
              <Legend formatter={v => v === 'revenue' ? 'إيرادات' : 'مصروفات'} wrapperStyle={{ fontSize: 11, color: '#A49EC0' }} />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="url(#revGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#expGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl border p-5" style={CARD}>
        <h3 className="text-sm font-semibold text-white mb-4">توزيع المصروفات</h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center" style={{ color: '#A49EC0' }}>...</div>
        ) : expCatData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs" style={{ color: '#A49EC0' }}>لا بيانات</div>
        ) : (
          <div className="space-y-3 mt-2">
            {expCatData.sort((a, b) => b.value - a.value).map((item, i) => {
              const pct = totalExpense > 0 ? (item.value / totalExpense) * 100 : 0;
              const colors = ['#EF4444', '#F59E0B', '#8D7EC8', '#ECC796', '#10B981', '#3B82F6'];
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#D4CEEB' }}>{item.name}</span>
                    <span style={{ color: colors[i % colors.length] }}>{currency} {item.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#3D3554' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
