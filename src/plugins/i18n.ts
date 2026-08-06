import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translations from '../locales';
import { STORAGE_KEYS } from '../constants/storage';

const savedLanguage = localStorage.getItem(STORAGE_KEYS.language) || 'pt';

i18n
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    lng: savedLanguage,
    fallbackLng: 'en',
    resources: translations,
    defaultNS: 'translations',
    interpolation: {
      // React already escapes rendered strings; i18next's own HTML-escaping
      // would show card/deck names like "A // B" as "A &#x2F;&#x2F; B".
      escapeValue: false
    }
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEYS.language, lng);
});

export default i18n;
