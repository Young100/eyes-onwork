import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  BookOpen, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Lock, 
  Mail, 
  CreditCard,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose, onOpenPrivacy }) => {
  const [activeTab, setActiveTab] = useState<'journey' | 'faq'>('journey');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const faqs = [
    {
      q: "Comment fonctionne le verrouillage anti-impayés des livrables finaux ?",
      a: "Par défaut, les livrables d'impression haute définition et les fichiers sources vectoriels (.AI, .PSD, .PDF) restent strictement inaccessibles et verrouillés pour le client tant que le solde restant dû n'a pas été enregistré à 100%. Vous gardez également la possibilité de les débloquer manuellement si vous accordez un délai particulier."
    },
    {
      q: "Comment mes clients accèdent-ils à leur espace sans créer de compte ?",
      a: "Chaque projet génère un jeton cryptographique aléatoire de 48 caractères (clientShareToken). Le client clique simplement sur son lien unique reçu par email ou WhatsApp et accède directement à son espace sans mot de passe à retenir. Le lien est révocable en 1 clic par le graphiste en cas de litige."
    },
    {
      q: "Mes devis sont-ils modifiables après signature ?",
      a: "Non. Conformément aux règles d'intégrité juridique et fiscale, dès lors qu'un devis est validé et signé par le client, son contenu et ses montants sont définitivement scellés et inaltérables. En cas de prestation additionnelle, vous pouvez générer un avenant ou un devis complémentaire."
    },
    {
      q: "Comment fonctionne la facturation en FCFA ou sans décimales ?",
      a: "Lorsque vous sélectionnez un pays de la zone FCFA (Côte d'Ivoire, Sénégal, Cameroun), le moteur de calcul formate automatiquement les montants sans aucune décimale inutile (pas de ',00'), respectant ainsi les conventions de la zone OHADA / UEMOA."
    },
    {
      q: "Puis-je supprimer toutes les données d'un client (RGPD / Droit à l'oubli) ?",
      a: "Oui. Dans la fiche client, l'action 'Supprimer définitivement' permet de purger le client ainsi que l'ensemble de ses devis, factures et fichiers associés, tout en inscrivant une ligne d'audit sécurisée sans conservation de données personnelles."
    },
    {
      q: "Comment configurer l'envoi d'emails transactionnels avec mon adresse Gmail ?",
      a: "Générez un mot de passe d'application dans votre compte Google (Sécurité > Validation en deux étapes > Mots de passe des applications). Renseignez ensuite GMAIL_USER et GMAIL_APP_PASSWORD dans les secrets d'environnement. Le serveur utilise le port 465 (SSL) pour délivrer vos emails avec un taux de délivrabilité maximal."
    }
  ];

  const steps = [
    { num: '01', title: 'Demande publique reçue', desc: 'Le prospect soumet ses besoins via votre formulaire public ou QR code (anti-spam honeypot).' },
    { num: '02', title: 'Cadrage du brief créatif', desc: 'Vous affinez les objectifs, le style visuel attendu et les formats à livrer.' },
    { num: '03', title: 'Émission du devis chiffré', desc: 'Génération du devis officiel avec calcul automatique de TVA et acompte (50%).' },
    { num: '04', title: 'Signature & Acceptation', desc: 'Le client signe en ligne depuis son portail sécurisé. Le devis est scellé.' },
    { num: '05', title: 'Encaissement de l’acompte', desc: 'Enregistrement du règlement d’acompte et émission du reçu officiel automatique.' },
    { num: '06', title: 'Phase de création graphique', desc: 'Recherches, conception des pistes créatives et partage des maquettes annotables.' },
    { num: '07', title: 'Cycle de retours & révisions', desc: 'Le client annote précisément les points à ajuster dans la limite du forfait (ex: 3 tours).' },
    { num: '08', title: 'Validation finale de la maquette', desc: 'Le client confirme le BAT (Bon à Tirer) définitif en 1 clic.' },
    { num: '09', title: 'Facturation du solde', desc: 'Émission de la facture de solde restant dû (50%).' },
    { num: '10', title: 'Règlement intégral', desc: 'Encaissement du solde par virement, espèces ou Mobile Money.' },
    { num: '11', title: 'Déblocage des livrables finaux', desc: 'Les fichiers sources (.AI, .PSD) et exports HD d’impression sont automatiquement déverrouillés.' },
    { num: '12', title: 'Avis client & Clôture', desc: 'Collecte d’une note et d’un témoignage pour booster votre réputation de studio.' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl my-auto glass-panel p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7c548]/20 flex items-center justify-center text-[#f7c548] border border-[#f7c548]/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display">
                Centre d'Aide &amp; Guide du Studio
              </h2>
              <p className="text-xs text-[#8E97AB]">
                Documentation pratique du flux de projet, règles de gestion et foire aux questions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8E97AB] hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('journey')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'journey'
                ? 'bg-[#f7c548] text-[#0B0F1A] font-bold shadow-sm'
                : 'text-[#8E97AB] hover:text-white'
            }`}
          >
            Parcours complet d'un projet (12 étapes)
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-[#f7c548] text-[#0B0F1A] font-bold shadow-sm'
                : 'text-[#8E97AB] hover:text-white'
            }`}
          >
            Foire Aux Questions (FAQ)
          </button>
        </div>

        {/* Tab 1: Project Journey */}
        {activeTab === 'journey' && (
          <div className="space-y-4 animate-fadeIn max-h-[60vh] overflow-y-auto pr-2">
            <div className="p-3.5 rounded-xl bg-[#f7c548]/10 border border-[#f7c548]/25 text-xs text-[#eeebd3] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span>
                Le flux eyes-onwork protège le graphiste à chaque étape contre le travail non rémunéré et les retours infinis.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {steps.map(s => (
                <div key={s.num} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{s.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-[#f7c548]">{s.num}</span>
                  </div>
                  <p className="text-[11px] text-[#8E97AB] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-3 animate-fadeIn max-h-[60vh] overflow-y-auto pr-2">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#f7c548]" /> : <ChevronDown className="w-4 h-4 text-[#8E97AB]" />}
                  </button>
                  {isOpen && (
                    <div className="p-3.5 pt-0 text-[11px] text-[#8E97AB] leading-relaxed border-t border-white/5 bg-black/20">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with Privacy & Legal links */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-[#8E97AB]">
          <span>eyes-onwork v4.0 · Conforme RGPD &amp; Directives fiscales</span>
          {onOpenPrivacy && (
            <button
              onClick={() => {
                onClose();
                onOpenPrivacy();
              }}
              className="text-[#f7c548] hover:underline cursor-pointer font-medium self-start sm:self-auto"
            >
              Consulter la politique de confidentialité &amp; mentions légales &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
