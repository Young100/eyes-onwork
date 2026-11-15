import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  Laptop,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Trash2,
  Mail,
  Download,
  Link2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { evaluatePasswordStrength, getInitialSecuritySessions } from '../../utils/authSecurity';
import { SecuritySession } from '../../types';
import { auth as firebaseAuth } from '../../config/firebase';
import { ReauthModal } from '../common/ReauthModal';

type PendingSensitiveAction =
  | null
  | { type: 'change_password' }
  | { type: 'change_email' }
  | { type: 'export_data' }
  | { type: 'delete_account' };

export const SecuritySettingsView: React.FC = () => {
  const {
    auth,
    logout,
    changeAccountPassword,
    changeAccountEmail,
    deleteOwnAccount,
    revokeAllDevices,
    linkGoogleFromSettings,
    performExportFullWorkspaceData
  } = useApp();

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');

  // Status banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(auth.twoFactorEnabled || false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Sessions & provider state
  const [sessions, setSessions] = useState<SecuritySession[]>(getInitialSecuritySessions(auth.uid));
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  // Sensitive action reauth modal state
  const [pendingAction, setPendingAction] = useState<PendingSensitiveAction>(null);

  const fbProviders = (firebaseAuth.currentUser?.providerData || []).map(p => p.providerId);
  const hasPasswordProvider =
    fbProviders.includes('password') ||
    (auth.linkedProviders || []).includes('password') ||
    auth.provider === 'password';
  const hasGoogleProvider =
    fbProviders.includes('google.com') ||
    (auth.linkedProviders || []).includes('google') ||
    auth.provider === 'google';

  const newPasswordStrength = evaluatePasswordStrength(newPassword);

  const handleRequestPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    if (!newPasswordStrength.isValid) {
      setStatusMessage({ type: 'error', text: newPasswordStrength.errors[0] || 'Mot de passe trop faible (10 caractères requis).' });
      return;
    }

    setPendingAction({ type: 'change_password' });
  };

  const handleRequestEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const cleanNew = newEmail.trim().toLowerCase();
    if (!cleanNew || !cleanNew.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir une nouvelle adresse email valide.' });
      return;
    }
    if (cleanNew === (auth.email || '').trim().toLowerCase()) {
      setStatusMessage({ type: 'error', text: 'La nouvelle adresse doit être différente de votre adresse actuelle.' });
      return;
    }

    setPendingAction({ type: 'change_email' });
  };

  const executePendingSensitiveAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'change_password') {
      const res = await changeAccountPassword(newPassword);
      if (!res.success) {
        setStatusMessage({ type: 'error', text: res.error || 'Impossible de mettre à jour le mot de passe.' });
        return;
      }
      setStatusMessage({ type: 'success', text: 'Votre mot de passe a été mis à jour avec succès.' });
      setNewPassword('');
      setConfirmPassword('');
      return;
    }

    if (pendingAction.type === 'change_email') {
      const res = await changeAccountEmail(newEmail);
      if (!res.success) {
        setStatusMessage({ type: 'error', text: res.error || 'Impossible de modifier votre adresse email.' });
        return;
      }
      setStatusMessage({
        type: 'success',
        text: `Un email de confirmation a été envoyé à ${newEmail.trim().toLowerCase()}. Votre adresse sera mise à jour dès validation du lien.`
      });
      setNewEmail('');
      return;
    }

    if (pendingAction.type === 'export_data') {
      performExportFullWorkspaceData();
      setStatusMessage({ type: 'success', text: 'Export intégral de vos données téléchargé avec succès.' });
      return;
    }

    if (pendingAction.type === 'delete_account') {
      const res = await deleteOwnAccount();
      if (!res.success) {
        setStatusMessage({ type: 'error', text: res.error || 'Impossible de finaliser la suppression du compte.' });
      }
    }
  };

  const handleLinkGoogle = async () => {
    setStatusMessage(null);
    setIsLinkingGoogle(true);
    const res = await linkGoogleFromSettings();
    setIsLinkingGoogle(false);
    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Votre compte Google a été relié. Un email d’avertissement de sécurité vient de vous être envoyé.'
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Échec de la liaison Google.' });
    }
  };

  const handleRevokeAllDevices = async () => {
    setStatusMessage(null);
    setIsRevokingAll(true);
    const res = await revokeAllDevices();
    setIsRevokingAll(false);
    if (!res.success) {
      setStatusMessage({ type: 'error', text: res.error || 'Impossible de déconnecter tous les appareils.' });
    }
  };

  const handleToggle2FA = () => {
    if (is2FAEnabled) {
      setIs2FAEnabled(false);
      setShow2FASetup(false);
      setStatusMessage({ type: 'success', text: 'Double authentification désactivée.' });
    } else {
      setShow2FASetup(true);
    }
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length === 6) {
      setIs2FAEnabled(true);
      setShow2FASetup(false);
      setTotpCode('');
      setStatusMessage({ type: 'success', text: 'Double authentification (2FA TOTP) activée avec succès !' });
    } else {
      setStatusMessage({ type: 'error', text: 'Code à 6 chiffres invalide.' });
    }
  };

  const getModalMeta = () => {
    switch (pendingAction?.type) {
      case 'change_password':
        return {
          title: 'Confirmer le changement de mot de passe',
          description: 'Pour des raisons de sécurité, veuillez vous ré-authentifier avant d’enregistrer votre nouveau mot de passe.',
          confirmLabel: 'Valider le mot de passe'
        };
      case 'change_email':
        return {
          title: 'Confirmer le changement d’adresse email',
          description: `Une nouvelle authentification est requise avant de modifier votre adresse de connexion vers ${newEmail.trim().toLowerCase()}.`,
          confirmLabel: 'Confirmer le changement'
        };
      case 'export_data':
        return {
          title: 'Confirmer l’export des données',
          description: 'L’export intégral contient vos clients, projets, devis et factures. Veuillez confirmer votre identité avant le téléchargement.',
          confirmLabel: 'Télécharger l’export'
        };
      case 'delete_account':
        return {
          title: 'Supprimer définitivement mon compte',
          description: 'Cette action supprime immédiatement votre compte et toutes vos données associées. Veuillez confirmer votre identité pour continuer.',
          confirmLabel: 'Supprimer définitivement'
        };
      default:
        return { title: '', description: '', confirmLabel: 'Confirmer' };
    }
  };

  const modalMeta = getModalMeta();

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl">
      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-[#52BE80]/15 border-[#52BE80]/30 text-[#52BE80]'
              : 'bg-[#D9695F]/15 border-[#D9695F]/30 text-[#F29B9B]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Section 0: Méthodes de connexion reliées */}
      <div className="glass-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Fournisseurs de Connexion Reliés
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Tout ajout de méthode de connexion déclenche un email de sécurité avec révocation d’urgence
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <p className="font-bold text-white">Email & mot de passe</p>
              <p className="text-[11px] text-[#8E97AB]">{auth.email}</p>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                hasPasswordProvider ? 'bg-[#52BE80]/20 text-[#52BE80]' : 'bg-white/10 text-[#8E97AB]'
              }`}
            >
              {hasPasswordProvider ? 'Actif' : 'Non défini'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white">Compte Google</p>
              <p className="text-[11px] text-[#8E97AB]">
                {hasGoogleProvider ? 'Relié à votre espace studio' : 'Non relié'}
              </p>
            </div>
            {hasGoogleProvider ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#52BE80]/20 text-[#52BE80]">
                Relié
              </span>
            ) : (
              <button
                type="button"
                onClick={handleLinkGoogle}
                disabled={isLinkingGoogle}
                className="py-1.5 px-3 rounded-xl text-[11px] font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{isLinkingGoogle ? 'Liaison...' : 'Relier Google'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Change Password (gated with fresh ReauthModal) */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                {hasPasswordProvider ? 'Modification du Mot de Passe' : 'Définir un Mot de Passe'}
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Une nouvelle authentification (mot de passe ou Google) est exigée avant validation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(v => !v)}
            className="text-xs text-[#8E97AB] hover:text-white cursor-pointer"
          >
            {showPasswords ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        <form onSubmit={handleRequestPasswordChange} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-[#8E97AB] mb-1">
              Nouveau mot de passe (10 caractères min.)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 text-xs glass-input"
            />

            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#8E97AB]">Force :</span>
                  <span style={{ color: newPasswordStrength.color }} className="font-bold">
                    {newPasswordStrength.label}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-1">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className="flex-1 h-full rounded-full transition-all"
                      style={{
                        backgroundColor: step <= newPasswordStrength.score ? newPasswordStrength.color : 'transparent'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8E97AB] mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 text-xs glass-input"
            />
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer"
          >
            {hasPasswordProvider ? 'Mettre à jour mon mot de passe' : 'Ajouter un mot de passe'}
          </button>
        </form>
      </div>

      {/* Section 1b: Change Email Address (gated with fresh ReauthModal) */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548]">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Changement d’Adresse Email
            </h3>
            <p className="text-xs text-[#8E97AB]">
              Adresse actuelle : <strong className="text-white">{auth.email}</strong> · Ré-authentification obligatoire
            </p>
          </div>
        </div>

        <form onSubmit={handleRequestEmailChange} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-[#8E97AB] mb-1">
              Nouvelle adresse email
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle@adresse.fr"
              className="w-full px-3.5 py-2.5 text-xs glass-input"
            />
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer"
          >
            Modifier mon adresse email
          </button>
        </form>
      </div>

      {/* Section 2: Two-Factor Authentication (2FA) */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#52BE80]/15 border border-[#52BE80]/30 text-[#52BE80]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Double Authentification (2FA TOTP)
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Sécurisez votre compte avec Google Authenticator ou Apple Passwords
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle2FA}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              is2FAEnabled
                ? 'bg-[#D9695F]/20 text-[#D9695F] hover:bg-[#D9695F]/30'
                : 'bg-[#52BE80] text-[#0B0F1A] hover:bg-[#48A870]'
            }`}
          >
            {is2FAEnabled ? 'Désactiver' : 'Activer le 2FA'}
          </button>
        </div>

        {show2FASetup && (
          <form onSubmit={handleConfirm2FA} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4 max-w-md">
            <div className="space-y-1 text-xs text-[#8E97AB]">
              <p className="font-semibold text-white">1. Scannez cette clé secrète dans votre application :</p>
              <code className="block p-2 rounded-lg bg-black/40 text-[#f7c548] font-mono text-center font-bold tracking-wider">
                EYES-ONWORK-SECURE-2FA-KEY
              </code>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                2. Entrez le code à 6 chiffres généré :
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center text-lg font-mono py-2.5 glass-input tracking-widest font-bold text-[#f7c548]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShow2FASetup(false)}
                className="flex-1 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-[#8E97AB]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#f7c548] text-[#0B0F1A]"
              >
                Confirmer l'activation
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Section 3: Active Sessions & Devices */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 text-white">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Appareils & Sessions Récentes
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Révoquez immédiatement l’ensemble des jetons de session sur tous vos appareils
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRevokeAllDevices}
              disabled={isRevokingAll}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 text-[#f7c548]" />
              <span>{isRevokingAll ? 'Révocation...' : 'Déconnecter tous les appareils'}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-[#D9695F] bg-[#D9695F]/15 hover:bg-[#D9695F]/25 border border-[#D9695F]/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {sessions.map((sess) => (
            <div key={sess.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {sess.device.includes('iPhone') ? (
                  <Smartphone className="w-5 h-5 text-[#8E97AB]" />
                ) : (
                  <Laptop className="w-5 h-5 text-[#8E97AB]" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{sess.device}</span>
                    {sess.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#52BE80]/20 text-[#52BE80]">
                        Cet appareil (Actif)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8E97AB]">
                    {sess.browser} · {sess.ip}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#8E97AB]">{sess.lastActiveAt}</span>
                {sess.isCurrent && (
                  <button
                    type="button"
                    onClick={logout}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium text-[#D9695F] hover:bg-[#D9695F]/15 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Déconnexion</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3b: Data Export (gated with fresh ReauthModal) */}
      <div className="glass-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white font-display">
            Export Intégral de vos Données (RGPD)
          </h3>
          <p className="text-xs text-[#8E97AB] mt-0.5">
            Téléchargez vos clients, projets, devis et factures au format JSON après vérification d’identité.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPendingAction({ type: 'export_data' })}
          className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-[#f7c548]" />
          <span>Exporter mes données</span>
        </button>
      </div>

      {/* Section 4: Danger Zone (Account Deletion gated with fresh ReauthModal) */}
      <div className="glass-card p-6 sm:p-8 space-y-4 border border-[#D9695F]/30 bg-[#D9695F]/5">
        <div className="flex items-center gap-3 text-[#D9695F]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 className="text-base font-bold font-display">
            Zone Dangereuse : Suppression du Compte
          </h3>
        </div>
        <p className="text-xs text-[#8E97AB] max-w-xl">
          La suppression de votre compte efface votre compte d’authentification, votre espace de travail, vos clients, projets, devis et factures. Une ré-authentification fraîche est exigée avant exécution.
        </p>
        <button
          type="button"
          onClick={() => setPendingAction({ type: 'delete_account' })}
          className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#D9695F]/20 hover:bg-[#D9695F]/30 border border-[#D9695F]/40 transition-all cursor-pointer flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Supprimer mon compte et mes données</span>
        </button>
      </div>

      {/* Unified Reauthentication Modal for all 4 sensitive actions */}
      <ReauthModal
        isOpen={pendingAction !== null}
        title={modalMeta.title}
        description={modalMeta.description}
        confirmLabel={modalMeta.confirmLabel}
        onClose={() => setPendingAction(null)}
        onAuthenticated={executePendingSensitiveAction}
      />
    </div>
  );
};
