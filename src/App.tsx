/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AmbientHalos } from './components/layout/AmbientHalos';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { ClientsView } from './components/clients/ClientsView';
import { BillingView } from './components/billing/BillingView';
import { SettingsView } from './components/settings/SettingsView';
import { CalendarView } from './components/calendar/CalendarView';
import { RemindersView } from './components/reminders/RemindersView';
import { CatalogView } from './components/catalog/CatalogView';
import { StatsView } from './components/stats/StatsView';
import { SubscriptionView } from './components/subscription/SubscriptionView';
import { SuperAdminView } from './components/admin/SuperAdminView';
import { SecuritySettingsView } from './components/settings/SecuritySettingsView';
import { SystemHealthView } from './components/system/SystemHealthView';
import { UpgradeModal } from './components/subscription/UpgradeModal';
import { OnboardingWizardModal } from './components/onboarding/OnboardingWizardModal';
import { HelpCenterModal } from './components/help/HelpCenterModal';
import { PublicLeadModal } from './components/leads/PublicLeadModal';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { ClientPortalView } from './components/client-portal/ClientPortalView';
import { LoginView } from './components/auth/LoginView';
import { EmailVerificationGate } from './components/auth/EmailVerificationGate';
import { TermsAcceptanceGate } from './components/auth/TermsAcceptanceGate';
import { OnboardingWizardGate } from './components/onboarding/OnboardingWizardGate';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { RefreshCw, AlertTriangle, LogOut } from 'lucide-react';
import { CURRENT_TERMS_VERSION } from './config/termsConfig';

