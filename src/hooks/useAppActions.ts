import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AIImage, AppSettings, FilterState, Collection, RecoveryStyle, getDetectedSourceKind, isVideoAsset, type SourceKind } from '../types';
import { useToast } from './useToast';
import { useSearchStore } from '../stores/searchStore';
import { useVisualSearchStore } from '../stores/visualSearchStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useCollectionStore } from '../stores/collectionStore';
import {
    rebuildThumbnailFacetCache,
    setImageSourceKind,
    toggleImageFavorite,
    toggleImageMask,
    toggleImagePin,
} from '../services/db/imageRepo';
import { backfillParameterColumns } from '../services/db/maintenanceRepo';
import { useLibraryStore } from '../stores/libraryStore';
import { patchImageFlagsInQueryCaches, restoreImagesInQueryCaches, updateImagesQueryCaches } from '../utils/imageQueryCache';
import { applyOptimisticPinOrder } from '../utils/imageOptimisticUpdates';
import type { ImagesQueryKey } from './useImagesQuery';
import type { ActiveImageStateAdapter } from './activeImageState';
import { useTranslation } from 'react-i18next';

interface AppActionFileOps {
    deleteImages: (ids: string[]) => Promise<boolean>;
    exportImages: (filename: string, ids: Set<string> | string[], destinationFolder: string, onComplete?: () => void) => Promise<void>;
    recoverMetadata?: (targetId: string, style: RecoveryStyle) => Promise<AIImage | null>;
}

interface AppActionModalManager {
    openModal: (key: 'settings' | 'deleteConfirm' | 'recovery' | 'export') => void;
    closeModal: (key: 'deleteConfirm' | 'recovery' | 'export') => void;
    pendingViewerDeleteId: string | null;
    setPendingViewerDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
    setInitialSettingsTab?: (tab: 'intelligence') => void;
}

interface UseAppActionsProps {
    viewingImageId: string | null;
    selectedImageIndex: number | null;
    setSelectedImageIndex: React.Dispatch<React.SetStateAction<number | null>>;
    viewerImages: AIImage[];
    setViewerSessionImages: React.Dispatch<React.SetStateAction<AIImage[] | null>>;
    fileOps: AppActionFileOps;
    selectedIds: Set<string>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    lastSelectedId: string | null;
    imagesQueryKey: ImagesQueryKey;
    modalManager: AppActionModalManager; // Renamed from modals
    activeImageState?: ActiveImageStateAdapter;
}

interface SingleImageActionOptions {
    showToast?: boolean;
}

interface PendingMetadataRecovery {
    targetId: string;
    onRecovered?: (image: AIImage) => void;
}

