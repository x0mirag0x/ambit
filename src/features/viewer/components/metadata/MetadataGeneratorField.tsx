import * as React from 'react';
import { AppWindow, Check, Pencil } from 'lucide-react';
import { GeneratorTool } from '../../../../types';
import { MetadataField } from './MetadataField';
import { useTranslation } from 'react-i18next';
import {
    collapseGeneratorWhitespace,
    generatorToolKey,
    listCustomGeneratorTools,
    resolveGeneratorToolName,
} from '../../../../utils/generatorTools';
import { getGeneratorToolOptions, getServerGeneratorToolOptions, subscribeGeneratorToolOptions } from '../../../../utils/generatorToolOptions';

interface MetadataGeneratorFieldProps {
    value: GeneratorTool;
    source?: string;
    modified?: boolean;
    onSave?: (value: GeneratorTool) => void;
}

const CUSTOM_GENERATOR_SENTINEL = '\u0000custom-generator';

const STANDARD_GENERATOR_TOOLS = Object.values(GeneratorTool).filter(
    tool => tool !== GeneratorTool.OTHER && tool !== GeneratorTool.UNKNOWN
);

const generatorOptionLabel = (tool: string, translate: (key: string) => string): string => (
    tool === GeneratorTool.UNKNOWN || tool === GeneratorTool.OTHER
        ? translate(tool)
        : collapseGeneratorWhitespace(tool)
);

export const MetadataGeneratorField: React.FC<MetadataGeneratorFieldProps> = ({
    value,
    source,
    modified,
    onSave,
}) => {
    const { t } = useTranslation();
    const knownNames = React.useSyncExternalStore(
        subscribeGeneratorToolOptions,
        getGeneratorToolOptions,
        getServerGeneratorToolOptions
    );
    const [isEditing, setIsEditing] = React.useState(false);
    const [isCustom, setIsCustom] = React.useState(false);
    const [customDraft, setCustomDraft] = React.useState('');
    const [draft, setDraft] = React.useState(value);
    const editorRef = React.useRef<HTMLDivElement>(null);
    const customInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setDraft(value);
        setCustomDraft('');
        setIsCustom(false);
        setIsEditing(false);
    }, [value]);

    const cancel = React.useCallback(() => {
        setDraft(value);
        setCustomDraft('');
        setIsCustom(false);
        setIsEditing(false);
    }, [value]);

    React.useEffect(() => {
        if (!isEditing) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (!editorRef.current?.contains(event.target as Node)) cancel();
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [cancel, isEditing]);

    const optionValues = React.useMemo(() => {
        const customOptions = listCustomGeneratorTools([...knownNames, value, draft]);
        return [
            ...STANDARD_GENERATOR_TOOLS,
            ...customOptions,
            // Existing photos keep the stored Other sentinel. New choices use Custom generator… instead.
            ...(value === GeneratorTool.OTHER ? [GeneratorTool.OTHER] : []),
            GeneratorTool.UNKNOWN,
        ];
    }, [draft, knownNames, value]);

    const selectedValue = optionValues.find(option => generatorToolKey(option) === generatorToolKey(draft)) ?? draft;
    const resolvedCustom = resolveGeneratorToolName(customDraft, [...knownNames, value]);
    const readLabel = generatorOptionLabel(resolveGeneratorToolName(value, knownNames) ?? value, t);

    const save = () => {
        const raw = isCustom ? customDraft : selectedValue;
        const resolved = isCustom ? resolvedCustom : resolveGeneratorToolName(raw, [...knownNames, value]);
        if (!resolved) return;
        if (resolved !== value) onSave?.(resolved as GeneratorTool);
        setIsCustom(false);
        setIsEditing(false);
    };

    const chooseCustom = () => {
        setCustomDraft('');
        setIsCustom(true);
        requestAnimationFrame(() => customInputRef.current?.focus());
    };

    return (
        <MetadataField label={t('Generator software')} icon={AppWindow} source={source} modified={modified}>
            <div ref={editorRef} className="group relative">
                {onSave && !isEditing ? (
                    <button type="button" aria-label={t('Edit Generation Tool')} onClick={() => setIsEditing(true)} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 opacity-0 transition-opacity hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                ) : null}
                {isEditing ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-white/10 dark:bg-black/20">
                        {isCustom ? (
                            <input
                                ref={customInputRef}
                                aria-label={t('Custom generator name')}
                                value={customDraft}
                                onChange={event => setCustomDraft(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancel();
                                    } else if (event.key === 'Enter') {
                                        event.preventDefault();
                                        save();
                                    }
                                }}
                                placeholder={t('Enter generator name…')}
                                autoFocus
                                className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-900 outline-none focus:border-sage-500 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                            />
                        ) : (
                            <select aria-label={t('Generator software')} value={selectedValue} onChange={event => {
                                const next = event.target.value;
                                if (next === CUSTOM_GENERATOR_SENTINEL) {
                                    chooseCustom();
                                    return;
                                }
                                setDraft(next as GeneratorTool);
                            }} onKeyDown={event => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancel();
                                }
                            }} autoFocus className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-900 outline-none focus:border-sage-500 dark:border-white/10 dark:bg-zinc-900 dark:text-white">
                                {optionValues.map(tool => (
                                    <option key={tool} value={tool}>{generatorOptionLabel(tool, t)}</option>
                                ))}
                                <option value={CUSTOM_GENERATOR_SENTINEL}>{t('Custom generator…')}</option>
                            </select>
                        )}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancel} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white">{t('Cancel')}</button>
                            <button type="button" onClick={save} disabled={isCustom && !resolvedCustom} className="flex items-center gap-1 rounded bg-sage-600 px-2 py-1 text-xs text-white hover:bg-sage-500 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-3 w-3" /> {t('Save')}</button>
                        </div>
                    </div>
                ) : (
                    <div title={readLabel} className="w-full truncate rounded-lg border border-gray-200 bg-gray-50 p-2.5 pr-9 text-sm font-medium text-gray-700 dark:border-white/10 dark:bg-black dark:text-zinc-200">{readLabel}</div>
                )}
            </div>
        </MetadataField>
    );
};
