import React, { useState } from 'react';
import { X, Sparkles, Check, ShieldCheck, Zap, AlertTriangle, ArrowRight, Tag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BillingCycle, PlanId, PromoCode } from '../../types';
import { DEFAULT_PLANS } from '../../data/plansAndWorkspaces';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  const { currentWorkspace, changePlan, promoCodes } = useApp();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('annual');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const proPlan = (DEFAULT_PLANS as any).pro || Object.values(DEFAULT_PLANS)[1];
  const rawPrice = proPlan?.prices?.[selectedCycle] ?? proPlan?.priceMonthly ?? 29;
  const discountPercent = promoDiscount > 0 ? promoDiscount : 0;
  const finalPrice = Math.max(0, Math.round(rawPrice * (1 - discountPercent / 100)));

  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    const matched = promoCodes.find((p: PromoCode) => p.code.toUpperCase() === code && p.active);
    if (matched) {
      setPromoDiscount(matched.discountPercent);
      setPromoMessage({
        type: 'success',
        text: `Code appliqué ! -${matched.discountPercent} % sur votre souscription.`
      });
    } else {
      setPromoDiscount(0);
      setPromoMessage({
        type: 'error',
        text: 'Code promotionnel introuvable ou expiré.'
      });
    }
  };

  const handleConfirmUpgrade = async () => {
    setIsProcessing(true);
    setSuccessNote(null);

    const res = await changePlan('pro', selectedCycle, promoCodeInput.trim() || undefined);
    setIsProcessing(false);

    if (res.success) {
      setSuccessNote(res.message);
      setTimeout(() => {
        onClose();
        setSuccessNote(null);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0B0F1A]/95 border border-[#f7c548]/30 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-white">
        
        {/* Glow halo */}
        <div className="absolute top-0 right-1/4 w-80 h-40 bg-[#f7c548]/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#f7c548]/30 to-[#f7c548]/10 border border-[#f7c548]/40 text-[#f7c548]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  Passez à la formule Pro
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f7c548] text-[#0B0F1A]">
                  Illimité
                </span>
              </div>
              <p className="text-xs text-[#8E97AB]">
                Supprimez tous les quotas et personnalisez votre studio à 100%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Reason Alert if triggered by a limit */}
          {reason && (
            <div className="p-3.5 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 flex items-start gap-3 text-xs text-[#F29B9B]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{reason}</span>
            </div>
          )}

          {/* Billing Cycle Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8E97AB] uppercase tracking-wider block">
              Choisissez votre formule de facturation :
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedCycle('monthly')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  selectedCycle === 'monthly'
                    ? 'bg-[#f7c548]/20 border-[#f7c548] text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-[#8E97AB] hover:border-white/20'
                }`}
              >
                <div className="text-xs font-bold text-white">Mensuel</div>
                <div className="text-sm font-extrabold text-[#f7c548] mt-0.5">29 €</div>
                <div className="text-[10px] text-[#8E97AB]">Sans engagement</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCycle('semiannual')}
                className={`p-3 rounded-2xl border text-center transition-all relative cursor-pointer ${
                  selectedCycle === 'semiannual'
                    ? 'bg-[#f7c548]/20 border-[#f7c548] text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-[#8E97AB] hover:border-white/20'
                }`}
              >
                <span className="absolute -top-2 right-2 px-1.5 py-0.5 bg-[#52BE80] text-[#0B0F1A] rounded-full text-[9px] font-bold">
                  -14 %
                </span>
                <div className="text-xs font-bold text-white">Semestriel</div>
                <div className="text-sm font-extrabold text-[#f7c548] mt-0.5">149 €</div>
                <div className="text-[10px] text-[#8E97AB]">soit 24,8 € / mois</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCycle('annual')}
                className={`p-3 rounded-2xl border text-center transition-all relative cursor-pointer ${
                  selectedCycle === 'annual'
                    ? 'bg-[#f7c548]/25 border-[#f7c548] text-white shadow-lg ring-1 ring-[#f7c548]'
                    : 'bg-white/5 border-white/10 text-[#8E97AB] hover:border-white/20'
                }`}
              >
                <span className="absolute -top-2 right-2 px-1.5 py-0.5 bg-[#f7c548] text-[#0B0F1A] rounded-full text-[9px] font-bold">
                  Recommandé (-20%)
                </span>
                <div className="text-xs font-bold text-white">Annuel</div>
                <div className="text-sm font-extrabold text-[#f7c548] mt-0.5">278 €</div>
                <div className="text-[10px] text-[#8E97AB]">soit 23,1 € / mois</div>
              </button>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>Projets actifs illimités</strong> (vs 3 en gratuit)</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>Clients & Devis illimités</strong> chaque mois</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>Zéro filigrane</strong> sur vos devis & factures PDF</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>15 Go de stockage</strong> pour livrables et maquettes</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>Relances automatiques</strong> et délais d’impayés</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white">
              <Check className="w-4 h-4 text-[#f7c548] shrink-0" />
              <span><strong>Statistiques avancées</strong> & taux de conversion</span>
            </div>
          </div>

          {/* Promo code field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8E97AB] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#f7c548]" />
              <span>Code promotionnel / Partenaire créatif :</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ex : CREATIF100, LANCEMENT50"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl glass-input uppercase font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer"
              >
                Appliquer
              </button>
            </div>
            {promoMessage && (
              <p className={`text-[11px] font-medium ${promoMessage.type === 'success' ? 'text-[#52BE80]' : 'text-[#D9695F]'}`}>
                {promoMessage.text}
              </p>
            )}
          </div>

          {/* Price summary */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1A253E]/60 to-[#0E1626]/80 border border-[#f7c548]/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#8E97AB] block">Montant à régler :</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#f7c548] font-display">
                  {finalPrice} €
                </span>
                {discountPercent > 0 && (
                  <span className="text-xs text-[#8E97AB] line-through">
                    {rawPrice} €
                  </span>
                )}
                <span className="text-xs text-[#8E97AB]">
                  / {selectedCycle === 'monthly' ? 'mois' : selectedCycle === 'semiannual' ? '6 mois' : 'an'}
                </span>
              </div>
            </div>

            <div className="text-right text-[11px] text-[#8E97AB] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#52BE80]" />
              <span>Garantie 7 jours sans risque</span>
            </div>
          </div>

          {successNote && (
            <div className="p-3.5 rounded-2xl bg-[#52BE80]/15 border border-[#52BE80]/30 text-[#52BE80] text-xs font-semibold text-center">
              {successNote}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-2xl text-xs font-semibold text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              Plus tard
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmUpgrade}
              className="flex-1 py-3 px-6 rounded-2xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 active:scale-[0.98] shadow-lg shadow-[#f7c548]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{isProcessing ? 'Activation en cours...' : 'Activer mon abonnement Pro'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-center text-[#8E97AB]">
            En validant, vous acceptez les Conditions d'abonnement. Résiliable à tout moment depuis vos paramètres. Vos données restent conservées à vie.
          </p>
        </div>
      </div>
    </div>
  );
};
