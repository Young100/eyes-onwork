import React, { useState, useEffect } from 'react';
import { 
  Building, 
  User, 
  Globe, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Sparkles, 
  Palette, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomSelect } from '../common/CustomSelect';
import { COUNTRY_PRESETS } from '../../data/countryPresets';

export const OnboardingWizardGate: React.FC = () => {
  const { auth, profile, updateProfile, completeOnboarding } = useApp();

  // Step state: resume from profile.onboardingStep or 1
  const [step, setStep] = useState<number>(() => {
    const s = Number(profile.onboardingStep);
    return !isNaN(s) && s >= 1 && s <= 5 ? s : 1;
  });

  const [formData, setFormData] = useState({
    name: profile.name || auth.displayName || '',
    studioName: profile.studioName || '',
    specialty: profile.specialty || 'Direction Artistique & Design Graphique',
    logoUrl: profile.logoUrl || profile.avatarUrl || auth.photoURL || '',
    accentColor: profile.accentColor || '#f7c548',
    countryCode: profile.countryCode || 'FR',
    currency: profile.currency || 'EUR',
    timezone: profile.timezone || 'Europe/Paris',
    vatRate: profile.vatRate ?? 20,
    siret: profile.siret || '',
    address: profile.address || '',
    phone: profile.phone || '',
    website: profile.website || '',
    legalNotice: profile.legalNotice || '',
    iban: profile.iban || '',
    bic: profile.bic || '',
    depositCalculation: profile.depositCalculation || 'ttc'
  });

  const [uploadError, setUploadError] = useState('');
  const [stepError, setStepError] = useState('');

  // Persist current step progress
  useEffect(() => {
    updateProfile({ onboardingStep: step });
  }, [step]);

  // When country changes, auto-fill standard presets
  const handleCountryChange = (code: string) => {
    const preset = COUNTRY_PRESETS[code];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        countryCode: code,
        currency: preset.currency,
        timezone: preset.timeZone,
        vatRate: preset.defaultVatRate,
        legalNotice: prev.legalNotice ? prev.legalNotice : preset.legalNoticeTemplate
      }));
    } else {
      setFormData(prev => ({ ...prev, countryCode: code }));
    }
  };

  // Image Upload handler for Logo / Avatar
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Format non supporté. Veuillez téléverser un fichier JPG, PNG ou WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Taille trop volumineuse. Le fichier ne doit pas dépasser 5 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    setStepError('');
    if (step === 1) {
      if (!formData.name.trim() && !formData.studioName.trim()) {
        setStepError('Veuillez indiquer au moins votre nom ou le nom de votre studio.');
        return;
      }
    }
    const nextStep = Math.min(5, step + 1);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStepError('');
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleFinish = async () => {
    updateProfile({
      name: formData.name.trim() || 'Freelance',
      studioName: formData.studioName.trim() || formData.name.trim() || 'Mon Studio',
      specialty: formData.specialty,
      logoUrl: formData.logoUrl,
      avatarUrl: formData.logoUrl,
      accentColor: formData.accentColor,
      countryCode: formData.countryCode,
      currency: formData.currency,
      timezone: formData.timezone,
      vatRate: Number(formData.vatRate),
      siret: formData.siret.trim(),
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      website: formData.website.trim(),
      legalNotice: formData.legalNotice.trim(),
      iban: formData.iban.trim(),
      bic: formData.bic.trim(),
      onboardingCompleted: true,
      onboardingStep: 5
    });

    if (completeOnboarding) {
      await completeOnboarding(5);
    }
  };

  const accentPresets = ['#f7c548', '#5FB59A', '#6C82E8', '#f7c548', '#D9695F', '#9B51E0'];

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center justify-center relative z-10 animate-fadeIn">
      <div className="glass-modal max-w-2xl w-full p-6 sm:p-10 space-y-8 shadow-2xl text-white">
        
        {/* Progress Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#8E97AB]">
            <span className="font-semibold uppercase tracking-wider text-[#f7c548]">
              Configuration de votre studio · Étape {step}/5
            </span>
            <span>
              {step === 1 && 'Identité & Visuel'}
              {step === 2 && 'Fiscalité & Devise'}
              {step === 3 && 'Mentions légales & Contact'}
              {step === 4 && 'Paiements & Factures'}
              {step === 5 && 'Récapitulatif final'}
            </span>
          </div>

          {/* Stepper Progress bar */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s < step 
                    ? 'bg-[#5FB59A]' 
                    : s === step 
                      ? 'bg-[#f7c548]' 
                      : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {stepError && (
          <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#D9695F] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {/* STEP 1: Identité & Logo */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                1. Votre identité professionnelle
              </h2>
              <p className="text-xs text-[#8E97AB] mt-1">
                Ces informations apparaîtront sur vos devis, factures, emails et l’espace partagé avec vos clients.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Votre nom complet <span className="text-[#f7c548]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Alexandre Mercier"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Nom commercial ou Studio
                </label>
                <input
                  type="text"
                  value={formData.studioName}
                  onChange={e => setFormData({ ...formData, studioName: e.target.value })}
                  placeholder="Ex: Atelier Mercier Design"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                Spécialité créative
              </label>
              <input
                type="text"
                value={formData.specialty}
                onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="Ex: Direction Artistique, Identité visuelle, Typographie"
                className="w-full px-3.5 py-2.5 text-xs glass-input"
              />
            </div>

            {/* Logo Upload with preview */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <label className="block text-xs font-medium text-white">
                Logo ou Photo de profil du studio
              </label>
              <div className="flex items-center gap-4">
                {formData.logoUrl ? (
                  <div className="relative group">
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#f7c548]/50 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D9695F] text-white flex items-center justify-center text-[10px] cursor-pointer"
                      title="Supprimer l'image"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-[#8E97AB]">
                    <Upload className="w-6 h-6 stroke-[1.5]" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <input
                    type="file"
                    id="logo-upload-input"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-upload-input"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/20 transition-all cursor-pointer text-white"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choisir une image (JPG, PNG, WebP · Max 5 Mo)</span>
                  </label>
                  <p className="text-[11px] text-[#8E97AB] mt-1">
                    Sera affiché en haut de vos devis officiels et sur l'en-tête de vos emails.
                  </p>
                  {uploadError && (
                    <p className="text-xs text-[#D9695F] mt-1">{uploadError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8E97AB]">
                Couleur d’accent du studio
              </label>
              <div className="flex items-center gap-3">
                {accentPresets.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, accentColor: color })}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-xl transition-all cursor-pointer ${
                      formData.accentColor === color ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={e => setFormData({ ...formData, accentColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Couleur personnalisée"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Fiscalité & Devise */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                2. Pays, devise & TVA
              </h2>
              <p className="text-xs text-[#8E97AB] mt-1">
                Adaptez vos formats monétaires, calculs de TVA et fuseaux horaires.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Pays d’activité
                </label>
                <CustomSelect
                  value={formData.countryCode}
                  onChange={(val) => handleCountryChange(val)}
                  options={[
                    ...Object.entries(COUNTRY_PRESETS).map(([code, p]) => ({
                      value: code,
                      label: `${p.name} (${p.currency})`,
                      flag: p.flag,
                    })),
                    { value: 'AUTRE', label: 'Autre pays', flag: '🌍' }
                  ]}
                  sheetTitle="Pays d’activité"
                  searchable={true}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Devise de facturation
                </label>
                <CustomSelect
                  value={formData.currency}
                  onChange={(val) => setFormData({ ...formData, currency: val })}
                  options={[
                    { value: 'EUR', label: 'EUR (€) — Euro' },
                    { value: 'FCFA', label: 'FCFA — Franc CFA (XOF / XAF)' },
                    { value: 'CHF', label: 'CHF — Franc Suisse' },
                    { value: 'CAD', label: 'CAD ($) — Dollar Canadien' },
                    { value: 'USD', label: 'USD ($) — Dollar Américain' },
                    { value: 'GBP', label: 'GBP (£) — Livre Sterling' },
                  ]}
                  sheetTitle="Devise de facturation"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Taux de TVA standard (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.vatRate}
                  onChange={e => setFormData({ ...formData, vatRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
                <span className="text-[11px] text-[#8E97AB] block mt-1">
                  Indiquez 0 si vous êtes en franchise de TVA (micro-entreprise).
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Fuseau horaire
                </label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="Ex: Europe/Paris"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Coordonnées & Mentions Légales */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                3. Coordonnées & Mentions Légales
              </h2>
              <p className="text-xs text-[#8E97AB] mt-1">
                Mentions obligatoires sur vos devis et factures légales conformes au droit de votre pays.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  SIRET / Registre du commerce / N° fiscal
                </label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={e => setFormData({ ...formData, siret: e.target.value })}
                  placeholder="Ex: 849 201 928 00019"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Téléphone professionnel
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ex: +33 6 12 34 56 78"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Adresse postale professionnelle
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ex: 10 rue de la Création, 75001 Paris"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Site web ou Portfolio
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://monstudio.com"
                  className="w-full px-3.5 py-2.5 text-xs glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                Mentions légales obligatoires (pied de facture)
              </label>
              <textarea
                rows={3}
                value={formData.legalNotice}
                onChange={e => setFormData({ ...formData, legalNotice: e.target.value })}
                className="w-full px-3.5 py-2 text-xs glass-input leading-relaxed"
                placeholder="Règlement par virement sous 30 jours nets. Pénalités de retard..."
              />
            </div>
          </div>
        )}

        {/* STEP 4: Coordonnées de Paiement */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                4. Coordonnées de règlement
              </h2>
              <p className="text-xs text-[#8E97AB] mt-1">
                Vos coordonnées bancaires seront insérées sur chaque devis et facture pour être réglé par vos clients.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  IBAN / Numéro de compte bancaire
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={e => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="FR76 3000 4000 0000 1234 5678 901"
                  className="w-full px-3.5 py-2.5 text-xs font-mono glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  BIC / Code SWIFT
                </label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={e => setFormData({ ...formData, bic: e.target.value })}
                  placeholder="BNPAFRPPXXX"
                  className="w-full px-3.5 py-2.5 text-xs font-mono glass-input"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-[#8E97AB] space-y-2">
              <span className="font-semibold text-white block">
                Modalités par défaut appliquées aux devis :
              </span>
              <p>
                • Acompte standard à la commande : 50 %
              </p>
              <p>
                • Délai de règlement : 30 jours nets à réception de facture
              </p>
              <p>
                • Vous pourrez ajuster ces pourcentages et conditions sur chaque devis individuellement.
              </p>
            </div>
          </div>
        )}

        {/* STEP 5: Récapitulatif Final */}
        {step === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                5. Récapitulatif de votre studio
              </h2>
              <p className="text-xs text-[#8E97AB] mt-1">
                Tout est prêt ! Vérifiez la configuration avant d’accéder à votre espace de travail.
              </p>
            </div>

            {/* Studio Card Preview */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/30 space-y-4">
              <div className="flex items-center gap-4">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt="Logo"
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#f7c548]/40"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#f7c548] font-bold text-lg font-display">
                    {((formData.name || formData.studioName || 'S').slice(0, 2)).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white font-display">
                    {formData.studioName || formData.name}
                  </h3>
                  <div className="text-xs text-[#f7c548] font-medium">
                    {formData.name} · {formData.specialty}
                  </div>
                  <div className="text-[11px] text-[#8E97AB] mt-0.5">
                    {formData.address || 'Adresse non renseignée'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[10px] text-[#8E97AB] block">Devise</span>
                  <span className="font-semibold text-white">{formData.currency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8E97AB] block">TVA standard</span>
                  <span className="font-semibold text-white">{formData.vatRate} %</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8E97AB] block">SIRET</span>
                  <span className="font-semibold text-white truncate block">{formData.siret || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8E97AB] block">Paiement IBAN</span>
                  <span className="font-semibold text-white truncate block">{formData.iban ? 'Configuré' : 'Non renseigné'}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#5FB59A]/10 border border-[#5FB59A]/20 text-xs text-[#5FB59A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Votre espace démarre sur une base vierge et propre, prête à accueillir vos premiers clients.</span>
            </div>
          </div>
        )}

        {/* Navigation Buttons Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#f7c548]/20"
            >
              <span>Continuer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-3 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>Entrer dans mon espace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
