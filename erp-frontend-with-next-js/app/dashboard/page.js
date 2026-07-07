'use client';

import { MainLayout } from '@/components/main-layout';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
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

  useEffect(() => {
    apiClient.get('/dashboard')
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis ?? [
    { id: 1, label: 'إجمالي الإيرادات', value: '...', icon: 'DollarSign' },
    { id: 2, label: 'إجمالي المصروفات', value: '...', icon: 'ShoppingCart' },
    { id: 3, label: 'قيمة المخزون', value: '...', icon: 'Box' },
    { id: 4, label: 'وحدات الإنتاج', value: '...', icon: 'Zap' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              مرحباً بك في نظام إدارة موارد المؤسسة
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm px-4 py-2 rounded-xl border" style={{ borderColor: '#3D3554', background: '#2F264C', color: '#A49EC0' }}>
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.id}
              className="rounded-2xl p-5 border transition-all hover:scale-[1.02] cursor-default"
              style={{ background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                  style={{ background: 'rgba(35, 27, 61, 0.15)' }}
                >
                  <span style={{ color: '#231B3D' }}>
                    {ICONS[kpi.icon]}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(35,27,61,0.15)', color: '#231B3D' }}>
                  {kpi.change}
                </span>
              </div>
              <p className="text-2xl font-bold mb-1">
                {loading ? <span className="animate-pulse">...</span> : kpi.value.replace('SAR', 'EGP')}
              </p>
              <p className="text-sm font-medium" style={{ color: '#4E4869' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue/Expense Area Chart */}
          <div className="lg:col-span-2 rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white">الإيرادات والمصروفات</h3>
              <div className="flex items-center gap-4 text-xs" style={{ color: '#A49EC0' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#ECC796' }} />
                  الإيرادات
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#EF4444' }} />
                  المصروفات
                </span>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
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
                  <XAxis dataKey="month" tick={{ fill: '#A49EC0', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A49EC0', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#231B3D', border: '1px solid #3D3554', borderRadius: '12px', color: '#fff' }}
                    formatter={(value) => [`EGP ${Number(value).toLocaleString('ar-SA')}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#ECC796" strokeWidth={2} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expense" name="المصروفات" stroke="#EF4444" strokeWidth={2} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart */}
          <div className="rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
            <h3 className="font-semibold text-white mb-6">حالة الإنتاج</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.orderChart ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(data?.orderChart ?? []).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#231B3D', border: '1px solid #3D3554', borderRadius: '12px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {(data?.orderChart ?? []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
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
        <div className="rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
          <h3 className="font-semibold text-white mb-4">الأنشطة الأخيرة</h3>
          {loading ? (
            <div className="text-center py-8" style={{ color: '#A49EC0' }}>جاري التحميل...</div>
          ) : (
            <div className="space-y-3">
              {(data?.recentActivities ?? []).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-3 rounded-xl transition-colors hover:bg-white/5"
                >
                  <div className="mt-0.5 shrink-0">
                    {activityIcons[activity.type] ?? <Clock className="w-4 h-4" style={{ color: '#A49EC0' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-relaxed">{activity.description}</p>
                    <p className="text-xs mt-1" style={{ color: '#A49EC0' }}>{activity.time}</p>
                  </div>
                </div>
              ))}
              {(!data?.recentActivities || data.recentActivities.length === 0) && (
                <p className="text-center py-4" style={{ color: '#A49EC0' }}>لا توجد أنشطة حديثة</p>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
