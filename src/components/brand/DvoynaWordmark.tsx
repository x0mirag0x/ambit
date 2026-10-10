import * as React from 'react';

interface DvoynaWordmarkProps {
    className?: string;
}

export const DvoynaWordmark: React.FC<DvoynaWordmarkProps> = ({ className = '' }) => (
    <img src="/branding/dvoyna-wordmark.png" alt="Dvoyna" className={`block h-[1em] w-auto select-none ${className}`} />
);
