import { act, fireEvent, render, screen, waitFor } from '../../../test/testUtils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InvokeOwnerScopeState } from '../../../contexts/SyncContext';
import i18n from '../../../i18n';
import { InvokeOwnerScopeGate } from '../InvokeOwnerScopeGate';

afterEach(async () => {
    await i18n.changeLanguage('en');
});

const renderGate = (state: InvokeOwnerScopeState) => {
    const callbacks = {
        onSelect: vi.fn(),
        onRetry: vi.fn(),
        onOpenSettings: vi.fn(),
    };
    return {
        ...render(<InvokeOwnerScopeGate state={state} {...callbacks} />),
        callbacks,
    };
};

describe('InvokeOwnerScopeGate', () => {
    it('explains the safety boundary while owner discovery is pending', () => {
        renderGate({
            status: 'discovering',
            progress: { current: 0, total: 0, message: 'Checking InvokeAI owner information...' },
        });

        expect(screen.getByRole('status')).toBeTruthy();
        expect(screen.getByText('InvokeAI library')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Preparing your InvokeAI view' })).toBeTruthy();
        expect(screen.getByText(/loading the images, boards, and filters/i)).toBeTruthy();
        expect(screen.getByText('Your library remains unchanged while this view loads.')).toBeTruthy();
        expect(screen.getByText('Checking InvokeAI owner information...')).toBeTruthy();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('shows real reconciliation counts without inventing a global percentage', () => {
        renderGate({
            status: 'applying',
            progress: { current: 500, total: 2000, message: 'Updating InvokeAI image details...' },
        });

        expect(screen.getByText('500 / 2,000')).toBeTruthy();
        expect(screen.getByText('Updating InvokeAI image details...')).toBeTruthy();
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('500');
        expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('2000');
    });

    it('names the target owner and reports elapsed time for a sustained switch', async () => {
        vi.useFakeTimers();
        try {
            renderGate({
                status: 'applying',
                rootPath: 'D:/Invoke',
                scope: {
                    mode: 'owner',
                    ownerId: 'owner-a',
                    dbPath: 'D:/Invoke/databases/invokeai.db',
                    imagesRoot: 'D:/Invoke',
                },
                discovery: {
                    schemaMode: 'multi_user',
                    dbPath: 'D:/Invoke/databases/invokeai.db',
                    imagesRoot: 'D:/Invoke',
                    owners: [{ ownerId: 'owner-a', displayName: 'Odin', imageCount: 12 }],
                    unassignedImageCount: 0,
                },
                progress: { current: 0, total: 0, message: 'Updating changed InvokeAI filters...' },
            });

            expect(screen.getByRole('heading', { name: 'Switching to Odin' })).toBeTruthy();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(5000);
            });
            expect(screen.getByText(/5s elapsed/)).toBeTruthy();
        } finally {
            vi.useRealTimers();
        }
    });

    it('owns multi-user selection, applies an owner immediately, and focuses its heading', async () => {
        const { callbacks } = renderGate({
            status: 'selection_required',
            rootPath: 'D:/Invoke',
            discovery: {
                schemaMode: 'multi_user',
                dbPath: 'D:/Invoke/databases/invokeai.db',
                imagesRoot: 'D:/Invoke',
                owners: [{ ownerId: 'owner-a', displayName: 'Artemis', imageCount: 12 }],
                unassignedImageCount: 2,
            },
        });

        const heading = screen.getByRole('heading', { name: 'Choose which InvokeAI images to show' });
        await waitFor(() => expect(document.activeElement).toBe(heading));
        fireEvent.click(screen.getByRole('button', { name: /artemis/i }));
        expect(callbacks.onSelect).toHaveBeenCalledWith({
            dbPath: 'D:/Invoke/databases/invokeai.db',
            mode: 'owner',
            ownerId: 'owner-a',
        });
    });

    it('explains blocking failures in plain language and keeps raw details collapsed', async () => {
        const { callbacks } = renderGate({
            status: 'error',
            failure: { kind: 'preparation_failed', details: 'database locked' },
            error: 'database locked',
        });

        const heading = screen.getByRole('heading', { name: 'InvokeAI library preparation failed' });
        await waitFor(() => expect(document.activeElement).toBe(heading));
        expect(screen.getByText(/staying hidden to avoid showing the wrong library/i)).toBeTruthy();
        expect((screen.getByText('Technical details').parentElement as HTMLDetailsElement).open).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
        expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
        expect(callbacks.onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('shows the all-users confirmation in Russian, including unassigned rows', async () => {
        await i18n.changeLanguage('ru');
        const discovery = {
            schemaMode: 'multi_user' as const,
            dbPath: 'D:/Invoke/databases/invokeai.db',
            imagesRoot: 'D:/Invoke',
            owners: [{
                ownerId: 'owner-a',
                displayName: 'Artemis',
                imageCount: 12,
                intermediateImageCount: 4,
                boardCount: 3,
            }],
            unassignedImageCount: 2,
            unassignedBoardCount: 5,
        };
        const { unmount } = renderGate({
            status: 'selection_required',
            rootPath: 'D:/Invoke',
            discovery,
        });

        expect(screen.getByText('8 стандартных изображений')).toBeTruthy();
        expect(screen.getByText('4 промежуточных')).toBeTruthy();
        expect(screen.getByText('3 досок')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /все пользователи/i }));
        expect(screen.getByRole('heading', { name: 'Показать изображения всех пользователей InvokeAI?' })).toBeTruthy();
        expect(screen.getByText('Dvoyna Vault покажет содержимое InvokeAI всех владельцев, включая 2 строк изображений без владельца и 5 досок без владельца, в галерее, коллекциях, обслуживании и ссылках. Вернуться к одному владельцу можно в любой момент.')).toBeTruthy();
        unmount();

        renderGate({
            status: 'selection_required',
            rootPath: 'D:/Invoke',
            discovery: { ...discovery, unassignedImageCount: 0, unassignedBoardCount: 0 },
        });
        fireEvent.click(screen.getByRole('button', { name: /все пользователи/i }));
        expect(screen.getByText('Dvoyna Vault покажет изображения и доски всех владельцев InvokeAI из этой локальной базы. Вернуться к одному владельцу можно в любой момент.')).toBeTruthy();
    });

    it('offers recovery instead of an indefinite spinner for an offline scope that cannot be admitted', () => {
        const { callbacks } = renderGate({
            status: 'offline_ready',
            rootPath: 'D:/PreviousInvoke',
            failure: { kind: 'source_unavailable', details: 'database unavailable' },
            error: 'database unavailable',
        });

        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText('InvokeAI needs attention')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
    });
});
