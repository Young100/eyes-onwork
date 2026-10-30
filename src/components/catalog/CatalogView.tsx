import React, { useState } from 'react';
import { BookOpen, Plus, Search, Edit2, Archive, Check, Sparkles, Layers, PackageCheck, Clock, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CatalogService, CatalogUnit, CATALOG_UNIT_LABELS, ProjectType, PROJECT_TYPE_LABELS } from '../../types';
import { formatCurrencySafe, toSmallestUnit, fromSmallestUnit } from '../../utils/pricingEngine';

interface CatalogViewProps {
  onUseTemplateForProject?: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onUseTemplateForProject }) => {
  const { catalogServices, catalogPacks, addCatalogService, updateCatalogService, archiveCatalogService, profile } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<CatalogService | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: 'identite_visuelle' as ProjectType,
    deliverableDescription: '',
    unit: 'forfait' as CatalogUnit,
    unitPrice: 1200,
    taxRate: 20,
    turnaroundDays: 14,
    revisionLimit: 3
  });

  const filteredServices = catalogServices.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.deliverableDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCat && s.status === 'active';
  });

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingService) {
      updateCatalogService(editingService.id, {
        name: form.name.trim(),
        category: form.category,
        deliverableDescription: form.deliverableDescription.trim(),
        unit: form.unit,
        unitPriceCents: toSmallestUnit(form.unitPrice, profile.currency || 'EUR'),
        taxRate: form.taxRate,
        turnaroundDays: form.turnaroundDays,
        revisionLimit: form.revisionLimit
      });
      setEditingService(null);
    } else {
      addCatalogService({
        name: form.name.trim(),
        category: form.category,
        deliverableDescription: form.deliverableDescription.trim(),
        unit: form.unit,
        unitPriceCents: toSmallestUnit(form.unitPrice, profile.currency || 'EUR'),
        taxRate: form.taxRate,
        turnaroundDays: form.turnaroundDays,
        revisionLimit: form.revisionLimit,
        status: 'active'
      });
    }

    setShowAddModal(false);
    setForm({
      name: '',
      category: 'identite_visuelle',
      deliverableDescription: '',
      unit: 'forfait',
      unitPrice: 1200,
      taxRate: 20,
      turnaroundDays: 14,
      revisionLimit: 3
    });
  };

  const handleEditClick = (service: CatalogService) => {
    setEditingService(service);
    setForm({
      name: service.name,
      category: (service.category as ProjectType) || 'identite_visuelle',
      deliverableDescription: service.deliverableDescription,
      unit: service.unit,
      unitPrice: fromSmallestUnit(service.unitPriceCents, profile.currency || 'EUR'),
      taxRate: service.taxRate !== null ? service.taxRate : 20,
      turnaroundDays: service.turnaroundDays,
      revisionLimit: service.revisionLimit
    });
    setShowAddModal(true);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Catalogue de Prestations & Packs</h2>
          <p className="text-xs text-[#8E97AB]">Répertoire de vos tarifs types. À l'ajout dans un projet, le tarif est copié et sanctuarisé.</p>
        </div>

        <button
          onClick={() => {
            setEditingService(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0B0F1A] text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-[#f7c548]/15"
        >
          <Plus size={16} />
          <span>Nouvelle prestation</span>
        </button>
      </div>

      {/* Packs banner */}
      {catalogPacks.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#f7c548]">Packs & Formules Tout-en-un</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogPacks.map(pack => (
              <div key={pack.id} className="p-5 rounded-2xl bg-[#0B0F1A] border border-[#f7c548]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">{pack.name}</h3>
                  <span className="font-mono font-bold text-[#f7c548] text-sm">
                    {formatCurrencySafe(pack.priceCents / 100, profile.currency)}
                  </span>
                </div>
                <p className="text-xs text-[#8E97AB]">{pack.description}</p>
                <div className="text-[11px] text-[#f7c548] font-medium pt-1">
                  Inclut {pack.serviceIds.length} prestations du catalogue
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#121826] border border-[#1E293B] w-full sm:w-80">
          <Search size={16} className="text-[#8E97AB]" />
          <input
            type="text"
            placeholder="Rechercher une prestation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white focus:outline-none text-xs"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1E293B] text-white text-xs focus:outline-none"
        >
          <option value="all">Toutes les catégories</option>
          {Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredServices.map(service => (
          <div key={service.id} className="glass-panel glass-panel-hover p-6 rounded-3xl space-y-4 relative flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#0B0F1A] text-[#f7c548] border border-[#1E293B]">
                  {PROJECT_TYPE_LABELS[service.category as ProjectType] || service.category}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditClick(service)}
                    className="p-1.5 rounded-lg text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title="Modifier tarif catalogue"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => archiveCatalogService(service.id)}
                    className="p-1.5 rounded-lg text-[#8E97AB] hover:text-amber-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Archiver"
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-white text-base leading-snug">{service.name}</h3>
              <p className="text-xs text-[#8E97AB] line-clamp-3 leading-relaxed">{service.deliverableDescription}</p>
            </div>

            <div className="pt-4 border-t border-[#1E293B] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB]">Unité : {CATALOG_UNIT_LABELS[service.unit]}</span>
                <span className="text-[#8E97AB]">Délai : ~{service.turnaroundDays}j</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-[#8E97AB]">TVA {service.taxRate || 20}%</div>
                <div className="text-xl font-extrabold font-mono text-[#f7c548]">
                  {formatCurrencySafe(fromSmallestUnit(service.unitPriceCents, profile.currency || 'EUR'), profile.currency)}
                </div>
              </div>

              {service.priceHistory && service.priceHistory.length > 0 && (
                <div className="text-[10px] text-[#8E97AB] pt-1 flex items-center gap-1">
                  <Clock size={11} className="text-[#f7c548]" />
                  <span>Dernière révision tarifaire le {new Date(service.priceHistory[0].date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121826] border border-[#1E293B] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div>
              <h3 className="font-display font-bold text-lg text-white">
                {editingService ? 'Modifier la prestation au catalogue' : 'Nouvelle prestation au catalogue'}
              </h3>
              <p className="text-xs text-[#8E97AB]">
                {editingService 
                  ? 'La modification n’impactera pas les projets ou devis passés déjà créés.' 
                  : 'Sera immédiatement disponible pour tous vos futurs projets et devis.'}
              </p>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Nom de la prestation *</label>
                <input
                  type="text"
                  placeholder="ex: Conception Charte Graphique & Guidelines"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Catégorie</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as ProjectType })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white"
                  >
                    {Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Unité de facturation</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value as CatalogUnit })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white"
                  >
                    {Object.entries(CATALOG_UNIT_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#8E97AB] font-medium mb-1">Description des livrables inclus *</label>
                <textarea
                  rows={3}
                  placeholder="Livrables précis, déclinaisons, spécifications techniques..."
                  value={form.deliverableDescription}
                  onChange={(e) => setForm({ ...form, deliverableDescription: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white focus:outline-none focus:border-[#f7c548]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Prix de base HT ({profile.currency}) *</label>
                  <input
                    type="number"
                    step="any"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Taux de TVA standard (%)</label>
                  <input
                    type="number"
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Délai estimé (jours)</label>
                  <input
                    type="number"
                    value={form.turnaroundDays}
                    onChange={(e) => setForm({ ...form, turnaroundDays: parseInt(e.target.value, 10) || 14 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#8E97AB] font-medium mb-1">Tours de révision par défaut</label>
                  <input
                    type="number"
                    value={form.revisionLimit}
                    onChange={(e) => setForm({ ...form, revisionLimit: parseInt(e.target.value, 10) || 3 })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#f7c548] text-[#0B0F1A] font-bold hover:bg-[#e5b336] transition-colors"
                >
                  {editingService ? 'Mettre à jour le catalogue' : 'Enregistrer la prestation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
