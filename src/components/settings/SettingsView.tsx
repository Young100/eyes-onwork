import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Check, 
  Sparkles, 
  Building, 
  ShieldCheck, 
  CreditCard, 
  DollarSign, 
  Moon, 
  Sun,
  Palette
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomSelect } from '../common/CustomSelect';

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, theme, toggleTheme } = useApp();
  const [form, setForm] = useState({ ...profile });
  const [saved, setSaved] = useState(false);
  const isLight = theme === 'light';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-4xl mx-auto animate-fadeIn pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-[var(--text-primary)]">
            Paramètres du Studio
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Personnalisation visuelle, coordonnées légales, devises et préférences d'automatisation
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] text-xs font-bold animate-fadeIn">
            <Check size={14} className="stroke-[2.5]" />
            <span>Paramètres enregistrés</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* 1. Apparence & Thème de l'interface (Design System Lumina / Aurelia) */}
        <div className="glass-panel p-5 sm:p-7 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-subtle)] text-[#f7c548] font-bold text-sm">
            <Palette size={18} />
            <span>Apparence & Univers Visuel</span>
          </div>

          <div className="space-y-2">
            <label className="block text-[var(--text-secondary)] font-medium">
              Thème actif de la plateforme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option Mode Sombre (Aurelia) */}
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') toggleTheme();
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#f7c548] bg-[#1a0a3a] ring-2 ring-[#f7c548]/20 shadow-lg'
                    : 'border-[var(--border-color)] bg-[var(--card-surface-alt)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#0f0326] border border-[#f7c548]/40 flex items-center justify-center text-[#f7c548] shrink-0">
                  <Moon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#eeebd3]">Mode Sombre (Aurelia)</span>
                    {theme === 'dark' && (
                      <span className="w-2 h-2 rounded-full bg-[#f7c548]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#8a7968] mt-0.5 leading-tight">
                    Fond violet minuit profond (#0f0326), surfaces (#1a0a3a) et accents dorés (#f7c548).
                  </p>
                </div>
              </button>

              {/* Option Mode Clair (Lumina) */}
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') toggleTheme();
                }}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#f7c548] bg-white ring-2 ring-[#f7c548]/25 shadow-lg'
                    : 'border-[var(--border-color)] bg-[var(--card-surface-alt)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#fef4db] border border-[#f7c548]/60 flex items-center justify-center text-[#b37d0c] shrink-0">
                  <Sun size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1d1335]">Mode Clair (Lumina)</span>
                    {theme === 'light' && (
                      <span className="w-2 h-2 rounded-full bg-[#f7c548]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#7a6c62] mt-0.5 leading-tight">
                    Fond ivoire / crème doux (#faf7f0), cartes blanches épurées et accents or chaud (#f7c548).
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Identité Studio */}
        <div className="glass-panel p-5 sm:p-7 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-subtle)] text-[#f7c548] font-bold text-sm">
            <Building size={18} />
            <span>Identité Professionnelle & Mentions Légales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Nom du Studio / Agence *</label>
              <input
                type="text"
                value={form.studioName}
                onChange={(e) => setForm({ ...form, studioName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#f7c548]"
                required
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Nom & Prénom du Designer *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#f7c548]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Email professionnel</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#f7c548]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Téléphone / WhatsApp</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#f7c548]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Adresse postale complète</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#f7c548]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Numéro SIRET</label>
              <input
                type="text"
                value={form.siret || ''}
                onChange={(e) => setForm({ ...form, siret: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Numéro TVA Intracommunautaire</label>
              <input
                type="text"
                value={form.tvaNumber || ''}
                onChange={(e) => setForm({ ...form, tvaNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>
          </div>
        </div>

        {/* 3. Facturation & Coordonnées bancaires */}
        <div className="glass-panel p-5 sm:p-7 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-subtle)] text-[#f7c548] font-bold text-sm">
            <CreditCard size={18} />
            <span>Règlements & Paramètres de Devis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Devise principale</label>
              <CustomSelect
                value={form.currency || 'EUR'}
                onChange={(val) => setForm({ ...form, currency: val })}
                options={[
                  { value: 'EUR', label: 'Euros (€)' },
                  { value: 'FCFA', label: 'Francs CFA (FCFA)' },
                  { value: 'USD', label: 'Dollars ($)' },
                  { value: 'GBP', label: 'Livres (£)' }
                ]}
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Taux de TVA par défaut (%)</label>
              <input
                type="number"
                value={form.defaultVatRate}
                onChange={(e) => setForm({ ...form, defaultVatRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Acompte par défaut (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.defaultDepositPercent}
                onChange={(e) => setForm({ ...form, defaultDepositPercent: parseFloat(e.target.value) || 50 })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">IBAN de réception</label>
              <input
                type="text"
                value={form.iban || ''}
                onChange={(e) => setForm({ ...form, iban: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Code BIC / SWIFT</label>
              <input
                type="text"
                value={form.bic || ''}
                onChange={(e) => setForm({ ...form, bic: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border font-mono focus:outline-none focus:border-[#f7c548]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Conditions générales par défaut (devis)</label>
            <textarea
              rows={2}
              value={form.termsTemplate}
              onChange={(e) => setForm({ ...form, termsTemplate: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border focus:outline-none focus:border-[#f7c548]"
            />
          </div>

          {/* Toggle Automatisme Livraison */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--card-surface-alt)] border border-[var(--border-subtle)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoUnlockDeliveryOnFullPayment}
                onChange={(e) => setForm({ ...form, autoUnlockDeliveryOnFullPayment: e.target.checked })}
                className="w-4 h-4 rounded text-[#f7c548] accent-[#f7c548]"
              />
              <div>
                <span className="font-semibold block text-[var(--text-primary)]">Déverrouillage automatique de la livraison</span>
                <span className="text-[var(--text-secondary)] text-[11px]">
                  Déverrouille instantanément le dossier des fichiers sources du client dès que la facture de solde est réglée.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0f0326] font-bold text-xs shadow-lg shadow-[#f7c548]/20 cursor-pointer transition-colors"
          >
            <Save size={16} />
            <span>Enregistrer les préférences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
