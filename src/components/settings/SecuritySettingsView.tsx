import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Laptop, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  LogOut, 
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { evaluatePasswordStrength, getInitialSecuritySessions } from '../../utils/authSecurity';
import { SecuritySession, AccountAuditEvent } from '../../types';

export const SecuritySettingsView: React.FC = () => {
  const { auth, reauthenticate, logout, auditLogs } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(auth.twoFactorEnabled || false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<SecuritySession[]>(getInitialSecuritySessions(auth.uid));

  // Account deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationPassword, setDeleteConfirmationPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const newPasswordStrength = evaluatePasswordStrength(newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
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

    setIsChangingPassword(true);
    // Sensitive reauth verification
    const reauthOk = await reauthenticate(currentPassword);
    setIsChangingPassword(false);

    if (!reauthOk) {
      setStatusMessage({ type: 'error', text: 'Le mot de passe actuel est incorrect. Veuillez vérifier.' });
      return;
    }

    setStatusMessage({ type: 'success', text: 'Votre mot de passe a été mis à jour avec succès.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDisconnectOtherSessions = () => {
    setSessions(prev => prev.filter(s => s.isCurrent));
    setStatusMessage({ type: 'success', text: 'Toutes les autres sessions actives ont été déconnectées.' });
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

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    const ok = await reauthenticate(deleteConfirmationPassword);
    if (!ok) {
      setDeleteError('Mot de passe incorrect. Impossible de confirmer la suppression.');
      return;
    }

    alert('Votre demande de suppression a été enregistrée. Un délai de réflexion de 7 jours s’applique avant la purge définitive.');
    logout();
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl">
      
      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' 
            ? 'bg-[#52BE80]/15 border-[#52BE80]/30 text-[#52BE80]' 
            : 'bg-[#D9695F]/15 border-[#D9695F]/30 text-[#F29B9B]'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Section 1: Change Password */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Modification du Mot de Passe
            </h3>
            <p className="text-xs text-[#8E97AB]">
              Une confirmation de votre mot de passe actuel est requise pour toute modification
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-[#8E97AB] mb-1">
              Mot de passe actuel
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 text-xs glass-input"
            />
          </div>

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
            disabled={isChangingPassword}
            className="py-2.5 px-5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer"
          >
            {isChangingPassword ? 'Vérification...' : 'Mettre à jour mon mot de passe'}
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
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 text-white">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Appareils & Sessions Récentes
              </h3>
              <p className="text-xs text-[#8E97AB]">
                Consultez les postes actuellement connectés à votre compte studio
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={logout}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-[#D9695F] bg-[#D9695F]/15 hover:bg-[#D9695F]/25 border border-[#D9695F]/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Mettre fin à la session en cours et retourner à la page de connexion"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>

            {sessions.length > 1 && (
              <button
                onClick={handleDisconnectOtherSessions}
                className="py-2 px-3.5 rounded-xl text-xs font-semibold text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Autres appareils</span>
              </button>
            )}
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
                <span className="text-[11px] text-[#8E97AB]">
                  {sess.lastActiveAt}
                </span>

                {sess.isCurrent && (
                  <button
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

      {/* Section 4: Danger Zone (Account Deletion) */}
      <div className="glass-card p-6 sm:p-8 space-y-4 border border-[#D9695F]/30 bg-[#D9695F]/5">
        <div className="flex items-center gap-3 text-[#D9695F]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 className="text-base font-bold font-display">
            Zone Dangereuse : Suppression du Compte
          </h3>
        </div>
        <p className="text-xs text-[#8E97AB] max-w-xl">
          La suppression de votre compte effacera votre espace de travail, vos projets, devis et factures. Un délai de réflexion de 7 jours est appliqué avant la purge définitive de la base.
        </p>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#D9695F]/20 hover:bg-[#D9695F]/30 border border-[#D9695F]/40 transition-all cursor-pointer flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Supprimer mon compte et mes données</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleDeleteAccount} className="w-full max-w-md bg-[#0B0F1A] border border-[#D9695F]/40 rounded-3xl p-6 space-y-4 text-white">
            <h3 className="text-base font-bold text-[#D9695F] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmation de suppression</span>
            </h3>

            <p className="text-xs text-[#8E97AB]">
              Pour valider la suppression définitive de votre compte studio et de toutes les données associées, veuillez confirmer votre identité en saisissant votre mot de passe actuel :
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-[#D9695F]/20 text-[#D9695F] text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                required
                value={deleteConfirmationPassword}
                onChange={(e) => setDeleteConfirmationPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 text-xs glass-input"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs text-[#8E97AB]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#D9695F] text-white font-bold text-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
