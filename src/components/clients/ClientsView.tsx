import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  FileText, 
  Briefcase, 
  Edit3, 
  Trash2, 
  X,
  Building,
  ArrowRight,
  UserPlus,
  Sparkles,
  MessageCircle,
  CreditCard,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Lock,
  Receipt,
  FileCheck,
  Send,
  Eye,
  Activity,
  FolderCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client, Project, Quote, Invoice, PROJECT_STEPS, PROJECT_TYPE_LABELS } from '../../types';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { getWhatsAppShareUrl } from '../../utils/whatsappUtils';
import { CreateQuoteModal } from '../billing/CreateQuoteModal';
import { CreateInvoiceModal } from '../billing/CreateInvoiceModal';
import { DocumentA4Modal } from '../billing/DocumentA4Modal';

interface ClientsViewProps {
  onSelectProject: (projectId: string) => void;
  onOpenNewProjectForClient?: (clientId: string) => void;
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
  selectedClientIdProp?: string | null;
  onSelectClient?: (clientId: string) => void;
}

type ClientTab = 'projects' | 'quotes' | 'invoices' | 'files_notes' | 'activity';

export const ClientsView: React.FC<ClientsViewProps> = ({
  onSelectProject,
  onOpenNewProjectForClient,
  isCreateModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
  selectedClientIdProp,
  onSelectClient
}) => {
  const { 
    clients, 
    projects, 
    quotes, 
    invoices, 
    addClient, 
    updateClient, 
    deleteClient, 
    archiveClient,
    canDeleteClient,
    profile,
    hasDemoData,
    loadSampleDemoData,
    currentWorkspace
  } = useApp();

  const currency = profile.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'prospect' | 'archived'>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(selectedClientIdProp || clients[0]?.id || null);
  const [activeTab, setActiveTab] = useState<ClientTab>('projects');

  useEffect(() => {
    if (selectedClientIdProp) {
      setSelectedClientId(selectedClientIdProp);
    }
  }, [selectedClientIdProp]);

  // Modals for Quote, Invoice & A4 Document preview
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ doc: Quote | Invoice; type: 'quote' | 'invoice' } | null>(null);

  // Archive Proposal modal state (when deletion is forbidden)
  const [archiveProposal, setArchiveProposal] = useState<{
    client: Client;
    reason: string;
    projectCount: number;
    quoteCount: number;
    invoiceCount: number;
  } | null>(null);

  // Edit client modal state
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state for new / edit client
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    website: '',
    privateNotes: '',
    status: 'active' as 'active' | 'prospect' | 'archived'
  });

  // Current selected client
  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  // Client relations
  const clientProjects = selectedClient ? projects.filter(p => p.clientId === selectedClient.id) : [];
  const clientQuotes = selectedClient ? quotes.filter(q => q.clientId === selectedClient.id) : [];
  const clientInvoices = selectedClient ? invoices.filter(i => i.clientId === selectedClient.id) : [];

  // Financial synthesis metrics
  const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
  const totalPaid = clientInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalBalanceDue = Math.max(0, totalInvoiced - totalPaid);
  const activeProjectsCount = clientProjects.filter(p => !p.isArchived && p.currentStep !== 'livre').length;

  // Filtered clients list
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      Boolean(c.phone && c.phone.includes(search));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, currency, 0);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone || '',
      whatsapp: client.whatsapp || client.phone || '',
      address: client.address || '',
      website: client.website || '',
      privateNotes: client.privateNotes || '',
      status: client.status
    });
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company.trim() || !formData.name.trim() || !formData.email.trim()) {
      return;
    }

    if (editingClient) {
      updateClient(editingClient.id, formData);
      setEditingClient(null);
    } else {
      const created = addClient({ ...formData, workspaceId: currentWorkspace.id });
      setSelectedClientId(created.id);
      onCloseCreateModal();
    }
  };

  // Attempt delete with integrity check
  const handleAttemptDelete = (client: Client) => {
    const check = canDeleteClient(client.id);
    if (!check.allowed) {
      setArchiveProposal({
        client,
        reason: check.reason || '',
        projectCount: check.projectCount,
        quoteCount: check.quoteCount,
        invoiceCount: check.invoiceCount
      });
      return;
    }

    if (window.confirm(`Supprimer définitivement le client "${client.company}" ? Cette opération est irréversible.`)) {
      deleteClient(client.id);
      if (selectedClientId === client.id) {
        const remaining = clients.filter(c => c.id !== client.id);
        setSelectedClientId(remaining[0]?.id || null);
      }
    }
  };

  // Execute archive proposal
  const handleConfirmArchive = () => {
    if (!archiveProposal) return;
    archiveClient(archiveProposal.client.id);
    setArchiveProposal(null);
  };

  // Quick notes update
  const handleUpdatePrivateNotes = (newNotes: string) => {
    if (!selectedClient) return;
    updateClient(selectedClient.id, { privateNotes: newNotes });
  };

  // Aggregated activity logs for the client
  const clientActivityLogs = React.useMemo(() => {
    if (!selectedClient) return [];
    const logs: { id: string; date: string; title: string; subtitle: string; type: string }[] = [];

    // Projects logs
    clientProjects.forEach(p => {
      logs.push({
        id: `act_p_${p.id}`,
        date: p.createdAt,
        title: `Nouveau projet créé`,
        subtitle: `Dossier "${p.title}" (${formatCurrency(p.budget)})`,
        type: 'project'
      });
      if (p.activity) {
        p.activity.forEach(a => {
          logs.push({
            id: `act_pa_${a.id}`,
            date: a.date,
            title: a.title,
            subtitle: `${p.title} · ${a.description || ''}`,
            type: a.type
          });
        });
      }
    });

    // Quotes logs
    clientQuotes.forEach(q => {
      logs.push({
        id: `act_q_${q.id}`,
        date: q.createdAt,
        title: `Devis émis (${q.quoteNumber})`,
        subtitle: `${formatCurrency(q.totalTTC)} TTC · Statut : ${q.status}`,
        type: 'quote'
      });
      if (q.acceptedAt) {
        logs.push({
          id: `act_qa_${q.id}`,
          date: q.acceptedAt,
          title: `Devis signé et validé`,
          subtitle: `${q.quoteNumber} approuvé par ${q.acceptedByName || 'le client'}`,
          type: 'quote_accepted'
        });
      }
    });

    // Invoices logs
    clientInvoices.forEach(inv => {
      logs.push({
        id: `act_i_${inv.id}`,
        date: inv.createdAt,
        title: `Facture émise (${inv.invoiceNumber})`,
        subtitle: `${inv.type === 'deposit' ? 'Acompte' : 'Facture'} de ${formatCurrency(inv.totalTTC)} TTC`,
        type: 'invoice'
      });
      if (inv.payments) {
        inv.payments.forEach(pay => {
          logs.push({
            id: `act_pay_${pay.id}`,
            date: pay.date,
            title: `Règlement perçu`,
            subtitle: `${formatCurrency(pay.amount)} par ${pay.method} pour ${inv.invoiceNumber}`,
            type: 'payment'
          });
        });
      }
    });

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedClient, clientProjects, clientQuotes, clientInvoices]);

  return (
    <div className="space-y-6 animate-fadeIn pb-16 lg:pb-6">
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-display flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#f7c548]" />
            <span>Fiches Clients ({clients.length})</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            Répertoire centralisé, projets rattachés, devis, factures et suivi relationnel.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all shadow-md shadow-[#f7c548]/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nouveau client</span>
        </button>
      </div>

      {/* Empty State when no clients at all */}
      {clients.length === 0 ? (
        <div className="glass-panel p-10 sm:p-14 text-center space-y-4 max-w-xl mx-auto my-8 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] mx-auto shadow-md">
            <UserPlus className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[var(--text-primary)] font-display">
              Aucun client pour l'instant
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Ajoutez votre premier client pour commencer à gérer vos dossiers, devis et factures rattachés.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={onOpenCreateModal}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#f7c548]/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ajouter mon premier client</span>
            </button>
            {!hasDemoData && (
              <button
                onClick={loadSampleDemoData}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#f7c548]" />
                <span>Explorer avec des données d'exemple</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Split view: Clients list (Left) + Detailed Profile with Tabs (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Client Cards List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search & Status Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E97AB] stroke-[1.5]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, marque, email..."
                  className="w-full pl-9 pr-4 py-2 text-xs glass-input placeholder:text-[#8E97AB]/70"
                />
              </div>

              {/* Segmented status filter */}
              <div className="flex items-center gap-1 p-1 bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)] rounded-xl">
                {(['all', 'active', 'prospect', 'archived'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer capitalize ${
                      statusFilter === st
                        ? 'bg-[var(--card-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {st === 'all' ? 'Tous' : st === 'active' ? 'Actifs' : st === 'prospect' ? 'Prospects' : 'Archivés'}
                  </button>
                ))}
              </div>
            </div>

            {/* Clients List */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredClients.map((client) => {
                const isSelected = selectedClientId === client.id;
                const pCount = projects.filter(p => p.clientId === client.id).length;
                const qCount = quotes.filter(q => q.clientId === client.id).length;

                return (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`
                      p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isSelected 
                        ? 'bg-[var(--card-surface-elevated)] border-[#f7c548]/60 shadow-lg shadow-black/10' 
                        : 'bg-[var(--card-surface)] hover:bg-[var(--card-surface-elevated)] border-[var(--border-subtle)]'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[var(--text-primary)] font-display truncate">
                            {client.company}
                          </h3>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            client.status === 'active' ? 'bg-[#5FB59A]' : client.status === 'prospect' ? 'bg-[#f7c548]' : 'bg-neutral-500'
                          }`} />
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                          {client.name} · {client.email}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--badge-gold-bg)] text-[var(--badge-gold-text)] font-semibold border border-[#f7c548]/20">
                          {pCount} {pCount > 1 ? 'projets' : 'projet'}
                        </span>
                        {qCount > 0 && (
                          <span className="text-[9px] text-[var(--text-secondary)]">
                            {qCount} devis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredClients.length === 0 && (
                <div className="glass-panel p-8 text-center text-xs text-[var(--text-secondary)]">
                  Aucun client ne correspond à votre recherche.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Client Detailed File */}
          <div className="lg:col-span-8">
            {selectedClient ? (
              <div className="glass-panel p-5 sm:p-6 space-y-6">
                
                {/* 1. Header Profile with Contact details & Quick call/WhatsApp/Email buttons */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--card-surface-elevated)] border border-[#f7c548]/50 flex items-center justify-center text-[#f7c548] font-bold text-xl font-display shadow-md shrink-0">
                      {selectedClient.company.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-[var(--text-primary)] font-display truncate">
                          {selectedClient.company}
                        </h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold capitalize ${
                          selectedClient.status === 'active' 
                            ? 'bg-[#5FB59A]/15 text-[#5FB59A] border border-[#5FB59A]/30' 
                            : selectedClient.status === 'prospect'
                            ? 'bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30'
                            : 'bg-[var(--card-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}>
                          {selectedClient.status === 'active' ? 'Client actif' : selectedClient.status === 'prospect' ? 'Prospect' : 'Archivé'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Interlocuteur : <strong className="text-[var(--text-primary)] font-medium">{selectedClient.name}</strong> · {selectedClient.email}
                      </p>
                    </div>
                  </div>

                  {/* Contact Action Buttons (Call, WhatsApp, Email, Edit, Delete/Archive) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedClient.phone && (
                      <a
                        href={`tel:${selectedClient.phone}`}
                        className="p-2 rounded-xl text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                        title={`Appeler ${selectedClient.phone}`}
                      >
                        <Phone className="w-4 h-4 text-[#5FB59A]" />
                      </a>
                    )}

                    {(selectedClient.whatsapp || selectedClient.phone) && (
                      <a
                        href={getWhatsAppShareUrl(
                          selectedClient.whatsapp || selectedClient.phone,
                          `Bonjour ${selectedClient.name},\n\nJe reviens vers vous concernant nos projets graphiques en cours.\n\nBien cordialement,\n${profile.name}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                        title="Ouvrir conversation WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      </a>
                    )}

                    <a
                      href={`mailto:${selectedClient.email}?subject=Projets graphiques - ${encodeURIComponent(selectedClient.company)}`}
                      className="p-2 rounded-xl text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                      title={`Envoyer un email à ${selectedClient.email}`}
                    >
                      <Mail className="w-4 h-4 text-[#f7c548]" />
                    </a>

                    <button
                      onClick={() => openEditModal(selectedClient)}
                      className="p-2 rounded-xl text-[#8E97AB] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                      title="Modifier les coordonnées du client"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleAttemptDelete(selectedClient)}
                      className="p-2 rounded-xl text-[#8E97AB] hover:text-[#D9695F] bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                      title="Supprimer ou archiver ce client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Primary Action Bar: Locked creation buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-[#f7c548]/30">
                  <div className="flex items-center gap-2 text-xs text-[#f7c548] font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Créer des éléments pré-verrouillés pour <strong>{selectedClient.company}</strong> :</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onOpenNewProjectForClient && onOpenNewProjectForClient(selectedClient.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#f7c548]/20"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Nouveau projet</span>
                    </button>

                    <button
                      onClick={() => setIsQuoteModalOpen(true)}
                      className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#f7c548]" />
                      <span>Nouveau devis</span>
                    </button>

                    <button
                      onClick={() => setIsInvoiceModalOpen(true)}
                      className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-[#5FB59A]" />
                      <span>Nouvelle facture</span>
                    </button>
                  </div>
                </div>

                {/* 3. Four Synthesis Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--text-secondary)] block">Total facturé</span>
                    <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums font-display mt-0.5 block">
                      {formatCurrency(totalInvoiced)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#5FB59A]/10 border border-[#5FB59A]/20">
                    <span className="text-[11px] text-[#5FB59A] block font-medium">Total encaissé</span>
                    <span className="text-lg font-bold text-[#5FB59A] tabular-nums font-display mt-0.5 block">
                      {formatCurrency(totalPaid)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/20">
                    <span className="text-[11px] text-[#f7c548] block font-medium">Reste dû</span>
                    <span className="text-lg font-bold text-[#f7c548] tabular-nums font-display mt-0.5 block">
                      {formatCurrency(totalBalanceDue)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--text-secondary)] block">Projets actifs</span>
                    <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums font-display mt-0.5 block">
                      {activeProjectsCount} <span className="text-xs font-normal text-[var(--text-secondary)]">/ {clientProjects.length} total</span>
                    </span>
                  </div>
                </div>

                {/* 4. Tab Navigation */}
                <div className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('projects')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      activeTab === 'projects'
                        ? 'bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30'
                        : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Projets ({clientProjects.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('quotes')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      activeTab === 'quotes'
                        ? 'bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30'
                        : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Devis ({clientQuotes.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('invoices')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      activeTab === 'invoices'
                        ? 'bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30'
                        : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Factures ({clientInvoices.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('files_notes')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      activeTab === 'files_notes'
                        ? 'bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30'
                        : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Fichiers & Notes</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                      activeTab === 'activity'
                        ? 'bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30'
                        : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Activité ({clientActivityLogs.length})</span>
                  </button>
                </div>

                {/* 5. Tab Content */}
                <div className="space-y-4 pt-1">
                  
                  {/* TAB 1: PROJETS */}
                  {activeTab === 'projects' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8E97AB]">
                          Dossiers rattachés à ce client (chaque projet dispose de son brief, prestations et maquettes)
                        </span>
                        <button
                          onClick={() => onOpenNewProjectForClient && onOpenNewProjectForClient(selectedClient.id)}
                          className="text-xs text-[#f7c548] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Nouveau projet pour ce client</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {clientProjects.map((p) => {
                          const stepDef = PROJECT_STEPS.find(s => s.key === p.currentStep);
                          return (
                            <div
                              key={p.id}
                              onClick={() => onSelectProject(p.id)}
                              className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group transition-all"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-white group-hover:text-[#f7c548] transition-colors truncate font-display">
                                    {p.title}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#8E97AB]">
                                    {PROJECT_TYPE_LABELS[p.type] || p.type}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8E97AB] mt-1 flex items-center gap-2 flex-wrap">
                                  <span>Budget calculé : <strong className="text-white font-medium">{formatCurrency(p.budget)}</strong></span>
                                  <span>·</span>
                                  <span>Échéance : {new Date(p.deadline).toLocaleDateString('fr-FR')}</span>
                                  {p.lines && p.lines.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>{p.lines.length} prestation(s)</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30">
                                  {stepDef ? stepDef.shortLabel : p.currentStep}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-[#8E97AB] group-hover:text-white transition-colors">
                                  <span>Ouvrir</span>
                                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {clientProjects.length === 0 && (
                          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                            <p className="text-xs text-[#8E97AB]">Aucun projet n'a encore été créé pour ce client.</p>
                            <button
                              onClick={() => onOpenNewProjectForClient && onOpenNewProjectForClient(selectedClient.id)}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#f7c548] text-[#0B0F1A] hover:bg-[#e5b336] cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Créer le premier projet de {selectedClient.company}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DEVIS */}
                  {activeTab === 'quotes' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8E97AB]">
                          Devis émis pour {selectedClient.company}
                        </span>
                        <button
                          onClick={() => setIsQuoteModalOpen(true)}
                          className="text-xs text-[#f7c548] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Créer un devis</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {clientQuotes.map(q => {
                          const linkedProj = projects.find(p => p.id === q.projectId);
                          return (
                            <div
                              key={q.id}
                              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white font-display">
                                    {q.quoteNumber}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    q.status === 'accepted' ? 'bg-[#5FB59A]/15 text-[#5FB59A] border border-[#5FB59A]/30' : 'bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30'
                                  }`}>
                                    {q.status === 'accepted' ? 'Accepté & Signé' : q.status === 'sent' ? 'Envoyé' : 'Brouillon'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8E97AB] mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Dossier : <strong className="text-white font-medium">{linkedProj?.title || 'Non assigné'}</strong></span>
                                  <span>·</span>
                                  <span>Émis le {new Date(q.createdAt).toLocaleDateString('fr-FR')}</span>
                                  <span>·</span>
                                  <span>Total TTC : <strong className="text-[#f7c548]">{formatCurrency(q.totalTTC)}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => setPreviewDoc({ doc: q, type: 'quote' })}
                                  className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#f7c548]" />
                                  <span>Aperçu A4 / PDF</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {clientQuotes.length === 0 && (
                          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                            <p className="text-xs text-[#8E97AB]">Aucun devis n'a encore été émis pour ce client.</p>
                            <button
                              onClick={() => setIsQuoteModalOpen(true)}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#f7c548] text-[#0B0F1A] hover:bg-[#e5b336] cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Émettre un devis pour ce client</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: FACTURES */}
                  {activeTab === 'invoices' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8E97AB]">
                          Factures émises pour {selectedClient.company}
                        </span>
                        <button
                          onClick={() => setIsInvoiceModalOpen(true)}
                          className="text-xs text-[#5FB59A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Émettre une facture</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {clientInvoices.map(inv => {
                          const linkedProj = projects.find(p => p.id === inv.projectId);
                          return (
                            <div
                              key={inv.id}
                              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white font-display">
                                    {inv.invoiceNumber}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    inv.status === 'paid' ? 'bg-[#5FB59A]/15 text-[#5FB59A]' : 'bg-[#f7c548]/15 text-[#f7c548]'
                                  }`}>
                                    {inv.status === 'paid' ? 'Payée' : inv.status === 'partially_paid' ? 'Partiellement payée' : 'En attente'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#8E97AB]">
                                    {inv.type === 'deposit' ? 'Acompte' : inv.type === 'balance' ? 'Solde' : 'Facture'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8E97AB] mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Dossier : <strong className="text-white font-medium">{linkedProj?.title || 'Non assigné'}</strong></span>
                                  <span>·</span>
                                  <span>TTC : <strong className="text-white">{formatCurrency(inv.totalTTC)}</strong></span>
                                  <span>·</span>
                                  <span>Encaissé : <strong className="text-[#5FB59A]">{formatCurrency(inv.paidAmount || 0)}</strong></span>
                                  {inv.balanceDue > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>Solde : <strong className="text-[#f7c548]">{formatCurrency(inv.balanceDue)}</strong></span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => setPreviewDoc({ doc: inv, type: 'invoice' })}
                                  className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#5FB59A]" />
                                  <span>Aperçu A4 / PDF</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {clientInvoices.length === 0 && (
                          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                            <p className="text-xs text-[#8E97AB]">Aucune facture n'a encore été émise pour ce client.</p>
                            <button
                              onClick={() => setIsInvoiceModalOpen(true)}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#5FB59A] text-[#0B0F1A] hover:bg-[#72C8AE] cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Créer une première facture</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FICHIERS & NOTES PRIVÉES */}
                  {activeTab === 'files_notes' && (
                    <div className="space-y-4">
                      {/* Private notes editable block */}
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5 text-[#f7c548]" />
                            <span>Notes privées & relation client (Confidentiel)</span>
                          </h4>
                          <span className="text-[10px] text-[#8E97AB]">
                            Non visible par le client
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          defaultValue={selectedClient.privateNotes || ''}
                          onBlur={(e) => handleUpdatePrivateNotes(e.target.value)}
                          placeholder="Consignez ici les préférences du client, historique relationnel, consignes de facturation, etc."
                          className="w-full px-3.5 py-2.5 glass-input text-xs leading-relaxed"
                        />
                        <p className="text-[10px] text-[#8E97AB] italic">
                          Les modifications sont enregistrées automatiquement dès que vous quittez la zone de texte.
                        </p>
                      </div>

                      {/* Contact & Legal details card */}
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                          Coordonnées & Références de facturation
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-[#f7c548] shrink-0" />
                            <span className="text-white truncate">{selectedClient.email}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[#f7c548] shrink-0" />
                            <span className="text-white truncate">{selectedClient.phone || 'Aucun téléphone renseigné'}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 sm:col-span-2">
                            <MapPin className="w-4 h-4 text-[#f7c548] shrink-0" />
                            <span className="text-white truncate">{selectedClient.address || 'Aucune adresse postale renseignée'}</span>
                          </div>
                          {selectedClient.website && (
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 sm:col-span-2">
                              <Globe className="w-4 h-4 text-[#f7c548] shrink-0" />
                              <a href={selectedClient.website} target="_blank" rel="noreferrer" className="text-[#f7c548] hover:underline truncate">
                                {selectedClient.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: ACTIVITÉ CHRONOLOGIQUE */}
                  {activeTab === 'activity' && (
                    <div className="space-y-3">
                      <span className="text-xs text-[#8E97AB]">
                        Journal chronologique complet des interactions, devis, règlements et jalons de ce client.
                      </span>

                      <div className="space-y-2 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-white/10">
                        {clientActivityLogs.map(log => (
                          <div key={log.id} className="relative flex items-start gap-3 pl-2 py-1">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#0B0F1A] border-2 border-[#f7c548] shrink-0 mt-1 relative z-10" />
                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex-1 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-white font-display">{log.title}</span>
                                <span className="text-[10px] text-[#8E97AB] tabular-nums shrink-0">
                                  {new Date(log.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#8E97AB] mt-0.5">
                                {log.subtitle}
                              </p>
                            </div>
                          </div>
                        ))}

                        {clientActivityLogs.length === 0 && (
                          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-[#8E97AB]">
                            Aucun événement historique pour ce client pour le moment.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="glass-panel p-12 text-center text-xs text-[#8E97AB]">
                Sélectionnez un client dans la liste pour afficher sa fiche complète.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Client */}
      {(isCreateModalOpen || editingClient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-modal w-full max-w-lg p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#f7c548]" />
                <h3 className="text-base font-bold text-white font-display">
                  {editingClient ? 'Modifier la fiche client' : 'Nouveau client'}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (editingClient) setEditingClient(null);
                  else onCloseCreateModal();
                }}
                className="p-1 rounded-lg text-[#8E97AB] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Nom du contact *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Sophie Martin"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Entreprise / Marque *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Ex: Maison Solène"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Email professionnel *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@maisonsolene.fr"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Numéro WhatsApp (optionnel)</label>
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Statut relationnel</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 glass-input text-xs rounded-xl cursor-pointer"
                  >
                    <option value="active">Client actif</option>
                    <option value="prospect">Prospect</option>
                    <option value="archived">Archivé</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Adresse postale / Facturation</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="12 rue de la Paix, 75002 Paris"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Site Web (optionnel)</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://maisonsolene.fr"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Notes privées</label>
                  <textarea
                    rows={2}
                    value={formData.privateNotes}
                    onChange={e => setFormData({ ...formData, privateNotes: e.target.value })}
                    placeholder="Consignes particulières, style préféré, etc."
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    if (editingClient) setEditingClient(null);
                    else onCloseCreateModal();
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold cursor-pointer transition-all"
                >
                  {editingClient ? 'Enregistrer les modifications' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Proposal to Archive Client when direct deletion is prevented */}
      {archiveProposal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-modal w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] mx-auto">
              <Archive className="w-6 h-6 stroke-[1.5]" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white font-display">
                Suppression impossible : Archivage recommandé
              </h3>
              <p className="text-xs text-[#8E97AB] leading-relaxed">
                Le client <strong className="text-white">{archiveProposal.client.company}</strong> est associé à :
              </p>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E97AB]">Projets rattachés :</span>
                  <strong>{archiveProposal.projectCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E97AB]">Devis émis :</span>
                  <strong>{archiveProposal.quoteCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E97AB]">Factures émises :</span>
                  <strong>{archiveProposal.invoiceCount}</strong>
                </div>
              </div>
              <p className="text-[11px] text-[#8E97AB]">
                Afin de préserver la traçabilité comptable et légale, ce client ne peut pas être supprimé. Nous vous recommandons de l'archiver pour masquer ses dossiers tout en conservant vos pièces officielles.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setArchiveProposal(null)}
                className="flex-1 py-2 px-3 rounded-xl text-xs text-[#8E97AB] hover:text-white bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Conserver actif
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archiver ce client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Quote for this client (Locked) */}
      {selectedClient && isQuoteModalOpen && (
        <CreateQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          defaultClientId={selectedClient.id}
          defaultProjectId={clientProjects[0]?.id}
          isClientLocked={true}
        />
      )}

      {/* Modal: New Invoice for this client (Locked) */}
      {selectedClient && isInvoiceModalOpen && (
        <CreateInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          defaultClientId={selectedClient.id}
          defaultProjectId={clientProjects[0]?.id}
          isClientLocked={true}
        />
      )}

      {/* Modal: A4 Preview / Print Document */}
      {previewDoc && (
        <DocumentA4Modal
          document={previewDoc.doc}
          type={previewDoc.type}
          client={selectedClient}
          profile={profile}
          onClose={() => setPreviewDoc(null)}
        />
      )}

    </div>
  );
};
