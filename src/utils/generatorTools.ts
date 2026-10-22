import { GeneratorTool } from '../types';

/** Collapse edges and repeated whitespace so " Krea  " and "Krea" compare as one name. */
export const collapseGeneratorWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const generatorToolKey = (value: string): string => collapseGeneratorWhitespace(value).toLocaleLowerCase();

const builtinGeneratorTools = Object.values(GeneratorTool);

const builtinByKey = new Map(builtinGeneratorTools.map(tool => [generatorToolKey(tool), tool]));

/** Russian labels of the legacy sentinels, so typing them does not create a second filter row. */
const translatedBuiltinAliases = new Map<string, GeneratorTool>([
    [generatorToolKey('Другое'), GeneratorTool.OTHER],
    [generatorToolKey('Неизвестно'), GeneratorTool.UNKNOWN],
]);

export const canonicalBuiltinGeneratorTool = (value: string): GeneratorTool | undefined => {
    const key = generatorToolKey(value);
    return builtinByKey.get(key) ?? translatedBuiltinAliases.get(key);
};

export const isPersistedGeneratorFilterValue = (value: unknown): boolean =>
    typeof value === 'string' && collapseGeneratorWhitespace(value).length > 0;

/**
 * Built-in tools keep their enum spelling. Custom names keep the first stored
 * spelling so a later case or whitespace variant does not become a second filter.
 */
export const uniqueGeneratorToolNames = (names: readonly string[]): string[] => {
    const unique = new Map<string, string>();

    for (const name of names) {
        if (!name || collapseGeneratorWhitespace(name).length === 0) continue;
        const builtin = canonicalBuiltinGeneratorTool(name);
        const stored = builtin ?? name;
        const key = generatorToolKey(stored);
        if (unique.has(key)) continue;
        unique.set(key, stored);
    }

    return Array.from(unique.values());
};

/** Library-backed names that are not ComfyUI, Other, Unknown, or another built-in tool. */
export const listCustomGeneratorTools = (names: readonly string[]): string[] => {
    const custom = uniqueGeneratorToolNames(names).filter(name => !canonicalBuiltinGeneratorTool(name));
    return custom.sort((left, right) => collapseGeneratorWhitespace(left).localeCompare(collapseGeneratorWhitespace(right), 'ru'));
};

/**
 * Map typed text onto a built-in tool or an existing custom spelling.
 * A new name is saved with collapsed whitespace.
 */
export const resolveGeneratorToolName = (value: string, knownNames: readonly string[] = []): string | null => {
    const collapsed = collapseGeneratorWhitespace(value);
    if (!collapsed) return null;

    const builtin = canonicalBuiltinGeneratorTool(collapsed);
    if (builtin) return builtin;

    const key = generatorToolKey(collapsed);
    for (const name of knownNames) {
        if (generatorToolKey(name) !== key) continue;
        const knownBuiltin = canonicalBuiltinGeneratorTool(name);
        if (knownBuiltin) return knownBuiltin;
        return name;
    }

    return collapsed;
};
