import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Zap, 
  Check, 
  AlertTriangle, 
  Clock, 
  Download, 
  ChevronRight, 
  Tag, 
  Lock,
  Layers,
  Users,
  FileText,
  HardDrive,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UpgradeModal } from './UpgradeModal';
import { DEFAULT_PLANS } from '../../data/plansAndWorkspaces';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { generateSubscriptionInvoicePDF, SubscriptionInvoiceData } from '../../utils/pdfGenerator';

export const SubscriptionView: React.FC = () => {
  const { 
    currentWorkspace, 
    entitlements, 
    openUpgradeModal, 
    isUpgradeModalOpen, 
    closeUpgradeModal,
    exportFullWorkspaceData,
    profile
  } = useApp();

  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const plan = (DEFAULT_PLANS as any)[currentWorkspace.planId] || Object.values(DEFAULT_PLANS)[0];
  const isPro = currentWorkspace.planId === 'pro' && currentWorkspace.planStatus === 'active';

  const projectsPercent = Math.min(100, Math.round((entitlements.currentActiveProjects / entitlements.maxActiveProjects) * 100));
  const clientsPercent = Math.min(100, Math.round((entitlements.currentClients / entitlements.maxClients) * 100));
  const quotesPercent = Math.min(100, Math.round((entitlements.currentQuotesThisMonth / entitlements.maxQuotesPerMonth) * 100));
  const storagePercent = Math.min(100, Math.round((entitlements.currentStorageMb / entitlements.maxStorageMb) * 100));

  // Invoices strictly from real payments / subscriptions of the workspace
  const [subscriptionInvoices] = useState<SubscriptionInvoiceData[]>(() => {
    const saved = localStorage.getItem(`eyesonwork_sub_invoices_${currentWorkspace.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleDownloadInvoice = (inv: SubscriptionInvoiceData) => {
    setDownloadingInvoiceId(inv.invoiceNumber);
    setDownloadError(null);
    try {
      generateSubscriptionInvoicePDF({
        ...inv,
        currency: profile.currency || 'EUR',
        studioName: profile.studioName || profile.name,
        ownerEmail: currentWorkspace.ownerEmail || profile.email
      });
      showToast(`Facture ${inv.invoiceNumber} téléchargée avec succès.`);
    } catch (err: any) {
      console.error('Invoice download error:', err);
      setDownloadError("Erreur lors de la génération du PDF. Veuillez réessayer.");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Breadcrumb: "eyes-onwork / Abonnement" (on mobile reduced to "Abonnement") */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs text-[#8E97AB]">
        <span className="hidden sm:inline">eyes-onwork</span>
        <span className="hidden sm:inline text-white/30">/</span>
        <span className="text-white font-medium">Abonnement</span>
      </nav>

      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-[#52BE80] text-[#0B0F1A] font-bold text-xs shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-display">
            Abonnement & Formule Studio
          </h1>
          <p className="text-xs text-[#8E97AB] mt-0.5">
            Gérez vos quotas d'utilisation, vos factures et les droits de votre espace de travail.
          </p>
        </div>

        {!isPro && (
          <button
            onClick={() => openUpgradeModal('Mise à niveau volontaire vers la formule Pro.')}
            className="py-3 px-5 rounded-2xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 shadow-lg shadow-[#f7c548]/20 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Passer à la formule Pro</span>
          </button>
        )}
      </div>

      {/* Grace Period or Trial Banner */}
      {entitlements.isGracePeriod && (
        <div className="p-4 rounded-3xl bg-[#E59866]/15 border border-[#E59866]/30 text-xs text-[#E59866] flex items-center gap-3">
          <Clock className="w-5 h-5 shrink-0" />
          <div>
            <strong>Période de grâce active :</strong> Il vous reste {entitlements.daysLeftInGrace} jours pour régulariser votre abonnement. Vos données restent conservées et consultables.
          </div>
        </div>
      )}

      {/* Plan Status Card */}
      <div className="glass-panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] flex items-center justify-center font-bold text-xl font-display shadow-lg">
              {isPro ? 'PRO' : 'FREE'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-display">
                  Formule {plan.name}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isPro ? 'bg-[#f7c548] text-[#0B0F1A]' : 'bg-white/10 text-white'
                }`}>
                  {currentWorkspace.planStatus === 'trial' ? 'Essai Pro 14j' : currentWorkspace.planStatus}
                </span>
              </div>
              <p className="text-xs text-[#8E97AB] mt-0.5">
                {plan.tagline}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs">
            {currentWorkspace.planStatus === 'trial' ? (
              <>
                <span className="text-[#8E97AB] block">Fin de l'essai Pro :</span>
                <span className="text-sm font-bold text-[#f7c548]">
                  {new Date(currentWorkspace.trialEndsAt || currentWorkspace.planRenewsAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </>
            ) : isPro ? (
              <>
                <span className="text-[#8E97AB] block">Prochain renouvellement :</span>
                <span className="text-sm font-bold text-white">
                  {new Date(currentWorkspace.planRenewsAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="text-[#8E97AB] block">Statut de la formule :</span>
                <span className="text-sm font-bold text-white">
                  Formule permanente sans échéance
                </span>
              </>
            )}
          </div>
        </div>

        {/* Live Quota Gauges */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase text-[#8E97AB] tracking-wider">
            Utilisation par rapport à vos plafonds :
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project gauge */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#f7c548]" />
                  <span>Projets actifs</span>
                </span>
                <span className="font-bold text-white">
                  {entitlements.currentActiveProjects} / {entitlements.maxActiveProjects >= 999 ? '∞' : entitlements.maxActiveProjects}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${projectsPercent >= 100 ? 'bg-[#D9695F]' : 'bg-[#f7c548]'}`} 
                  style={{ width: `${Math.min(100, projectsPercent)}%` }} 
                />
              </div>
            </div>

            {/* Clients gauge */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#f7c548]" />
                  <span>Clients actifs</span>
                </span>
                <span className="font-bold text-white">
                  {entitlements.currentClients} / {entitlements.maxClients >= 999 ? '∞' : entitlements.maxClients}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${clientsPercent >= 100 ? 'bg-[#D9695F]' : 'bg-[#f7c548]'}`} 
                  style={{ width: `${Math.min(100, clientsPercent)}%` }} 
                />
              </div>
            </div>

            {/* Quotes gauge : "Devis ce mois" */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#f7c548]" />
                  <span>Devis ce mois</span>
                </span>
                <span className="font-bold text-white">
                  {entitlements.currentQuotesThisMonth} / {entitlements.maxQuotesPerMonth >= 999 ? '∞' : entitlements.maxQuotesPerMonth}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${quotesPercent >= 100 ? 'bg-[#D9695F]' : 'bg-[#f7c548]'}`} 
                  style={{ width: `${Math.min(100, quotesPercent)}%` }} 
                />
              </div>
            </div>

            {/* Storage gauge */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB] flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#f7c548]" />
                  <span>Stockage Cloud</span>
                </span>
                <span className="font-bold text-white">
                  {Math.round(entitlements.currentStorageMb)} Mo / {entitlements.maxStorageMb >= 1000 ? `${Math.round(entitlements.maxStorageMb/1000)} Go` : `${entitlements.maxStorageMb} Mo`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${storagePercent >= 100 ? 'bg-[#D9695F]' : 'bg-[#f7c548]'}`} 
                  style={{ width: `${Math.min(100, storagePercent)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights on current plan: checkmarks for included, locks for Pro-reserved */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <Check className="w-4 h-4 text-[#52BE80] shrink-0" />
                <span className="text-white">Zéro filigrane / 100% white-label sur vos PDF</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-[#8E97AB] shrink-0" />
                <span className="text-[#8E97AB]">Mention eyes-onwork sur PDF (limitation plan Gratuit)</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <Check className="w-4 h-4 text-[#52BE80] shrink-0" />
                <span className="text-white">Projets illimités (recherches, maquettes, livrables)</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#52BE80] shrink-0" />
                <span className="text-white">Jusqu'à 3 projets actifs en simultané</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <Check className="w-4 h-4 text-[#52BE80] shrink-0" />
                <span className="text-white">Relances automatiques des factures impayées</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-[#8E97AB] shrink-0" />
                <span className="text-[#8E97AB]">Relances automatiques (réservé Pro)</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <Check className="w-4 h-4 text-[#52BE80] shrink-0" />
                <span className="text-white">Statistiques financières avancées & taux de conversion</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-[#8E97AB] shrink-0" />
                <span className="text-[#8E97AB]">Statistiques financières avancées (réservé Pro)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Invoices History: Only real payments, clean empty state when empty */}
      <div className="glass-panel p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-display">
            Historique des Factures d’Abonnement
          </h3>
          {downloadError && (
            <span className="text-xs text-[#D9695F] font-medium">{downloadError}</span>
          )}
        </div>

        {subscriptionInvoices.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <FileText className="w-8 h-8 text-[#8E97AB] mx-auto opacity-40" />
            <p className="text-xs font-semibold text-white/90">Aucune facture d'abonnement pour l'instant</p>
            <p className="text-[11px] text-[#8E97AB] max-w-sm mx-auto">
              Vos justificatifs et factures officielles apparaîtront automatiquement ici dès votre premier règlement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#8E97AB] uppercase">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Numéro</th>
                  <th className="py-2.5">Formule</th>
                  <th className="py-2.5">Montant</th>
                  <th className="py-2.5">Statut</th>
                  <th className="py-2.5 text-right">Télécharger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subscriptionInvoices.map((inv) => (
                  <tr key={inv.invoiceNumber} className="hover:bg-white/5">
                    <td className="py-3 text-white">
                      {new Date(inv.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 font-mono text-[#f7c548]">{inv.invoiceNumber}</td>
                    <td className="py-3 text-[#8E97AB]">{inv.planName} ({inv.cycle})</td>
                    <td className="py-3 font-bold text-white">
                      {formatCurrencySafe(inv.amount, inv.currency || profile.currency || 'EUR', 2)}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#52BE80]/20 text-[#52BE80]">
                        Réglé
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        disabled={downloadingInvoiceId === inv.invoiceNumber}
                        className="p-1.5 rounded-lg text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Télécharger le PDF officiel de la facture"
                      >
                        {downloadingInvoiceId === inv.invoiceNumber ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#f7c548]" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Export & Account Freedom */}
      <div className="glass-panel p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white font-display">
            Portabilité & Export Intégral de vos Données
          </h3>
          <p className="text-xs text-[#8E97AB] mt-0.5">
            Téléchargez l'intégralité de votre espace de travail (clients, projets, devis, factures) en un fichier structuré.
          </p>
        </div>

        <button
          onClick={exportFullWorkspaceData}
          className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-[#f7c548]" />
          <span>Exporter mes données</span>
        </button>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        reason={entitlements.reasonBlocked}
      />
    </div>
  );
};

