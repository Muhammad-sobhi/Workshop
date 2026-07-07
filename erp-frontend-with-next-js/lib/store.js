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
        company_name: 'نظام ERP',
        currency: 'ر.س',
        tax_rate: 15,
      },
      setLocale: (locale) => set({ locale }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
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
                company_name: response.data.company_name || 'نظام ERP',
                currency: response.data.currency || 'ر.س',
                tax_rate: parseFloat(response.data.tax_rate) || 0,
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
      }),
    }
  )
);
