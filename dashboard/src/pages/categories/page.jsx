'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import apiClient from '@/lib/api-client';
import { Plus, Edit2, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import AlertDialog from '@/components/AlertDialog';

export default function CategoriesPage() {
  const [materialCats, setMaterialCats] = useState([]);
  const [productCats, setProductCats] = useState([]);
  const [measurementUnits, setMeasurementUnits] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog / Form States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('material');
  const [editingItem, setEditingItem] = useState(null);
  const [inputName, setInputName] = useState('');
  const [unitType, setUnitType] = useState('general'); // only for units
  const [formLoading, setFormLoading] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/categories');
      setMaterialCats(res.data.material_categories || []);
      setProductCats(res.data.product_categories || []);
      setMeasurementUnits(res.data.measurement_units || []);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل الفئات والوحدات.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, item = null) => {
    setDialogType(type);
    setEditingItem(item);
    setInputName(item ? item.name : '');
    setUnitType(item?.type || 'general');
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setSuccess('');

    try {
      let endpoint = '';
      if (dialogType === 'material') endpoint = '/categories/material';
      else if (dialogType === 'product') endpoint = '/categories/product';
      else endpoint = '/categories/unit';

      const payload = dialogType === 'unit' 
        ? { name: inputName, type: unitType }
        : { name: inputName };

      if (editingItem) {
        await apiClient.put(`${endpoint}/${editingItem.id}`, payload);
        setSuccess('تم تحديث العنصر بنجاح.');
      } else {
        await apiClient.post(endpoint, payload);
        setSuccess('تم إضافة العنصر الجديد بنجاح.');
      }

      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟',
      onConfirm: async () => {
        setError('');
        setSuccess('');

        try {
          let endpoint = '';
          if (type === 'material') endpoint = '/categories/material';
          else if (type === 'product') endpoint = '/categories/product';
          else endpoint = '/categories/unit';

          await apiClient.delete(`${endpoint}/${id}`);
          setSuccess('تم حذف العنصر بنجاح.');
          fetchData();
        } catch (err) {
          console.error(err);
          setError(err.response?.data?.message || 'فشل حذف العنصر. قد يكون مرتبطاً ببيانات أخرى في النظام.');
        }
      }
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">إدارة الفئات والوحدات</h1>
          <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
            التحكم الكامل في تصنيفات المواد، فئات المنتجات، ووحدات القياس والقيم المتنوعة
          </p>
        </div>

        {/* Global Feedback */}
        {error && (
          <div 
            className="flex items-center gap-2 p-4 rounded-xl border text-xs text-red-200"
            style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div 
            className="flex items-center gap-2 p-4 rounded-xl border text-xs text-green-200"
            style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-xs" style={{ color: '#A49EC0' }}>جاري تحميل البيانات...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Material Categories */}
            <div 
              className="rounded-2xl border flex flex-col h-[500px]"
              style={{ background: '#231B3D', borderColor: '#3D3554' }}
            >
              <div className="p-4 border-b border-[#3D3554] flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold text-white">فئات المواد والخدمات</h3>
                <button 
                  onClick={() => openModal('material')}
                  className="p-1 rounded bg-[#ECC796] text-[#201A30] hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {materialCats.map(cat => (
                  <div 
                    key={cat.id} 
                    className="flex justify-between items-center p-3 rounded-xl border border-[#3D3554] hover:bg-white/5 transition-colors"
                    style={{ background: '#2F264C' }}
                  >
                    <span className="text-xs font-semibold text-white">{cat.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => openModal('material', cat)} className="p-1 hover:bg-white/5 rounded text-[#C4B8F0] transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete('material', cat.id)} className="p-1 hover:bg-white/5 rounded text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {materialCats.length === 0 && (
                  <p className="text-center text-xs mt-10" style={{ color: '#A49EC0' }}>لا توجد فئات حالياً</p>
                )}
              </div>
            </div>

            {/* Column 2: Product Categories */}
            <div 
              className="rounded-2xl border flex flex-col h-[500px]"
              style={{ background: '#231B3D', borderColor: '#3D3554' }}
            >
              <div className="p-4 border-b border-[#3D3554] flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold text-white">فئات المنتجات</h3>
                <button 
                  onClick={() => openModal('product')}
                  className="p-1 rounded bg-[#ECC796] text-[#201A30] hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {productCats.map(cat => (
                  <div 
                    key={cat.id} 
                    className="flex justify-between items-center p-3 rounded-xl border border-[#3D3554] hover:bg-white/5 transition-colors"
                    style={{ background: '#2F264C' }}
                  >
                    <span className="text-xs font-semibold text-white">{cat.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => openModal('product', cat)} className="p-1 hover:bg-white/5 rounded text-[#C4B8F0] transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete('product', cat.id)} className="p-1 hover:bg-white/5 rounded text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {productCats.length === 0 && (
                  <p className="text-center text-xs mt-10" style={{ color: '#A49EC0' }}>لا توجد فئات حالياً</p>
                )}
              </div>
            </div>

            {/* Column 3: Measurement Units */}
            <div 
              className="rounded-2xl border flex flex-col h-[500px]"
              style={{ background: '#231B3D', borderColor: '#3D3554' }}
            >
              <div className="p-4 border-b border-[#3D3554] flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold text-white">وحدات القياس والقيم</h3>
                <button 
                  onClick={() => openModal('unit')}
                  className="p-1 rounded bg-[#ECC796] text-[#201A30] hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {measurementUnits.map(unit => (
                  <div 
                    key={unit.id} 
                    className="flex justify-between items-center p-3 rounded-xl border border-[#3D3554] hover:bg-white/5 transition-colors"
                    style={{ background: '#2F264C' }}
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{unit.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>النوع: {unit.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openModal('unit', unit)} className="p-1 hover:bg-white/5 rounded text-[#C4B8F0] transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete('unit', unit.id)} className="p-1 hover:bg-white/5 rounded text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {measurementUnits.length === 0 && (
                  <p className="text-center text-xs mt-10" style={{ color: '#A49EC0' }}>لا توجد وحدات قياس حالياً</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div 
            className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
            style={{ background: '#231B3D', borderColor: '#3D3554' }}
          >
            <div className="flex justify-between items-center border-b border-[#3D3554] pb-2.5">
              <h3 className="text-xs font-bold text-white">
                {editingItem ? 'تعديل الاسم والخيارات' : 'إضافة عنصر جديد'}
              </h3>
              <button onClick={() => setDialogOpen(false)} className="text-xs text-[#A49EC0] hover:text-white">إغلاق</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>
                  {dialogType === 'unit' ? 'اسم وحدة القياس (مثال: متر، كيلو، حبة، لوح)' : 'الاسم بالكامل'}
                </label>
                <input 
                  type="text" 
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  required
                  placeholder="مثال: قطيفة، حديد، متر"
                  className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
                  style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
                />
              </div>

              {dialogType === 'unit' && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>نوع تصنيف الوحدة</label>
                  <select 
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                    className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
                    style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
                  >
                    <option value="general">عام (General)</option>
                    <option value="quantity">كمية / حبة (Quantity)</option>
                    <option value="weight">وزن / كيلو (Weight)</option>
                    <option value="length">طول / متر (Length)</option>
                    <option value="area">مساحة / متر مربع (Area)</option>
                    <option value="volume">حجم / لتر (Volume)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#3D3554]">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl py-2 px-4 text-xs font-semibold hover:bg-white/5 transition-colors"
                  style={{ color: '#A49EC0' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-xl py-2 px-5 text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                >
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>حفظ</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}
