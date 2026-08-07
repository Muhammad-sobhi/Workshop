'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/main-layout';
import apiClient from '@/lib/api-client';
import { Plus, Search, Truck, DollarSign, Clock, CheckCircle2, AlertTriangle, FileText, Printer, ArrowUpRight } from 'lucide-react';
import Pagination from '@/components/Pagination';
import AlertDialog from '@/components/AlertDialog';
import CreateExternalOrderModal from '@/components/external-services/CreateExternalOrderModal';
import PaymentAndDetailsModal from '@/components/external-services/PaymentAndDetailsModal';
import PrintVoucherModal from '@/components/external-services/PrintVoucherModal';

const statusBadges = {
  sent: { label: 'بالخارج (قيد التشغيل)', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#F59E0B' },
  partially_received: { label: 'مستلم جزئياً', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', color: '#3B82F6' },
  completed: { label: 'تم الاستلام بالكامل', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', color: '#10B981' },
  cancelled: { label: 'ملغي', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' },
};

export default function ExternalServicesPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({ total_orders: 0, total_cost: 0, total_paid: 0, total_balance: 0 });

  // Modals & Analytics
  const [analyticsData, setAnalyticsData] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);

  const fetchOrders = (p = 1) => {
    setLoading(true);
    let url = `/external-service-orders?page=${p}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;
    if (supplierFilter) url += `&supplier_id=${supplierFilter}`;

    apiClient.get(url)
      .then(res => {
        setOrders(res.data?.orders?.data || []);
        setPagination({
          currentPage: res.data?.orders?.current_page || 1,
          lastPage: res.data?.orders?.last_page || 1,
          total: res.data?.orders?.total || 0,
        });
        setStats(res.data?.stats || { total_orders: 0, total_cost: 0, total_paid: 0, total_balance: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchDependencies = () => {
    Promise.all([
      apiClient.get('/suppliers'),
      apiClient.get('/materials'),
      apiClient.get('/products'),
    ]).then(([supRes, matRes, prodRes]) => {
      setSuppliers(supRes.data?.data || supRes.data || []);
      setMaterials(matRes.data?.data || matRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    }).catch(err => console.error(err));
  };

  useEffect(() => {
    fetchOrders(1);
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [search, statusFilter, supplierFilter]);

  const handlePageChange = (p) => {
    setPage(p);
    fetchOrders(p);
  };

  const handleDelete = (id, orderNumber) => {
    setAlertDialog({
      type: 'confirm',
      message: `هل تريد حذف أمر التشغيل الخارجي "${orderNumber}" والمدفوعات المسجلة عليه؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/external-service-orders/${id}`);
          fetchOrders(page);
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message || 'حدث خطأ أثناء الحذف' });
        }
      }
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">الخدمات الخارجية والمقاولين</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إرسال ومتابعة كراسي وأصناف للتشغيل والدهان بالخارج وتسديد المستحقات بـ Instapay
            </p>
          </div>

          <div className="flex gap-2.5 self-start sm:self-auto">
            <button
              onClick={async () => {
                if (!showAnalytics && !analyticsData) {
                  try {
                    const res = await apiClient.get('/external-service-orders/analytics');
                    setAnalyticsData(res.data);
                  } catch (e) {
                    console.error(e);
                  }
                }
                setShowAnalytics(!showAnalytics);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-[#2F264C] text-[#ECC796] border border-[#3D3554] hover:bg-white/5"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{showAnalytics ? 'إخفاء الإحصائيات' : 'تقارير الورش والربحية'}</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4 h-4" />
              <span>+ أمر تشغيل خارجي جديد</span>
            </button>
          </div>
        </div>

        {showAnalytics && analyticsData && (
          <div className="p-5 rounded-2xl bg-[#231B3D] border border-[#3D3554] space-y-4">
            <h3 className="font-bold text-sm text-[#ECC796] flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" /> إحصائيات تقييم الموردين والورش الخارجية الأكثر تعاملاً
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-[#A49EC0] font-semibold">أكثر 5 ورش خارجية سداداً وحجماً للأوامر:</p>
                {analyticsData.top_suppliers?.map((sup, idx) => (
                  <div key={sup.id} className="p-3 rounded-xl bg-[#2F264C] border border-[#3D3554] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white ml-2">{idx + 1}. {sup.name}</span>
                      <span className="text-[11px] text-[#A49EC0]">({sup.total_orders} أمر تشغيل)</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#ECC796]">EGP {parseFloat(sup.total_spent || 0).toLocaleString('ar-SA')}</p>
                      {parseFloat(sup.total_debt || 0) > 0 && (
                        <p className="text-[10px] text-red-400">دين متبقي: {parseFloat(sup.total_debt).toLocaleString('ar-SA')} جم</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-[#A49EC0] font-semibold">توزيع حالات أوامر التشغيل بالورش:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                    <p className="text-[#A49EC0]">أوامر بالخارج (قيد الدهان)</p>
                    <p className="text-xl font-bold text-amber-400 mt-1">{analyticsData.status_breakdown?.sent || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                    <p className="text-[#A49EC0]">مستلم جزئياً</p>
                    <p className="text-xl font-bold text-blue-400 mt-1">{analyticsData.status_breakdown?.partially_received || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                    <p className="text-[#A49EC0]">تم الاستلام بالكامل</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">{analyticsData.status_breakdown?.completed || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#2F264C] border border-[#3D3554]">
                    <p className="text-[#A49EC0]">إجمالي الديون المسجلة</p>
                    <p className="text-xl font-bold text-red-400 mt-1">EGP {analyticsData.total_balance?.toLocaleString('ar-SA')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي أوامر التشغيل', value: stats.total_orders, icon: Truck, color: '#ECC796' },
            { label: 'إجمالي تكلفة الخدمات', value: `EGP ${stats.total_cost.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: '#ECC796' },
            { label: 'إجمالي المسدد', value: `EGP ${stats.total_paid.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: CheckCircle2, color: '#10B981' },
            { label: 'إجمالي المتبقي (الديون)', value: `EGP ${stats.total_balance.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: AlertTriangle, color: stats.total_balance > 0 ? '#EF4444' : '#10B981' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 flex items-center gap-4 font-semibold shadow-lg"
              style={{ background: '#2F264C', backgroundColor: '#2F264C', borderColor: '#3D3554' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: stat.color === '#EF4444' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(236, 199, 150, 0.2)' }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-black tracking-tight" style={{ color: stat.color }}>
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-xs font-bold mt-1" style={{ color: '#D4CEEB' }}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A49EC0]" />
            <input
              type="text"
              placeholder="بحث برقم الأمر، اسم المورد، أو بيان الصنف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm outline-none bg-[#2F264C] border-[#3D3554] text-white"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border text-xs font-semibold bg-[#2F264C] border-[#3D3554] text-white outline-none"
            >
              <option value="">جميع الورش / الموردين</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {(['all', 'sent', 'partially_received', 'completed']).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-[#ECC796] text-[#201A30]'
                    : 'bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white'
                }`}
              >
                {st === 'all' ? 'الكل' : statusBadges[st]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table / Mobile Cards Container */}
        <div>
          {loading ? (
            <div className="text-center py-16 text-xs text-[#A49EC0]">جاري التحميل...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-xs text-[#A49EC0]">لا توجد أمر تشغيل مسجلة</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-2xl border overflow-hidden shadow-xl" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
                        {['رقم الأمر', 'الورشة / المورد', 'الصنف والكمية', 'التكلفة الإجمالية', 'المدفوع', 'المتبقي (الرصيد)', 'الحالة', 'الإجراءات'].map(h => (
                          <th key={h} className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-[#D4CEEB]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => {
                        const totalCost = parseFloat(o.total_cost || 0);
                        const totalPaid = parseFloat(o.total_paid || 0);
                        const balance = totalCost - totalPaid;
                        const st = statusBadges[o.status] || statusBadges.sent;

                        return (
                          <tr
                            key={o.id}
                            className="border-b transition-colors hover:bg-white/5"
                            style={{ borderColor: '#3D3554', background: '#2F264C' }}
                          >
                            <td className="px-5 py-4 font-bold text-[#ECC796] font-mono">{o.order_number}</td>
                            <td className="px-5 py-4 font-bold text-white">{o.supplier?.name || '—'}</td>
                            <td className="px-5 py-4">
                              <p className="font-bold text-white">{o.item_description}</p>
                              <p className="text-xs font-semibold text-[#10B981] mt-0.5">{o.quantity} {o.unit} × {o.unit_cost} EGP</p>
                            </td>
                            <td className="px-5 py-4 font-bold text-white">
                              EGP {totalCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-4 font-bold text-emerald-400">
                              EGP {totalPaid.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`font-bold text-sm ${balance > 0 ? 'text-red-400' : balance < 0 ? 'text-emerald-400' : 'text-[#ECC796]'}`}>
                                EGP {Math.abs(balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                              </span>
                              <p className="text-[10px] text-[#A49EC0]">
                                {balance > 0 ? 'مستحق للمورد' : balance < 0 ? 'رصيد لكم' : 'مسدد'}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                                style={{ background: st.bg, borderColor: st.border, color: st.color }}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedOrder(o);
                                    setShowDetailsModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#231B3D] text-[#ECC796] border border-[#3D3554] hover:bg-white/10 transition-colors"
                                >
                                  المدفوعات والتفاصيل
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedOrder(o);
                                    setShowPrintModal(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-[#231B3D] text-[#ECC796] border border-[#3D3554] hover:bg-white/10 transition-colors"
                                  title="طباعة PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDelete(o.id, o.order_number)}
                                  className="p-1.5 rounded-lg bg-[#231B3D] text-red-400 border border-[#3D3554] hover:bg-red-500/10 transition-colors"
                                  title="حذف"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Responsive Cards */}
              <div className="block md:hidden space-y-3">
                {orders.map((o) => {
                  const totalCost = parseFloat(o.total_cost || 0);
                  const totalPaid = parseFloat(o.total_paid || 0);
                  const balance = totalCost - totalPaid;
                  const st = statusBadges[o.status] || statusBadges.sent;

                  return (
                    <div key={`mob-ext-${o.id}`} className="rounded-2xl border p-4 space-y-3 shadow-lg bg-[#2F264C] border-[#3D3554]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#ECC796]">{o.order_number}</span>
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                          style={{ background: st.bg, borderColor: st.border, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-white">{o.supplier?.name || '—'}</h4>
                        <p className="text-xs text-[#D4CEEB] mt-0.5">{o.item_description}</p>
                        <p className="text-xs font-semibold text-[#10B981] mt-1">{o.quantity} {o.unit} × EGP {o.unit_cost}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#231B3D] border border-[#3D3554] text-center text-xs">
                        <div>
                          <span className="block text-[10px] text-[#A49EC0]">التكلفة</span>
                          <span className="font-bold text-white">{totalCost.toLocaleString('ar-SA')}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#A49EC0]">المدفوع</span>
                          <span className="font-bold text-emerald-400">{totalPaid.toLocaleString('ar-SA')}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#A49EC0]">المتبقي</span>
                          <span className={`font-bold ${balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{Math.abs(balance).toLocaleString('ar-SA')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setSelectedOrder(o);
                            setShowDetailsModal(true);
                          }}
                          className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#231B3D] text-[#ECC796] border border-[#3D3554] text-center"
                        >
                          المدفوعات والتفاصيل
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(o);
                            setShowPrintModal(true);
                          }}
                          className="p-2 rounded-xl bg-[#231B3D] text-[#ECC796] border border-[#3D3554]"
                          title="طباعة PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(o.id, o.order_number)}
                          className="p-2 rounded-xl bg-[#231B3D] text-red-400 border border-[#3D3554]"
                          title="حذف"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />

        {/* Modals */}
        <CreateExternalOrderModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          suppliers={suppliers}
          materials={materials}
          products={products}
          onSuccess={() => fetchOrders(page)}
        />

        <PaymentAndDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          order={selectedOrder}
          onSuccess={() => {
            fetchOrders(page);
            if (selectedOrder) {
              apiClient.get(`/external-service-orders/${selectedOrder.id}`)
                .then(res => setSelectedOrder(res.data));
            }
          }}
          onPrint={(ord) => {
            setSelectedOrder(ord);
            setShowPrintModal(true);
          }}
        />

        <PrintVoucherModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          order={selectedOrder}
        />

        <AlertDialog
          alertDialog={alertDialog}
          onClose={() => setAlertDialog(null)}
        />
      </div>
    </MainLayout>
  );
}

function Trash2Icon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  );
}
