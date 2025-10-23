import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en.json';
import idTranslations from '../locales/id.json';

const resources = {
  en: {
    translation: enTranslations
  },
  id: {
    translation: idTranslations
  }
};

// Optimize i18n initialization for better performance
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Force English as default
    fallbackLng: 'en',
    debug: false,
    
    // Performance optimizations
    load: 'languageOnly', // Only load language, not region
    cleanCode: true, // Clean language codes
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // Disable language detection to force English
    detection: {
      order: [], // Empty array disables detection
      caches: [], // No caching
    },
    
    // React-specific optimizations
    react: {
      useSuspense: false, // Disable suspense to prevent loading delays
    },
  });

export default i18n;
