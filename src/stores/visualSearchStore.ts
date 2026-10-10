import { create } from 'zustand';
import { AIImage } from '../types';

interface VisualSearchState {
    active: boolean;
    searching: boolean;
    images: AIImage[];
    begin: () => void;
    show: (images: AIImage[]) => void;
    reset: () => void;
}

export const useVisualSearchStore = create<VisualSearchState>((set) => ({
    active: false,
    searching: false,
    images: [],
    begin: () => set({ active: true, searching: true, images: [] }),
    show: (images) => set({ active: true, searching: false, images }),
    reset: () => set({ active: false, searching: false, images: [] }),
}));
