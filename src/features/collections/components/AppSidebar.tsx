import * as React from 'react';
import { Grid, Clock, Eraser, BarChart3, Filter, Heart, Gift, HelpCircle, Settings, Pin } from 'lucide-react';
import { ViewMode, FilterState } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipButton } from '../../../components/ui/InfoTooltip';
import { useTranslation } from 'react-i18next';
import { FAVORITE_ICON_CLASS } from '../../../theme/favorite';

interface AppSidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isFilterPanelOpen: boolean;
  setIsFilterPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenDonation: () => void;
  showSupportPulse: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  viewMode,
  setViewMode,
  filters,
  setFilters,
  isFilterPanelOpen,
  setIsFilterPanelOpen,
  onOpenSettings,
  onOpenShortcuts,
  onOpenDonation,
  showSupportPulse
}) => {
  const { t } = useTranslation();
  const brandGlyphSrc = '/branding/d-mark.svg';

  return (
    <aside className="hidden md:flex w-20 flex-col items-center py-6 h-full rounded-3xl bg-white/90 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 z-20 shadow-2xl transition-all duration-500 ease-spring">
      <div className="mb-8 flex h-16 w-16 items-center justify-center">
        <img
          src={brandGlyphSrc}
          alt=""
          className="h-12 w-12"
        />
      </div>

      <nav className="flex-1 flex flex-col gap-6 w-full items-center">
        <NavButton state="view" active={viewMode === 'grid' && !filters.favoritesOnly} current={viewMode === 'grid'} onClick={() => { setViewMode('grid'); setFilters(f => ({ ...f, favoritesOnly: false })); }} icon={<Grid />} tooltip={t('Grid View')} />
        <NavButton state="view" active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')} icon={<Clock />} tooltip={t('Timeline View')} />
        <NavButton state="view" active={viewMode === 'dashboard'} onClick={() => setViewMode('dashboard')} icon={<BarChart3 />} tooltip={t('Statistics')} />
        <NavButton
          state="view"
          active={viewMode === 'maintenance'}
          onClick={() => setViewMode('maintenance')}
          icon={<Eraser />}
          tooltip={t('Maintenance')}
        />

        <div className="h-px w-8 bg-gray-300 dark:bg-white/10 my-2" />

        <NavButton state="toggle" active={isFilterPanelOpen && (viewMode === 'grid' || viewMode === 'timeline' || viewMode === 'dashboard')} pressed={isFilterPanelOpen} onClick={() => setIsFilterPanelOpen(p => !p)} icon={<Filter />} tooltip={isFilterPanelOpen ? t('Hide Filters') : t('Show Filters')} />
        <NavButton state="toggle" active={filters.favoritesOnly} onClick={() => setFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))} icon={<Heart className={filters.favoritesOnly ? FAVORITE_ICON_CLASS : ""} />} tooltip={filters.favoritesOnly ? t('Disable Favorites Only') : t('Show Favorites Only')} />
        <NavButton state="toggle" active={!!filters.pinnedOnly} onClick={() => setFilters(prev => ({ ...prev, pinnedOnly: !prev.pinnedOnly }))} icon={<Pin className={filters.pinnedOnly ? "fill-white text-white" : ""} />} tooltip={filters.pinnedOnly ? t('Disable Pinned Only') : t('Show Pinned Only')} />
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <TooltipButton label={t('Support Dvoyna Vault')} content={t('Support Dvoyna Vault')} onClick={onOpenDonation} className={`w-10 h-10 rounded-xl flex items-center justify-center hover:text-red-500 dark:hover:text-red-400 transition-all mb-2 ${showSupportPulse ? 'animate-pulse hover:animate-none text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-gray-400 dark:text-zinc-500'}`}>
          <Gift className="w-5 h-5" />
        </TooltipButton>
        <TooltipButton label={t('Open Help & Guide')} content={t('Open Help & Guide')} onClick={onOpenShortcuts} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white mb-2">
          <HelpCircle className="w-5 h-5" />
        </TooltipButton>
        <NavButton active={false} onClick={onOpenSettings} icon={<Settings />} tooltip={t('Settings')} />
      </div>
    </aside>
  );
};

const NavButton = ({ active, current, pressed, onClick, icon, tooltip, state = 'action', badgeContent, badgeColor = "bg-sage-500" }: { active: boolean, current?: boolean, pressed?: boolean, onClick: () => void, icon: React.ReactNode, tooltip: string, state?: 'view' | 'toggle' | 'action', badgeContent?: string | number, badgeColor?: string }) => (
  <TooltipButton
    label={tooltip}
    content={tooltip}
    onClick={onClick}
    aria-current={state === 'view' && (current ?? active) ? 'page' : undefined}
    aria-pressed={state === 'toggle' ? (pressed ?? active) : undefined}
    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ease-spring group relative ${active ? 'bg-sage-500 text-white shadow-lg shadow-sage-500/30' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-zinc-200'}`}
  >
    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 }) : icon}

    <AnimatePresence>
      {badgeContent !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 5 }}
          className={`absolute -top-1 -right-1 ${badgeColor} text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-sm z-10`}
        >
          {badgeContent}
        </motion.div>
      )}
    </AnimatePresence>
  </TooltipButton>
);
