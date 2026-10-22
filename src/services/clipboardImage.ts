import { commands } from '../bindings';
import { isTauriRuntime } from './runtime';

const readPngBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Could not read the image');
    }
    const blob = await response.blob();
    if (blob.type === 'image/png') {
        return blob;
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    try {
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not prepare the image');
        }
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close();
    }

    const png = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
    if (!png) {
        throw new Error('Could not prepare the image');
    }
    return png;
};

const copyImageUrl = async (url: string): Promise<void> => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard is unavailable');
    }

    const pngPromise = readPngBlob(url);
    let writePromise: Promise<void>;
    try {
        writePromise = navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngPromise }),
        ]);
    } catch (error) {
        await pngPromise.catch(() => undefined);
        throw error;
    }

    const [imageResult, writeResult] = await Promise.allSettled([pngPromise, writePromise]);
    if (imageResult.status === 'rejected') {
        throw imageResult.reason;
    }
    if (writeResult.status === 'rejected') {
        throw writeResult.reason;
    }
};

export const copyLibraryImage = async (path: string, url: string): Promise<void> => {
    if (isTauriRuntime()) {
        const result = await commands.copyImageToClipboard(path);
        if (result.status === 'error') {
            throw new Error(result.error);
        }
        return;
    }

    await copyImageUrl(url);
};
