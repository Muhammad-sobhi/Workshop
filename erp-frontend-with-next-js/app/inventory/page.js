'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Search, TrendingDown, Box, Package, List, BookOpen } from 'lucide-react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';

const typeColors = {
  material: '#8D7EC8',
  product: '#10B981',
};

const typeLabels = {
  material: 'مادة خام',
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

  useEffect(() => {
    apiClient.get('/inventory')
      .then(res => {
        setItems(res.data);
        setFiltered(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = items;
    if (typeFilter !== 'all') result = result.filter(i => i.type === typeFilter);
    if (search) result = result.filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
    setPage(1);
  }, [search, typeFilter, items]);

  const totalItems = filtered.length;
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalValue = pagedItems.reduce((s, i) => s + i.quantity * i.price, 0);
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
            { label: 'إجمالي الأصناف', value: totalItems, icon: Box, color: '#231B3D' },
            { label: 'قيمة المخزون', value: `EGP ${totalValue.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}`, icon: Package, color: '#231B3D' },
            { label: 'أصناف منخفضة', value: lowStock, icon: TrendingDown, color: '#EF4444' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border p-5 flex items-center gap-4 font-semibold" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(35, 27, 61, 0.15)' }}>
                <stat.icon className="w-5 h-5" style={{ color: '#231B3D' }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: '#231B3D' }}>{loading ? '...' : stat.value}</p>
                <p className="text-xs" style={{ color: '#4E4869' }}>{stat.label}</p>
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
            {(['all', 'material', 'product']).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={typeFilter === t
                  ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }
                  : { background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }
                }
              >
                {t === 'all' ? 'الكل' : t === 'material' ? 'مواد خام' : 'منتجات'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards — shown on small screens */}
        <div className="flex flex-col gap-3 sm:hidden">
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : pagedItems.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#A49EC0' }}>لا توجد نتائج مطابقة</div>
          ) : pagedItems.map((item, idx) => {
            const isLow = item.quantity < 50;
            return (
              <div key={`m-${item.type}-${item.id}`} className="rounded-2xl border p-4" style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#231B3D' }}>{item.name}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: '#4E4869' }}>{item.sku}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background: '#3D3554', color: '#ECC796' }}>
                    {typeLabels[item.type]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div className="rounded-lg p-2 text-center" style={{ background: '#3D3554' }}>
                    <p className="font-bold text-white">{item.quantity.toLocaleString('ar-SA')} {item.unit}</p>
                    <p style={{ color: '#D4CEEB' }}>الكمية {isLow && '⚠'}</p>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: '#3D3554' }}>
                    <p className="font-bold text-white">EGP {(item.quantity * item.price).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}</p>
                    <p style={{ color: '#D4CEEB' }}>القيمة الإجمالية</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'rgba(61,53,84,0.3)' }}>
                  <span className="text-xs" style={{ color: '#4E4869' }}>{item.category}</span>
                  <Link
                    href={`/inventory/ledger/${item.type}/${item.id}`}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#3D3554', color: '#ECC796' }}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    دفتر الحركة
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table — hidden on small screens */}
        <div className="hidden sm:block rounded-2xl border overflow-hidden" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          {loading ? (
            <div className="text-center py-16" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                    {['الكود', 'الاسم', 'الفئة', 'النوع', 'الكمية', 'السعر', 'الإجمالي', 'الدفتر'].map(h => (
                      <th key={h} className="text-right px-5 py-4 font-semibold text-xs uppercase tracking-wider" style={{ color: '#A49EC0' }}>
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
                        style={{ borderColor: '#3D3554' }}
                      >
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: '#A49EC0' }}>{item.sku}</td>
                        <td className="px-5 py-4 font-medium text-white">{item.name}</td>
                        <td className="px-5 py-4" style={{ color: '#D4CEEB' }}>{item.category}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: `${typeColors[item.type]}20`, color: typeColors[item.type] }}>
                            {typeLabels[item.type]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`font-bold ${isLow ? '' : 'text-white'}`} style={isLow ? { color: '#EF4444' } : {}}>
                            {item.quantity.toLocaleString('ar-SA')} {item.unit}
                          </span>
                          {isLow && <span className="mr-1.5 text-xs" style={{ color: '#EF4444' }}>⚠ منخفض</span>}
                        </td>
                        <td className="px-5 py-4 text-white">
                          EGP {item.price.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 font-semibold" style={{ color: '#ECC796' }}>
                          EGP {(item.quantity * item.price).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/inventory/ledger/${item.type}/${item.id}`}
                            className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
                            style={{ color: '#8D7EC8' }}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            دفتر
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12" style={{ color: '#A49EC0' }}>
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
      </div>
    </MainLayout>
  );
}
