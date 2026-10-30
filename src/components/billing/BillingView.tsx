import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Eye, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Filter, 
  TrendingUp, 
  DollarSign, 
  Copy, 
  Trash2, 
  Calendar, 
  ArrowUpRight,
  ShieldCheck,
  Send,
  FileCheck,
  Download,
  Check,
  Mail,
  Edit3,
  Lock,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Quote, Invoice, QuoteStatus, InvoiceStatus } from '../../types';
import { DocumentA4Modal } from './DocumentA4Modal';
import { CreateQuoteModal } from './CreateQuoteModal';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { generateDirectDocumentPDF } from '../../utils/pdfGenerator';
import { formatCurrencySafe } from '../../utils/formatUtils';

import { getEffectiveInvoiceStatus } from '../../utils/pricingEngine';

interface BillingViewProps {
  onSelectProject?: (projectId: string) => void;
  onSelectClient?: (clientId: string) => void;
}

export const BillingView: React.FC<BillingViewProps> = ({ onSelectProject, onSelectClient }) => {
  const { 
    quotes = [], 
    invoices = [], 
    clients = [], 
    projects = [], 
    profile, 
    createInvoiceFromQuote, 
    deleteQuote, 
    deleteInvoice, 
    duplicateQuote, 
    createQuoteVersion,
    cancelInvoiceWithCreditNote,
    updateQuote,
    updateInvoice 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices'>('quotes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuoteStatus, setSelectedQuoteStatus] = useState<QuoteStatus | 'all'>('all');
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<InvoiceStatus | 'all'>('all');
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string>('all');
  const [selectedProjectIdFilter, setSelectedProjectIdFilter] = useState<string>('all');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<{ doc: Quote | Invoice; type: 'quote' | 'invoice' } | null>(null);
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [directDownloadNotice, setDirectDownloadNotice] = useState<string | null>(null);
  const [sendingQuoteEmailId, setSendingQuoteEmailId] = useState<string | null>(null);
  const [sendingInvoiceEmailId, setSendingInvoiceEmailId] = useState<string | null>(null);

  const handleSendQuoteConfirmationEmail = async (quote: Quote) => {
    const client = (clients || []).find(c => c?.id === quote?.clientId);
    const project = (projects || []).find(p => p?.id === quote?.projectId);
    const targetEmail = (client?.email || (quote as any)?.clientEmail || '')?.trim();
    const clientName = (client?.name || client?.company || (quote as any)?.clientName || '')?.trim();

    // 4. Si l'email du client (to) ou son nom est vide, affiche un message clair dans l'interface au lieu de planter.
    if (!targetEmail) {
      setDirectDownloadNotice("L'adresse email du client (to) est vide. Veuillez renseigner une adresse email dans la fiche client.");
      setTimeout(() => setDirectDownloadNotice(null), 5000);
      return;
    }

    if (!clientName) {
      setDirectDownloadNotice("Le nom du client (clientName) est vide. Veuillez renseigner le nom ou l'entreprise dans la fiche client.");
      setTimeout(() => setDirectDownloadNotice(null), 5000);
      return;
    }

    setSendingQuoteEmailId(quote?.id || 'quote');
    try {
      // 1 & 2. Repère tous les .map( et protège chaque tableau avec une valeur par défaut
      const quoteItemsList = Array.isArray((quote as any)?.items) 
        ? ((quote as any)?.items ?? []) 
        : Array.isArray(quote?.lines) 
        ? (quote?.lines ?? []) 
        : [];

      const projectItemsList = Array.isArray((project as any)?.items)
        ? ((project as any)?.items ?? [])
        : [];

      const sourceArray = quoteItemsList.length > 0 ? quoteItemsList : projectItemsList;

      // Protège chaque tableau avec une valeur par défaut: (quote.items ?? []).map(...) et (project?.items ?? []).map(...)
      const safeItems = (sourceArray ?? []).map((line: any) => ({
        description: String(line?.designation || line?.description || line?.title || line?.name || 'Prestation graphique sur mesure'),
        quantity: Math.max(1, Number(line?.quantity ?? 1)),
        unitPrice: Number(line?.unitPrice ?? line?.price ?? line?.unit_price ?? 0),
        total: Number(line?.total ?? ((Number(line?.quantity ?? 1)) * Number(line?.unitPrice ?? line?.price ?? 0)))
      }));

      // 3. Vérifie que le payload envoyé contient bien to, clientName, orderNumber, projectTitle, items (tableau, éventuellement vide), totalHT et totalTTC.
      const payload = {
        to: targetEmail,
        clientName: clientName,
        orderNumber: String(quote?.quoteNumber || (quote as any)?.number || `DEV-${Date.now().toString().slice(-6)}`),
        projectTitle: String(project?.title || (quote as any)?.projectTitle || 'Prestations graphiques'),
        items: safeItems ?? [], // tableau garanti non-undefined, éventuellement vide
        totalHT: Number(quote?.subtotal ?? (quote as any)?.totalHT ?? 0),
        totalTTC: Number(quote?.totalTTC ?? quote?.subtotal ?? 0),
        vatRate: quote?.vatRate !== undefined ? Number(quote.vatRate) : undefined,
        depositAmount: quote?.depositAmount !== undefined ? Number(quote.depositAmount) : undefined,
        balanceDue: Number((quote?.totalTTC ?? 0) - (quote?.depositAmount || 0)),
        notes: String(quote?.termsAndConditions || (quote as any)?.notes || `Devis validé. Accusé de réception officiel de ${profile?.studioName || 'notre studio'}.`),
        studioName: profile?.studioName,
        replyTo: profile?.email,
        workspaceId: quote?.workspaceId || 'ws_default'
      };

      const resp = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Erreur serveur (${resp.status}) lors de l'envoi de l'email.`);
      }

      setDirectDownloadNotice(`Email de confirmation envoyé avec succès à ${targetEmail} (Nodemailer SMTP) !`);
    } catch (err: any) {
      // 5. Dans le catch, affiche le vrai message d'erreur à l'utilisateur et garde le console.error.
      console.error('[Confirmation Email Error]', err);
      const actualError = err?.message || String(err) || "Impossible de joindre le serveur d'envoi d'email.";
      setDirectDownloadNotice(`Erreur : ${actualError}`);
    } finally {
      setSendingQuoteEmailId(null);
      setTimeout(() => setDirectDownloadNotice(null), 5000);
    }
  };

  const handleSendInvoiceConfirmationEmail = async (invoice: Invoice) => {
    const client = (clients || []).find(c => c?.id === invoice?.clientId);
    const project = (projects || []).find(p => p?.id === invoice?.projectId);
    const targetEmail = (client?.email || (invoice as any)?.clientEmail || '')?.trim();
    const clientName = (client?.name || client?.company || (invoice as any)?.clientName || '')?.trim();

    // 4. Si l'email du client (to) ou son nom est vide, affiche un message clair dans l'interface au lieu de planter.
    if (!targetEmail) {
      setDirectDownloadNotice("L'adresse email du client (to) est vide. Veuillez renseigner une adresse email dans la fiche client.");
      setTimeout(() => setDirectDownloadNotice(null), 5000);
      return;
    }

    if (!clientName) {
      setDirectDownloadNotice("Le nom du client (clientName) est vide. Veuillez renseigner le nom ou l'entreprise dans la fiche client.");
      setTimeout(() => setDirectDownloadNotice(null), 5000);
      return;
    }

    setSendingInvoiceEmailId(invoice?.id || 'inv');
    try {
      // 1 & 2. Repère tous les .map( et protège chaque tableau avec valeur par défaut: (invoice.items ?? []) et (project?.items ?? [])
      const invoiceItemsList = Array.isArray((invoice as any)?.items)
        ? ((invoice as any)?.items ?? [])
        : Array.isArray(invoice?.lines)
        ? (invoice?.lines ?? [])
        : [];

      const projectItemsList = Array.isArray((project as any)?.items)
        ? ((project as any)?.items ?? [])
        : [];

      const sourceArray = invoiceItemsList.length > 0 ? invoiceItemsList : projectItemsList;

      const safeItems = (sourceArray ?? []).map((line: any) => ({
        description: String(line?.designation || line?.description || line?.title || line?.name || 'Prestation graphique sur mesure'),
        quantity: Math.max(1, Number(line?.quantity ?? 1)),
        unitPrice: Number(line?.unitPrice ?? line?.price ?? line?.unit_price ?? 0),
        total: Number(line?.total ?? ((Number(line?.quantity ?? 1)) * Number(line?.unitPrice ?? line?.price ?? 0)))
      }));

      // 3. Vérifie que le payload envoyé contient bien to, clientName, orderNumber, projectTitle, items (tableau, éventuellement vide), totalHT et totalTTC.
      const payload = {
        to: targetEmail,
        clientName: clientName,
        orderNumber: String(invoice?.invoiceNumber || (invoice as any)?.number || `FAC-${Date.now().toString().slice(-6)}`),
        projectTitle: String(project?.title || (invoice as any)?.projectTitle || 'Prestations graphiques'),
        items: safeItems ?? [], // tableau protégé, éventuellement vide
        totalHT: Number(invoice?.subtotal ?? (invoice as any)?.totalHT ?? 0),
        totalTTC: Number(invoice?.totalTTC ?? invoice?.subtotal ?? 0),
        vatRate: invoice?.vatRate !== undefined ? Number(invoice.vatRate) : undefined,
        depositAmount: invoice?.type === 'deposit' ? invoice?.totalTTC : undefined,
        balanceDue: Number(invoice?.balanceDue ?? 0),
        notes: String(invoice?.legalNotice || (invoice as any)?.notes || `Facture émise par ${profile?.studioName || 'le studio'}.`),
        studioName: profile?.studioName,
        replyTo: profile?.email,
        workspaceId: invoice?.workspaceId || 'ws_default'
      };

      const resp = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Erreur serveur (${resp.status}) lors de l'envoi de l'email.`);
      }

      setDirectDownloadNotice(`Email de confirmation envoyé avec succès à ${targetEmail} (Nodemailer SMTP) !`);
    } catch (err: any) {
      // 5. Dans le catch, affiche le vrai message d'erreur à l'utilisateur et garde le console.error.
      console.error('[Confirmation Email Error]', err);
      const actualError = err?.message || String(err) || "Impossible de joindre le serveur d'envoi d'email.";
      setDirectDownloadNotice(`Erreur : ${actualError}`);
    } finally {
      setSendingInvoiceEmailId(null);
      setTimeout(() => setDirectDownloadNotice(null), 5000);
    }
  };

  // Financial calculations
  const totalInvoicedTTC = (invoices || []).reduce((acc, inv) => acc + (inv.totalTTC || 0), 0);
  const totalCollected = (invoices || []).reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
  const totalPending = (invoices || []).reduce((acc, inv) => acc + (inv.balanceDue || 0), 0);
  const totalQuotesSent = (quotes || []).filter(q => q.status === 'sent' || q.status === 'accepted').reduce((acc, q) => acc + (q.totalTTC || 0), 0);

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile.currency || 'EUR', 0);
  };

  const isWithinPeriod = (dateStr: string) => {
    if (selectedPeriodFilter === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (selectedPeriodFilter === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (selectedPeriodFilter === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
    }
    if (selectedPeriodFilter === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered lists
  const filteredQuotes = (quotes || []).filter(q => {
    const client = (clients || []).find(c => c.id === q.clientId);
    const project = (projects || []).find(p => p.id === q.projectId);
    const matchesSearch = 
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client && (client.company.toLowerCase().includes(searchQuery.toLowerCase()) || client.name.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (project && project.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedQuoteStatus === 'all' || q.status === selectedQuoteStatus;
    const matchesClient = selectedClientIdFilter === 'all' || q.clientId === selectedClientIdFilter;
    const matchesProject = selectedProjectIdFilter === 'all' || q.projectId === selectedProjectIdFilter;
    const matchesPeriod = isWithinPeriod(q.createdAt);
    return matchesSearch && matchesStatus && matchesClient && matchesProject && matchesPeriod;
  });

  const filteredInvoices = (invoices || []).filter(inv => {
    const client = (clients || []).find(c => c.id === inv.clientId);
    const project = (projects || []).find(p => p.id === inv.projectId);
    const effectiveStatus = getEffectiveInvoiceStatus(inv);
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client && (client.company.toLowerCase().includes(searchQuery.toLowerCase()) || client.name.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (project && project.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedInvoiceStatus === 'all' || effectiveStatus === selectedInvoiceStatus || (selectedInvoiceStatus === 'cancelled' && (inv.isCancelled || inv.type === 'credit_note'));
    const matchesClient = selectedClientIdFilter === 'all' || inv.clientId === selectedClientIdFilter;
    const matchesProject = selectedProjectIdFilter === 'all' || inv.projectId === selectedProjectIdFilter;
    const matchesPeriod = isWithinPeriod(inv.createdAt);
    return matchesSearch && matchesStatus && matchesClient && matchesProject && matchesPeriod;
  });

  const getQuoteStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#5FB59A]/20 text-[#5FB59A] border border-[#5FB59A]/30">Accepté & Verrouillé 🔒</span>;
      case 'sent':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">Envoyé</span>;
      case 'draft':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 text-[#8E97AB] border border-white/20">Brouillon</span>;
      case 'refused':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#D9695F]/20 text-[#D9695F] border border-[#D9695F]/30">Refusé</span>;
      case 'expired':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-[#8E97AB] border border-white/10">Expiré</span>;
    }
  };

  const getInvoiceStatusBadge = (inv: Invoice) => {
    if (inv.isCancelled || inv.type === 'credit_note') {
      return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">Avoir / Annulée</span>;
    }
    const effectiveStatus = getEffectiveInvoiceStatus(inv);
    switch (effectiveStatus) {
      case 'paid':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#5FB59A]/20 text-[#5FB59A] border border-[#5FB59A]/30">Payée</span>;
      case 'partially_paid':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">Partielle (Acompte perçu)</span>;
      case 'sent':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">En attente</span>;
      case 'overdue':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#D9695F]/25 text-[#D9695F] border border-[#D9695F]/40 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> En retard</span>;
      case 'draft':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 text-[#8E97AB] border border-white/20">Brouillon</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 text-[#8E97AB]">{effectiveStatus}</span>;
    }
  };

  const handleOpenLatestPreview = () => {
    if (activeTab === 'quotes' && quotes.length > 0) {
      setPreviewDoc({ doc: quotes[0], type: 'quote' });
    } else if (activeTab === 'invoices' && invoices.length > 0) {
      setPreviewDoc({ doc: invoices[0], type: 'invoice' });
    } else if (quotes.length > 0) {
      setPreviewDoc({ doc: quotes[0], type: 'quote' });
    } else if (invoices.length > 0) {
      setPreviewDoc({ doc: invoices[0], type: 'invoice' });
    }
  };

  // Projects available for filter
  const projectsForFilter = selectedClientIdFilter === 'all'
    ? projects
    : projects.filter(p => p.clientId === selectedClientIdFilter);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-16 lg:pb-8">
      {/* Toast notice for direct PDF download */}
      {directDownloadNotice && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#5FB59A] text-[#0B0F1A] font-semibold text-xs shadow-2xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{directDownloadNotice}</span>
        </div>
      )}

      {/* Top Banner & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
            Facturation & Devis
          </h1>
          <p className="text-xs sm:text-sm text-[#8E97AB] mt-0.5">
            Émission, prévisualisation conforme A4, téléchargement PDF certifié et suivi des encaissements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick PDF Preview Modal trigger */}
          {(quotes.length > 0 || invoices.length > 0) && (
            <button
              onClick={handleOpenLatestPreview}
              className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-[#f7c548]/30 text-[#f7c548] hover:bg-[#f7c548]/10"
              title="Ouvrir le modal de prévisualisation PDF"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Prévisualiser PDF</span>
            </button>
          )}

          {activeTab === 'quotes' ? (
            <button
              onClick={() => {
                setEditingQuote(null);
                setIsCreateQuoteOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nouveau devis</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCreateInvoiceOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#5FB59A]/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nouvelle facture</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-3.5 sm:p-4 flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-medium text-[#8E97AB]">Devis engagés</span>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-white font-display tabular-nums">
              {formatCurrency(totalQuotesSent)}
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            {(quotes || []).filter(q => q.status === 'accepted').length} devis signés
          </span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-medium text-[#8E97AB]">Total facturé TTC</span>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-white font-display tabular-nums">
              {formatCurrency(totalInvoicedTTC)}
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            {(invoices || []).length} factures émises
          </span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-medium text-[#8E97AB]">Total encaissé</span>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-[#5FB59A] font-display tabular-nums">
              {formatCurrency(totalCollected)}
            </span>
          </div>
          <span className="text-[10px] text-[#5FB59A] border-t border-white/10 pt-1 flex items-center gap-1 font-medium">
            <ArrowUpRight className="w-3 h-3" />
            En caisse
          </span>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-medium text-[#8E97AB]">En attente de paiement</span>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-[#f7c548] font-display tabular-nums">
              {formatCurrency(totalPending)}
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            Soldes & acomptes
          </span>
        </div>
      </div>

      {/* Tabs & Full Filtering Toolbar (Client, Projet, Période, Statut, Recherche) */}
      <div className="glass-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Segmented Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 self-start">
            <button
              onClick={() => setActiveTab('quotes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'quotes'
                  ? 'bg-[#f7c548] text-[#0B0F1A] shadow-sm'
                  : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Devis ({filteredQuotes.length}/{quotes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-[#5FB59A] text-[#0B0F1A] shadow-sm'
                  : 'text-[#8E97AB] hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Factures ({filteredInvoices.length}/{invoices.length})</span>
            </button>
          </div>

          {/* Filters Bar: Client, Projet, Période & Search */}
          <div className="flex items-center gap-2 flex-wrap flex-1 lg:justify-end">
            {/* Filter by Client */}
            <select
              value={selectedClientIdFilter}
              onChange={e => {
                setSelectedClientIdFilter(e.target.value);
                setSelectedProjectIdFilter('all');
              }}
              className="px-3 py-1.5 text-xs glass-input rounded-xl text-white font-medium cursor-pointer max-w-[160px]"
              title="Filtrer par client"
            >
              <option value="all" className="bg-[#111625] text-white">Tous les clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-[#111625] text-white">
                  {c.company}
                </option>
              ))}
            </select>

            {/* Filter by Project */}
            <select
              value={selectedProjectIdFilter}
              onChange={e => setSelectedProjectIdFilter(e.target.value)}
              className="px-3 py-1.5 text-xs glass-input rounded-xl text-white font-medium cursor-pointer max-w-[170px]"
              title="Filtrer par projet"
            >
              <option value="all" className="bg-[#111625] text-white">Tous les projets</option>
              {projectsForFilter.map(p => (
                <option key={p.id} value={p.id} className="bg-[#111625] text-white">
                  {p.title}
                </option>
              ))}
            </select>

            {/* Filter by Period */}
            <select
              value={selectedPeriodFilter}
              onChange={e => setSelectedPeriodFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs glass-input rounded-xl text-white font-medium cursor-pointer max-w-[140px]"
              title="Filtrer par période"
            >
              <option value="all" className="bg-[#111625] text-white">Toutes dates</option>
              <option value="this_month" className="bg-[#111625] text-white">Ce mois-ci</option>
              <option value="last_month" className="bg-[#111625] text-white">Mois dernier</option>
              <option value="this_year" className="bg-[#111625] text-white">Cette année</option>
            </select>

            {/* Quick Search */}
            <div className="relative w-full sm:w-auto min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E97AB]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="N°, client, projet..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs glass-input rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-[#8E97AB]">
          <span className="font-semibold text-white/80 shrink-0 mr-1">Statut :</span>
          {activeTab === 'quotes' ? (
            <>
              {(['all', 'accepted', 'sent', 'draft', 'refused', 'expired'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setSelectedQuoteStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedQuoteStatus === st
                      ? 'bg-[#f7c548] text-[#0B0F1A] font-bold shadow-xs'
                      : 'bg-white/[0.04] text-[#8E97AB] hover:text-white border border-white/10'
                  }`}
                >
                  {st === 'all' && 'Tous les devis'}
                  {st === 'accepted' && 'Acceptés 🔒'}
                  {st === 'sent' && 'Envoyés'}
                  {st === 'draft' && 'Brouillons'}
                  {st === 'refused' && 'Refusés'}
                  {st === 'expired' && 'Expirés'}
                </button>
              ))}
            </>
          ) : (
            <>
              {(['all', 'paid', 'partially_paid', 'sent', 'overdue', 'draft', 'cancelled'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setSelectedInvoiceStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedInvoiceStatus === st
                      ? 'bg-[#5FB59A] text-[#0B0F1A] font-bold shadow-xs'
                      : 'bg-white/[0.04] text-[#8E97AB] hover:text-white border border-white/10'
                  }`}
                >
                  {st === 'all' && 'Toutes les factures'}
                  {st === 'paid' && 'Payées'}
                  {st === 'partially_paid' && 'Partielles (Acomptes)'}
                  {st === 'sent' && 'En attente'}
                  {st === 'overdue' && 'En retard'}
                  {st === 'draft' && 'Brouillons'}
                  {st === 'cancelled' && 'Avoirs / Annulées'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main List Rendering */}
      <div className="space-y-3">
        {activeTab === 'quotes' ? (
          filteredQuotes.length > 0 ? (
            filteredQuotes.map(quote => {
              const client = (clients || []).find(c => c.id === quote.clientId);
              const project = (projects || []).find(p => p.id === quote.projectId);

              return (
                <div
                  key={quote.id}
                  className="glass-panel glass-panel-hover p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-display">
                        {quote.quoteNumber}
                      </span>
                      {getQuoteStatusBadge(quote.status)}
                      <span className="text-[11px] text-[#8E97AB] tabular-nums">
                        Émis le {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {client ? (
                        <button
                          type="button"
                          onClick={() => onSelectClient && onSelectClient(client.id)}
                          className="text-white font-display font-bold hover:text-[#f7c548] hover:underline cursor-pointer transition-colors text-left"
                          title="Accéder à la fiche client"
                        >
                          {client.company}
                        </button>
                      ) : (
                        <span className="text-white font-display font-bold">Client</span>
                      )}
                      <span className="text-white/30">·</span>
                      {project ? (
                        <button
                          type="button"
                          onClick={() => onSelectProject && onSelectProject(project.id)}
                          className="text-[#8E97AB] hover:text-white hover:underline cursor-pointer transition-colors text-left truncate max-w-[200px]"
                          title="Accéder au projet"
                        >
                          {project.title}
                        </button>
                      ) : (
                        <span className="text-[#8E97AB]">Projet</span>
                      )}
                    </div>

                    {quote.acceptedByName && (
                      <p className="text-[11px] text-[#5FB59A] flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Signé par {quote.acceptedByName} le {new Date(quote.acceptedAt || '').toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>

                  {/* Financial & Action CTA */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 flex-wrap">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-[#8E97AB]">
                        HT : {formatCurrency(quote.subtotal)}
                      </div>
                      <div className="text-base sm:text-lg font-bold text-white font-display tabular-nums">
                        {formatCurrency(quote.totalTTC)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {/* Button to edit quote if not accepted, or create new version if locked */}
                      {quote.status !== 'accepted' ? (
                        <button
                          onClick={() => {
                            setEditingQuote(quote);
                            setIsCreateQuoteOpen(true);
                          }}
                          className="glass-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-[#f7c548] hover:bg-[#f7c548]/10"
                          title="Modifier les prestations ou les prix du devis"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Éditer</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const newV = createQuoteVersion(quote.id);
                            setDirectDownloadNotice(`Nouvelle version ${newV.quoteNumber} (V${newV.version}) créée en Brouillon !`);
                            setTimeout(() => setDirectDownloadNotice(null), 4000);
                          }}
                          className="glass-btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-[#f7c548] hover:bg-[#f7c548]/10"
                          title="Créer une nouvelle version pour modifier ce devis accepté"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Version V{(quote.version || 1) + 1}</span>
                        </button>
                      )}

                      {/* Button to open PDF Preview Modal */}
                      <button
                        onClick={() => setPreviewDoc({ doc: quote, type: 'quote' })}
                        className="glass-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer hover:border-[#f7c548]/50 transition-colors"
                        title="Prévisualiser le devis avant téléchargement PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#f7c548]" />
                        <span className="hidden sm:inline">Aperçu</span>
                      </button>

                      {/* Direct 1-click PDF Download */}
                      <button
                        onClick={() => {
                          generateDirectDocumentPDF(quote, 'quote', client, profile, project);
                          setDirectDownloadNotice(`Devis ${quote.quoteNumber}.pdf téléchargé !`);
                          setTimeout(() => setDirectDownloadNotice(null), 3500);
                        }}
                        className="p-2 text-[#8E97AB] hover:text-[#f7c548] hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                        title="Télécharger directement en fichier .PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {quote.status === 'accepted' && (
                        <button
                          onClick={() => {
                            createInvoiceFromQuote(quote.id, 'deposit');
                            setActiveTab('invoices');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] transition-colors cursor-pointer shadow-sm shadow-[#5FB59A]/20"
                          title="Générer facture d'acompte"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Facture acompte</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSendQuoteConfirmationEmail(quote)}
                        disabled={sendingQuoteEmailId === quote.id}
                        className="p-2 text-[#8E97AB] hover:text-[#06665F] hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="Envoyer confirmation client par email"
                      >
                        <Mail className={`w-3.5 h-3.5 ${sendingQuoteEmailId === quote.id ? 'animate-bounce text-[#06665F]' : ''}`} />
                      </button>

                      <button
                        onClick={() => duplicateQuote(quote.id)}
                        className="p-2 text-[#8E97AB] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                        title="Dupliquer le devis"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {quote.status !== 'accepted' && (
                        <button
                          onClick={() => deleteQuote(quote.id)}
                          className="p-2 text-[#8E97AB] hover:text-[#D9695F] hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                          title="Supprimer ce devis brouillon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-panel p-12 text-center text-xs text-[#8E97AB] space-y-3 animate-fadeIn">
              <FileText className="w-10 h-10 mx-auto text-[#f7c548]/50" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Aucun devis pour les critères sélectionnés</p>
                <p>Modifiez vos filtres ou créez votre première proposition commerciale.</p>
              </div>
              <button
                onClick={() => {
                  setEditingQuote(null);
                  setIsCreateQuoteOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm shadow-[#f7c548]/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Nouveau devis</span>
              </button>
            </div>
          )
        ) : (
          filteredInvoices.length > 0 ? (
            filteredInvoices.map(invoice => {
              const client = (clients || []).find(c => c.id === invoice.clientId);
              const project = (projects || []).find(p => p.id === invoice.projectId);
              const payments = invoice.payments || [];
              const isIssued = invoice.status !== 'draft';

              return (
                <div
                  key={invoice.id}
                  className="glass-panel glass-panel-hover p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-display">
                        {invoice.invoiceNumber}
                      </span>
                      {getInvoiceStatusBadge(invoice)}
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white/80 font-medium">
                        {invoice.type === 'deposit' && 'Acompte'}
                        {invoice.type === 'balance' && 'Solde final'}
                        {invoice.type === 'full' && 'Facture intégrale'}
                        {invoice.type === 'additional' && 'Prestation sup.'}
                        {invoice.type === 'credit_note' && 'Avoir rectificatif'}
                      </span>
                      <span className="text-[11px] text-[#8E97AB] tabular-nums">
                        Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                      </span>
                      {isIssued && (
                        <span className="text-[10px] text-[#8E97AB] flex items-center gap-1 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5" title="Conformité fiscale : facture scellée">
                          <Lock className="w-3 h-3 text-[#f7c548]" />
                          <span>Scellée</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {client ? (
                        <button
                          type="button"
                          onClick={() => onSelectClient && onSelectClient(client.id)}
                          className="text-white font-display font-bold hover:text-[#5FB59A] hover:underline cursor-pointer transition-colors text-left"
                          title="Accéder à la fiche client"
                        >
                          {client.company}
                        </button>
                      ) : (
                        <span className="text-white font-display font-bold">Client</span>
                      )}
                      <span className="text-white/30">·</span>
                      {project ? (
                        <button
                          type="button"
                          onClick={() => onSelectProject && onSelectProject(project.id)}
                          className="text-[#8E97AB] hover:text-white hover:underline cursor-pointer transition-colors text-left truncate max-w-[200px]"
                          title="Accéder au projet"
                        >
                          {project.title}
                        </button>
                      ) : (
                        <span className="text-[#8E97AB]">Projet</span>
                      )}
                    </div>

                    {payments.length > 0 && (
                      <p className="text-[11px] text-[#5FB59A] font-medium">
                        Dernier encaissement : {formatCurrency(invoice.paidAmount)} reçu par {payments[payments.length - 1]?.method || 'Virement'}
                      </p>
                    )}
                  </div>

                  {/* Financial & Action CTA */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 flex-wrap">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-[#8E97AB]">
                        Total TTC : <span className="text-white font-semibold tabular-nums">{formatCurrency(invoice.totalTTC)}</span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-[#f7c548] font-display tabular-nums">
                        {invoice.balanceDue > 0 ? `Dû : ${formatCurrency(invoice.balanceDue)}` : 'Soldé'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {/* Button to open PDF Preview Modal */}
                      <button
                        onClick={() => setPreviewDoc({ doc: invoice, type: 'invoice' })}
                        className="glass-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer hover:border-[#5FB59A]/50 transition-colors"
                        title="Prévisualiser la facture avant téléchargement PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5FB59A]" />
                        <span className="hidden sm:inline">Aperçu</span>
                      </button>

                      {/* Direct 1-click PDF Download */}
                      <button
                        onClick={() => {
                          generateDirectDocumentPDF(invoice, 'invoice', client, profile, project);
                          setDirectDownloadNotice(`Facture ${invoice.invoiceNumber}.pdf téléchargée !`);
                          setTimeout(() => setDirectDownloadNotice(null), 3500);
                        }}
                        className="p-2 text-[#8E97AB] hover:text-[#5FB59A] hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                        title="Télécharger directement en fichier .PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Payment trigger */}
                      {invoice.balanceDue > 0 && !invoice.isCancelled && (
                        <button
                          onClick={() => setPaymentModalInvoice(invoice)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] transition-colors cursor-pointer shadow-sm shadow-[#5FB59A]/20"
                          title="Enregistrer un paiement"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Encaisser</span>
                        </button>
                      )}

                      {/* Annuler avec avoir (pour facture émise) */}
                      {isIssued && !invoice.isCancelled && invoice.type !== 'credit_note' && (
                        <button
                          onClick={() => setInvoiceToCancel(invoice)}
                          className="p-2 text-[#8E97AB] hover:text-[#D9695F] hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                          title="Annuler avec avoir rectificatif (conservé en comptabilité)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Confirmation / Receipt Email trigger */}
                      <button
                        onClick={() => handleSendInvoiceConfirmationEmail(invoice)}
                        disabled={sendingInvoiceEmailId === invoice.id}
                        className="p-2 text-[#8E97AB] hover:text-[#06665F] hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="Envoyer confirmation / reçu facture par email (Nodemailer SMTP)"
                      >
                        <Mail className={`w-3.5 h-3.5 ${sendingInvoiceEmailId === invoice.id ? 'animate-bounce text-[#06665F]' : ''}`} />
                      </button>

                      {/* Supprimer si et seulement si Brouillon */}
                      {!isIssued && (
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="p-2 text-[#8E97AB] hover:text-[#D9695F] hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                          title="Supprimer ce brouillon de facture"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-panel p-12 text-center text-xs text-[#8E97AB] space-y-3 animate-fadeIn">
              <CreditCard className="w-10 h-10 mx-auto text-[#f7c548]/50" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Aucune facture pour les critères sélectionnés</p>
                <p>Générez votre première facture d’acompte ou de solde pour assurer le suivi de vos encaissements.</p>
              </div>
              <button
                onClick={() => setIsCreateInvoiceOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm shadow-[#f7c548]/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Nouvelle facture</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* A4 PDF Preview Modal */}
      {previewDoc && (
        <DocumentA4Modal
          document={previewDoc.doc}
          type={previewDoc.type}
          client={(clients || []).find(c => c.id === previewDoc.doc.clientId)}
          project={(projects || []).find(p => p.id === previewDoc.doc.projectId)}
          profile={profile}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Create / Edit Quote Modal */}
      <CreateQuoteModal
        isOpen={isCreateQuoteOpen}
        onClose={() => {
          setIsCreateQuoteOpen(false);
          setEditingQuote(null);
        }}
        quoteToEdit={editingQuote}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
      />

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          isOpen={true}
          onClose={() => setPaymentModalInvoice(null)}
        />
      )}

      {/* Confirmation Annulation avec Avoir Rectificatif */}
      {invoiceToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-[#D9695F]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white font-display">
                Annuler la facture {invoiceToCancel.invoiceNumber}
              </h3>
            </div>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Conformément aux obligations légales et fiscales d'inaltérabilité, une facture émise ne peut être ni modifiée ni supprimée.
              Elle sera marquée <strong className="text-white">Annulée</strong> et un <strong className="text-white">avoir rectificatif officiel</strong> sera automatiquement émis dans votre comptabilité avec traçabilité complète.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToCancel(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Conserver la facture
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelInvoiceWithCreditNote(invoiceToCancel.id);
                  setDirectDownloadNotice(`Facture ${invoiceToCancel.invoiceNumber} annulée et avoir émis !`);
                  setInvoiceToCancel(null);
                  setTimeout(() => setDirectDownloadNotice(null), 4000);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#D9695F] hover:bg-[#e0584e] transition-colors cursor-pointer shadow-md shadow-[#D9695F]/20"
              >
                Confirmer l'avoir rectificatif
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
