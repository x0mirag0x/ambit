import * as React from 'react';
import { EyeOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MaskedViewerGateProps {
    mediaLabel: 'image' | 'video';
    onReveal: () => void;
    onClose: () => void;
}

export const MaskedViewerGate: React.FC<MaskedViewerGateProps> = ({
    mediaLabel,
    onReveal,
    onClose,
}) => { const { t } = useTranslation(); return ((
    <div className="relative flex h-full w-full items-center justify-center bg-black text-white">
        <button
            type="button"
            aria-label={t('Close {{mediaLabel}} viewer', { mediaLabel: mediaLabel })}
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/70 p-2.5 hover:bg-white/15"
        >
            <X className="h-5 w-5" />
        </button>
        <div className="flex max-w-md flex-col items-center rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center shadow-2xl">
            <EyeOff className="mb-4 h-10 w-10 text-sage-400" />
            <h2 className="text-xl font-bold">{t('Hidden')} {mediaLabel}</h2>
            <p className="mt-2 text-sm text-zinc-400">
                {t('The full')} {mediaLabel} {t('will not load until you reveal this item.')}</p>
            <button
                type="button"
                onClick={onReveal}
                className="mt-6 rounded-lg bg-sage-500 px-5 py-2.5 font-bold text-white"
            >
                {t('Reveal')} {mediaLabel}
            </button>
        </div>
    </div>
)); };
