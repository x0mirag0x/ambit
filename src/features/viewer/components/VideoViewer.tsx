import * as React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, ExternalLink, Film, Heart, Link, Pin, Puzzle, RotateCcw, RotateCw, Save, Target, Trash2, X } from 'lucide-react';
import { commands } from '../../../bindings';
import { useCollectionStore } from '../../../stores/collectionStore';
import { GeneratorTool, isVideoAsset, VideoAsset, type VideoGenerationMode } from '../../../types';
import { openFileInDefaultApp } from '../../../services/osOpen';
import { getImageWithFullMetadata, updateVideoPlaybackStatus } from '../../../services/db/imageRepo';
import { unwrap } from '../../../utils/spectaUtils';
import { useToast } from '../../../hooks/useToast';
import { MaskedViewerGate } from './MaskedViewerGate';
import { WorkflowInspector } from './WorkflowInspector';
import { CollectionMembershipPicker } from './CollectionMembershipPicker';
import { MetadataTextAreaField } from './metadata/MetadataTextAreaField';
import type { ViewerTabDefinition } from './ViewerTabs';
import { ViewerToolbarButton } from './ViewerToolbarButton';
import { ViewerToolbarFrame } from './ViewerToolbarFrame';
import { ViewerSidebarShell } from './ViewerSidebarShell';
import { AssetTechnicalDetails } from './metadata/AssetTechnicalDetails';
import { MetadataField } from './metadata/MetadataField';
import { MetadataParameterList } from './metadata/MetadataParameterList';
import { ResourcesSection } from './metadata/ResourcesSection';
import { getModelPresentation } from './metadata/modelPresentation';
import { useViewerKeyboard } from '../hooks/useViewerKeyboard';
import { MetadataGeneratorField } from './metadata/MetadataGeneratorField';
import { MetadataModelField } from './metadata/MetadataModelField';
import { useMetadataDisclosureState } from '../hooks/useMetadataDisclosureState';
import { useViewerPreferredTab } from '../hooks/useViewerPreferredTab';
import { useTranslation } from 'react-i18next';
import { translateRuntimeMessage } from '../../../i18n/statusMessages';

type VideoViewerTab = 'details' | 'metadata' | 'workflow';

const VIDEO_VIEWER_TABS: readonly ViewerTabDefinition<VideoViewerTab>[] = [
    { id: 'details', label: 'Details' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'workflow', label: 'Workflow' },
];
const VIDEO_VIEWER_TAB_IDS = VIDEO_VIEWER_TABS.map(tab => tab.id);

const sideArrowClass = (enabled: boolean) =>
    `absolute z-30 rounded-full border border-white/5 bg-black/20 p-4 text-white/50 backdrop-blur-sm transition-all focus:opacity-100 enabled:hover:border-white/10 enabled:hover:bg-black/40 enabled:hover:text-white disabled:pointer-events-none disabled:opacity-0 ${enabled ? 'pointer-events-auto opacity-0 group-hover:opacity-100' : 'pointer-events-none opacity-0'}`;

const isNativeMediaControl = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) return false;
    if (target instanceof HTMLMediaElement) return true;
    const root = target.getRootNode();
    return root instanceof ShadowRoot && root.host instanceof HTMLMediaElement;
};

