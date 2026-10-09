import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ru from './locales/ru.json';

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
});
