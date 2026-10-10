import * as React from 'react';

interface DvoynaWordmarkProps {
    className?: string;
}

export const DvoynaWordmark: React.FC<DvoynaWordmarkProps> = ({ className = '' }) => (
    <span className={`font-wordmark text-[#E8C46E] ${className}`}>Dvoyna</span>
);
