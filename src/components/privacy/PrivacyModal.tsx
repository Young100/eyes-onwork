import React, { useState } from 'react';
import { X, ShieldCheck, Lock, Check, FileText, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile } = useApp();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
  const [isEditing, setIsEditing] = useState(false);

  const defaultPrivacy = `Politique de Confidentialité et Protection des Données Personnelles (RGPD & lois locales applicables) :

1. Responsable de traitement : ${profile.studioName || profile.name} (${profile.email}).
2. Données collectées : Les informations traitées (nom, email, téléphone, raison sociale, adresse de facturation, spécifications créatives, maquettes et retours) sont exclusivement nécessaires à l'exécution de la relation commerciale (cadrage, émission de devis, facturation, suivi de projet et livraison).
3. Durée de conservation : Les pièces comptables (factures et devis validés) sont conservées pendant la durée légale en vigueur (10 ans). Les fichiers créatifs et briefs sont archivés de façon sécurisée pendant la durée du projet et jusqu'à 3 ans après la dernière collaboration.
4. Absence totale de traçage publicitaire : L'application n'utilise aucun traceur publicitaire tiers, cookie non essentiel ou régie de revente de données.
5. Droits des utilisateurs (Droit à l'oubli / Rectification) : Conformément au RGPD et aux législations applicables, vous pouvez demander l'accès, la rectification ou l'effacement définitif de vos données personnelles par simple email à ${profile.email}.`;

  const defaultTerms = `Conditions Générales d'Utilisation et de Prestation Graphique (CGU / CGV) :

1. Objet : Les présentes conditions régissent les relations entre le studio ${profile.studioName || profile.name} et ses clients pour toute prestation de design graphique, identité visuelle, packaging ou création éditoriale.
2. Devis et Acompte : Tout projet débute après validation formelle du devis et encaissement d'un acompte de 50 %. Les devis signés sont définitifs et inaltérables.
3. Révisions : Chaque prestation comprend un nombre défini de tours de retours (généralement 3 révisions incluses). Toute modification supplémentaire fait l'objet d'une tarification additionnelle selon le catalogue en vigueur.
4. Cession des droits d'auteur : Les droits patrimoniaux de reproduction et de représentation des créations graphiques ne sont transférés au client qu'après règlement intégral et effectif du solde de la facture finale.
5. Verrouillage des livrables : Les fichiers sources vectoriels et exports haute définition sont protégés et débloqués uniquement après confirmation du complet paiement.
6. Droit applicable : Droit du pays d'immatriculation du studio. En cas de litige, recherche prioritaire d'une solution amiable.`;

  const [privacyText, setPrivacyText] = useState(profile.legalNoticesByCountry?.privacy || defaultPrivacy);
  const [termsText, setTermsText] = useState(profile.legalNoticesByCountry?.terms || defaultTerms);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    updateProfile({
      legalNoticesByCountry: {
        ...(profile.legalNoticesByCountry || {}),
        privacy: privacyText,
        terms: termsText
      }
    });
    setIsEditing(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl glass-panel p-6 sm:p-8 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#5FB59A]/20 text-[#5FB59A]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display">
                Documents Légaux &amp; Confidentialité
              </h2>
              <p className="text-xs text-[#8E97AB]">
                Modèles conformes RGPD et protection juridique pour votre studio et vos clients.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#8E97AB] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedToast && (
          <div className="p-2.5 rounded-xl bg-[#5FB59A]/20 text-[#5FB59A] text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Textes juridiques enregistrés avec succès !</span>
          </div>
        )}

        {/* Legal Advice Reminder Alert */}
        <div className="p-3 rounded-xl bg-[#f7c548]/10 border border-[#f7c548]/30 text-xs text-[#eeebd3] flex items-start gap-2.5 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-[#f7c548] shrink-0 mt-0.5" />
          <span>
            <strong>Recommandation professionnelle :</strong> Ces modèles sont fournis à titre de trame de référence. Pour une protection optimale adaptée à votre structure, faites relire ces documents par un avocat ou juriste spécialisé de votre pays.
          </span>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => { setActiveTab('privacy'); setIsEditing(false); }}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-[#f7c548] text-[#0B0F1A] font-bold shadow-sm'
                  : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              Politique de Confidentialité
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('terms'); setIsEditing(false); }}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-[#f7c548] text-[#0B0F1A] font-bold shadow-sm'
                  : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              Conditions Générales (CGU / CGV)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-[#f7c548] hover:underline cursor-pointer font-semibold"
          >
            {isEditing ? 'Aperçu du texte' : 'Personnaliser'}
          </button>
        </div>

        {/* Text Area or Preview */}
        <div className="space-y-3">
          {isEditing ? (
            <textarea
              rows={12}
              value={activeTab === 'privacy' ? privacyText : termsText}
              onChange={e => {
                if (activeTab === 'privacy') setPrivacyText(e.target.value);
                else setTermsText(e.target.value);
              }}
              className="w-full p-3 glass-input text-xs font-mono resize-none leading-relaxed"
            />
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-[#F1F3F8]/90 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {activeTab === 'privacy' ? privacyText : termsText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8E97AB]">
            <Lock className="w-3.5 h-3.5 text-[#5FB59A]" />
            <span>Aucun traceur publicitaire tiers · 100% conforme sans bandeau intrusif</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
              >
                Enregistrer les modifications
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
