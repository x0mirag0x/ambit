import * as React from 'react';
import { AlertTriangle, ChevronDown, Loader2, Moon, RefreshCw, Sun } from 'lucide-react';
import {
    commands,
    type ThumbnailOptimizationFailure
} from '../../../bindings';
import { useToast } from '../../../hooks/useToast';
import { InfoTooltip } from '../../../components/ui/InfoTooltip';
import {
    useLibraryStore,
    type ThumbnailOptimizationDetails,
    type ThumbnailOptimizationRunSummary
} from '../../../stores/libraryStore';
import { AppSettings } from '../../../types';
import { unwrap } from '../../../utils/spectaUtils';
import { nativeLanguageName, resolveUiLanguage, UI_LANGUAGES, type UiLanguage } from '../../../i18n/language';
import { UPSTREAM_REPOSITORY_URL } from '../../../constants/support';
import { openExternalUrl } from '../../../utils/externalLinks';
import { useTranslation } from 'react-i18next';

interface TabProps {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

type ThumbnailFailureLoadState = 'idle' | 'loading' | 'ready' | 'error';

const THUMBNAIL_PROFILE_OPTIONS: {
    id: NonNullable<AppSettings['thumbnailOptimizationProfile']>;
    label: string;
}[] = [
        { id: 'quiet', label: 'Quiet' },
        { id: 'balanced', label: 'Balanced' },
        { id: 'fast', label: 'Fast' },
    ];

const NUMBER_FORMATTER = new Intl.NumberFormat();
const THUMBNAIL_FAILURE_LIMIT = 50;
const formatNumber = (value: number): string => NUMBER_FORMATTER.format(value);
const formatRate = (value: number): string => value > 0 ? `${value.toFixed(value >= 10 ? 0 : 1)}/s` : '0/s';
const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};
const getFileNameFromPath = (path: string): string => {
    const normalized = path.replace(/\\/g, '/');
    return normalized.split('/').filter(Boolean).pop() ?? path;
};
const formatAttemptTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
};

const getThumbnailMetricValue = (
    details: ThumbnailOptimizationDetails | null,
    lastRun: ThumbnailOptimizationRunSummary | null,
    field: 'imagesPerSecond' | 'optimized' | 'reused' | 'failed' | 'skipped'
): number => details?.[field] ?? lastRun?.[field] ?? 0;

const getSmartThumbnailStatus = (
    details: ThumbnailOptimizationDetails | null,
    isActive: boolean,
    isPaused: boolean
): string => {
    if (isPaused) return 'Paused';
    if (details?.isThrottled) return 'Throttled';
    if (isActive) return 'Running';
    return 'Idle';
};

