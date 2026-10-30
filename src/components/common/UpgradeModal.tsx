import React from 'react';
import { X, Sparkles, Check, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_PLANS } from '../../data/plansAndWorkspaces';

export const UpgradeModal: React.FC = () => {
  const { upgradeModalOpen, closeUpgradeModal, upgradeReason, setPlan, workspace } = useApp();

  if (!upgradeModalOpen) return null;

  const handleUpgrade = (planId: 'pro' | 'studio') => {
    setPlan(planId);
    closeUpgradeModal();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121826] border border-[#1E293B] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
        <button
          onClick={closeUpgradeModal}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f7c548] to-[#8A6D3B] flex items-center justify-center text-[#0B0F1A]">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-white">Évolution de votre offre Studio</h2>
            <p className="text-xs text-[#8E97AB]">Passez à l'échelle supérieure sans contrainte</p>
          </div>
        </div>

        {upgradeReason && (
          <div className="p-3.5 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/30 text-xs text-[#fce49c] flex items-start gap-2.5">
            <Sparkles size={16} className="text-[#f7c548] shrink-0 mt-0.5" />
            <div>{upgradeReason}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Plan Pro */}
          <div className="p-5 rounded-2xl bg-[#0B0F1A] border-2 border-[#f7c548] space-y-4 relative">
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-[#f7c548] text-[#0B0F1A] text-[10px] font-extrabold uppercase tracking-wider">
              Recommandé
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Plan Pro</h3>
              <div className="text-2xl font-extrabold text-[#f7c548] mt-1 font-mono">29 € <span className="text-xs text-[#8E97AB] font-normal font-sans">/ mois</span></div>
            </div>
            <ul className="text-xs text-[#8E97AB] space-y-2">
              <li className="flex items-center gap-2 text-white">
                <Check size={14} className="text-[#f7c548]" />
                <span>25 projets actifs simultanés</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Check size={14} className="text-[#f7c548]" />
                <span>50 clients dans le carnet</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Check size={14} className="text-[#f7c548]" />
                <span>100 devis & factures par mois</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Check size={14} className="text-[#f7c548]" />
                <span>Versions de devis multiples (V1, V2...)</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <Check size={14} className="text-[#f7c548]" />
                <span>Exports PDF haute fidélité</span>
              </li>
            </ul>
            <button
              onClick={() => handleUpgrade('pro')}
              className="w-full py-2.5 rounded-xl bg-[#f7c548] text-[#0B0F1A] text-xs font-bold hover:bg-[#e5b336] transition-colors cursor-pointer"
            >
              Activer le forfait Pro
            </button>
          </div>

          {/* Plan Studio */}
          <div className="p-5 rounded-2xl bg-[#0B0F1A] border border-[#1E293B] space-y-4">
            <div>
              <h3 className="font-bold text-white text-base">Studio Agence</h3>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">79 € <span className="text-xs text-[#8E97AB] font-normal font-sans">/ mois</span></div>
            </div>
            <ul className="text-xs text-[#8E97AB] space-y-2">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#8E97AB]" />
                <span>Projets actifs illimités</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#8E97AB]" />
                <span>Clients illimités</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#8E97AB]" />
                <span>Devis & facturation illimités</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[#8E97AB]" />
                <span>Support prioritaire VIP</span>
              </li>
            </ul>
            <button
              onClick={() => handleUpgrade('studio')}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Passer à Studio
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[#8E97AB]">
          <Shield size={14} className="text-[#f7c548]" />
          <span>Activation instantanée sans engagement • Annulable à tout moment</span>
        </div>
      </div>
    </div>
  );
};
