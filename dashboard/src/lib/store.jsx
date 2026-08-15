import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from './api-client';

export const useAppStore = create(
  persist(
    (set) => ({
      locale: 'ar',
      sidebarOpen: false,
      user: null,
      token: null,
      settings: {
        company_name: 'ورشة الأثاث الحديث',
        phone: '',
        address: '',
        tax_number: '',
        commercial_register: '',
        invoice_footer: 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة ضد عيوب الصناعة',
        currency: 'EGP',
        tax_rate: 0,
        logo_path: null,
      },
      theme: 'dark',
      setLocale: (locale) => set({ locale }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setAuth: (user, token) => {
        set({ user, token });
      },
      updateUser: (updatedFields) => {
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...updatedFields } };
        });
      },
      fetchSettings: async () => {
        try {
          const response = await apiClient.get('/settings');
          if (response.data) {
            set({
              settings: {
                company_name: response.data.company_name || 'ورشة الأثاث الحديث',
                phone: response.data.phone || '',
                address: response.data.address || '',
                tax_number: response.data.tax_number || '',
                commercial_register: response.data.commercial_register || '',
                invoice_footer: response.data.invoice_footer || 'شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة',
                currency: response.data.currency || 'EGP',
                tax_rate: parseFloat(response.data.tax_rate) || 0,
                logo_path: response.data.logo_path || null,
              }
            });
          }
        } catch (err) {
          console.error('Failed to fetch settings', err);
        }
      },
      updateSettingsState: (settings) => set({ settings }),
    }),
    {
      name: 'erp-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        locale: state.locale,
        theme: state.theme,
      }),
    }
  )
);
