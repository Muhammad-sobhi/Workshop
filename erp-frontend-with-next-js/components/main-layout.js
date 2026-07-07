'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function MainLayout({ children }) {
  const router = useRouter();
  const { locale, sidebarOpen, toggleSidebar, token, fetchSettings } = useAppStore();
  const isArabic = locale === 'ar';
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [isArabic, locale]);

  useEffect(() => {
    if (!token) {
      router.push('/login');
    } else {
      fetchSettings();
    }
  }, [token, router, fetchSettings]);

  if (!mounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold select-none"
        style={{ background: '#201A30', color: '#D4CEEB' }}
      >
        جاري التحميل...
      </div>
    );
  }

  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm font-semibold select-none"
        style={{ background: '#201A30', color: '#D4CEEB' }}
      >
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <Sidebar />
      <div className={`flex flex-col flex-1 min-w-0 ${isArabic ? 'rtl lg:mr-64' : 'ltr lg:ml-64'}`}>
        <Header />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
