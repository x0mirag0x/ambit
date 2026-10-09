import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from './index';
import {
    clearCachedUiLanguage,
    detectSystemUiLanguage,
    readCachedUiLanguage,
    resolveUiLanguage,
    writeCachedUiLanguage,
} from './language';

const setNavigatorLanguages = (languages: readonly string[]) => {
    vi.stubGlobal('navigator', { language: languages[0] ?? 'en-US', languages: [...languages] });
};

describe('ui language resolution', () => {
    afterEach(() => {
        clearCachedUiLanguage();
        vi.unstubAllGlobals();
        void i18n.changeLanguage('en');
    });

    it('follows a saved choice ahead of the system language', () => {
        setNavigatorLanguages(['ru-RU']);
        expect(resolveUiLanguage('en')).toBe('en');
        expect(resolveUiLanguage('ru')).toBe('ru');
    });

    it('uses Russian only when the system language is Russian and nothing is saved', () => {
        setNavigatorLanguages(['ru-RU', 'en-US']);
        expect(detectSystemUiLanguage()).toBe('ru');
        expect(resolveUiLanguage(undefined)).toBe('ru');

        setNavigatorLanguages(['en-US']);
        expect(resolveUiLanguage(undefined)).toBe('en');

        setNavigatorLanguages(['uk-UA']);
        expect(resolveUiLanguage('')).toBe('en');
    });

    it('persists the explicit choice in local storage for the next boot', () => {
        writeCachedUiLanguage('ru');
        expect(readCachedUiLanguage()).toBe('ru');
        clearCachedUiLanguage();
        expect(readCachedUiLanguage()).toBeNull();
    });

    it('applies Russian plural categories for one, few, and many', async () => {
        await i18n.changeLanguage('ru');

        expect(i18n.t('count.libraryItems', { count: 1 })).toBe('1 элемент');
        expect(i18n.t('count.libraryItems', { count: 2 })).toBe('2 элемента');
        expect(i18n.t('count.libraryItems', { count: 5 })).toBe('5 элементов');
        expect(i18n.t('count.libraryItems', { count: 11 })).toBe('11 элементов');
        expect(i18n.t('count.libraryItems', { count: 21 })).toBe('21 элемент');

        expect(i18n.t('toast.removedItems', { count: 1 })).toBe('1 элемент убран из библиотеки');
        expect(i18n.t('toast.removedItems', { count: 2 })).toBe('2 элемента убраны из библиотеки');
        expect(i18n.t('toast.removedItems', { count: 5 })).toBe('5 элементов убрано из библиотеки');
        expect(i18n.t('import.photos', { count: 0 })).toBe('0 фото');
        expect(i18n.t('import.photos', { count: 1 })).toBe('1 фото');
        expect(i18n.t('toast.favoriteItems', { count: 1, context: 'on' })).toBe('1 элемент добавлен в избранное');
        expect(i18n.t('toast.movedToOsTrash', { count: 2, context: 'plural' })).toBe('2 файла перемещены в корзину и убраны из Ambit');

        await i18n.changeLanguage('en');
        expect(i18n.t('count.files', { count: 1 })).toBe('1 file');
        expect(i18n.t('count.files', { count: 4 })).toBe('4 files');
        expect(i18n.t('toast.queuedThumbnails', { count: 2 })).toBe('Queued 2 thumbnails for retry');
        expect(i18n.t('toast.movedDuplicates', { count: 1 })).toBe('Moved 1 duplicate to Removed');
        expect(i18n.t('toast.movedDuplicates', { count: 2 })).toBe('Moved 2 duplicates to Removed');
        expect(i18n.t('import.imported', { count: 1, kinds: '1 Generated, 0 Photos, 0 Other' })).toBe('Imported 1 item (1 Generated, 0 Photos, 0 Other).');
        expect(i18n.t('import.skippedDuplicates', { total: 1 })).toBe('(Skipped 1 duplicates)');
        expect(i18n.t('toast.movedToOsTrash', { count: 1, context: 'singular' })).toBe('Moved 1 file to OS trash and removed it from Ambit');
        expect(i18n.t('toast.movedToOsTrash', { count: 2, context: 'plural' })).toBe('Moved 2 files to OS trash and removed them from Ambit');
        expect(i18n.t('toast.removedEntriesDetails', {
            entries: i18n.t('count.entries', { count: 0 }),
            details: i18n.t('toast.entriesUnavailable', { count: 1 }),
        })).toBe('Removed 0 entries from Ambit; 1 selected entry was already unavailable.');
    });
});
