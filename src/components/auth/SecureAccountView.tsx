import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  RefreshCw,
  ArrowRight,
  Mail
} from 'lucide-react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth as firebaseAuth } from '../../config/firebase';

interface SecureAccountViewProps {
  securityToken: string;
  onDone: () => void;
}

export const SecureAccountView: React.FC<SecureAccountViewProps> = ({
  securityToken,
  onDone
}) => {
  const [status, setStatus] = useState<'revoking' | 'revoked' | 'error'>('revoking');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resetSent, setResetSent] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const executeSecurityRevocation = async () => {
      if (!securityToken) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Jeton de sécurisation manquant ou invalide.');
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/secure-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: securityToken })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        // Déconnexion immédiate du navigateur local également
        try {
          await signOut(firebaseAuth);
        } catch {}

        if (!isMounted) return;

        if (!res.ok || !data.success) {
          setStatus('error');
          setErrorMessage(
            data.message || 'Ce lien de sécurisation est invalide, expiré ou a déjà été utilisé.'
          );
          return;
        }

        setAccountEmail(data.email || '');
        setStatus('revoked');
      } catch {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage('Impossible de contacter le serveur pour révoquer vos sessions. Veuillez réessayer.');
      }
    };

    executeSecurityRevocation();
    return () => {
      isMounted = false;
    };
  }, [securityToken]);

  const handleSendPasswordChangeEmail = async () => {
    const cleanEmail = accountEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Adresse email introuvable. Utilisez « Mot de passe oublié ? » sur la page de connexion.');
      return;
    }

    setIsSendingReset(true);
    setErrorMessage('');
    const actionUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

    try {
      if (actionUrl) {
        try {
          await sendPasswordResetEmail(firebaseAuth, cleanEmail, {
            url: actionUrl,
            handleCodeInApp: true
          });
        } catch (settingsErr: any) {
          if (
            settingsErr?.code === 'auth/unauthorized-continue-uri' ||
            settingsErr?.code === 'auth/invalid-continue-uri'
          ) {
            await sendPasswordResetEmail(firebaseAuth, cleanEmail);
          } else {
            throw settingsErr;
          }
        }
      } else {
        await sendPasswordResetEmail(firebaseAuth, cleanEmail);
      }

      setResetSent(true);
    } catch {
      setErrorMessage('Impossible d’envoyer le lien pour le moment. Réessayez dans un instant.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="glass-modal max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-[#f7c548]/30">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25124d] to-[#160830] border border-[#f7c548]/40 text-[#f7c548] font-bold text-lg shadow-lg shadow-black/40 mb-1 font-display">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#eeebd3] font-display">
            Sécuriser mon compte
          </h1>
          <p className="text-xs text-[#8a7968]">
            eyes-onwork · Protection d’urgence de votre studio
          </p>
        </div>

        {status === 'revoking' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-[#f7c548]" />
            <p className="text-xs text-[#eeebd3] font-medium">
              Déconnexion de tous vos appareils en cours...
            </p>
            <p className="text-[11px] text-[#8a7968]">
              Révocation immédiate de l’ensemble des sessions actives sur nos serveurs.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#F29B9B] text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>

            <button
              type="button"
              onClick={onDone}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Retour à la connexion</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {status === 'revoked' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[#52BE80]/15 border border-[#52BE80]/30 text-[#52BE80] text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Tous vos appareils ont été déconnectés</span>
              </div>
              <p className="text-[#eeebd3]/85 leading-relaxed">
                Toutes les sessions actives{accountEmail ? ` pour ${accountEmail}` : ''} ont été immédiatement révoquées.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#eeebd3]">
                <KeyRound className="w-4 h-4 text-[#f7c548] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Changer votre mot de passe par précaution</p>
                  <p className="text-[11px] text-[#8a7968] mt-1 leading-relaxed">
                    Si vous n’êtes pas à l’origine de l’ajout du fournisseur Google ou de mot de passe, nous vous recommandons vivement de choisir un nouveau mot de passe dès maintenant.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#F29B9B] text-xs">
                  {errorMessage}
                </div>
              )}

              {resetSent ? (
                <div className="p-3 rounded-xl bg-[#52BE80]/15 border border-[#52BE80]/30 text-[#52BE80] text-xs flex items-start gap-2">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Un lien pour définir votre nouveau mot de passe vient d’être envoyé à <strong>{accountEmail}</strong>.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendPasswordChangeEmail}
                  disabled={isSendingReset || !accountEmail}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isSendingReset ? 'Envoi en cours...' : 'Changer mon mot de passe maintenant'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onDone}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#eeebd3] bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Aller à l’écran de connexion</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
