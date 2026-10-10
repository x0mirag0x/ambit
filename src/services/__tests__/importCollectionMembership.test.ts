import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratorTool, type AIImage } from '../../types';

const browserMockMode = vi.hoisted(() => vi.fn(() => false));
const getBrowserMockImages = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());

vi.mock('../runtime', () => ({ isBrowserMockMode: browserMockMode }));
vi.mock('../browserMockData', () => ({ getBrowserMockImages }));
vi.mock('../db/connection', () => ({ getDb: async () => ({ select }) }));

import { listImportedLibraryIds } from '../importCollectionMembership';

const image = (id: string, isDeleted = false): AIImage => ({
    id,
    url: id,
    thumbnailUrl: id,
    filename: id,
    timestamp: 1,
    width: 1,
    height: 1,
    isFavorite: false,
    isPinned: false,
    isDeleted,
    metadata: {
        tool: GeneratorTool.UNKNOWN,
        model: '',
        steps: 0,
        cfg: 0,
        sampler: '',
        positivePrompt: '',
        negativePrompt: '',
    },
});

describe('listImportedLibraryIds', () => {
    beforeEach(() => {
        browserMockMode.mockReturnValue(false);
        getBrowserMockImages.mockReset();
        select.mockReset();
    });

    it('keeps new imports and visible library duplicates, including a folder', async () => {
        select
            .mockResolvedValueOnce([{ id: 'C:/library/old.png' }])
            .mockResolvedValueOnce([
                { id: 'C:/albums/kept.png' },
                { id: 'C:/albums/nested/also.png' },
            ]);

        const ids = await listImportedLibraryIds({
            filePaths: ['C:\\library\\new.png', 'C:/library/old.png'],
            directoryPaths: ['C:\\albums\\'],
            importedImages: [image('C:/library/new.png'), image('C:/videos/clip.mp4')],
        });

        expect(ids).toEqual([
            'C:/library/new.png',
            'C:/videos/clip.mp4',
            'C:/library/old.png',
            'C:/albums/kept.png',
            'C:/albums/nested/also.png',
        ]);
        expect(select).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('id IN (?, ?)'),
            ['C:/library/new.png', 'C:/library/old.png']
        );
        expect(select).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("ESCAPE '\\'"),
            ['C:/albums', 'C:/albums/%']
        );
    });

    it('escapes like wildcards in a folder path', async () => {
        select.mockResolvedValueOnce([]);

        await listImportedLibraryIds({
            filePaths: [],
            directoryPaths: ['C:/100%_done'],
            importedImages: [],
        });

        expect(select).toHaveBeenCalledWith(
            expect.stringContaining('id LIKE ?'),
            ['C:/100%_done', 'C:/100\\%\\_done/%']
        );
    });

    it('uses browser mock images for files and folders and skips removed items', async () => {
        browserMockMode.mockReturnValue(true);
        getBrowserMockImages.mockReturnValue([
            image('C:/library/old.png'),
            image('C:/albums/nested/photo.jpg'),
            image('C:/albums/gone.png', true),
            image('C:/other/skip.png'),
        ]);

        const ids = await listImportedLibraryIds({
            filePaths: ['C:/library/old.png'],
            directoryPaths: ['C:/albums'],
            importedImages: [image('imported_web_1'), image('imported_removed', true)],
        });

        expect(ids).toEqual([
            'imported_web_1',
            'C:/library/old.png',
            'C:/albums/nested/photo.jpg',
        ]);
        expect(select).not.toHaveBeenCalled();
    });
});
