import { useState, useMemo } from 'react';
import { X, Filter, Search } from 'lucide-react';

export default function MaterialLinkForm({
  show, supplierId, selected, linkedIds = [], matNotes, matMsg, matSaving,
  allMaterials, onClose, onSubmit, onSelectedChange, onMatNotesChange,
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);
  const selectedCount = Object.keys(selected).length;

  // Extract unique category names
  const categories = useMemo(() => {
    if (!allMaterials) return [];
    const set = new Set();
    allMaterials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [allMaterials]);

  // Filtered materials based on category and search query
  const filteredMaterials = useMemo(() => {
    if (!allMaterials) return [];
    return allMaterials.filter(m => {
      const matchCat = !selectedCategory || m.category === selectedCategory;
      const matchSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allMaterials, selectedCategory, searchQuery]);

  // Visible materials that can still be linked (not already linked to this supplier)
  const selectable = filteredMaterials.filter(m => !linkedSet.has(m.id));
  const allVisibleSelected = selectable.length > 0 && selectable.every(m => selected[m.id] !== undefined);

  const defaultPrice = (m) => (m.unit_cost != null ? m.unit_cost.toString() : '');

  const toggle = (m) => {
    const next = { ...selected };
    if (next[m.id] !== undefined) delete next[m.id];
    else next[m.id] = defaultPrice(m);
    onSelectedChange(next);
  };

  const toggleAllVisible = () => {
    const next = { ...selected };
    if (allVisibleSelected) selectable.forEach(m => { delete next[m.id]; });
    else selectable.forEach(m => { if (next[m.id] === undefined) next[m.id] = defaultPrice(m); });
    onSelectedChange(next);
  };

  const setPrice = (id, price) => onSelectedChange({ ...selected, [id]: price });

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ربط مواد بالمورد">
      <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-base font-bold text-white">ربط مواد أو خدمات خارجية بالمورد</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المواد الخام أو الخدمات الخارجية *</label>

            {/* Category Filter & Search Input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border outline-none appearance-none pr-8 cursor-pointer"
                  style={{ background: '#1A142D', borderColor: selectedCategory ? '#ECC796' : '#3D3554', color: '#FFFFFF' }}
                >
                  <option value="">جميع الفئات</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <Filter className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none" style={{ color: '#A49EC0' }} />
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم..."
                  className="w-full rounded-xl px-3 py-2 text-xs border outline-none pr-8"
                  style={{ background: '#1A142D', borderColor: '#3D3554', color: '#FFFFFF' }}
                />
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none" style={{ color: '#A49EC0' }} />
              </div>
            </div>

            {/* Select all + selected count */}
            <div className="flex items-center justify-between mb-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: selectable.length ? '#ECC796' : '#6B6485' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={selectable.length === 0}
                  onChange={toggleAllVisible}
                  className="accent-amber-400"
                />
                {selectedCategory ? `تحديد كل مواد "${selectedCategory}"` : 'تحديد كل المعروض'} ({selectable.length})
              </label>
              <span style={{ color: '#A49EC0' }}>
                المحدد: <b className="text-white">{selectedCount}</b>
                {selectedCount > 0 && (
                  <button type="button" onClick={() => onSelectedChange({})} className="mr-2 text-red-300 hover:underline">مسح</button>
                )}
              </span>
            </div>

            {/* Materials checklist */}
            <div className="rounded-xl border max-h-64 overflow-y-auto divide-y" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              {filteredMaterials.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: '#A49EC0' }}>لا توجد مواد مطابقة</p>
              ) : filteredMaterials.map(m => {
                const linked = linkedSet.has(m.id);
                const checked = selected[m.id] !== undefined;
                return (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2" style={{ borderColor: '#3D3554', opacity: linked ? 0.5 : 1 }}>
                    <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={linked || checked}
                        disabled={linked}
                        onChange={() => toggle(m)}
                        className="accent-amber-400 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-white truncate">{m.name}</span>
                        <span className="block text-[11px]" style={{ color: '#A49EC0' }}>
                          {m.type === 'service' ? 'خدمة خارجية' : 'مادة خام'} - {m.unit}
                          {m.category && !selectedCategory ? ` • ${m.category}` : ''}
                          {linked ? ' • مربوط بالفعل' : ''}
                        </span>
                      </span>
                    </label>
                    {checked && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={selected[m.id]}
                        onChange={e => setPrice(m.id, e.target.value)}
                        className="w-24 shrink-0 rounded-lg px-2 py-1 text-xs border outline-none"
                        style={{ background: '#1A142D', borderColor: '#3D3554', color: '#FFFFFF' }}
                        placeholder="السعر"
                        aria-label={`سعر المورد لـ ${m.name}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] mt-1" style={{ color: '#6B6485' }}>اختيارك محفوظ عند تغيير الفئة — تقدر تختار من أكثر من فئة وتربطهم مرة واحدة. السعر لكل وحدة (EGP).</p>
          </div>
          <div>
            <label htmlFor="mat-link-notes" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
            <input
              id="mat-link-notes"
              type="text"
              value={matNotes}
              onChange={e => onMatNotesChange(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder="مثال: أفضل مورد لهذه المادة"
            />
          </div>
          {matMsg && (
            <p className={`text-sm text-center py-2 rounded-xl ${matMsg.includes('نجاح') || matMsg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{matMsg}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={matSaving || selectedCount === 0}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {matSaving ? 'جاري الحفظ...' : `ربط ${selectedCount || ''} ${selectedCount > 1 ? 'مواد' : 'مادة'}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm border"
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
