import { useState, useMemo } from 'react';
import { X, Filter, Search } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function ProductLinkForm({
  show, supplierId, prodId, prodPrice, prodNotes, prodMsg, prodSaving,
  allProducts, onClose, onSubmit, onProdIdChange, onProdPriceChange, onProdNotesChange,
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    if (!allProducts) return [];
    const set = new Set();
    allProducts.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter(p => {
      const matchCat = !selectedCategory || p.category === selectedCategory;
      const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allProducts, selectedCategory, searchQuery]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ربط منتج بالمورد">
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <h2 className="text-base font-bold text-white">ربط منتج جاهز بالمورد (للشراء وإعادة البيع)</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="prod-link-product" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>المنتج *</label>

            <div className="space-y-2 mb-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedCategory}
                    onChange={e => {
                      const cat = e.target.value;
                      setSelectedCategory(cat);
                      if (cat) {
                        const firstMatch = allProducts.find(p => p.category === cat);
                        if (firstMatch) {
                          onProdIdChange(firstMatch.id.toString());
                          if (firstMatch.unit_cost) onProdPriceChange(firstMatch.unit_cost.toString());
                        }
                      }
                    }}
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

            </div>

            <SearchableSelect
              value={prodId}
              onChange={e => {
                onProdIdChange(e.target.value);
                const p = allProducts.find(pr => pr.id === parseInt(e.target.value));
                if (p) onProdPriceChange(p.unit_cost != null ? p.unit_cost.toString() : '');
              }}
              required
              placeholder={selectedCategory ? "اختر منتجاً..." : "اختر منتجاً..."}
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              options={filteredProducts.map(p => ({
                value: p.id,
                label: `${p.name} (${p.unit || 'وحدة'})${p.is_resale ? ' - مشترى' : ''}`,
                subtitle: p.category
              }))}
            />
          </div>
          <div>
            <label htmlFor="prod-link-price" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>سعر الشراء من المورد للوحدة (EGP)</label>
            <input
              id="prod-link-price"
              type="number"
              min="0"
              step="0.01"
              value={prodPrice}
              onChange={e => onProdPriceChange(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="prod-link-notes" className="block text-sm font-medium mb-1.5" style={{ color: '#D4CEEB' }}>ملاحظات</label>
            <input
              id="prod-link-notes"
              type="text"
              value={prodNotes}
              onChange={e => onProdNotesChange(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{ background: '#231B3D', borderColor: '#3D3554', color: '#FFFFFF' }}
              placeholder="مثال: مورد المنتجات الجاهزة الرئيسي"
            />
          </div>
          {prodMsg && (
            <p className={`text-sm text-center py-2 rounded-xl ${prodMsg.includes('نجاح') || prodMsg.includes('تم') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{prodMsg}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={prodSaving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {prodSaving ? 'جاري الحفظ...' : 'ربط المنتج'}
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
