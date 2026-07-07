'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/main-layout';
import { useAppStore } from '@/lib/store';
import apiClient from '@/lib/api-client';
import { User, Mail, Shield, Key, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, token, updateUser } = useAppStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password && password !== passwordConfirmation) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.put('/auth/profile', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      updateUser(response.data.user);
      setSuccess('تم تحديث بيانات الملف الشخصي بنجاح.');
      setPassword('');
      setPasswordConfirmation('');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.errors?.email?.[0] || 
        'حدث خطأ أثناء تحديث الملف الشخصي.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'مسؤول النظام (Admin)';
      case 'manager': return 'مدير قسم (Manager)';
      case 'worker': return 'موظف (Worker)';
      default: return 'مستخدم (User)';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">الملف الشخصي</h1>
          <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
            تعديل معلومات الحساب الشخصي وتغيير كلمة المرور
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Card */}
          <div 
            className="md:col-span-1 rounded-2xl border p-6 flex flex-col items-center justify-center text-center select-none"
            style={{ background: '#231B3D', borderColor: '#3D3554' }}
          >
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl shadow-lg mb-4"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {user?.name ? user.name.charAt(0) : 'م'}
            </div>
            <h3 className="text-lg font-bold text-white">{user?.name}</h3>
            <p className="text-xs font-semibold mt-1" style={{ color: '#ECC796' }}>{getRoleLabel(user?.role || 'user')}</p>
            <p className="text-xs mt-2" style={{ color: '#A49EC0' }}>{user?.email}</p>

            <div className="w-full border-t border-[#3D3554] mt-6 pt-6 text-right space-y-4">
              <h4 className="text-xs font-bold text-white">صلاحيات الحساب</h4>
              <div className="flex flex-wrap gap-2">
                {user?.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((perm) => (
                    <span 
                      key={perm}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: 'rgba(236, 199, 150, 0.1)', color: '#ECC796' }}
                    >
                      {perm === 'manage_all' ? 'إدارة كاملة' : perm}
                    </span>
                  ))
                ) : (
                  <span className="text-xs" style={{ color: '#A49EC0' }}>لا توجد صلاحيات مخصصة</span>
                )}
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div 
            className="md:col-span-2 rounded-2xl border p-6"
            style={{ background: '#231B3D', borderColor: '#3D3554' }}
          >
            <h3 className="text-sm font-bold text-white mb-6">تعديل معلومات الحساب</h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {error && (
                <div 
                  className="flex items-center gap-2 p-4 rounded-xl border text-xs text-red-200"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div 
                  className="flex items-center gap-2 p-4 rounded-xl border text-xs text-green-200"
                  style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
                  <span>{success}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>الاسم بالكامل</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full rounded-xl py-2.5 pr-10 pl-4 text-xs border outline-none transition-all"
                      style={{
                        background: '#2F264C',
                        borderColor: '#3D3554',
                        color: '#FFFFFF',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl py-2.5 pr-10 pl-4 text-xs border outline-none transition-all"
                      style={{
                        background: '#2F264C',
                        borderColor: '#3D3554',
                        color: '#FFFFFF',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#3D3554] pt-5">
                <h4 className="text-xs font-bold text-white mb-4">تغيير كلمة المرور (اختياري)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>كلمة المرور الجديدة</label>
                    <div className="relative">
                      <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="اتركها فارغة لإبقائها كما هي"
                        className="w-full rounded-xl py-2.5 pr-10 pl-4 text-xs border outline-none transition-all"
                        style={{
                          background: '#2F264C',
                          borderColor: '#3D3554',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>تأكيد كلمة المرور</label>
                    <div className="relative">
                      <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
                      <input 
                        type="password" 
                        value={passwordConfirmation}
                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                        placeholder="أدخل تأكيد كلمة المرور"
                        className="w-full rounded-xl py-2.5 pr-10 pl-4 text-xs border outline-none transition-all"
                        style={{
                          background: '#2F264C',
                          borderColor: '#3D3554',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl py-2 px-6 text-xs font-bold shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التعديلات...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
