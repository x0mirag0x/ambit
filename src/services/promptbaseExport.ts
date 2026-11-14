import type { AIImage } from '../types';
import { isVideoAsset } from '../types';

export type ExportArchiveFormat = 'dvoyna' | 'promptbase';

export type PromptBaseExportItem = {
    title: string;
    prompt: string;
    aiModel: string;
    tags: string;
    relativePath: string;
    width: number | null;
    height: number | null;
    contentType: string;
    createdAt: string;
    isBookmarked: boolean;
};

export const PROMPTBASE_MANIFEST_FORMAT = 'promptbase-archive' as const;
export const PROMPTBASE_MANIFEST_VERSION = 1;
export const PROMPTBASE_LIBRARY_ID = 1;

const UNKNOWN_MODEL_NAMES = new Set(['', 'unknown', 'unknown model']);

export const formatPromptBaseCreatedAt = (timestamp: number): string => {
    const millis = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

export const sanitizePromptBaseFileName = (filename: string): string => {
    const trimmed = filename.trim() || 'item';
    return trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
};

export const allocatePromptBaseRelativePath = (filename: string, used: Set<string>): string => {
    const safe = sanitizePromptBaseFileName(filename);
    if (!used.has(safe.toLowerCase())) {
        used.add(safe.toLowerCase());
        return safe;
    }

    const extensionIndex = safe.lastIndexOf('.');
    const stem = extensionIndex > 0 ? safe.slice(0, extensionIndex) : safe;
    const extension = extensionIndex > 0 ? safe.slice(extensionIndex) : '';
    let index = 2;
    while (used.has(`${stem} (${index})${extension}`.toLowerCase())) {
        index += 1;
    }
    const next = `${stem} (${index})${extension}`;
    used.add(next.toLowerCase());
    return next;
};

const modelLabel = (image: AIImage): string => {
    const override = image.metadata.overrideModel?.trim();
    if (override) return override;
    const raw = typeof image.metadata.model === 'string' ? image.metadata.model.trim() : '';
    if (UNKNOWN_MODEL_NAMES.has(raw.toLocaleLowerCase())) return '';
    return raw;
};

const promptText = (image: AIImage): string => {
    const prompt = typeof image.metadata.positivePrompt === 'string'
        ? image.metadata.positivePrompt.trim()
        : '';
    if (!prompt) return '';
    if (/^prompt\s*:/i.test(prompt)) return prompt;
    return `Prompt:\n${prompt}`;
};

export const buildPromptBaseManifest = (profileName: string, exportedAt = Math.floor(Date.now() / 1000)) => ({
    format: PROMPTBASE_MANIFEST_FORMAT,
    version: PROMPTBASE_MANIFEST_VERSION,
    exportedAt: String(exportedAt),
    profileId: 'dvoyna-export',
    profileName,
});

export const buildPromptBaseExportItems = (images: AIImage[]): Array<{
    item: PromptBaseExportItem;
    sourceId: string;
    relativePath: string;
}> => {
    const usedNames = new Set<string>();
    return images.map(image => {
        const relativePath = allocatePromptBaseRelativePath(image.filename, usedNames);
        return {
            sourceId: image.id,
            relativePath,
            item: {
                title: relativePath,
                prompt: promptText(image),
                aiModel: modelLabel(image),
                tags: '',
                relativePath,
                width: Number.isFinite(image.width) ? image.width : null,
                height: Number.isFinite(image.height) ? image.height : null,
                contentType: isVideoAsset(image) ? 'video' : 'image',
                createdAt: formatPromptBaseCreatedAt(image.timestamp),
                isBookmarked: Boolean(image.isFavorite),
            },
        };
    });
};
