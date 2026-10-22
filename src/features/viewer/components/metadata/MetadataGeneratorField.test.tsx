import { fireEvent, render, screen } from '../../../../test/testUtils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratorTool } from '../../../../types';
import i18n from '../../../../i18n';
import { MetadataGeneratorField } from './MetadataGeneratorField';
import { resetGeneratorToolOptionsForTests, setLibraryGeneratorOptions } from '../../../../utils/generatorToolOptions';

const renderField = (value: GeneratorTool = GeneratorTool.COMFYUI, onSave = vi.fn()) => {
    render(<MetadataGeneratorField value={value} onSave={onSave} />);
    return onSave;
};

const chooseCustom = () => {
    const option = screen.getByRole('option', { name: 'Custom generator…' }) as HTMLOptionElement;
    fireEvent.change(screen.getByRole('combobox', { name: 'Generator software' }), { target: { value: option.value } });
};

describe('MetadataGeneratorField', () => {
    beforeEach(async () => {
        resetGeneratorToolOptionsForTests();
        setLibraryGeneratorOptions(['Krea', ' krea ', 'ComfyUI']);
        await i18n.changeLanguage('en');
    });

    afterEach(async () => {
        resetGeneratorToolOptionsForTests();
        await i18n.changeLanguage('en');
    });

    it('replaces Other with a custom name and reuses a previous spelling', () => {
        const onSave = renderField();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Generation Tool' }));

        const options = screen.getAllByRole('option').map(option => option.textContent);
        expect(options).toContain('ComfyUI');
        expect(options).toContain('Krea');
        expect(options).toContain('Unknown');
        expect(options).toContain('Custom generator…');
        expect(options.filter(option => option === 'Krea')).toHaveLength(1);
        expect(options).not.toContain('Other');

        chooseCustom();
        const input = screen.getByLabelText('Custom generator name');
        fireEvent.change(input, { target: { value: '   ' } });
        expect((screen.getByRole('button', { name: /save/i }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: '  krea  ' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).toHaveBeenCalledWith('Krea');
    });

    it('saves a new collapsed name and maps a typed built-in back to its canonical spelling', () => {
        const onSave = renderField();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Generation Tool' }));
        chooseCustom();
        const input = screen.getByLabelText('Custom generator name');
        fireEvent.change(input, { target: { value: '  Nano   Banana  ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSave).toHaveBeenCalledWith('Nano Banana');

        onSave.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Generation Tool' }));
        chooseCustom();
        fireEvent.change(screen.getByLabelText('Custom generator name'), { target: { value: ' forge ' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).toHaveBeenCalledWith(GeneratorTool.FORGE);
    });

    it('keeps a stored Other value selectable and translated', async () => {
        await i18n.changeLanguage('ru');
        const onSave = renderField(GeneratorTool.OTHER);
        expect(screen.getByText('Другое')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Изменить инструмент генерации' }));
        expect(screen.getByRole('option', { name: 'Другое' })).toBeTruthy();
        expect(screen.getByRole('option', { name: 'Свой вариант…' })).toBeTruthy();
        fireEvent.change(screen.getByRole('combobox', { name: 'Программа генерации' }), { target: { value: 'Krea' } });
        fireEvent.click(screen.getByRole('button', { name: /сохранить/i }));
        expect(onSave).toHaveBeenCalledWith('Krea');
    });

    it('drops an unsaved custom name on Escape', () => {
        const onSave = renderField();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Generation Tool' }));
        chooseCustom();
        const input = screen.getByLabelText('Custom generator name');
        fireEvent.change(input, { target: { value: 'Imagine.art' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Edit Generation Tool' })).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });
});
