import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import {
  DollarSign, ShoppingCart, Box, Zap, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Warehouse, ArrowLeftRight, Package, Layers, Tags, Truck, Wrench, Cog, TrendingDown,
  Wallet, FileText, Settings, User, Users, LayoutGrid, Calculator, PieChart
} from 'lucide-react';

const ICONS = {
  DollarSign: <DollarSign className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-4 h-4" />,
  Box: <Box className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  PieChart: <PieChart className="w-4 h-4" />,
  Calculator: <Calculator className="w-4 h-4" />,
};

const activityIcons = {
  inventory: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  production: <Zap className="w-4 h-4 text-purple-400" />,
  shipment: <CheckCircle className="w-4 h-4 text-green-400" />,
  order: <ShoppingCart className="w-4 h-4 text-blue-400" />,
};

const quickAccessPages = [
  { label: 'المستودعات', icon: Warehouse, href: '/warehouses' },
  { label: 'المخزون', icon: Box, href: '/inventory' },
  { label: 'حركات المخزون', icon: ArrowLeftRight, href: '/inventory/movements' },
  { label: 'المواد الخام', icon: Package, href: '/materials?tab=material' },
  { label: 'الخدمات', icon: Wrench, href: '/materials?tab=service' },
  { label: 'المنتجات وجداول BOM', icon: Layers, href: '/products' },
  { label: 'إدارة الفئات والوحدات', icon: Tags, href: '/categories' },
  { label: 'الموردون', icon: Truck, href: '/suppliers?tab=suppliers' },
  { label: 'العملاء', icon: Users, href: '/suppliers?tab=clients' },
  { label: 'المشتريات', icon: ShoppingCart, href: '/procurement' },
  { label: 'الخدمات الخارجية', icon: Wrench, href: '/external-services' },
  { label: 'أوامر الإنتاج', icon: Cog, href: '/production' },
  { label: 'المبيعات', icon: DollarSign, href: '/sales' },
  { label: 'المصروفات', icon: TrendingDown, href: '/expenses' },
  { label: 'الخزينة والسيولة', icon: Wallet, href: '/treasury' },
  { label: 'الحسابات والقوائم', icon: FileText, href: '/accounts' },
  { label: 'إعدادات النظام', icon: Settings, href: '/settings' },
  { label: 'الملف الشخصي', icon: User, href: '/profile' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useAppStore();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/dashboard?date=${selectedDate}`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const kpis = data?.kpis ?? [
    { id: 1, label: 'إجمالي الإيرادات', value: '...', icon: 'DollarSign' },
    { id: 2, label: 'إجمالي المصروفات', value: '...', icon: 'ShoppingCart' },
    { id: 3, label: 'قيمة المخزون', value: '...', icon: 'Box' },
    { id: 4, label: 'وحدات الإنتاج', value: '...', icon: 'Zap' },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">لوحة التحكم</h1>
            <p className="text-xs mt-0.5" style={{ color: '#A49EC0' }}>
              مرحباً بك في نظام إدارة موارد المؤسسة
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border transition-all hover:border-[#ECC796]/50 self-start sm:self-auto" style={{ borderColor: '#3D3554', background: '#2F264C', color: '#ECC796' }}>
            <Clock className="w-3.5 h-3.5" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-[#ECC796] font-semibold outline-none cursor-pointer text-xs"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* 1. Priority 1: Full Quick Access to All Pages & Tabs */}
        <div className="p-3.5 sm:p-4 rounded-2xl border transition-all" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#ECC796]/20 text-[#ECC796]">
              <LayoutGrid className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-[#ECC796]">
              وصول سريع:
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {quickAccessPages.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="px-2.5 py-2.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold text-white transition-all hover:bg-white/10 hover:border-[#ECC796]/50 border border-[#3D3554] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 text-center min-w-0"
                style={{ background: '#231B3D' }}
                title={item.label}
              >
                <item.icon className="w-3.5 h-3.5 text-[#ECC796] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 2. Priority 2: KPI Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-xl p-3 border transition-all hover:scale-[1.01] cursor-default flex flex-col justify-between"
              style={{ background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: '#3D3554' }}
                >
                  <span style={{ color: '#ECC796' }}>
                    {ICONS[kpi.icon] ?? <TrendingUp className="w-4 h-4" />}
                  </span>
                </div>
                {kpi.change && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[65px]" style={{ background: '#3D3554', color: '#ECC796' }} title={kpi.change}>
                    {kpi.change}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm sm:text-base font-extrabold mb-0.5 text-white truncate" title={kpi.value}>
                  {loading ? <span className="animate-pulse">...</span> : kpi.value}
                </p>
                <p className="text-[11px] font-medium leading-tight truncate" style={{ color: '#A49EC0' }} title={kpi.label}>
                  {kpi.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Priority 3: Latest Activities */}
        <div className="rounded-2xl border p-4 sm:p-5" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <div className="flex items-center justify-between mb-3 border-b border-[#3D3554]/60 pb-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#ECC796]" />
              الأنشطة الأخيرة
            </h3>
            <span className="text-xs" style={{ color: '#A49EC0' }}>آخر الحركات والتنبيهات المباشرة</span>
          </div>
          {loading ? (
            <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentActivities ?? []).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-white/5 border border-white/[0.03]"
                >
                  <div className="mt-0.5 shrink-0">
                    {activityIcons[activity.type] ?? <Clock className="w-4 h-4" style={{ color: '#A49EC0' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-relaxed">{activity.description}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: '#A49EC0' }}>{activity.time}</p>
                  </div>
                </div>
              ))}
              {(!data?.recentActivities || data.recentActivities.length === 0) && (
                <p className="text-center py-6 text-xs" style={{ color: '#A49EC0' }}>لا توجد أنشطة حديثة</p>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

