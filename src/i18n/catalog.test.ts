import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ru from './locales/ru.json';
import { runtimeMessageHasPattern } from './statusMessages';

const englishCatalog = en as Record<string, string>;
const russianCatalog = ru as Record<string, string>;

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');
const CALL_PATTERN = /(?:^|[^.\w])(?:i18n\.)?t\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

const decodeJsString = (raw: string): string => raw.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, escape: string) => {
    if (escape === 'n') return '\n';
    if (escape === 'r') return '\r';
    if (escape === 't') return '\t';
    if (escape.startsWith('u')) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (escape.startsWith('x')) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    return escape;
});

const hasRussian = (catalog: Record<string, string>, key: string): boolean => {
    if (catalog[key] !== undefined) return true;
    const prefix = `${key}_`;
    return Object.keys(catalog).some(candidate => candidate.startsWith(prefix));
};

const collectSourceFiles = (directory: string): string[] => {
    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
            continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\./.test(entry.name) || entry.name === 'bindings.ts') continue;
        files.push(fullPath);
    }
    return files;
};

const collectStaticKeys = (): Map<string, string> => {
    const keys = new Map<string, string>();
    for (const file of collectSourceFiles(SOURCE_ROOT)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(CALL_PATTERN)) {
            const key = decodeJsString(match[2] ?? '');
            if (!key || key.includes('${')) continue;
            if (!keys.has(key)) keys.set(key, path.relative(SOURCE_ROOT, file));
        }
    }
    return keys;
};

const TOAST_TYPES = new Set(['success', 'error', 'info', 'warning']);

const extractCallArguments = (source: string, openParen: number): string => {
    let depth = 1;
    let quote: string | null = null;
    let index = openParen + 1;
    while (index < source.length && depth > 0) {
        const character = source[index];
        if (quote) {
            if (character === '\\') {
                index += 2;
                continue;
            }
            if (character === quote) quote = null;
            index += 1;
            continue;
        }
        if (character === "'" || character === '"' || character === '`') {
            quote = character;
            index += 1;
            continue;
        }
        if (character === '(') depth += 1;
        else if (character === ')') depth -= 1;
        index += 1;
    }
    return source.slice(openParen + 1, Math.max(openParen + 1, index - 1));
};

const firstCallArgument = (call: string): string => {
    let depth = 0;
    let quote: string | null = null;
    for (let index = 0; index < call.length; index += 1) {
        const character = call[index];
        if (quote) {
            if (character === '\\') {
                index += 1;
                continue;
            }
            if (character === quote) quote = null;
            continue;
        }
        if (character === "'" || character === '"' || character === '`') {
            quote = character;
            continue;
        }
        if (character === '(') depth += 1;
        else if (character === ')') depth = Math.max(0, depth - 1);
        else if (character === ',' && depth === 0) return call.slice(0, index);
    }
    return call;
};

const collectToastArguments = (): Map<string, string> => {
    const messages = new Map<string, string>();
    for (const file of collectSourceFiles(SOURCE_ROOT)) {
        const source = fs.readFileSync(file, 'utf8');
        let index = 0;
        while ((index = source.indexOf('addToast(', index)) !== -1) {
            const openParen = index + 'addToast'.length;
            const argument = firstCallArgument(extractCallArguments(source, openParen));
            for (const match of argument.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
                const value = decodeJsString(match[2] ?? '');
                if (!value || TOAST_TYPES.has(value)) continue;
                if (!value.includes(' ') && !value.includes('${')) continue;
                if (!messages.has(value)) messages.set(value, path.relative(SOURCE_ROOT, file));
            }
            index = openParen + 1;
        }
    }
    return messages;
};

const toastArgumentIsCovered = (message: string): boolean => {
    const normalized = message.replace(/\$\{[^}]*\}/g, '1');
    if (message.includes('${')) return runtimeMessageHasPattern(normalized) || hasRussian(russianCatalog, normalized);
    return hasRussian(russianCatalog, message) || runtimeMessageHasPattern(message);
};

