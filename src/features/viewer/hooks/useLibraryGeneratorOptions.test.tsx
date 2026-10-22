import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublishLibraryGeneratorOptions } from './useLibraryGeneratorOptions';
import {
    getGeneratorToolOptions,
    rememberGeneratorToolName,
    resetGeneratorToolOptionsForTests,
} from '../../../utils/generatorToolOptions';

const mocks = vi.hoisted(() => ({
    getFacets: vi.fn(),
}));

vi.mock('../../../services/runtime', () => ({ isBrowserMockMode: () => false }));
vi.mock('../../../services/db/searchRepo', () => ({ getFacets: mocks.getFacets }));

describe('usePublishLibraryGeneratorOptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetGeneratorToolOptionsForTests();
        mocks.getFacets.mockResolvedValue({
            tools: ['ComfyUI', 'Krea', ' krea ', 'Other', 'Unknown', 'Другое', 'Imagine.art', 'imagine.art'],
        });
    });

    afterEach(() => {
        resetGeneratorToolOptionsForTests();
    });

    it('publishes custom generator names from the whole library and keeps a name typed before refresh', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
        renderHook(() => usePublishLibraryGeneratorOptions(), { wrapper });

        await waitFor(() => expect(getGeneratorToolOptions()).toEqual(['Imagine.art', 'Krea']));
        expect(mocks.getFacets).toHaveBeenCalledWith('', [], ['tools'], { assetScope: 'all' });

        rememberGeneratorToolName('  Nano   Banana  ');
        rememberGeneratorToolName('comfyui');
        expect(getGeneratorToolOptions()).toEqual(['Imagine.art', 'Krea', 'Nano Banana']);
    });
});
