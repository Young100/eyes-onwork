import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthFlowModal, AuthMode } from './AuthFlowModal';

export const LoginView: React.FC = () => {
  const { loginWithEmail } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('register');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const ok = await loginWithEmail(email, password);
    setIsLoading(false);
    if (!ok) {
      setError('Identifiants incorrects. Veuillez renseigner un email valide.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="glass-modal max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] font-bold text-lg shadow-lg shadow-black/40 mb-2 font-display">
            EO
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            eyes-onwork
          </h1>
          <p className="text-xs text-[#8E97AB]">
            Espace de gestion pour graphistes indépendants & directeurs artistiques
          </p>
        </div>

        {/* Direct Google Sign-In */}
        <button
          type="button"
          onClick={() => {
            setAuthModalMode('google_select_account');
            setIsAuthModalOpen(true);
          }}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continuer directement avec Google</span>
        </button>

        <div className="relative flex items-center justify-center my-1">
          <div className="w-full border-t border-white/10" />
          <span className="relative bg-[#0B0F1A] px-3 text-[11px] text-[#8E97AB]">
            ou par email et mot de passe
          </span>
        </div>

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#D9695F] text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#8E97AB] mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@studio.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs glass-input"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#8a7968]">
                Mot de passe
              </label>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('reset_password');
                  setIsAuthModalOpen(true);
                }}
                className="text-[11px] text-[#f7c548] hover:underline cursor-pointer font-medium"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7968]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs glass-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
          >
            <span>{isLoading ? 'Connexion en cours...' : 'Se connecter'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-2 text-center space-y-2">
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('register');
              setIsAuthModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#f7c548] hover:underline cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nouveau freelance ? Créer un compte ou continuer avec Google</span>
          </button>
          <div className="text-[11px] text-[#8E97AB]">
            Accès sécurisé pour le freelance. Les clients utilisent leur lien projet sans mot de passe.
          </div>
        </div>
      </div>

      {/* Auth Flow Modal for full signup / google auth */}
      <AuthFlowModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
        onStartOnboarding={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};
