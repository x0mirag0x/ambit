import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { initialUiLanguage } from './language';
import en from './locales/en.json';
import ru from './locales/ru.json';

void i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ru: { translation: ru },
        },
        lng: initialUiLanguage(),
        fallbackLng: 'en',
        supportedLngs: ['en', 'ru'],
        load: 'currentOnly',
        initAsync: false,
        keySeparator: false,
        nsSeparator: false,
        interpolation: { escapeValue: false },
        returnNull: false,
        returnEmptyString: false,
        react: { useSuspense: false },
    });

export default i18n;