interface VideoViewerProps {
    video: VideoAsset;
    isMasked: boolean;
    initiallyRevealed?: boolean;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    onToggleFavorite?: (id: string) => void;
    onTogglePin?: (id: string, isPinned: boolean) => void;
    onDelete?: (id: string) => void;
    onUpdateNotes?: (id: string, notes: string) => void;
    onUpdatePrompt?: (id: string, prompt: string) => void;
    onUpdateNegativePrompt?: (id: string, prompt: string) => void;
    onUpdateModel?: (id: string, model: string) => void;
    onUpdateTool?: (id: string, tool: GeneratorTool) => void;
    onUpdateGenerationMode?: (id: string, mode: VideoGenerationMode) => void;
    onRevertMetadata?: (id: string) => void;
    onSearch?: (term: string) => void;
    onSetCollectionMembership?: (assetId: string, collectionId: string, shouldBelong: boolean) => Promise<boolean>;
    modelOptions?: readonly string[];
    isShortcutBlocked?: boolean;
    canNavigateNext?: boolean;
    canNavigatePrevious?: boolean;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
    video,
    isMasked,
    initiallyRevealed = false,
    onClose,
    onNext,
    onPrev,
    onToggleFavorite,
    onTogglePin,
    onDelete,
    onUpdateNotes,
    onUpdatePrompt,
    onUpdateNegativePrompt,
    onUpdateModel,
    onUpdateTool,
    onUpdateGenerationMode,
    onRevertMetadata,
    onSearch,
    onSetCollectionMembership,
    modelOptions = [],
    isShortcutBlocked = false,
    canNavigateNext = true,
    canNavigatePrevious = true,
}) => {
    const { t } = useTranslation();
    const metadataDisclosure = useMetadataDisclosureState();
    const { addToast } = useToast();
    const collections = useCollectionStore(state => state.collections);
    const playerRef = React.useRef<HTMLVideoElement>(null);
    const [revealedVideoId, setRevealedVideoId] = React.useState<string | null>(
        initiallyRevealed ? video.id : null
    );
    const revealed = !isMasked || initiallyRevealed || revealedVideoId === video.id;
    const [playerKey, setPlayerKey] = React.useState(0);
    const [playbackState, setPlaybackState] = React.useState({
        videoId: video.id,
        status: video.playbackStatus,
        url: null as string | null,
    });
    const [notesState, setNotesState] = React.useState({ videoId: video.id, value: video.notes ?? '' });
    const { activeTab, onExplicitTabChange } = useViewerPreferredTab(VIDEO_VIEWER_TAB_IDS);
    const [positivePromptState, setPositivePromptState] = React.useState({ videoId: video.id, value: video.metadata.positivePrompt });
    const [negativePromptState, setNegativePromptState] = React.useState({ videoId: video.id, value: video.metadata.negativePrompt });
    const [fullVideo, setFullVideo] = React.useState<VideoAsset | null>(null);
    const playbackStatus = playbackState.videoId === video.id ? playbackState.status : video.playbackStatus;
    const playbackUrl = playbackState.videoId === video.id ? playbackState.url : null;
    const notes = notesState.videoId === video.id ? notesState.value : (video.notes ?? '');
    const positivePrompt = positivePromptState.videoId === video.id ? positivePromptState.value : video.metadata.positivePrompt;
    const negativePrompt = negativePromptState.videoId === video.id ? negativePromptState.value : video.metadata.negativePrompt;

    React.useEffect(() => {
        setRevealedVideoId(initiallyRevealed ? video.id : null);
    }, [video.id, initiallyRevealed]);

    React.useEffect(() => {
        setPlaybackState(current => ({
            videoId: video.id,
            status: video.playbackStatus,
            url: current.videoId === video.id ? current.url : null,
        }));
    }, [video.id, video.playbackStatus]);

    React.useEffect(() => {
        setNotesState({ videoId: video.id, value: video.notes ?? '' });
        setPositivePromptState({ videoId: video.id, value: video.metadata.positivePrompt });
        setNegativePromptState({ videoId: video.id, value: video.metadata.negativePrompt });
    }, [video.id, video.notes, video.metadata]);

    React.useEffect(() => {
        if (!revealed || video.isMissing) {
            setFullVideo(null);
            return;
        }

        let cancelled = false;
        void getImageWithFullMetadata(video.id)
            .then(asset => {
                if (!cancelled && asset && isVideoAsset(asset)) setFullVideo(asset);
            })
            .catch(error => {
                console.error('[VideoViewer] Failed to load full metadata', error);
            });
        return () => { cancelled = true; };
    }, [revealed, video.id, video.isMissing]);

    const metadataVideo = React.useMemo<VideoAsset>(() => {
        if (fullVideo?.id !== video.id) return video;
        return {
            ...fullVideo,
            ...video,
            metadata: {
                ...fullVideo.metadata,
                ...video.metadata,
                generationMode: video.metadata.generationMode ?? fullVideo.metadata.generationMode,
                loras: fullVideo.metadata.loras?.length ? fullVideo.metadata.loras : video.metadata.loras,
                controlNets: fullVideo.metadata.controlNets?.length ? fullVideo.metadata.controlNets : video.metadata.controlNets,
                ipAdapters: fullVideo.metadata.ipAdapters?.length ? fullVideo.metadata.ipAdapters : video.metadata.ipAdapters,
                workflowJson: fullVideo.metadata.workflowJson ?? video.metadata.workflowJson,
                diagnostics: fullVideo.metadata.diagnostics ?? video.metadata.diagnostics,
                conflicts: fullVideo.metadata.conflicts ?? video.metadata.conflicts,
                fieldSources: {
                    ...fullVideo.metadata.fieldSources,
                    ...video.metadata.fieldSources,
                },
            },
            originalChunks: video.originalChunks ?? fullVideo.originalChunks,
            originalMetadata: video.originalMetadata ?? fullVideo.originalMetadata,
            originalState: video.originalState ?? fullVideo.originalState,
        };
    }, [fullVideo, video]);
    const modelPresentation = React.useMemo(
        () => getModelPresentation(metadataVideo.metadata),
        [metadataVideo.metadata]
    );
    const hasUserOverrides = Object.values(metadataVideo.metadata.fieldSources ?? {}).includes('user_override');

    React.useEffect(() => {
        if (!revealed || video.isMissing) return;
        let cancelled = false;
        void unwrap(commands.prepareVideoPlayback(video.id))
            .then(path => {
                if (!cancelled) setPlaybackState(current => ({
                    videoId: video.id,
                    status: current.videoId === video.id ? current.status : video.playbackStatus,
                    url: convertFileSrc(path),
                }));
            })
            .catch(error => {
                console.error('[VideoViewer] Failed to prepare scoped video playback', error);
                if (!cancelled) setPlaybackState({ videoId: video.id, status: 'external_required', url: null });
            });
        return () => { cancelled = true; };
    }, [revealed, video.id, video.isMissing, playerKey]);

    const bindPlayer = React.useCallback((node: HTMLVideoElement | null) => {
        if (playerRef.current && playerRef.current !== node) playerRef.current.pause();
        playerRef.current = node;
    }, []);

    const seekBy = React.useCallback((seconds: number) => {
        const player = playerRef.current;
        if (!player || !Number.isFinite(player.duration)) return;

        const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
        player.currentTime = Math.min(player.duration, Math.max(0, currentTime + seconds));
    }, []);

    const navigateAway = React.useCallback((navigate: () => void) => {
        playerRef.current?.pause();
        navigate();
    }, []);

    const handleViewerKeyDown = React.useCallback((event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            const arrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
            if (arrowKey && (isNativeMediaControl(event.target) || isNativeMediaControl(document.activeElement))) return;
            if (event.target instanceof Element && event.target.closest('button')) return;
            if (event.key === ' ') {
                const player = playerRef.current;
                if (!player) return;
                event.preventDefault();
                if (player.paused) void player.play().catch(() => undefined);
                else player.pause();
            } else if (event.key === 'ArrowRight' && canNavigateNext) navigateAway(onNext);
            else if (event.key === 'ArrowLeft' && canNavigatePrevious) navigateAway(onPrev);
            else if (event.key.toLowerCase() === 'j') {
                event.preventDefault();
                seekBy(-10);
            } else if (event.key.toLowerCase() === 'l') {
                event.preventDefault();
                seekBy(10);
            }
    }, [canNavigateNext, canNavigatePrevious, navigateAway, onClose, onNext, onPrev, seekBy]);

    useViewerKeyboard({
        blocked: isShortcutBlocked,
        onKeyDown: handleViewerKeyDown,
    });

    const recordPlaybackStatus = (status: 'playable' | 'external_required') => {
        setPlaybackState(current => ({
            videoId: video.id,
            status,
            url: current.videoId === video.id ? current.url : null,
        }));
        void updateVideoPlaybackStatus(video.id, status).catch(error => {
            console.error('[VideoViewer] Failed to persist playback status', error);
        });
    };

    const handleExport = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const destination = await open({ directory: true, multiple: false });
            if (typeof destination !== 'string') return;
            const result = await unwrap(commands.exportAssetOriginal(video.id, destination));
            const displayPath = result.outputPath
                .replace(/^\/\/\?\/UNC\//i, '//')
                .replace(/^\/\/\?\//, '');
            addToast(t('Exported {{displayPath}}', { displayPath: displayPath }), 'success');
        } catch (error) {
            addToast(t('Could not export original: {{v0}}', { v0: String(error) }), 'error');
        }
    };

    const handleOpenExternal = async () => {
        const result = await openFileInDefaultApp(video.id);
        if (result.status === 'error') addToast(t(result.error), 'error');
    };

    if (!revealed && !video.isMissing) {
        return (
            <div role="dialog" aria-modal="true" aria-label={t('Hidden video')} className="group fixed inset-0 z-[100] flex bg-black text-white">
                <button
                    type="button"
                    aria-label={t('Previous Image (Left Arrow)')}
                    disabled={!canNavigatePrevious}
                    onClick={event => { event.stopPropagation(); if (canNavigatePrevious) navigateAway(onPrev); }}
                    className={`left-4 ${sideArrowClass(canNavigatePrevious)}`}
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                    type="button"
                    aria-label={t('Next Image (Right Arrow)')}
                    disabled={!canNavigateNext}
                    onClick={event => { event.stopPropagation(); if (canNavigateNext) navigateAway(onNext); }}
                    className={`right-4 ${sideArrowClass(canNavigateNext)}`}
                >
                    <ChevronRight className="h-6 w-6" />
                </button>
                <MaskedViewerGate
                    mediaLabel="video"
                    onReveal={() => setRevealedVideoId(video.id)}
                    onClose={onClose}
                />
            </div>
        );
    }

    return (
        <div role="dialog" aria-modal="true" aria-label={t('Video viewer: {{filename}}', { filename: video.filename })} className="fixed inset-0 z-[100] flex bg-black text-white">
            <main
                className="group relative flex min-w-0 flex-1 items-center justify-center bg-black"
                onClick={event => { if (event.target === event.currentTarget) onClose(); }}
            >
                <button
                    type="button"
                    aria-label={t('Previous Image (Left Arrow)')}
                    disabled={!canNavigatePrevious}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                    }}
                    onClick={event => { event.stopPropagation(); if (canNavigatePrevious) navigateAway(onPrev); }}
                    className={`left-4 ${sideArrowClass(canNavigatePrevious)}`}
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                    type="button"
                    aria-label={t('Next Image (Right Arrow)')}
                    disabled={!canNavigateNext}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                    }}
                    onClick={event => { event.stopPropagation(); if (canNavigateNext) navigateAway(onNext); }}
                    className={`right-4 ${sideArrowClass(canNavigateNext)}`}
                >
                    <ChevronRight className="h-6 w-6" />
                </button>
                <ViewerToolbarFrame filename={video.filename} actions={<>
                    {!video.isMissing && (
                        <ViewerToolbarButton label={t('Open in Default App')} onClick={() => void handleOpenExternal()}>
                            <ExternalLink />
                        </ViewerToolbarButton>
                    )}
                    {!video.isMissing && (
                        <ViewerToolbarButton label={t('Export Original')} onClick={() => void handleExport()}>
                            <Save />
                        </ViewerToolbarButton>
                    )}
                    {onToggleFavorite && <ViewerToolbarButton
                        label={video.isFavorite ? t('Remove from Favorites') : t('Add to Favorites')}
                        aria-pressed={video.isFavorite}
                        onClick={() => onToggleFavorite(video.id)}
                    >
                        <Heart className={video.isFavorite ? 'fill-red-500 text-red-500' : ''} />
                    </ViewerToolbarButton>}
                    {onTogglePin && (
                        <ViewerToolbarButton
                            label={video.isPinned ? t('Unpin') : t('Pin to Top')}
                            aria-pressed={Boolean(video.isPinned)}
                            onClick={() => onTogglePin(video.id, !video.isPinned)}
                            className={video.isPinned ? 'border-sage-500/50 text-sage-400' : ''}
                        >
                            <Pin className={video.isPinned ? 'fill-current' : ''} />
                        </ViewerToolbarButton>
                    )}
                    {onDelete && (
                        <ViewerToolbarButton
                            label={t('Remove from Library')}
                            onClick={() => onDelete(video.id)}
                            className="hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
                        >
                            <Trash2 />
                        </ViewerToolbarButton>
                    )}
                    <ViewerToolbarButton label={t('Close Viewer (Esc)')} onClick={onClose}>
                        <X />
                    </ViewerToolbarButton>
                </>} />

                {video.isMissing ? (
                    <div className="flex max-w-md flex-col items-center rounded-2xl border border-red-500/30 bg-zinc-900 p-8 text-center shadow-2xl">
                        <h2 className="text-xl font-bold">{t('Source file missing')}</h2>
                        <p className="mt-2 text-sm text-zinc-400">{t('Dvoyna Vault still keeps this library record. Restore the file at its original location or remove the record.')}</p>
                    </div>
                ) : playbackStatus === 'external_required' ? (
                    <div className="flex max-w-md flex-col items-center rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center">
                        <h2 className="text-xl font-bold">{t('Playback unavailable here')}</h2>
                        <p className="mt-2 text-sm text-zinc-400">{t('The file is still in your library and can be opened with your default video app.')}</p>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setPlaybackState({ videoId: video.id, status: 'unknown', url: null }); setPlayerKey(key => key + 1); }} className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2"><RotateCcw className="h-4 w-4" /> {t('Retry')}</button>
                            <button onClick={() => void handleOpenExternal()} className="rounded-lg bg-sage-500 px-4 py-2 font-bold">{t('Open externally')}</button>
                        </div>
                    </div>
                ) : playbackUrl ? (
                    <div
                        className="flex w-full max-w-[calc(100vw-24rem)] flex-col items-center gap-4 px-6"
                        onClick={event => { if (event.target === event.currentTarget) onClose(); }}
                    >
                        <video
                            key={`${video.id}:${playerKey}`}
                            ref={bindPlayer}
                            src={playbackUrl}
                            controls
                            muted
                            playsInline
                            preload="metadata"
                            onCanPlay={() => recordPlaybackStatus('playable')}
                            onError={() => recordPlaybackStatus('external_required')}
                            className="max-h-[calc(100vh-8rem)] max-w-full bg-black"
                        />
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                            <button type="button" aria-label={t('Back 10 seconds')} onClick={() => seekBy(-10)} className="flex items-center gap-1.5 rounded border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-white hover:bg-white/10">
                                <RotateCcw className="h-3.5 w-3.5" /> 10s
                            </button>
                            <label className="flex items-center gap-2">
                                {t('Playback speed')}<select defaultValue="1" onChange={event => { if (playerRef.current) playerRef.current.playbackRate = Number(event.target.value); }} className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-white">
                                    <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
                                </select>
                            </label>
                            <button type="button" aria-label={t('Forward 10 seconds')} onClick={() => seekBy(10)} className="flex items-center gap-1.5 rounded border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-white hover:bg-white/10">
                                10s <RotateCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div role="status" className="text-sm text-zinc-400">{t('Preparing secure playback…')}</div>
                )}
            </main>

            <ViewerSidebarShell
                tabs={VIDEO_VIEWER_TABS}
                activeTab={activeTab}
                onTabChange={onExplicitTabChange}
                ariaLabel="Video viewer sections"
            >
                {activeTab === 'details' && <div className="custom-scrollbar h-full overflow-y-auto p-5">
                <AssetTechnicalDetails rows={[
                    { label: 'Duration', value: formatDuration(video.durationMs) },
                    { label: 'Dimensions', value: `${video.width}×${video.height}` },
                    { label: 'Codec', value: video.videoCodec },
                    { label: 'Container', value: video.mediaContainer ?? 'Unknown' },
                    { label: 'Audio', value: video.audioPresent ? (video.audioCodec ?? 'Present') : 'None' },
                ]} />

                <MetadataTextAreaField
                    kind="notes"
                    value={notes}
                    onChange={event => setNotesState({ videoId: video.id, value: event.target.value })}
                    onBlur={() => {
                        if (notes !== (video.notes ?? '')) onUpdateNotes?.(video.id, notes);
                    }}
                    readOnly={!onUpdateNotes}
                    className="mt-6"
                />

                {onSetCollectionMembership ? <div className="mt-6">
                    <CollectionMembershipPicker
                        assetId={video.id}
                        collections={collections}
                        onSetCollectionMembership={onSetCollectionMembership}
                    />
                </div> : null}
                </div>}

                {activeTab === 'metadata' && <div className="custom-scrollbar h-full space-y-5 overflow-y-auto p-5 text-sm">
                    <MetadataTextAreaField
                        kind="positivePrompt"
                        value={positivePrompt}
                        onChange={event => setPositivePromptState({ videoId: video.id, value: event.target.value })}
                        onBlur={() => {
                            if (positivePrompt !== (metadataVideo.metadata.positivePrompt ?? '')) {
                                onUpdatePrompt?.(video.id, positivePrompt);
                            }
                        }}
                        source={metadataVideo.metadata.fieldSources?.positivePrompt}
                        readOnly={!onUpdatePrompt}
                    />
                    <MetadataTextAreaField
                        kind="negativePrompt"
                        value={negativePrompt}
                        onChange={event => setNegativePromptState({ videoId: video.id, value: event.target.value })}
                        onBlur={() => {
                            if (negativePrompt !== (metadataVideo.metadata.negativePrompt ?? '')) {
                                onUpdateNegativePrompt?.(video.id, negativePrompt);
                            }
                        }}
                        source={metadataVideo.metadata.fieldSources?.negativePrompt}
                        readOnly={!onUpdateNegativePrompt}
                    />
                    <MetadataField label={t('Generation mode')} icon={Film} source={metadataVideo.metadata.fieldSources?.generationMode}>
                        <select aria-label={t('Generation mode')} value={metadataVideo.metadata.generationMode ?? 'unknown'} disabled={!onUpdateGenerationMode} onChange={event => onUpdateGenerationMode?.(video.id, event.target.value as VideoGenerationMode)} className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-gray-900 disabled:cursor-default disabled:opacity-80 dark:border-white/10 dark:bg-black dark:text-white">
                            <option value="unknown">{t('Unknown')}</option>
                            <option value="text_to_video">{t('Text to video')}</option>
                            <option value="image_to_video">{t('Image to video')}</option>
                            <option value="first_last_frame_to_video">{t('First/last frame')}</option>
                            <option value="video_editing">{t('Video editing')}</option>
                            <option value="audio_lip_sync">{t('Audio / lip sync')}</option>
                            <option value="guided_video">{t('Guided video')}</option>
                        </select>
                    </MetadataField>
                    <MetadataGeneratorField
                        key={`generator:${metadataVideo.id}`}
                        value={metadataVideo.metadata.tool}
                        source={metadataVideo.metadata.fieldSources?.tool}
                        onSave={onUpdateTool ? value => onUpdateTool(video.id, value) : undefined}
                    />
                    <MetadataModelField
                        key={`model:${metadataVideo.id}`}
                        presentation={modelPresentation}
                        options={modelOptions}
                        source={metadataVideo.metadata.fieldSources?.model}
                        onSave={onUpdateModel ? value => onUpdateModel(video.id, value) : undefined}
                    />
                    <MetadataParameterList rows={[
                        { label: 'Seed', value: metadataVideo.metadata.seed?.toString() || 'Unknown', source: metadataVideo.metadata.fieldSources?.seed },
                        { label: 'Steps', value: metadataVideo.metadata.steps > 0 ? metadataVideo.metadata.steps.toString() : 'Unknown', source: metadataVideo.metadata.fieldSources?.steps },
                        { label: 'CFG', value: metadataVideo.metadata.cfg > 0 ? metadataVideo.metadata.cfg.toString() : 'Unknown', source: metadataVideo.metadata.fieldSources?.cfg },
                        { label: 'Sampler', value: metadataVideo.metadata.sampler || 'Unknown', source: metadataVideo.metadata.fieldSources?.sampler },
                        { label: 'Model Hash', value: modelPresentation.isHashFallback ? 'Unknown' : (metadataVideo.metadata.modelHash || 'Unknown'), optional: true },
                    ]} expanded={metadataDisclosure.isExpanded('generationParameters')} onExpandedChange={expanded => metadataDisclosure.setExpanded('generationParameters', expanded)} />
                    <ResourcesSection
                        groups={[
                            { title: 'LoRAs', icon: Puzzle, filterKind: 'lora', items: metadataVideo.metadata.loras, source: metadataVideo.metadata.fieldSources?.loras },
                            { title: 'ControlNets', icon: Target, filterKind: 'controlnet', items: metadataVideo.metadata.controlNets, source: metadataVideo.metadata.fieldSources?.controlNets },
                            { title: 'IP adapters', icon: Link, filterKind: 'ipadapter', items: metadataVideo.metadata.ipAdapters, source: metadataVideo.metadata.fieldSources?.ipAdapters },
                        ]}
                        onSearch={onSearch}
                        onClose={onClose}
                        expanded={metadataDisclosure.isExpanded('resources')}
                        onExpandedChange={expanded => metadataDisclosure.setExpanded('resources', expanded)}
                    />
                    {metadataVideo.metadata.conflicts && metadataVideo.metadata.conflicts.length > 0 && <section className="rounded-lg border border-ember-200 bg-ember-50 p-3 text-xs dark:border-ember-500/30 dark:bg-ember-500/10"><h3 className="font-bold text-ember-600 dark:text-ember-300">{t('Conflicting evidence')}</h3>{metadataVideo.metadata.conflicts.map((conflict, index) => <p key={`${conflict.field}:${index}`} className="mt-2 text-gray-700 dark:text-zinc-300">{conflict.field}{t(': ignored')} {conflict.ignoredValue} from {formatSource(conflict.ignoredSource)}</p>)}</section>}
                    {metadataVideo.metadata.diagnostics && metadataVideo.metadata.diagnostics.length > 0 && <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-white/10 dark:bg-black"><h3 className="font-bold">{t('Diagnostics')}</h3>{metadataVideo.metadata.diagnostics.map(diagnostic => <p key={diagnostic.code} className="mt-2 text-gray-600 dark:text-zinc-400">{translateRuntimeMessage(diagnostic.message)}</p>)}</section>}
                    {onRevertMetadata && hasUserOverrides ? <button type="button" onClick={() => onRevertMetadata(video.id)} className="w-full rounded-lg border border-gray-200 px-3 py-2 font-bold hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10">{t('Revert user overrides')}</button> : null}
                </div>}

                {activeTab === 'workflow' && (metadataVideo.metadata.workflowJson
                    ? <WorkflowInspector key={metadataVideo.id} image={metadataVideo} />
                    : <p className="p-5 text-sm text-gray-500 dark:text-zinc-400">{t('No trusted workflow evidence was found for this video.')}</p>)}
            </ViewerSidebarShell>
        </div>
    );
};

const formatSource = (source: string): string => source.replaceAll('_', ' ');

const formatDuration = (durationMs: number): string => {
    const seconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};
