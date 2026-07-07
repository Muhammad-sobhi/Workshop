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

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      apiClient.get('/suppliers'),
      apiClient.get('/clients'),
      apiClient.get('/materials'),
    ]).then(([suppRes, clientRes, matRes]) => {
      setSuppliers(suppRes.data?.data ?? suppRes.data ?? []);
      setClients(clientRes.data?.data ?? clientRes.data ?? []);
      setAllMaterials(matRes.data?.data ?? matRes.data ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

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

      await apiClient.post(`/suppliers/${showPayDebt.id}/pay-debt`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPayDebtMsg('تم تسجيل عملية سداد الدين بنجاح وتحديث الحسابات');
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
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'suppliers' ? 'إضافة مورد جديد' : 'إضافة عميل جديد'}
          </button>
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
          <div className="text-center py-16 rounded-2xl border" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#A49EC0' }}>
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
              />
            ))}
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
      />
      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}

