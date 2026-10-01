import {
  BarChart3, Box, Truck, Cog, DollarSign, Wallet,
  ShoppingCart, Warehouse, ArrowLeftRight, FileText, Package, TrendingDown, Layers, Tags, Wrench, Users
} from 'lucide-react';

// Shared by the desktop sidebar, the mobile bottom bar and the mobile "More" page.
// shortLabel is used in the bottom bar; color is the iOS-style icon tile on the "More" page.
export const menuItems = [
  { label: 'لوحة التحكم', shortLabel: 'الرئيسية', icon: BarChart3, href: '/dashboard', color: '#5856D6' },
  { label: 'المستودعات', shortLabel: 'المستودعات', icon: Warehouse, href: '/warehouses', color: '#8E8E93' },
  { label: 'المخزون', shortLabel: 'المخزون', icon: Box, href: '/inventory', color: '#FF9500' },
  { label: 'حركات المخزون', shortLabel: 'الحركات', icon: ArrowLeftRight, href: '/inventory/movements', color: '#5AC8FA' },
  { label: 'المواد الخام والخدمات', shortLabel: 'المواد', icon: Package, href: '/materials', color: '#A2845E' },
  { label: 'المنتجات وجداول BOM', shortLabel: 'المنتجات', icon: Layers, href: '/products', color: '#AF52DE' },
  { label: 'إدارة الفئات والوحدات', shortLabel: 'الفئات', icon: Tags, href: '/categories', color: '#FF2D55' },
  { label: 'الموردون', shortLabel: 'الموردون', icon: Truck, href: '/suppliers', color: '#30B0C7' },
  { label: 'المشتريات', shortLabel: 'المشتريات', icon: ShoppingCart, href: '/procurement', color: '#007AFF' },
  { label: 'الخدمات الخارجية', shortLabel: 'الخدمات', icon: Wrench, href: '/external-services', color: '#636366' },
  { label: 'الإنتاج', shortLabel: 'الإنتاج', icon: Cog, href: '/production', color: '#FF9F0A' },
  { label: 'المبيعات', shortLabel: 'المبيعات', icon: DollarSign, href: '/sales', color: '#34C759' },
  { label: 'المصروفات', shortLabel: 'المصروفات', icon: TrendingDown, href: '/expenses', color: '#FF3B30' },
  { label: 'الخزينة والسيولة', shortLabel: 'الخزينة', icon: Wallet, href: '/treasury', color: '#32ADE6' },
  { label: 'الحسابات', shortLabel: 'الحسابات', icon: FileText, href: '/accounts', color: '#0A84FF' },
  { label: 'الموظفون والرواتب', shortLabel: 'الموظفون', icon: Users, href: '/employees', color: '#FF6482' },
];

export const MAX_BOTTOM_NAV_ITEMS = 4;
export const DEFAULT_BOTTOM_NAV = ['/dashboard', '/production', '/sales', '/treasury'];

export function hasPermission(user, href) {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions?.includes('manage_all')) return true;
  if (href === '/dashboard' || href === '/' || href === '/profile' || href === '/settings' || href === '/more') return true;
  if (href === '/warehouses' || href === '/inventory' || href === '/inventory/movements' || href === '/materials') {
    return user.permissions?.includes('manage_inventory');
  }
  if (href === '/products' || href === '/production') {
    return user.permissions?.includes('manage_production');
  }
  if (href === '/suppliers' || href === '/procurement' || href === '/external-services') {
    return user.permissions?.includes('manage_inventory');
  }
  if (href === '/sales') {
    return user.permissions?.includes('manage_sales');
  }
  if (href === '/expenses' || href === '/accounts' || href === '/treasury') {
    return user.permissions?.includes('manage_accounts');
  }
  if (href === '/categories') {
    return user.permissions?.includes('manage_categories');
  }
  if (href === '/employees') {
    return user.permissions?.includes('manage_employees') || user.permissions?.includes('manage_all');
  }
  return false;
}

export function isActivePath(pathname, href) {
  return pathname === href || (href === '/dashboard' && pathname === '/') || (href !== '/dashboard' && pathname.startsWith(href));
}

// Bottom bar sections for this user: their saved choice (or the default),
// limited to sections they are allowed to open.
export function getBottomNavItems(user, bottomNav) {
  const hrefs = Array.isArray(bottomNav) ? bottomNav : DEFAULT_BOTTOM_NAV;
  return hrefs
    .map((href) => menuItems.find((item) => item.href === href))
    .filter((item) => item && hasPermission(user, item.href))
    .slice(0, MAX_BOTTOM_NAV_ITEMS);
}
