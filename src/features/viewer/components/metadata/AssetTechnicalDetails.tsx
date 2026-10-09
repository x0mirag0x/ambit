import * as React from 'react';
import { Info } from 'lucide-react';
import { MetadataSectionHeader } from './MetadataSectionHeader';
import { useTranslation } from 'react-i18next';

export interface TechnicalDetail {
    label: string;
    value: string;
}

export const AssetTechnicalDetails: React.FC<{ rows: readonly TechnicalDetail[] }> = ({ rows }) => { const { t } = useTranslation(); return ((
    <section>
        <MetadataSectionHeader title={t('Technical details')} icon={Info} />
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {rows.map(row => (
                <React.Fragment key={row.label}>
                    <dt className="text-gray-500 dark:text-zinc-500">{t(row.label)}</dt>
                    <dd className="min-w-0 break-words">{row.value}</dd>
                </React.Fragment>
            ))}
        </dl>
    </section>
)); };
