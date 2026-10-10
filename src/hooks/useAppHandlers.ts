import { useQueryClient } from '@tanstack/react-query';
import { AIImage, GeneratorTool } from '../types';
import { useToast } from './useToast';
import {
    deleteRemovedImagesFromDisk,
    getImagesByIds,
    rebuildFacetCache,
    rebuildFacetCacheIncremental,
    refreshFacetCacheForResourcesStrict,
    removeImagesFromLibrary,
    restoreRemovedImages,
    revertImageMetadata,
    updateImageMetadataFields,
    updateImageNotesCol,
} from '../services/db/imageRepo';
import { useLibraryStore } from '../stores/libraryStore';
import { removeImagesFromQueryCaches, updateImagesQueryCaches } from '../utils/imageQueryCache';
import type { ActiveImageStateAdapter } from './activeImageState';
import { invalidateInvokeReferenceQueries } from '../services/db/invokeReferenceRepo';
import type { DeleteRemovedImagesResult, ExactDuplicateResolution, ExactDuplicateResolutionResult } from '../bindings';
import { useTranslation } from 'react-i18next';

interface UseAppHandlersProps {
    images: AIImage[];
    setImages: (update: AIImage[] | ((prev: AIImage[]) => AIImage[])) => void;
    refreshMaintenanceCounts: () => void;
    refreshHiddenAvailability: () => Promise<void>;
    activeImageState?: ActiveImageStateAdapter;
}

