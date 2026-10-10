import * as React from 'react';
import { normalizeSampler } from '../../../utils/samplerUtils';
import { FilterState } from '../../../types';
import { SectionHeader, FilterSlider, MultiSelectDropdown, ChipSelect } from './FilterPrimitives';
import { generationTypeLabel } from '../filterLabels';
import { useParameterRangesQuery } from '../../../hooks/useParameterRangesQuery';
import { useTranslation } from 'react-i18next';

interface ParameterSectionProps {
    filters: FilterState;
    setFilters: (update: (prev: FilterState) => FilterState) => void;
    isOpen: boolean;
    onToggle: () => void;
}

const groupSamplers = (samplers: string[]) => {
    const groups: Record<string, string[]> = {
        'Euler': [],
        'DPM': [],
        'LMS': [],
        'Heun': [],
        'DDIM': [],
        'UniPC': [],
        'Deis': [],
        'Other': []
    };

    // Use a Set to keep track of unique canonical names per group
    const canonicalSeen = new Set<string>();

    samplers.forEach(s => {
        const canonical = normalizeSampler(s);
        if (canonicalSeen.has(canonical)) return;
        canonicalSeen.add(canonical);

        const lower = canonical.toLowerCase();
        if (lower.includes('euler')) groups['Euler'].push(canonical);
        else if (lower.includes('dpm')) groups['DPM'].push(canonical);
        else if (lower.includes('lms')) groups['LMS'].push(canonical);
        else if (lower.includes('heun')) groups['Heun'].push(canonical);
        else if (lower.includes('ddim')) groups['DDIM'].push(canonical);
        else if (lower.includes('unipc') || lower.includes('uni pc')) groups['UniPC'].push(canonical);
        else if (lower.includes('deis')) groups['Deis'].push(canonical);
        else groups['Other'].push(canonical);
    });

    return Object.entries(groups)
        .map(([label, items]) => ({ label, items: items.sort() }))
        .filter(g => g.items.length > 0)
        .sort((a, b) => (
            ['DDIM', 'Deis', 'DPM', 'Euler', 'Heun', 'LMS', 'UniPC', 'Other'].indexOf(a.label)
            - ['DDIM', 'Deis', 'DPM', 'Euler', 'Heun', 'LMS', 'UniPC', 'Other'].indexOf(b.label)
        ));
};

export const ParameterSection: React.FC<ParameterSectionProps> = ({
    filters,
    setFilters,
    isOpen,
    onToggle
}) => {
    const { t } = useTranslation();
    const { data: ranges, isLoading } = useParameterRangesQuery(filters);

    // Check if any parameters have data to show
    const hasSteps = ranges?.steps !== null && ranges?.steps !== undefined;
    const hasCfg = ranges?.cfg !== null && ranges?.cfg !== undefined;
    const hasSamplers = ranges?.samplers && ranges.samplers.length > 0;
    const hasGenTypes = ranges?.generationTypes && ranges.generationTypes.length > 0;

    const hasAnyData = hasSteps || hasCfg || hasSamplers || hasGenTypes;

    // If loading or no data, show appropriate state
    if (!isOpen) {
        return (
            <div className="space-y-2">
                <SectionHeader title={t('Parameters')} isOpen={isOpen} onToggle={onToggle} isLoading={isLoading} />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <SectionHeader title={t('Parameters')} isOpen={isOpen} onToggle={onToggle} isLoading={isLoading} />
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300 ease-spring px-4 pt-2">
                {!hasAnyData && !isLoading && (
                    <div className="text-xs text-gray-400 text-center py-4 italic border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                        {t('No parameter data available')}</div>
                )}

                {/* Steps Slider - only if data exists */}
                {hasSteps && ranges?.steps && (
                    <FilterSlider
                        label={t('Steps')}
                        min={Math.floor(ranges.steps.min)}
                        max={Math.ceil(ranges.steps.max)}
                        minValue={filters.minSteps}
                        maxValue={filters.maxSteps}
                        onChange={(min, max) => setFilters(prev => ({ ...prev, minSteps: min, maxSteps: max }))}
                    />
                )}

                {/* CFG Scale Slider - only if data exists */}
                {hasCfg && ranges?.cfg && (
                    <FilterSlider
                        label={t('CFG Scale')}
                        min={Math.floor(ranges.cfg.min)}
                        max={Math.ceil(ranges.cfg.max)}
                        step={0.5}
                        minValue={filters.minCfg}
                        maxValue={filters.maxCfg}
                        onChange={(min, max) => setFilters(prev => ({ ...prev, minCfg: min, maxCfg: max }))}
                    />
                )}

                {/* Sampler Filter - only if samplers exist */}
                {hasSamplers && ranges?.samplers && (
                    <MultiSelectDropdown
                        label={t('Sampler')}
                        groups={groupSamplers(ranges.samplers)}
                        selected={filters.samplers || []}
                        onChange={(samplers) => setFilters(prev => ({ ...prev, samplers }))}
                        placeholder={t('Search samplers...')}
                    />
                )}

                {/* Generation Type Filter - uses disjunctive query (won't self-filter) */}
                {ranges?.generationTypes && ranges.generationTypes.length > 0 && (
                    <ChipSelect
                        label={t('Generation Type')}
                        options={ranges.generationTypes}
                        selected={filters.generationTypes || []}
                        onChange={(generationTypes) => setFilters(prev => ({ ...prev, generationTypes }))}
                        formatLabel={(type) => t(generationTypeLabel(type))}
                    />
                )}
            </div>
        </div>
    );
};
