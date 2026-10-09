import i18n from './index';

interface StatusPattern {
    re: RegExp;
    key: string;
    map: (match: RegExpMatchArray) => Record<string, string | number>;
}

const number = (value: string): number => Number(value);

/**
 * Progress strings are produced in English by the backend and by long-running
 * jobs, then stored until the next paint. Translate them at render time so a
 * language change does not leave stale copy in state.
 */
const STATUS_PATTERNS: readonly StatusPattern[] = [
    { re: /^Found (\d+) images to refresh$/, key: 'progress.foundImagesToRefresh', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Processed (\d+)\/(\d+) \(Updated: (\d+)\)\. Timings: Fetch (\d+)ms, Parse (\d+)ms, DB (\d+)ms$/, key: 'progress.processedTimings', map: (match) => ({ current: number(match[1]), total: number(match[2]), updated: number(match[3]), fetchMs: number(match[4]), parseMs: number(match[5]), dbMs: number(match[6]) }) },
    { re: /^Processed (\d+)\/(\d+) \(Updated: (\d+)\)\. Timings: Fetch (\d+)ms$/, key: 'progress.processedTimingsShort', map: (match) => ({ current: number(match[1]), total: number(match[2]), updated: number(match[3]), fetchMs: number(match[4]) }) },
    { re: /^Refreshing photo metadata (\d+)\/(\d+)$/, key: 'progress.refreshingPhotoMetadata', map: (match) => ({ current: number(match[1]), total: number(match[2]) }) },
    { re: /^Completed (\d+) \/ (\d+) images$/, key: 'progress.completedImages', map: (match) => ({ current: number(match[1]), total: number(match[2]) }) },
    { re: /^Resolving online (\d+)\/(\d+)$/, key: 'progress.resolvingOnline', map: (match) => ({ current: number(match[1]), total: number(match[2]) }) },
    { re: /^Found (\d+) images to reset\.\.\.$/, key: 'progress.foundImagesToReset', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Resetting\.\.\. (\d+) \/ (\d+)$/, key: 'progress.resetting', map: (match) => ({ current: number(match[1]), total: number(match[2]) }) },
    { re: /^Importing images from (\d+) folders\.\.\.$/, key: 'progress.importingFromFolders', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Scanning (.+)\.\.\.$/, key: 'progress.scanningPath', map: (match) => ({ path: match[1] }) },
    { re: /^Optimized (\d+) thumbnails$/, key: 'progress.optimizedThumbnails', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Finished: (\d+) thumbnails optimized$/, key: 'progress.finishedThumbnails', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Optimized (\d+) thumbnails; (\d+) need attention$/, key: 'progress.optimizedThumbnailsWithAttention', map: (match) => ({ optimized: number(match[1]), attention: number(match[2]) }) },
    { re: /^Connected! Found (\d+) images\.$/, key: 'progress.connectedImages', map: (match) => ({ count: number(match[1]) }) },
    { re: /^Lookup failed: (.+)$/, key: 'progress.lookupFailed', map: (match) => ({ message: match[1] }) },
    { re: /^MediaInfo stdout exceeded (\d+) bytes$/, key: 'progress.mediainfoStdoutExceeded', map: (match) => ({ bytes: number(match[1]) }) },
];

export const translateRuntimeMessage = (message: string): string => {
    if (!message) return message;

    for (const pattern of STATUS_PATTERNS) {
        const match = pattern.re.exec(message);
        if (!match) continue;
        return i18n.t(pattern.key, pattern.map(match));
    }

    if (i18n.exists(message)) return i18n.t(message);
    return message;
};
