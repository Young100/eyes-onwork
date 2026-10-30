import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, ArrowRight, ExternalLink, Scale, LogOut, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LegalModal, LegalDocType } from '../legal/LegalModal';
import { CURRENT_TERMS_VERSION } from '../../config/termsConfig';

export const TermsAcceptanceGate: React.FC = () => {
  const { auth, acceptCurrentTerms, logout } = useApp();
  const [cguAccepted, setCguAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAcceptAll = async () => {
    if (!cguAccepted || !privacyAccepted) {
      setError('Veuillez cocher les deux cases pour accepter les conditions d’utilisation et la politique de confidentialité.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const res = await (acceptCurrentTerms as any)(CURRENT_TERMS_VERSION);
      if (res && res.success === false) {
        setError(res.error || "Échec de l’enregistrement de votre acceptation sur le serveur. Veuillez vérifier votre connexion et réessayer.");
      }
    } catch (err: any) {
      setError(err?.message || "Une erreur inattendue est survenue lors de l'enregistrement de vos conditions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 animate-fadeIn">
      <div className="glass-modal max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-white">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] shadow-lg shadow-black/40">
            <Scale className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white">
            Conditions d’utilisation & Confidentialité
          </h1>
          <p className="text-xs text-[#8E97AB] leading-relaxed max-w-md mx-auto">
            Bienvenue sur eyes-onwork. Pour garantir la conformité juridique de votre espace, la protection de vos livrables et le respect du RGPD, veuillez accepter les conditions en vigueur (version {CURRENT_TERMS_VERSION}).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#D9695F] text-xs">
            {error}
          </div>
        )}

        {/* Legal summary highlights */}
        <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-[#8E97AB]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#f7c548] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Propriété et Cession des droits :</span> Vos créations restent votre propriété jusqu’au règlement complet des factures de vos clients.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#f7c548] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Confidentialité & RGPD :</span> Vos données professionnelles et fichiers clients sont cryptés et ne sont jamais revendus à des tiers.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#f7c548] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Sécurité des liens clients :</span> Chaque projet dispose d’un jeton d’accès sécurisé unique et révocable à tout moment.
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={cguAccepted}
              onChange={(e) => {
                setCguAccepted(e.target.checked);
                setError('');
              }}
              className="mt-0.5 w-4 h-4 rounded border-white/20 text-[#f7c548] focus:ring-[#f7c548] accent-[#f7c548]"
            />
            <div className="text-xs">
              <span className="text-white font-medium">
                J’accepte les Conditions Générales d’Utilisation (v{CURRENT_TERMS_VERSION})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveLegalDoc('cgu');
                }}
                className="ml-2 text-[#f7c548] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Lire le document</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => {
                setPrivacyAccepted(e.target.checked);
                setError('');
              }}
              className="mt-0.5 w-4 h-4 rounded border-white/20 text-[#f7c548] focus:ring-[#f7c548] accent-[#f7c548]"
            />
            <div className="text-xs">
              <span className="text-white font-medium">
                J’accepte la Politique de Confidentialité et le traitement de mes données
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveLegalDoc('privacy');
                }}
                className="ml-2 text-[#f7c548] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Lire le document</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </label>
        </div>

        {/* Continue Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleAcceptAll}
            disabled={!cguAccepted || !privacyAccepted || isSubmitting}
            className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              cguAccepted && privacyAccepted && !isSubmitting
                ? 'text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] shadow-md shadow-[#f7c548]/20'
                : 'text-[#8E97AB] bg-white/10 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#0B0F1A]" />
                <span>Enregistrement sur le serveur...</span>
              </>
            ) : (
              <>
                <span>Accepter et continuer vers la configuration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={logout}
              className="text-xs text-[#8E97AB] hover:text-[#D9695F] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Modal Viewer for Legal text */}
      {activeLegalDoc && (
        <LegalModal
          isOpen={true}
          documentType={activeLegalDoc}
          onClose={() => setActiveLegalDoc(null)}
        />
      )}
    </div>
  );
};
