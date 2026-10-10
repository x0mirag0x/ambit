export const REPOSITORY_URL = 'https://github.com/x0mirag0x/ambit';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;
/** Upstream project. Required for the GPL-3.0 attribution link. */
export const UPSTREAM_REPOSITORY_URL = 'https://github.com/AsuraAce/ambit';
export const DONATION_URL = 'https://vk.ru/dvoyna_studio';

export interface SupportChannel {
    id: 'issues' | 'releases';
    label: string;
    description: string;
    url: string;
}

export interface DonationProvider {
    id: 'vk';
    label: string;
    ctaLabel: string;
    url: string | null;
}

export const SUPPORT_CHANNELS: SupportChannel[] = [
    {
        id: 'issues',
        label: 'Report a bug',
        description: 'Use GitHub Issues for bugs, regressions, and concrete feature requests.',
        url: ISSUES_URL
    },
    {
        id: 'releases',
        label: 'Follow releases',
        description: 'Track new builds, release notes, and packaged downloads.',
        url: RELEASES_URL
    }
];

export const DONATION_PROVIDERS: DonationProvider[] = [
    {
        id: 'vk',
        label: 'VK',
        ctaLabel: 'Donate',
        url: DONATION_URL
    }
];

export const ENABLED_DONATION_PROVIDERS = DONATION_PROVIDERS.filter((provider) => !!provider.url);
