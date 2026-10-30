import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Sparkles, Check, Package, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Quote, QuoteLine, QuoteStatus } from '../../types';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { fromSmallestUnit, calculateDocumentTotals } from '../../utils/pricingEngine';
import { CustomSelect } from '../common/CustomSelect';

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultClientId?: string;
  isClientLocked?: boolean;
  initialLines?: QuoteLine[];
  initialDepositPercent?: number;
  initialDiscountPercent?: number;
  initialRevisionLimit?: number;
  initialTurnaroundTime?: string;
  initialTerms?: string;
  quoteToEdit?: Quote | null;
}

export const CreateQuoteModal: React.FC<CreateQuoteModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  defaultClientId,
  isClientLocked = false,
  initialLines,
  initialDepositPercent,
  initialDiscountPercent,
  initialRevisionLimit,
  initialTurnaroundTime,
  initialTerms,
  quoteToEdit
}) => {
  const { 
    clients, 
    projects, 
    profile, 
    addProject,
    addQuote, 
    updateQuote, 
    acceptQuote, 
    createQuoteVersion,
    catalogServices, 
    catalogPacks, 
    entitlements,
    openUpgradeModal,
    currentWorkspace
  } = useApp();

  const isEditing = Boolean(quoteToEdit);
  const isLocked = Boolean(quoteToEdit?.isLocked || quoteToEdit?.status === 'accepted');

  const [selectedClientId, setSelectedClientId] = useState<string>(
    quoteToEdit?.clientId || defaultClientId || (clients[0]?.id || '')
  );

  const targetClient = clients.find(c => c.id === selectedClientId);

  // Available projects for the selected client
  const clientProjects = projects.filter(p => !selectedClientId || p.clientId === selectedClientId);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    quoteToEdit?.projectId || defaultProjectId || (clientProjects[0]?.id || '')
  );

  const targetProject = projects.find(p => p.id === selectedProjectId);

  const [isQuickProjectOpen, setIsQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState('');

  const handleCreateQuickProject = () => {
    if (!selectedClientId) return;
    const client = clients.find(c => c.id === selectedClientId);
    const title = quickProjectTitle.trim() || `Projet ${client ? client.company : 'Nouveau'}`;
    const newProj = addProject({
      workspaceId: currentWorkspace.id,
      clientId: selectedClientId,
      title,
      brief: {
        objectives: 'Cadrage du projet',
        targetAudience: '',
        desiredStyle: '',
        colors: [],
        typographyAndReferences: '',
        expectedFormats: [],
        clientProvidedAssets: ''
      },
      type: 'identite_visuelle',
      budget: 1500,
      depositAmount: 750,
      deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      currentStep: 'demande_recue',
      revisionLimit: 3
    });
    setSelectedProjectId(newProj.id);
    setIsQuickProjectOpen(false);
    setQuickProjectTitle('');
  };

  const [validityDays, setValidityDays] = useState(quoteToEdit?.validityDays || 30);
  const [depositPercent, setDepositPercent] = useState<number>(
    quoteToEdit?.depositPercent !== undefined
      ? quoteToEdit.depositPercent
      : initialDepositPercent !== undefined 
      ? initialDepositPercent 
      : (targetProject?.depositPercent ?? 50)
  );
  const [discountPercent, setDiscountPercent] = useState<number>(
    quoteToEdit?.discountPercent !== undefined
      ? quoteToEdit.discountPercent
      : initialDiscountPercent !== undefined 
      ? initialDiscountPercent 
      : (targetProject?.discountPercent ?? 0)
  );
  const [revisionLimit, setRevisionLimit] = useState<number>(
    quoteToEdit?.revisionLimit !== undefined
      ? quoteToEdit.revisionLimit
      : initialRevisionLimit !== undefined 
      ? initialRevisionLimit 
      : (targetProject?.revisionLimit ?? 3)
  );
  const [turnaroundTime, setTurnaroundTime] = useState<string>(
    quoteToEdit?.turnaroundTime || initialTurnaroundTime || '3 à 4 semaines'
  );
  const [terms, setTerms] = useState<string>(
    quoteToEdit?.termsAndConditions ||
    initialTerms ||
    profile.defaultConditionsQuote ||
    'Règlement : 50 % d’acompte à la commande, solde à la livraison finale. Cession des droits d’auteur consentie pour le monde entier et pour une durée de 10 ans.'
  );

  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>(
    quoteToEdit?.status || 'draft'
  );

  // Initial lines calculation
  const getInitialLines = (): QuoteLine[] => {
    if (quoteToEdit && quoteToEdit.lines && quoteToEdit.lines.length > 0) {
      return quoteToEdit.lines;
    }
    if (initialLines && initialLines.length > 0) {
      return initialLines;
    }
    if (targetProject && targetProject.lines && targetProject.lines.length > 0) {
      return targetProject.lines.map((l, idx) => ({
        id: `ql_proj_${idx}_${Date.now()}`,
        sourceCatalogServiceId: l.sourceCatalogServiceId,
        designation: l.name,
        description: l.description || '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        total: l.unitPrice * l.quantity
      }));
    }
    return [
      {
        id: 'ql_new_1',
        designation: 'Conception graphique et direction artistique',
        description: 'Recherches créatives, moodboards et propositions initiales',
        quantity: 1,
        unitPrice: 1500,
        vatRate: profile.vatRate ?? 20,
        total: 1500
      }
    ];
  };

  const [lines, setLines] = useState<QuoteLine[]>(getInitialLines);

  // Synchronize lines when default project changes or on mount
  useEffect(() => {
    if (isOpen) {
      if (quoteToEdit) {
        setSelectedClientId(quoteToEdit.clientId);
        setSelectedProjectId(quoteToEdit.projectId);
        setLines(quoteToEdit.lines || []);
        setDepositPercent(quoteToEdit.depositPercent ?? 50);
        setDiscountPercent(quoteToEdit.discountPercent ?? 0);
        setRevisionLimit(quoteToEdit.revisionLimit ?? 3);
        setTurnaroundTime(quoteToEdit.turnaroundTime || '3 à 4 semaines');
        setTerms(quoteToEdit.termsAndConditions || profile.defaultConditionsQuote || '');
        setValidityDays(quoteToEdit.validityDays || 30);
        setQuoteStatus(quoteToEdit.status || 'draft');
      } else if (initialLines && initialLines.length > 0) {
        setLines(initialLines);
      } else if (targetProject && targetProject.lines && targetProject.lines.length > 0) {
        setLines(
          targetProject.lines.map((l, idx) => ({
            id: `ql_proj_${idx}_${Date.now()}`,
            sourceCatalogServiceId: l.sourceCatalogServiceId,
            designation: l.name,
            description: l.description || '',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            total: l.unitPrice * l.quantity
          }))
        );
        if (targetProject.depositPercent !== undefined) setDepositPercent(targetProject.depositPercent);
        if (targetProject.discountPercent !== undefined) setDiscountPercent(targetProject.discountPercent);
        if (targetProject.revisionLimit !== undefined) setRevisionLimit(targetProject.revisionLimit);
      }
    }
  }, [isOpen, selectedProjectId, quoteToEdit?.id]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `ql_new_${Date.now()}`,
        designation: '',
        description: '',
        quantity: 1,
        unitPrice: 400,
        vatRate: profile.vatRate ?? 20,
        total: 400
      }
    ]);
  };

  const handleInsertFromCatalog = (typeAndId: string) => {
    if (!typeAndId) return;
    const [type, id] = typeAndId.split(':');
    if (type === 'srv') {
      const srv = catalogServices.find(s => s.id === id);
      if (srv) {
        const unitPrice = fromSmallestUnit(srv.unitPriceCents, profile.currency || 'EUR');
        const vatRate = srv.taxRate !== null && srv.taxRate !== undefined ? srv.taxRate : (profile.vatRate ?? 20);
        setLines(prev => [
          ...prev,
          {
            id: `ql_cat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            sourceCatalogServiceId: srv.id,
            designation: srv.name,
            description: srv.deliverableDescription || '',
            quantity: 1,
            unitPrice,
            vatRate,
            total: unitPrice
          }
        ]);
        if (srv.turnaroundDays) {
          setTurnaroundTime(`${srv.turnaroundDays} jours ouvrés`);
        }
        if (srv.revisionLimit) {
          setRevisionLimit(srv.revisionLimit);
        }
      }
    } else if (type === 'pack') {
      const pack = catalogPacks.find(p => p.id === id);
      if (pack) {
        const unitPrice = fromSmallestUnit(pack.packPriceCents, profile.currency || 'EUR');
        const vatRate = pack.taxRate !== null && pack.taxRate !== undefined ? pack.taxRate : (profile.vatRate ?? 20);
        setLines(prev => [
          ...prev,
          {
            id: `ql_pack_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            designation: pack.name,
            description: pack.deliverableDescription || pack.description || '',
            quantity: 1,
            unitPrice,
            vatRate,
            total: unitPrice
          }
        ]);
        if (pack.turnaroundDays) {
          setTurnaroundTime(`${pack.turnaroundDays} jours ouvrés`);
        }
        if (pack.revisionLimit) {
          setRevisionLimit(pack.revisionLimit);
        }
      }
    }
  };

  const handleUpdateLine = (id: string, updates: Partial<QuoteLine>) => {
    setLines(prev =>
      prev.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  // Module financier testé et unifié
  const totals = calculateDocumentTotals(lines, {
    discountPercent,
    defaultVatRate: profile.vatRate ?? 20,
    depositPercent,
    depositCalculation: profile.depositCalculation,
    currency: profile.currency || 'EUR'
  });

  const handleCreateNewVersion = () => {
    if (!quoteToEdit) return;
    const newVersion = createQuoteVersion(quoteToEdit.id);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent, targetStatus?: QuoteStatus) => {
    e.preventDefault();
    if (!selectedClientId || !selectedProjectId) return;

    const finalStatus = targetStatus || quoteStatus;

    if (isEditing && quoteToEdit) {
      if (isLocked) {
        return;
      }

      if (finalStatus === 'accepted') {
        // Validation / acceptation du devis
        const clientName = targetClient?.name || targetClient?.company || 'Client';
        acceptQuote(quoteToEdit.id, clientName);
      } else {
        updateQuote(quoteToEdit.id, {
          lines,
          validityDays,
          discountPercent,
          depositPercent,
          revisionLimit,
          turnaroundTime,
          termsAndConditions: terms,
          status: finalStatus
        });
      }
      onClose();
      return;
    }

    // Création d'un nouveau devis
    if (!entitlements.canCreateQuote) {
      openUpgradeModal(entitlements.reasonBlocked || 'Limite mensuelle de devis atteinte.');
      return;
    }

    addQuote({
      clientId: selectedClientId,
      projectId: selectedProjectId,
      validityDays,
      dueDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
      lines,
      subtotal: totals.subtotalHT,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      netHT: totals.netHT,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      totalTTC: totals.totalTTC,
      depositPercent: totals.depositPercent,
      depositAmount: totals.depositAmount,
      revisionLimit,
      turnaroundTime,
      termsAndConditions: terms,
      status: finalStatus || 'draft'
    });

    onClose();
  };

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile.currency || 'EUR', 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl my-auto glass-panel p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f7c548]/15 flex items-center justify-center text-[#f7c548]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  {isEditing ? `Modifier le devis ${quoteToEdit?.quoteNumber}` : 'Créer un devis'} {targetProject ? `· ${targetProject.title}` : ''}
                </h2>
                {isEditing && quoteToEdit?.version && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">
                    V{quoteToEdit.version}
                  </span>
                )}
                {isLocked && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#5FB59A]/20 text-[#5FB59A] border border-[#5FB59A]/30">
                    Verrouillé 🔒
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E97AB]">
                {isEditing
                  ? 'Édition des prestations, TVA, remises et statuts du devis.'
                  : 'Numérotation continue légale (DEV-AAAA-NNN). Statut initial : Brouillon.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locked Quote Warning & Versioning Action */}
        {isLocked && (
          <div className="p-4 rounded-2xl bg-[#5FB59A]/10 border border-[#5FB59A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#5FB59A] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">
                  Ce devis est accepté et verrouillé 🔒
                </p>
                <p className="text-[11px] text-[#8E97AB]">
                  Pour apporter des modifications à ce dossier sans altérer le devis d'origine, créez une nouvelle version.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateNewVersion}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shrink-0 shadow-md shadow-[#f7c548]/20"
            >
              Créer la version V{(quoteToEdit?.version || 1) + 1}
            </button>
          </div>
        )}

        {/* Plan Limit Warning */}
        {entitlements && !entitlements.canCreateQuote && (
          <div className="p-3.5 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 text-xs text-white flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#D9695F] shrink-0" />
            <span>{entitlements.reasonBlocked || "Limite mensuelle de devis atteinte sur votre formule actuelle."}</span>
          </div>
        )}

        <form onSubmit={e => handleSubmit(e, 'draft')} className="space-y-6">
          {/* Client & Project Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isClientLocked && targetClient ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8E97AB]">
                  Client destinataire
                </label>
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-[#f7c548]/40 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{targetClient.company}</span>
                    <span className="text-[11px] text-[#8E97AB] block truncate">{targetClient.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30 shrink-0">
                    🔒 Verrouillé
                  </span>
                </div>
              </div>
            ) : (
              <CustomSelect
                label="Client destinataire"
                required
                value={selectedClientId}
                onChange={val => {
                  setSelectedClientId(val);
                  const matchingProj = projects.find(p => p.clientId === val);
                  if (matchingProj) setSelectedProjectId(matchingProj.id);
                }}
                options={clients.map(c => ({
                  value: c.id,
                  label: c.company,
                  subLabel: c.name
                }))}
                placeholder="Sélectionner un client..."
                sheetTitle="Choisir le client du devis"
              />
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#8E97AB]">
                  Projet rattaché <span className="text-[#f7c548]">*</span>
                </label>
                {selectedClientId && (
                  <button
                    type="button"
                    onClick={() => setIsQuickProjectOpen(prev => !prev)}
                    className="text-[11px] text-[#f7c548] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isQuickProjectOpen ? 'Annuler' : 'Nouveau projet'}</span>
                  </button>
                )}
              </div>

              {isQuickProjectOpen ? (
                <div className="p-3 rounded-xl bg-white/[0.04] border border-[#f7c548]/30 space-y-2">
                  <span className="text-[11px] text-white font-medium block">
                    Créer un nouveau projet pour {targetClient?.company || 'ce client'} :
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={quickProjectTitle}
                      onChange={e => setQuickProjectTitle(e.target.value)}
                      placeholder={`Ex: Refonte Identité ${targetClient?.company || ''}`}
                      className="flex-1 px-3 py-1.5 text-xs glass-input rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCreateQuickProject}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer shrink-0"
                    >
                      Créer & lier
                    </button>
                  </div>
                </div>
              ) : clientProjects.length === 0 ? (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-dashed border-[#f7c548]/30 space-y-2">
                  <p className="text-[11px] text-[#8E97AB]">
                    Aucun projet existant pour ce client. Créez un projet pour rattacher le devis :
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsQuickProjectOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer un projet pour {targetClient?.company || 'ce client'}</span>
                  </button>
                </div>
              ) : (
                <CustomSelect
                  label=""
                  required
                  value={selectedProjectId}
                  onChange={val => setSelectedProjectId(val)}
                  options={clientProjects.map(p => ({
                    value: p.id,
                    label: p.title
                  }))}
                  placeholder="Sélectionner un projet..."
                  sheetTitle="Choisir le projet rattaché"
                />
              )}
            </div>
          </div>

          {/* Line items section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E97AB]">
                Lignes de prestations ({lines.length})
              </span>
              <div className="flex items-center gap-3">
                {(catalogServices.length > 0 || catalogPacks.length > 0) && (
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        handleInsertFromCatalog(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-2.5 py-1 text-xs glass-input rounded-lg text-[#f7c548] font-semibold cursor-pointer"
                  >
                    <option value="" disabled>+ Insérer du catalogue...</option>
                    {catalogServices.filter(s => s.status === 'active').length > 0 && (
                      <optgroup label="Prestations au catalogue">
                        {catalogServices.filter(s => s.status === 'active').map(srv => (
                          <option key={srv.id} value={`srv:${srv.id}`}>
                            {srv.name} ({fromSmallestUnit(srv.unitPriceCents, profile.currency || 'EUR')} {profile.currency || 'EUR'})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {catalogPacks.filter(p => p.status === 'active').length > 0 && (
                      <optgroup label="Packs de prestations">
                        {catalogPacks.filter(p => p.status === 'active').map(pack => (
                          <option key={pack.id} value={`pack:${pack.id}`}>
                            [PACK] {pack.name} ({fromSmallestUnit(pack.packPriceCents, profile.currency || 'EUR')} {profile.currency || 'EUR'})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-xs text-[#f7c548] hover:text-[#e5b336] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une ligne</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          required
                          value={line.designation}
                          onChange={e => handleUpdateLine(line.id, { designation: e.target.value })}
                          placeholder="Désignation (ex: Logotype & Charte graphique)"
                          className="w-full px-3 py-1.5 text-xs glass-input font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={e => handleUpdateLine(line.id, { quantity: parseInt(e.target.value) || 1 })}
                            placeholder="Qté"
                            className="w-full px-2 py-1.5 text-xs glass-input text-center tabular-nums"
                            title="Quantité"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={line.unitPrice}
                            onChange={e => handleUpdateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            placeholder="Prix HT"
                            className="w-full px-2 py-1.5 text-xs glass-input text-right tabular-nums font-semibold"
                            title="Prix unitaire HT"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#8E97AB]">TVA:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={line.vatRate !== undefined ? line.vatRate : (profile.vatRate ?? 20)}
                          onChange={e => handleUpdateLine(line.id, { vatRate: parseFloat(e.target.value) || 0 })}
                          className="w-14 px-1.5 py-1 text-xs glass-input text-center tabular-nums"
                          title="Taux de TVA en %"
                        />
                        <span className="text-[10px] text-[#8E97AB]">%</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={lines.length <= 1}
                      onClick={() => handleRemoveLine(line.id)}
                      className="p-1.5 text-[#8E97AB] hover:text-[#D9695F] disabled:opacity-30 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={line.description || ''}
                    onChange={e => handleUpdateLine(line.id, { description: e.target.value })}
                    placeholder="Description détaillée ou livrables inclus (copié dans le devis, indépendant du catalogue)"
                    className="w-full px-3 py-1 text-[11px] glass-input text-[#8E97AB]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Parameters & Revisions */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <CustomSelect
              label="Acompte demandé (%)"
              value={String(depositPercent)}
              onChange={val => setDepositPercent(parseInt(val))}
              options={[
                { value: '30', label: '30 % (Standard)' },
                { value: '40', label: '40 %' },
                { value: '50', label: '50 % (Recommandé)' },
                { value: '100', label: '100 % (Paiement total)' }
              ]}
              sheetTitle="Acompte demandé"
            />

            <div>
              <label className="block text-[#8E97AB] mb-1">Remise commerciale (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-full px-3 py-2 text-xs glass-input text-center font-bold"
                placeholder="0"
              />
            </div>

            <CustomSelect
              label="Validité du devis"
              value={String(validityDays)}
              onChange={val => setValidityDays(parseInt(val))}
              options={[
                { value: '15', label: '15 jours' },
                { value: '30', label: '30 jours' },
                { value: '60', label: '60 jours' }
              ]}
              sheetTitle="Validité du devis"
            />

            <div>
              <label className="block text-[#8E97AB] mb-1">Révisions incluses</label>
              <input
                type="number"
                min="1"
                max="10"
                value={revisionLimit}
                onChange={e => setRevisionLimit(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 text-xs glass-input text-center font-bold"
              />
            </div>

            <div>
              <label className="block text-[#8E97AB] mb-1">Délai estimé</label>
              <input
                type="text"
                value={turnaroundTime}
                onChange={e => setTurnaroundTime(e.target.value)}
                placeholder="ex: 3 semaines"
                className="w-full px-3 py-2 text-xs glass-input font-medium"
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-4 rounded-xl bg-white/[0.04] border border-[#f7c548]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-[#8E97AB] space-y-1">
              <div>Sous-total brut HT : <strong className="text-white tabular-nums">{formatCurrency(totals.subtotalHT)}</strong></div>
              {totals.discountPercent > 0 && (
                <div className="text-[#f7c548]">
                  Remise ({totals.discountPercent}%) : <strong className="tabular-nums">- {formatCurrency(totals.discountAmount)}</strong> (Net HT: {formatCurrency(totals.netHT)})
                </div>
              )}
              <div>TVA calculée : <strong className="text-white tabular-nums">+{formatCurrency(totals.vatAmount)}</strong></div>
              <div>Acompte à la commande : <strong className="text-[#f7c548] tabular-nums">{formatCurrency(totals.depositAmount)}</strong></div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-[#8E97AB] block">Montant Total TTC</span>
              <span className="text-2xl font-bold text-[#f7c548] font-display tabular-nums">
                {formatCurrency(totals.totalTTC)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E97AB] hover:text-white transition-colors cursor-pointer"
            >
              Fermer
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {isEditing ? (
                isLocked ? (
                  <button
                    type="button"
                    onClick={handleCreateNewVersion}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Créer la version V{(quoteToEdit?.version || 1) + 1}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={e => handleSubmit(e, 'draft')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer border border-white/10"
                    >
                      Enregistrer (Brouillon)
                    </button>

                    <button
                      type="button"
                      onClick={e => handleSubmit(e, 'sent')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] hover:bg-[#f7c548]/30 transition-all cursor-pointer border border-[#f7c548]/40"
                    >
                      Marquer Envoyé
                    </button>

                    <button
                      type="button"
                      onClick={e => handleSubmit(e, 'accepted')}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#5FB59A]/20"
                      title="Valider et sceller le devis (déclenche l'étape Devis accepté et la facture d'acompte)"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Valider & Accepter le devis</span>
                    </button>
                  </>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={e => handleSubmit(e, 'draft')}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer border border-white/10"
                    title="Enregistrer comme brouillon dans Facturation & Devis"
                  >
                    Enregistrer Brouillon
                  </button>

                  <button
                    type="button"
                    onClick={e => handleSubmit(e, 'sent')}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Créer et émettre (Envoyé)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