export const useAppHandlers = ({ images, setImages, refreshMaintenanceCounts, refreshHiddenAvailability, activeImageState }: UseAppHandlersProps) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const incrementFacetCacheVersion = useLibraryStore(state => state.incrementFacetCacheVersion);

    const refreshFacets = () => {
        void rebuildFacetCache()
            .then(() => incrementFacetCacheVersion())
            .catch(error => console.error('Failed to refresh facet cache', error));
    };
    const getImage = (id: string) => activeImageState?.getImage(id) ?? images.find(image => image.id === id);
    const updateImage = (id: string, updater: (image: AIImage) => AIImage) => {
        if (activeImageState) {
            activeImageState.updateImage(id, updater);
            return;
        }
        setImages(prev => prev.map(image => image.id === id ? updater(image) : image));
    };

    const handleUpdatePrompt = async (id: string, prompt: string) => {
        const img = getImage(id);
        if (!img) return;
        if ((img.metadata.positivePrompt ?? '') === prompt) return;

        const originalMetadata = img.originalMetadata || { ...img.metadata };
        const updatedImg = {
            ...img,
            originalMetadata,
            metadata: {
                ...img.metadata,
                positivePrompt: prompt,
                fieldSources: { ...img.metadata.fieldSources, positivePrompt: 'user_override' as const }
            }
        };

        updateImage(id, () => updatedImg);
        await updateImageMetadataFields(id, { positivePrompt: prompt });
        addToast(t('Updated'), 'success');
    };

    const handleUpdateNegativePrompt = async (id: string, negativePrompt: string) => {
        const img = getImage(id);
        if (!img) return;
        if ((img.metadata.negativePrompt ?? '') === negativePrompt) return;

        const originalMetadata = img.originalMetadata || { ...img.metadata };
        const updatedImg = {
            ...img,
            originalMetadata,
            metadata: {
                ...img.metadata,
                negativePrompt,
                fieldSources: { ...img.metadata.fieldSources, negativePrompt: 'user_override' as const }
            }
        };

        updateImage(id, () => updatedImg);
        await updateImageMetadataFields(id, { negativePrompt });
        addToast(t('Updated'), 'success');
    };

    const handleUpdateModel = async (id: string, model: string) => {
        const img = getImage(id);
        if (!img) return;
        const normalizedModel = model.trim();
        if (!normalizedModel || (img.metadata.overrideModel || img.metadata.model) === normalizedModel) return;

        const originalMetadata = img.originalMetadata || { ...img.metadata };
        const updatedImg = {
            ...img,
            originalMetadata,
            metadata: {
                ...img.metadata,
                overrideModel: normalizedModel,
                model: normalizedModel,
                fieldSources: { ...img.metadata.fieldSources, model: 'user_override' as const, overrideModel: 'user_override' as const }
            }
        };

        updateImage(id, () => updatedImg);
        await updateImageMetadataFields(id, { overrideModel: normalizedModel });

        // Ensure filter panel is updated
        rebuildFacetCacheIncremental('checkpoints').then(() => incrementFacetCacheVersion());
        void queryClient.invalidateQueries({ queryKey: ['parameterRanges'] });

        addToast(t('Updated'), 'success');
    };

    const handleUpdateTool = async (id: string, tool: GeneratorTool) => {
        const img = getImage(id);
        if (!img) return;
        if (img.metadata.tool === tool) return;

        const originalMetadata = img.originalMetadata || { ...img.metadata };
        const updatedImg = {
            ...img,
            originalMetadata,
            metadata: {
                ...img.metadata,
                tool,
                fieldSources: { ...img.metadata.fieldSources, tool: 'user_override' as const }
            }
        };

        updateImage(id, () => updatedImg);
        await updateImageMetadataFields(id, { tool });

        // Ensure filter panel is updated
        rebuildFacetCacheIncremental('tools').then(() => incrementFacetCacheVersion());
        void queryClient.invalidateQueries({ queryKey: ['parameterRanges'] });

        addToast(t('Updated'), 'success');
    };

    const handleUpdateVideoGenerationMode = async (id: string, generationMode: string) => {
        const img = getImage(id);
        if (!img) return;
        if ((img.metadata.generationMode ?? 'unknown') === generationMode) return;
        const updatedImg = {
            ...img,
            metadata: {
                ...img.metadata,
                generationMode,
                generationType: generationMode,
                fieldSources: {
                    ...img.metadata.fieldSources,
                    generationMode: 'user_override' as const,
                    generationType: 'user_override' as const
                }
            }
        } as AIImage;
        updateImage(id, () => updatedImg);
        await updateImageMetadataFields(id, { generationMode, generationType: generationMode });
        void queryClient.invalidateQueries({ queryKey: ['parameterRanges'] });
        addToast(t('Updated'), 'success');
    };

    const handleGroupImages = (ids: string[]) => {
        const groupId = `stack_${Date.now()}`;
        setImages(prev => prev.map(img =>
            ids.includes(img.id) ? { ...img, groupId } : img
        ));
        addToast(t('Grouped {{length}} images into a stack', { length: ids.length }), 'success');
    };

    const handleResolveDuplicate = async (resolutions: ExactDuplicateResolution[]) => {
        let result: ExactDuplicateResolutionResult;
        try {
            const { resolveExactDuplicateGroups } = await import('../services/db/exactDuplicateRepo');
            result = await resolveExactDuplicateGroups(resolutions);
        } catch (error) {
            console.error('Failed to resolve exact duplicates', error);
            addToast(t('Could not resolve duplicates. Run the scan again and retry.'), 'error');
            throw error;
        }

        const removedIds = new Set(result.removedIds);
        const keeperStates = new Map(result.keepers.map(keeper => [keeper.id, keeper]));
        const applyKeeperState = (image: AIImage): AIImage => {
            const keeper = keeperStates.get(image.id);
            return keeper ? {
                ...image,
                isFavorite: keeper.isFavorite,
                isPinned: keeper.isPinned,
                userMasked: keeper.userMasked ?? undefined,
            } : image;
        };
        setImages(previous => previous
            .filter(image => !removedIds.has(image.id))
            .map(applyKeeperState));
        removeImagesFromQueryCaches(queryClient, removedIds);
        updateImagesQueryCaches(queryClient, applyKeeperState);
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['images'] }),
                invalidateInvokeReferenceQueries(queryClient),
            ]);
        } catch (error) {
            console.error('Failed to refresh image queries after resolving duplicates', error);
        }
        addToast(t('toast.movedDuplicates', { count: result.removedIds.length }), 'success');
        refreshMaintenanceCounts();
        refreshFacets();
    };

    const handleRestoreImages = async (ids: string[]) => {
        const result = await restoreRemovedImages(ids).catch(error => {
            console.error('[Restore] Failed to restore removed images', error);
            addToast(t('Could not restore the selected items. Their Removed entries were kept.'), 'error');
            throw error;
        });
        let refreshFailed = false;
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['images'] }),
                invalidateInvokeReferenceQueries(queryClient),
                refreshHiddenAvailability(),
            ]);
        } catch (error) {
            refreshFailed = true;
            console.error('[Restore] Restored images, but failed to refresh dependent views', error);
        }
        addToast(t('toast.restoredItems', { count: result.affectedIds.length }), 'success');
        if (refreshFailed) {
            addToast(t('Items were restored, but some views may need a refresh.'), 'warning');
        }
        if (result.membershipWarningIds.length > 0) {
            addToast(t('toast.membershipWarning', { count: result.membershipWarningIds.length }), 'warning');
        }
        refreshMaintenanceCounts();
        void refreshFacetCacheForResourcesStrict(result.touchedResources)
            .then(() => incrementFacetCacheVersion())
            .catch(error => console.error('Failed to refresh restored facet resources', error));
    };

    const handleRemoveFromLibrary = async (ids: string[]) => {
        const result = await removeImagesFromLibrary(ids).catch(error => {
            console.error('[Removed] Failed to remove images from the library', error);
            addToast(t('Could not remove the selected items. The library was left unchanged.'), 'error');
            throw error;
        });

        const affectedIds = new Set(result.affectedIds);
        setImages(p => p.filter(i => !affectedIds.has(i.id)));
        removeImagesFromQueryCaches(queryClient, affectedIds);
        addToast(t('toast.removedItems', { count: result.affectedIds.length }), 'success');
        refreshMaintenanceCounts();
        try {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['images'] }),
                invalidateInvokeReferenceQueries(queryClient),
            ]);
        } catch (error) {
            console.error('[Removed] Images were removed, but dependent views failed to refresh', error);
            addToast(t('Items were removed, but some views may need a refresh.'), 'warning');
        }
        void refreshFacetCacheForResourcesStrict(result.touchedResources)
            .then(() => incrementFacetCacheVersion())
            .catch(error => console.error('Failed to refresh affected facet resources', error));
    };

    const handleDeleteFile = async (ids: string[]): Promise<DeleteRemovedImagesResult> => {
        try {
            const result = await deleteRemovedImagesFromDisk(ids);
            const unresolvedCount = result.failedIds.length + result.cleanupPendingIds.length;
            let dependentRefreshFailed = false;

            if (result.clearedIds.length > 0) {
                const clearedIds = new Set(result.clearedIds);
                setImages(previous => previous.filter(image => !clearedIds.has(image.id)));
                removeImagesFromQueryCaches(queryClient, clearedIds);
                refreshMaintenanceCounts();
                try {
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['images'] }),
                        invalidateInvokeReferenceQueries(queryClient),
                    ]);
                } catch (error) {
                    dependentRefreshFailed = true;
                    console.error('[Removed] Files were deleted, but dependent views failed to refresh', error);
                }
            }

            if (unresolvedCount === 0 && result.thumbnailWarningIds.length === 0 && result.notFoundIds.length === 0) {
                const recoveredCount = result.alreadyMissingIds.length;
                const message = recoveredCount > 0
                    ? t('toast.removedEntriesWithMissing', {
                        entries: t('count.entries', { count: result.clearedIds.length }),
                        missing: t('toast.sourceFilesMissing', { count: recoveredCount }),
                    })
                    : t('toast.movedToOsTrash', {
                        count: result.trashedIds.length,
                        context: result.clearedIds.length === 1 ? 'singular' : 'plural',
                    });
                addToast(message, 'success');
            } else if (result.clearedIds.length > 0 || result.cleanupPendingIds.length > 0 || result.notFoundIds.length > 0) {
                const details = [
                    unresolvedCount > 0 ? t('toast.stillNeedAttention', { count: unresolvedCount }) : null,
                    result.thumbnailWarningIds.length > 0
                        ? t('toast.thumbnailCleanupWarnings', { count: result.thumbnailWarningIds.length })
                        : null,
                    result.notFoundIds.length > 0
                        ? t('toast.entriesUnavailable', { count: result.notFoundIds.length })
                        : null,
                ].filter((detail): detail is string => detail !== null);
                addToast(
                    t('toast.removedEntriesDetails', {
                        entries: t('count.entries', { count: result.clearedIds.length }),
                        details: details.join(t('join.and')),
                    }),
                    'warning'
                );
            } else {
                addToast(t('Failed to move selected files to OS trash. The Removed entries were kept.'), 'error');
            }
            if (dependentRefreshFailed) {
                addToast(t('Files were deleted, but some views may need a refresh.'), 'warning');
            }

            return result;
        } catch (error) {
            console.error('[Removed] Failed to delete selected files', error);
            addToast(t('Could not finish deleting the selected files. The Removed entries were kept.'), 'error');
            throw error;
        }
    };

    const handleEmptyTrash = async () => {
        addToast(t('Removed items are now handled through the Removed tab actions.'), 'info');
        refreshMaintenanceCounts();
    };

    const handleUpdateNotes = async (id: string, notes: string) => {
        const img = getImage(id);
        if (!img) return;
        if ((img.notes ?? '') === notes) return;

        const updatedImg = { ...img, notes };
        updateImage(id, () => updatedImg);
        try {
            await updateImageNotesCol(id, notes);
            addToast(t('Saved'), 'success');
        } catch (error) {
            console.error('[Notes] Failed to persist notes', error);
            updateImage(id, () => img);
            addToast(t('Failed to save notes'), 'error');
        }
    };

    const handleRevertMetadata = async (id: string) => {
        await revertImageMetadata(id);
        const [revertedImage] = await getImagesByIds([id]);
        if (!revertedImage) {
            addToast(t('Metadata reverted, but the image could not be refreshed.'), 'warning');
            return;
        }

        const applyRevertedImage = (current: AIImage): AIImage => (
            current.id === id
                ? { ...revertedImage, stack: current.stack }
                : current
        );
        if (activeImageState) {
            activeImageState.updateImage(id, applyRevertedImage);
        } else {
            setImages(prev => prev.map(applyRevertedImage));
        }
        updateImagesQueryCaches(queryClient, applyRevertedImage);

        // Revert can change tools and models, so we rebuild both incrementally
        Promise.all([
            rebuildFacetCacheIncremental('tools'),
            rebuildFacetCacheIncremental('checkpoints')
        ]).then(() => incrementFacetCacheVersion());

        addToast(t('Reverted to original'), 'success');
    };

    return {
        handleUpdatePrompt,
        handleUpdateNegativePrompt,
        handleUpdateModel,
        handleUpdateTool,
        handleUpdateVideoGenerationMode,
        handleUpdateNotes,
        handleRevertMetadata,
        handleGroupImages,
        handleResolveDuplicate,
        handleRestoreImages,
        handleRemoveFromLibrary,
        handleDeleteFile,
        handleEmptyTrash
    };
};
