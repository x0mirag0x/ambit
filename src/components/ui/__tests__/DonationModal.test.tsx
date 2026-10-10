import { act, fireEvent, render, screen, waitFor } from '../../../test/testUtils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { open } from '@tauri-apps/plugin-shell';
import i18n from '../../../i18n';
import { DonationModal } from '../DonationModal';

describe('DonationModal', () => {
    afterEach(async () => {
        await act(async () => {
            await i18n.changeLanguage('en');
        });
    });

    it('opens the studio donation page from the only support button', async () => {
        render(<DonationModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Donate' })).toBeTruthy();
        expect(screen.queryByText('Sponsor on GitHub')).toBeNull();
        expect(screen.queryByText('Buy me a coffee')).toBeNull();
        expect(screen.getByText('Thank you for being part of the journey.')).toBeTruthy();
        expect(screen.queryByText('Report a bug')).toBeNull();
        expect(screen.queryByText('Follow releases')).toBeNull();
        expect(screen.queryByText('Donations are not configured yet')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Donate' }));

        await waitFor(() => {
            expect(open).toHaveBeenCalledWith('https://vk.ru/dvoyna_studio');
        });

        await act(async () => {
            await i18n.changeLanguage('ru');
        });
        expect(screen.getByRole('button', { name: 'Донат' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Поддержать на GitHub' })).toBeNull();
    });

    it('closes from the dismiss button and backdrop but not the dialog body', () => {
        const onClose = vi.fn();
        const { container } = render(<DonationModal isOpen={true} onClose={onClose} />);

        fireEvent.click(container.querySelector('.fixed.inset-0') as HTMLElement);
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('Support Dvoyna Vault'));
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(container.querySelector('button.absolute') as HTMLButtonElement);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
