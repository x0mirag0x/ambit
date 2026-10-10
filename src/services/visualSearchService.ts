import { invoke } from '@tauri-apps/api/core';
import { AIImage } from '../types';
import { getImagesByIds } from './db/imageRepo';
import { isTauriRuntime } from './runtime';

export interface SimilarImageHit {
    id: string;
    distance: number;
}

export interface VisualBackfillResult {
    updated: number;
    remaining: number;
}

export const searchSimilarImages = async (path: string): Promise<AIImage[]> => {
    const hits = await invoke<SimilarImageHit[]>('search_similar_images', { path });
    if (hits.length === 0) return [];
    const images = await getImagesByIds(hits.map(hit => hit.id));
    const order = new Map(hits.map((hit, index) => [hit.id, index]));
    return images
        .filter(image => image.mediaType !== 'video' && !image.isDeleted && !image.isMissing)
        .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
};

export const getStoredImagePalette = async (id: string): Promise<string[]> => {
    if (!isTauriRuntime()) return [];
    return invoke<string[]>('get_image_palette', { id });
};

export const backfillVisualSignatures = async (limit = 40): Promise<VisualBackfillResult> => {
    if (!isTauriRuntime()) return { updated: 0, remaining: 0 };
    return invoke<VisualBackfillResult>('backfill_visual_signatures', { limit });
};
