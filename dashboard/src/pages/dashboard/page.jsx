import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { DollarSign, ShoppingCart, Box, Zap, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const ICONS = {
  DollarSign: <DollarSign className="w-6 h-6" />,
  ShoppingCart: <ShoppingCart className="w-6 h-6" />,
  Box: <Box className="w-6 h-6" />,
  Zap: <Zap className="w-6 h-6" />,
};

const PIE_COLORS = ['#F59E0B', '#ECC796', '#10B981'];

const activityIcons = {
  inventory: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  production: <Zap className="w-4 h-4 text-purple-400" />,
  shipment: <CheckCircle className="w-4 h-4 text-green-400" />,
  order: <ShoppingCart className="w-4 h-4 text-blue-400" />,
};

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
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">لوحة التحكم</h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#A49EC0' }}>
              مرحباً بك في نظام إدارة موارد المؤسسة
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg border transition-all hover:border-[#ECC796]/50" style={{ borderColor: '#3D3554', background: '#2F264C', color: '#ECC796' }}>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.id}
              className="rounded-xl p-2.5 border transition-all hover:scale-[1.01] cursor-default"
              style={{ background: 'rgb(47, 38, 76)', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: '#3D3554' }}
                >
                  <span style={{ color: '#ECC796' }}>
                    {ICONS[kpi.icon]}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#3D3554', color: '#ECC796' }}>
                  {kpi.change}
                </span>
              </div>
              <p className="text-sm font-extrabold mb-0.5 text-white truncate">
                {loading ? <span className="animate-pulse">...</span> : kpi.value}
              </p>
              <p className="text-[10px] font-medium" style={{ color: '#A49EC0' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue/Expense Area Chart */}
          <div className="lg:col-span-2 rounded-2xl border p-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">الإيرادات والمصروفات</h3>
              <div className="flex items-center gap-4 text-xs" style={{ color: '#A49EC0' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ECC796' }} />
                  الإيرادات
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#EF4444' }} />
                  المصروفات
                </span>
              </div>
            </div>
            {loading ? (
              <div className="h-44 flex items-center justify-center text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data?.revenueChart ?? []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ECC796" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ECC796" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3D3554" />
                  <XAxis dataKey="month" tick={{ fill: '#A49EC0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A49EC0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#231B3D', border: '1px solid #3D3554', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                    formatter={(value) => [`EGP ${Number(value).toLocaleString('ar-SA')}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#ECC796" strokeWidth={2} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expense" name="المصروفات" stroke="#EF4444" strokeWidth={2} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart */}
          <div className="rounded-2xl border p-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <h3 className="text-sm font-semibold text-white mb-3">حالة الإنتاج</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={data?.orderChart ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(data?.orderChart ?? []).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#231B3D', border: '1px solid #3D3554', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {(data?.orderChart ?? []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span style={{ color: '#D4CEEB' }}>{item.name}</span>
                      </span>
                      <span className="font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-2xl border p-4" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <h3 className="text-sm font-semibold text-white mb-2">الأنشطة الأخيرة</h3>
          {loading ? (
            <div className="text-center py-6 text-xs" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="space-y-1.5">
              {(data?.recentActivities ?? []).slice(0, 4).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-xl transition-colors hover:bg-white/5"
                >
                  <div className="mt-0.5 shrink-0">
                    {activityIcons[activity.type] ?? <Clock className="w-4 h-4" style={{ color: '#A49EC0' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-tight truncate">{activity.description}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#A49EC0' }}>{activity.time}</p>
                  </div>
                </div>
              ))}
              {(!data?.recentActivities || data.recentActivities.length === 0) && (
                <p className="text-center py-2 text-xs" style={{ color: '#A49EC0' }}>لا توجد أنشطة حديثة</p>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
