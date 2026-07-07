'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import apiClient from '@/lib/api-client';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, token } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      
      setAuth(user, access_token);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.errors?.email?.[0] || 
        'خطأ في تسجيل الدخول. يرجى التحقق من البيانات والمحاولة مرة أخرى.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 select-none relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #201A30 0%, #2F264C 100%)' }}
    >
      {/* Decorative Orbs */}
      <div 
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-20 -top-10 -right-10"
        style={{ background: '#ECC796' }}
      />
      <div 
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-20 -bottom-20 -left-20"
        style={{ background: '#D4A660' }}
      />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        <div 
          className="rounded-3xl border border-white/10 p-8 shadow-2xl backdrop-blur-md relative overflow-hidden"
          style={{ background: 'rgba(35, 27, 61, 0.7)' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-black text-xl shadow-lg mb-4"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              ERP
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">نظام إدارة الموارد</h1>
            <p className="text-sm" style={{ color: '#A49EC0' }}>سجل الدخول للمتابعة إلى حسابك</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div 
                className="flex items-center gap-2 p-4 rounded-2xl border text-xs text-red-200"
                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A49EC0' }} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@erp.com"
                  required
                  className="w-full rounded-2xl py-3 pr-11 pl-4 text-sm border outline-none transition-all"
                  style={{
                    background: '#231B3D',
                    borderColor: '#3D3554',
                    color: '#FFFFFF',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A49EC0' }} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-2xl py-3 pr-11 pl-4 text-sm border outline-none transition-all"
                  style={{
                    background: '#231B3D',
                    borderColor: '#3D3554',
                    color: '#FFFFFF',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3 text-sm font-bold shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 mt-4 hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          {/* Seeder Info Alert */}
          <div className="mt-8 text-center border-t border-white/5 pt-4">
            <p className="text-[11px]" style={{ color: '#A49EC0' }}>
              البريد الافتراضي: <span className="text-white font-mono">admin@erp.com</span> | كلمة المرور: <span className="text-white font-mono">password</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
