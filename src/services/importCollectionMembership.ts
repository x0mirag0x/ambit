import type { AIImage } from '../types';
import { isPathWithinDirectory, normalizePath } from '../utils/pathUtils';
import { getBrowserMockImages } from './browserMockData';
import { getDb } from './db/connection';
import { isBrowserMockMode } from './runtime';

export interface ImportedLibraryQuery {
    filePaths: string[];
    directoryPaths: string[];
    importedImages: Array<Pick<AIImage, 'id' | 'isDeleted'>>;
}

const QUERY_CHUNK_SIZE = 900;

const escapeLike = (value: string): string =>
    value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const trimDirectory = (path: string): string => {
    const normalized = normalizePath(path);
    if (/^[A-Za-z]:\/$/.test(normalized)) return normalized;
    return normalized.replace(/\/+$/, '');
};

const addImportedIds = (ids: Set<string>, images: ImportedLibraryQuery['importedImages']) => {
    for (const image of images) {
        if (image.isDeleted) continue;
        const id = normalizePath(image.id);
        if (id) ids.add(id);
    }
};

const listBrowserMockIds = (filePaths: string[], directoryPaths: string[]): string[] => {
    const files = new Set(filePaths.map(normalizePath).filter(Boolean));
    const directories = directoryPaths.map(trimDirectory).filter(Boolean);
    return getBrowserMockImages()
        .filter(image => !image.isDeleted)
        .map(image => normalizePath(image.id))
        .filter(id => files.has(id) || directories.some(directory => isPathWithinDirectory(id, directory)));
};

const listDatabaseIds = async (filePaths: string[], directoryPaths: string[]): Promise<string[]> => {
    const files = [...new Set(filePaths.map(normalizePath).filter(Boolean))];
    const directories = [...new Set(directoryPaths.map(trimDirectory).filter(Boolean))];
    if (files.length === 0 && directories.length === 0) return [];

    const db = await getDb();
    const ids = new Set<string>();

    for (let index = 0; index < files.length; index += QUERY_CHUNK_SIZE) {
        const chunk = files.slice(index, index + QUERY_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(', ');
        const rows = await db.select<{ id: string }[]>(
            `SELECT id FROM scoped_images
             WHERE invoke_scope_hidden = 0 AND id IN (${placeholders})`,
            chunk
        );
        for (const row of rows) ids.add(row.id);
    }

    for (const directory of directories) {
        const rows = await db.select<{ id: string }[]>(
            `SELECT id FROM scoped_images
             WHERE invoke_scope_hidden = 0
               AND (id = ? OR id LIKE ? ESCAPE '\\')`,
            [directory, `${escapeLike(directory)}/%`]
        );
        for (const row of rows) ids.add(row.id);
    }

    return [...ids];
};

/**
 * Ids that can be added to a collection after a one-time import.
 * Newly imported items come from the import result. Files already in the
 * library are resolved from the visible image table, including duplicates
 * the importer skipped.
 */
export const listImportedLibraryIds = async (query: ImportedLibraryQuery): Promise<string[]> => {
    const ids = new Set<string>();
    addImportedIds(ids, query.importedImages);
    const existing = isBrowserMockMode()
        ? listBrowserMockIds(query.filePaths, query.directoryPaths)
        : await listDatabaseIds(query.filePaths, query.directoryPaths);
    for (const id of existing) ids.add(id);
    return [...ids];
};
