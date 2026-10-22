import * as React from 'react';
import { FilterState, GeneratorTool } from '../../../types';
import { SectionHeader, SelectableRow } from './FilterPrimitives';
import { localizeFilterSentinel } from '../filterLabels';
import { generatorToolKey, uniqueGeneratorToolNames } from '../../../utils/generatorTools';
import { useTranslation } from 'react-i18next';

const toolKeysMatch = (left: string, right: string) => generatorToolKey(left) === generatorToolKey(right);

interface GeneratorSectionProps {
    filters: FilterState;
    setFilters: (update: (prev: FilterState) => FilterState) => void;
    tools: string[];
    isOpen: boolean;
    onToggle: () => void;
    isLoading?: boolean;
    /**
     * Valid tool names for drill-down filtering.
     * - null/undefined: Show all tools (no drill-down filtering active)
     * - string[]: Only show tools in this list (+ always show selected tools)
     */
    validNames?: string[] | null;
}

export const GeneratorSection: React.FC<GeneratorSectionProps> = ({
    filters,
    setFilters,
    tools,
    isOpen,
    onToggle,
    isLoading,
    validNames
}) => {
    const { t } = useTranslation();
    const visibleTools = React.useMemo(() => uniqueGeneratorToolNames(tools), [tools]);
    const toggleTool = (tool: string) => {
        setFilters(prev => {
            const selected = prev.tools.some(item => toolKeysMatch(item, tool));
            const newTools = selected
                ? prev.tools.filter(item => !toolKeysMatch(item, tool))
                : [...prev.tools, tool as GeneratorTool];
            return { ...prev, tools: newTools };
        });
    };

    // Determine availability based on validNames (cross-category drill-down)
    const isToolAvailable = React.useCallback((tool: string): boolean => {
        // Always available if no validNames filtering is active
        if (validNames === null || validNames === undefined) return true;
        // Always available if currently selected (Disjunctive: self-selected are always valid)
        if (filters.tools.some(item => toolKeysMatch(item, tool))) return true;
        // Otherwise, check if in validNames, ignoring case and surrounding whitespace
        return validNames.some(name => toolKeysMatch(name, tool));
    }, [validNames, filters.tools]);

    return (
        <div className="space-y-2">
            <SectionHeader title={t('Generator')} isOpen={isOpen} onToggle={onToggle} isLoading={isLoading} />
            {isOpen && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300 ease-spring">
                    {visibleTools.length > 0 ? visibleTools.map(tool => {
                        const available = isToolAvailable(tool);
                        return (
                            <SelectableRow
                                key={tool}
                                label={localizeFilterSentinel(tool, t)}
                                isSelected={filters.tools.some(item => toolKeysMatch(item, tool))}
                                onClick={() => toggleTool(tool as GeneratorTool)}
                                className={available ? '' : 'opacity-40 line-through'}
                                disabled={!available}
                            />
                        );
                    }) : isLoading ? (
                        <div className="flex flex-col items-center justify-center py-4 space-y-3 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                            <div className="w-4 h-4 border-2 border-sage-500/30 border-t-sage-500 rounded-full animate-spin" />
                            <span className="text-[10px] text-gray-400 font-medium animate-pulse">{t('Loading Tools...')}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 text-center py-2 italic border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                            {validNames !== null && validNames !== undefined ? t('No matching tools in current filter') : t('No specific tools found')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
