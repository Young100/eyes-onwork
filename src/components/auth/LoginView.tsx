import React from 'react';
import { AuthFlowPanel, AuthMode } from './AuthFlowModal';

interface LoginViewProps {
  initialMode?: AuthMode;
}

export const LoginView: React.FC<LoginViewProps> = ({ initialMode = 'login' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="glass-modal max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-[#f7c548]/25">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25124d] to-[#160830] border border-[#f7c548]/40 text-[#f7c548] font-bold text-lg shadow-lg shadow-black/40 mb-2 font-display">
            EO
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            eyes-onwork
          </h1>
          <p className="text-xs text-[#8a7968]">
            Espace de gestion pour graphistes indépendants & directeurs artistiques
          </p>
        </div>

        {/* Unified two-tab authentication flow */}
        <AuthFlowPanel
          initialMode={initialMode}
          onSuccess={() => {}}
          onStartOnboarding={() => {}}
          isModal={false}
        />

        <div className="pt-2 border-t border-white/10 text-center text-[11px] text-[#8a7968]">
          Accès sécurisé pour le freelance. Les clients utilisent leur lien projet sans mot de passe.
        </div>
      </div>
    </div>
  );
};
