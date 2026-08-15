'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, Search, Filter, Layers, Clock, Cog, PackageCheck, Truck, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import ProductionStats from '@/components/production/ProductionStats';
import ProductionOrderCard from '@/components/production/ProductionOrderCard';
import ProductionOrderForm from '@/components/production/ProductionOrderForm';
import MaterialsCheckModal from '@/components/production/MaterialsCheckModal';
import PaymentModal from '@/components/production/PaymentModal';
import ConfirmDialog from '@/components/production/ConfirmDialog';
import CreateExternalOrderModal from '@/components/external-services/CreateExternalOrderModal';

export default function ProductionPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';
  const [operations, setOperations] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCheck, setShowCheck] = useState(null);
  const [expandedOp, setExpandedOp] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [esoTargetOp, setEsoTargetOp] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'pending' | 'in_progress' | 'completed' | 'delivered' | 'debt'
  const [selectedClient, setSelectedClient] = useState('all');

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/operations?page=${p}&per_page=50`),
      apiClient.get('/inventory/products?per_page=200'),
      apiClient.get('/warehouses?per_page=200'),
      apiClient.get('/clients?per_page=200'),
      apiClient.get('/suppliers?per_page=200'),
      apiClient.get('/materials?per_page=9999'),
    ]).then(([opRes, prodRes, whRes, clientRes, supRes, matRes]) => {
      const d = opRes.data;
      setOperations(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setProducts(prodRes.data?.data ?? prodRes.data ?? []);
      setWarehouses(whRes.data?.data ?? whRes.data ?? []);
      setClients(clientRes.data?.data ?? clientRes.data ?? []);
      setSuppliers(supRes.data?.data ?? supRes.data ?? []);
      setMaterials(matRes.data?.data ?? matRes.data ?? []);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => { fetchAll(); }, []);

  const checkAvailability = async (op) => {
    try {
      const res = await apiClient.get(`/operations/${op.id}/check-materials`);
      setShowCheck(res.data);
    } catch (err) {
      setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فحص المواد غير متاح' });
    }
  };

  const completeOperation = async (id) => {
    setConfirmDialog({
      type: 'confirm',
      message: 'هل تم الانتهاء من الإنتاج وتريد توريد المنتج للمستودع؟',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/operations/${id}/complete`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في إكمال عملية الإنتاج' });
        }
      }
    });
  };

  const cancelProductionOrder = async (id) => {
    const op = operations.find(o => o.id === id);
    const isCompleted = op?.status === 'Completed';

    const msg = isCompleted
      ? 'هل أنت متأكد من إلغاء أمر التشغيل؟ نظراً لأن المنتجات تم تصنيعها بالفعل، سيقوم النظام بنقلها تلقائياً إلى مستودع المنتجات الجاهزة (المعرض) لتصبح متاحة للبيع لأي عميل آخر، مع حفظ حقوق الورشة.'
      : 'هل تريد إلغاء أمر الإنتاج هذا؟ سيتم إلغاء الأمر والتراجع عن القيود المالية والمخزنية.';

    setConfirmDialog({
      type: 'confirm',
      message: msg,
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/operations/${id}/cancel`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في إلغاء عملية الإنتاج' });
        }
      }
    });
  };

  const deleteProductionOrder = async (id) => {
    setConfirmDialog({
      type: 'confirm',
      message: 'هل تريد حذف أمر الإنتاج هذا نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          const res = await apiClient.delete(`/operations/${id}`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في حذف أمر الإنتاج' });
        }
      }
    });
  };

  const totalPaid = (op) => {
    const dep = parseFloat(op.deposit_paid) || 0;
    const pmts = (op.payments || []).reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0);
    return dep + pmts;
  };

  const remaining = (op) => {
    const tot = parseFloat(op.total_price) || 0;
    return tot - totalPaid(op);
  };

  const deliverOperation = async (op) => {
    setConfirmDialog({
      type: 'confirm',
      message: `هل أنت متأكد من تسليم منتجات أمر الإنتاج (${op.operation_number}) إلى العميل (${op.client?.name})؟`,
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/operations/${op.id}/deliver`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في تسليم الطلبية' });
        }
      }
    });
  };

  const deletePayment = async (opId, paymentId) => {
    setConfirmDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من إلغاء والتراجع عن هذه الدفعة المالية؟',
      onConfirm: async () => {
        try {
          const res = await apiClient.delete(`/operations/${opId}/payments/${paymentId}`);
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في إلغاء الدفعة' });
        }
      }
    });
  };

  // Filtered Operations
  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      // Status filter
      if (activeFilter === 'pending' && op.status !== 'Pending') return false;
      if (activeFilter === 'in_progress' && op.status !== 'In_Progress') return false;
      if (activeFilter === 'completed' && op.status !== 'Completed') return false;
      if (activeFilter === 'delivered' && op.status !== 'Delivered') return false;
      if (activeFilter === 'debt') {
        const rem = remaining(op);
        if (rem <= 0) return false;
      }

      // Client filter
      if (selectedClient !== 'all') {
        if (selectedClient === 'stock' && op.client_id) return false;
        if (selectedClient !== 'stock' && String(op.client_id) !== String(selectedClient)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = op.operation_number?.toLowerCase().includes(q);
        const clientMatch = op.client?.name?.toLowerCase().includes(q);
        const notesMatch = op.notes?.toLowerCase().includes(q);
        const prodMatch = op.operation_products?.some(p => p.product?.name?.toLowerCase().includes(q));
        if (!numMatch && !clientMatch && !notesMatch && !prodMatch) {
          return false;
        }
      }

      return true;
    });
  }, [operations, activeFilter, selectedClient, searchQuery]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#ECC796]" />
              <span>خطوط الإنتاج والتصنيع</span>
            </h1>
            <p className="text-sm mt-1 text-[#A49EC0]">
              إدارة أوامر التصنيع، متابعة تسليمات العملاء، وتتبع كروت التشغيل والمدفوعات
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 hover:opacity-90 self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            <span>أمر إنتاج جديد</span>
          </button>
        </div>

        {/* 5 KPI Stage Cards */}
        <ProductionStats
          operations={operations}
          loading={loading}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />

        {/* Smart Search & Filter Bar */}
        <div
          className="rounded-2xl border p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md"
          style={{ background: '#2F264C', borderColor: '#3D3554' }}
        >
          {/* Search & Client selector */}
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الأمر، العميل، المنتج..."
                className="w-full rounded-xl py-2 pr-10 pl-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-white focus:border-[#ECC796]"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full rounded-xl py-2 px-3 text-xs border outline-none transition-all bg-[#231B3D] border-[#3D3554] text-[#D4CEEB] focus:border-[#ECC796]"
              >
                <option value="all">كل العملاء والمخزون</option>
                <option value="stock">📦 تصنيع كمخزون للمعرض</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-[#ECC796] text-[#201A30] shadow'
                  : 'bg-[#231B3D] text-[#D4CEEB] hover:bg-white/5 border border-[#3D3554]'
              }`}
            >
              الكل ({operations.length})
            </button>

            <button
              onClick={() => setActiveFilter('in_progress')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === 'in_progress'
                  ? 'bg-[#8D7EC8] text-white shadow'
                  : 'bg-[#231B3D] text-[#8D7EC8] hover:bg-[#8D7EC8]/10 border border-[#8D7EC8]/30'
              }`}
            >
              <Cog className="w-3 h-3" />
              <span>قيد التصنيع</span>
            </button>

            <button
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-[#231B3D] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
              }`}
            >
              <PackageCheck className="w-3 h-3" />
              <span>جاهز للتسليم</span>
            </button>

            <button
              onClick={() => setActiveFilter('delivered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === 'delivered'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#231B3D] text-blue-400 hover:bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>تم التسليم</span>
            </button>

            <button
              onClick={() => setActiveFilter('debt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === 'debt'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-[#231B3D] text-red-400 hover:bg-red-500/10 border border-red-500/30'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>عليه متبقي</span>
            </button>
          </div>
        </div>

        {/* Production Order Cards Grid */}
        {loading ? (
          <div className="text-center py-16 text-xs text-[#A49EC0]">جاري تحميل أوامر الإنتاج...</div>
        ) : filteredOperations.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl border flex flex-col items-center justify-center gap-3"
            style={{ background: '#201A30', borderColor: '#3D3554', color: '#A49EC0' }}
          >
            <Layers className="w-10 h-10 text-[#3D3554]" />
            <p className="text-sm">لا توجد أوامر إنتاج مطابقة للبحث أو الفلتر المختار</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOperations.map(op => (
              <ProductionOrderCard
                key={op.id}
                op={op}
                currency={currency}
                totalPaid={totalPaid}
                remaining={remaining}
                expandedOp={expandedOp}
                onToggleExpand={setExpandedOp}
                onCheck={checkAvailability}
                onComplete={completeOperation}
                onShowPayment={setShowPayment}
                onCancel={cancelProductionOrder}
                onDelete={deleteProductionOrder}
                onCreateExternalService={(op) => setEsoTargetOp(op)}
                onDeliver={deliverOperation}
                onDeletePayment={deletePayment}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />

        {/* Modals & Dialogs */}
        <ProductionOrderForm
          showCreate={showCreate}
          setShowCreate={setShowCreate}
          products={products}
          warehouses={warehouses}
          clients={clients}
          currency={currency}
          fetchAll={fetchAll}
          setConfirmDialog={setConfirmDialog}
        />

        <MaterialsCheckModal
          showCheck={showCheck}
          setShowCheck={setShowCheck}
          warehouses={warehouses}
          fetchAll={fetchAll}
          setConfirmDialog={setConfirmDialog}
        />

        <PaymentModal
          showPayment={showPayment}
          setShowPayment={setShowPayment}
          currency={currency}
          totalPaid={totalPaid}
          remaining={remaining}
          fetchAll={fetchAll}
        />

        {esoTargetOp && (
          <CreateExternalOrderModal
            isOpen={!!esoTargetOp}
            onClose={() => setEsoTargetOp(null)}
            suppliers={suppliers}
            materials={materials}
            products={products}
            defaultOperationId={esoTargetOp.id}
            defaultDescription={`خدمة تشغيل لأمر إنتاج ${esoTargetOp.operation_number} - ${(esoTargetOp.operation_products || []).map(p => p.product?.name).join(', ')}`}
            defaultQuantity={esoTargetOp.quantity ? esoTargetOp.quantity.toString() : '1'}
            onSuccess={() => {
              setConfirmDialog({ type: 'alert', message: 'تم إرسال أمر التشغيل الخارجي لـ الورشة بنجاح وتوثيقه لحساب أمر الإنتاج' });
              fetchAll();
            }}
          />
        )}

        {confirmDialog && (
          <ConfirmDialog
            confirmDialog={confirmDialog}
            setConfirmDialog={setConfirmDialog}
          />
        )}
      </div>
    </MainLayout>
  );
}
