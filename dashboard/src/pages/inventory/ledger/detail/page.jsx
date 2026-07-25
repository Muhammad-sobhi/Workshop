import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

const INCOMING_TYPES = ['Initial_Balance', 'Purchase_Receipt', 'Transfer_In'];

export default function LedgerPage() {
  const { type, id } = useParams();
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/inventory/ledger/${type}/${id}`)
      .then(res => setLedgerData(res.data))
      .finally(() => setLoading(false));
  }, [type, id]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            to="/inventory"
            className="p-2 rounded-xl border transition-colors hover:bg-white/5 text-[#A49EC0]"
            style={{ borderColor: '#3D3554' }}
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">دفتر الأستاذ / الحركة تفصيلياً</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              سجل كافة الحركات التراكمية على العنصر (الوارد والمنصرف والرصيد اللحظي)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#A49EC0]">جاري تحميل البيانات...</div>
        ) : !ledgerData ? (
          <div className="text-center py-12 text-red-400">عذراً، تعذر جلب سجل الحركة.</div>
        ) : (
          <>
            {/* Header info card */}
            <div className="rounded-2xl border p-6 flex flex-wrap justify-between items-center gap-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div>
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium inline-block mb-2" style={{ background: 'rgba(236,199,150,0.15)', color: '#ECC796' }}>
                  {ledgerData.item.type === 'material' ? 'مادة خام / خدمة' : 'منتج تام'}
                </span>
                <h2 className="text-xl font-bold text-white">{ledgerData.item.name}</h2>
                <p className="text-xs text-[#A49EC0] mt-1">كود/رمز: {ledgerData.item.code || '---'}</p>
              </div>

              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-[#A49EC0]">إجمالي الوارد</p>
                  <p className="text-lg font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {ledgerData.summary.total_in} {ledgerData.item.unit}
                  </p>
                </div>
                <div className="text-center border-r pr-6" style={{ borderColor: '#3D3554' }}>
                  <p className="text-xs text-[#A49EC0]">إجمالي المنصرف</p>
                  <p className="text-lg font-bold text-rose-400 mt-1 flex items-center justify-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    {ledgerData.summary.total_out} {ledgerData.item.unit}
                  </p>
                </div>
                <div className="text-center border-r pr-6" style={{ borderColor: '#3D3554' }}>
                  <p className="text-xs text-[#A49EC0]">الرصيد المتبقي الحالي</p>
                  <p className="text-xl font-black text-[#ECC796] mt-1">
                    {ledgerData.summary.current_balance} {ledgerData.item.unit}
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div className="p-4 border-b font-semibold text-white flex justify-between items-center" style={{ borderColor: '#3D3554' }}>
                <span>تاريخ حركات العنصر الحسابية</span>
                <span className="text-xs font-normal text-[#A49EC0]">عدد الحركات: {ledgerData.movements.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-xs text-[#A49EC0] border-b" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
                    <tr>
                      <th className="p-4">التاريخ والوقت</th>
                      <th className="p-4">نوع الحركة</th>
                      <th className="p-4">المستودع</th>
                      <th className="p-4">الكمية</th>
                      <th className="p-4">المرجع</th>
                      <th className="p-4">الرصيد التراكمي اللحظي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#3D3554' }}>
                    {ledgerData.movements.map((m) => {
                      const isIncoming = INCOMING_TYPES.includes(m.type);
                      return (
                        <tr key={m.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-[#D4CEEB] text-xs">
                            {new Date(m.date).toLocaleString('ar-SA')}
                          </td>
                          <td className="p-4">
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                              isIncoming ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {m.type_label}
                            </span>
                          </td>
                          <td className="p-4 text-white font-medium">{m.warehouse_name}</td>
                          <td className="p-4 font-bold">
                            <span className={isIncoming ? 'text-emerald-400' : 'text-rose-400'}>
                              {isIncoming ? '+' : '-'}{m.quantity} {ledgerData.item.unit}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-[#A49EC0]">{m.reference || '---'}</td>
                          <td className="p-4 font-extrabold text-[#ECC796]">
                            {m.running_balance} {ledgerData.item.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
