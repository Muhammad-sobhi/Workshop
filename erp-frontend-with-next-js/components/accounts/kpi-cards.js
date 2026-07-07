import { ArrowUpRight, ArrowDownRight, Scale, TrendingUp, TrendingDown } from 'lucide-react';

const CARD = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

export default function KpiCards({ loading, totalRevenue, totalExpense, netProfit, profitMargin, currency }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'إجمالي الإيرادات', value: `${currency} ${totalRevenue.toFixed(2)}`, icon: ArrowUpRight },
        { label: 'إجمالي المصروفات', value: `${currency} ${totalExpense.toFixed(2)}`, icon: ArrowDownRight },
        { label: 'صافي الربح', value: `${currency} ${Math.abs(netProfit).toFixed(2)}`, icon: netProfit >= 0 ? TrendingUp : TrendingDown },
        { label: 'هامش الربح', value: `${profitMargin}%`, icon: Scale },
      ].map((card, i) => (
        <div key={i} className="rounded-2xl border p-5 flex items-center gap-4 font-semibold" style={CARD}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(35, 27, 61, 0.15)' }}>
            <card.icon className="w-5 h-5" style={{ color: '#231B3D' }} />
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: '#231B3D' }}>{loading ? '...' : card.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#4E4869' }}>{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
