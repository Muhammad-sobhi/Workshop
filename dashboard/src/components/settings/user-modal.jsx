'use client';

import React from 'react';
import { AlertCircle, Loader2, ShieldCheck, UserCheck, Package, ShoppingBag, Cog, FileText } from 'lucide-react';

const rolePresets = [
  {
    role: 'admin',
    label: '👑 مدير عام / المالك (Admin)',
    desc: 'كامل الصلاحيات (الخزينة، الأرباح، الإعدادات، المستخدمين)',
    perms: ['manage_all']
  },
  {
    role: 'sales',
    label: '💼 كاشير / مسؤول مبيعات (Sales)',
    desc: 'إصدار فواتير المبيعات، العملاء، والبيع المباشر (بدون أرباح الورشة أو الخزينة)',
    perms: ['manage_sales']
  },
  {
    role: 'inventory',
    label: '📦 أمين مستودع وخامات (Inventory)',
    desc: 'إدارة المخازن، حركات المواد الخام والمنتجات، والجرد والتسويات',
    perms: ['manage_inventory']
  },
  {
    role: 'production',
    label: '🏭 مدير تشغيل وإنتاج (Production)',
    desc: 'إدارة أوامر التصنيع، جداول المكونات BOM، وكروت الورشة',
    perms: ['manage_production', 'manage_inventory']
  },
  {
    role: 'manager',
    label: '💰 محاسب مالي (Accountant)',
    desc: 'إدارة الحسابات، الخزينة، المصروفات، الموردين، وتقارير P&L',
    perms: ['manage_accounts', 'manage_sales']
  }
];

const permissionOptions = [
  { key: 'manage_all', label: 'إدارة كاملة للمشروع والنظام' },
  { key: 'manage_inventory', label: 'إدارة المخزون والمستودعات والمواد الخام' },
  { key: 'manage_production', label: 'إدارة عمليات الإنتاج وأوامر التشغيل' },
  { key: 'manage_sales', label: 'إدارة المبيعات وفواتير العملاء' },
  { key: 'manage_accounts', label: 'إدارة الحسابات والخزينة والمصروفات' },
  { key: 'manage_settings', label: 'إدارة إعدادات النظام والنسخ الاحتياطي' },
  { key: 'manage_categories', label: 'إدارة الفئات والوحدات' }
];

export default function UserModal({
  editingUser,
  userName, setUserName,
  userEmail, setUserEmail,
  userPassword, setUserPassword,
  userRole, setUserRole,
  userPerms, setUserPerms, togglePermission,
  formLoading, formError,
  handleUserSubmit,
  onClose
}) {
  const handleRoleChange = (selectedRole) => {
    setUserRole(selectedRole);
    const preset = rolePresets.find(r => r.role === selectedRole);
    if (preset && setUserPerms) {
      setUserPerms(preset.perms);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
        style={{ background: '#231B3D', borderColor: '#3D3554' }}
      >
        <div className="flex justify-between items-center border-b border-[#3D3554] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#ECC796]" />
            <h3 className="text-sm font-bold text-white">
              {editingUser ? `تعديل صلاحيات المستخدم: ${editingUser.name}` : 'إضافة مستخدم جديد للنظام'}
            </h3>
          </div>
          <button onClick={onClose} className="text-xs text-[#A49EC0] hover:text-white">إغلاق</button>
        </div>

        {formError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl border text-xs text-red-200"
            style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الاسم الكامل *</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              placeholder="مثال: أحمد عبد الله"
              className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>البريد الإلكتروني *</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                placeholder="user@workshop.com"
                className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>
                كلمة المرور {editingUser && '(اتركها فارغة للتخطي)'}
              </label>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>
          </div>

          {/* Role Presets */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الدور الوظيفي المعتمد *</label>
            <select
              value={userRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full rounded-xl py-2.5 px-3 text-xs border outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              {rolePresets.map(r => (
                <option key={r.role} value={r.role}>{r.label}</option>
              ))}
            </select>
            <p className="text-[11px] mt-1 text-[#A49EC0]">
              {rolePresets.find(r => r.role === userRole)?.desc || ''}
            </p>
          </div>

          {/* Permission Checklist */}
          <div>
            <label className="block text-xs font-bold mb-2 text-white">صلاحيات الوصول التفصيلية:</label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2.5 bg-[#2F264C] rounded-xl border border-[#3D3554]">
              {permissionOptions.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={userPerms.includes(p.key) || userPerms.includes('manage_all')}
                    disabled={userPerms.includes('manage_all') && p.key !== 'manage_all'}
                    onChange={() => togglePermission(p.key)}
                    className="rounded border-[#3D3554] text-[#ECC796] focus:ring-0 focus:ring-offset-0 bg-[#231B3D]"
                  />
                  <span style={{ color: userPerms.includes(p.key) || userPerms.includes('manage_all') ? '#FFFFFF' : '#A49EC0' }}>
                    {p.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#3D3554]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl py-2 px-4 text-xs font-semibold hover:bg-white/5 transition-colors"
              style={{ color: '#A49EC0' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="rounded-xl py-2 px-5 text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>حفظ بيانات المستخدم</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
