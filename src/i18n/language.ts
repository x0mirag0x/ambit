export const UI_LANGUAGES = ['en', 'ru'] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const UI_LANGUAGE_STORAGE_KEY = 'ambit.uiLanguage';

const LANGUAGE_NAMES: Record<UiLanguage, string> = {
    en: 'English',
    ru: 'Русский',
};

export const isUiLanguage = (value: unknown): value is UiLanguage =>
    value === 'en' || value === 'ru';

export const nativeLanguageName = (language: UiLanguage): string => LANGUAGE_NAMES[language];

export const detectSystemUiLanguage = (): UiLanguage => {
    const locales = typeof navigator === 'undefined'
        ? []
        : [navigator.language, ...(navigator.languages ?? [])];

    return locales.some(locale => locale?.toLowerCase().startsWith('ru')) ? 'ru' : 'en';
};

export const readCachedUiLanguage = (): UiLanguage | null => {
    if (typeof localStorage === 'undefined') return null;

    try {
        const cached = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        return isUiLanguage(cached) ? cached : null;
    } catch {
        return null;
    }
};

export const writeCachedUiLanguage = (language: UiLanguage): void => {
    if (typeof localStorage === 'undefined') return;

    try {
        localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
    } catch {
        // The settings file remains the source of truth when storage is unavailable.
    }
};

export const clearCachedUiLanguage = (): void => {
    if (typeof localStorage === 'undefined') return;

    try {
        localStorage.removeItem(UI_LANGUAGE_STORAGE_KEY);
    } catch {
        // Ignore storage failures; the in-memory language still follows settings.
    }
};

/** Saved choice wins. Otherwise Russian systems open in Russian and every other system opens in English. */
export const resolveUiLanguage = (saved: unknown): UiLanguage =>
    isUiLanguage(saved) ? saved : detectSystemUiLanguage();

export const initialUiLanguage = (): UiLanguage =>
    readCachedUiLanguage() ?? detectSystemUiLanguage();
