import { describe, expect, it } from 'vitest';
import { GeneratorTool } from '../../types';
import {
    canonicalBuiltinGeneratorTool,
    isPersistedGeneratorFilterValue,
    listCustomGeneratorTools,
    resolveGeneratorToolName,
    uniqueGeneratorToolNames,
} from '../generatorTools';

describe('generator tool names', () => {
    it('collapses case and whitespace without merging distinct names', () => {
        expect(uniqueGeneratorToolNames([
            ' Krea ',
            'krea',
            'Nano  Banana',
            'ComfyUI',
            'comfyui',
            'Другое',
            'Other',
            '',
            '   ',
        ])).toEqual([' Krea ', 'Nano  Banana', GeneratorTool.COMFYUI, GeneratorTool.OTHER]);
    });

    it('lists only custom names, using the first stored spelling', () => {
        expect(listCustomGeneratorTools([
            'Forge',
            ' imagine.art ',
            'Imagine.art',
            'Krea',
            'Unknown',
            'Неизвестно',
        ])).toEqual([' imagine.art ', 'Krea']);
    });

    it('resolves built-ins, translated sentinels, and existing custom spellings', () => {
        expect(canonicalBuiltinGeneratorTool('  forge ')).toBe(GeneratorTool.FORGE);
        expect(canonicalBuiltinGeneratorTool('Другое')).toBe(GeneratorTool.OTHER);
        expect(resolveGeneratorToolName('  nano   banana  ')).toBe('nano banana');
        expect(resolveGeneratorToolName('krea', ['Krea', 'Nano Banana'])).toBe('Krea');
        expect(resolveGeneratorToolName(' COMFyUI ', ['Krea'])).toBe(GeneratorTool.COMFYUI);
        expect(resolveGeneratorToolName('неизвестно')).toBe(GeneratorTool.UNKNOWN);
        expect(resolveGeneratorToolName('   ')).toBeNull();
    });

    it('accepts saved filter values that are not part of the built-in list', () => {
        expect(isPersistedGeneratorFilterValue('Krea')).toBe(true);
        expect(isPersistedGeneratorFilterValue(GeneratorTool.OTHER)).toBe(true);
        expect(isPersistedGeneratorFilterValue('   ')).toBe(false);
        expect(isPersistedGeneratorFilterValue(1)).toBe(false);
    });
});
