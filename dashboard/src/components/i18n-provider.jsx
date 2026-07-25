'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18next from '@/i18n';

export function I18nProvider({ children, locale = 'en' }) {
  useEffect(() => {
    i18next.changeLanguage(locale);
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
