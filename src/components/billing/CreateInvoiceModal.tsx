import React, { useState, useEffect } from 'react';
import { X, Receipt, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InvoiceType, QuoteLine } from '../../types';
import { calculateDocumentTotals, formatCurrencySafe } from '../../utils/pricingEngine';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  defaultProjectId?: string;
  preselectedQuoteId?: string;
  isClientLocked?: boolean;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  defaultClientId,
  defaultProjectId,
  preselectedQuoteId,
  isClientLocked = false
}) => {
  const { 
    clients, 
    projects, 
    quotes, 
    addInvoice, 
    createInvoiceFromQuote, 
    profile 
  } = useApp();

  const [selectedClientId, setSelectedClientId] = useState(defaultClientId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '');
  const [mode, setMode] = useState<'from_quote' | 'direct'>(preselectedQuoteId ? 'from_quote' : 'from_quote');
  const [selectedQuoteId, setSelectedQuoteId] = useState(preselectedQuoteId || '');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('deposit');
  const [directTitle, setDirectTitle] = useState('Prestation additionnelle');
  const [directAmount, setDirectAmount] = useState('500');
  const [directVat, setDirectVat] = useState(profile.defaultVatRate || 20);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultClientId) setSelectedClientId(defaultClientId);
    if (defaultProjectId) setSelectedProjectId(defaultProjectId);
    if (preselectedQuoteId) setSelectedQuoteId(preselectedQuoteId);
  }, [defaultClientId, defaultProjectId, preselectedQuoteId]);

  if (!isOpen) return null;

  const clientProjects = projects.filter(p => p.clientId === selectedClientId && !p.archived);
  const acceptedQuotes = quotes.filter(q => {
    if (selectedProjectId) return q.projectId === selectedProjectId && q.status === 'accepted';
    if (selectedClientId) return q.clientId === selectedClientId && q.status === 'accepted';
    return q.status === 'accepted';
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Veuillez sélectionner un client.');
      return;
    }

    try {
      if (mode === 'from_quote') {
        if (!selectedQuoteId) {
          setError('Veuillez sélectionner un devis accepté.');
          return;
        }
        createInvoiceFromQuote(selectedQuoteId, invoiceType as 'deposit' | 'balance' | 'full');
      } else {
        if (!selectedProjectId) {
          setError('Veuillez sélectionner un projet pour cette prestation.');
          return;
        }
        const amt = parseFloat(directAmount) || 0;
        if (amt <= 0) {
          setError('Le montant doit être supérieur à 0.');
          return;
        }
        const proj = projects.find(p => p.id === selectedProjectId);
        const vatAmt = Math.round(amt * (directVat / 100));
        addInvoice({
          projectId: selectedProjectId,
          clientId: selectedClientId || proj?.clientId || '',
          type: 'full',
          status: 'sent',
          dueDate: dueDate,
          lines: [
            {
              id: `line_${Date.now()}`,
              designation: directTitle || 'Prestation directe',
              description: directTitle || 'Prestation directe',
              quantity: 1,
              unitPrice: amt,
              total: amt
            }
          ],
          subtotal: amt,
          vatRate: directVat,
          vatAmount: vatAmt,
          totalTTC: amt + vatAmt,
          legalNotice: profile.legalNoticeTemplate || profile.legalNotice || 'Paiement à réception de facture.'
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération de la facture.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121826] border border-[#1E293B] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548]">
            <Receipt size={20} />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white">Émettre une facture</h2>
            <p className="text-xs text-[#8E97AB]">Numérotation continue certifiée & traçabilité stricte</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0B0F1A] border border-[#1E293B]">
            <button
              type="button"
              onClick={() => setMode('from_quote')}
              className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'from_quote' ? 'bg-[#f7c548] text-[#0B0F1A]' : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              Depuis un devis accepté
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'direct' ? 'bg-[#f7c548] text-[#0B0F1A]' : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              Facture directe / extra
            </button>
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-[#8E97AB] font-medium mb-1">Client destinataire *</label>
            {defaultClientId ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#f7c548]/30 text-white font-medium flex items-center justify-between">
                <span>{clients.find(c => c.id === defaultClientId)?.company || clients.find(c => c.id === defaultClientId)?.name}</span>
                <span className="text-[10px] text-[#f7c548] font-semibold uppercase">Client sélectionné</span>
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedProjectId('');
                  setSelectedQuoteId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                required
              >
                <option value="">Sélectionner un client...</option>
                {clients.filter(c => c.status !== 'archived').map(c => (
                  <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>
                ))}
              </select>
            )}
          </div>

          {mode === 'from_quote' ? (
            <>
              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Devis validé de référence *</label>
                <select
                  value={selectedQuoteId}
                  onChange={(e) => setSelectedQuoteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                  required
                >
                  <option value="">Sélectionner un devis accepté...</option>
                  {acceptedQuotes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quoteNumber} (V{q.version || 1}) — {formatCurrencySafe(q.totalTTC, profile.currency)} TTC
                    </option>
                  ))}
                </select>
                {acceptedQuotes.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">Aucun devis accepté pour ce client. Acceptez d'abord un devis ou choisissez la facture directe.</p>
                )}
              </div>

              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Type de facture *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'deposit', label: 'Acompte' },
                    { id: 'balance', label: 'Solde restant' },
                    { id: 'full', label: 'Facture complète' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setInvoiceType(t.id as InvoiceType)}
                      className={`p-2.5 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                        invoiceType === t.id
                          ? 'border-[#f7c548] bg-[#f7c548]/15 text-[#f7c548]'
                          : 'border-[#1E293B] bg-[#0B0F1A] text-[#8E97AB] hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Projet rattaché *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                  required
                >
                  <option value="">Sélectionner un projet...</option>
                  {clientProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Intitulé de la prestation *</label>
                <input
                  type="text"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Montant HT ({profile.currency}) *</label>
                  <input
                    type="number"
                    step="any"
                    value={directAmount}
                    onChange={(e) => setDirectAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono focus:outline-none focus:border-[#f7c548]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">TVA (%)</label>
                  <input
                    type="number"
                    value={directVat}
                    onChange={(e) => setDirectVat(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono focus:outline-none focus:border-[#f7c548]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[#8E97AB] font-medium mb-1">Date d'échéance de paiement *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#f7c548]/15"
            >
              <Receipt size={16} />
              <span>Émettre la facture</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