export const useAppActions = ({
    viewingImageId,
    selectedImageIndex,
    setSelectedImageIndex,
    viewerImages,
    setViewerSessionImages,
    fileOps,
    selectedIds,
    setSelectedIds,
    lastSelectedId,
    imagesQueryKey,
    modalManager: modals, // Destructure with alias for minimum logic change
    activeImageState
}: UseAppActionsProps) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const pendingMetadataRecoveryRef = React.useRef<PendingMetadataRecovery | null>(null);

    // Store access
    const images = useSearchStore(s => s.images);
    const setImages = useSearchStore(s => s.setImages);
    const filters = useSearchStore(s => s.filters);

    const settings = useSettingsStore(s => s.settings);
    const privacyEnabled = useSettingsStore(s => s.privacyEnabled);
    const setPrivacyEnabled = useSettingsStore(s => s.setPrivacyEnabled);

    const refreshCollections = useCollectionStore(s => s.refreshCollections);
    const refreshSmartCounts = useCollectionStore(s => s.refreshSmartCounts);

    const { openModal, closeModal, pendingViewerDeleteId, setPendingViewerDeleteId } = modals;
    const getImage = (id: string) => (
        activeImageState?.getImage(id)
        ?? images.find(image => image.id === id)
        ?? useVisualSearchStore.getState().images.find(image => image.id === id)
    );
    const updateImage = (id: string, updater: (image: AIImage) => AIImage) => {
        if (activeImageState) {
            activeImageState.updateImage(id, updater);
        } else {
            setImages(prev => prev.map(image => image.id === id ? updater(image) : image));
        }
        useVisualSearchStore.getState().patchByIds([id], updater);
    };
    const patchVisibleResults = (ids: Iterable<string>, updater: (image: AIImage) => AIImage) => {
        useVisualSearchStore.getState().patchByIds(ids, updater);
    };
    const selectedActionImages = (ids: Iterable<string>) => {
        const visualImages = useVisualSearchStore.getState().active
            ? useVisualSearchStore.getState().images
            : [];
        return Array.from(ids).flatMap((id) => {
            const image = images.find(candidate => candidate.id === id)
                ?? visualImages.find(candidate => candidate.id === id);
            return image ? [image] : [];
        });
    };

    const refreshCollectionsAfterImageFlagChange = React.useCallback(() => {
        void refreshCollections(true);

        if (!filters.collectionId) return;

        void refreshSmartCounts({
            collectionIds: [filters.collectionId],
            includeArchived: true,
            includePromptSearch: true,
            markPending: true
        });
    }, [filters.collectionId, refreshCollections, refreshSmartCounts]);

    const persistPinChanges = React.useCallback(async (
        ids: string[],
        isPinned: boolean,
        previousImages: typeof images,
        optimisticImages: typeof images,
        errorMessage: string,
        previousActiveImage?: AIImage,
        restoreGallery = true
    ) => {
        try {
            await Promise.all(ids.map(id => toggleImagePin(id, isPinned)));
            if (!restoreGallery) {
                void queryClient.invalidateQueries({ queryKey: ['images'] });
            }
            refreshCollectionsAfterImageFlagChange();
        } catch (error) {
            console.error('[Pin] Failed to persist pin state', error);
            if (restoreGallery) {
                setImages(previousImages);
                restoreImagesInQueryCaches(queryClient, previousImages, {
                    previousOrder: optimisticImages,
                    nextOrder: previousImages,
                    reorderQueryKey: imagesQueryKey
                });
            } else if (previousActiveImage) {
                patchImageFlagsInQueryCaches(queryClient, [previousActiveImage.id], {
                    isPinned: previousActiveImage.isPinned,
                });
            }
            if (previousActiveImage && activeImageState) {
                activeImageState.updateImage(previousActiveImage.id, () => previousActiveImage);
            }
            addToast(t(errorMessage), 'error');
        }
    }, [refreshCollectionsAfterImageFlagChange, setImages, addToast, queryClient, imagesQueryKey, activeImageState]);

    const persistFavoriteChanges = React.useCallback(async (
        ids: string[],
        isFavorite: boolean,
        previousImages: typeof images,
        previousActiveImage?: AIImage,
        restoreGallery = true
    ) => {
        try {
            await Promise.all(ids.map(id => toggleImageFavorite(id, isFavorite)));
            refreshCollectionsAfterImageFlagChange();
        } catch (error) {
            console.error('[Favorite] Failed to persist favorite state', error);
            if (restoreGallery) {
                setImages(previousImages);
                restoreImagesInQueryCaches(queryClient, previousImages);
            } else if (previousActiveImage) {
                patchImageFlagsInQueryCaches(queryClient, [previousActiveImage.id], {
                    isFavorite: previousActiveImage.isFavorite,
                });
            }
            if (previousActiveImage && activeImageState) {
                activeImageState.updateImage(previousActiveImage.id, () => previousActiveImage);
            }
            addToast(t('Failed to update favorite state'), 'error');
        }
    }, [addToast, queryClient, refreshCollectionsAfterImageFlagChange, setImages, activeImageState]);

    const executeDeleteByIds = React.useCallback(async (ids: string[], targetDeleteId: string | null) => {
        const deleted = await fileOps.deleteImages(ids);
        if (!deleted) return;

        if (targetDeleteId) {
            const idx = viewerImages.findIndex(img => img.id === targetDeleteId);
            if (idx !== -1) {
                const remainingViewerImages = viewerImages.filter(img => !ids.includes(img.id));
                let nextIndex: number | null = idx;
                if (remainingViewerImages.length === 0) nextIndex = null;
                else if (idx >= remainingViewerImages.length) nextIndex = remainingViewerImages.length - 1;
                setViewerSessionImages(remainingViewerImages.length > 0 ? remainingViewerImages : null);
                setSelectedImageIndex(nextIndex);
            } else {
                activeImageState?.removeImage(targetDeleteId);
            }
        } else {
            setSelectedIds(new Set());
        }
        closeModal('deleteConfirm');
        setPendingViewerDeleteId(null);
    }, [fileOps, viewerImages, setViewerSessionImages, setSelectedImageIndex, setSelectedIds, closeModal, setPendingViewerDeleteId, activeImageState]);

    const executeDelete = React.useCallback(async () => {
        const ids = pendingViewerDeleteId ? [pendingViewerDeleteId] : Array.from(selectedIds);
        await executeDeleteByIds(ids, pendingViewerDeleteId);
    }, [pendingViewerDeleteId, selectedIds, executeDeleteByIds]);

    const requestDeleteForId = React.useCallback((id: string) => {
        setPendingViewerDeleteId(id);
        if (settings.confirmDelete) {
            openModal('deleteConfirm');
            return;
        }

        void executeDeleteByIds([id], id);
    }, [settings.confirmDelete, openModal, setPendingViewerDeleteId, executeDeleteByIds]);

    const handleDeleteViewerImage = (id: string) => {
        setPendingViewerDeleteId(id);
        openModal('deleteConfirm');
    };

    const handleExportConfirm = async (filename: string, folder: string, ids?: Set<string>) => {
        const targetIds = ids || selectedIds;
        await fileOps.exportImages(filename, targetIds, folder, () => {
            if (!ids) setSelectedIds(new Set());
            closeModal('export');
        });
    };

    const handleBulkFavorite = () => {
        const ids = Array.from(selectedIds);
        const selectedImages = selectedActionImages(ids);
        const anyUnfavorite = selectedImages.some(img => !img.isFavorite);
        const previousImages = images;

        setImages(prev => prev.map(img => selectedIds.has(img.id) ? { ...img, isFavorite: anyUnfavorite } : img));
        patchVisibleResults(ids, image => (
            image.isFavorite === anyUnfavorite ? image : { ...image, isFavorite: anyUnfavorite }
        ));
        patchImageFlagsInQueryCaches(queryClient, ids, { isFavorite: anyUnfavorite });

        void persistFavoriteChanges(ids, anyUnfavorite, previousImages);

        addToast(t('toast.favoriteItems', { count: selectedIds.size, context: anyUnfavorite ? 'on' : 'off' }), 'success');
    };

    const handleFavoriteImage = (id: string, options: SingleImageActionOptions = {}) => {
        const img = getImage(id);
        if (!img) return;

        const newFavorite = !img.isFavorite;
        const previousImages = images;
        const isInCurrentQuery = images.some(image => image.id === id);

        updateImage(id, item => ({ ...item, isFavorite: newFavorite }));
        patchImageFlagsInQueryCaches(queryClient, [id], { isFavorite: newFavorite });
        void persistFavoriteChanges([id], newFavorite, previousImages, img, isInCurrentQuery);

        if (options.showToast) {
            addToast(newFavorite ? t('Liked') : t('Unliked'), newFavorite ? "success" : "info");
        }
    };

    const handleBulkPin = () => {
        const ids = Array.from(selectedIds);
        const selectedImages = selectedActionImages(ids);
        const anyUnpinned = selectedImages.some(img => !img.isPinned);
        const previousImages = images;
        const nextImages = applyOptimisticPinOrder(
            previousImages,
            ids,
            anyUnpinned,
            !!filters.collectionId
        );

        setImages(nextImages);
        patchVisibleResults(ids, image => (
            image.isPinned === anyUnpinned ? image : { ...image, isPinned: anyUnpinned }
        ));
        patchImageFlagsInQueryCaches(queryClient, ids, { isPinned: anyUnpinned }, {
            previousOrder: previousImages,
            nextOrder: nextImages,
            reorderQueryKey: imagesQueryKey
        });

        addToast(t('toast.pinItems', { count: selectedIds.size, context: anyUnpinned ? 'on' : 'off' }), 'info');
        void persistPinChanges(ids, anyUnpinned, previousImages, nextImages, 'Failed to update pinned images');
        // await queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
    };

    const handleBulkMask = async (targetId?: string, overrideValue?: boolean | null) => {
        let idsToToggle = new Set<string>();

        if (targetId) {
            idsToToggle = new Set([targetId]);
        } else {
            if (selectedIds.size > 0) idsToToggle = new Set(selectedIds);
            else if (lastSelectedId) idsToToggle.add(lastSelectedId);
        }

        if (idsToToggle.size === 0) return;

        const updateMaskedImage = (image: AIImage): AIImage => {
            if (!idsToToggle.has(image.id)) return image;

            let newValue = overrideValue;
            if (newValue === undefined) {
                const currentImage = getImage(image.id);
                if (!currentImage) return image;
                newValue = !currentImage.userMasked;
            }

            const userMasked = newValue !== null ? newValue : undefined;
            return image.userMasked === userMasked ? image : { ...image, userMasked };
        };

        setImages(prev => prev.map(updateMaskedImage));
        patchVisibleResults(idsToToggle, updateMaskedImage);
        updateImagesQueryCaches(queryClient, updateMaskedImage);

        const promises: Promise<void>[] = [];

        idsToToggle.forEach(id => {
            if (overrideValue !== undefined) {
                promises.push(toggleImageMask(id, overrideValue));
            } else {
                const img = getImage(id);
                if (img) {
                    promises.push(toggleImageMask(id, !img.userMasked));
                }
            }
        });

        await Promise.all(promises);
        await rebuildThumbnailFacetCache();
        useLibraryStore.getState().incrementFacetCacheVersion();
        void refreshCollections(true);
        await queryClient.invalidateQueries({ queryKey: ['libraryStats'] });

        if (privacyEnabled && settings.maskingMode === 'hide') {
            await queryClient.invalidateQueries({ queryKey: ['images'] });
            await queryClient.invalidateQueries({ queryKey: ['parameterRanges'] });
        }

        const count = idsToToggle.size;
        const message = overrideValue === true
            ? t('toast.maskManual', { count })
            : overrideValue === false
                ? t('toast.maskUnmasked', { count })
                : overrideValue === null
                    ? t('toast.maskReset', { count })
                    : t('toast.maskToggled', { count });

        addToast(message, 'info');
    };

    const handleSetImageSourceKind = React.useCallback(async (
        ids: string[],
        sourceKindOverride: SourceKind | null
    ) => {
        if (ids.length === 0) return;

        try {
            await setImageSourceKind(ids, sourceKindOverride);
            const idSet = new Set(ids);
            const patchImage = (image: AIImage): AIImage => {
                if (!idSet.has(image.id)) return image;
                const effectiveKind = sourceKindOverride ?? getDetectedSourceKind(image);
                return {
                    ...image,
                    sourceKindOverride: sourceKindOverride ?? undefined,
                    sourceKind: effectiveKind,
                    displayTimestamp: effectiveKind === 'photograph'
                        ? (image.captureWallTimeMs ?? image.timestamp)
                        : image.timestamp,
                };
            };

            setImages(previous => previous.map(patchImage));
            setViewerSessionImages(previous => previous?.map(patchImage) ?? null);
            patchVisibleResults(ids, patchImage);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['images'] }),
                queryClient.invalidateQueries({ queryKey: ['libraryStats'] }),
                queryClient.invalidateQueries({ queryKey: ['parameterRanges'] }),
            ]);
            refreshCollectionsAfterImageFlagChange();

            const label = sourceKindOverride === null
                ? t('Automatic')
                : sourceKindOverride === 'photograph'
                    ? t('Photo')
                    : sourceKindOverride === 'generated'
                        ? t('Generated')
                        : t('Other');
            addToast(t('toast.imageKind', { count: ids.length, label }), 'success');
        } catch (error) {
            console.error('[ImageKind] Failed to update source kind', error);
            addToast(t('Failed to update image kind'), 'error');
            throw error;
        }
    }, [addToast, queryClient, refreshCollectionsAfterImageFlagChange, setImages, setViewerSessionImages, t]);

    const handleTogglePrivacy = () => {
        const next = !privacyEnabled;
        setPrivacyEnabled(next);
        addToast(next ? t("Privacy Mode Enabled") : t("Privacy Mode Disabled (Hidden/Blurred items revealed)"), "info");
    };

    const resolveMetadataRecoveryTargetId = (targetId?: string) => (
        targetId
        || viewingImageId
        || (selectedImageIndex !== null ? viewerImages[selectedImageIndex]?.id : null)
        || (selectedIds.size > 0 ? Array.from(selectedIds)[0] : null)
    );

    const openMetadataRecovery = (targetId?: string, onRecovered?: (image: AIImage) => void) => {
        const resolvedTargetId = resolveMetadataRecoveryTargetId(targetId);
        if (!resolvedTargetId) {
            addToast(t('Select an image before starting Prompt Recovery.'), 'error');
            return;
        }
        const target = viewerImages.find(image => image.id === resolvedTargetId)
            ?? images.find(image => image.id === resolvedTargetId);
        if (target && isVideoAsset(target)) {
            addToast(t('Prompt Recovery is currently image-only.'), 'info');
            return;
        }

        const currentSettings = useSettingsStore.getState();
        if (!currentSettings.settings.enableAI || !currentSettings.geminiApiKey) {
            pendingMetadataRecoveryRef.current = null;
            modals.setInitialSettingsTab?.('intelligence');
            openModal('settings');
            addToast(t('Enable AI features and configure a Gemini API key in Settings to use Prompt Recovery.'), 'info');
            return;
        }

        pendingMetadataRecoveryRef.current = { targetId: resolvedTargetId, onRecovered };
        openModal('recovery');
    };

    const executeMetadataRecovery = async (style: RecoveryStyle) => {
        const pendingRecovery = pendingMetadataRecoveryRef.current;
        const targetId = pendingRecovery?.targetId ?? resolveMetadataRecoveryTargetId();
        if (!targetId) {
            addToast(t('Select an image before starting Prompt Recovery.'), 'error');
            return;
        }

        const currentSettings = useSettingsStore.getState();
        if (!currentSettings.settings.enableAI || !currentSettings.geminiApiKey) {
            pendingMetadataRecoveryRef.current = null;
            closeModal('recovery');
            modals.setInitialSettingsTab?.('intelligence');
            openModal('settings');
            addToast(t('Enable AI features and configure a Gemini API key in Settings to use Prompt Recovery.'), 'info');
            return;
        }

        if (!fileOps.recoverMetadata) {
            addToast(t('Prompt Recovery is unavailable in this runtime.'), 'error');
            return;
        }

        const recoveredImage = await fileOps.recoverMetadata(targetId, style);
        if (!recoveredImage) return;

        pendingMetadataRecoveryRef.current = null;
        closeModal('recovery');
        pendingRecovery?.onRecovered?.(recoveredImage);
    };

    const handlePinImage = (id: string, newPinned: boolean, options: SingleImageActionOptions = { showToast: true }) => {
        const previousActiveImage = getImage(id);
        const previousImages = images;
        const isInCurrentQuery = images.some(image => image.id === id);
        const nextImages = isInCurrentQuery
            ? applyOptimisticPinOrder(previousImages, [id], newPinned, !!filters.collectionId)
            : previousImages;

        if (isInCurrentQuery) {
            setImages(nextImages);
            patchImageFlagsInQueryCaches(queryClient, [id], { isPinned: newPinned }, {
                previousOrder: previousImages,
                nextOrder: nextImages,
                reorderQueryKey: imagesQueryKey
            });
        } else if (activeImageState) {
            activeImageState.updateImage(id, image => ({ ...image, isPinned: newPinned }));
            patchImageFlagsInQueryCaches(queryClient, [id], { isPinned: newPinned });
        }
        patchVisibleResults([id], image => (
            image.isPinned === newPinned ? image : { ...image, isPinned: newPinned }
        ));

        if (options.showToast !== false) {
            addToast(newPinned ? t("Pinned to top") : t("Unpinned"), "info");
        }
        void persistPinChanges(
            [id],
            newPinned,
            previousImages,
            nextImages,
            'Failed to update pinned state',
            previousActiveImage,
            isInCurrentQuery
        );
        // await queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
    };

    const handleShortcutFavorite = () => {
        if (selectedImageIndex !== null && images[selectedImageIndex]) {
            handleFavoriteImage(images[selectedImageIndex].id);
        } else {
            handleBulkFavorite();
        }
    };

    const handleShortcutPin = async () => {
        if (selectedImageIndex !== null && images[selectedImageIndex]) {
            await handlePinImage(images[selectedImageIndex].id, !images[selectedImageIndex].isPinned);
        } else {
            handleBulkPin();
        }
    };

    const runBackfill = async () => {
        addToast(t('Starting background backfill...'), "info");
        const count = await backfillParameterColumns();
        if (count > 0) {
            addToast(t('Backfill complete: {{count}} images updated', { count: count }), "success");
            await queryClient.invalidateQueries({ queryKey: ['libraryStats'] });
            await queryClient.invalidateQueries({ queryKey: ['parameterRanges'] });
        } else {
            addToast(t('Backfill complete: No images needed updating'), "success");
        }
    };

    return {
        executeDelete,
        requestDeleteForId,
        handleDeleteViewerImage,
        handleExportConfirm,
        handleBulkFavorite,
        handleBulkPin,
        handleBulkMask,
        handleSetImageSourceKind,
        handleTogglePrivacy,
        openMetadataRecovery,
        executeMetadataRecovery,
        handleFavoriteImage,
        handlePinImage,
        handleShortcutFavorite,
        handleShortcutPin,
        toggleFavorite: handleFavoriteImage,
        runBackfill
    };
};
