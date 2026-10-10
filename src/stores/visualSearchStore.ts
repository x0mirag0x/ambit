import { create } from 'zustand';
import { AIImage } from '../types';

interface VisualSearchState {
    active: boolean;
    searching: boolean;
    images: AIImage[];
    begin: () => void;
    show: (images: AIImage[]) => void;
    reset: () => void;
    patchByIds: (ids: Iterable<string>, updater: (image: AIImage) => AIImage) => void;
    removeByIds: (ids: Iterable<string>) => void;
}

export const useVisualSearchStore = create<VisualSearchState>((set) => ({
    active: false,
    searching: false,
    images: [],
    begin: () => set({ active: true, searching: true, images: [] }),
    show: (images) => set({ active: true, searching: false, images }),
    reset: () => set({ active: false, searching: false, images: [] }),
    patchByIds: (ids, updater) => set((state) => {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        if (idSet.size === 0 || state.images.length === 0) return state;
        let changed = false;
        const images = state.images.map((image) => {
            if (!idSet.has(image.id)) return image;
            const next = updater(image);
            if (next !== image) changed = true;
            return next;
        });
        return changed ? { images } : state;
    }),
    removeByIds: (ids) => set((state) => {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        if (idSet.size === 0 || state.images.length === 0) return state;
        const images = state.images.filter((image) => !idSet.has(image.id));
        return images.length === state.images.length ? state : { images };
    }),
}));
