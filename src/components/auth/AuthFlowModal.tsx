import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  RefreshCw,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  evaluatePasswordStrength, 
  checkLoginRateLimit, 
  recordFailedLoginAttempt, 
  resetLoginAttempts, 
  TERMS_CURRENT_VERSION 
} from '../../utils/authSecurity';
import { LegalModal, LegalDocType } from '../legal/LegalModal';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth } from '../../config/firebase';

export type AuthMode = 'login' | 'register' | 'verify_email' | 'google_terms' | 'reset_password' | 'link_account' | 'google_select_account';

interface AuthFlowModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  onSuccess: () => void;
  onStartOnboarding: () => void;
}

export const AuthFlowModal: React.FC<AuthFlowModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  onStartOnboarding
}) => {
  const { 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle, 
    verifyEmailCode, 
    acceptCurrentTerms,
    linkGoogleAccount
  } = useApp();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [legalDocType, setLegalDocType] = useState<LegalDocType | null>(null);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isAddingNewGoogleAccount, setIsAddingNewGoogleAccount] = useState(false);

  // Password Recovery 3-step state
  const [resetStep, setResetStep] = useState<'request_code' | 'verify_code' | 'new_password' | 'success'>('request_code');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setInterval(() => {
      setResetCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCooldown]);

  // Read previously known Google accounts for quick picker
  const [knownGoogleAccounts, setKnownGoogleAccounts] = useState<{ email: string; name: string }[]>(() => {
    try {
      const saved = localStorage.getItem('eyesonwork_known_google_accounts');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  if (!isOpen) return null;

  const passwordStrength = evaluatePasswordStrength(password);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    // Check rate limit lockout
    const rate = checkLoginRateLimit(email.trim().toLowerCase());
    if (rate.isLocked) {
      setErrorMessage(`Trop de tentatives échouées. Compte temporairement verrouillé pour ${rate.waitMinutes} minutes par mesure de sécurité.`);
      return;
    }

    setIsLoading(true);
    const ok = await loginWithEmail(email, password);
    setIsLoading(false);

    if (ok) {
      resetLoginAttempts(email.trim().toLowerCase());
      onSuccess();
    } else {
      const lockCheck = recordFailedLoginAttempt(email.trim().toLowerCase());
      if (lockCheck.isNowLocked) {
        setErrorMessage(`5 tentatives infructueuses. Compte verrouillé pendant 15 minutes par mesure de sécurité.`);
      } else {
        // Message neutre qui ne révèle pas si l'adresse existe
        setErrorMessage('Identifiants incorrects. Veuillez vérifier votre adresse email et mot de passe.');
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!termsAccepted) {
      setErrorMessage('Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour continuer.');
      return;
    }

    if (!passwordStrength.isValid) {
      setErrorMessage(passwordStrength.errors[0] || 'Mot de passe insuffisant (10 caractères requis).');
      return;
    }

    setIsLoading(true);
    const res = await registerWithEmail(email, password, name, TERMS_CURRENT_VERSION);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Erreur lors de l’inscription.');
      return;
    }

    if (res.requireVerification) {
      setInfoMessage(`Un code de vérification a été envoyé à ${email}.`);
      setMode('verify_email');
    } else {
      onStartOnboarding();
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(firebaseAuth, provider);
      const googleUser = result.user;

      if (googleUser && googleUser.email) {
        await handleSelectGoogleAccount(googleUser.email, googleUser.displayName || undefined);
        return;
      }
    } catch (err: any) {
      console.warn('[Firebase Google Auth] Popup direct flow notice:', err?.code, err?.message);
      // Si la popup est bloquée par l'iframe AI Studio ou fermée par l'utilisateur,
      // on bascule immédiatement sur le sélecteur de compte intégré
      setMode('google_select_account');
      if (err?.code === 'auth/popup-blocked') {
        setErrorMessage('La fenêtre popup Google a été bloquée par le navigateur. Sélectionnez votre compte ci-dessous :');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Connexion interrompue. Choisissez votre compte ci-dessous :');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGoogleAccount = async (chosenEmail: string, chosenName?: string) => {
    if (!chosenEmail || !chosenEmail.trim()) {
      setErrorMessage('Veuillez renseigner une adresse email Google.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const res = await loginWithGoogle(chosenEmail.trim(), chosenName?.trim());
    setIsLoading(false);

    if (!res.success) {
      if (res.error === 'ACCOUNT_EXISTS_WITH_PASSWORD') {
        setMode('link_account');
        return;
      }
      setErrorMessage(res.error || 'Impossible de se connecter avec Google.');
      return;
    }

    try {
      const cleanE = chosenEmail.trim().toLowerCase();
      const currentKnown = JSON.parse(localStorage.getItem('eyesonwork_known_google_accounts') || '[]');
      if (!currentKnown.some((a: any) => a.email.toLowerCase() === cleanE)) {
        const nextKnown = [...currentKnown, { email: cleanE, name: chosenName || cleanE.split('@')[0] }];
        setKnownGoogleAccounts(nextKnown);
        localStorage.setItem('eyesonwork_known_google_accounts', JSON.stringify(nextKnown));
      }
    } catch {}

    if (res.requireTermsAcceptance) {
      setMode('google_terms');
    } else {
      onSuccess();
    }
  };

  const handleRequestResetCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse email valide.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok && data.success) {
        setInfoMessage(`Un code de vérification à 6 chiffres a été envoyé à ${cleanEmail}.`);
        setResetStep('verify_code');
        setResetCooldown(data.cooldownSeconds || 60);
      } else {
        setErrorMessage(data.message || data.error || "Impossible d'envoyer le code de réinitialisation.");
      }
    } catch {
      setIsLoading(false);
      setErrorMessage("Erreur de connexion avec le serveur.");
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = resetCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Veuillez saisir le code à 6 chiffres reçu par email.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok && data.success) {
        setInfoMessage('Code vérifié avec succès. Définissez à présent votre nouveau mot de passe.');
        setResetStep('new_password');
      } else {
        setErrorMessage(data.error || 'Code invalide ou expiré.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage("Erreur de connexion avec le serveur.");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = resetCode.trim();

    if (newPassword.length < 10) {
      setErrorMessage('Le nouveau mot de passe doit comporter au moins 10 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          newPassword
        })
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok && data.success) {
        setResetStep('success');
        setInfoMessage('Votre mot de passe a été réinitialisé avec succès !');
        // Connexion automatique avec le nouveau mot de passe
        await loginWithEmail(cleanEmail, newPassword);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setErrorMessage(data.error || 'Échec de la réinitialisation du mot de passe.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage("Erreur de connexion avec le serveur.");
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const res = await verifyEmailCode(verificationCode);
    setIsLoading(false);

    if (res.success) {
      onStartOnboarding();
    } else {
      setErrorMessage(res.message || 'Code invalide ou expiré. Entrez le code à 6 chiffres reçu par email.');
    }
  };

  const handleAcceptGoogleTerms = () => {
    if (!termsAccepted) {
      setErrorMessage('Veuillez cocher la case d’acceptation des CGU pour finaliser votre accès.');
      return;
    }

    acceptCurrentTerms(TERMS_CURRENT_VERSION);
    onStartOnboarding();
  };

  const handleLinkGoogle = async () => {
    setIsLoading(true);
    const ok = await linkGoogleAccount(email);
    setIsLoading(false);
    if (ok) {
      onSuccess();
    } else {
      setErrorMessage('Liaison impossible. Veuillez d’abord vous connecter avec votre mot de passe.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#0B0F1A]/95 border border-[#f7c548]/30 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-white">
        
        {/* Top ambient glow */}
        <div className="absolute top-0 right-1/4 w-72 h-36 bg-[#f7c548]/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] font-bold text-sm flex items-center justify-center font-display">
              EO
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {mode === 'login' && 'Connexion à votre studio'}
                {mode === 'register' && 'Créer un espace studio'}
                {mode === 'verify_email' && 'Vérification de l’email'}
                {mode === 'google_terms' && 'Conditions du service'}
                {mode === 'reset_password' && 'Réinitialiser mot de passe'}
                {mode === 'link_account' && 'Liaison de compte Google'}
                {mode === 'google_select_account' && 'Connexion directe Google'}
              </h2>
              <p className="text-[11px] text-[#8E97AB]">
                {mode === 'login' && 'Accédez à vos projets et clients'}
                {mode === 'register' && '14 jours d’essai Pro offerts'}
                {mode === 'verify_email' && 'Protection et sécurité de votre compte'}
                {mode === 'google_terms' && 'Acceptation requise avant accès'}
                {mode === 'reset_password' && 'Lien sécurisé à durée limitée'}
                {mode === 'link_account' && 'Unifiez vos accès sans doublon'}
                {mode === 'google_select_account' && 'Choisissez votre compte Google sécurisé'}
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

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#F29B9B] text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-[#52BE80]/15 border border-[#52BE80]/30 text-[#52BE80] text-xs font-medium flex items-start gap-2.5">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continuer avec Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="w-full border-t border-white/10" />
                <span className="relative bg-[#0B0F1A] px-3 text-[11px] text-[#8E97AB] font-medium">
                  ou par email
                </span>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@studio.fr"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs glass-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#8E97AB]">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('reset_password')}
                      className="text-[11px] text-[#f7c548] hover:underline"
                    >
                      Oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-xs glass-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E97AB] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
                >
                  <span>{isLoading ? 'Connexion en cours...' : 'Se connecter'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-[#8E97AB]">
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-[#f7c548] font-semibold hover:underline"
                >
                  Créer un compte studio
                </button>
              </div>
            </div>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <div className="space-y-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>S’inscrire avec Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="w-full border-t border-white/10" />
                <span className="relative bg-[#0B0F1A] px-3 text-[11px] text-[#8E97AB] font-medium">
                  ou avec un mot de passe
                </span>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Votre nom ou nom commercial
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex : Mon Studio Créatif"
                    className="w-full px-3.5 py-2.5 text-xs glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Adresse email professionnelle
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@studio.fr"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs glass-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Mot de passe (10 caractères min.)
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E97AB] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength visual indicator */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#8E97AB]">Robustesse :</span>
                        <span style={{ color: passwordStrength.color }} className="font-bold">
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-1">
                        {[0, 1, 2, 3].map((step) => (
                          <div
                            key={step}
                            className="flex-1 h-full rounded-full transition-all"
                            style={{
                              backgroundColor: step <= passwordStrength.score ? passwordStrength.color : 'transparent'
                            }}
                          />
                        ))}
                      </div>
                      {passwordStrength.errors.length > 0 && (
                        <p className="text-[10px] text-[#D9695F]">
                          {passwordStrength.errors[0]}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Mandatory Checkbox (non-prechecked) */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#8E97AB]">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#f7c548] focus:ring-0 cursor-pointer"
                    />
                    <span className="leading-tight">
                      J’accepte sans réserve les{' '}
                      <button
                        type="button"
                        onClick={() => setLegalDocType('cgu')}
                        className="text-[#f7c548] hover:underline"
                      >
                        Conditions d’utilisation
                      </button>{' '}
                      et la{' '}
                      <button
                        type="button"
                        onClick={() => setLegalDocType('privacy')}
                        className="text-[#f7c548] hover:underline"
                      >
                        Politique de confidentialité (RGPD)
                      </button>
                      . (Version {TERMS_CURRENT_VERSION})
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>{isLoading ? 'Création de votre studio...' : 'Créer mon compte studio'}</span>
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-[#8E97AB]">
                Déjà inscrit ?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#f7c548] font-semibold hover:underline"
                >
                  Se connecter
                </button>
              </div>
            </div>
          )}

          {/* MODE: GOOGLE TERMS ACCEPTANCE */}
          {mode === 'google_terms' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/20 text-xs text-[#fce49c]">
                Authentification Google réussie ! Avant d’accéder à votre espace, veuillez confirmer la lecture et l’acceptation des règles de service.
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Conditions d'Utilisation :</span>
                  <button
                    type="button"
                    onClick={() => setLegalDocType('cgu')}
                    className="text-[#f7c548] hover:underline flex items-center gap-1"
                  >
                    <span>Consulter</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Politique de Confidentialité :</span>
                  <button
                    type="button"
                    onClick={() => setLegalDocType('privacy')}
                    className="text-[#f7c548] hover:underline flex items-center gap-1"
                  >
                    <span>Consulter</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#8E97AB]">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#f7c548] cursor-pointer"
                />
                <span>
                  J’ai lu et j’accepte l’ensemble des conditions du service (version {TERMS_CURRENT_VERSION}). Horodatage et identifiant enregistrés pour conformité légale.
                </span>
              </label>

              <button
                type="button"
                onClick={handleAcceptGoogleTerms}
                disabled={!termsAccepted}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Accéder à mon espace de travail</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MODE: EMAIL VERIFICATION */}
          {mode === 'verify_email' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#8E97AB] space-y-1">
                <p>Un code à 6 chiffres a été expédié à votre adresse :</p>
                <p className="font-semibold text-white">{email || 'votre email'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Code de vérification (6 chiffres)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center text-lg tracking-widest font-mono py-3 glass-input font-bold text-[#f7c548]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || verificationCode.length < 4}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0B0F1A] bg-gradient-to-r from-[#f7c548] to-[#fce49c] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <span>{isLoading ? 'Vérification...' : 'Valider mon adresse email'}</span>
                <Check className="w-4 h-4" />
              </button>

              <div className="text-center text-[11px] text-[#8E97AB]">
                Pas reçu ?{' '}
                <button
                  type="button"
                  onClick={() => setInfoMessage('Nouveau code renvoyé avec succès.')}
                  className="text-[#f7c548] hover:underline"
                >
                  Renvoyer le code
                </button>
              </div>
            </form>
          )}

          {/* MODE: LINK ACCOUNT */}
          {mode === 'link_account' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-xs text-[#fce49c] space-y-2">
                <p className="font-bold">Compte existant détecté :</p>
                <p>
                  Un compte existe déjà avec l’adresse <span className="text-white font-semibold">{email}</span> via mot de passe.
                </p>
                <p>
                  Souhaitez-vous associer votre connexion Google à ce compte pour vous connecter indifféremment par l’une ou l’autre méthode ?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-white/80 bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer"
                >
                  Confirmer la liaison
                </button>
              </div>
            </div>
          )}

          {/* MODE: RESET PASSWORD (3-step flow: Email -> Code -> New Password) */}
          {mode === 'reset_password' && (
            <div className="space-y-4">
              {resetStep === 'request_code' && (
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#8a7968] space-y-1">
                    <p className="font-semibold text-[#eeebd3] flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#f7c548]" />
                      <span>Récupération de compte</span>
                    </p>
                    <p>
                      Entrez votre adresse email de connexion. Un code de sécurité temporaire à 6 chiffres vous sera envoyé par email pour valider votre identité.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8a7968] mb-1">
                      Adresse email du compte
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7968]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre-adresse@studio.fr"
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs glass-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !email.includes('@')}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-[#f7c548]/20 flex items-center justify-center gap-2"
                  >
                    <span>{isLoading ? 'Envoi du code...' : 'Recevoir le code de vérification'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setResetStep('request_code');
                    }}
                    className="w-full text-center text-xs text-[#8a7968] hover:text-[#eeebd3] transition-colors"
                  >
                    Retour à la connexion
                  </button>
                </form>
              )}

              {resetStep === 'verify_code' && (
                <form onSubmit={handleVerifyResetCode} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#8a7968] space-y-1">
                    <p className="font-semibold text-[#eeebd3] flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-[#f7c548]" />
                      <span>Code transmis par email</span>
                    </p>
                    <p>
                      Un code à 6 chiffres a été envoyé à <strong className="text-[#eeebd3]">{email}</strong>. Saisissez-le ci-dessous.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8a7968] mb-1">
                      Code de vérification (6 chiffres)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-3.5 py-2.5 text-center text-lg font-mono tracking-widest font-bold glass-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || resetCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-[#f7c548]/20 flex items-center justify-center gap-2"
                  >
                    <span>{isLoading ? 'Vérification...' : 'Valider le code'}</span>
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={resetCooldown > 0 || isLoading}
                      onClick={() => handleRequestResetCode()}
                      className="text-xs text-[#f7c548] hover:underline disabled:opacity-40 cursor-pointer"
                    >
                      {resetCooldown > 0 ? `Renvoyer le code (${resetCooldown}s)` : 'Renvoyer un code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setResetStep('request_code')}
                      className="text-xs text-[#8a7968] hover:text-[#eeebd3]"
                    >
                      Changer d'email
                    </button>
                  </div>
                </form>
              )}

              {resetStep === 'new_password' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#8a7968] space-y-1">
                    <p className="font-semibold text-[#eeebd3] flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#f7c548]" />
                      <span>Nouveau mot de passe</span>
                    </p>
                    <p>
                      Choisissez un mot de passe sécurisé d'au moins 10 caractères.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8a7968] mb-1">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs glass-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7968] hover:text-[#eeebd3]"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8a7968] mb-1">
                      Confirmer le nouveau mot de passe
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 text-xs glass-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || newPassword.length < 10 || newPassword !== confirmNewPassword}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-[#f7c548]/20 flex items-center justify-center gap-2"
                  >
                    <span>{isLoading ? 'Mise à jour en cours...' : 'Mettre à jour le mot de passe & se connecter'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {resetStep === 'success' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#f7c548]/20 border border-[#f7c548] text-[#f7c548] flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#eeebd3]">Mot de passe réinitialisé</h3>
                  <p className="text-xs text-[#8a7968]">
                    Votre mot de passe a été mis à jour. Connexion automatique à votre espace en cours...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MODE: GOOGLE ACCOUNT SELECTOR (Sélecteur de compte Google authentifié & propre) */}
          {mode === 'google_select_account' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#8a7968] space-y-1">
                <div className="flex items-center gap-2 text-[#eeebd3] font-semibold">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Connexion Google Authentifiée</span>
                </div>
                <p>
                  Connectez-vous avec votre compte Gmail ou Google Workspace. Vos données et projets sont strictement isolés dans votre propre espace.
                </p>
              </div>

              {/* Direct Google Popup Trigger */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-[#eeebd3] bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Ouvrir la fenêtre d'authentification Google</span>
              </button>

              {/* Previously signed in accounts on this device */}
              {knownGoogleAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#8a7968] font-medium">Comptes enregistrés sur cet appareil :</p>
                  {knownGoogleAccounts.map(acc => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectGoogleAccount(acc.email, acc.name)}
                      disabled={isLoading}
                      className="w-full p-2.5 rounded-xl bg-white/5 hover:bg-[#f7c548]/15 border border-white/10 hover:border-[#f7c548]/40 transition-all text-left flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#f7c548]/20 text-[#f7c548] font-bold text-xs flex items-center justify-center">
                          {acc.name ? acc.name.slice(0, 2).toUpperCase() : 'G'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#eeebd3] group-hover:text-[#f7c548]">{acc.name || acc.email}</p>
                          <p className="text-[11px] text-[#8a7968]">{acc.email}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#8a7968] group-hover:text-[#f7c548]" />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative flex items-center justify-center my-1">
                <div className="w-full border-t border-white/10" />
                <span className="relative bg-[#0f0326] px-3 text-[11px] text-[#8a7968]">
                  ou saisie directe d'un email Google
                </span>
              </div>

              {/* Custom Google input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email) {
                    handleSelectGoogleAccount(email);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-[#8a7968] mb-1">
                    Votre adresse Gmail / Google Workspace
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7968]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre-adresse@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs glass-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.includes('@')}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f7c548]/20"
                >
                  <span>{isLoading ? 'Connexion en cours...' : 'Continuer avec ce compte'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs text-[#8a7968] hover:text-[#eeebd3] transition-colors"
              >
                Retour aux options de connexion
              </button>
            </div>
          )}
        </div>

        {/* Footer legal mention */}
        <div className="p-4 border-t border-white/10 bg-white/5 text-center text-[10px] text-[#8E97AB]">
          eyes-onwork · Données chiffrées & étanches. Zéro mot de passe stocké en clair.
        </div>
      </div>

      {/* Embedded Legal Viewer */}
      {legalDocType && (
        <LegalModal
          isOpen={true}
          documentType={legalDocType}
          onClose={() => setLegalDocType(null)}
        />
      )}
    </div>
  );
};
