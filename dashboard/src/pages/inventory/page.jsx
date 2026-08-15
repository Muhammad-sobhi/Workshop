import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Search, TrendingDown, Box, Package, List, BookOpen, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Pagination from '@/components/Pagination';
import AlertDialog from '@/components/AlertDialog';

const typeColors = {
  raw_material: '#8D7EC8',
  material: '#8D7EC8',
  service: '#3B82F6',
  product: '#10B981',
};

const typeLabels = {
  raw_material: 'مادة خام',
  material: 'مادة خام',
  service: 'خدمة',
  product: 'منتج جاهز',
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [alertDialog, setAlertDialog] = useState(null);

  const fetchInventory = () => {
    setLoading(true);
    apiClient.get('/inventory')
      .then(res => {
        setItems(res.data);
        setFiltered(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    let result = items;
    if (typeFilter !== 'all') {
      result = result.filter(i => {
        if (typeFilter === 'raw_material') return i.type === 'raw_material' || i.type === 'material';
        return i.type === typeFilter;
      });
    }
    if (search) result = result.filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku && i.sku.toLowerCase().includes(search.toLowerCase())) ||
      (i.category && i.category.toLowerCase().includes(search.toLowerCase()))
    );
    setFiltered(result);
    setPage(1);
  }, [search, typeFilter, items]);

  const handleDelete = (id, type, name) => {
    const endpoint = (type === 'material' || type === 'raw_material' || type === 'service')
      ? `/materials/${id}`
      : `/products/${id}`;

    setAlertDialog({
      type: 'confirm',
      message: `هل تريد حذف "${name}" نهائياً من المخزون؟`,
      onConfirm: async () => {
        try {
          await apiClient.delete(endpoint);
          fetchInventory();
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  const totalItems = filtered.length;
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalValue = filtered.reduce((s, i) => s + (i.quantity || 0) * (i.price || 0), 0);
  const lowStock = filtered.filter(i => i.quantity < 50).length;
  const lastPage = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">المخزون الحالي</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              مخزون المواد الخام والمنتجات الجاهزة
            </p>
          </div>
          <Link
            href="/inventory/movements"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: '#ECC796', color: '#ECC796' }}
          >
            <List className="w-4 h-4" />
            سجل الحركات
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الأصناف', value: totalItems, icon: Box, color: '#ECC796' },
            { label: 'قيمة المخزون الإجمالية', value: `EGP ${totalValue.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: Package, color: '#ECC796' },
            { label: 'أصناف منخفضة', value: lowStock, icon: TrendingDown, color: '#EF4444' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 flex items-center gap-4 font-semibold shadow-lg"
              style={{ background: '#2F264C', backgroundColor: '#2F264C', borderColor: '#3D3554' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: stat.color === '#EF4444' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(236, 199, 150, 0.2)' }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-black tracking-tight" style={{ color: stat.color }}>
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-xs font-bold mt-1" style={{ color: '#D4CEEB' }}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
            <input
              id="inventory-search"
              type="text"
              placeholder="بحث بالاسم، الكود، الفئة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl pr-10 pl-4 py-2.5 text-sm border outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'raw_material', 'service', 'product']).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={typeFilter === t
                  ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }
                  : { background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }
                }
              >
                {t === 'all' ? 'الكل' : t === 'raw_material' ? 'مواد خام' : t === 'service' ? 'خدمات' : 'منتجات'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards — shown on small screens (Zero Horizontal Scrolling) */}
        <div className="flex flex-col gap-3 sm:hidden">
          {loading ? (
            <div className="text-center py-16 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : pagedItems.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: '#A49EC0' }}>لا توجد نتائج مطابقة</div>
          ) : pagedItems.map((item) => {
            const isLow = item.quantity < 50;
            return (
              <div key={`m-${item.type}-${item.id}`} className="rounded-2xl border p-4 space-y-3 shadow-lg bg-[#201A30] border-[#3D3554]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10.5px] px-2 py-0.5 rounded-lg font-bold" style={{ background: 'rgba(236,199,150,0.15)', borderColor: 'rgba(236,199,150,0.3)', color: '#ECC796' }}>
                        {typeLabels[item.type]}
                      </span>
                      {item.category && (
                        <span className="text-[10px] text-[#A49EC0]">{item.category}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id, item.type, item.name)}
                    className="p-1.5 rounded-lg bg-[#2F264C] text-red-400 border border-[#3D3554] hover:bg-red-500/10 transition-colors"
                    aria-label="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#3D3554]/60">
                  <div className="rounded-xl p-2 bg-[#2F264C] border border-[#3D3554] text-center">
                    <span className="text-[10px] text-[#A49EC0] block">الكمية:</span>
                    <p className="font-bold font-mono mt-0.5" style={{ color: isLow ? '#EF4444' : '#10B981' }}>
                      {item.quantity.toLocaleString('ar-SA')} {item.unit} {isLow && '⚠'}
                    </p>
                  </div>
                  <div className="rounded-xl p-2 bg-[#2F264C] border border-[#3D3554] text-center">
                    <span className="text-[10px] text-[#A49EC0] block">القيمة الإجمالية:</span>
                    <p className="font-bold text-[#ECC796] font-mono mt-0.5">
                      EGP {(item.quantity * item.price).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table — hidden on small screens */}
        <div className="hidden sm:block rounded-2xl border overflow-hidden shadow-xl" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
                    {['الاسم', 'الفئة', 'النوع', 'الكمية', 'السعر', 'الإجمالي', 'الإجراءات'].map(h => (
                      <th key={h} className="text-right px-5 py-4 font-semibold text-xs uppercase tracking-wider" style={{ color: '#D4CEEB' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item, idx) => {
                    const isLow = item.quantity < 50;
                    return (
                      <tr
                        key={`${item.type}-${item.id}`}
                        className="border-b transition-colors hover:bg-white/5"
                        style={{ borderColor: '#3D3554', background: '#2F264C' }}
                      >
                        <td className="px-5 py-4 font-bold text-white">{item.name}</td>
                        <td className="px-5 py-4 font-medium" style={{ color: '#D4CEEB' }}>{item.category}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold border" style={{ background: 'rgba(236,199,150,0.15)', borderColor: 'rgba(236,199,150,0.3)', color: '#ECC796' }}>
                            {typeLabels[item.type]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-base" style={{ color: isLow ? '#EF4444' : '#10B981' }}>
                            {item.quantity.toLocaleString('ar-SA')} {item.unit}
                          </span>
                          {isLow && <span className="mr-1.5 text-xs font-bold" style={{ color: '#EF4444' }}>⚠ منخفض</span>}
                        </td>
                        <td className="px-5 py-4 text-white font-semibold">
                          EGP {item.price.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 font-bold text-base" style={{ color: '#ECC796' }}>
                          EGP {(item.quantity * item.price).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleDelete(item.id, item.type, item.name)}
                            className="p-1.5 rounded-lg bg-[#231B3D] text-red-400 border border-[#3D3554] hover:bg-red-500/10 transition-colors"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12" style={{ color: '#A49EC0' }}>
                        لا توجد نتائج مطابقة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pagination
          currentPage={page}
          lastPage={lastPage}
          total={totalItems}
          loading={loading}
          onPageChange={setPage}
        />

        <AlertDialog
          alertDialog={alertDialog}
          onClose={() => setAlertDialog(null)}
        />
      </div>
    </MainLayout>
  );
}
