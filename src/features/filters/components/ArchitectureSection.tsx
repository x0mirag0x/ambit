import * as React from 'react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { FilterState } from '../../../types';
import { SectionHeader, SelectableRow, SearchInput } from './FilterPrimitives';
import { formatModelName } from '../../../utils/formatUtils';
import { TooltipButton } from '../../../components/ui/InfoTooltip';
import { localizeFilterSentinel } from '../filterLabels';
import { useTranslation } from 'react-i18next';

export interface ModelFilterOption {
    name: string;
    count?: number;
}

const SEARCH_BOX_THRESHOLD = 8;

const normalizeModelOption = (model: string | ModelFilterOption): ModelFilterOption => (
    typeof model === 'string' ? { name: model } : model
);

interface ArchitectureSectionProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    models: Array<string | ModelFilterOption>;
    isOpen: boolean;
    onToggle: () => void;
}

export const ArchitectureSection: React.FC<ArchitectureSectionProps> = ({
    filters,
    setFilters,
    models,
    isOpen,
    onToggle
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const modelOptions = models.map(normalizeModelOption);
    const showSearch = modelOptions.length > SEARCH_BOX_THRESHOLD || isSearchOpen;

    const toggleModel = (model: string) => {
        setFilters(prev => {
            const newModels = prev.models.includes(model)
                ? prev.models.filter(m => m !== model)
                : [...prev.models, model];
            return { ...prev, models: newModels };
        });
    };

    const filteredModels = modelOptions.filter(model => {
        const display = localizeFilterSentinel(formatModelName(model.name) || model.name, t);
        const term = searchQuery.toLowerCase();
        return !term || model.name.toLowerCase().includes(term) || display.toLowerCase().includes(term);
    });

    return (
        <div className="space-y-2">
            <SectionHeader
                title={t('Model')}
                isOpen={isOpen}
                onToggle={onToggle}
                action={isOpen && modelOptions.length <= SEARCH_BOX_THRESHOLD && (
                    <TooltipButton
                        label={isSearchOpen ? t('Hide Model Search') : t('Search Models')}
                        content={isSearchOpen ? t('Hide Model Search') : t('Search Models')}
                        onClick={(e) => { e.stopPropagation(); setIsSearchOpen(!isSearchOpen); }}
                        aria-expanded={isSearchOpen}
                        className={`p-1 rounded ${isSearchOpen ? 'text-sage-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Search className="w-3 h-3" />
                    </TooltipButton>
                )}
            />
            {isOpen && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300 ease-spring">
                    {showSearch && (
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={t('Search models...')}
                            className="px-1 pb-1"
                        />
                    )}
                    <div className={`space-y-1 ${filteredModels.length > SEARCH_BOX_THRESHOLD ? 'max-h-48 overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                        {filteredModels.map(model => {
                            const display = localizeFilterSentinel(formatModelName(model.name) || model.name, t);
                            return (
                            <SelectableRow
                                key={model.name}
                                label={display}
                                detail={model.count === undefined ? undefined : String(model.count)}
                                isSelected={filters.models.includes(model.name)}
                                onClick={() => toggleModel(model.name)}
                            />
                            );
                        })}
                        {filteredModels.length === 0 && (
                            <div className="text-xs text-gray-400 text-center py-2 italic">{t('No models found')}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
