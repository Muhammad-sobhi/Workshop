'use client';

import { Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';

export default function MaterialTable({
  materials,
  categories,
  loading,
  search,
  onSearchChange,
  filterCat,
  onFilterCatChange,
  activeTab,
  onEdit,
  onDelete,
  currency,
}) {
  const filtered = materials.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      m.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? m.category_id === parseInt(filterCat) : true;
    const matchType = m.type === activeTab;
    return matchSearch && matchCat && matchType;
  });

  return (
    <>
      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
          <input
            id="materials-search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="بحث بالاسم أو الكود أو SKU..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
          />
        </div>
        <select
          id="materials-category-filter"
          value={filterCat}
          onChange={e => onFilterCatChange(e.target.value)}
          className="px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ background: '#2F264C', borderColor: '#3D3554', color: filterCat ? '#FFFFFF' : '#A49EC0' }}
        >
          <option value="">جميع الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: '#201A30', borderColor: '#3D3554' }}
      >
        {loading ? (
          <div className="text-center py-16 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الاسم</th>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الكود / SKU</th>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الفئة</th>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>{activeTab === 'service' ? 'مكان الخدمة' : 'الأبعاد / المقاسات'}</th>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الوحدة</th>
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>التكلفة</th>
                  {activeTab === 'material' && (
                    <>
                      <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الرصيد الحالي</th>
                      <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>قيمة المخزون</th>
                    </>
                  )}
                  <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: '#A49EC0' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(mat => {
                  const stockValue = mat.unit_cost * (mat.stock || 0);
                  const isLow = activeTab === 'material' && mat.stock > 0 && mat.stock < (mat.low_stock_limit || 10);
                  const isZero = activeTab === 'material' && mat.stock <= 0;
                  return (
                    <tr key={mat.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: '#3D3554' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLow || isZero ? (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-bounce" style={{ color: isZero ? '#EF4444' : '#F59E0B' }} />
                          ) : null}
                          <div>
                            <p className="font-semibold text-white">{mat.name}</p>
                            {mat.description && <p className="text-[11px] mt-0.5 truncate max-w-[160px]" style={{ color: '#A49EC0' }}>{mat.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white">
                        <p>{mat.code}</p>
                        <p style={{ color: '#A49EC0' }}>{mat.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(141,126,200,0.2)', color: '#C4B8F0' }}>
                          {mat.category ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white">
                        {activeTab === 'service' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={mat.service_location === 'outside' ? { background: 'rgba(239,68,68,0.2)', color: '#EF4444' } : { background: 'rgba(16,185,129,0.2)', color: '#10B981' }}>
                            {mat.service_location === 'outside' ? 'خارج الورشة' : 'داخل الورشة'}
                          </span>
                        ) : (
                          mat.dimension !== null ? `${formatDecimal(mat.dimension)}` : '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#D4CEEB]">{mat.unit}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: '#ECC796' }}>
                        {currency || 'ر.س'} {formatDecimal(mat.unit_cost)}
                      </td>
                      {activeTab === 'material' && (
                        <>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-bold" style={{ color: isZero ? '#EF4444' : isLow ? '#F59E0B' : '#10B981' }}>
                              {mat.stock.toLocaleString('ar-SA')} {mat.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-white">
                            {currency || 'ر.س'} {formatDecimal(stockValue)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onEdit(mat)}
                            className="p-1 rounded bg-[#2F264C] text-[#C4B8F0] border border-[#3D3554] hover:bg-white/5 transition-colors"
                            aria-label="تعديل"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(mat.id, mat.name)}
                            className="p-1 rounded bg-[#2F264C] text-red-400 border border-[#3D3554] hover:bg-red-500/10 transition-colors"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'material' ? 9 : 7} className="text-center py-12 text-xs" style={{ color: '#A49EC0' }}>
                      لا توجد بيانات مسجلة للتصنيف الحالي
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