export const GeneralTab: React.FC<TabProps> = React.memo(({ settings, setSettings }) => {
    const { t } = useTranslation();
    const uiLanguage = resolveUiLanguage(settings.uiLanguage);
    const selectUiLanguage = (language: UiLanguage) => {
        setSettings(prev => ({ ...prev, uiLanguage: language }));
    };
    const { addToast } = useToast();
    const [failurePanelOpen, setFailurePanelOpen] = React.useState(false);
    const [thumbnailFailures, setThumbnailFailures] = React.useState<ThumbnailOptimizationFailure[]>([]);
    const [failureLoadState, setFailureLoadState] = React.useState<ThumbnailFailureLoadState>('idle');
    const [failureLoadError, setFailureLoadError] = React.useState<string | null>(null);
    const [isRetryingFailures, setIsRetryingFailures] = React.useState(false);
    const thumbnailDetails = useLibraryStore(s => s.backgroundHealingDetails);
    const lastThumbnailRun = useLibraryStore(s => s.lastBackgroundHealingRun);
    const isBackgroundHealingActive = useLibraryStore(s => s.isBackgroundHealingActive);
    const backgroundHealingPaused = useLibraryStore(s => s.backgroundHealingPaused);
    const requestThumbnailOptimizationRun = useLibraryStore(s => s.requestThumbnailOptimizationRun);
    const smartThumbnailStatus = getSmartThumbnailStatus(
        thumbnailDetails,
        isBackgroundHealingActive,
        backgroundHealingPaused
    );
    const showLastThumbnailRun = !thumbnailDetails && Boolean(lastThumbnailRun);
    const failedThumbnailCount = getThumbnailMetricValue(thumbnailDetails, lastThumbnailRun, 'failed');
    const hasKnownThumbnailFailures = failedThumbnailCount > 0;
    const canRetryThumbnailFailures = failureLoadState === 'ready'
        && thumbnailFailures.length > 0
        && !isBackgroundHealingActive
        && !isRetryingFailures;

    const loadThumbnailFailures = React.useCallback(async () => {
        setFailureLoadState('loading');
        setFailureLoadError(null);

        try {
            const result = await unwrap(commands.getThumbnailOptimizationFailures(THUMBNAIL_FAILURE_LIMIT));
            setThumbnailFailures(result.failures);
            setFailureLoadState('ready');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setThumbnailFailures([]);
            setFailureLoadError(message);
            setFailureLoadState('error');
        }
    }, []);

    React.useEffect(() => {
        if (!failurePanelOpen || failureLoadState !== 'idle') {
            return;
        }

        void loadThumbnailFailures();
    }, [
        failureLoadState,
        failurePanelOpen,
        loadThumbnailFailures
    ]);

    const handleThemeToggle = () => {
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        setSettings(prev => ({ ...prev, theme: newTheme }));
        addToast(t(newTheme === 'dark' ? 'Switched to dark mode' : 'Switched to light mode'), 'success');
    };

    const handleConfirmDeleteToggle = () => {
        const newValue = !settings.confirmDelete;
        setSettings(prev => ({ ...prev, confirmDelete: newValue }));
        addToast(newValue ? t('Removal confirmations enabled') : t('Removal confirmations disabled'), 'success');
    };

    const handleAutoThumbnailHealingToggle = () => {
        const newValue = !settings.enableAutoThumbnailHealing;
        setSettings(prev => ({ ...prev, enableAutoThumbnailHealing: newValue }));
        addToast(newValue ? t('Smart optimization enabled') : t('Smart optimization disabled'), 'success');
    };

    const handleToggleFailures = () => {
        setFailurePanelOpen(open => {
            const nextOpen = !open;
            if (nextOpen && failureLoadState === 'error') {
                setFailureLoadState('idle');
            }
            return nextOpen;
        });
    };

    const handleRetryFailedThumbnails = async () => {
        setIsRetryingFailures(true);

        try {
            const retryCount = await unwrap(commands.retryFailedThumbnailOptimizations());
            await loadThumbnailFailures();
            requestThumbnailOptimizationRun();
            addToast(t('toast.queuedThumbnails', { count: retryCount }), 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addToast(t('Failed to retry thumbnails: {{message}}', { message: message }), 'error');
        } finally {
            setIsRetryingFailures(false);
        }
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <section className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl p-6 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">{t('Appearance')}</h4>
                <div
                    onClick={handleThemeToggle}
                    className="flex items-center justify-between cursor-pointer group"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl transition-colors ${settings.theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </div>
                        <div>
                            <div className="text-base font-medium text-gray-900 dark:text-gray-200 group-hover:text-sage-500 transition-colors">{t('Theme Mode')}</div>
                            <div className="text-sm text-gray-500">{settings.theme === 'dark' ? t('Dark Mode Active') : t('Light Mode Active')}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="text-xs font-bold px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                    >
                        {t('Switch')}</button>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-base font-medium text-gray-900 dark:text-gray-200">{t('Language')}</div>
                        <div className="text-sm text-gray-500">{t('Choose the language used throughout Dvoyna Vault')}</div>
                    </div>
                    <div role="radiogroup" aria-label={t('Language')} className="flex shrink-0 flex-wrap justify-end gap-2">
                        {UI_LANGUAGES.map((language) => {
                            const selected = uiLanguage === language;
                            return (
                                <button
                                    key={language}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => selectUiLanguage(language)}
                                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${selected
                                        ? 'bg-sage-500 text-white'
                                        : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    {nativeLanguageName(language)}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-6 border-t border-gray-200 pt-5 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <img src="/branding/dv-monogram.png" alt="" className="h-10 w-10 shrink-0" />
                        <div className="text-base font-medium text-gray-900 dark:text-gray-200">{t('About')}</div>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">
                        {t('Dvoyna Vault is based on Ambit by AsuraAce, licensed under GPL-3.0, with modifications.')}
                    </p>
                    <button
                        type="button"
                        onClick={() => void openExternalUrl(UPSTREAM_REPOSITORY_URL)}
                        className="mt-2 text-sm font-medium text-sage-700 underline-offset-2 hover:underline dark:text-sage-300"
                    >
                        {t('Ambit on GitHub')}
                    </button>
                </div>
            </section>

            <section className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl p-6 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">{t('Library & Files')}</h4>

                <div
                    onClick={handleAutoThumbnailHealingToggle}
                    className="flex items-center justify-between cursor-pointer group mb-6"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-medium text-gray-900 dark:text-gray-200 group-hover:text-sage-500 transition-colors">{t('Smart Thumbnail Optimization')}</div>
                        </div>
                        <div className="text-sm text-gray-500">{t('Optimizes thumbnails automatically in the background')}</div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={settings.enableAutoThumbnailHealing}
                        aria-label={t('Smart Thumbnail Optimization')}
                        className={`w-12 h-7 rounded-full relative transition-colors ${settings.enableAutoThumbnailHealing ? 'bg-sage-600' : 'bg-gray-200 dark:bg-white/10'}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.enableAutoThumbnailHealing ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                {
                    settings.enableAutoThumbnailHealing && (
                        <div className="mb-6 ml-4 space-y-5 border-l-2 border-gray-100 pl-4 animate-in fade-in duration-150 motion-reduce:animate-none dark:border-white/10">
                            <div
                                onClick={() => {
                                    const newValue = !settings.enforceHighQualityThumbnails;
                                    setSettings(prev => ({ ...prev, enforceHighQualityThumbnails: newValue }));
                                    addToast(newValue ? t('High quality enforcement enabled') : t('High quality enforcement disabled'), 'success');
                                }}
                                className="flex items-center justify-between cursor-pointer group"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-300 group-hover:text-sage-500 transition-colors">{t('Upgrade Existing Thumbnails')}</div>
                                        <span className="rounded bg-ember-100 px-1.5 py-0.5 text-[10px] font-bold text-ember-600 dark:bg-ember-500/15 dark:text-ember-300">{t('Slow')}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">{t('Re-generate "fast" or external thumbnails with high-quality versions')}</div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.enforceHighQualityThumbnails}
                                    aria-label={t('Upgrade Existing Thumbnails')}
                                    className={`relative h-6 w-10 rounded-full transition-colors ${settings.enforceHighQualityThumbnails ? 'bg-sage-600' : 'bg-gray-200 dark:bg-white/10'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.enforceHighQualityThumbnails ? 'left-5' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-300">{t('Background Speed')}</div>
                                        <InfoTooltip
                                            label={t('About background thumbnail speed')}
                                            content={t('Quiet minimizes CPU use. Balanced uses moderate parallelism. Fast prioritizes completion speed and may reduce responsiveness while it runs.')}
                                        />
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">{t('Controls CPU use while Dvoyna Vault is idle')}</div>
                                </div>
                                <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-0.5">
                                    {THUMBNAIL_PROFILE_OPTIONS.map(option => {
                                        const isActive = (settings.thumbnailOptimizationProfile ?? 'balanced') === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, thumbnailOptimizationProfile: option.id }));
                                                    addToast(t('Thumbnail speed set to {{label}}', { label: t(option.label) }), 'success');
                                                }}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${isActive
                                                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                {t(option.label)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-white/10 pt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-300">{t('Smart Thumbnail Status')}</div>
                                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300">{t(smartThumbnailStatus)}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                    {showLastThumbnailRun && lastThumbnailRun && (
                                        <span>{t('Last run')} {formatDuration(lastThumbnailRun.durationMs)}</span>
                                    )}
                                    <span>{t('Speed')} {formatRate(getThumbnailMetricValue(thumbnailDetails, lastThumbnailRun, 'imagesPerSecond'))}</span>
                                    <span>{t('Optimized')} {formatNumber(getThumbnailMetricValue(thumbnailDetails, lastThumbnailRun, 'optimized'))}</span>
                                    <span>{t('Reused')} {formatNumber(getThumbnailMetricValue(thumbnailDetails, lastThumbnailRun, 'reused'))}</span>
                                    <span>{t('Failed')} {formatNumber(failedThumbnailCount)}</span>
                                    <span>{t('Skipped')} {formatNumber(getThumbnailMetricValue(thumbnailDetails, lastThumbnailRun, 'skipped'))}</span>
                                </div>
                                <div className="mt-3">
                                    <button
                                        type="button"
                                        onClick={handleToggleFailures}
                                        className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${hasKnownThumbnailFailures
                                            ? 'text-ember-600 hover:text-ember-600 dark:text-ember-300 dark:hover:text-ember-300'
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        {failurePanelOpen ? t('Hide failures') : (hasKnownThumbnailFailures ? t('View failures') : t('Check failures'))}
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${failurePanelOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {failurePanelOpen && (
                                        <div className="mt-3 space-y-3 border-l border-ember-200 dark:border-ember-400/20 pl-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('Recent thumbnail failures')}</div>
                                                <button
                                                    type="button"
                                                    onClick={handleRetryFailedThumbnails}
                                                    disabled={!canRetryThumbnailFailures}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-sage-600 dark:hover:text-sage-300 disabled:opacity-50 disabled:hover:text-gray-700 dark:disabled:hover:text-gray-200 transition-colors"
                                                >
                                                    {isRetryingFailures ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    )}
                                                    {t('Retry all')}</button>
                                            </div>

                                            {failureLoadState === 'loading' && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    {t('Loading failures...')}</div>
                                            )}

                                            {failureLoadState === 'error' && (
                                                <div className="text-xs text-ember-600 dark:text-ember-300">
                                                    {t('Failed to load thumbnail failures:')} {failureLoadError}
                                                </div>
                                            )}

                                            {failureLoadState === 'ready' && thumbnailFailures.length === 0 && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('No thumbnail failures found.')}</div>
                                            )}

                                            {failureLoadState === 'ready' && thumbnailFailures.length > 0 && (
                                                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                                    {thumbnailFailures.map(failure => (
                                                        <div key={failure.id} className="text-xs">
                                                            <div className="font-medium text-gray-800 dark:text-gray-200 truncate" title={failure.path}>
                                                                {getFileNameFromPath(failure.path)}
                                                            </div>
                                                            <div className="text-gray-500 dark:text-gray-400 break-all">{failure.path}</div>
                                                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-400">
                                                                <span>{t('Attempts')} {formatNumber(failure.failureCount)}</span>
                                                                <span>{t(formatAttemptTime(failure.lastAttemptAt))}</span>
                                                                <span className="text-ember-600 dark:text-ember-300">{failure.lastError ?? t('Unknown error')}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                <div className="border-t border-gray-100 dark:border-white/5 pt-6">
                    <div
                        onClick={handleConfirmDeleteToggle}
                        className="flex items-center justify-between cursor-pointer group"
                    >
                        <div>
                            <div className="text-base font-medium text-gray-900 dark:text-gray-200 group-hover:text-sage-500 transition-colors">{t('Confirm Deletions')}</div>
                            <div className="text-sm text-gray-500">{t('Show a warning before removing files from Dvoyna Vault while keeping them on disk')}</div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.confirmDelete}
                            aria-label={t('Confirm Deletions')}
                            className={`w-12 h-7 rounded-full relative transition-colors ${settings.confirmDelete ? 'bg-sage-600' : 'bg-gray-200 dark:bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.confirmDelete ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

            </section >
        </div >
    );
});