const UI_FILE = /(?:Modal|Dialog|Wizard|Gate|GlobalModals|InvokeOwnerScopeSelector|InvokeReferenceLinks|InvokeAITab|ComfyUITab|A1111Tab|ResourcesTab|ResourceDiscoverySection)\.tsx$/;
const RUNTIME_FILE = /^(?:contexts\/SyncContext|services\/invoke\/.+)\.ts$/;
const CSS_NOISE = /\b(?:flex|grid|absolute|relative|dark:|text-|bg-|rounded|px-|py-|border|shadow|hover:|items-|justify-|overflow|font-|gap-|inset|animate-|min-|max-|cursor-|opacity-|pointer-|tracking-|leading-|space-|col-span|sm:|md:|lg:|w-|h-|from-|to-|via-|ring-|outline-|transition|duration-|ease-|blur|backdrop|whitespace-|break-|truncate|uppercase|lowercase|shrink|grow|hidden|block|inline|sticky|fixed|object-|aspect-|fill-|stroke-|placeholder|select-|appearance|pointer-events|mix-blend|bg-\[|text-\[)\b/;
const PROSE = /\b(?:the|your|will|with|from|before|while|could|failed|show|images|image|boards|board|owner|import|discovery|unavailable|current|removed|unknown|warning|warnings|processed|folder|folders|view|ready|return|including|updating|preparing|checking|rebuilding|restoring|applying|cancelled|completed|unassigned|intermediates|library|scanning|importing|mapping|connected)\b/i;
const SKIP_LINE = /console\.|debugLiveWatchPerf|infoLiveWatchPerf|^\s*\/\*|^\s*\*|^\s*\/\//;
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1).)*)\1/g;
const BARE_COUNT_LABELS = new Set(['images', 'intermediates', 'boards']);

const normalizedCopy = (value: string): string => value.replace(/\$\{([^}]*)\}/g, (_, expression: string) => (
    /Math|count|processed|total|length|\bn\b|\d/.test(expression) ? '1' : 'Name'
)).trim();

