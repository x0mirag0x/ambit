import * as React from 'react';
import { FilterX, Heart, Lock, Pin, X } from 'lucide-react';
import { FilterState } from '../../../types';
import { useCollections } from '../../../contexts/CollectionContext';
import { useSearch } from '../../../contexts/SearchContext';
import { getDateFilterLabel } from '../../../utils/dateFilters';
import { getEffectiveImageKind } from '../../../utils/filterState';
import { useTranslation } from 'react-i18next';

interface ActiveFiltersProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    clearAllFilters: () => void;
}

const FILTER_CHIP_LABEL_CLASS = 'truncate max-w-[min(32ch,calc(100cqw-3rem))]';
const WIDE_FILTER_CHIP_LABEL_CLASS = 'truncate max-w-[min(40ch,calc(100cqw-3rem))]';

const hasChipVisibleCriteria = (filters: FilterState, dateLabel: string | null, includeNavigationRules = false) => (
    (includeNavigationRules && (
        !!filters.searchQuery?.trim() ||
        getEffectiveImageKind(filters) !== 'all' ||
        (!!filters.mediaType && filters.mediaType !== 'all')
    )) ||
    !!dateLabel ||
    filters.favoritesOnly ||
    !!filters.pinnedOnly ||
    (filters.models?.length ?? 0) > 0 ||
    (filters.tools?.length ?? 0) > 0 ||
    (filters.loras?.length ?? 0) > 0 ||
    (filters.embeddings?.length ?? 0) > 0 ||
    (filters.hypernetworks?.length ?? 0) > 0 ||
    (filters.samplers?.length ?? 0) > 0 ||
    (filters.generationTypes?.length ?? 0) > 0 ||
    (filters.controlNets?.length ?? 0) > 0 ||
    (filters.ipAdapters?.length ?? 0) > 0 ||
    filters.minSteps !== undefined ||
    filters.maxSteps !== undefined ||
    filters.minCfg !== undefined ||
    filters.maxCfg !== undefined
);

