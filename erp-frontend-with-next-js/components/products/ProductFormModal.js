'use client';

import { X, Upload, ListPlus } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';

export default function ProductFormModal({
  showCreate,
  onClose,
  editingProduct,
  form,
  onFormChange,
  categories,
  materials,
  bomItems,
  onAddBOMRow,
  onRemoveBOMRow,
  onBOMChange,
  imageFile,
  imagePreview,
  onImageChange,
  calculatedProductionCost,
  currency,
  msg,
  saving,
  onSubmit,
}) {
  if (!showCreate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label={editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}>
      <div className="w-full max-w-2xl rounded-2xl border p-6 my-8" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-sm font-bold text-white">
            {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد وتفاصيل تصنيعه'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-name" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>اسم المنتج <span style={{ color: '#ECC796' }}>*</span></label>
              <input
                id="product-name"
                type="text"
                value={form.name}
                onChange={e => onFormChange({ ...form, name: e.target.value })}
                required
                placeholder="مثال: كرسي حديدي مطلي A101"
                className="w-full rounded-xl px-4 py-2 text-sm border outline-none font-medium"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>
            <div>
              <label htmlFor="product-category" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الفئة <span style={{ color: '#ECC796' }}>*</span></label>
              <select
                id="product-category"
                value={form.category_id}
                onChange={e => onFormChange({ ...form, category_id: e.target.value })}
                required
                className="w-full rounded-xl px-4 py-2 text-sm border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              >
                <option value="">اختر فئة المنتج...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="product-code" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>كود المنتج (تلقائي إذا ترك فارغاً)</label>
              <input
                id="product-code"
                type="text"
                value={form.code}
                onChange={e => onFormChange({ ...form, code: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none font-mono"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder="توليد تلقائي"
              />
            </div>
            <div>
              <label htmlFor="product-sku" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>رمز SKU (تلقائي إذا ترك فارغاً)</label>
              <input
                id="product-sku"
                type="text"
                value={form.sku}
                onChange={e => onFormChange({ ...form, sku: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none font-mono"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder="توليد تلقائي"
              />
            </div>
            <div>
              <label htmlFor="product-unit" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>وحدة القياس <span style={{ color: '#ECC796' }}>*</span></label>
              <input
                id="product-unit"
                type="text"
                value={form.unit}
                onChange={e => onFormChange({ ...form, unit: e.target.value })}
                required
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-sale-price" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>سعر البيع المقترح ({currency}) <span style={{ color: '#ECC796' }}>*</span></label>
              <input
                id="product-sale-price"
                type="number"
                min="0"
                step="0.01"
                value={form.sale_price}
                onChange={e => onFormChange({ ...form, sale_price: e.target.value })}
                required
                placeholder="0.00"
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>
            <div>
              <label htmlFor="product-cost" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>تكلفة الإنتاج المقدرة (تلقائي بناءً على المكونات)</label>
              <input
                id="product-cost"
                type="text"
                readOnly
                value={`${currency} ${formatDecimal(calculatedProductionCost)}`}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none opacity-85 select-none"
                style={{ background: '#1A1429', borderColor: '#3D3554', color: '#ECC796' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="product-image" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>صورة المنتج</label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <div className="w-16 h-16 rounded-xl border border-[#3D3554] overflow-hidden shrink-0">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <label
                className="flex-1 flex items-center justify-center gap-2 border border-dashed border-[#3D3554] hover:bg-white/5 py-4 px-4 rounded-xl cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 text-[#ECC796]" />
                <span className="text-xs" style={{ color: '#A49EC0' }}>
                  {imageFile ? imageFile.name : 'اختر صورة للمنتج (PNG, JPG)'}
                </span>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="product-description" className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الوصف وتفاصيل المنتج</label>
            <textarea
              id="product-description"
              value={form.description}
              onChange={e => onFormChange({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-xl px-4 py-2 text-xs border outline-none resize-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder="مواصفات المقاسات، الألوان أو طريقة التغليف..."
            />
          </div>

          <div className="border-t pt-4" style={{ borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <ListPlus className="w-4 h-4 text-[#ECC796]" />
                جدول المواد الخام والمدخلات المطلوبة لتصنيع حبة واحدة:
              </h3>
              <button
                type="button"
                onClick={onAddBOMRow}
                className="text-[11px] font-bold py-1.5 px-3 rounded-lg text-white"
                style={{ background: '#8D7EC8' }}
              >
                + إضافة مادة خام
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {bomItems.map((item, idx) => {
                const matchedMaterial = materials.find(m => m.id === parseInt(item.id));
                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <select
                        id={`bom-material-${idx}`}
                        value={item.id}
                        onChange={e => onBOMChange(idx, 'id', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-xs border outline-none"
                        style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
                      >
                        <option value="">اختر المادة الخام...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({currency} {formatDecimal(m.unit_cost)} / {m.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={e => onBOMChange(idx, 'quantity', e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-xs border outline-none"
                        style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
                      />
                      <span className="text-xs text-gray-400 shrink-0 font-medium">
                        {matchedMaterial ? matchedMaterial.unit : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveBOMRow(idx)}
                      className="p-2 rounded hover:bg-white/10 text-red-400"
                      aria-label="حذف المادة من القائمة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {msg && (
            <p className={`text-xs text-center py-2.5 rounded-xl font-bold ${msg.includes('بنجاح') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{msg}</p>
          )}

          <div className="flex gap-3 pt-3 border-t" style={{ borderColor: '#3D3554' }}>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all duration-200 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {saving ? 'جاري حفظ المنتج...' : (editingProduct ? 'تحديث المنتج' : 'حفظ المنتج الجديد')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-xs border transition-colors hover:bg-white/5"
              style={{ borderColor: '#3D3554', color: '#A49EC0' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
