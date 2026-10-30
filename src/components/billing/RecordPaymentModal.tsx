import React, { useState } from 'react';
import { X, CreditCard, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, PaymentMethod } from '../../types';
import { formatCurrencySafe } from '../../utils/pricingEngine';

interface RecordPaymentModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  isOpen,
  onClose
}) => {
  const { recordPayment, profile, clients, projects } = useApp();

  const client = (clients || []).find(c => c.id === invoice.clientId);
  const project = (projects || []).find(p => p.id === invoice.projectId);

  const [amount, setAmount] = useState(invoice.balanceDue.toString());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMethod>('virement');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount) || 0;
    if (parsed <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }

    recordPayment(invoice.id, {
      amount: parsed,
      date,
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined
    });

    onClose();
  };

  const paymentMethods: { id: PaymentMethod; label: string }[] = [
    { id: 'virement', label: 'Virement bancaire' },
    { id: 'especes', label: 'Espèces' },
    { id: 'mobile_money', label: 'Mobile Money (Wave / Orange)' },
    { id: 'cheque', label: 'Chèque' },
    { id: 'autre', label: 'Autre mode' }
  ];

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
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white">Enregistrer un règlement</h2>
            <p className="text-xs text-[#8E97AB]">Facture {invoice.invoiceNumber} — {client?.name || client?.company || 'Client'}</p>
          </div>
        </div>

        {/* Invoice Balance Summary */}
        <div className="p-4 rounded-2xl bg-[#0B0F1A] border border-[#1E293B] grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[#8E97AB]">Total TTC facture :</div>
            <div className="text-sm font-bold font-mono text-white mt-0.5">{formatCurrencySafe(invoice.totalTTC, profile.currency)}</div>
          </div>
          <div>
            <div className="text-[#8E97AB]">Solde restant à régler :</div>
            <div className="text-sm font-bold font-mono text-[#F472B6] mt-0.5">{formatCurrencySafe(invoice.balanceDue, profile.currency)}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#8E97AB] font-medium mb-1">Montant perçu ({profile.currency}) *</label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548] font-mono text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8E97AB] font-medium mb-1">Date d'encaissement *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                required
              />
            </div>
            <div>
              <label className="block text-[#8E97AB] font-medium mb-1">Mode de règlement *</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
              >
                {paymentMethods.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#121826] text-white">{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#8E97AB] font-medium mb-1">Référence bancaire / transaction</label>
            <input
              type="text"
              placeholder="ex: VIR-2026-9481 ou Chèque N° 00412"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
            />
          </div>

          <div>
            <label className="block text-[#8E97AB] font-medium mb-1">Notes internes</label>
            <textarea
              placeholder="Commentaire de trésorerie..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
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
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Check size={16} />
              <span>Valider le règlement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
