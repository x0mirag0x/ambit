import i18n from '../i18n';
import type { SyncProgress } from '../stores/libraryStore';

type ImportProgressPhase = 'scanning' | 'importing' | 'finalizing';

interface StableImportProgressOptions {
    current: number;
    total: number;
    sourceCount: number;
    phase: ImportProgressPhase;
    prefix?: string;
    sourceIndex?: number;
    sourcePath?: string;
}

const withPrefix = (message: string, prefix?: string): string =>
    prefix ? i18n.t('{{prefix}}: {{message}}', { prefix: i18n.t(prefix), message }) : message;

export const formatStableImportProgress = ({
    current,
    total,
    sourceCount,
    phase,
    prefix,
    sourceIndex,
    sourcePath
}: StableImportProgressOptions): SyncProgress => {
    const isSingleFolder = sourceCount === 1;
    const message = phase === 'finalizing'
        ? withPrefix(i18n.t('Finalizing import...'), prefix)
        : phase === 'scanning'
            ? withPrefix(isSingleFolder ? i18n.t('Scanning folder...') : i18n.t('Scanning {{n}} folders...', { n: sourceCount }), prefix)
            : withPrefix(isSingleFolder ? i18n.t('Importing images from folder...') : i18n.t('Importing images from {{n}} folders...', { n: sourceCount }), prefix);

    const progress: SyncProgress = {
        current,
        total,
        message
    };

    if (sourceCount === 1 && sourcePath) {
        progress.detail = sourcePath;
    } else if (sourceIndex && sourceCount > 1) {
        progress.detail = i18n.t('Folder {{current}} of {{total}}', { current: sourceIndex, total: sourceCount });
    }

    return progress;
};
