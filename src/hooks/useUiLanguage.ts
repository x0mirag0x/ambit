import { useEffect } from 'react';
import i18n from '../i18n';
import {
    clearCachedUiLanguage,
    isUiLanguage,
    readCachedUiLanguage,
    resolveUiLanguage,
    writeCachedUiLanguage,
    type UiLanguage,
} from '../i18n/language';
import { isTauriRuntime } from '../services/runtime';

const DOCUMENT_TITLES: Record<UiLanguage, string> = {
    en: 'DV | Local AI Workspace',
    ru: 'DV | Локальная рабочая среда для ИИ',
};

export const useUiLanguage = (savedLanguage: unknown, isSettingsLoaded: boolean): void => {
    const language = isSettingsLoaded
        ? resolveUiLanguage(savedLanguage)
        : (readCachedUiLanguage() ?? resolveUiLanguage(undefined));

    useEffect(() => {
        if (i18n.language !== language) {
            void i18n.changeLanguage(language);
        }

        document.documentElement.lang = language;
        document.title = DOCUMENT_TITLES[language];

        if (isSettingsLoaded) {
            if (isUiLanguage(savedLanguage)) writeCachedUiLanguage(savedLanguage);
            else clearCachedUiLanguage();
        }

        if (!isTauriRuntime()) return;

        let cancelled = false;
        void import('@tauri-apps/api/window')
            .then(({ getCurrentWindow }) => {
                if (!cancelled) return getCurrentWindow().setTitle(DOCUMENT_TITLES[language]);
                return undefined;
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [isSettingsLoaded, language, savedLanguage]);
};
