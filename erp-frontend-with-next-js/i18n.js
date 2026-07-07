import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

const runsOnServerSide = typeof window === 'undefined';

i18next
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language, namespace) =>
        import(`./public/locales/${language}/${namespace}.json`)
    )
  )
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    lng: runsOnServerSide ? 'en' : undefined,
    ns: ['common', 'dashboard'],
    interpolation: {
      escapeValue: false,
    },
    resources: {},
  });

export default i18next;
