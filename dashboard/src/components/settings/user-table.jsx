'use client';

import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

const roleLabels = {
  admin: 'مدير',
  manager: 'مشرف',
  user: 'موظف/عامل'
};

const roleStyles = {
  admin: { background: 'rgba(236,199,150,0.15)', color: '#ECC796' },
  manager: { background: 'rgba(196,184,240,0.15)', color: '#C4B8F0' },
  user: { background: 'rgba(255,255,255,0.05)', color: '#FFFFFF' }
};

export default function UserTable({ users, currentUser, onEdit, onDelete }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-xl"
      style={{ background: '#231B3D', borderColor: '#3D3554' }}
    >
      <div className="p-5 border-b border-[#3D3554] flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">حسابات مستخدمين وعمال النظام</h3>
        <span className="text-xs font-semibold text-[#A49EC0]">
          {users.length} مستخدم
        </span>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-xs text-[#A49EC0]">
          لا يوجد مستخدمين مسجلين
        </div>
      ) : (
        <>
          {/* Mobile Cards View (Zero Horizontal Scrolling) */}
          <div className="block md:hidden divide-y divide-[#3D3554]">
            {users.map(u => (
              <div key={u.id} className="p-4 space-y-3 bg-[#201A30]">
                {/* Header: Name + Role + Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{u.name}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold" style={roleStyles[u.role] || roleStyles.user}>
                        {roleLabels[u.role] || 'موظف/عامل'}
                      </span>
                    </div>
                    <span className="text-xs text-[#A49EC0] font-mono mt-1 block">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEdit(u)}
                      className="p-1.5 rounded-lg bg-[#2F264C] text-[#C4B8F0] border border-[#3D3554] hover:bg-white/5 transition-colors"
                      title="تعديل"
                      aria-label="تعديل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => onDelete(u.id)}
                        className="p-1.5 rounded-lg bg-[#2F264C] text-red-400 border border-[#3D3554] hover:bg-red-500/10 transition-colors"
                        title="حذف"
                        aria-label="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions Chips */}
                <div className="pt-2 border-t border-[#3D3554]/60">
                  <span className="text-[10px] text-[#A49EC0] block mb-1.5 font-semibold">الصلاحيات الممنوحة:</span>
                  <div className="flex flex-wrap gap-1">
                    {u.permissions?.map((p) => (
                      <span key={p} className="text-[10px] bg-[#2F264C] text-gray-200 border border-[#3D3554] px-2 py-0.5 rounded-md font-medium">
                        {p === 'manage_all' ? 'إدارة كاملة' : p.replace('manage_', '')}
                      </span>
                    ))}
                    {(!u.permissions || u.permissions.length === 0) && (
                      <span className="text-[10px] text-[#625b82]">لا توجد صلاحيات محددة</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3D3554]">
                  {['الاسم بالكامل', 'البريد الإلكتروني', 'الدور الوظيفي', 'الصلاحيات', 'إجراءات'].map(h => (
                    <th key={h} className="text-right px-5 py-3 text-xs font-bold" style={{ color: '#A49EC0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-[#3d3554]/50 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 text-xs font-semibold text-white">{u.name}</td>
                    <td className="px-5 py-4 text-xs font-mono" style={{ color: '#A49EC0' }}>{u.email}</td>
                    <td className="px-5 py-4 text-xs">
                      <span className="px-2 py-0.5 rounded-lg font-bold" style={roleStyles[u.role] || roleStyles.user}>
                        {roleLabels[u.role] || 'موظف/عامل'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {u.permissions?.map((p) => (
                          <span key={p} className="text-[10px] bg-white/5 text-[#A49EC0] px-1.5 py-0.5 rounded">
                            {p === 'manage_all' ? 'إدارة كاملة' : p.replace('manage_', '')}
                          </span>
                        ))}
                        {(!u.permissions || u.permissions.length === 0) && (
                          <span className="text-[10px]" style={{ color: '#625b82' }}>لا توجد صلاحيات</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(u)}
                          className="p-1 hover:bg-white/5 rounded text-[#C4B8F0] transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => onDelete(u.id)}
                            className="p-1 hover:bg-white/5 rounded text-red-400 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