const MainAppContent: React.FC = () => {
  const { 
    auth, 
    profile,
    activeClientPortalToken, 
    isClientPortalPreview,
    closeClientPortal,
    getProjectById,
    isUpgradeModalOpen,
    closeUpgradeModal,
    isAuthLoading,
    logout
  } = useApp();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClientIdForView, setSelectedClientIdForView] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectClientId, setNewProjectClientId] = useState<string | null>(null);
  const [isNewProjectClientLocked, setIsNewProjectClientLocked] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isPublicLeadModalOpen, setIsPublicLeadModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // 8-second watchdog timer for loading states
  useEffect(() => {
    if (isAuthLoading) {
      const timer = setTimeout(() => {
        setLoadingTimedOut(true);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimedOut(false);
    }
  }, [isAuthLoading]);

  // Dev debug bar component
  const renderDevDebugBar = (stageName: string) => {
    if (!import.meta.env?.DEV) return null;
    return (
      <aside 
        aria-label="Informations de débogage développement"
        className="fixed bottom-2 left-2 z-50 px-2.5 py-1 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-[10px] text-[#A6AFC2] font-mono flex items-center gap-2 shadow-xl pointer-events-none select-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span><strong>DEV:</strong> {auth.isAuthenticated ? `Connecté (${auth.email})` : 'Non connecté'}</span>
        <span className="text-white/20">|</span>
        <span>Profil: {profile?.email ? 'Chargé' : 'Init'}</span>
        <span className="text-white/20">|</span>
        <span className="text-[#f7c548]">Étape: <strong>{stageName}</strong></span>
        <span className="text-white/20">|</span>
        <span>WS: {auth.workspaceId ? auth.workspaceId.slice(0, 10) : 'N/A'}</span>
      </aside>
    );
  };

  // 0. If direct public lead request via URL
  const isPublicLeadDirect = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).has('public_lead') || new URLSearchParams(window.location.search).has('demande'));

  if (isPublicLeadDirect) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A]">
        <AmbientHalos />
        <PublicLeadModal 
          isOpen={true} 
          onClose={() => {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('public_lead');
            newUrl.searchParams.delete('demande');
            window.history.pushState({}, '', newUrl.toString());
            window.location.reload();
          }} 
        />
      </div>
    );
  }

  // 1. If viewing the secure client portal via token
  if (activeClientPortalToken) {
    return (
      <ClientPortalView 
        shareToken={activeClientPortalToken} 
        isPreviewMode={isClientPortalPreview}
        onExit={closeClientPortal} 
      />
    );
  }

  // 2. State Guard: Timeout si le chargement dépasse 8 secondes
  if (isAuthLoading && loadingTimedOut) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A] flex items-center justify-center p-4">
        <AmbientHalos />
        <div className="max-w-md w-full glass-modal p-6 sm:p-8 rounded-2xl border border-white/10 text-center space-y-6 relative z-10 text-white">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/40 text-[#D9695F] shadow-lg shadow-black/40">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-display text-white">
              Le chargement prend plus de temps que prévu
            </h1>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Le délai maximal de 8 secondes a été dépassé. Vous pouvez réessayer ou vous déconnecter pour réinitialiser la session.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-white/90 bg-white/10 hover:bg-white/15 border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[#D9695F]" />
              <span>Me déconnecter</span>
            </button>
          </div>
        </div>
        {renderDevDebugBar('timeout_error')}
      </div>
    );
  }

  // 3. State Guard: Chargement en cours (indicateur visible)
  if (isAuthLoading) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A] flex flex-col items-center justify-center p-4">
        <AmbientHalos />
        <div className="text-center space-y-4 relative z-10 text-white">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] font-bold text-lg font-display shadow-lg shadow-black/40 animate-pulse">
            EO
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-white">
            <RefreshCw className="w-4 h-4 animate-spin text-[#f7c548]" />
            <span>Chargement de votre espace créatif...</span>
          </div>
          <p className="text-xs text-[#8E97AB]">
            Vérification de votre compte et configuration de l'espace de travail
          </p>
        </div>
        {renderDevDebugBar('loading')}
      </div>
    );
  }

  // 4. State Guard: Non connecté -> écran de connexion / création de compte
  if (!auth.isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A]">
        <AmbientHalos />
        <LoginView />
        {renderDevDebugBar('unauthenticated')}
      </div>
    );
  }

  // 5. State Guard: Connecté mais email non vérifié (comptes avec mot de passe) -> écran de vérification par code à 6 chiffres
  const isEmailVerified = Boolean(auth.emailVerified || profile.emailVerified || auth.provider === 'google');
  if (!isEmailVerified) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A]">
        <AmbientHalos />
        <EmailVerificationGate />
        {renderDevDebugBar('email_verification')}
      </div>
    );
  }

  // 6. State Guard: Email vérifié mais Conditions d'utilisation non acceptées -> écran d'acceptation
  const isTermsCurrent = Boolean(
    (auth.termsAcceptedVersion && auth.termsAcceptedVersion >= CURRENT_TERMS_VERSION) ||
    (profile.termsAcceptedVersion && profile.termsAcceptedVersion >= CURRENT_TERMS_VERSION)
  );
  if (!isTermsCurrent) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A]">
        <AmbientHalos />
        <TermsAcceptanceGate />
        {renderDevDebugBar('terms_acceptance')}
      </div>
    );
  }

  // 7. State Guard: Conditions acceptées mais configuration non terminée -> assistant de configuration
  const isOnboardingDone = Boolean(auth.onboardingCompleted || profile.onboardingCompleted);
  if (!isOnboardingDone) {
    return (
      <div className="relative min-h-screen bg-[#0B0F1A]">
        <AmbientHalos />
        <OnboardingWizardGate />
        {renderDevDebugBar('onboarding')}
      </div>
    );
  }

  // 8. Navigation handlers pour l'espace de travail autorisé
  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    if (tab !== 'projects') {
      setSelectedProjectId(null);
    }
  };

  const handleOpenProjectDetail = (projId: string) => {
    setSelectedProjectId(projId);
    setCurrentTab('projects');
  };

  const handleBackToProjectsList = () => {
    setSelectedProjectId(null);
  };

  const selectedProject = selectedProjectId ? getProjectById(selectedProjectId) : null;

  return (
    <div className="min-h-screen relative flex flex-col lg:flex-row bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      <AmbientHalos />

      {/* Glass Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        onOpenPublicLead={() => setIsPublicLeadModalOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenHelpCenter={() => setIsHelpCenterOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMobile={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Viewport Content */}
      <div className="flex-1 min-w-0 lg:pl-72 flex flex-col relative z-10">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          selectedProjectTitle={selectedProject ? selectedProject.title : null}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenNewProject={() => setIsNewProjectModalOpen(true)}
          onOpenNewClient={() => {
            setCurrentTab('clients');
            setIsNewClientModalOpen(true);
          }}
          onSelectTab={handleSelectTab}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
        />

        {/* Dynamic Screen Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onSelectProject={handleOpenProjectDetail}
              onOpenNewProject={() => setIsNewProjectModalOpen(true)}
              onOpenNewClient={() => {
                setCurrentTab('clients');
                setIsNewClientModalOpen(true);
              }}
              onNavigateToProjects={() => setCurrentTab('projects')}
              onNavigateToClients={() => setCurrentTab('clients')}
            />
          )}

          {currentTab === 'projects' && (
            selectedProjectId ? (
              <ProjectDetailView
                projectId={selectedProjectId}
                onBack={handleBackToProjectsList}
              />
            ) : (
              <ProjectsView
                onSelectProject={handleOpenProjectDetail}
                onOpenCreateModal={() => setIsNewProjectModalOpen(true)}
                searchQuery={globalSearchQuery}
              />
            )
          )}

          {currentTab === 'clients' && (
            <ClientsView
              onSelectProject={handleOpenProjectDetail}
              onOpenNewProjectForClient={(clientId) => {
                setNewProjectClientId(clientId);
                setIsNewProjectClientLocked(true);
                setIsNewProjectModalOpen(true);
              }}
              isCreateModalOpen={isNewClientModalOpen}
              onCloseCreateModal={() => setIsNewClientModalOpen(false)}
              onOpenCreateModal={() => setIsNewClientModalOpen(true)}
              selectedClientIdProp={selectedClientIdForView}
              onSelectClient={setSelectedClientIdForView}
            />
          )}

          {currentTab === 'billing' && (
            <BillingView 
              onSelectProject={handleOpenProjectDetail} 
              onSelectClient={(clientId) => {
                setSelectedClientIdForView(clientId);
                setCurrentTab('clients');
              }}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView />
          )}

          {currentTab === 'reminders' && (
            <RemindersView />
          )}

          {currentTab === 'catalog' && (
            <CatalogView onUseTemplateForProject={() => setIsNewProjectModalOpen(true)} />
          )}

          {currentTab === 'stats' && (
            <StatsView />
          )}

          {currentTab === 'subscription' && (
            <SubscriptionView />
          )}

          {currentTab === 'security' && (
            <SecuritySettingsView />
          )}

          {currentTab === 'admin' && (
            <SuperAdminView onExit={() => setCurrentTab('dashboard')} />
          )}

          {currentTab === 'system_health' && (
            <SystemHealthView />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Modal: New Project */}
      <CreateProjectModal
        isOpen={isNewProjectModalOpen}
        preselectedClientId={newProjectClientId}
        isClientLocked={isNewProjectClientLocked}
        onClose={() => {
          setIsNewProjectModalOpen(false);
          setNewProjectClientId(null);
          setIsNewProjectClientLocked(false);
        }}
        onProjectCreated={(newId) => {
          setSelectedProjectId(newId);
          setCurrentTab('projects');
        }}
      />

      {/* Modal: Public Lead / QR Code */}
      <PublicLeadModal
        isOpen={isPublicLeadModalOpen}
        onClose={() => setIsPublicLeadModalOpen(false)}
      />

      {/* Modal: Upgrade / Abonnement */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
      />

      {/* Modal: Onboarding */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Modal: Centre d'Aide */}
      <HelpCenterModal
        isOpen={isHelpCenterOpen}
        onClose={() => setIsHelpCenterOpen(false)}
      />

      {/* Dev Debug Bar */}
      {renderDevDebugBar('authorized')}
    </div>
  );
};

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </GlobalErrorBoundary>
  );
}
