import * as React from 'react';
import { FilterState } from '../../../types';
import { useTranslation } from 'react-i18next';

interface ColorFilterSectionProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export const ColorFilterSection: React.FC<ColorFilterSectionProps> = ({ filters, setFilters }) => {
    const { t } = useTranslation();
    const color = filters.similarColor ?? '#e8c46e';

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">{t('Color')}</h3>
                {filters.similarColor ? (
                    <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, similarColor: undefined }))}
                        className="text-[10px] font-semibold text-sage-600 hover:text-sage-500 dark:text-sage-300"
                    >
                        {t('Clear color filter')}
                    </button>
                ) : null}
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <input
                    type="color"
                    aria-label={t('Similar color')}
                    value={color}
                    onChange={event => setFilters(prev => ({ ...prev, similarColor: event.target.value }))}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs text-gray-600 dark:text-zinc-300">{filters.similarColor ?? t('Similar color')}</span>
            </label>
        </section>
    );
};
