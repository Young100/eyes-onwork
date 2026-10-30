import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Settings, 
  LogOut, 
  Sparkles,
  CreditCard,
  Calendar,
  Bell,
  Package,
  BarChart3,
  QrCode,
  Menu,
  ShieldCheck,
  HelpCircle,
  Compass,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type NavTab = 
  | 'dashboard' 
  | 'projects' 
  | 'clients' 
  | 'billing' 
  | 'calendar' 
  | 'reminders' 
  | 'catalog' 
  | 'stats' 
  | 'subscription'
  | 'security'
  | 'admin'
  | 'system_health'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenNewProject: () => void;
  onOpenPublicLead?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHelpCenter?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewProject,
  onOpenPublicLead,
  onOpenOnboarding,
  onOpenHelpCenter,
  isOpenMobile,
  onCloseMobile,
  onOpenMobile
}) => {
  const { 
    profile, 
    projects, 
    clients, 
    invoices, 
    reminderQueue, 
    logout, 
    auth, 
    currentWorkspace, 
    theme 
  } = useApp();

  const isLight = theme === 'light';

  const activeProjectsCount = (projects || []).filter(p => p.currentStep !== 'livre').length;
  const pendingInvoicesCount = (invoices || []).filter(inv => inv.balanceDue > 0).length;
  const pendingRemindersCount = (reminderQueue || []).filter(r => r.status === 'draft').length;

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Tableau de bord',
      shortLabel: 'Accueil',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'projects' as NavTab,
      label: 'Projets créatifs',
      shortLabel: 'Projets',
      icon: Briefcase,
      badge: activeProjectsCount > 0 ? activeProjectsCount : null
    },
    {
      id: 'clients' as NavTab,
      label: 'Clients',
      shortLabel: 'Clients',
      icon: Users,
      badge: clients.length
    },
    {
      id: 'billing' as NavTab,
      label: 'Facturation & Devis',
      shortLabel: 'Factures',
      icon: CreditCard,
      badge: pendingInvoicesCount > 0 ? pendingInvoicesCount : null
    },
    {
      id: 'calendar' as NavTab,
      label: 'Planning & Calendrier',
      shortLabel: 'Planning',
      icon: Calendar,
      badge: null
    },
    {
      id: 'reminders' as NavTab,
      label: 'À relancer',
      shortLabel: 'Relances',
      icon: Bell,
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : null
    },
    {
      id: 'catalog' as NavTab,
      label: 'Catalogue & Modèles',
      shortLabel: 'Catalogue',
      icon: Package,
      badge: null
    },
    {
      id: 'stats' as NavTab,
      label: 'Statistiques & Gestion',
      shortLabel: 'Stats',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'subscription' as NavTab,
      label: 'Abonnement Studio',
      shortLabel: 'Abonnement',
      icon: Sparkles,
      badge: currentWorkspace?.planStatus === 'trial'
        ? 'ESSAI'
        : (currentWorkspace?.planStatus === 'active' && currentWorkspace?.planId === 'pro' ? 'PRO' : null)
    },
    ...(auth.isSuperAdmin ? [
      {
        id: 'admin' as NavTab,
        label: 'Console Super Admin',
        shortLabel: 'Super Admin',
        icon: ShieldCheck,
        badge: 'Admin'
      }
    ] : []),
    {
      id: 'settings' as NavTab,
      label: 'Paramètres',
      shortLabel: 'Réglages',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop Fixed Sidebar & Mobile Slide-in Drawer */}
      {/* Desktop Fixed Sidebar & Mobile Slide-in Drawer */}
      <aside className={`
        fixed top-0 left-0 z-50 w-72 h-[100dvh] max-h-[100dvh] flex flex-col justify-between overflow-y-auto overscroll-contain
        transition-transform duration-300 ease-out shadow-2xl border-r
        ${isLight 
          ? 'bg-[#faf7f0] border-[#8a7968]/20 text-[#1d1335]' 
          : 'bg-[#160830] border-[#8a7968]/15 text-[#eeebd3]'
        }
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Main top & navigation flow */}
        <div>
          {/* 1. Sticky Top Brand Header */}
          <div className={`sticky top-0 z-10 shrink-0 border-b backdrop-blur-md ${
            isLight ? 'border-[#8a7968]/15 bg-[#faf7f0]/95' : 'border-[#8a7968]/15 bg-[#160830]/95'
          }`}>
            <div className="p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`relative w-9 h-9 rounded-xl border flex items-center justify-center shadow-lg ${
                  isLight ? 'bg-white border-[#f7c548]/60 text-[#b37d0c]' : 'bg-[#1a0a3a] border-[#f7c548]/40 text-[#f7c548]'
                }`}>
                  <span className="font-bold text-sm tracking-wider">EO</span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f7c548] ring-4 ring-[var(--sidebar-bg)]" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-base tracking-tight block leading-tight font-display truncate text-[var(--text-primary)]">
                    eyes-onwork
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-normal block tracking-normal truncate">
                    Studio & Freelance OS
                  </span>
                </div>
              </div>

              {/* Mobile close button */}
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-surface-elevated)] cursor-pointer"
                title="Fermer le menu"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>
          </div>

          {/* Quick CTAs in sidebar */}
          <div className="px-3 pt-3.5 space-y-2">
            <button
              onClick={() => {
                onOpenNewProject();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all duration-200 shadow-md shadow-[#f7c548]/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
              <span>Nouveau projet</span>
            </button>

            {onOpenPublicLead && (
              <button
                onClick={() => {
                  onOpenPublicLead();
                  if (isOpenMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border active:scale-[0.98] transition-all cursor-pointer ${
                  isLight 
                    ? 'bg-white hover:bg-[#f5ede0] border-[#8a7968]/20 text-[#1d1335]' 
                    : 'bg-[#1a0a3a] hover:bg-[#25124d] border-[#8a7968]/20 text-[#eeebd3]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-[#f7c548]" />
                <span>Formulaire public & QR code</span>
              </button>
            )}
          </div>

          {/* 2. Full Navigation - naturally expanded without cramped sub-scroller */}
          <nav className="px-3 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer
                    ${isActive 
                      ? (isLight 
                          ? 'bg-[#fef4db] text-[#1d1335] shadow-sm font-semibold border-l-2 border-[#f7c548]' 
                          : 'bg-[#1a0a3a] text-[#eeebd3] shadow-sm font-semibold border-l-2 border-[#f7c548]')
                      : (isLight 
                          ? 'text-[#7a6c62] hover:text-[#1d1335] hover:bg-[#f5ede0]' 
                          : 'text-[#8a7968] hover:text-[#eeebd3] hover:bg-[#1a0a3a]/40')
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 stroke-[1.5] ${isActive ? 'text-[#f7c548]' : 'text-current'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      isActive 
                        ? (isLight ? 'bg-[#f7c548]/30 text-[#8c6000]' : 'bg-[#f7c548]/20 text-[#f7c548]')
                        : (isLight ? 'bg-white text-[#7a6c62] border border-[#8a7968]/15' : 'bg-[#1a0a3a] text-[#8a7968] border border-[#8a7968]/15')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 3. Bottom Profile & Studio Card + Logout (Light mode div removed) */}
        <div className={`mt-auto shrink-0 p-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t space-y-2.5 ${
          isLight ? 'border-[#8a7968]/15 bg-[#faf7f0]' : 'border-[#8a7968]/15 bg-[#160830]'
        }`}>
          {/* Upgrade to Pro Card */}
          {currentWorkspace?.planId !== 'studio' && (
            <div className={`p-3 rounded-xl border space-y-2 ${
              isLight ? 'bg-white border-[#8a7968]/20 shadow-sm' : 'bg-[#1a0a3a] border-[#8a7968]/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Passer à Pro</span>
                <span className="text-[10px] text-[#0f0326] bg-[#f7c548] px-1.5 py-0.5 rounded font-bold">PRO</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-tight">Projets et devis illimités pour votre studio créatif.</p>
              <button 
                onClick={() => {
                  onSelectTab('subscription');
                  if (isOpenMobile) onCloseMobile();
                }} 
                className="w-full py-1.5 rounded-lg text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
              >
                Découvrir l'offre
              </button>
            </div>
          )}

          {/* User Profile Card */}
          <div className={`p-3 rounded-xl border ${
            isLight ? 'bg-white border-[#8a7968]/15 shadow-sm' : 'bg-[#1a0a3a] border-[#8a7968]/15'
          }`}>
            <div className="flex items-center gap-3">
              {profile.avatarUrl || auth.photoURL || profile.logoUrl ? (
                <img 
                  src={profile.avatarUrl || auth.photoURL || profile.logoUrl} 
                  alt={profile.name || auth.displayName || 'Profil'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-[#8a7968]/20 shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 font-display ${
                  isLight ? 'bg-[#fef4db] border-[#f7c548]/40 text-[#b37d0c]' : 'bg-[#160830] border-[#f7c548]/30 text-[#f7c548]'
                }`}>
                  {((profile.name || auth.displayName || auth.email || 'S').slice(0, 2)).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate font-display text-[var(--text-primary)]">
                  {profile.studioName || profile.name || auth.displayName || 'Mon Studio'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {profile.specialty || 'Direction Artistique & Design'}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
              {auth.isSuperAdmin ? (
                <span className="flex items-center gap-1.5 text-[#f7c548] font-medium text-[10px] truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#f7c548] shrink-0" />
                  Super Admin
                </span>
              ) : (
                <span className="text-[10px] text-[var(--text-secondary)] truncate">
                  {currentWorkspace?.name || 'Espace personnel'}
                </span>
              )}

              <span className="text-[10px] text-[#0f0326] font-medium bg-[#f7c548] px-2 py-0.5 rounded-full">
                {currentWorkspace?.planId === 'pro' ? 'Pro' : (currentWorkspace?.planId === 'studio' ? 'Studio' : 'Freelance')}
              </span>
            </div>
          </div>

          {/* Bouton Se déconnecter */}
          <button
            onClick={() => {
              logout();
              if (isOpenMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium border active:scale-[0.98] transition-all cursor-pointer shadow-sm ${
              isLight 
                ? 'text-[#7a6c62] hover:text-[#1d1335] bg-white hover:bg-[#f5ede0] border-[#8a7968]/20' 
                : 'text-[#8a7968] hover:text-[#eeebd3] bg-[#1a0a3a]/60 hover:bg-[#1a0a3a] border-[#8a7968]/20'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav 
        aria-label="Navigation mobile"
        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t px-2 pt-1 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around backdrop-blur-2xl ${
          isLight ? 'bg-white/95 border-[#8a7968]/20 text-[#1d1335]' : 'bg-[#0f0326]/95 border-[#8a7968]/20 text-[#eeebd3]'
        }`}
      >
        {[
          navItems[0], // Accueil
          navItems[1], // Projets
          navItems[3], // Factures
          navItems[4], // Planning
          navItems[5]  // Relances
        ].map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`
                relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer
                ${isActive ? 'text-[#f7c548]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
              `}
            >
              <div className="relative">
                <Icon className="w-5 h-5 stroke-[1.5]" />
                {item.badge !== null && (
                  <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 px-1 rounded-full bg-[#f7c548] text-[#0f0326] text-[9px] font-bold flex items-center justify-center leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-1">
                {item.shortLabel}
              </span>

              {/* Active gold underline */}
              {isActive && (
                <span className="absolute -bottom-1.5 w-6 h-0.5 rounded-full bg-[#f7c548]" />
              )}
            </button>
          );
        })}

        {/* Mobile 'More' Button to open full drawer */}
        <button
          onClick={onOpenMobile}
          className="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <Menu className="w-5 h-5 stroke-[1.5]" />
          <span className="text-[10px] font-medium mt-1">Menu</span>
        </button>
      </nav>
    </>
  );
};