export const ActiveFilters: React.FC<ActiveFiltersProps> = () => {
    // Context Access
    const { t } = useTranslation();
    const { filters, setFilters, clearAllFilters } = useSearch();
    const { collections, smartCollections, isLoaded: collectionsLoaded } = useCollections();
    const allCols = React.useMemo(() => [...collections, ...smartCollections], [collections, smartCollections]);
    const activeCollection = filters.collectionId ? allCols.find(collection => collection.id === filters.collectionId) : undefined;
    const activeSmartCol = filters.collectionId ? smartCollections.find(collection => collection.id === filters.collectionId) : undefined;
    const hasUnavailableCollection = collectionsLoaded && !!filters.collectionId && !activeCollection;
    const showFavoritesFilter = filters.favoritesOnly && !activeSmartCol?.filters?.favoritesOnly;
    const showPinnedFilter = !!filters.pinnedOnly && !activeSmartCol?.filters?.pinnedOnly;
    const localizeDateFilterLabel = (label: string) => {
        if (label === 'Date: Today' || label === 'Date: Week' || label === 'Date: Month') return t(label);
        if (label.startsWith('Date: ')) return t('Date: {{value}}', { value: label.slice(6) });
        return t(label);
    };
    const dateFilterLabel = getDateFilterLabel(filters);
    const smartDateFilterLabel = activeSmartCol?.filters ? getDateFilterLabel(activeSmartCol.filters) : null;
    const smartSourceKind = activeSmartCol?.filters ? getEffectiveImageKind(activeSmartCol.filters) : 'all';

    // Merge visible filters with smart collection implicit filters for display
    const hasActiveFilters = hasChipVisibleCriteria(filters, dateFilterLabel) ||
        hasUnavailableCollection ||
        (!!activeSmartCol?.filters && hasChipVisibleCriteria(activeSmartCol.filters, smartDateFilterLabel, true));
    // Deduplicate logic: Filter out manual chips that are already in the smart collection
    const smartModels = activeSmartCol?.filters?.models || [];
    const smartTools = activeSmartCol?.filters?.tools || [];
    const smartLoras = activeSmartCol?.filters?.loras || [];
    const smartEmbeddings = activeSmartCol?.filters?.embeddings || [];
    const smartHypernetworks = activeSmartCol?.filters?.hypernetworks || [];
    const smartSamplers = activeSmartCol?.filters?.samplers || [];
    const smartGenTypes = activeSmartCol?.filters?.generationTypes || [];
    const smartControlNets = activeSmartCol?.filters?.controlNets || [];
    const smartIpAdapters = activeSmartCol?.filters?.ipAdapters || [];

    const visibleModels = Array.from(new Set(filters.models)).filter(m => !smartModels.includes(m));
    const visibleTools = Array.from(new Set(filters.tools)).filter(t => !smartTools.includes(t));
    const visibleLoras = Array.from(new Set(filters.loras)).filter(l => !smartLoras.includes(l));
    const visibleEmbeddings = Array.from(new Set(filters.embeddings)).filter(e => !smartEmbeddings.includes(e));
    const visibleHypernetworks = Array.from(new Set(filters.hypernetworks)).filter(h => !smartHypernetworks.includes(h));
    const visibleSamplers = Array.from(new Set(filters.samplers || [])).filter(s => !smartSamplers.includes(s));
    const visibleGenTypes = Array.from(new Set(filters.generationTypes || [])).filter(g => !smartGenTypes.includes(g));
    const visibleControlNets = Array.from(new Set(filters.controlNets || [])).filter(c => !smartControlNets.includes(c));
    const visibleIpAdapters = Array.from(new Set(filters.ipAdapters || [])).filter(i => !smartIpAdapters.includes(i));

    if (!hasActiveFilters) return null;

    return (
        <div className="mt-2 flex items-center gap-3 overflow-hidden px-6 py-2 min-h-[44px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-500 mx-2 relative z-10">
            {/* Floating style with margin and rounding */}

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto custom-scrollbar [container-type:inline-size] [&>*]:shrink-0">

            {hasUnavailableCollection && (
                <div
                    title={t('Selected collection is unavailable')}
                    className="flex items-center gap-1 rounded-full border border-ember-200 bg-ember-100 px-2 py-0.5 text-xs text-ember-600 dark:border-ember-500/30 dark:bg-ember-500/15 dark:text-ember-300"
                >
                    <span className={WIDE_FILTER_CHIP_LABEL_CLASS}>
                        {t('Collection unavailable')}</span>
                    <button
                        type="button"
                        aria-label={t('Clear Unavailable Collection Filter')}
                        onClick={() => setFilters(f => ({ ...f, collectionId: null }))}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Smart Collection Implicit Filters (Locked) */}
            {activeSmartCol && activeSmartCol.filters && (
                <>
                    {activeSmartCol.filters.models?.map(m => (
                        <div key={`smart-model-${m}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{m}}', { m: m })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{m}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.tools?.map(tool => (
                        <div key={`smart-tool-${tool}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{tool}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.searchQuery && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span className={WIDE_FILTER_CHIP_LABEL_CLASS}>"{activeSmartCol.filters.searchQuery}"</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {activeSmartCol.filters.mediaType && activeSmartCol.filters.mediaType !== 'all' && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('Media:')} {activeSmartCol.filters.mediaType === 'video' ? t('Videos') : t('Images')}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {smartDateFilterLabel && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{localizeDateFilterLabel(smartDateFilterLabel)}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {smartSourceKind !== 'all' && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('Kind:')} {smartSourceKind === 'photograph' ? t('Photos') : smartSourceKind[0].toUpperCase() + smartSourceKind.slice(1)}</span>
                            <Lock aria-hidden className="w-3 h-3" />
                        </div>
                    )}
                    {activeSmartCol.filters.favoritesOnly && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('Favorites')}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {activeSmartCol.filters.pinnedOnly && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('Pinned')}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {activeSmartCol.filters.loras?.map(l => (
                        <div key={`smart-lora-${l}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{l}}', { l: l })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{l}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.embeddings?.map(e => (
                        <div key={`smart-emb-${e}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{e}}', { e: e })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{e}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.hypernetworks?.map(h => (
                        <div key={`smart-hyper-${h}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{h}}', { h: h })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{h}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.samplers?.map(s => (
                        <div key={`smart-sampler-${s}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{s}}', { s: s })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{s}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.generationTypes?.map(g => (
                        <div key={`smart-gentype-${g}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{g}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.controlNets?.map(c => (
                        <div key={`smart-cn-${c}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{c}}', { c: c })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{c}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {activeSmartCol.filters.ipAdapters?.map(i => (
                        <div key={`smart-ip-${i}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Rule: {{i}}', { i: i })}>
                            <span className={FILTER_CHIP_LABEL_CLASS}>{i}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    ))}
                    {(activeSmartCol.filters.minSteps !== undefined || activeSmartCol.filters.maxSteps !== undefined) && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('Steps:')} {activeSmartCol.filters.minSteps ?? 0}-{activeSmartCol.filters.maxSteps ?? '∞'}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                    {(activeSmartCol.filters.minCfg !== undefined || activeSmartCol.filters.maxCfg !== undefined) && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs border border-gray-200 dark:border-zinc-700 opacity-80 cursor-not-allowed" title={t('Smart Collection Rule')}>
                            <span>{t('CFG:')} {activeSmartCol.filters.minCfg ?? 0}-{activeSmartCol.filters.maxCfg ?? '∞'}</span>
                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">🔒</div>
                        </div>
                    )}
                </>
            )}

            {dateFilterLabel && (
                <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span>{localizeDateFilterLabel(dateFilterLabel)}</span>
                    <button type="button" aria-label={t('Clear Date Filter')} onClick={() => setFilters(f => ({ ...f, dateRange: 'all', dateFrom: undefined, dateTo: undefined }))}><X className="w-3 h-3" /></button>
                </div>
            )}

            {showFavoritesFilter && (
                <div className="flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
                    <Heart aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
                    <span>{t('Favorites')}</span>
                    <button type="button" aria-label={t('Clear Favorites Filter')} onClick={() => setFilters(f => ({ ...f, favoritesOnly: false }))}><X className="w-3 h-3" /></button>
                </div>
            )}

            {showPinnedFilter && (
                <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <Pin aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
                    <span>{t('Pinned')}</span>
                    <button type="button" aria-label={t('Clear Pinned Filter')} onClick={() => setFilters(f => ({ ...f, pinnedOnly: false }))}><X className="w-3 h-3" /></button>
                </div>
            )}

            {visibleModels.map(m => (
                <div key={m} title={m} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{m}</span>
                    <button type="button" aria-label={t('Clear Model Filter {{m}}', { m: m })} onClick={() => setFilters(f => ({ ...f, models: f.models.filter(x => x !== m) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleTools.map(tool => (
                <div key={tool} title={tool} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span>{tool}</span>
                    <button type="button" aria-label={t('Clear Tool Filter {{tool}}', { tool })} onClick={() => setFilters(f => ({ ...f, tools: f.tools.filter(x => x !== tool) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleLoras.map(l => (
                <div key={l} title={l} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{l}</span>
                    <button type="button" aria-label={t('Clear LoRA Filter {{l}}', { l: l })} onClick={() => setFilters(f => ({ ...f, loras: f.loras.filter(x => x !== l) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleEmbeddings.map(e => (
                <div key={e} title={e} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{e}</span>
                    <button type="button" aria-label={t('Clear Embedding Filter {{e}}', { e: e })} onClick={() => setFilters(f => ({ ...f, embeddings: f.embeddings.filter(x => x !== e) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleHypernetworks.map(h => (
                <div key={h} title={h} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{h}</span>
                    <button type="button" aria-label={t('Clear Hypernetwork Filter {{h}}', { h: h })} onClick={() => setFilters(f => ({ ...f, hypernetworks: f.hypernetworks.filter(x => x !== h) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleSamplers.map(s => (
                <div key={s} title={s} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{s}</span>
                    <button type="button" aria-label={t('Clear Sampler Filter {{s}}', { s: s })} onClick={() => setFilters(f => ({ ...f, samplers: (f.samplers || []).filter(x => x !== s) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleGenTypes.map(g => (
                <div key={g} title={g} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span>{g}</span>
                    <button type="button" aria-label={t('Clear Generation Type Filter {{g}}', { g: g })} onClick={() => setFilters(f => ({ ...f, generationTypes: (f.generationTypes || []).filter(x => x !== g) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleControlNets.map(c => (
                <div key={c} title={c} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{c}</span>
                    <button type="button" aria-label={t('Clear ControlNet Filter {{c}}', { c: c })} onClick={() => setFilters(f => ({ ...f, controlNets: (f.controlNets || []).filter(x => x !== c) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {visibleIpAdapters.map(i => (
                <div key={i} title={i} className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span className={FILTER_CHIP_LABEL_CLASS}>{i}</span>
                    <button type="button" aria-label={t('Clear IP-Adapter Filter {{i}}', { i: i })} onClick={() => setFilters(f => ({ ...f, ipAdapters: (f.ipAdapters || []).filter(x => x !== i) }))}><X className="w-3 h-3" /></button>
                </div>
            ))}

            {(filters.minSteps !== undefined || filters.maxSteps !== undefined) && (
                <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span>{t('Steps:')} {filters.minSteps ?? 0}-{filters.maxSteps ?? '∞'}</span>
                    <button type="button" aria-label={t('Clear Steps Filter')} onClick={() => setFilters(f => ({ ...f, minSteps: undefined, maxSteps: undefined }))}><X className="w-3 h-3" /></button>
                </div>
            )}

            {(filters.minCfg !== undefined || filters.maxCfg !== undefined) && (
                <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <span>{t('CFG:')} {filters.minCfg ?? 0}-{filters.maxCfg ?? '∞'}</span>
                    <button type="button" aria-label={t('Clear CFG Filter')} onClick={() => setFilters(f => ({ ...f, minCfg: undefined, maxCfg: undefined }))}><X className="w-3 h-3" /></button>
                </div>
            )}
            </div>

            <button
                type="button"
                onClick={clearAllFilters}
                className="shrink-0 whitespace-nowrap text-xs text-sage-600 dark:text-sage-300 hover:text-sage-600 dark:hover:text-sage-300 font-medium flex items-center gap-1 transition-colors"
            >
                <FilterX className="w-3 h-3" /> {t('Clear filters')}</button>
        </div>
    );
};