const isDialogSentence = (value: string): boolean => {
    if (value.includes('../') || value.includes('./') || /\b(?:SELECT|WHERE|FROM|PRAGMA|INSERT)\b/.test(value)) return false;
    if (CSS_NOISE.test(value)) return false;
    const text = normalizedCopy(value);
    if (!/^[A-Z]/.test(text)) return false;
    const words = text.match(/[A-Za-z][A-Za-z']+/g) ?? [];
    if (words.length < 3) return false;
    return PROSE.test(text) || /[.?!]/.test(text);
};

const isProgressCopy = (value: string): boolean => {
    const text = normalizedCopy(value);
    if (/\b(?:SELECT|WHERE|FROM|PRAGMA|INSERT)\b/.test(text)) return false;
    if (!/^[A-Z]/.test(text)) return false;
    return (text.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;
};

const enclosingCallName = (source: string, index: number): string | null => {
    let depth = 0;
    let quote: string | null = null;
    for (let cursor = index - 1; cursor >= 0 && cursor > index - 900; cursor -= 1) {
        const character = source[cursor];
        if (quote) {
            if (character === '\\') {
                cursor -= 1;
                continue;
            }
            if (character === quote) quote = null;
            continue;
        }
        if (character === "'" || character === '"' || character === '`') {
            quote = character;
            continue;
        }
        if (character === ')') depth += 1;
        else if (character === '(') {
            if (depth === 0) {
                const name = /([A-Za-z0-9_.]+)\s*$/.exec(source.slice(Math.max(0, cursor - 48), cursor));
                return name?.[1] ?? null;
            }
            depth -= 1;
        }
    }
    return null;
};

const isRuntimeMessage = (source: string, index: number): boolean => {
    const call = enclosingCallName(source, index);
    if (call && /^(?:onProgress|reportProgress|setLocalTestResult|setSyncProgress|setVisibleStartupProgress)$/.test(call)) {
        return true;
    }
    const before = source.slice(Math.max(0, index - 80), index);
    return /(?:message|reason|warning|boardScopeWarning)\s*[:=]\s*$/.test(before);
};

const isWrappedForTranslation = (source: string, index: number): boolean => {
    const call = enclosingCallName(source, index);
    return call === 't' || call === 'i18n.t' || call === 'translateRuntimeMessage';
};

const isIndirectlyTranslated = (source: string, before: string): boolean => {
    const property = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(before)?.[1];
    if (property && new RegExp(`\\bt\\(\\s*[A-Za-z0-9_]+\\.${property}\\b`).test(source)) return true;
    return /\bt\(\s*[A-Za-z0-9_]+\s*\[/.test(source) && /['"`][^'"`]+['"`]\s*:\s*$/.test(before);
};

const copyIsCatalogued = (value: string): boolean => {
    const normalized = normalizedCopy(value);
    return hasRussian(russianCatalog, value)
        || hasRussian(russianCatalog, normalized)
        || runtimeMessageHasPattern(normalized);
};

const collectDialogCopyGaps = (): string[] => {
    const gaps: string[] = [];
    for (const file of collectSourceFiles(SOURCE_ROOT)) {
        const relative = path.relative(SOURCE_ROOT, file);
        const isUi = UI_FILE.test(relative);
        const isRuntime = RUNTIME_FILE.test(relative);
        if (!isUi && !isRuntime) continue;
        const source = fs.readFileSync(file, 'utf8');
        const lines = source.split('\n');
        let offset = 0;
        for (const line of lines) {
            const lineStart = offset;
            offset += line.length + 1;
            if (SKIP_LINE.test(line) || /^\s*import\b/.test(line)) continue;
            for (const match of line.matchAll(STRING_LITERAL)) {
                const value = decodeJsString(match[2] ?? '');
                if (!value) continue;
                const index = lineStart + (match.index ?? 0);
                const before = source.slice(Math.max(0, index - 80), index);
                if (/===|!==/.test(before)) continue;
                if (isWrappedForTranslation(source, index)) continue;
                const assignmentWindow = source.slice(Math.max(0, index - 500), index);
                const assigned = /(?:const|let)\s+([A-Za-z0-9_]+)\s*=[^;]*$/.exec(assignmentWindow);
                if (assigned && new RegExp(`\\bt\\(\\s*${assigned[1]}\\b`).test(source) && copyIsCatalogued(value)) continue;
                if (copyIsCatalogued(value) && source.includes(`'${value}':`) && /\bt\(\s*[A-Za-z0-9_]+\s*\[/.test(source)) continue;
                const runtime = isRuntimeMessage(source, index);
                if (runtime && isProgressCopy(value)) {
                    if (!copyIsCatalogued(value)) {
                        gaps.push(`${relative}: progress message missing from ru.json: ${value.slice(0, 180)}`);
                    }
                    continue;
                }
                if (!isUi || !isDialogSentence(value)) {
                    if (isUi && BARE_COUNT_LABELS.has(value)) {
                        gaps.push(`${relative}: count label is not passed through t(): ${value}`);
                    }
                    continue;
                }
                if (isIndirectlyTranslated(source, before)) {
                    if (!copyIsCatalogued(value)) {
                        gaps.push(`${relative}: dialog copy missing from ru.json: ${value.slice(0, 180)}`);
                    }
                    continue;
                }
                gaps.push(`${relative}: dialog copy is not passed through t(): ${value.slice(0, 180)}`);
            }
        }
    }
    return gaps;
};

describe('translation catalogs', () => {
    it('gives every English catalog key a Russian translation', () => {
        const missing = Object.keys(englishCatalog).filter(key => russianCatalog[key] === undefined);
        expect(missing).toEqual([]);
    });

    it('gives every static t() key a Russian translation', () => {
        const missing = [...collectStaticKeys().entries()]
            .filter(([key]) => !hasRussian(russianCatalog, key))
            .map(([key, file]) => `${file}: ${key}`);
        expect(missing).toEqual([]);
    });

    it('covers toast and dynamic status strings with a Russian key or a runtime pattern', () => {
        const missing = [...collectToastArguments().entries()]
            .filter(([message]) => !toastArgumentIsCovered(message))
            .map(([message, file]) => `${file}: ${message}`);
        expect(missing).toEqual([]);
    });

    it('translates InvokeAI, integration, and modal sentences shown to the user', () => {
        expect(collectDialogCopyGaps()).toEqual([]);
    });
});
