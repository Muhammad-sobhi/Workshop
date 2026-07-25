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
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#231B3D', borderColor: '#3D3554' }}
    >
      <div className="p-5 border-b border-[#3D3554]">
        <h3 className="text-sm font-bold text-white">حسابات مستخدمين وعمال النظام</h3>
      </div>

      <div className="overflow-x-auto">
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
                <td className="px-5 py-4 text-xs" style={{ color: '#A49EC0' }}>{u.email}</td>
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
    </div>
  );
}
