import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';
import { translateRuntimeMessage } from './statusMessages';

describe('runtime toast strings', () => {
    afterEach(async () => {
        await i18n.changeLanguage('en');
    });

    it('keeps the English resource and repair sentences byte-identical', () => {
        expect(translateRuntimeMessage('Resource scan complete: 0 model files found')).toBe('Resource scan complete: 0 model files found');
        expect(translateRuntimeMessage('Resource scan complete: 2 LoRA files found, 2 indexed')).toBe('Resource scan complete: 2 LoRA files found, 2 indexed');
        expect(translateRuntimeMessage('Repair scan found no additional importable files')).toBe('Repair scan found no additional importable files');
        expect(translateRuntimeMessage('Repair scan imported 3 missing files')).toBe('Repair scan imported 3 missing files');
        expect(i18n.t('{{n}} images', { n: 205 })).toBe('205 images');
        expect(i18n.t('Confirm')).toBe('Confirm');
        expect(i18n.t('Unknown')).toBe('Unknown');
    });

    it('translates the screenshot toasts, counts, and sentinels in Russian', async () => {
        await i18n.changeLanguage('ru');
        expect(translateRuntimeMessage('Resource scan complete: 0 model files found')).toBe('Сканирование ресурсов завершено: найдено 0 файлов моделей');
        expect(translateRuntimeMessage('Resource scan complete: 2 LoRA files found, 2 indexed')).toBe('Сканирование ресурсов завершено: найдено 2 файлов LoRA, проиндексировано 2');
        expect(translateRuntimeMessage('718 model files found')).toBe('найдено 718 файлов моделей');
        expect(translateRuntimeMessage('Repair scan found no additional importable files')).toBe('Повторное сканирование не нашло новых файлов для импорта');
        expect(translateRuntimeMessage('Repair scan imported 3 missing files')).toBe('Повторное сканирование импортировало 3 недостающих файлов');
        expect(i18n.t('{{n}} images', { n: 205 })).toBe('205 изображений');
        expect(i18n.t('Confirm')).toBe('Подтвердить');
        expect(i18n.t('Unknown')).toBe('Неизвестно');
        expect(i18n.t('Photo')).toBe('Фото');
        expect(i18n.t('Other')).toBe('Другое');
    });
});
