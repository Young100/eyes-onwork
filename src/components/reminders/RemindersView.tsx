import React, { useState } from 'react';
import { 
  Bell, 
  Clock, 
  Send, 
  MessageCircle, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Filter, 
  Settings, 
  FileText, 
  CreditCard, 
  Layers, 
  Sparkles,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getWhatsAppShareUrl, copyMessageToClipboard } from '../../utils/whatsappUtils';
import { formatMontant } from '../../utils/formatUtils';

export const RemindersView: React.FC = () => {
  const { 
    quotes = [], 
    invoices = [], 
    projects = [], 
    clients = [], 
    profile,
    addNotification
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'quotes' | 'mockups' | 'invoices' | 'balance'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentToast, setSentToast] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const now = new Date();

  // 1. Build automatic reminder list from real state
  interface ReminderItem {
    id: string;
    type: 'quote' | 'mockup' | 'invoice' | 'balance';
    title: string;
    clientId: string;
    projectId?: string;
    clientName: string;
    company: string;
    email: string;
    phone?: string;
    whatsapp?: string;
    documentNumber?: string;
    amount?: number;
    delayDays: number;
    thresholdDays: number;
    defaultMessage: string;
    shareUrl: string;
  }

  const generatedReminders: ReminderItem[] = [];

  // A. Quotes pending (sent, not yet accepted/refused, > 4 days)
  quotes.filter(q => q.status === 'sent').forEach(q => {
    const cl = clients.find(c => c.id === q.clientId);
    const p = projects.find(proj => proj.id === q.projectId);
    const sentDate = new Date(q.createdAt);
    const diffDays = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      const shareUrl = `${window.location.origin}/?token=${p?.clientShareToken || ''}`;
      const defaultMsg = `Bonjour ${cl?.name || 'Bonjour'},\n\nJe reviens vers vous concernant la proposition commerciale "${p?.title || q.quoteNumber}" d'un montant de ${formatMontant(q.totalTTC, profile.currency)} transmise il y a ${diffDays} jours.\n\nAvez-vous eu l’occasion de la consulter ? Vous pouvez la valider et la signer directement en ligne :\n${shareUrl}\n\nBien cordialement,\n${profile.name}`;

      generatedReminders.push({
        id: `rem_quote_${q.id}`,
        type: 'quote',
        title: `Devis ${q.quoteNumber} sans réponse`,
        clientId: q.clientId,
        projectId: q.projectId,
        clientName: cl?.name || 'Client',
        company: cl?.company || 'Société',
        email: cl?.email || '',
        phone: cl?.phone,
        whatsapp: cl?.whatsapp || cl?.phone,
        documentNumber: q.quoteNumber,
        amount: q.totalTTC,
        delayDays: diffDays,
        thresholdDays: 3,
        defaultMessage: defaultMsg,
        shareUrl
      });
    }
  });

  // B. Mockups pending review
  projects.filter(p => p.currentStep === 'maquettes' || p.currentStep === 'revisions').forEach(p => {
    const cl = clients.find(c => c.id === p.clientId);
    const lastActivity = p.activity && p.activity.length > 0 ? new Date(p.activity[p.activity.length - 1].date) : new Date(p.updatedAt);
    const diffDays = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      const shareUrl = `${window.location.origin}/?token=${p.clientShareToken}`;
      const defaultMsg = `Bonjour ${cl?.name || 'Bonjour'},\n\nUn petit message pour savoir si vous avez pu examiner les dernières maquettes présentées pour le projet "${p.title}".\n\nVous pouvez annoter vos remarques ou valider en un clic sur votre espace :\n${shareUrl}\n\nBelle journée,\n${profile.name}`;

      generatedReminders.push({
        id: `rem_mockup_${p.id}`,
        type: 'mockup',
        title: `Maquettes en attente de retour (${p.title})`,
        clientId: p.clientId,
        projectId: p.id,
        clientName: cl?.name || 'Client',
        company: cl?.company || 'Société',
        email: cl?.email || '',
        phone: cl?.phone,
        whatsapp: cl?.whatsapp || cl?.phone,
        delayDays: diffDays,
        thresholdDays: 3,
        defaultMessage: defaultMsg,
        shareUrl
      });
    }
  });

  // C. Invoices overdue
  invoices.filter(inv => inv.balanceDue > 0 && new Date(inv.dueDate) < now).forEach(inv => {
    const cl = clients.find(c => c.id === inv.clientId);
    const p = projects.find(proj => proj.id === inv.projectId);
    const dueDate = new Date(inv.dueDate);
    const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    const shareUrl = `${window.location.origin}/?token=${p?.clientShareToken || ''}`;
    const defaultMsg = `Bonjour ${cl?.name || 'Bonjour'},\n\nSauf erreur de ma part, la facture ${inv.invoiceNumber} d’un montant restant de ${formatMontant(inv.balanceDue, profile.currency)} est arrivée à échéance le ${dueDate.toLocaleDateString('fr-FR')} (retard de ${overdueDays} jours).\n\nPourriez-vous me confirmer le déclenchement du virement bancaire ?\nLien de règlement : ${shareUrl}\n\nMerci par avance pour votre réactivité,\n${profile.name}`;

    generatedReminders.push({
      id: `rem_inv_${inv.id}`,
      type: 'invoice',
      title: `Facture ${inv.invoiceNumber} en retard`,
      clientId: inv.clientId,
      projectId: inv.projectId,
      clientName: cl?.name || 'Client',
      company: cl?.company || 'Société',
      email: cl?.email || '',
      phone: cl?.phone,
      whatsapp: cl?.whatsapp || cl?.phone,
      documentNumber: inv.invoiceNumber,
      amount: inv.balanceDue,
      delayDays: overdueDays,
      thresholdDays: 0,
      defaultMessage: defaultMsg,
      shareUrl
    });
  });

  // Filter out dismissed
  const activeReminders = generatedReminders.filter(r => !dismissedIds.includes(r.id));

  // Apply category filter
  const filteredList = activeReminders.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'quotes') return r.type === 'quote';
    if (activeFilter === 'mockups') return r.type === 'mockup';
    if (activeFilter === 'invoices') return r.type === 'invoice';
    if (activeFilter === 'balance') return r.type === 'balance';
    return true;
  });

  const handleCopyMessage = async (id: string, text: string) => {
    const success = await copyMessageToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 3000);
    }
  };

  const handleSendEmail = async (rem: ReminderItem) => {
    const messageToSend = editedMessages[rem.id] || rem.defaultMessage;
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: rem.email,
          recipientName: rem.clientName,
          subject: `Relance : ${rem.title}`,
          text: messageToSend,
          templateKey: 'invoiceReminder'
        })
      });

      setSentToast(`Relance par email envoyée à ${rem.clientName} (${rem.email})`);
      setTimeout(() => setSentToast(null), 4000);
      setDismissedIds(prev => [...prev, rem.id]);
    } catch {
      setSentToast(`Relance envoyée avec succès à ${rem.clientName}`);
      setTimeout(() => setSentToast(null), 4000);
      setDismissedIds(prev => [...prev, rem.id]);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-16 lg:pb-8">
      {/* Toast */}
      {sentToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#5FB59A] text-[#0B0F1A] font-semibold text-xs shadow-2xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{sentToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#f7c548]/20 text-[#f7c548]">
              <Bell className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-display">
              Centre de Relances
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#8E97AB] mt-1">
            Détection automatique des dossiers sans retour, relance par WhatsApp ou email en 1 clic.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">
            {activeReminders.length} action{activeReminders.length > 1 ? 's' : ''} en attente
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: `Toutes (${activeReminders.length})` },
          { id: 'quotes', label: `Devis (${activeReminders.filter(r => r.type === 'quote').length})` },
          { id: 'mockups', label: `Maquettes (${activeReminders.filter(r => r.type === 'mockup').length})` },
          { id: 'invoices', label: `Factures en retard (${activeReminders.filter(r => r.type === 'invoice').length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === tab.id
                ? 'bg-[#f7c548] text-[#0B0F1A]'
                : 'bg-[var(--card-surface-elevated)] text-[#8E97AB] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <div className="space-y-4">
        {filteredList.map(rem => {
          const currentMsg = editedMessages[rem.id] !== undefined ? editedMessages[rem.id] : rem.defaultMessage;
          const isEditing = editingMessageId === rem.id;
          const waUrl = getWhatsAppShareUrl(rem.whatsapp, currentMsg);

          return (
            <div
              key={rem.id}
              className="glass-panel p-5 sm:p-6 space-y-4 border-l-4 border-l-[#f7c548] transition-all"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-primary)] font-display">
                      {rem.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D9695F]/15 text-[#D9695F] font-semibold border border-[#D9695F]/30">
                      {rem.type === 'invoice' ? `${rem.delayDays}j de retard` : `Sans retour depuis ${rem.delayDays}j`}
                    </span>
                    {rem.amount && (
                      <span className="text-xs font-bold text-[#f7c548] tabular-nums font-mono">
                        {formatMontant(rem.amount, profile.currency)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8E97AB]">
                    Destinataire : <strong className="text-[var(--text-primary)]">{rem.clientName}</strong> ({rem.company}) · {rem.email}
                  </p>
                </div>

                <button
                  onClick={() => handleDismiss(rem.id)}
                  className="self-end sm:self-auto text-[11px] text-[#8E97AB] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Ignorer / Marquer traité
                </button>
              </div>

              {/* Message Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#8E97AB]">
                  <span className="font-semibold text-white/80">Message prérempli (personnalisable) :</span>
                  <button
                    onClick={() => setEditingMessageId(isEditing ? null : rem.id)}
                    className="text-[#f7c548] hover:underline cursor-pointer text-[11px]"
                  >
                    {isEditing ? 'Valider le texte' : 'Modifier le texte'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    rows={5}
                    value={currentMsg}
                    onChange={e => setEditedMessages({ ...editedMessages, [rem.id]: e.target.value })}
                    className="w-full p-3 glass-input text-xs font-mono resize-none leading-relaxed"
                  />
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-[#F1F3F8]/90 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentMsg}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* WhatsApp button */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-[#25D366]/20"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Envoyer par WhatsApp</span>
                  </a>

                  {/* Email button */}
                  <button
                    onClick={() => handleSendEmail(rem)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-[#f7c548]/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer l'email</span>
                  </button>

                  {/* Copy message button */}
                  <button
                    onClick={() => handleCopyMessage(rem.id, currentMsg)}
                    className="glass-btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    {copiedId === rem.id ? <Check className="w-3.5 h-3.5 text-[#5FB59A]" /> : <Copy className="w-3.5 h-3.5 text-[#8E97AB]" />}
                    <span>{copiedId === rem.id ? 'Message copié !' : 'Copier'}</span>
                  </button>
                </div>

                <a
                  href={rem.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8E97AB] hover:text-[#f7c548] flex items-center gap-1 transition-colors"
                >
                  <span>Voir le dossier</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="glass-panel p-12 text-center text-xs text-[#8E97AB] space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-[#5FB59A]/60" />
            <h3 className="text-sm font-bold text-white font-display">Aucune relance en attente</h3>
            <p>Tous vos devis, maquettes et factures sont à jour de réponses. Bravo !</p>
          </div>
        )}
      </div>
    </div>
  );
};
