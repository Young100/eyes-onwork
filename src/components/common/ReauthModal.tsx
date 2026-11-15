import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, X, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { auth as firebaseAuth } from '../../config/firebase';
import { useApp } from '../../context/AppContext';

interface ReauthModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onAuthenticated: () => void | Promise<void>;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 shrink-0' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

export const ReauthModal: React.FC<ReauthModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmer mon identité',
  onClose,
  onAuthenticated
}) => {
  const { auth, reauthenticate, reauthenticateWithGoogle } = useApp();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const fbProviders = (firebaseAuth.currentUser?.providerData || []).map(p => p.providerId);
  const hasPasswordProvider =
    fbProviders.includes('password') ||
    (auth.linkedProviders || []).includes('password') ||
    auth.provider === 'password';
  const hasGoogleProvider =
    fbProviders.includes('google.com') ||
    (auth.linkedProviders || []).includes('google') ||
    auth.provider === 'google';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    try {
      const ok = await reauthenticate(password);
      if (!ok) {
        setIsLoading(false);
        setErrorMessage('Identifiants invalides. Vérifiez votre mot de passe.');
        return;
      }
      setPassword('');
      await onAuthenticated();
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Échec de la vérification d’identité.');
    }
  };

  const handleGoogleReauth = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const ok = await reauthenticateWithGoogle();
      if (!ok) {
        setIsLoading(false);
        setErrorMessage('La ré-authentification Google n’a pas pu être validée.');
        return;
      }
      setPassword('');
      await onAuthenticated();
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Impossible de valider avec Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0B0F1A] border border-[#f7c548]/35 rounded-3xl p-6 space-y-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">{title}</h3>
              <p className="text-xs text-[#8E97AB]">Action sensible · Vérification requise</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#8E97AB] leading-relaxed">{description}</p>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/35 text-[#F29B9B] text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {hasGoogleProvider && (
          <button
            type="button"
            onClick={handleGoogleReauth}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <GoogleIcon />
            <span>{isLoading ? 'Vérification...' : 'Confirmer avec Google'}</span>
          </button>
        )}

        {hasGoogleProvider && hasPasswordProvider && (
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/10" />
            <span className="relative bg-[#0B0F1A] px-3 text-[11px] text-[#8E97AB]">ou par mot de passe</span>
          </div>
        )}

        {hasPasswordProvider && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                Mot de passe actuel
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs glass-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#8E97AB] cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading || !password}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Vérification...' : confirmLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {!hasPasswordProvider && (
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#8E97AB] cursor-pointer"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
};
