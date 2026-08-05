import { ArrowUpRight, ArrowDownRight, Scale, TrendingUp, TrendingDown, Box } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function KpiCards({ loading, totalRevenue, totalExpense, totalProductCost = 0, netProfit, profitMargin, inventoryValue = 0, currency }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const totalCostAndExpense = totalExpense + totalProductCost;

  const cards = [
    { label: 'إجمالي الإيرادات', value: `${currency} ${totalRevenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, icon: ArrowUpRight, color: '#10B981' },
    { 
      label: 'تكلفة المبيعات والمصروفات', 
      value: `${currency} ${totalCostAndExpense.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, 
      subText: totalProductCost > 0 ? `(تكلفة بضاعة: ${totalProductCost.toLocaleString('ar-SA')} | مصروفات: ${totalExpense.toLocaleString('ar-SA')})` : null,
      icon: ArrowDownRight, 
      color: '#EF4444' 
    },
    { label: 'صافي الأرباح الحقيقي', value: `${currency} ${netProfit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, icon: netProfit >= 0 ? TrendingUp : TrendingDown, color: netProfit >= 0 ? '#10B981' : '#EF4444' },
    { label: 'رأس مال المخزون الأصلي', value: `${currency} ${inventoryValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`, icon: Box, color: '#4338CA' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-2xl border p-4 flex items-center gap-3.5 font-semibold transition-all shadow-sm"
          style={{
            background: isLight ? '#FFFFFF' : 'rgb(47, 38, 76)',
            borderColor: isLight ? '#EBF0FF' : '#3D3554'
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: isLight ? '#EFF2FE' : '#3D3554',
              borderColor: isLight ? '#EBF0FF' : 'transparent'
            }}
          >
            <card.icon className="w-5 h-5" style={{ color: isLight ? card.color : '#ECC796' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold truncate" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
              {loading ? '...' : card.value}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
              {card.label}
            </p>
            {card.subText && (
              <p className="text-[10px] mt-0.5 truncate" style={{ color: '#ECC796' }}>
                {card.subText}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
