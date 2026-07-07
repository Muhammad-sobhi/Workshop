'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus } from 'lucide-react';
import AlertDialog from '@/components/AlertDialog';
import Pagination from '@/components/Pagination';
import ProcurementStats from '@/components/procurement/procurement-stats';
import ProcurementOrderTable from '@/components/procurement/procurement-order-table';
import ProcurementForm from '@/components/procurement/procurement-form';
import OrderViewModal from '@/components/procurement/order-view-modal';

export default function ProcurementPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [depositPaid, setDepositPaid] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/purchase-orders?page=${p}`),
      apiClient.get('/materials?per_page=200'),
      apiClient.get('/suppliers?per_page=200'),
    ]).then(([poRes, matRes, suppRes]) => {
      const d = poRes.data;
      setOrders(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setMaterials(matRes.data?.data ?? matRes.data ?? []);
      setSuppliers(suppRes.data?.data ?? suppRes.data ?? []);
    }).finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setMsg('يرجى اختيار مادة واحدة على الأقل وتحديد الكمية والسعر بالضغط عليها');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await apiClient.post('/purchase-orders', {
        supplier_id: parseInt(supplierId),
        order_date: orderDate,
        notes,
        deposit_paid: depositPaid ? parseFloat(depositPaid) : 0,
        items: items.map(item => ({
          material_id: parseInt(item.material_id),
          quantity: parseFloat(item.quantity),
          unit_cost: parseFloat(item.unit_cost),
        }))
      });
      setMsg('تم إنشاء أمر الشراء بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowCreate(false);
        setSupplierId('');
        setNotes('');
        setItems([]);
        setDepositPaid('');
        setDepositPaymentMethod('');
        setMsg('');
      }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const openView = (order) => {
    apiClient.get(`/purchase-orders/${order.id}`).then(res => {
      setViewOrder(res.data);
    });
  };

  const receiveOrder = async (id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل تريد استلام البضائع وتحديث المستودع؟ (سيتم تسجيل مصروفات تلقائياً)',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/purchase-orders/${id}/receive`);
          setAlertDialog({ type: 'alert', message: res.data.message });
          fetchAll();
          setViewOrder(null);
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء الاستلام' });
        }
      }
    });
  };

  const closeCreate = () => {
    setShowCreate(false);
    setSupplierId('');
    setNotes('');
    setItems([]);
    setDepositPaid('');
    setDepositPaymentMethod('');
    setMsg('');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">المشتريات والتوريد</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إدارة طلبات شراء المواد الخام واستلام الشحنات وتحديث المخازن
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setMsg(''); setItems([]); setSupplierId(''); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            أمر شراء جديد
          </button>
        </div>

        <ProcurementStats orders={orders} loading={loading} />
        <ProcurementOrderTable orders={orders} loading={loading} onViewOrder={openView} />
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />

        <ProcurementForm
          showCreate={showCreate}
          onClose={closeCreate}
          suppliers={suppliers}
          materials={materials}
          supplierId={supplierId}
          setSupplierId={setSupplierId}
          orderDate={orderDate}
          setOrderDate={setOrderDate}
          notes={notes}
          setNotes={setNotes}
          items={items}
          setItems={setItems}
          depositPaid={depositPaid}
          setDepositPaid={setDepositPaid}
          depositPaymentMethod={depositPaymentMethod}
          setDepositPaymentMethod={setDepositPaymentMethod}
          msg={msg}
          saving={saving}
          onSubmit={handleSubmit}
          setAlertDialog={setAlertDialog}
        />

        <OrderViewModal
          viewOrder={viewOrder}
          onClose={() => setViewOrder(null)}
          onReceive={receiveOrder}
        />

        <AlertDialog
          alertDialog={alertDialog}
          onClose={() => setAlertDialog(null)}
        />
      </div>
    </MainLayout>
  );
}
