import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, Search, LogOut, Settings, ShieldCheck, ChevronDown, Moon, Sun } from 'lucide-react';
import { NavTab } from './Sidebar';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  currentTab: NavTab;
  selectedProjectTitle?: string | null;
  onOpenMobileMenu: () => void;
  onOpenNewProject: () => void;
  onOpenNewClient: () => void;
  onSelectTab?: (tab: NavTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  selectedProjectTitle,
  onOpenMobileMenu,
  onOpenNewProject,
  onOpenNewClient,
  onSelectTab,
  searchQuery,
  onSearchChange
}) => {
  const { profile, auth, logout, currentWorkspace, theme, toggleTheme } = useApp();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarMenuOpen]);

  const getBreadcrumbs = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'projects':
        return selectedProjectTitle ? `Projets / ${selectedProjectTitle}` : 'Projets & Pipeline';
      case 'clients':
        return 'Annuaire des clients';
      case 'billing':
        return 'Facturation & Devis';
      case 'calendar':
        return 'Planning & Rendez-vous';
      case 'reminders':
        return 'Relances & Impayés';
      case 'catalog':
        return 'Catalogue de prestations';
      case 'stats':
        return 'Statistiques & Gestion';
      case 'subscription':
        return 'Abonnement';
      case 'admin':
        return 'Console Super Admin';
      case 'settings':
        return 'Paramètres du studio';
      default:
        return 'eyes-onwork';
    }
  };

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 border-b transition-colors ${
      isLight ? 'bg-white border-[#8a7968]/15' : 'bg-[#160830] border-[#8a7968]/15'
    }`}>
      {/* Zone 1: Mobile Hamburger & Title / Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-surface-elevated)] transition-colors cursor-pointer"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5 stroke-[1.5]" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="hidden sm:inline font-semibold text-[var(--text-primary)]">eyes-onwork</span>
            <span aria-hidden="true" className="hidden sm:inline text-[var(--text-secondary)]/40">/</span>
            <span className="text-[#f7c548] font-semibold truncate max-w-[200px] sm:max-w-md">
              {getBreadcrumbs()}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] stroke-[1.5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un dossier, un client, un devis..."
            className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#f7c548] transition-colors ${
              isLight 
                ? 'bg-[#f6f1e7] border-[#8a7968]/20 text-[#1d1335] placeholder:text-[#7a6c62]/70' 
                : 'bg-[#1a0a3a] border-[#8a7968]/20 text-[#eeebd3] placeholder:text-[#8a7968]/70'
            }`}
          />
        </div>
      </div>

      {/* Zone 3: Action Buttons & Theme Switch & User Avatar Menu */}
      <div className="flex items-center gap-2.5">
        {currentTab === 'clients' ? (
          <button
            onClick={onOpenNewClient}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-[#f7c548]/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouveau client</span>
          </button>
        ) : (
          <button
            onClick={onOpenNewProject}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-[#f7c548]/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouveau projet</span>
          </button>
        )}

        {/* Quick Theme Toggle Button in Header */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isLight ? 'Passer au mode sombre (Aurelia)' : 'Passer au mode clair (Lumina)'}
          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
            isLight 
              ? 'bg-[#f6f1e7] text-[#1d1335] border-[#8a7968]/20 hover:border-[#f7c548]' 
              : 'bg-[#1a0a3a] text-[#f7c548] border-[#8a7968]/20 hover:border-[#f7c548]'
          }`}
        >
          {isLight ? (
            <Moon className="w-4 h-4 text-[#1d1335]" />
          ) : (
            <Sun className="w-4 h-4 text-[#f7c548]" />
          )}
        </button>

        {/* User Avatar & Dropdown Menu */}
        <div className="relative" ref={avatarMenuRef}>
          <button
            onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-all cursor-pointer"
            title="Menu profil & déconnexion"
          >
            {profile?.avatarUrl || auth.photoURL || profile?.logoUrl ? (
              <img 
                src={profile.avatarUrl || auth.photoURL || profile.logoUrl} 
                alt={profile.name || auth.displayName || 'Profil'} 
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#f7c548]/40 shrink-0" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 font-display ${
                isLight ? 'bg-[#fef4db] border-[#f7c548]/40 text-[#b37d0c]' : 'bg-[#1a0a3a] border-[#f7c548]/40 text-[#f7c548]'
              }`}>
                {((profile.name || auth.displayName || auth.email || 'S').slice(0, 2)).toUpperCase()}
              </div>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-200 hidden sm:block ${isAvatarMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isAvatarMenuOpen && (
            <div className={`absolute right-0 top-full mt-2 w-64 rounded-2xl border p-2 shadow-2xl z-50 animate-fadeIn space-y-1 ${
              isLight ? 'bg-white border-[#8a7968]/20' : 'bg-[#1a0a3a] border-[#8a7968]/20'
            }`}>
              <div className={`p-3 rounded-xl border ${
                isLight ? 'bg-[#faf7f0] border-[#8a7968]/15' : 'bg-[#160830] border-[#8a7968]/15'
              }`}>
                <p className="text-xs font-semibold truncate font-display text-[var(--text-primary)]">
                  {profile.name || auth.displayName || 'Graphiste'}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {auth.email}
                </p>
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] text-[#0f0326] bg-[#f7c548] px-2 py-0.5 rounded-full font-medium">
                    {auth.isSuperAdmin ? 'Super Admin' : (currentWorkspace?.planId === 'pro' ? 'Plan Pro' : 'Gratuit')}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[120px]">
                    {profile.studioName || 'Mon Studio'}
                  </span>
                </div>
              </div>

              {onSelectTab && (
                <>
                  <button
                    onClick={() => {
                      onSelectTab('settings');
                      setIsAvatarMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      isLight ? 'text-[#1d1335] hover:bg-[#f6f1e7]' : 'text-[#eeebd3] hover:bg-[#160830]'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-[#f7c548]" />
                    <span>Paramètres du studio</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('settings');
                      setIsAvatarMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      isLight ? 'text-[#1d1335] hover:bg-[#f6f1e7]' : 'text-[#eeebd3] hover:bg-[#160830]'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#f7c548]" />
                    <span>Sécurité & Compte</span>
                  </button>
                </>
              )}

              <div className="border-t border-[var(--border-subtle)] pt-1">
                <button
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    logout();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                    isLight ? 'text-[#7a6c62] hover:text-[#1d1335] hover:bg-[#f6f1e7]' : 'text-[#8a7968] hover:text-[#eeebd3] hover:bg-[#160830]'
                  }`}
                >
                  <LogOut className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
