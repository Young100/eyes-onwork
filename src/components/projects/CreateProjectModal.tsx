import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  Palette, 
  FileText, 
  Check, 
  AlertCircle, 
  Percent, 
  Layers, 
  Search, 
  UserPlus, 
  Package, 
  Lock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  PROJECT_TYPE_LABELS, 
  ProjectStepKey, 
  ProjectType, 
  ProjectServiceLine, 
  CatalogUnit, 
  CATALOG_UNIT_LABELS,
  CatalogService,
  CatalogPack
} from '../../types';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { fromSmallestUnit, toSmallestUnit, STANDARD_CATALOG_CATEGORIES } from '../../utils/pricingEngine';
import { CustomSelect } from '../common/CustomSelect';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (id: string) => void;
  preselectedClientId?: string | null;
  isClientLocked?: boolean;
}

const COLOR_SUGGESTIONS = [
  { hex: '#111827', name: 'Noir Profond' },
  { hex: '#FFFFFF', name: 'Blanc Pur' },
  { hex: '#1E293B', name: 'Bleu Nuit' },
  { hex: '#D97706', name: 'Or Cuivré' },
  { hex: '#059669', name: 'Vert Émeraude' },
  { hex: '#C2410C', name: 'Terracotta' }
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  preselectedClientId,
  isClientLocked = false
}) => {
  const { 
    currentWorkspace,
    clients, 
    addClient, 
    addProject, 
    addTask, 
    profile, 
    projectTemplates,
    catalogServices,
    catalogPacks,
    addCatalogService,
    entitlements,
    openUpgradeModal
  } = useApp();

  const currency = profile.currency || 'EUR';

  // Client selection state
  const [clientId, setClientId] = useState<string>(preselectedClientId || clients[0]?.id || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isCreatingClientInline, setIsCreatingClientInline] = useState(false);
  const [inlineClientData, setInlineClientData] = useState({
    name: '',
    company: '',
    email: '',
    phone: ''
  });

  // Sync clientId if preselectedClientId changes
  useEffect(() => {
    if (preselectedClientId) {
      setClientId(preselectedClientId);
    } else if (!clientId && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [preselectedClientId, clients]);

  // Basic info state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProjectType>('identite_visuelle');

  // Lines & Pricing state (Prestations)
  const [lines, setLines] = useState<ProjectServiceLine[]>([
    {
      id: `line_init_1`,
      name: 'Conception graphique & Direction artistique',
      description: 'Recherches visuelles, moodboard et déclinaisons créatives',
      unit: 'forfait',
      unitPrice: 1500,
      quantity: 1,
      vatRate: profile.vatRate ?? 20,
      totalHT: 1500,
      totalTTC: Math.round(1500 * (1 + (profile.vatRate ?? 20) / 100)),
      turnaroundDays: 21,
      revisionLimit: 3
    }
  ]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [depositPercentVal, setDepositPercentVal] = useState<number>(50);

  // Modals for adding prestations
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [selectedCatalogQuantities, setSelectedCatalogQuantities] = useState<Record<string, number>>({});

  const [isPackPickerOpen, setIsPackPickerOpen] = useState(false);
  const [isCustomLineModalOpen, setIsCustomLineModalOpen] = useState(false);
  const [customLineForm, setCustomLineForm] = useState({
    name: '',
    description: '',
    unit: 'forfait' as CatalogUnit,
    unitPrice: 500,
    quantity: 1,
    vatRate: profile.vatRate ?? 20,
    turnaroundDays: 14,
    revisionLimit: 3,
    addToCatalog: false
  });

  // Financial calculations from lines
  const subtotalHT = lines.reduce((acc, l) => acc + (l.unitPrice * l.quantity), 0);
  const discountAmount = Math.round(subtotalHT * ((discountPercent || 0) / 100));
  const netHT = Math.max(0, subtotalHT - discountAmount);
  const vatAmount = Math.round(lines.reduce((acc, l) => acc + ((l.unitPrice * l.quantity) * (l.vatRate / 100)), 0) * (1 - ((discountPercent || 0) / 100)));
  const totalTTC = netHT + vatAmount;
  const depositAmountVal = Math.round(totalTTC * (depositPercentVal / 100));

  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  const [revisionLimit, setRevisionLimit] = useState(3);
  const [currentStep, setCurrentStep] = useState<ProjectStepKey>('demande_recue');

  // Creative brief state
  const [objectives, setObjectives] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [desiredStyle, setDesiredStyle] = useState('');
  const [typographyAndReferences, setTypographyAndReferences] = useState('');
  const [clientProvidedAssets, setClientProvidedAssets] = useState('');
  
  // Colors state
  const [colors, setColors] = useState<{ hex: string; name: string }[]>([]);
  const [newColorHex, setNewColorHex] = useState('#2563EB');
  const [newColorName, setNewColorName] = useState('Bleu Roi');

  // Expected formats
  const [expectedFormats, setExpectedFormats] = useState<string[]>([
    'Fichiers vectoriels (.AI, .EPS, .SVG)',
    'Fichiers d\'impression CMJN 300 DPI',
    'Exports web RGB (.PNG, .WEBP)'
  ]);

  if (!isOpen) return null;

  // Selected client object
  const selectedClient = clients.find(c => c.id === clientId);

  // Filter clients for dropdown search
  const filteredClients = clients.filter(c => 
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Template prefill handler
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;
    const tmpl = projectTemplates.find(t => t.id === tmplId);
    if (!tmpl) return;

    if (!title.trim()) {
      setTitle(tmpl.name || tmpl.title || '');
    }
    setType(tmpl.projectType);
    if (tmpl.briefQuestions && tmpl.briefQuestions.length > 0) {
      setObjectives(tmpl.briefQuestions.map(q => `• ${q}`).join('\n'));
    }
    if (tmpl.requiredClientAssets && tmpl.requiredClientAssets.length > 0) {
      setClientProvidedAssets(tmpl.requiredClientAssets.join(', '));
    }

    // Prefill prestations from template if available
    if (tmpl.defaultServiceIds && tmpl.defaultServiceIds.length > 0) {
      const templateLines: ProjectServiceLine[] = [];
      tmpl.defaultServiceIds.forEach(svcId => {
        const foundSvc = catalogServices.find(s => s.id === svcId);
        if (foundSvc) {
          const price = fromSmallestUnit(foundSvc.unitPriceCents, currency);
          const rate = foundSvc.taxRate ?? (profile.vatRate ?? 20);
          templateLines.push({
            id: `line_tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sourceCatalogServiceId: foundSvc.id,
            name: foundSvc.name,
            description: foundSvc.deliverableDescription || '',
            unit: foundSvc.unit,
            unitPrice: price,
            quantity: 1,
            vatRate: rate,
            totalHT: price,
            totalTTC: Math.round(price * (1 + rate / 100)),
            turnaroundDays: foundSvc.turnaroundDays,
            revisionLimit: foundSvc.revisionLimit
          });
        }
      });
      if (templateLines.length > 0) {
        setLines(templateLines);
        const maxTurnaround = Math.max(...templateLines.map(l => l.turnaroundDays || 14));
        const d = new Date();
        d.setDate(d.getDate() + maxTurnaround);
        setDeadline(d.toISOString().split('T')[0]);
        setRevisionLimit(Math.max(...templateLines.map(l => l.revisionLimit || 3)));
      }
    }
  };

  // Inline client creation handler
  const handleCreateInlineClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineClientData.company.trim() || !inlineClientData.name.trim() || !inlineClientData.email.trim()) {
      return;
    }

    if (!entitlements.canCreateClient) {
      openUpgradeModal();
      return;
    }

    const created = addClient({
      workspaceId: currentWorkspace.id,
      name: inlineClientData.name.trim(),
      company: inlineClientData.company.trim(),
      email: inlineClientData.email.trim(),
      phone: inlineClientData.phone.trim(),
      address: '',
      status: 'active'
    });

    setClientId(created.id);
    setIsCreatingClientInline(false);
    setInlineClientData({ name: '', company: '', email: '', phone: '' });
  };

  // Prestations management helpers
  const handleUpdateLine = (id: string, updates: Partial<ProjectServiceLine>) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...updates };
      updated.totalHT = updated.unitPrice * updated.quantity;
      updated.totalTTC = Math.round(updated.totalHT * (1 + updated.vatRate / 100));
      return updated;
    }));
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  // Add from catalog handler
  const handleConfirmCatalogSelection = () => {
    const newLines: ProjectServiceLine[] = [];
    Object.entries(selectedCatalogQuantities).forEach(([svcId, qty]) => {
      if (qty <= 0) return;
      const svc = catalogServices.find(s => s.id === svcId);
      if (!svc) return;

      const price = fromSmallestUnit(svc.unitPriceCents, currency);
      const rate = svc.taxRate ?? (profile.vatRate ?? 20);
      newLines.push({
        id: `line_cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceCatalogServiceId: svc.id,
        name: svc.name,
        description: svc.deliverableDescription || '',
        unit: svc.unit,
        unitPrice: price,
        quantity: qty,
        vatRate: rate,
        totalHT: price * qty,
        totalTTC: Math.round(price * qty * (1 + rate / 100)),
        turnaroundDays: svc.turnaroundDays,
        revisionLimit: svc.revisionLimit
      });
    });

    if (newLines.length > 0) {
      setLines(prev => [...prev, ...newLines]);
      setSelectedCatalogQuantities({});
      setIsCatalogPickerOpen(false);
    }
  };

  // Add pack handler
  const handleAddPack = (pack: CatalogPack) => {
    const packLines: ProjectServiceLine[] = [];
    if (pack.items && pack.items.length > 0) {
      pack.items.forEach(item => {
        const foundSvc = catalogServices.find(s => s.id === item.serviceId);
        const itemAny = item as any;
        const price = fromSmallestUnit(itemAny.unitPriceCents || foundSvc?.unitPriceCents || 0, currency);
        const rate = foundSvc?.taxRate ?? (profile.vatRate ?? 20);
        packLines.push({
          id: `line_pack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceCatalogServiceId: item.serviceId,
          name: itemAny.serviceName || foundSvc?.name || 'Prestation du pack',
          description: foundSvc?.deliverableDescription || '',
          unit: foundSvc?.unit || 'forfait',
          unitPrice: price,
          quantity: item.quantity || 1,
          vatRate: rate,
          totalHT: price * (item.quantity || 1),
          totalTTC: Math.round(price * (item.quantity || 1) * (1 + rate / 100)),
          turnaroundDays: foundSvc?.turnaroundDays || pack.turnaroundDays,
          revisionLimit: foundSvc?.revisionLimit || pack.revisionLimit
        });
      });
    }

    if (packLines.length > 0) {
      setLines(prev => [...prev, ...packLines]);
      setIsPackPickerOpen(false);
    }
  };

  // Add custom free line handler
  const handleAddCustomLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLineForm.name.trim()) return;

    const price = Number(customLineForm.unitPrice) || 0;
    const qty = Number(customLineForm.quantity) || 1;
    const rate = Number(customLineForm.vatRate) ?? 20;

    const newLine: ProjectServiceLine = {
      id: `line_free_${Date.now()}`,
      name: customLineForm.name.trim(),
      description: customLineForm.description.trim(),
      unit: customLineForm.unit,
      unitPrice: price,
      quantity: qty,
      vatRate: rate,
      totalHT: price * qty,
      totalTTC: Math.round(price * qty * (1 + rate / 100)),
      turnaroundDays: customLineForm.turnaroundDays,
      revisionLimit: customLineForm.revisionLimit
    };

    // If checked "Ajouter au catalogue", save to workspace catalog services
    if (customLineForm.addToCatalog) {
      addCatalogService({
        name: customLineForm.name.trim(),
        category: type,
        deliverableDescription: customLineForm.description.trim(),
        unit: customLineForm.unit,
        unitPriceCents: toSmallestUnit(price, currency),
        taxRate: rate,
        turnaroundDays: customLineForm.turnaroundDays,
        revisionLimit: customLineForm.revisionLimit,
        status: 'active'
      });
    }

    setLines(prev => [...prev, newLine]);
    setIsCustomLineModalOpen(false);
    setCustomLineForm({
      name: '',
      description: '',
      unit: 'forfait',
      unitPrice: 500,
      quantity: 1,
      vatRate: profile.vatRate ?? 20,
      turnaroundDays: 14,
      revisionLimit: 3,
      addToCatalog: false
    });
  };

  const handleAddSuggestion = (sug: { hex: string; name: string }) => {
    if (colors.some(c => c.hex.toLowerCase() === sug.hex.toLowerCase())) return;
    setColors([...colors, sug]);
  };

  const handleAddCustomColor = () => {
    if (!newColorHex || !newColorName.trim()) return;
    setColors([...colors, { hex: newColorHex, name: newColorName.trim() }]);
    setNewColorName('');
  };

  const handleRemoveColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) return;

    if (!entitlements.canCreateProject) {
      openUpgradeModal();
      return;
    }

    const newProject = addProject({
      workspaceId: currentWorkspace.id,
      title: title.trim(),
      clientId,
      type,
      lines,
      budget: totalTTC,
      subtotalHT,
      vatAmount,
      totalTTC,
      discountPercent,
      depositPercent: depositPercentVal,
      depositAmount: depositAmountVal,
      deadline,
      currentStep,
      revisionLimit: Number(revisionLimit) || 3,
      brief: {
        objectives: objectives.trim() || 'Conception sur-mesure selon cahier des charges client.',
        targetAudience: targetAudience.trim() || 'Clientèle cible de la marque.',
        desiredStyle: desiredStyle.trim() || 'Épuré, contemporain, haute lisibilité.',
        colors,
        typographyAndReferences: typographyAndReferences.trim() || 'Typographies professionnelles avec hiérarchie soignée.',
        expectedFormats,
        clientProvidedAssets: clientProvidedAssets.trim() || 'Éléments textuels et visuels transmis.'
      }
    });

    // If template applied, inject template tasks
    if (selectedTemplateId) {
      const tmpl = projectTemplates.find(t => t.id === selectedTemplateId);
      if (tmpl && tmpl.defaultTasks && tmpl.defaultTasks.length > 0) {
        tmpl.defaultTasks.forEach(task => {
          addTask(
            newProject.id,
            task.title,
            new Date(Date.now() + ((task as any).daysOffset || task.defaultDaysOffset || 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          );
        });
      }
    }

    if (onProjectCreated) {
      onProjectCreated(newProject.id);
    }
    onClose();
  };

  // Filtered catalog services
  const filteredCatalog = catalogServices.filter(s => {
    const matchesCat = catalogCategory === 'all' || s.category === catalogCategory;
    const matchesQ = s.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                     (s.deliverableDescription || '').toLowerCase().includes(catalogSearch.toLowerCase());
    return matchesCat && matchesQ && s.status !== 'archived';
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:flex-row items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
      <div className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] bg-[#0B0F1A] sm:glass-modal sm:rounded-3xl flex flex-col overflow-hidden text-white shadow-2xl animate-scaleUp">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 shrink-0 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center justify-between bg-[#0B0F1A]/95 sm:bg-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#f7c548]/20 text-[#f7c548] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white font-display truncate">
                Nouveau projet créatif
              </h2>
              <p className="text-[11px] text-[#8E97AB] truncate">
                Configurez le client, les prestations reliées au catalogue et le brief créatif
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">

            {/* Quota limit notice if active projects limit reached */}
            {!entitlements.canCreateProject && (
              <div className="p-4 rounded-2xl bg-[#D9695F]/15 border border-[#D9695F]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#D9695F] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white font-display">
                      Limite de projets atteinte pour votre abonnement
                    </h4>
                    <p className="text-[11px] text-[#8E97AB] mt-0.5">
                      Votre formule actuelle autorise jusqu'à {entitlements.maxActiveProjects} projets actifs. Passez à la formule Pro pour des projets illimités.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUpgradeModal()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#f7c548] text-[#0B0F1A] text-xs font-bold shrink-0 hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Passer à Pro
                </button>
              </div>
            )}
            
            {/* Section 1: Informations Générales & Client */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f7c548] font-display">
                1. Informations Générales & Client
              </h3>

              {/* Template selector */}
              {projectTemplates && projectTemplates.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#f7c548] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Appliquer un modèle de cadrage (optionnel)</span>
                    </span>
                    <span className="text-[10px] text-[#8E97AB]">Préremplit brief, tâches & prestations</span>
                  </div>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleSelectTemplate(e.target.value)}
                    className="w-full px-3 py-2 glass-input text-xs rounded-xl cursor-pointer"
                  >
                    <option value="">Aucun modèle (projet vierge)</option>
                    {projectTemplates.map(tmpl => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name || tmpl.title} ({PROJECT_TYPE_LABELS[tmpl.projectType] || 'Créatif'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Nom du projet *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Identité Visuelle Maison Solène"
                    className="w-full px-3.5 py-2.5 text-xs glass-input font-medium"
                  />
                </div>

                {/* Client Selection (Locked or Searchable with Inline Create) */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-[#8E97AB]">
                      Client associé *
                    </label>
                    {!isClientLocked && !isCreatingClientInline && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingClientInline(true)}
                        className="text-xs text-[#f7c548] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Nouveau client</span>
                      </button>
                    )}
                  </div>

                  {isClientLocked && selectedClient ? (
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-[#f7c548]/40 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{selectedClient.company}</span>
                        <span className="text-[11px] text-[#8E97AB] block truncate">{selectedClient.name} · {selectedClient.email}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30 shrink-0 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Verrouillé pour ce dossier</span>
                      </span>
                    </div>
                  ) : isCreatingClientInline ? (
                    /* Inline Client Creation Card */
                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#f7c548]/50 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-xs font-bold text-[#f7c548] flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Créer un client sans quitter le formulaire</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingClientInline(false)}
                          className="text-[#8E97AB] hover:text-white text-xs cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] text-[#8E97AB] mb-1">Nom du contact *</label>
                          <input
                            type="text"
                            value={inlineClientData.name}
                            onChange={e => setInlineClientData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Sophie Martin"
                            className="w-full px-3 py-1.5 glass-input text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#8E97AB] mb-1">Entreprise / Marque *</label>
                          <input
                            type="text"
                            value={inlineClientData.company}
                            onChange={e => setInlineClientData(prev => ({ ...prev, company: e.target.value }))}
                            placeholder="Ex: Studio Riviera"
                            className="w-full px-3 py-1.5 glass-input text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#8E97AB] mb-1">Email professionnel *</label>
                          <input
                            type="email"
                            value={inlineClientData.email}
                            onChange={e => setInlineClientData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="sophie@studioriviera.fr"
                            className="w-full px-3 py-1.5 glass-input text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#8E97AB] mb-1">Téléphone</label>
                          <input
                            type="tel"
                            value={inlineClientData.phone}
                            onChange={e => setInlineClientData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+33 6 12 34 56 78"
                            className="w-full px-3 py-1.5 glass-input text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCreateInlineClient}
                          className="px-3 py-1.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          Créer et associer au projet
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Searchable Client Selector */
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E97AB]" />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          placeholder="Rechercher un client existant..."
                          className="w-full pl-8 pr-3 py-1.5 glass-input text-xs rounded-xl"
                        />
                      </div>
                      <select
                        required
                        value={clientId}
                        onChange={e => setClientId(e.target.value)}
                        className="w-full px-3 py-2 glass-input text-xs rounded-xl cursor-pointer"
                      >
                        <option value="" disabled>Sélectionner un client...</option>
                        {filteredClients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.company} — {c.name} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <CustomSelect
                  label="Type de livrable principal"
                  required
                  value={type}
                  onChange={(val) => setType(val as ProjectType)}
                  options={Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => ({
                    value: k,
                    label
                  }))}
                  sheetTitle="Choisir le type de livrable"
                />

                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Date d'échéance (Deadline) *
                  </label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs glass-input tabular-nums font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Prestations & Tarification Calculée */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f7c548] font-display">
                    2. Prestations & Budget calculé
                  </h3>
                  <p className="text-[11px] text-[#8E97AB]">
                    Les prestations sont copiées dans ce projet. Le tarif unitaire reste modifiable ici sans altérer le catalogue.
                  </p>
                </div>

                {/* Prestations actions buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsCatalogPickerOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] hover:bg-[#f7c548]/30 border border-[#f7c548]/40 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Du catalogue</span>
                  </button>

                  {catalogPacks && catalogPacks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsPackPickerOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-[#5FB59A]" />
                      <span>Ajouter pack</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCustomLineModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#8E97AB]" />
                    <span>Ligne libre</span>
                  </button>
                </div>
              </div>

              {/* Prestations Table / Cards */}
              <div className="space-y-2.5">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={line.name}
                            onChange={e => handleUpdateLine(line.id, { name: e.target.value })}
                            className="text-xs font-bold text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-[#f7c548] focus:outline-hidden w-full truncate"
                          />
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#8E97AB] font-medium shrink-0">
                            {CATALOG_UNIT_LABELS[line.unit] || line.unit}
                          </span>
                        </div>
                        {line.description && (
                          <p className="text-[11px] text-[#8E97AB] mt-0.5 line-clamp-1">
                            {line.description}
                          </p>
                        )}
                      </div>

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 text-[#8E97AB] hover:text-[#D9695F] transition-colors cursor-pointer shrink-0"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Quantity & Unit price row */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[#8E97AB] text-[11px]">Qté :</span>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={e => handleUpdateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-14 px-2 py-1 glass-input text-xs text-center tabular-nums"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[#8E97AB] text-[11px]">Prix unit. HT :</span>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={line.unitPrice}
                            onChange={e => handleUpdateLine(line.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-24 px-2 py-1 glass-input text-xs text-right tabular-nums pr-7 font-bold text-[#f7c548]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E97AB]">
                            {currency}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-[#8E97AB] block">Total ligne HT</span>
                        <strong className="text-xs text-white tabular-nums">
                          {formatCurrencySafe(line.totalHT, currency, 0)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Calculation Box */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#f7c548]/30 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-[#8E97AB]">Sous-total brut HT :</span>
                  <span className="font-bold text-white tabular-nums font-display">
                    {formatCurrencySafe(subtotalHT, currency, 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8E97AB]">Remise commerciale :</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-14 px-1.5 py-0.5 glass-input text-xs text-center tabular-nums"
                      placeholder="0"
                    />
                    <span className="text-[11px] text-[#8E97AB]">%</span>
                  </div>
                  <span className="text-[#8E97AB] tabular-nums">
                    - {formatCurrencySafe(discountAmount, currency, 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-[#8E97AB]">TVA calculée :</span>
                  <span className="text-white tabular-nums">
                    + {formatCurrencySafe(vatAmount, currency, 0)}
                  </span>
                </div>

                {/* Total TTC (Calculé) */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block font-display">
                      Budget Total du projet (TTC)
                    </span>
                    <span className="text-[10px] text-[#8E97AB]">Calculé automatiquement à partir des lignes</span>
                  </div>
                  <span className="text-xl font-bold text-[#f7c548] tabular-nums font-display">
                    {formatCurrencySafe(totalTTC, currency, 0)}
                  </span>
                </div>

                {/* Acompte % et Montant calculé */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8E97AB]">Acompte de démarrage :</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={depositPercentVal}
                      onChange={e => setDepositPercentVal(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-14 px-2 py-0.5 glass-input text-xs text-center tabular-nums font-bold"
                    />
                    <span className="text-[#8E97AB]">%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#8E97AB]">Montant acompte calculé : </span>
                    <strong className="text-white tabular-nums">{formatCurrencySafe(depositAmountVal, currency, 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Revision limit */}
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Révisions incluses (prérempli depuis le modèle ou la prestation)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={revisionLimit}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  onChange={(e) => setRevisionLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs glass-input tabular-nums font-semibold"
                />
              </div>
            </div>

            {/* Section 3: Brief Créatif */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f7c548] font-display">
                3. Brief Créatif
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Objectifs du projet
                  </label>
                  <textarea
                    rows={2}
                    value={objectives}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="Ex: Lancer la nouvelle gamme de produits"
                    className="w-full px-3 py-2 text-xs glass-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                      Public cible
                    </label>
                    <input
                      type="text"
                      value={targetAudience}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Ex: Professionnels & indépendants"
                      className="w-full px-3 py-2 text-xs glass-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                      Style souhaité
                    </label>
                    <input
                      type="text"
                      value={desiredStyle}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      onChange={(e) => setDesiredStyle(e.target.value)}
                      placeholder="Ex: Minimaliste & contemporain"
                      className="w-full px-3 py-2 text-xs glass-input"
                    />
                  </div>
                </div>

                {/* Palette de couleurs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-[#8E97AB]">
                      Palette de couleurs ({colors.length})
                    </label>
                    <span className="text-[11px] text-[#8E97AB]">
                      Suggestions de démarrage
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {COLOR_SUGGESTIONS.map((sug) => (
                      <button
                        key={`color-sug-${sug.hex}`}
                        type="button"
                        onClick={() => handleAddSuggestion(sug)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-white/90 transition-colors cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: sug.hex }} />
                        <span>{sug.name}</span>
                      </button>
                    ))}
                  </div>

                  {colors.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {colors.map((c, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs"
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: c.hex }} />
                          <span className="text-white font-medium">{c.name}</span>
                          <span className="text-[#8E97AB] text-[11px] uppercase">{c.hex}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveColor(i)}
                            className="text-[#8E97AB] hover:text-[#D9695F] ml-1 cursor-pointer font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="w-9 h-9 p-0.5 rounded-lg bg-transparent border border-white/15 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={newColorName}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder="Nom de la couleur"
                      className="flex-1 px-3 py-1.5 text-xs glass-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomColor}
                      className="glass-btn-secondary px-3 py-1.5 rounded-lg text-xs cursor-pointer font-semibold shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                    Contenus fournis par le client
                  </label>
                  <textarea
                    rows={2}
                    value={clientProvidedAssets}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    onChange={(e) => setClientProvidedAssets(e.target.value)}
                    placeholder="Ex: Logo vectoriel, charte existante, photos HD"
                    className="w-full px-3 py-2 text-xs glass-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="px-5 py-3.5 border-t border-white/10 bg-[#0B0F1A]/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!entitlements.canCreateProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all shadow-md shadow-[#f7c548]/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>Créer le projet</span>
            </button>
          </div>
        </form>

        {/* Modal: Add from Catalog with Search & Multiselect */}
        {isCatalogPickerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-modal w-full max-w-xl p-5 space-y-4 animate-scaleUp max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#f7c548]" />
                  <h3 className="text-sm font-bold text-white font-display">
                    Ajouter des prestations du catalogue
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCatalogPickerOpen(false)}
                  className="p-1 rounded-lg text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Categories */}
              <div className="space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E97AB]" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    placeholder="Rechercher par nom ou description..."
                    className="w-full pl-8 pr-3 py-1.5 glass-input text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCatalogCategory('all')}
                    className={`px-2.5 py-1 rounded-lg shrink-0 cursor-pointer ${catalogCategory === 'all' ? 'bg-[#f7c548] text-[#0B0F1A] font-bold' : 'bg-white/5 text-[#8E97AB]'}`}
                  >
                    Toutes
                  </button>
                  {STANDARD_CATALOG_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCatalogCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg shrink-0 cursor-pointer ${catalogCategory === cat.id ? 'bg-[#f7c548] text-[#0B0F1A] font-bold' : 'bg-white/5 text-[#8E97AB]'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Items list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredCatalog.map(service => {
                  const qty = selectedCatalogQuantities[service.id] || 0;
                  const price = fromSmallestUnit(service.unitPriceCents, currency);

                  return (
                    <div
                      key={service.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${qty > 0 ? 'bg-[#f7c548]/10 border-[#f7c548]/40' : 'bg-white/[0.03] border-white/10'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate font-display">
                            {service.name}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#8E97AB]">
                            {CATALOG_UNIT_LABELS[service.unit] || service.unit}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8E97AB] line-clamp-1 mt-0.5">
                          {service.deliverableDescription || 'Prestation du catalogue'}
                        </p>
                        <span className="text-xs font-bold text-[#f7c548] tabular-nums mt-0.5 block">
                          {formatCurrencySafe(price, currency, 0)}
                        </span>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogQuantities(prev => ({ ...prev, [service.id]: Math.max(0, (prev[service.id] || 0) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold tabular-nums text-white">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogQuantities(prev => ({ ...prev, [service.id]: (prev[service.id] || 0) + 1 }))}
                          className="w-7 h-7 rounded-lg bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredCatalog.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#8E97AB]">
                    Aucune prestation ne correspond à cette recherche dans le catalogue.
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0">
                <span className="text-xs text-[#8E97AB]">
                  {Object.values(selectedCatalogQuantities).reduce((a, b) => a + b, 0)} prestation(s) sélectionnée(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCatalogPickerOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCatalogSelection}
                    className="px-4 py-1.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold cursor-pointer transition-all"
                  >
                    Ajouter au projet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Pack */}
        {isPackPickerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-modal w-full max-w-lg p-5 space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#5FB59A]" />
                  <h3 className="text-sm font-bold text-white font-display">
                    Ajouter un Pack de prestations
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPackPickerOpen(false)}
                  className="p-1 rounded-lg text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#8E97AB]">
                Choisir un pack déploie automatiquement l'ensemble de ses prestations et quantités dans ce dossier :
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {catalogPacks.filter(p => p.status !== 'archived').map(pack => {
                  const price = fromSmallestUnit(pack.packPriceCents, currency);
                  return (
                    <div
                      key={pack.id}
                      onClick={() => handleAddPack(pack)}
                      className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#f7c548] transition-colors truncate font-display">
                          {pack.name}
                        </h4>
                        <p className="text-[11px] text-[#8E97AB] line-clamp-1 mt-0.5">
                          {pack.items?.length || 0} prestation(s) incluses · {pack.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[#5FB59A] tabular-nums block">
                          {formatCurrencySafe(price, currency, 0)}
                        </span>
                        <span className="text-[10px] text-[#8E97AB]">Déployer le pack →</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsPackPickerOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Custom Free Line */}
        {isCustomLineModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-modal w-full max-w-lg p-5 space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#f7c548]" />
                  <h3 className="text-sm font-bold text-white font-display">
                    Ajouter une ligne personnalisée
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomLineModalOpen(false)}
                  className="p-1 rounded-lg text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCustomLine} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Désignation *</label>
                  <input
                    type="text"
                    required
                    value={customLineForm.name}
                    onChange={e => setCustomLineForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Reportage photo produit in situ"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Description / Livrables</label>
                  <input
                    type="text"
                    value={customLineForm.description}
                    onChange={e => setCustomLineForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: 15 photos retouchées HD et déclinaisons web"
                    className="w-full px-3 py-2 glass-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#8E97AB] mb-1">Unité</label>
                    <select
                      value={customLineForm.unit}
                      onChange={e => setCustomLineForm(prev => ({ ...prev, unit: e.target.value as CatalogUnit }))}
                      className="w-full px-2.5 py-1.5 glass-input text-xs rounded-xl cursor-pointer"
                    >
                      {Object.entries(CATALOG_UNIT_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E97AB] mb-1">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      value={customLineForm.quantity}
                      onChange={e => setCustomLineForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-full px-2.5 py-1.5 glass-input text-xs tabular-nums text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E97AB] mb-1">Prix unitaire HT</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={customLineForm.unitPrice}
                      onChange={e => setCustomLineForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 glass-input text-xs tabular-nums text-right font-bold text-[#f7c548]"
                    />
                  </div>
                </div>

                {/* Checkbox: Add to catalog */}
                <div className="p-3 rounded-xl bg-[#f7c548]/10 border border-[#f7c548]/30 flex items-start gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="addToCatCheck"
                    checked={customLineForm.addToCatalog}
                    onChange={e => setCustomLineForm(prev => ({ ...prev, addToCatalog: e.target.checked }))}
                    className="mt-0.5 rounded cursor-pointer accent-[#f7c548]"
                  />
                  <label htmlFor="addToCatCheck" className="text-xs text-white cursor-pointer select-none">
                    <span className="font-bold text-[#f7c548] block">Ajouter également cette prestation au catalogue</span>
                    <span className="text-[11px] text-[#8E97AB]">Elle sera disponible immédiatement pour vos futurs devis et projets.</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCustomLineModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold cursor-pointer"
                  >
                    Insérer la prestation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
