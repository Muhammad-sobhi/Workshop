'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import ProductionStats from '@/components/production/ProductionStats';
import ProductionOrderCard from '@/components/production/ProductionOrderCard';
import ProductionOrderForm from '@/components/production/ProductionOrderForm';
import MaterialsCheckModal from '@/components/production/MaterialsCheckModal';
import PaymentModal from '@/components/production/PaymentModal';
import ConfirmDialog from '@/components/production/ConfirmDialog';

export default function ProductionPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'ر.س';
  const [operations, setOperations] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCheck, setShowCheck] = useState(null);
  const [expandedOp, setExpandedOp] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/operations?page=${p}&per_page=20`),
      apiClient.get('/inventory/products?per_page=200'),
      apiClient.get('/warehouses?per_page=200'),
      apiClient.get('/clients?per_page=200'),
    ]).then(([opRes, prodRes, whRes, clientRes]) => {
      const d = opRes.data;
      setOperations(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setProducts(prodRes.data?.data ?? prodRes.data ?? []);
      setWarehouses(whRes.data?.data ?? whRes.data ?? []);
      setClients(clientRes.data?.data ?? clientRes.data ?? []);
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

  const totalPaid = (op) => {
    const dep = parseFloat(op.deposit_paid) || 0;
    const pmts = (op.payments || []).reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0);
    return dep + pmts;
  };

  const remaining = (op) => {
    const tot = parseFloat(op.total_price) || 0;
    return tot - totalPaid(op);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">خطوط الإنتاج والتصنيع</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إدارة أوامر التصنيع، ربط الطلبات بالعملاء وتتبع المدفوعات
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            أمر إنتاج جديد
          </button>
        </div>

        <ProductionStats operations={operations} loading={loading} />

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : operations.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border" style={{ background: '#201A30', borderColor: '#3D3554', color: '#A49EC0' }}>لا توجد أوامر إنتاج</div>
          ) : (
            operations.map(op => (
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
              />
            ))
          )}
        </div>
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />

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
