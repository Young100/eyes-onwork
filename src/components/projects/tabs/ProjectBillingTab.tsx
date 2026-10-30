import React, { useState } from 'react';
import { 
  Plus, 
  FileText, 
  CreditCard, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Copy,
  Download,
  Package,
  Trash2,
  Sparkles,
  Receipt,
  Layers,
  Search,
  X,
  FileCheck,
  Check,
  Lock,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { 
  Project, 
  Quote, 
  Invoice, 
  ProjectServiceLine, 
  CatalogUnit, 
  CATALOG_UNIT_LABELS,
  CatalogPack
} from '../../../types';
import { DocumentA4Modal } from '../../billing/DocumentA4Modal';
import { CreateQuoteModal } from '../../billing/CreateQuoteModal';
import { CreateInvoiceModal } from '../../billing/CreateInvoiceModal';
import { RecordPaymentModal } from '../../billing/RecordPaymentModal';
import { generateDirectDocumentPDF } from '../../../utils/pdfGenerator';
import { formatCurrencySafe } from '../../../utils/formatUtils';
import { fromSmallestUnit, toSmallestUnit, STANDARD_CATALOG_CATEGORIES } from '../../../utils/pricingEngine';

interface ProjectBillingTabProps {
  project: Project;
}

export const ProjectBillingTab: React.FC<ProjectBillingTabProps> = ({ project }) => {
  const { 
    getQuotesByProjectId, 
    getInvoicesByProjectId, 
    getClientById, 
    profile, 
    updateProject,
    catalogServices,
    catalogPacks,
    addCatalogService,
    addQuote,
    createInvoiceFromQuote,
    acceptQuote,
    createQuoteVersion,
    cancelInvoiceWithCreditNote
  } = useApp();

  const quotes = getQuotesByProjectId(project.id);
  const invoices = getInvoicesByProjectId(project.id);
  const client = getClientById(project.clientId);
  const currency = profile.currency || 'EUR';

  // Modal preview and creation states
  const [previewDoc, setPreviewDoc] = useState<{ doc: Quote | Invoice; type: 'quote' | 'invoice' } | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 4500);
  };

  // Prestations management states
  const lines = project.lines || [];
  const discountPercent = project.discountPercent ?? 0;
  const depositPercent = project.depositPercent ?? 50;

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

  // Financial calculations
  const subtotalHT = lines.reduce((acc, l) => acc + (l.unitPrice * l.quantity), 0);
  const discountAmount = Math.round(subtotalHT * (discountPercent / 100));
  const netHT = Math.max(0, subtotalHT - discountAmount);
  const vatAmount = Math.round(lines.reduce((acc, l) => acc + ((l.unitPrice * l.quantity) * (l.vatRate / 100)), 0) * (1 - discountPercent / 100));
  const totalTTC = lines.length > 0 ? (netHT + vatAmount) : project.budget;

  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.totalTTC, 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
  const totalBalanceDue = invoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  const remainingToInvoice = Math.max(0, totalTTC - totalInvoiced);

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, currency, 0);
  };

  // Prestations updates helper
  const updateProjectLines = (newLines: ProjectServiceLine[], newDiscount?: number, newDepositPct?: number) => {
    const disc = newDiscount !== undefined ? newDiscount : discountPercent;
    const dep = newDepositPct !== undefined ? newDepositPct : depositPercent;

    const sub = newLines.reduce((acc, l) => acc + (l.unitPrice * l.quantity), 0);
    const discAmt = Math.round(sub * (disc / 100));
    const net = sub - discAmt;
    const vat = Math.round(newLines.reduce((acc, l) => acc + ((l.unitPrice * l.quantity) * (l.vatRate / 100)), 0) * (1 - disc / 100));
    const ttc = net + vat;
    const depAmt = Math.round(ttc * (dep / 100));

    updateProject(project.id, {
      lines: newLines,
      budget: ttc,
      subtotalHT: sub,
      vatAmount: vat,
      totalTTC: ttc,
      discountPercent: disc,
      depositPercent: dep,
      depositAmount: depAmt
    });
  };

  const handleUpdateLine = (lineId: string, updates: Partial<ProjectServiceLine>) => {
    const nextLines = lines.map(l => {
      if (l.id !== lineId) return l;
      const merged = { ...l, ...updates };
      merged.totalHT = merged.unitPrice * merged.quantity;
      merged.totalTTC = Math.round(merged.totalHT * (1 + merged.vatRate / 100));
      return merged;
    });
    updateProjectLines(nextLines);
  };

  const handleRemoveLine = (lineId: string) => {
    const nextLines = lines.filter(l => l.id !== lineId);
    updateProjectLines(nextLines);
  };

  // Add from catalog
  const handleConfirmCatalogSelection = () => {
    const newItems: ProjectServiceLine[] = [];
    Object.entries(selectedCatalogQuantities).forEach(([svcId, qty]) => {
      if (qty <= 0) return;
      const svc = catalogServices.find(s => s.id === svcId);
      if (!svc) return;

      const price = fromSmallestUnit(svc.unitPriceCents, currency);
      const rate = svc.taxRate ?? (profile.vatRate ?? 20);
      newItems.push({
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

    if (newItems.length > 0) {
      updateProjectLines([...lines, ...newItems]);
      setSelectedCatalogQuantities({});
      setIsCatalogPickerOpen(false);
    }
  };

  // Add pack
  const handleAddPack = (pack: CatalogPack) => {
    const packItems: ProjectServiceLine[] = [];
    if (pack.items && pack.items.length > 0) {
      pack.items.forEach(item => {
        const foundSvc = catalogServices.find(s => s.id === item.serviceId);
        const itemAny = item as any;
        const price = fromSmallestUnit(itemAny.unitPriceCents || foundSvc?.unitPriceCents || 0, currency);
        const rate = foundSvc?.taxRate ?? (profile.vatRate ?? 20);
        packItems.push({
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

    if (packItems.length > 0) {
      updateProjectLines([...lines, ...packItems]);
      setIsPackPickerOpen(false);
    }
  };

  // Add custom line
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

    if (customLineForm.addToCatalog) {
      addCatalogService({
        name: customLineForm.name.trim(),
        category: project.type,
        deliverableDescription: customLineForm.description.trim(),
        unit: customLineForm.unit,
        unitPriceCents: toSmallestUnit(price, currency),
        taxRate: rate,
        turnaroundDays: customLineForm.turnaroundDays,
        revisionLimit: customLineForm.revisionLimit,
        status: 'active'
      });
    }

    updateProjectLines([...lines, newLine]);
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

  const filteredCatalog = catalogServices.filter(s => {
    const matchesCat = catalogCategory === 'all' || s.category === catalogCategory;
    const matchesQ = s.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                     (s.deliverableDescription || '').toLowerCase().includes(catalogSearch.toLowerCase());
    return matchesCat && matchesQ && s.status !== 'archived';
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Five Synthesis Financial KPI Cards */}
      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#f7c548]" />
              <span>Prestations & Facturation du projet</span>
            </h3>
            <p className="text-xs text-[#8E97AB] mt-0.5">
              Gestion financière de bout en bout : catalogue des prestations, devis, factures et suivi des règlements.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsQuoteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm shadow-[#f7c548]/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nouveau devis</span>
            </button>

            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-[#5FB59A]" />
              <span>Émettre facture</span>
            </button>
          </div>
        </div>

        {/* 5 Financial KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[11px] text-[#8E97AB] block">Budget total TTC</span>
            <span className="text-base font-bold text-white font-display tabular-nums mt-0.5 block">
              {formatCurrency(totalTTC)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[11px] text-[#8E97AB] block">Montant facturé</span>
            <span className="text-base font-bold text-white font-display tabular-nums mt-0.5 block">
              {formatCurrency(totalInvoiced)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#5FB59A]/10 border border-[#5FB59A]/20">
            <span className="text-[11px] text-[#5FB59A] block font-medium">Montant encaissé</span>
            <span className="text-base font-bold text-[#5FB59A] font-display tabular-nums mt-0.5 block">
              {formatCurrency(totalPaid)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#f7c548]/10 border border-[#f7c548]/20">
            <span className="text-[11px] text-[#f7c548] block font-medium">Reste à facturer</span>
            <span className="text-base font-bold text-[#f7c548] font-display tabular-nums mt-0.5 block">
              {formatCurrency(remainingToInvoice)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-[#8E97AB] block">Reste à percevoir</span>
            <span className="text-base font-bold text-white font-display tabular-nums mt-0.5 block">
              {formatCurrency(totalBalanceDue)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Section Prestations du Projet (Reliées au Catalogue) */}
      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-display flex items-center gap-2">
              <Package className="w-4 h-4 text-[#f7c548]" />
              <span>Prestations du projet ({lines.length})</span>
            </h4>
            <p className="text-[11px] text-[#8E97AB] mt-0.5">
              Source de tarification copiée du catalogue. Modifier un prix ici n'altère pas votre catalogue d'origine.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setIsCatalogPickerOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#f7c548]/20 text-[#f7c548] hover:bg-[#f7c548]/30 border border-[#f7c548]/40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Du catalogue</span>
            </button>

            {catalogPacks && catalogPacks.length > 0 && (
              <button
                onClick={() => setIsPackPickerOpen(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-[#5FB59A]" />
                <span>Ajouter pack</span>
              </button>
            )}

            <button
              onClick={() => setIsCustomLineModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#8E97AB]" />
              <span>Ligne libre</span>
            </button>
          </div>
        </div>

        {/* Lines list */}
        {lines.length > 0 ? (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.id}
                className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5"
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

                  <button
                    onClick={() => handleRemoveLine(line.id)}
                    className="p-1 text-[#8E97AB] hover:text-[#D9695F] transition-colors cursor-pointer shrink-0"
                    title="Retirer cette prestation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quantitative controls */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8E97AB] text-[11px]">Quantité :</span>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={e => handleUpdateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-16 px-2 py-1 glass-input text-xs text-center tabular-nums"
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
                        className="w-28 px-2 py-1 glass-input text-xs text-right tabular-nums pr-8 font-bold text-[#f7c548]"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E97AB]">
                        {currency}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#8E97AB] block">Total HT</span>
                    <strong className="text-xs text-white tabular-nums">
                      {formatCurrencySafe(line.totalHT, currency, 0)}
                    </strong>
                  </div>
                </div>
              </div>
            ))}

            {/* Financial summary breakdown */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#f7c548]/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                <span className="text-[#8E97AB]">Sous-total brut HT :</span>
                <span className="font-bold text-white tabular-nums font-display">
                  {formatCurrencySafe(subtotalHT, currency, 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-[#8E97AB]">Remise sur le dossier :</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={e => updateProjectLines(lines, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
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

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block font-display">
                    Budget Total du projet (TTC)
                  </span>
                  <span className="text-[10px] text-[#8E97AB]">Calculé automatiquement à partir des prestations</span>
                </div>
                <span className="text-lg font-bold text-[#f7c548] tabular-nums font-display">
                  {formatCurrencySafe(totalTTC, currency, 0)}
                </span>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#8E97AB]">Acompte de démarrage ({depositPercent}%) :</span>
                </div>
                <strong className="text-white tabular-nums">
                  {formatCurrencySafe(Math.round(totalTTC * (depositPercent / 100)), currency, 0)}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-3">
            <p className="text-xs text-[#8E97AB]">
              Aucune prestation spécifique n'est encore rattachée à ce dossier. Le budget est actuellement fixé à {formatCurrency(project.budget)}.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => setIsCatalogPickerOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#f7c548] text-[#0B0F1A] hover:bg-[#e5b336] transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Importer du catalogue</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#5FB59A] text-[#0B0F1A] font-bold text-xs shadow-2xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* 3. Section Devis Associés & Déclencheur Facture d'acompte */}
      {(() => {
        const acceptedQuote = quotes.find(q => q.status === 'accepted');
        const depositInvoice = invoices.find(i => (i.quoteId === acceptedQuote?.id || i.type === 'deposit') && !i.isCancelled);
        const balanceInvoice = invoices.find(i => (i.quoteId === acceptedQuote?.id || i.type === 'balance') && !i.isCancelled);

        return (
          <div className="space-y-4">
            {/* Accepted Quote Workflow Banner */}
            {acceptedQuote && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#5FB59A]/15 to-[#f7c548]/15 border border-[#5FB59A]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#5FB59A]/20 text-[#5FB59A] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-display">
                        Devis accepté ({acceptedQuote.quoteNumber})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#5FB59A]/20 text-[#5FB59A] border border-[#5FB59A]/30">
                        Projet : Devis accepté
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8E97AB] mt-0.5">
                      Budget validé : {formatCurrency(acceptedQuote.totalTTC)} TTC · Acompte convenu : {formatCurrency(acceptedQuote.depositAmount)} ({acceptedQuote.depositPercent}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!depositInvoice ? (
                    <button
                      onClick={() => {
                        createInvoiceFromQuote(acceptedQuote.id, 'deposit');
                        showToast(`Facture d'acompte émise pour ${acceptedQuote.quoteNumber} !`);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#5FB59A]/20"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Créer la facture d'acompte</span>
                    </button>
                  ) : !balanceInvoice ? (
                    <button
                      onClick={() => {
                        createInvoiceFromQuote(acceptedQuote.id, 'balance');
                        showToast(`Facture de solde émise pour ${acceptedQuote.quoteNumber} !`);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#f7c548]/20"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Créer la facture de solde</span>
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[#5FB59A] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Facturation complète initiée
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="glass-panel p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#f7c548]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                    Devis du projet ({quotes.length})
                  </h4>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const quoteLines = lines.map(l => ({
                        id: `ql_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        sourceCatalogServiceId: l.sourceCatalogServiceId,
                        designation: l.name,
                        description: l.description,
                        quantity: l.quantity,
                        unitPrice: l.unitPrice,
                        vatRate: l.vatRate,
                        total: l.unitPrice * l.quantity
                      }));

                      const q = addQuote({
                        clientId: project.clientId,
                        projectId: project.id,
                        validityDays: 30,
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        lines: quoteLines.length > 0 ? quoteLines : [
                          {
                            id: `ql_${Date.now()}`,
                            designation: project.title,
                            description: 'Prestations graphiques sur mesure',
                            quantity: 1,
                            unitPrice: project.budget,
                            vatRate: profile.vatRate ?? 20,
                            total: project.budget
                          }
                        ],
                        subtotal: subtotalHT || project.budget,
                        discountPercent,
                        vatRate: profile.vatRate ?? 20,
                        vatAmount,
                        totalTTC,
                        depositPercent,
                        depositAmount: Math.round(totalTTC * (depositPercent / 100)),
                        revisionLimit: project.revisionLimit ?? 3,
                        turnaroundTime: '3 semaines',
                        termsAndConditions: profile.defaultConditionsQuote || 'Règlement : 50 % d’acompte à la commande, solde à la livraison finale.',
                        status: 'draft'
                      });

                      showToast(`Devis ${q.quoteNumber} créé en Brouillon !`);
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Génère immédiatement un devis prérempli avec les prestations en statut Brouillon"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#f7c548]" />
                    <span>Créer devis prérempli (Brouillon)</span>
                  </button>

                  <button
                    onClick={() => setIsQuoteModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-[#f7c548]/20"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Nouveau devis personnalisé</span>
                  </button>
                </div>
              </div>

              {quotes.length > 0 ? (
                <div className="space-y-3">
                  {quotes.map(quote => (
                    <div
                      key={quote.id}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-white font-display">
                            {quote.quoteNumber}
                          </span>
                          {quote.version && quote.version > 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">
                              V{quote.version}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            quote.status === 'accepted' ? 'bg-[#5FB59A]/15 text-[#5FB59A] border border-[#5FB59A]/30' :
                            quote.status === 'draft' ? 'bg-white/10 text-[#8E97AB] border border-white/20' :
                            quote.status === 'refused' ? 'bg-[#D9695F]/15 text-[#D9695F] border border-[#D9695F]/30' :
                            quote.status === 'expired' ? 'bg-white/5 text-[#8E97AB] border border-white/10' :
                            'bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30'
                          }`}>
                            {quote.status === 'accepted' ? 'Accepté & Verrouillé 🔒' :
                             quote.status === 'draft' ? 'Brouillon' :
                             quote.status === 'refused' ? 'Refusé' :
                             quote.status === 'expired' ? 'Expiré' : 'Envoyé'}
                          </span>
                        </div>

                        <p className="text-xs text-[#8E97AB]">
                          Créé le {new Date(quote.createdAt).toLocaleDateString('fr-FR')} · {quote.lines.length} ligne(s) · Total : <strong className="text-white">{formatCurrency(quote.totalTTC)} TTC</strong> (Acompte {quote.depositPercent}%: {formatCurrency(quote.depositAmount)})
                        </p>

                        {quote.acceptedByName && (
                          <p className="text-[11px] text-[#5FB59A] flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Signé par {quote.acceptedByName} le {new Date(quote.acceptedAt || '').toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {quote.status !== 'accepted' && (
                          <button
                            onClick={() => {
                              acceptQuote(quote.id, client?.name || client?.company || 'Client');
                              showToast(`Devis ${quote.quoteNumber} accepté !`);
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#5FB59A] hover:bg-[#6ecbb0] text-[#0B0F1A] transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            title="Marquer le devis comme accepté et verrouillé"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Accepter</span>
                          </button>
                        )}

                        {quote.status === 'accepted' && (
                          <>
                            <button
                              onClick={() => {
                                const newVer = createQuoteVersion(quote.id);
                                showToast(`Version ${newVer.quoteNumber} (V${newVer.version}) créée !`);
                              }}
                              className="glass-btn-secondary px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer"
                              title="Créer une nouvelle version (V2) pour modifier ce devis verrouillé"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Nouvelle version</span>
                            </button>

                            {!depositInvoice && (
                              <button
                                onClick={() => {
                                  createInvoiceFromQuote(quote.id, 'deposit');
                                  showToast(`Facture d'acompte émise pour ${quote.quoteNumber} !`);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#5FB59A] hover:bg-[#6ecbb0] text-[#0B0F1A] transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Facture d'acompte</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => setPreviewDoc({ doc: quote, type: 'quote' })}
                          className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#f7c548]" />
                          <span>Aperçu PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#8E97AB] border border-dashed border-white/10 rounded-xl space-y-2">
                  <p>Aucun devis n'a été émis pour ce projet.</p>
                  <button
                    onClick={() => setIsQuoteModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer le premier devis</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 4. Section Factures Associées (Conformité Fiscale & Immuabilité) */}
      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#5FB59A]" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                Factures associées ({invoices.length})
              </h4>
              <p className="text-[10px] text-[#8E97AB]">
                Inaltérabilité comptable : toute facture émise ne peut être modifiée ou supprimée que par annulation avec avoir.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="text-xs text-[#5FB59A] hover:underline font-semibold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>Émettre facture</span>
          </button>
        </div>

        {invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map(invoice => (
              <div
                key={invoice.id}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-white font-display">
                      {invoice.invoiceNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      invoice.status === 'paid' ? 'bg-[#5FB59A]/15 text-[#5FB59A]' :
                      invoice.status === 'cancelled' ? 'bg-white/10 text-[#8E97AB] line-through' :
                      invoice.status === 'partially_paid' ? 'bg-[#f7c548]/15 text-[#f7c548]' :
                      invoice.status === 'overdue' ? 'bg-red-500/15 text-red-400' :
                      'bg-[#f7c548]/15 text-[#f7c548]'
                    }`}>
                      {invoice.status === 'paid' ? 'Payée' :
                       invoice.status === 'cancelled' ? 'Annulée' :
                       invoice.status === 'partially_paid' ? 'Partielle' :
                       invoice.status === 'overdue' ? 'En retard' : 'En attente'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#8E97AB]">
                      {invoice.type === 'deposit' ? 'Acompte' :
                       invoice.type === 'balance' ? 'Solde' :
                       invoice.type === 'credit_note' ? 'Avoir' :
                       invoice.type === 'additional' ? 'Prestation sup.' : 'Complète'}
                    </span>
                    {invoice.isLocked && invoice.status !== 'cancelled' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#8E97AB] border border-white/10" title="Facture émise scellée">
                        🔒 Émise
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#8E97AB]">
                    Total TTC : {formatCurrency(invoice.totalTTC)} · Payé : {formatCurrency(invoice.paidAmount)} · Reste dû : {formatCurrency(invoice.balanceDue)}
                  </p>

                  {invoice.cancellationReason && (
                    <p className="text-[11px] text-[#D9695F] italic">
                      Motif d'annulation : {invoice.cancellationReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.type !== 'credit_note' && (
                    <button
                      onClick={() => setPaymentInvoice(invoice)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#5FB59A] hover:bg-[#72C8AE] text-[#0B0F1A] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Encaisser</span>
                    </button>
                  )}

                  {invoice.status !== 'cancelled' && invoice.type !== 'credit_note' && invoice.isLocked && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Confirmez-vous l'annulation fiscale de la facture ${invoice.invoiceNumber} ? Un avoir rectificatif officiel (${profile.invoicePrefix || 'FAC-2026-'}...) sera émis automatiquement.`)) {
                          cancelInvoiceWithCreditNote(invoice.id);
                          showToast(`Facture ${invoice.invoiceNumber} annulée et avoir généré.`);
                        }
                      }}
                      className="p-1.5 text-[#8E97AB] hover:text-[#D9695F] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      title="Annuler légalement et générer un avoir rectificatif"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => setPreviewDoc({ doc: invoice, type: 'invoice' })}
                    className="glass-btn-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#5FB59A]" />
                    <span>Aperçu PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#8E97AB] border border-dashed border-white/10 rounded-xl">
            Aucune facture n'a encore été émise pour ce projet.
          </div>
        )}
      </div>

      {/* Modal: Add from Catalog */}
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

            <div className="space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E97AB]" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher par nom..."
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
                        <h4 className="text-xs font-bold text-white truncate font-display">{service.name}</h4>
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
            </div>

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
                  className="px-4 py-1.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold cursor-pointer"
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
                  Déployer un pack de prestations
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

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {catalogPacks.filter(p => p.status !== 'archived').map(pack => (
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
                      {pack.items?.length || 0} prestations incluses
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#5FB59A] tabular-nums block">
                    {formatCurrencySafe(fromSmallestUnit(pack.packPriceCents, currency), currency, 0)}
                  </span>
                </div>
              ))}
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
                  Ajouter une prestation libre
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
                  placeholder="Ex: Animation 3D du logo pour vidéo intro"
                  className="w-full px-3 py-2 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8E97AB] mb-1">Livrables et spécifications</label>
                <input
                  type="text"
                  value={customLineForm.description}
                  onChange={e => setCustomLineForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Fichier MP4 4K et alpha transparent"
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
                  <label className="block text-[11px] text-[#8E97AB] mb-1">Prix unit. HT</label>
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

              <div className="p-3 rounded-xl bg-[#f7c548]/10 border border-[#f7c548]/30 flex items-start gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="addToCatCheckProject"
                  checked={customLineForm.addToCatalog}
                  onChange={e => setCustomLineForm(prev => ({ ...prev, addToCatalog: e.target.checked }))}
                  className="mt-0.5 rounded cursor-pointer accent-[#f7c548]"
                />
                <label htmlFor="addToCatCheckProject" className="text-xs text-white cursor-pointer select-none">
                  <span className="font-bold text-[#f7c548] block">Ajouter également cette prestation au catalogue</span>
                  <span className="text-[11px] text-[#8E97AB]">Elle sera réutilisable pour vos autres clients et projets.</span>
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
                  Insérer dans le projet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Creation modals */}
      {isQuoteModalOpen && (
        <CreateQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          defaultProjectId={project.id}
          defaultClientId={project.clientId}
          isClientLocked={true}
          initialLines={lines.map(l => ({
            id: `ql_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            sourceCatalogServiceId: l.sourceCatalogServiceId,
            designation: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            total: l.unitPrice * l.quantity
          }))}
          initialDepositPercent={project.depositPercent}
          initialDiscountPercent={project.discountPercent}
          initialRevisionLimit={project.revisionLimit}
        />
      )}

      {isInvoiceModalOpen && (
        <CreateInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          defaultProjectId={project.id}
          defaultClientId={project.clientId}
          isClientLocked={true}
        />
      )}

      {paymentInvoice && (
        <RecordPaymentModal
          isOpen={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          invoice={paymentInvoice}
        />
      )}

      {previewDoc && (
        <DocumentA4Modal
          document={previewDoc.doc}
          type={previewDoc.type}
          client={client}
          profile={profile}
          onClose={() => setPreviewDoc(null)}
        />
      )}

    </div>
  );
};
