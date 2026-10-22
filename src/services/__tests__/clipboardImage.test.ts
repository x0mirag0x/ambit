import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    isTauriRuntime: vi.fn(),
    copyImageToClipboard: vi.fn(),
}));

vi.mock('../runtime', () => ({
    isTauriRuntime: mocks.isTauriRuntime,
}));

vi.mock('../../bindings', () => ({
    commands: {
        copyImageToClipboard: mocks.copyImageToClipboard,
    },
}));

describe('copyLibraryImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isTauriRuntime.mockReturnValue(false);
        vi.unstubAllGlobals();
    });

    it('copies a library file through the desktop clipboard', async () => {
        mocks.isTauriRuntime.mockReturnValue(true);
        mocks.copyImageToClipboard.mockResolvedValue({ status: 'ok', data: null });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { copyLibraryImage } = await import('../clipboardImage');
        await copyLibraryImage('C:/library/image.png', 'http://asset.localhost/C:/library/image.png');

        expect(mocks.copyImageToClipboard).toHaveBeenCalledWith('C:/library/image.png');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces a desktop clipboard failure', async () => {
        mocks.isTauriRuntime.mockReturnValue(true);
        mocks.copyImageToClipboard.mockResolvedValue({ status: 'error', error: 'clipboard busy' });

        const { copyLibraryImage } = await import('../clipboardImage');
        await expect(copyLibraryImage('C:/library/image.png', 'asset://image.png'))
            .rejects.toThrow('clipboard busy');
    });

    it('writes a png blob from the image url outside the desktop app', async () => {
        const blob = new Blob(['image'], { type: 'image/png' });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(blob),
        });
        const clipboardWrite = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('ClipboardItem', class ClipboardItem {
            constructor(public value: Record<string, Promise<Blob>>) {}
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: clipboardWrite },
        });

        const { copyLibraryImage } = await import('../clipboardImage');
        await copyLibraryImage('C:/library/image.png', 'asset://image.png');

        expect(fetchMock).toHaveBeenCalledWith('asset://image.png');
        expect(clipboardWrite).toHaveBeenCalledOnce();
        const item = clipboardWrite.mock.calls[0][0][0] as { value: Record<string, Promise<Blob>> };
        await expect(item.value['image/png']).resolves.toBe(blob);
    });
});
