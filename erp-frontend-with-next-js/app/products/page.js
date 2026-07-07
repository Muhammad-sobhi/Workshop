'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import ProductCard from '@/components/products/ProductCard';
import ProductFormModal from '@/components/products/ProductFormModal';
import BOMViewerModal from '@/components/products/BOMViewerModal';
import AlertDialog from '@/components/AlertDialog';
import { getApiBaseUrl } from '@/lib/config';

export default function ProductsPage() {
  const { settings } = useAppStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  const [showCreate, setShowCreate] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingBOM, setViewingBOM] = useState(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    sku: '',
    unit: 'حبة',
    sale_price: '',
    category_id: '',
    description: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const [bomItems, setBomItems] = useState([{ id: '', quantity: '' }]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);

  const fetchAll = (p = 1) => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/products?page=${p}&per_page=20`),
      apiClient.get('/products/categories'),
      apiClient.get('/materials?per_page=200'),
    ])
      .then(([prodRes, catRes, matRes]) => {
        const d = prodRes.data;
        setProducts(d?.data ?? []);
        setPagination({ currentPage: d?.current_page ?? 1, lastPage: d?.last_page ?? 1, total: d?.total ?? 0 });
        setCategories(catRes.data ?? []);
        setMaterials(matRes.data?.data ?? matRes.data ?? []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchAll(p);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAddBOMRow = () => {
    setBomItems([...bomItems, { id: '', quantity: '' }]);
  };

  const handleRemoveBOMRow = (index) => {
    if (bomItems.length > 1) {
      setBomItems(bomItems.filter((_, idx) => idx !== index));
    }
  };

  const handleBOMChange = (index, field, value) => {
    const updated = [...bomItems];
    updated[index][field] = value;
    setBomItems(updated);
  };

  const calculatedProductionCost = bomItems.reduce((acc, item) => {
    const mat = materials.find(m => m.id === parseInt(item.id));
    const qty = parseFloat(item.quantity) || 0;
    return acc + (mat ? mat.unit_cost * qty : 0);
  }, 0);

  const handleOpenCreate = () => {
    setForm({
      name: '',
      code: '',
      sku: '',
      unit: 'حبة',
      sale_price: '',
      category_id: '',
      description: '',
    });
    setBomItems([{ id: '', quantity: '' }]);
    setImageFile(null);
    setImagePreview('');
    setMsg('');
    setEditingProduct(null);
    setShowCreate(true);
  };

  const handleOpenEdit = (prod) => {
    setForm({
      name: prod.name,
      code: prod.code,
      sku: prod.sku,
      unit: prod.unit,
      sale_price: prod.sale_price.toString(),
      category_id: prod.category_id.toString(),
      description: prod.description || '',
    });

    const mappedBOM = prod.materials && prod.materials.length > 0
      ? prod.materials.map(m => ({ id: m.id.toString(), quantity: m.quantity.toString() }))
      : [{ id: '', quantity: '' }];

    setBomItems(mappedBOM);
    setImageFile(null);
    setImagePreview(prod.image_path ? `${getApiBaseUrl()}${prod.image_path}` : '');
    setMsg('');
    setEditingProduct(prod);
    setShowCreate(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('code', form.code);
    formData.append('sku', form.sku);
    formData.append('unit', form.unit);
    formData.append('sale_price', form.sale_price);
    formData.append('category_id', form.category_id);
    formData.append('description', form.description);
    formData.append('unit_cost', calculatedProductionCost.toString());

    if (imageFile) {
      formData.append('image', imageFile);
    }

    const validBOM = bomItems.filter(item => item.id && parseFloat(item.quantity) > 0);
    validBOM.forEach((item, idx) => {
      formData.append(`materials[${idx}][id]`, item.id);
      formData.append(`materials[${idx}][quantity]`, item.quantity);
    });

    try {
      if (editingProduct) {
        formData.append('_method', 'PUT');
        await apiClient.post(`/products/${editingProduct.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMsg('تم تحديث بيانات المنتج بنجاح');
      } else {
        await apiClient.post('/products', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMsg('تم إضافة المنتج بنجاح مع جدول المكونات (BOM)');
      }
      fetchAll();
      setTimeout(() => {
        setShowCreate(false);
        setMsg('');
      }, 1200);
    } catch (err) {
      console.error(err);
      setMsg(err?.response?.data?.message || 'حدث خطأ أثناء حفظ المنتج. يرجى التحقق من البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من رغبتك في حذف هذا المنتج؟',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/products/${id}`);
          fetchAll();
        } catch (err) {
          setAlertDialog({ type: 'alert', message: err?.response?.data?.message || 'لا يمكن حذف المنتج لوجود حركات مخزنية أو عمليات إنتاج مرتبطة به.' });
        }
      }
    });
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                        p.code.toLowerCase().includes(search.toLowerCase()) || 
                        p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? p.category_id === parseInt(filterCat) : true;
    return matchSearch && matchCat;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المنتجات وجداول المكونات (BOM)</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              تعريف كراسي وطاولات الأثاث المعدني وتحديد المواد الخام وصور المنتجات وتكلفتها
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg self-start"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
            <input
              id="products-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم المنتج، الكود أو رمز SKU..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>
          <select
            id="products-category-filter"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: '#2F264C', borderColor: '#3D3554', color: filterCat ? '#FFFFFF' : '#A49EC0' }}
          >
            <option value="">جميع الفئات</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-white text-xs">جاري تحميل قائمة المنتجات...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(prod => (
              <ProductCard
                key={prod.id}
                prod={prod}
                settings={settings}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onViewBOM={setViewingBOM}
              />
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-xs" style={{ color: '#A49EC0' }}>
                لا توجد منتجات مسجلة مطابقة للبحث
              </div>
            )}
          </div>
        )}
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          loading={loading}
          onPageChange={handlePageChange}
        />
      </div>

      <ProductFormModal
        showCreate={showCreate}
        onClose={() => setShowCreate(false)}
        editingProduct={editingProduct}
        form={form}
        onFormChange={setForm}
        categories={categories}
        materials={materials}
        bomItems={bomItems}
        onAddBOMRow={handleAddBOMRow}
        onRemoveBOMRow={handleRemoveBOMRow}
        onBOMChange={handleBOMChange}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onImageChange={handleImageChange}
        calculatedProductionCost={calculatedProductionCost}
        currency={settings.currency}
        msg={msg}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <BOMViewerModal
        viewingBOM={viewingBOM}
        materials={materials}
        settings={settings}
        onClose={() => setViewingBOM(null)}
      />

      <AlertDialog
        alertDialog={alertDialog}
        onClose={() => setAlertDialog(null)}
      />
    </MainLayout>
  );
}
