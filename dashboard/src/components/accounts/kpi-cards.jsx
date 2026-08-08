import { ArrowUpRight, ArrowDownRight, Scale, TrendingUp, TrendingDown, Box, Calculator, DollarSign, PieChart, Layers } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function KpiCards({ loading, totalRevenue, totalExpense, totalProductCost = 0, netProfit, profitMargin, inventoryValue = 0, currency, clientDebts = [], supplierDebts = [] }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const grossProfit = totalRevenue - totalProductCost;

  const steps = [
    { num: '١', title: 'إيرادات المبيعات', subtitle: 'إيرادات ما تم استلامه وتسجيله بالفعل', value: totalRevenue, color: '#10B981', sign: '+' },
    { num: '٢', title: 'تكلفة الإنتاج والمواد الخام', subtitle: 'تكلفة المواد الخام والخدمات الخارجية والتصنيع', value: totalProductCost, color: '#EF4444', sign: '-' },
    { num: '٣', title: 'مجمل الربح', subtitle: 'إيرادات المبيعات - تكلفة الإنتاج والمواد', value: grossProfit, color: grossProfit >= 0 ? '#3B82F6' : '#EF4444', isResult: true },
    { num: '٤', title: 'المصروفات التشغيلية', subtitle: 'أجور، إيجار، مرافق، أجهزة، وأي مصاريف أخرى', value: totalExpense, color: '#F59E0B', sign: '-' },
    { num: '٥', title: 'صافي الربح', subtitle: 'مجمل الربح - المصروفات التشغيلية', value: netProfit, color: netProfit >= 0 ? '#10B981' : '#EF4444', isResult: true, isFinal: true },
  ];

    const totalClientDebt = clientDebts.reduce((sum, c) => sum + (parseFloat(c.debt_amount) || 0), 0);
    const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + (parseFloat(s.debt_amount) || 0), 0);

    const projectedRevenue = totalRevenue + totalClientDebt;
    const projectedProductionCost = totalProductCost + totalSupplierDebt;
    const projectedGrossProfit = projectedRevenue - projectedProductionCost;
    const projectedNetProfit = projectedGrossProfit - totalExpense;

    const projectedSteps = [
      { num: '١', title: 'إجمالي الإيرادات المتوقعة', subtitle: 'الإيرادات المحصلة + ديون العملاء', value: projectedRevenue, color: '#10B981', sign: '+' },
      { num: '٢', title: 'إجمالي التكاليف المتوقعة', subtitle: 'المسدد للموردين + ديون الموردين', value: projectedProductionCost, color: '#EF4444', sign: '-' },
      { num: '٣', title: 'مجمل الربح التقديري', subtitle: 'الإيرادات المتوقعة - التكاليف المتوقعة', value: projectedGrossProfit, color: projectedGrossProfit >= 0 ? '#3B82F6' : '#EF4444', isResult: true },
      { num: '٤', title: 'المصروفات التشغيلية', subtitle: 'أجور، إيجار، مرافق، وأي مصاريف تشغيل', value: totalExpense, color: '#F59E0B', sign: '-' },
      { num: '٥', title: 'صافي الربح المستهدف (النهائي)', subtitle: 'صافي الربح المتوقع بعد تحصيل وسداد كل الديون', value: projectedNetProfit, color: projectedNetProfit >= 0 ? '#10B981' : '#EF4444', isResult: true, isFinal: true },
    ];

    return (
      <div className="space-y-5">
        {/* Actual Realized Financial Statement */}
        <div 
          className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
          style={{
            background: isLight ? '#FAF9F6' : 'rgb(47, 38, 76)',
            borderColor: isLight ? '#E2E8F0' : '#3D3554',
          }}
        >
          <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: isLight ? '#CBD5E1' : '#3D3554' }}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#ECC796' }}>
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                  الحسابات المحصلة الفعلية (النقدية الحالية)
                </h2>
                <p className="text-xs" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                  الأرباح المحققة بناءً على الأموال المحصلة والمدفوعة بالفعل في الخزينة
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
              الحساب النقدي الفعلي
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {steps.map((st, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all relative ${
                  st.isFinal ? 'ring-2 ring-[#10B981]/50' : ''
                }`}
                style={{
                  background: isLight ? (st.isFinal ? '#F0FDF4' : '#FFFFFF') : (st.isFinal ? '#1C382F' : '#231B3D'),
                  borderColor: isLight ? '#E2E8F0' : '#3D3554',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border" style={{ borderColor: st.color, color: st.color }}>
                    {st.num}
                  </span>
                  {st.sign && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-black/20" style={{ color: st.color }}>
                      {st.sign}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-white mb-0.5" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                    {st.title}
                  </h3>
                  <p className="text-[10px] leading-tight mb-2 min-h-[24px]" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                    {st.subtitle}
                  </p>
                </div>

                <div className="border-t pt-2 mt-auto" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
                  <p className="text-sm font-black font-mono" style={{ color: st.color }}>
                    {loading ? '...' : `${currency} ${st.value.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projected Financial Statement (Including all Debts) */}
        <div 
          className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
          style={{
            background: isLight ? '#F1F5F9' : 'rgb(35, 27, 61)',
            borderColor: isLight ? '#CBD5E1' : '#3D3554',
          }}
        >
          <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: isLight ? '#94A3B8' : '#3D3554' }}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl" style={{ background: '#3D3554', color: '#ECC796' }}>
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>
                  الميزانية التقديرية الشاملة (مع جميع الديون)
                </h2>
                <p className="text-xs" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                  شكل الأرباح والحسابات بعد تحصيل جميع ديون العملاء ({currency} {totalClientDebt.toFixed(2)}) وسداد ديون الموردين ({currency} {totalSupplierDebt.toFixed(2)})
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ECC796]/20 text-[#ECC796] border border-[#ECC796]/30">
              الحساب التقديري المكتمل
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {projectedSteps.map((st, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all relative ${
                  st.isFinal ? 'ring-2 ring-[#ECC796]/60' : ''
                }`}
                style={{
                  background: isLight ? (st.isFinal ? '#FEF3C7' : '#FFFFFF') : (st.isFinal ? '#2D2447' : '#1A142D'),
                  borderColor: isLight ? '#E2E8F0' : '#3D3554',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border" style={{ borderColor: st.color, color: st.color }}>
                    {st.num}
                  </span>
                  {st.sign && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-black/20" style={{ color: st.color }}>
                      {st.sign}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-white mb-0.5" style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}>
                    {st.title}
                  </h3>
                  <p className="text-[10px] leading-tight mb-2 min-h-[24px]" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                    {st.subtitle}
                  </p>
                </div>

                <div className="border-t pt-2 mt-auto" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
                  <p className="text-sm font-black font-mono" style={{ color: st.color }}>
                    {loading ? '...' : `${currency} ${st.value.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
}
