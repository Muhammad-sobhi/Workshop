'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Plus, Search, Layers, Box, TrendingUp, Sparkles, Armchair, Upload, Tags } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Pagination from '@/components/Pagination';
import ProductCard from '@/components/products/ProductCard';
import ProductFormModal from '@/components/products/ProductFormModal';
import BOMViewerModal from '@/components/products/BOMViewerModal';
import AlertDialog from '@/components/AlertDialog';
import { getImageUrl } from '@/lib/config';

export default function ProductsPage() {
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

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
      initial_stock: '',
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
      initial_stock: prod.stock !== undefined ? prod.stock.toString() : (prod.stock_quantity ?? '').toString(),
    });

    const mappedBOM = prod.materials && prod.materials.length > 0
      ? prod.materials.map(m => ({ id: m.id.toString(), quantity: m.quantity.toString() }))
      : [{ id: '', quantity: '' }];

    setBomItems(mappedBOM);
    setImageFile(null);
    setImagePreview(getImageUrl(prod.image_path));
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
    formData.append('initial_stock', form.initial_stock || '0');
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
      const errorsObj = err?.response?.data?.errors;
      const firstErr = errorsObj ? (Array.isArray(Object.values(errorsObj)[0]) ? Object.values(errorsObj)[0][0] : Object.values(errorsObj)[0]) : null;
      setMsg(firstErr || err?.response?.data?.message || 'حدث خطأ أثناء حفظ المنتج. يرجى التحقق من البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من رغبتك في حذف هذا المنتج؟',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/products/${id}`);
          fetchAll();
          setAlertDialog(null);
        } catch (err) {
          setAlertDialog({
            type: 'alert',
            message: err?.response?.data?.message || 'لا يمكن حذف هذا المنتج لوجود عمليات إنتاج أو فواتير مرتبطة به.'
          });
        }
      }
    });
  };

  // Filtered Products
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                        p.code?.toLowerCase().includes(search.toLowerCase()) || 
                        p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? (p.category_id === parseInt(filterCat) || p.category === filterCat) : true;
    return matchSearch && matchCat;
  });

  // Calculate Catalog KPIs
  const totalProductsCount = pagination.total || products.length;
  const totalReadyStock = products.reduce((acc, p) => acc + (parseFloat(p.stock ?? p.stock_quantity ?? 0)), 0);
  
  const validProductsForMargin = products.filter(p => parseFloat(p.sale_price) > 0);
  const avgMarginPct = validProductsForMargin.length > 0
    ? (validProductsForMargin.reduce((acc, p) => {
        const sp = parseFloat(p.sale_price) || 0;
        const uc = parseFloat(p.unit_cost) || 0;
        return acc + (((sp - uc) / sp) * 100);
      }, 0) / validProductsForMargin.length).toFixed(1)
    : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* 1. Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Armchair className="w-6 h-6 text-[#ECC796]" />
              إدارة المنتجات وجداول المكونات (BOM)
            </h1>
            <p className="text-xs mt-1 text-[#A49EC0]">
              تعريف كراسي وطاولات الأثاث، تحديد نسب وهياكل المواد الخام (BOM)، ومتابعة هوامش الربحية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <label
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-white/10 border border-[#3D3554] bg-[#2F264C] text-[#ECC796] cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
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
                  formData.append('type', 'products');
                  try {
                    setLoading(true);
                    const res = await apiClient.post('/bulk-import', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    setAlertDialog({ type: 'alert', message: res.data.message || 'تم استيراد المنتجات بنجاح' });
                    fetchAll();
                  } catch (err) {
                    setAlertDialog({ type: 'alert', message: 'فشل استيراد الملف. يرجى التأكد من التنسيق الصحيح.' });
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </label>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all hover:opacity-90 bg-gradient-to-r from-[#ECC796] to-[#D4A660] text-[#201A30] shadow-md shadow-[#ECC796]/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة منتج جديد</span>
            </button>
          </div>
        </div>

        {/* 2. Top Catalog Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          
          {/* Card 1: Total Catalog Models */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex items-center justify-between shadow-md">
            <div>
              <span className="text-xs font-bold text-[#A49EC0]">إجمالي الموديلات والمنتجات</span>
              <p className="text-2xl font-black font-mono text-white mt-1">
                {totalProductsCount} <span className="text-xs font-normal text-gray-400">موديل</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Armchair className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Showroom Ready Stock */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex items-center justify-between shadow-md">
            <div>
              <span className="text-xs font-bold text-[#A49EC0]">المخزون الجاهز بالمعرض</span>
              <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {totalReadyStock} <span className="text-xs font-normal text-emerald-400/70">قطعة تامة الصنع</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Box className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Average Profit Margin */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex items-center justify-between shadow-md">
            <div>
              <span className="text-xs font-bold text-[#A49EC0]">متوسط هامش الربح للمنتجات</span>
              <p className="text-2xl font-black font-mono text-[#ECC796] mt-1">
                +{avgMarginPct}% <span className="text-xs font-normal text-[#ECC796]/70">كفاءة تسعير</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#ECC796]/15 text-[#ECC796] border border-[#ECC796]/30">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

        </div>

        {/* 3. Quick Category Filter Pills & Search Input */}
        <div className="space-y-3">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setFilterCat('')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterCat === ''
                  ? 'bg-[#ECC796] text-[#201A30] shadow-md shadow-[#ECC796]/20'
                  : 'bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white'
              }`}
            >
              الكل ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCat(cat.id.toString())}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filterCat === cat.id.toString()
                    ? 'bg-[#ECC796] text-[#201A30] shadow-md shadow-[#ECC796]/20'
                    : 'bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A49EC0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المنتج، كود الموديل أو رمز SKU..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl text-xs bg-[#231B3D] border border-[#3D3554] text-white placeholder-[#A49EC0]/60 outline-none focus:border-[#ECC796] transition-all"
            />
          </div>
        </div>

        {/* 4. Products Catalog Grid */}
        {loading ? (
          <div className="text-center py-16 text-xs text-[#A49EC0]">
            جاري تحميل كتالوج المنتجات وجداول BOM...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center bg-[#231B3D] border-[#3D3554] space-y-3">
            <Armchair className="w-12 h-12 text-[#A49EC0]/40 mx-auto" />
            <h3 className="text-sm font-bold text-white">لا توجد منتجات مطابقة لخيارات البحث</h3>
            <p className="text-xs text-[#A49EC0]">يمكنك إضافة منتج جديد وتحديد خامات التصنيع المكونة له فوراً</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ECC796] text-[#201A30] hover:bg-[#D4A660] transition-all inline-block"
            >
              + إضافة منتج جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((prod) => (
              <ProductCard
                key={prod.id}
                prod={prod}
                settings={settings}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onViewBOM={(p) => setViewingBOM(p)}
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

        {/* Product Form Modal (Create / Edit) */}
        <ProductFormModal
          show={showCreate}
          editingProduct={editingProduct}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          imagePreview={imagePreview}
          handleImageChange={handleImageChange}
          categories={categories}
          materials={materials}
          bomItems={bomItems}
          handleAddBOMRow={handleAddBOMRow}
          handleRemoveBOMRow={handleRemoveBOMRow}
          handleBOMChange={handleBOMChange}
          calculatedProductionCost={calculatedProductionCost}
          saving={saving}
          msg={msg}
          currency={settings?.currency || 'EGP'}
          onClose={() => setShowCreate(false)}
          onSubmit={handleSubmit}
        />

        {/* BOM Viewer Modal */}
        <BOMViewerModal
          viewingBOM={viewingBOM}
          materials={materials}
          settings={settings}
          onClose={() => setViewingBOM(null)}
        />

        {/* Alert Dialog */}
        <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />

      </div>
    </MainLayout>
  );
}
