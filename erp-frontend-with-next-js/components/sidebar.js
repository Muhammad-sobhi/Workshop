'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import apiClient from '@/lib/api-client';
import {
  Menu, X, BarChart3, Box, Truck, Cog, DollarSign, 
  ShoppingCart, Warehouse, ArrowLeftRight, FileText, Package, TrendingDown, Settings, Layers
} from 'lucide-react';

import { LogOut, Tags } from 'lucide-react';
import { useRouter } from 'next/navigation';

const menuItems = [
  { label: 'لوحة التحكم', icon: BarChart3, href: '/dashboard' },
  { label: 'المستودعات', icon: Warehouse, href: '/warehouses' },
  { label: 'المخزون', icon: Box, href: '/inventory' },
  { label: 'حركات المخزون', icon: ArrowLeftRight, href: '/inventory/movements' },
  { label: 'المواد الخام والخدمات', icon: Package, href: '/materials' },
  { label: 'المنتجات وجداول BOM', icon: Layers, href: '/products' },
  { label: 'إدارة الفئات والوحدات', icon: Tags, href: '/categories' },
  { label: 'الموردون', icon: Truck, href: '/suppliers' },
  { label: 'المشتريات', icon: ShoppingCart, href: '/procurement' },
  { label: 'الإنتاج', icon: Cog, href: '/production' },
  { label: 'المبيعات', icon: DollarSign, href: '/sales' },
  { label: 'المصروفات', icon: TrendingDown, href: '/expenses' },
  { label: 'الحسابات', icon: FileText, href: '/accounts' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, user, setAuth } = useAppStore();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.error(e);
    }
    setAuth(null, null);
    localStorage.removeItem('erp-storage');
    router.push('/login');
  };

  const hasPermission = (href) => {
    if (!user) return false;
    if (user.role === 'admin' || user.permissions?.includes('manage_all')) return true;
    if (href === '/dashboard' || href === '/profile' || href === '/settings') return true;
    if (href === '/warehouses' || href === '/inventory' || href === '/inventory/movements' || href === '/materials') {
      return user.permissions?.includes('manage_inventory');
    }
    if (href === '/products' || href === '/production') {
      return user.permissions?.includes('manage_production');
    }
    if (href === '/suppliers' || href === '/procurement') {
      return user.permissions?.includes('manage_inventory');
    }
    if (href === '/sales') {
      return user.permissions?.includes('manage_sales');
    }
    if (href === '/expenses' || href === '/accounts') {
      return user.permissions?.includes('manage_accounts');
    }
    if (href === '/categories') {
      return user.permissions?.includes('manage_categories');
    }
    return false;
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-64 border-l border-border transition-transform duration-300 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #2F264C 0%, #231B3D 100%)' }}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              ERP
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">نظام ERP</h1>
              <p className="text-xs mt-0.5" style={{ color: '#A49EC0' }}>إدارة الموارد</p>
            </div>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden p-1 hover:bg-muted rounded" aria-label="إغلاق القائمة">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.filter(item => hasPermission(item.href)).map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => { if (sidebarOpen) toggleSidebar(); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'shadow-lg'
                    : 'hover:bg-white/5'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #ECC796, #D4A660)',
                  color: '#201A30',
                } : { color: '#D4CEEB' }}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? '' : 'group-hover:text-[#ECC796]'}`} style={{ width: '18px', height: '18px' }} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border shrink-0">
          {hasPermission('/settings') && (
            <Link
              href="/settings"
              onClick={() => { if (sidebarOpen) toggleSidebar(); }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-all"
              style={{ color: '#A49EC0' }}
            >
              <Settings style={{ width: '18px', height: '18px' }} />
              <span className="text-sm font-medium">الإعدادات</span>
            </Link>
          )}
          <div className="mt-3 mx-2 p-3 rounded-xl border" style={{ borderColor: '#3D3554', background: '#231B3D' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                >
                  {user?.name ? user.name.charAt(0) : 'م'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user?.name || 'مدير النظام'}</p>
                  <p className="text-[10px] truncate" style={{ color: '#A49EC0' }}>{user?.email || 'admin@erp.com'}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-white/10 rounded-lg text-red-400 transition-colors"
                aria-label="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={toggleSidebar}
        className="fixed bottom-6 left-6 z-40 lg:hidden p-3 rounded-full shadow-lg"
        style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
        aria-label="فتح القائمة"
      >
        <Menu className="w-6 h-6" />
      </button>
    </>
  );
}
