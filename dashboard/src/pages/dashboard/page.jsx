'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/main-layout';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import {
  Warehouse, Box, ArrowLeftRight, Package, Wrench, Layers, Tags, Truck,
  Users, ShoppingCart, Cog, DollarSign, TrendingDown, Wallet, FileText,
  Settings, User, RefreshCw, Clock, AlertTriangle, CheckCircle2, ChevronRight,
  Sparkles, Layers3, Activity, Play, Plus, ExternalLink
} from 'lucide-react';

const quickAccessPages = [
  { label: 'أوامر الإنتاج', icon: Cog, href: '/production', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: '#10B98144' },
  { label: 'المستودعات', icon: Warehouse, href: '/warehouses', color: '#ECC796', bg: 'rgba(236,199,150,0.15)', border: '#ECC79644' },
  { label: 'المخزون', icon: Box, href: '/inventory', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', border: '#60A5FA44' },
  { label: 'حركات المخزون', icon: ArrowLeftRight, href: '/inventory/movements', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', border: '#A78BFA44' },
  { label: 'المواد الخام', icon: Package, href: '/materials?tab=material', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: '#F59E0B44' },
  { label: 'المنتجات وBOM', icon: Layers, href: '/products', color: '#34D399', bg: 'rgba(52,211,153,0.15)', border: '#34D39944' },
  { label: 'المبيعات', icon: DollarSign, href: '/sales', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: '#10B98144' },
  { label: 'المشتريات', icon: ShoppingCart, href: '/procurement', color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: '#F8717144' },
  { label: 'العملاء', icon: Users, href: '/suppliers?tab=clients', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', border: '#38BDF844' },
  { label: 'الموردون', icon: Truck, href: '/suppliers?tab=suppliers', color: '#FB923C', bg: 'rgba(251,146,60,0.15)', border: '#FB923C44' },
  { label: 'الخزينة والسيولة', icon: Wallet, href: '/treasury', color: '#ECC796', bg: 'rgba(236,199,150,0.15)', border: '#ECC79644' },
  { label: 'الحسابات والقوائم', icon: FileText, href: '/accounts', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', border: '#A78BFA44' },
  { label: 'المصروفات', icon: TrendingDown, href: '/expenses', color: '#F43F5E', bg: 'rgba(244,63,94,0.15)', border: '#F43F5E44' },
  { label: 'خدمات خارجية', icon: Wrench, href: '/external-services', color: '#E879F9', bg: 'rgba(232,121,249,0.15)', border: '#E879F944' },
  { label: 'الخدمات', icon: Wrench, href: '/materials?tab=service', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', border: '#94A3B844' },
  { label: 'الفئات والوحدات', icon: Tags, href: '/categories', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', border: '#FBBF2444' },
  { label: 'إعدادات النظام', icon: Settings, href: '/settings', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', border: '#94A3B844' },
  { label: 'الملف الشخصي', icon: User, href: '/profile', color: '#CBD5E1', bg: 'rgba(203,213,225,0.15)', border: '#CBD5E144' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useAppStore();
  const currency = settings?.currency || 'EGP';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pipelineTab, setPipelineTab] = useState('in_progress'); // 'pending' | 'in_progress' | 'completed'

  const fetchDashboard = () => {
    setLoading(true);
    apiClient.get(`/dashboard?date=${selectedDate}`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedDate]);

  const metrics = data?.operational_metrics || {
    active_client_orders: 0,
    units_in_production: 0,
    low_stock_count: 0,
    external_services_count: 0,
  };

  const pipeline = data?.pipeline || {
    pending: [],
    in_progress: [],
    completed: [],
  };

  const lowStock = data?.low_stock_materials || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* Header & Date Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">مركز عمليات وتشغيل الورشة</h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                تحكم مباشر وسريع
              </span>
            </div>
            <p className="text-xs mt-1 text-[#A49EC0]">
              متابعة خط الإنتاج النشط، الخامات الحرجة، والوصول الفوري لكافة أقسام الورشة
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-[#2F264C] border-[#3D3554] text-xs">
              <Clock className="w-3.5 h-3.5 text-[#ECC796]" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
              />
            </div>
            <button
              onClick={fetchDashboard}
              className="p-2 rounded-xl border transition-all hover:bg-white/5 text-[#A49EC0] bg-[#2F264C] border-[#3D3554]"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 1. TOP 4 WORKSHOP OPERATIONAL METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Metric 1: Active Client Orders */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex flex-col justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#A49EC0]">طلبيات عملاء نشطة</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-400">
              {loading ? '...' : metrics.active_client_orders}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">أوامر جارية لم تسلم بعد</p>
          </div>

          {/* Metric 2: Units in Production */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex flex-col justify-between hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#A49EC0]">قطع قيد التصنيع</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Cog className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-blue-400">
              {loading ? '...' : metrics.units_in_production}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">تُصنّع داخل الورشة الآن</p>
          </div>

          {/* Metric 3: Low Stock Materials */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex flex-col justify-between hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#A49EC0]">خامات أوشكت على النفاد</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-amber-300">
              {loading ? '...' : metrics.low_stock_count}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">تحتاج طلب شراء فوري</p>
          </div>

          {/* Metric 4: External Services */}
          <div className="rounded-2xl border p-4 bg-[#231B3D] border-[#3D3554] flex flex-col justify-between hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#A49EC0]">خدمات ورش خارجية</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-purple-400">
              {loading ? '...' : metrics.external_services_count}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">تشغيل ودهان بالخارج</p>
          </div>

        </div>

        {/* 2. MAIN SPLIT SECTION: APP LAUNCHER GRID (Right/Top) & PRODUCTION PIPELINE (Left/Bottom) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Quick Access Smartphone App Grid (5 Cols on Desktop, Full Width on Mobile) */}
          <div className="lg:col-span-5 rounded-2xl border p-4 sm:p-5 bg-[#231B3D] border-[#3D3554] flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-[#3D3554] pb-2.5">
              <h2 className="text-xs sm:text-sm font-bold text-[#ECC796] flex items-center gap-1.5">
                <Layers3 className="w-4 h-4" />
                <span>بوابة الوصول السريع (١٨ قسماً)</span>
              </h2>
              <span className="text-[10px] text-[#A49EC0]">بلمسة واحدة</span>
            </div>

            {/* 4-Column Smartphone App Launcher Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {quickAccessPages.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 text-center group border border-[#3D3554]/50 hover:border-[#ECC796]/60 bg-[#2F264C]"
                  style={{ minHeight: '76px' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:rotate-6 shadow-sm"
                    style={{ background: item.bg, color: item.color, border: `1px solid ${item.border}` }}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-200 group-hover:text-white leading-tight truncate w-full px-0.5">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Live Workshop Production Pipeline (7 Cols on Desktop, Full Width on Mobile) */}
          <div className="lg:col-span-7 rounded-2xl border p-4 sm:p-5 bg-[#231B3D] border-[#3D3554] flex flex-col shadow-md">
            <div className="flex items-center justify-between mb-4 border-b border-[#3D3554] pb-2.5">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>خط سير أوامر الإنتاج بالورشة (Live Pipeline)</span>
                </h2>
                <p className="text-[11px] text-[#A49EC0] mt-0.5">متابعة فورية لحالة التشغيل والتسليم</p>
              </div>
              <Link
                to="/production"
                className="text-xs font-bold text-[#ECC796] hover:underline flex items-center gap-0.5 shrink-0"
              >
                فتح الورشة <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile Tab Pills Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#2F264C] border border-[#3D3554] mb-3">
              <button
                onClick={() => setPipelineTab('in_progress')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pipelineTab === 'in_progress' ? 'bg-blue-600 text-white shadow-sm' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                <span>🔨 قيد التصنيع</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
                  {pipeline.in_progress.length}
                </span>
              </button>

              <button
                onClick={() => setPipelineTab('pending')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pipelineTab === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                <span>⏳ معلق للتجهيز</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
                  {pipeline.pending.length}
                </span>
              </button>

              <button
                onClick={() => setPipelineTab('completed')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pipelineTab === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-[#A49EC0] hover:text-white'
                }`}
              >
                <span>📦 جاهز للتسليم</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
                  {pipeline.completed.length}
                </span>
              </button>
            </div>

            {/* Orders List for Active Tab */}
            <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1 flex-1">
              {loading ? (
                <div className="text-center py-10 text-xs text-[#A49EC0]">جاري تحميل أوامر الورشة...</div>
              ) : pipeline[pipelineTab]?.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#A49EC0] space-y-1">
                  <p className="font-bold text-gray-300">لا توجد أوامر في هذه المرحلة حالياً ✨</p>
                  <p>يمكنك إنشاء أمر تشغيل جديد بالضغط على قسم أوامر الإنتاج.</p>
                </div>
              ) : (
                pipeline[pipelineTab].map((op) => (
                  <div
                    key={op.id}
                    className="p-3 rounded-xl border border-[#3D3554] bg-[#2F264C] hover:border-[#ECC796]/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#ECC796]">
                          {op.operation_number}
                        </span>
                        <span className="text-[11px] font-semibold text-white truncate">
                          {op.client ? `العميل: ${op.client.name}` : '📦 تخزين بالمعرض'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A49EC0] mt-1 truncate">
                        {(op.operation_products || []).map(p => `${p.product?.name} (${p.quantity})`).join(' • ') || (op.product?.name ? `${op.product.name} (${op.quantity})` : '—')}
                      </p>
                    </div>

                    <Link
                      to="/production"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-[#ECC796] shrink-0 flex items-center gap-1 transition-all"
                    >
                      <span>عرض</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* 3. BOTTOM SECTION: CRITICAL RAW MATERIALS SHORTAGE ALERT */}
        {lowStock.length > 0 && (
          <div className="rounded-2xl border p-4 bg-gradient-to-r from-amber-500/10 via-[#231B3D] to-[#231B3D] border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                  تنبيه: يوجد {lowStock.length} خامات وصلت للحد الحرج وتكاد تنفد!
                </h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  {lowStock.map(m => `${m.name} (المتبقي: ${m.stock_quantity} ${m.unit})`).join(' • ')}
                </p>
              </div>
            </div>

            <Link
              to="/procurement"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ECC796] hover:bg-[#D4A660] text-[#201A30] transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-md active:scale-95 self-start sm:self-center"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>إجراء أمر شراء سريع +</span>
            </Link>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
