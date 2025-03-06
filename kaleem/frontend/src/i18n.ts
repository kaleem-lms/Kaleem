import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpApi from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(LanguageDetector) // Auto-detects language from browser/localStorage
  .use(initReactI18next) // Passes i18n down to react-i18next
  .use(HttpApi) // Loads translations from your backend or static files
  .init({
    fallbackLng: 'en', // Use English if the detected language isn't available
    detection: {
      order: ['localStorage', 'navigator'], // Try localStorage first, then detect from the browser
      caches: ['localStorage'], // Cache the language in localStorage for future visits
    },
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })

i18n.on('languageChanged', (lng) => {
  i18n.language = lng.split('-')[0]
})

export default i18n
