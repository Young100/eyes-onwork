import React, { useState } from 'react';
import { X, Send, Mail, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface EmailPreviewModalProps {
  isOpen: boolean;
  to: string;
  recipientName: string;
  subject: string;
  defaultContent: string;
  templateKey: string;
  onClose: () => void;
  onSent?: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  to,
  recipientName,
  subject: initialSubject,
  defaultContent,
  templateKey,
  onClose,
  onSent
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [content, setContent] = useState(defaultContent);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    setStatusMessage(null);

    try {
      const resp = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          recipientName,
          subject,
          text: content,
          templateKey
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        setStatusMessage({
          type: 'success',
          text: data.mode === 'live' 
            ? `Email envoyé avec succès via Gmail SMTP à ${to} !`
            : `Email simulé avec succès pour ${to} (mode local test).`
        });
        setTimeout(() => {
          onSent?.();
          onClose();
        }, 2000);
      } else {
        throw new Error(data.error || 'Erreur lors de l’envoi');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Impossible de joindre le serveur d’envoi'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#f7c548]" />
            <h3 className="text-base font-bold text-white font-display">
              Aperçu avant envoi d'email
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E97AB] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
            statusMessage.type === 'success' ? 'bg-[#5FB59A]/20 text-[#5FB59A]' : 'bg-[#D9695F]/20 text-[#D9695F]'
          }`}>
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[#8E97AB] font-semibold mb-1">Destinataire :</label>
            <input
              type="text"
              readOnly
              value={`${recipientName} <${to}>`}
              className="w-full px-3 py-1.5 glass-input text-xs text-white/80 select-all"
            />
          </div>

          <div>
            <label className="block text-[#8E97AB] font-semibold mb-1">Objet :</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-1.5 glass-input text-xs font-medium text-white"
            />
          </div>

          <div>
            <label className="block text-[#8E97AB] font-semibold mb-1">Corps du message :</label>
            <textarea
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full p-3 glass-input text-xs font-mono resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-[11px] text-[#8E97AB]">
            Serveur sécurisé (aucune clé exposée au client)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#8E97AB] hover:text-white transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer disabled:opacity-50 font-display"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSending ? 'Envoi...' : 'Envoyer maintenant'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
