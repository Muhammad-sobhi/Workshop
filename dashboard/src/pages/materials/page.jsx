'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { Plus, Layers, Wrench } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import MaterialStats from '@/components/materials/MaterialStats';


import MaterialTable from '@/components/materials/MaterialTable';
import MaterialForm from '@/components/materials/MaterialForm';
import AlertDialog from '@/components/AlertDialog';

const emptyForm = {
  name: '',
  code: '',
  sku: '',
  unit: '',
  unit_cost: '',
  category_id: '',
  description: '',
  dimension: '',
  type: 'material',
  low_stock_limit: '10',
  service_location: 'inside',
  initial_stock: '',
};

export default function MaterialsPage() {
  const { settings } = useAppStore();
  const [searchParams] = useSearchParams();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [activeTab, setActiveTab] = useState('material');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [alertDialog, setAlertDialog] = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'service' || tab === 'services' || tab === 'material' || tab === 'materials') {
      setActiveTab(tab.startsWith('service') ? 'service' : 'material');
    }
  }, [searchParams]);

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/materials?page=${p}&per_page=20`),
      apiClient.get('/categories'),
    ]).then(([matRes, catRes]) => {
      const d = matRes.data;
      setMaterials(d?.data ?? []);
      setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
      setCategories(catRes.data?.material_categories ?? []);
      setUnits(catRes.data?.measurement_units ?? []);
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = (type = 'material') => {
    setEditing(null);
    setForm({ ...emptyForm, type, code: '', sku: '' });
    setMsg('');
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code,
      sku: m.sku,
      unit: m.unit,
      unit_cost: m.unit_cost.toString(),
      category_id: m.category_id.toString(),
      description: m.description ?? '',
      dimension: m.dimension !== null ? m.dimension.toString() : '',
      type: m.type || 'material',
      low_stock_limit: (m.low_stock_limit ?? 10).toString(),
      service_location: m.service_location ?? 'inside',
      initial_stock: m.stock !== undefined ? m.stock.toString() : (m.stock_quantity ?? '').toString(),
    });
    setMsg('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        unit_cost: parseFloat(form.unit_cost),
        category_id: parseInt(form.category_id),
        dimension: form.dimension ? parseFloat(form.dimension) : null,
        low_stock_limit: form.type === 'material' ? parseFloat(form.low_stock_limit || 10) : 0,
        service_location: form.type === 'service' ? form.service_location : null,
        initial_stock: form.initial_stock ? parseFloat(form.initial_stock) : 0,
      };

      if (!payload.code) delete payload.code;
      if (!payload.sku) delete payload.sku;

      if (editing) {
        await apiClient.put(`/materials/${editing.id}`, payload);
        setMsg('تم التحديث بنجاح');
      } else {
        await apiClient.post('/materials', payload);
        setMsg('تمت الإضافة بنجاح');
      }
      fetchAll();
      setTimeout(() => { setShowForm(false); setMsg(''); }, 1200);
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors) {
        setMsg(Object.values(errors).flat().join(' | '));
      } else {
        setMsg(err?.response?.data?.message ?? 'حدث خطأ أثناء الحفظ');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    setAlertDialog({
      type: 'confirm',
      message: `هل تريد الحذف "${name}"؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/materials/${id}`);
          fetchAll();
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء الحذف' });
        }
      }
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المواد والخدمات</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              إضافة وتعديل وحذف المواد الخام مع الخدمات الخارجية وتتبع الأرصدة والتكاليف
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
                  formData.append('type', 'materials');
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
              onClick={() => openCreate(activeTab)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg self-start"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة {activeTab === 'material' ? 'مادة جديدة' : 'خدمة جديدة'}</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 border-b border-[#3D3554] pb-px">
          <button
            onClick={() => setActiveTab('material')}
            className="px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2"
            style={activeTab === 'material'
              ? { borderColor: '#ECC796', color: '#ECC796' }
              : { borderColor: 'transparent', color: '#A49EC0' }
            }
          >
            <Layers className="w-4 h-4" />
            <span>المواد الخام بالمستودع</span>
          </button>
          <button
            onClick={() => setActiveTab('service')}
            className="px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2"
            style={activeTab === 'service'
              ? { borderColor: '#ECC796', color: '#ECC796' }
              : { borderColor: 'transparent', color: '#A49EC0' }
            }
          >
            <Wrench className="w-4 h-4" />
            <span>الخدمات (داخل وخارج الورشة)</span>
          </button>
        </div>

        <MaterialStats
          materials={materials}
          loading={loading}
          activeTab={activeTab}
          currency={settings?.currency}
        />

        <MaterialTable
          materials={materials}
          categories={categories}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filterCat={filterCat}
          onFilterCatChange={setFilterCat}
          activeTab={activeTab}
          onEdit={openEdit}
          onDelete={handleDelete}
          currency={settings?.currency}
        />
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />
      </div>

      <MaterialForm
        showForm={showForm}
        onClose={() => setShowForm(false)}
        form={form}
        setForm={setForm}
        editing={editing}
        saving={saving}
        msg={msg}
        onSubmit={handleSubmit}
        categories={categories}
        units={units}
      />

      <AlertDialog
        alertDialog={alertDialog}
        onClose={() => setAlertDialog(null)}
      />
    </MainLayout>
  );
}
