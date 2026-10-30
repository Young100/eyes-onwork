import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Check, 
  Lock, 
  Eye, 
  FileText, 
  Layers, 
  HelpCircle, 
  ChevronDown, 
  Zap, 
  Star,
  Users
} from 'lucide-react';
import { DEFAULT_PLANS } from '../../data/plansAndWorkspaces';
import { BillingCycle, PlanId } from '../../types';
import { LegalModal, LegalDocType } from '../legal/LegalModal';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onFastDemoLogin: (type: 'admin' | 'free_limit' | 'pro_active' | 'expired_grace') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  onFastDemoLogin
}) => {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('annual');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [legalModalType, setLegalModalType] = useState<LegalDocType | null>(null);

  const faqs = [
    {
      q: 'Comment fonctionne le verrouillage anti-impayés des livrables ?',
      a: 'Tant que la facture de solde final n’est pas encaissée, vos fichiers sources haute définition (.AI, .PSD, .SVG, archives d’impression) restent chiffrés et scellés. Dès que le règlement est confirmé, le cadenas s’ouvre automatiquement pour votre client.'
    },
    {
      q: 'Mes clients doivent-ils créer un compte ou installer une application ?',
      a: 'Non ! Votre client reçoit un lien unique cryptographiquement sécurisé. Il clique et accède instantanément à son espace projet en verre pour valider le devis, annoter les maquettes et télécharger ses factures.'
    },
    {
      q: 'Quelle est la différence entre la formule Gratuite et la formule Pro ?',
      a: 'La formule Gratuite vous permet de gérer jusqu’à 3 projets actifs et 5 clients, avec un filigrane discret "Généré avec eyes-onwork" sur les PDF. La formule Pro supprime tous les quotas, retire les mentions, débloque vos relances automatiques et vos statistiques avancées.'
    },
    {
      q: 'Puis-je changer ou annuler mon abonnement à tout moment ?',
      a: 'Absolument. Tout se fait en un clic depuis votre espace. Si vous résiliez, vos données ne sont jamais supprimées : elles restent consultables en lecture seule et exportables au format ZIP à tout moment.'
    },
    {
      q: 'L’application est-elle adaptée aux devises internationales et FCFA ?',
      a: 'Oui, eyes-onwork prend en charge les devises avec centimes (€, $, CHF, CAD) ainsi que les devises sans décimales (FCFA XOF/XAF), avec calculs précis de TVA et mentions légales adaptées à chaque pays.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white selection:bg-[#f7c548]/30 selection:text-[#fce49c] relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#f7c548]/12 via-[#1A253E]/20 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-[800px] left-10 w-96 h-96 bg-[#162746]/30 blur-3xl pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0B0F1A]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] font-bold text-base flex items-center justify-center font-display shadow-lg shadow-black/50">
              EO
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight font-display text-white">
                eyes-onwork
              </span>
              <span className="text-[10px] text-[#f7c548] block font-semibold tracking-wider uppercase">
                Studio Platform
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#8E97AB]">
            <a href="#features" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#pipeline" className="hover:text-white transition-colors">
              Parcours Anti-Impayés
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Tarifs
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenLogin}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={onOpenRegister}
              className="py-2.5 px-4 sm:px-5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 active:scale-[0.98] shadow-lg shadow-[#f7c548]/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Créer mon studio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-8 z-10">
        
        {/* Floating Tag */}
        <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-[#f7c548]/12 border border-[#f7c548]/30 text-[#f7c548] text-xs font-semibold shadow-inner">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>Plateforme SaaS tout-en-un pour graphistes, designers & directeurs artistiques</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight font-display leading-[1.15] max-w-4xl mx-auto">
          Prenez le contrôle total de vos projets créatifs,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f7c548] via-[#fce49c] to-[#f7c548]">
            sans impayés ni retours infinis.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-lg text-[#8E97AB] max-w-2xl mx-auto leading-relaxed">
          De la première demande au solde final : cadrage du brief, devis conformes, espace de validation de maquettes avec annotations visuelles précises, et livraison sécurisée de vos fichiers sources.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onOpenRegister}
            className="w-full sm:w-auto py-4 px-8 rounded-2xl text-sm font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 active:scale-[0.98] shadow-xl shadow-[#f7c548]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer font-display"
          >
            <span>Démarrer gratuitement</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onFastDemoLogin('admin')}
            className="w-full sm:w-auto py-4 px-6 rounded-2xl text-xs font-semibold text-white/90 bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-[#f7c548]" />
            <span>Tester immédiatement (Compte Démo)</span>
          </button>
        </div>

        {/* Reassurances */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-[#8E97AB]">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#52BE80]" />
            <span>14 jours d’essai Pro offerts</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#52BE80]" />
            <span>Aucune carte bancaire requise</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#52BE80]" />
            <span>Conforme RGPD & étanchéité des données</span>
          </div>
        </div>

        {/* Fast Test Selector Bar for Demo Evaluation */}
        <div className="pt-8 max-w-2xl mx-auto">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="text-[11px] font-semibold text-[#f7c548] uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Accès direct aux comptes de test :</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => onFastDemoLogin('admin')}
                className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-[#f7c548]/20 border border-white/10 hover:border-[#f7c548] text-[11px] font-medium text-white transition-all text-center cursor-pointer"
              >
                👑 Super Admin
              </button>
              <button
                onClick={() => onFastDemoLogin('free_limit')}
                className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-[#f7c548]/20 border border-white/10 hover:border-[#f7c548] text-[11px] font-medium text-white transition-all text-center cursor-pointer"
              >
                📦 Gratuit (Quota 3/3)
              </button>
              <button
                onClick={() => onFastDemoLogin('pro_active')}
                className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-[#f7c548]/20 border border-white/10 hover:border-[#f7c548] text-[11px] font-medium text-white transition-all text-center cursor-pointer"
              >
                ✨ Pro (Illimité)
              </button>
              <button
                onClick={() => onFastDemoLogin('expired_grace')}
                className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-[#f7c548]/20 border border-white/10 hover:border-[#f7c548] text-[11px] font-medium text-white transition-all text-center cursor-pointer"
              >
                ⏳ Expiré (Grâce 7j)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto space-y-12 relative z-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display">
            Conçu exclusivement pour les professionnels de l'image
          </h2>
          <p className="text-xs sm:text-sm text-[#8E97AB] max-w-xl mx-auto">
            Chaque écran résout un irritant réel de la vie d'un studio créatif indépendant.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 space-y-4 hover:border-[#f7c548]/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Verrouillage Anti-Impayés
            </h3>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Vos fichiers sources vectoriels et exports d'impression restent scellés jusqu'à encaissement du solde final. Plus aucun logo livré sans être payé.
            </p>
          </div>

          <div className="glass-card p-6 space-y-4 hover:border-[#f7c548]/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Portail Client Sécurisé
            </h3>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Un lien unique chiffré sans mot de passe. Vos clients signent leur devis, annotent visuellement les pistes et téléchargent leurs reçus en autonomie.
            </p>
          </div>

          <div className="glass-card p-6 space-y-4 hover:border-[#f7c548]/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Gestion des Révisions
            </h3>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Compteur strict des tours de retours (ex: 3 révisions incluses). Pointage par épingles numérotées directement sur la maquette pour zéro quiproquo.
            </p>
          </div>

          <div className="glass-card p-6 space-y-4 hover:border-[#f7c548]/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Devis & Factures Pixel-Perfect
            </h3>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Génération PDF élégante avec typographies soignées, acomptes 50% automatiques, gestion multi-TVA et devises (€, $, FCFA).
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section with Dynamic Switcher */}
      <section id="pricing" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto space-y-12 relative z-10">
        <div className="text-center space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display">
            Des tarifs simples, transparents et sans engagement
          </h2>
          <p className="text-xs sm:text-sm text-[#8E97AB] max-w-xl mx-auto">
            Démarrez gratuitement, montez en puissance quand votre carnet de commandes se remplit.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setSelectedCycle('monthly')}
              className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCycle === 'monthly' ? 'bg-[#f7c548] text-[#0B0F1A] shadow-md' : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setSelectedCycle('semiannual')}
              className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCycle === 'semiannual' ? 'bg-[#f7c548] text-[#0B0F1A] shadow-md' : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              <span>Semestriel</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#52BE80] text-[#0B0F1A] rounded-full font-bold">
                -14%
              </span>
            </button>
            <button
              onClick={() => setSelectedCycle('annual')}
              className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCycle === 'annual' ? 'bg-[#f7c548] text-[#0B0F1A] shadow-md' : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              <span>Annuel</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#f7c548] text-[#0B0F1A] rounded-full font-bold">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {Object.values(DEFAULT_PLANS).map((plan) => {
            const isPro = plan.id === 'pro';
            const price = (plan as any).prices?.[selectedCycle] ?? (plan.priceMonthly || 0);
            const monthlyEquivalent = selectedCycle === 'annual'
              ? Math.round((price / 12) * 10) / 10
              : selectedCycle === 'semiannual'
              ? Math.round((price / 6) * 10) / 10
              : price;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all ${
                  isPro
                    ? 'bg-gradient-to-b from-[#1A253E]/90 to-[#0E1626]/95 border-2 border-[#f7c548] shadow-2xl shadow-[#f7c548]/20 scale-105 z-20'
                    : 'glass-card'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#f7c548] text-[#0B0F1A] rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-md">
                    Recommandé pour freelances
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white font-display">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-[#8E97AB] mt-1">
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-extrabold text-[#f7c548] font-display">
                        {price === 0 ? '0 €' : `${price} €`}
                      </span>
                      <span className="text-xs text-[#8E97AB]">
                        / {selectedCycle === 'monthly' ? 'mois' : selectedCycle === 'semiannual' ? '6 mois' : 'an'}
                      </span>
                    </div>
                    {price > 0 && selectedCycle !== 'monthly' && (
                      <span className="text-[11px] text-[#52BE80] block mt-1 font-semibold">
                        Soit {monthlyEquivalent} € / mois
                      </span>
                    )}
                  </div>

                  {/* Limits & features */}
                  <div className="space-y-3 pt-4 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
                      <span>
                        {plan.limits.maxActiveProjects >= 999
                          ? 'Projets actifs illimités'
                          : `${plan.limits.maxActiveProjects} projets actifs`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
                      <span>
                        {plan.limits.maxClients >= 999
                          ? 'Clients illimités'
                          : `${plan.limits.maxClients} fiches clients`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
                      <span>
                        {plan.limits.maxQuotesPerMonth >= 999
                          ? 'Devis & Factures illimités'
                          : `${plan.limits.maxQuotesPerMonth} devis / mois`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
                      <span>
                        {plan.limits.maxStorageMb >= 1000
                          ? `${Math.round(plan.limits.maxStorageMb / 1000)} Go de stockage cloud`
                          : `${plan.limits.maxStorageMb} Mo de stockage`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 ${plan.limits.hasWatermarkOnPdf ? 'text-[#8E97AB]' : 'text-[#f7c548]'}`} />
                      <span className={plan.limits.hasWatermarkOnPdf ? 'text-[#8E97AB]' : 'text-white font-semibold'}>
                        {plan.limits.hasWatermarkOnPdf ? 'Mention eyes-onwork sur PDF' : 'Zéro mention ni filigrane sur PDF'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 ${plan.limits.hasAutoReminders ? 'text-[#f7c548]' : 'text-[#8E97AB]'}`} />
                      <span className={plan.limits.hasAutoReminders ? 'text-white' : 'text-[#8E97AB]'}>
                        Relances automatiques des impayés
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={onOpenRegister}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isPro
                        ? 'bg-gradient-to-r from-[#f7c548] to-[#fce49c] text-[#0B0F1A] shadow-lg shadow-[#f7c548]/20 hover:opacity-95'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                    }`}
                  >
                    <span>{plan.id === 'free' ? 'Démarrer gratuitement' : 'Essayer Pro 14 jours'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-3xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#f7c548] uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Foire aux questions</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display">
            Des réponses claires à vos questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="glass-card overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer text-white font-semibold text-xs sm:text-sm"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#f7c548] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-[#8E97AB] leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070A12] py-12 px-4 sm:px-8 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#8E97AB]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#f7c548]/20 text-[#f7c548] font-bold text-xs flex items-center justify-center font-display">
              EO
            </div>
            <span>eyes-onwork © 2026 · Conçu avec excellence pour les créatifs indépendants</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => setLegalModalType('cgu')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Conditions d’utilisation
            </button>
            <button
              onClick={() => setLegalModalType('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Politique de confidentialité (RGPD)
            </button>
            <button
              onClick={() => setLegalModalType('subscription')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Conditions d’abonnement
            </button>
          </div>
        </div>
      </footer>

      {/* Legal documents viewer */}
      {legalModalType && (
        <LegalModal
          isOpen={true}
          documentType={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}
    </div>
  );
};
