import { canonicalBuiltinGeneratorTool, generatorToolKey, listCustomGeneratorTools, resolveGeneratorToolName } from './generatorTools';

const EMPTY_NAMES: readonly string[] = [];

let libraryNames: readonly string[] = [];
let sessionNames: readonly string[] = [];
let snapshot: readonly string[] = EMPTY_NAMES;
const listeners = new Set<() => void>();

const listsMatch = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((name, index) => name === right[index]);

const publish = () => {
    const next = listCustomGeneratorTools([...libraryNames, ...sessionNames]);
    if (listsMatch(next, snapshot)) return;
    snapshot = next;
    listeners.forEach(listener => listener());
};

export const setLibraryGeneratorOptions = (names: readonly string[]) => {
    libraryNames = names;
    const libraryKeys = new Set(listCustomGeneratorTools(libraryNames).map(generatorToolKey));
    sessionNames = sessionNames.filter(name => !libraryKeys.has(generatorToolKey(name)));
    publish();
};

/** Keep a name typed in this session visible before the facet cache refreshes. */
export const rememberGeneratorToolName = (name: string) => {
    const resolved = resolveGeneratorToolName(name, [...libraryNames, ...sessionNames]);
    if (!resolved || canonicalBuiltinGeneratorTool(resolved)) return;
    const key = generatorToolKey(resolved);
    const existing = listCustomGeneratorTools([...libraryNames, ...sessionNames]);
    if (existing.some(candidate => generatorToolKey(candidate) === key)) return;
    sessionNames = [...sessionNames, resolved];
    publish();
};

export const subscribeGeneratorToolOptions = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getGeneratorToolOptions = (): readonly string[] => snapshot;

export const getServerGeneratorToolOptions = (): readonly string[] => EMPTY_NAMES;

export const resetGeneratorToolOptionsForTests = () => {
    libraryNames = [];
    sessionNames = [];
    snapshot = EMPTY_NAMES;
    listeners.forEach(listener => listener());
};
