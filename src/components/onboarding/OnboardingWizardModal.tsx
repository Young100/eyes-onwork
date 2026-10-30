import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Globe, 
  User, 
  FileText, 
  Package, 
  Mail, 
  Trash2,
  CheckCircle2,
  Building,
  Send,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { COUNTRY_PRESETS } from '../../data/countryPresets';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, resetDemoData } = useApp();

  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState({
    name: profile.name || '',
    studioName: profile.studioName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    countryCode: profile.countryCode || 'FR',
    currency: profile.currency || 'EUR',
    vatRate: profile.vatRate ?? 20,
    legalNotice: profile.legalNotice || '',
    iban: profile.iban || '',
    // First catalog service
    catalogTitle: 'Création d’Identité Visuelle & Logo',
    catalogCategory: 'Identité de marque',
    catalogPrice: profile.currency === 'FCFA' ? 250000 : 1500,
    catalogDescription: 'Conception du logotype vectoriel, palette de couleurs, typographies et guide de marque PDF.'
  });

  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [hasCleanedDemo, setHasCleanedDemo] = useState(false);

  if (!isOpen) return null;

  const handleCountryChange = (code: string) => {
    const preset = COUNTRY_PRESETS[code];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        countryCode: code,
        currency: preset.currency,
        vatRate: preset.defaultVatRate,
        legalNotice: preset.legalNoticeTemplate,
        catalogPrice: preset.isZeroDecimal ? 250000 : 1500
      }));
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    setTestEmailStatus(null);
    try {
      const resp = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: formData.email || profile.email })
      });
      const data = await resp.json();
      if (data.success) {
        setTestEmailStatus(`Email de test transmis avec succès à ${formData.email || profile.email} !`);
      } else {
        setTestEmailStatus(`Note : ${data.error || 'Vérification SMTP en mode simulation transparent.'}`);
      }
    } catch {
      setTestEmailStatus('Impossible de contacter le serveur de test.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleFinish = () => {
    // 1. Sauvegarder profil
    updateProfile({
      name: formData.name,
      studioName: formData.studioName,
      email: formData.email,
      phone: formData.phone,
      countryCode: formData.countryCode,
      currency: formData.currency,
      vatRate: formData.vatRate,
      legalNotice: formData.legalNotice,
      iban: formData.iban
    });

    // 2. Enregistrer la première prestation personnalisée
    if (formData.catalogTitle.trim()) {
      try {
        const stored = localStorage.getItem('eyesonwork_custom_catalog');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift({
          id: `cat_${Date.now()}`,
          title: formData.catalogTitle.trim(),
          category: formData.catalogCategory,
          basePrice: Number(formData.catalogPrice),
          description: formData.catalogDescription.trim(),
          estimatedDays: 14,
          deliverables: ['Logo vectoriel (.AI, .SVG, .PNG)', 'Guide de marque PDF']
        });
        localStorage.setItem('eyesonwork_custom_catalog', JSON.stringify(list));
      } catch {
        // Mode mémoire
      }
    }

    onClose();
  };

  const handlePurgeDemo = () => {
    if (window.confirm('Voulez-vous supprimer toutes les données de démonstration pour démarrer avec un studio vierge ?')) {
      resetDemoData();
      setHasCleanedDemo(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl my-auto glass-panel p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7c548]/20 flex items-center justify-center text-[#f7c548] border border-[#f7c548]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display">
                Assistant de démarrage eyes-onwork
              </h2>
              <p className="text-xs text-[#8E97AB]">
                Configurez votre studio en 5 étapes clés avant d'accueillir vos premiers vrais clients.
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

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 text-xs">
          {[1, 2, 3, 4, 5].map(st => (
            <div key={st} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step === st 
                  ? 'bg-[#f7c548] text-[#0B0F1A]' 
                  : step > st 
                  ? 'bg-[#5FB59A] text-[#0B0F1A]' 
                  : 'bg-white/10 text-[#8E97AB]'
              }`}>
                {step > st ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : st}
              </span>
              <span className="hidden sm:inline text-[11px] text-[#8E97AB]">
                {st === 1 && 'Profil'}
                {st === 2 && 'Fiscalité'}
                {st === 3 && 'Légal'}
                {st === 4 && 'Prestation'}
                {st === 5 && 'Vérification'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Profil & Studio */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#f7c548]" />
                Étape 1 : Votre Identité &amp; Studio Graphique
              </h3>
              <p className="text-xs text-[#8E97AB]">Ces informations apparaîtront sur vos devis, factures et portails clients.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Votre Nom complet *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Abdoulaye Ouattara ou Studio Design"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Nom du Studio ou Marque *</label>
                <input
                  type="text"
                  required
                  value={formData.studioName}
                  onChange={e => setFormData({ ...formData, studioName: e.target.value })}
                  placeholder="ex: Atelier Studio Graphique"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Adresse Email professionnelle *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@monstudio.com"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Téléphone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+33 6 00 00 00 00 ou +225 07..."
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pays, Devise & Fiscalité */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#f7c548]" />
                Étape 2 : Pays, Devise &amp; Régime de TVA
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Le choix du pays adapte automatiquement la devise (€, FCFA, CHF) et les taux fiscaux.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {Object.values(COUNTRY_PRESETS).map(cp => (
                <button
                  key={cp.code}
                  type="button"
                  onClick={() => handleCountryChange(cp.code)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    formData.countryCode === cp.code
                      ? 'bg-[#f7c548]/20 border-[#f7c548] text-white shadow-sm'
                      : 'bg-white/[0.02] border-white/10 text-[#8E97AB] hover:text-white'
                  }`}
                >
                  <span className="text-xl block mb-1">{cp.flag}</span>
                  <span className="text-xs font-bold block text-white">{cp.name}</span>
                  <span className="text-[10px] text-[#f7c548] block font-mono">{cp.currency} · TVA {cp.defaultVatRate}%</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Devise de facturation</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 text-xs glass-input font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Taux de TVA par défaut (%)</label>
                <input
                  type="number"
                  value={formData.vatRate}
                  onChange={e => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Mentions légales & Règlement */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f7c548]" />
                Étape 3 : Mentions Légales &amp; Coordonnées de Règlement
              </h3>
              <p className="text-xs text-[#8E97AB]">Ces mentions légales apparaîtront au bas de vos devis et factures officiels.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Mentions Légales &amp; Conditions Générales</label>
                <textarea
                  rows={4}
                  value={formData.legalNotice}
                  onChange={e => setFormData({ ...formData, legalNotice: e.target.value })}
                  className="w-full px-3 py-2 text-xs glass-input resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Coordonnées Bancaires / Mobile Money</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={e => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="ex: IBAN FR76... ou Wave / Orange Money +225..."
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Première prestation catalogue */}
        {step === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#f7c548]" />
                Étape 4 : Votre Première Prestation au Catalogue
              </h3>
              <p className="text-xs text-[#8E97AB]">Pré-enregistrez une formule pour générer des devis en 1 clic.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1">Titre de la prestation</label>
                  <input
                    type="text"
                    value={formData.catalogTitle}
                    onChange={e => setFormData({ ...formData, catalogTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1">Tarif de base ({formData.currency})</label>
                  <input
                    type="number"
                    value={formData.catalogPrice}
                    onChange={e => setFormData({ ...formData, catalogPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs glass-input font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">Description des livrables inclus</label>
                <textarea
                  rows={2}
                  value={formData.catalogDescription}
                  onChange={e => setFormData({ ...formData, catalogDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs glass-input resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Vérification & Purge démo */}
        {step === 5 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5FB59A]" />
                Étape 5 : Test SMTP &amp; Prêt pour la Production
              </h3>
              <p className="text-xs text-[#8E97AB]">Validez votre configuration pour accueillir vos premiers clients en toute sérénité.</p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-semibold text-white block">Test d'envoi d'email transactionnel</strong>
                  <span className="text-[11px] text-[#8E97AB]">Envoie un email d'essai vers {formData.email || profile.email}.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#06665F] hover:bg-[#044b46] cursor-pointer transition-all"
                >
                  {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Tester l'envoi</span>
                </button>
              </div>

              {testEmailStatus && (
                <div className="p-2.5 rounded-lg bg-[#5FB59A]/15 border border-[#5FB59A]/30 text-white text-[11px] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#5FB59A]" />
                  <span>{testEmailStatus}</span>
                </div>
              )}
            </div>

            {/* Clean Demo Data Button */}
            <div className="p-4 rounded-xl bg-[#f20000]/10 border border-[#f20000]/20 flex items-center justify-between gap-4">
              <div>
                <strong className="text-xs font-bold text-white block">Purge des données d'exemple</strong>
                <span className="text-[11px] text-[#8E97AB] block">
                  Supprime les clients fictifs pour repartir avec un espace vierge et propre.
                </span>
              </div>
              <button
                type="button"
                onClick={handlePurgeDemo}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#f20000] hover:bg-[#d00000] transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{hasCleanedDemo ? 'Données purgées !' : 'Supprimer les démos'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#8E97AB] hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-md"
            >
              <span>Continuer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] transition-all cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Valider &amp; Ouvrir mon Studio</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
