import { useState, useMemo } from 'react';
import { X, Filter, Search } from 'lucide-react';

export default function MaterialLinkForm({
  show, supplierId, matId, matPrice, matNotes, matMsg, matSaving,
  allMaterials, onClose, onSubmit, onMatIdChange, onMatPriceChange, onMatNotesChange,
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ربط مادة بالمورد">
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-base font-bold text-white">ربط مادة بالمورد</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="mat-link-material" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المادة الخام *</label>

            {/* Category Filter & Search Input */}
            <div className="space-y-2 mb-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedCategory}
                    onChange={e => {
                      const cat = e.target.value;
                      setSelectedCategory(cat);
                      if (cat) {
                        const firstMatch = allMaterials.find(m => m.category === cat);
                        if (firstMatch) {
                          onMatIdChange(firstMatch.id.toString());
                          if (firstMatch.unit_cost) onMatPriceChange(firstMatch.unit_cost.toString());
                        }
                      }
                    }}
                    className="w-full rounded-xl px-3 py-2 text-xs border outline-none appearance-none pr-8 cursor-pointer"
                    style={{ background: '#1A142D', borderColor: selectedCategory ? '#ECC796' : '#3D3554', color: '#FFFFFF' }}
                  >
                    <option value="">جميع الفئات (All Categories)</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <Filter className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none" style={{ color: '#A49EC0' }} />
                </div>
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className="px-2.5 py-1 text-xs rounded-xl border text-amber-300 hover:bg-white/5 transition-all"
                    style={{ borderColor: '#3D3554' }}
                  >
                    إعادة تصفية
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن المادة بالاسم..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border outline-none pl-8"
                  style={{ background: '#1A142D', borderColor: '#3D3554', color: '#FFFFFF' }}
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 pointer-events-none" style={{ color: '#A49EC0' }} />
              </div>
            </div>

            {/* Material Select */}
            <select
              id="mat-link-material"
              value={matId}
              onChange={e => {
                onMatIdChange(e.target.value);
                const m = allMaterials.find(mat => mat.id === parseInt(e.target.value));
                if (m && !matPrice) onMatPriceChange(m.unit_cost.toString());
              }}
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              {!selectedCategory && <option value="">اختر المادة...</option>}
              {filteredMaterials.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mat-link-price" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>سعر المورد للوحدة (EGP)</label>
            <input
              id="mat-link-price"
              type="number"
              min="0"
              step="0.01"
              value={matPrice}
              onChange={e => onMatPriceChange(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder="0.00"
            />
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
              disabled={matSaving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {matSaving ? 'جاري الحفظ...' : 'ربط المادة'}
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
