'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import SupplierClientForm from '@/components/suppliers/SupplierClientForm';
import SupplierCard from '@/components/suppliers/SupplierCard';
import SupplierStats from '@/components/suppliers/SupplierStats';
import MaterialLinkForm from '@/components/suppliers/MaterialLinkForm';
import PayDebtModal from '@/components/suppliers/PayDebtModal';
import Pagination from '@/components/Pagination';
import AlertDialog from '@/components/AlertDialog';

const emptyForm = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '', debt_amount: '', debt_due_date: '' };

export default function SuppliersPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'ر.س';
  const [suppliers, setSuppliers] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' or 'clients'
  const [allMaterials, setAllMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [alertDialog, setAlertDialog] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Add material modal
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [addMatSupplierId, setAddMatSupplierId] = useState(null);
  const [addMatId, setAddMatId] = useState('');
  const [addMatPrice, setAddMatPrice] = useState('');
  const [addMatNotes, setAddMatNotes] = useState('');
  const [addMatMsg, setAddMatMsg] = useState('');
  const [addMatSaving, setAddMatSaving] = useState(false);

  // Pay Supplier Debt modal
  const [showPayDebt, setShowPayDebt] = useState(null);
  const [payDebtForm, setPayDebtForm] = useState({ amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [payDebtFile, setPayDebtFile] = useState(null);
  const [payDebtMsg, setPayDebtMsg] = useState('');
  const [payDebtSaving, setPayDebtSaving] = useState(false);

  const fetchAll = (page = 1) => {
    setLoading(true);
    const activeUrl = activeTab === 'suppliers' ? `/suppliers?page=${page}&per_page=20` : `/clients?page=${page}&per_page=20`;
    Promise.all([
      apiClient.get(activeUrl),
      apiClient.get('/materials?per_page=9999'),
    ]).then(([resData, matRes]) => {
      const d = resData.data;
      if (activeTab === 'suppliers') {
        setSuppliers(d?.data ?? []);
      } else {
        setClients(d?.data ?? []);
      }
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      const allMats = matRes.data?.data ?? matRes.data ?? [];
      setAllMaterials(allMats);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll(1);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'clients' || tab === 'suppliers') {
        setActiveTab(tab);
      }
    }
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setMsg('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      contact_person: s.contact_person ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
      debt_amount: s.debt_amount ?? '',
      debt_due_date: s.debt_due_date ?? '',
    });
    setMsg('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const endpoint = activeTab === 'suppliers' ? '/suppliers' : '/clients';
    try {
      if (editing) {
        await apiClient.put(`${endpoint}/${editing.id}`, form);
        setMsg(activeTab === 'suppliers' ? 'تم تحديث بيانات المورد بنجاح' : 'تم تحديث بيانات العميل بنجاح');
      } else {
        await apiClient.post(endpoint, form);
        setMsg(activeTab === 'suppliers' ? 'تم إضافة المورد بنجاح' : 'تم إضافة العميل بنجاح');
      }
      fetchAll();
      setTimeout(() => { setShowForm(false); setMsg(''); }, 1200);
    } catch (err) {
      setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const isSupp = activeTab === 'suppliers';
    setAlertDialog({
      type: 'confirm',
      message: isSupp ? `هل تريد حذف المورد "${name}"؟ لا يمكن التراجع.` : `هل تريد حذف العميل "${name}"؟ لا يمكن التراجع.`,
      onConfirm: async () => {
        const endpoint = isSupp ? `/suppliers/${id}` : `/clients/${id}`;
        try {
          await apiClient.delete(endpoint);
          fetchAll();
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء الحذف' });
        }
      }
    });
  };

  const openAddMaterial = (supplierId) => {
    setAddMatSupplierId(supplierId);
    setAddMatId('');
    setAddMatPrice('');
    setAddMatNotes('');
    setAddMatMsg('');
    setShowAddMaterial(true);
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!addMatSupplierId || !addMatId) return;
    setAddMatSaving(true);
    setAddMatMsg('');
    try {
      await apiClient.post(`/suppliers/${addMatSupplierId}/materials`, {
        material_id: parseInt(addMatId),
        price: addMatPrice ? parseFloat(addMatPrice) : 0,
        notes: addMatNotes || null,
      });
      setAddMatMsg('تم ربط المادة بالمورد بنجاح');
      fetchAll();
      setTimeout(() => { setShowAddMaterial(false); setAddMatMsg(''); }, 1000);
    } catch (err) {
      setAddMatMsg(err?.response?.data?.message ?? 'حدث خطأ');
    } finally {
      setAddMatSaving(false);
    }
  };

  const openPayDebt = (supplier) => {
    setShowPayDebt(supplier);
    setPayDebtForm({
      amount: '',
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setPayDebtFile(null);
    setPayDebtMsg('');
  };

  const handlePayDebtSubmit = async (e) => {
    e.preventDefault();
    if (!showPayDebt) return;
    setPayDebtSaving(true);
    setPayDebtMsg('');
    try {
      const fd = new FormData();
      fd.append('amount', payDebtForm.amount);
      fd.append('payment_method', payDebtForm.payment_method);
      fd.append('payment_date', payDebtForm.payment_date);
      fd.append('notes', payDebtForm.notes);
      if (payDebtFile) {
        fd.append('receipt', payDebtFile);
      }

      const url = activeTab === 'suppliers'
        ? `/suppliers/${showPayDebt.id}/settle-bulk-debt`
        : `/clients/${showPayDebt.id}/pay-debt`;

      await apiClient.post(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPayDebtMsg(activeTab === 'suppliers' ? 'تم تسجيل عملية سداد الدين بنجاح وتحديث الحسابات' : 'تم تسجيل دفعة العميل وتحديث الحسابات والمراحل بنجاح');
      fetchAll();
      setTimeout(() => {
        setShowPayDebt(null);
        setPayDebtMsg('');
      }, 1200);
    } catch (err) {
      setPayDebtMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء السداد');
    } finally {
      setPayDebtSaving(false);
    }
  };

  const handleRemoveMaterial = async (supplierId, materialId, materialName) => {
    setAlertDialog({
      type: 'confirm',
      message: `إلغاء ربط المادة "${materialName}" من هذا المورد؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/suppliers/${supplierId}/materials/${materialId}`);
          fetchAll();
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ' });
        }
      }
    });
  };

  const handleUndoSupplierPayment = async (supplierId, expenseId) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من التراجع عن دفعة سداد المورد وإلغاء القيد المالي المتعلق بها؟',
      onConfirm: async () => {
        try {
          const res = await apiClient.delete(`/suppliers/${supplierId}/payments/${expenseId}`);
          setAlertDialog({ type: 'alert', message: res.data.message });
          fetchAll();
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في إلغاء عملية السداد' });
        }
      }
    });
  };

  const currentList = activeTab === 'suppliers' ? suppliers : clients;
  const totalDebt = currentList.reduce((acc, item) => acc + (parseFloat(item.debt_amount) || 0), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {activeTab === 'suppliers' ? 'الموردون والجهات الخارجية' : 'العملاء والجهات الطالبة'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              {activeTab === 'suppliers'
                ? 'إدارة موردي المواد الخام والخدمات وتتبع الديون المستحقة لهم'
                : 'إدارة عملاء الورشة والطلبات وتتبع الديون المستحقة عليهم'}
            </p>
          </div>
          <div className="flex gap-2">
            <label
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg cursor-pointer bg-[#2F264C] border border-[#3D3554] text-[#ECC796] self-start"
            >
              <span>استيراد CSV</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('type', activeTab);
                  try {
                    setLoading(true);
                    const res = await apiClient.post('/bulk-import', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    setAlertDialog({ type: 'alert', message: res.data.message || 'تم استيراد البيانات بنجاح' });
                    fetchAll();
                  } catch (err) {
                    setAlertDialog({ type: 'alert', message: err?.response?.data?.message || 'فشل في استيراد الملف' });
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </label>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'suppliers' ? 'إضافة مورد جديد' : 'إضافة عميل جديد'}
            </button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-4 border-b border-white/10 pb-2">
          <button
            onClick={() => { setActiveTab('suppliers'); setExpandedId(null); }}
            className={`text-base font-bold pb-2 border-b-2 transition-all ${activeTab === 'suppliers' ? 'border-[#ECC796] text-[#ECC796]' : 'border-transparent text-gray-400'}`}
          >
            صفحة الموردين
          </button>
          <button
            onClick={() => { setActiveTab('clients'); setExpandedId(null); }}
            className={`text-base font-bold pb-2 border-b-2 transition-all ${activeTab === 'clients' ? 'border-[#ECC796] text-[#ECC796]' : 'border-transparent text-gray-400'}`}
          >
            صفحة العملاء
          </button>
        </div>

        <SupplierStats loading={loading} currentList={currentList} totalDebt={totalDebt} currency={currency} activeTab={activeTab} />

        {/* Main list */}
        {loading ? (
          <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#A49EC0' }}>
            {activeTab === 'suppliers' ? 'لا يوجد موردون مسجلون.' : 'لا يوجد عملاء مسجلون.'}
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map(item => (
              <SupplierCard
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                activeTab={activeTab}
                currency={currency}
                onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
                onEdit={openEdit}
                onDelete={handleDelete}
                onAddMaterial={openAddMaterial}
                onPayDebt={openPayDebt}
                onRemoveMaterial={handleRemoveMaterial}
                onUndoPayment={handleUndoSupplierPayment}
              />
            ))}
            <Pagination
              currentPage={pagination.currentPage}
              lastPage={pagination.lastPage}
              total={pagination.total}
              onPageChange={(p) => fetchAll(p)}
              loading={loading}
            />
          </div>
        )}
      </div>

      <SupplierClientForm
        show={showForm}
        activeTab={activeTab}
        editing={editing}
        form={form}
        saving={saving}
        msg={msg}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        onFormChange={setForm}
      />

      <MaterialLinkForm
        show={showAddMaterial}
        supplierId={addMatSupplierId}
        matId={addMatId}
        matPrice={addMatPrice}
        matNotes={addMatNotes}
        matMsg={addMatMsg}
        matSaving={addMatSaving}
        allMaterials={allMaterials}
        onClose={() => setShowAddMaterial(false)}
        onSubmit={handleAddMaterial}
        onMatIdChange={setAddMatId}
        onMatPriceChange={setAddMatPrice}
        onMatNotesChange={setAddMatNotes}
      />

      <PayDebtModal
        showPayDebt={showPayDebt}
        payDebtForm={payDebtForm}
        payDebtFile={payDebtFile}
        payDebtMsg={payDebtMsg}
        payDebtSaving={payDebtSaving}
        currency={currency}
        onClose={() => setShowPayDebt(null)}
        onFormChange={setPayDebtForm}
        onFileChange={setPayDebtFile}
        onSubmit={handlePayDebtSubmit}
        isClient={activeTab === 'clients'}
      />
      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}

