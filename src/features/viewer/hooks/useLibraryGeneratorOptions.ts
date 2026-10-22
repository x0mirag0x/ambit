import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBrowserMockFacets } from '../../../services/browserMockData';
import { getFacets } from '../../../services/db/searchRepo';
import { isBrowserMockMode } from '../../../services/runtime';
import { useLibraryStore } from '../../../stores/libraryStore';
import { setLibraryGeneratorOptions } from '../../../utils/generatorToolOptions';

/** Publish every generator name stored in the library so the metadata editor can reuse it. */
export const usePublishLibraryGeneratorOptions = (): void => {
    const facetCacheVersion = useLibraryStore(state => state.facetCacheVersion);
    const useBrowserMocks = isBrowserMockMode();
    const query = useQuery({
        queryKey: ['viewer', 'generator-options', facetCacheVersion, useBrowserMocks],
        queryFn: async () => (
            useBrowserMocks
                ? getBrowserMockFacets().tools
                : (await getFacets('', [], ['tools'], { assetScope: 'all' })).tools
        ),
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        if (query.data) setLibraryGeneratorOptions(query.data);
    }, [query.data]);
};
