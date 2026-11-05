import React, { useState, useEffect, useRef } from 'react';
import { Mail, CheckCircle2, RefreshCw, LogOut, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EmailVerificationGate: React.FC = () => {
  const { auth, verifyEmailCode, sendVerificationCode, logout } = useApp();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus on first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Synchronisation du statut initial de vérification (cooldown restant côté serveur)
  useEffect(() => {
    if (auth.email) {
      fetch(`/api/auth/verification-status?email=${encodeURIComponent(auth.email)}`)
        .then(res => res.text())
        .then(text => text ? JSON.parse(text) : null)
        .then(data => {
          if (data && typeof data.cooldownSeconds === 'number' && data.cooldownSeconds > 0) {
            setCooldown(data.cooldownSeconds);
          }
        })
        .catch(() => {});
    }
  }, [auth.email]);

  const triggerVerification = async (codeToVerify: string) => {
    if (isVerifying) return;
    setError('');
    setSuccessMsg('');
    setIsVerifying(true);

    try {
      const result = await verifyEmailCode(codeToVerify);
      if (result.success) {
        setSuccessMsg('Email vérifié avec succès ! Redirection en cours...');
      } else {
        setError(result.message || 'Code invalide. Veuillez vérifier votre saisie.');
        if (typeof result.remainingAttempts === 'number') {
          setRemainingAttempts(result.remainingAttempts);
        }
      }
    } catch {
      setError('Erreur lors de la vérification. Veuillez réessayer.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...digits];

    if (cleaned.length > 0) {
      newDigits[index] = cleaned.slice(-1);
      setDigits(newDigits);

      // Auto advance to next input
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }

      // If all 6 digits are filled, automatically verify
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        triggerVerification(fullCode);
      }
    } else {
      newDigits[index] = '';
      setDigits(newDigits);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous input and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleanedDigits = pastedData.replace(/\D/g, '').slice(0, 6);

    if (cleanedDigits.length > 0) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < cleanedDigits.length; i++) {
        newDigits[i] = cleanedDigits[i];
      }
      setDigits(newDigits);

      const targetFocusIndex = Math.min(cleanedDigits.length, 5);
      inputRefs.current[targetFocusIndex]?.focus();

      if (cleanedDigits.length === 6) {
        triggerVerification(cleanedDigits);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = digits.join('');
    if (fullCode.length < 6) {
      setError('Veuillez renseigner l’intégralité du code à 6 chiffres.');
      return;
    }
    triggerVerification(fullCode);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await sendVerificationCode(auth.email);
      if (res.success) {
        setSuccessMsg('Un nouveau code à 6 chiffres a été envoyé à votre adresse email.');
        setCooldown(res.cooldownSeconds || 60);
        // Clear digits and refocus first
        setDigits(['', '', '', '', '', '']);
        setRemainingAttempts(5);
        inputRefs.current[0]?.focus();
      } else {
        if (res.cooldownSeconds && res.cooldownSeconds > 0) {
          setCooldown(res.cooldownSeconds);
        }
        setError(res.message || "Nous n'avons pas pu envoyer l'email, réessayez dans un instant.");
      }
    } catch {
      setError("Nous n'avons pas pu envoyer l'email, réessayez dans un instant.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 animate-fadeIn">
      <div className="glass-modal max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl text-white">
        {/* Header Icon */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A253E] to-[#0E1626] border border-[#f7c548]/40 text-[#f7c548] shadow-lg shadow-black/40">
            <Mail className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white">
            Vérifiez votre adresse email
          </h1>
          <p className="text-xs text-[#8E97AB] leading-relaxed">
            Pour sécuriser vos devis, factures et l’accès à votre espace freelance, veuillez saisir le code à 6 chiffres envoyé à :
          </p>
          <div className="inline-block px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-[#f7c548]">
            {auth.email}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-[#D9695F] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-[#5FB59A]/15 border border-[#5FB59A]/30 text-[#5FB59A] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* 6-Digit Code Inputs Form */}
        <form onSubmit={handleSubmit} className="space-y-6" onPaste={handlePaste}>
          <div>
            <label className="block text-center text-xs font-medium text-[#8E97AB] mb-3">
              Code de vérification à 6 chiffres (valable 10 minutes)
            </label>

            {/* 6 Individual Digit Slots */}
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  disabled={isVerifying}
                  className={`w-11 h-14 sm:w-12 sm:h-14 text-center font-mono text-2xl font-bold rounded-xl border transition-all outline-none ${
                    digit 
                      ? 'border-[#f7c548] bg-[#f7c548]/10 text-white shadow-[0_0_12px_rgba(247, 197, 72,0.25)]' 
                      : 'border-white/15 bg-white/[0.04] text-white hover:border-white/30 focus:border-[#f7c548] focus:bg-[#f7c548]/10'
                  }`}
                />
              ))}
            </div>

            <p className="text-[11px] text-center text-[#6F7B95] mt-2">
              Astuce : vous pouvez coller directement votre code (Ctrl+V ou ⌘+V)
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={isVerifying || digits.join('').length < 6}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                digits.join('').length === 6 && !isVerifying
                  ? 'text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] shadow-[#f7c548]/20'
                  : 'text-white/40 bg-white/10 cursor-not-allowed border border-white/5'
              }`}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Vérification en cours...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2]" />
                  <span>Confirmer le code</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Resend & Logout bar */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <button
            type="button"
            disabled={cooldown > 0 || isSending}
            onClick={handleResend}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              cooldown > 0 || isSending 
                ? 'text-[#8E97AB]/50 cursor-not-allowed' 
                : 'text-[#f7c548] hover:underline'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
            <span>
              {cooldown > 0 
                ? `Renvoyer le code (${cooldown}s)` 
                : isSending 
                  ? 'Envoi en cours...' 
                  : 'Renvoyer le code'}
            </span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-[#8E97AB] hover:text-[#D9695F] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Changer de compte</span>
          </button>
        </div>
      </div>
    </div>
  );
};
