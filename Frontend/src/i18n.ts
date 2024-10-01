import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(HttpApi) // loads translations from your backend or static files
    .use(LanguageDetector) // auto-detects language from browser
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        fallbackLng: 'en', // default language
        debug: true,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json', // path to translation files
        },
    });

export default i18n;
