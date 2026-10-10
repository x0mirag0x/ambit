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
});
