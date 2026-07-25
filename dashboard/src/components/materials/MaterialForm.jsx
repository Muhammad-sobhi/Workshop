'use client';

import { X } from 'lucide-react';

export default function MaterialForm({ showForm, onClose, form, setForm, editing, saving, msg, onSubmit, categories, units }) {
  if (!showForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing ? 'تعديل' : 'إضافة'}>
      <div className="w-full max-w-xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-sm font-bold text-white">
            {editing ? 'تعديل الخصائص' : `إضافة ${form.type === 'material' ? 'مادة خام جديدة' : 'خدمة جديدة'}`}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="material-type" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>النوع</label>
              <select
                id="material-type"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                disabled={!!editing}
                className="w-full rounded-xl px-4 py-2 px-3 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              >
                <option value="material">مادة خام في المستودع</option>
                <option value="service">خدمة خارجية (مصاريف خارج الورشة)</option>
              </select>
            </div>
            <div>
              <label htmlFor="material-name" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الاسم بالكامل <span style={{ color: '#ECC796' }}>*</span></label>
              <input
                id="material-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder={form.type === 'material' ? 'مثال: ماسورة حديد 40×40' : 'مثال: خدمة طلاء خارجي'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="material-code" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الكود (اتركه فارغاً للتوليد التلقائي)</label>
              <input
                id="material-code"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none font-mono"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder="سيتم إنشاؤه تلقائياً"
              />
            </div>
            <div>
              <label htmlFor="material-sku" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>SKU (اتركه فارغاً للتوليد التلقائي)</label>
              <input
                id="material-sku"
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none font-mono"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder="سيتم إنشاؤه تلقائياً"
              />
            </div>
          </div>

          {form.type === 'material' ? (
            <div>
              <label htmlFor="material-low-stock" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الحد الأدنى للمخزون (التنبيهات)</label>
              <input
                id="material-low-stock"
                type="number"
                value={form.low_stock_limit}
                onChange={e => setForm({ ...form, low_stock_limit: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none font-mono"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="material-service-location" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>مكان تقديم الخدمة</label>
              <select
                id="material-service-location"
                value={form.service_location}
                onChange={e => setForm({ ...form, service_location: e.target.value })}
                className="w-full rounded-xl px-4 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              >
                <option value="inside">داخل الورشة (لا تحتسب كمصروف خارجي)</option>
                <option value="outside">خارج الورشة (تحتسب كمصروف مالي)</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="material-unit" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>وحدة القياس <span style={{ color: '#ECC796' }}>*</span></label>
              <select
                id="material-unit"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                required
                className="w-full rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              >
                <option value="">اختر الوحدة...</option>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="material-dimension" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الأبعاد والمقاسات (أرقام فقط)</label>
              <input
                id="material-dimension"
                type="number"
                step="0.01"
                min="0"
                value={form.dimension}
                onChange={e => setForm({ ...form, dimension: e.target.value })}
                placeholder="مثل: 120"
                className="w-full rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>

            <div>
              <label htmlFor="material-unit-cost" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>
                {form.type === 'material' ? 'تكلفة الوحدة' : 'تكلفة الخدمة (خارج الورشة)'} <span style={{ color: '#ECC796' }}>*</span>
              </label>
              <input
                id="material-unit-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unit_cost}
                onChange={e => setForm({ ...form, unit_cost: e.target.value })}
                required
                className="w-full rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label htmlFor="material-category" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الفئة تصنيفية <span style={{ color: '#ECC796' }}>*</span></label>
            <select
              id="material-category"
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              required
              className="w-full rounded-xl px-4 py-2 text-xs border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              <option value="">اختر الفئة...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="material-description" className="block text-xs font-semibold mb-1.5" style={{ color: '#D4CEEB' }}>الوصف وتفاصيل التكلفة</label>
            <textarea
              id="material-description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-xl px-4 py-2 text-xs border outline-none resize-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder={form.type === 'service' ? 'هذه التكلفة تعتبر مصروفات خارجية (خارج الورشة)' : 'وصف تفصيلي اختياري للمادة...'}
            />
          </div>

          {msg && (
            <p className={`text-xs text-center py-2.5 rounded-xl font-semibold ${msg.includes('نجاح') || msg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {msg}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all duration-200 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {saving ? 'جاري الحفظ...' : (editing ? 'تحديث البيانات' : 'حفظ البيانات')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-xs border transition-colors hover:bg-white/5"
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
