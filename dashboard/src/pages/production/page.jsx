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
import CreateExternalOrderModal from '@/components/external-services/CreateExternalOrderModal';

export default function ProductionPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'ر.س';
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

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/operations?page=${p}&per_page=20`),
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
    setConfirmDialog({
      type: 'confirm',
      message: 'هل تريد إلغاء أمر الإنتاج هذا؟ سيتم إرجاع المواد الخام لـ المخزون، وخصم أي منتج مكتمل من المستودع، وإلغاء القيود المالية.',
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
      message: `هل تريد تسليم الطلبية للعميل (${op.client?.name || ''}) وخصم المنتجات المصنعة من مخزن المنتجات الجاهزة تلقائياً؟`,
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
                onCancel={cancelProductionOrder}
                onDelete={deleteProductionOrder}
                onCreateExternalService={(op) => setEsoTargetOp(op)}
                onDeliver={deliverOperation}
                onDeletePayment={deletePayment}
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
