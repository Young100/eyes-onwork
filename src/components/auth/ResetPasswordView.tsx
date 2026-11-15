import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth as firebaseAuth } from '../../config/firebase';
import { evaluatePasswordStrength } from '../../utils/authSecurity';

interface ResetPasswordViewProps {
  oobCode: string;
  onComplete: () => void;
  onRequestNewLink: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  oobCode,
  onComplete,
  onRequestNewLink
}) => {
  const [status, setStatus] = useState<'verifying' | 'ready' | 'invalid' | 'success'>('verifying');
  const [targetEmail, setTargetEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkCode = async () => {
      if (!oobCode) {
        if (isMounted) {
          setStatus('invalid');
          setErrorMessage('Lien de réinitialisation invalide ou incomplet.');
        }
        return;
      }
      try {
        const emailFromCode = await verifyPasswordResetCode(firebaseAuth, oobCode);
        if (isMounted) {
          setTargetEmail(emailFromCode || '');
          setStatus('ready');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('invalid');
        if (err?.code === 'auth/expired-action-code') {
          setErrorMessage('Ce lien de réinitialisation a expiré. Veuillez en demander un nouveau.');
        } else {
          setErrorMessage('Ce lien de réinitialisation est invalide ou a déjà été utilisé.');
        }
      }
    };
    checkCode();
    return () => {
      isMounted = false;
    };
  }, [oobCode]);

  const strength = evaluatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!strength.isValid) {
      setErrorMessage(strength.errors[0] || 'Le mot de passe doit contenir au moins 10 caractères, une lettre et un chiffre.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
      setIsSubmitting(false);
      setStatus('success');
    } catch (err: any) {
      setIsSubmitting(false);
      const code = err?.code;
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setStatus('invalid');
        setErrorMessage('Ce lien a expiré ou a déjà été utilisé. Veuillez demander un nouveau lien.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('Mot de passe trop faible. Choisissez un mot de passe plus robuste.');
      } else {
        setErrorMessage('Impossible de mettre à jour le mot de passe. Veuillez réessayer.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="glass-modal max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-[#f7c548]/30">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25124d] to-[#160830] border border-[#f7c548]/40 text-[#f7c548] font-bold text-lg shadow-lg shadow-black/40 mb-1 font-display">
            EO
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#eeebd3] font-display">
            Nouveau mot de passe
          </h1>
          <p className="text-xs text-[#8a7968]">
            eyes-onwork · Sécurisation de votre espace studio
          </p>
        </div>

        {/* Loading verification */}
        {status === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-[#f7c548]" />
            <p className="text-xs text-[#8a7968]">
              Vérification du lien sécurisé en cours...
            </p>
          </div>
        )}

        {/* Invalid / Expired link */}
        {status === 'invalid' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#F29B9B] text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage || 'Lien invalide ou expiré.'}</span>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onRequestNewLink}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Demander un nouveau lien</span>
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#eeebd3] bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                Retour à la connexion
              </button>
            </div>
          </div>
        )}

        {/* Ready to enter new password */}
        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {targetEmail && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-[#8a7968]">
                Compte concerné : <strong className="text-[#eeebd3]">{targetEmail}</strong>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#F29B9B] text-xs font-medium flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#8a7968] mb-1">
                Nouveau mot de passe (10 caractères min.)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7968]" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs glass-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7968] hover:text-[#eeebd3] cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#8a7968]">Robustesse :</span>
                    <span style={{ color: strength.color }} className="font-bold">
                      {strength.label}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-1">
                    {[0, 1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className="flex-1 h-full rounded-full transition-all"
                        style={{
                          backgroundColor: step <= strength.score ? strength.color : 'transparent'
                        }}
                      />
                    ))}
                  </div>
                  {strength.errors.length > 0 && (
                    <p className="text-[10px] text-[#D9695F]">{strength.errors[0]}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8a7968] mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7968]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs glass-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7968] hover:text-[#eeebd3] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
            >
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onComplete}
              className="w-full text-center text-xs text-[#8a7968] hover:text-[#eeebd3] transition-colors cursor-pointer"
            >
              Annuler et retourner à la connexion
            </button>
          </form>
        )}

        {/* Success state */}
        {status === 'success' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#5FB59A]/20 border border-[#5FB59A] text-[#5FB59A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-[#eeebd3] font-display">
                Mot de passe mis à jour
              </h2>
              <p className="text-xs text-[#8a7968] leading-relaxed">
                Votre nouveau mot de passe est actif. Vous pouvez dès à présent vous connecter à votre espace eyes-onwork.
              </p>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
            >
              <span>Se connecter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
