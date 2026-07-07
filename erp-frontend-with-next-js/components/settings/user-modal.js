'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

const permissionOptions = [
  { key: 'manage_all', label: 'إدارة كاملة للمشروع' },
  { key: 'manage_inventory', label: 'إدارة المخزون والمستودعات' },
  { key: 'manage_production', label: 'إدارة عمليات الإنتاج والتصنيع' },
  { key: 'manage_sales', label: 'إدارة المبيعات والعملاء' },
  { key: 'manage_accounts', label: 'إدارة الحسابات والمالية' },
  { key: 'manage_settings', label: 'إدارة إعدادات النظام والمستخدمين' },
  { key: 'manage_categories', label: 'إدارة الفئات والوحدات' }
];

export default function UserModal({
  editingUser,
  userName, setUserName,
  userEmail, setUserEmail,
  userPassword, setUserPassword,
  userRole, setUserRole,
  userPerms, togglePermission,
  formLoading, formError,
  handleUserSubmit,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
        style={{ background: '#231B3D', borderColor: '#3D3554' }}
      >
        <div className="flex justify-between items-center border-b border-[#3D3554] pb-3">
          <h3 className="text-sm font-bold text-white">
            {editingUser ? `تعديل صلاحيات المستخدم: ${editingUser.name}` : 'إضافة مستخدم جديد'}
          </h3>
          <button onClick={onClose} className="text-xs text-[#A49EC0] hover:text-white">إغلاق</button>
        </div>

        <form onSubmit={handleUserSubmit} className="space-y-4">
          {formError && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl border text-xs text-red-200"
              style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الاسم الكامل</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>البريد الإلكتروني</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
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

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>الدور الوظيفي</label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
            >
              <option value="user">موظف عادي (User)</option>
              <option value="manager">مشرف إنتاج/مخازن (Manager)</option>
              <option value="admin">مسؤول نظام كامل (Admin)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2 text-white">تخصيص صلاحيات العمل:</label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-[#2F264C] rounded-xl border border-[#3D3554]">
              {permissionOptions.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={userPerms.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                    className="rounded border-[#3D3554] text-[#ECC796] focus:ring-0 focus:ring-offset-0 bg-[#231B3D]"
                  />
                  <span style={{ color: '#D4CEEB' }}>{p.label}</span>
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
              {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>حفظ بيانات الحساب</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
