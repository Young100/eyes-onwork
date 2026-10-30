import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Filter,
  Folder,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project, PROJECT_STEPS } from '../../types';
import { formatCurrencySafe } from '../../utils/pricingEngine';
import { ProjectDetailView } from './ProjectDetailView';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectsViewProps {
  onSelectProject?: (id: string) => void;
  onOpenCreateModal?: () => void;
  searchQuery?: string;
  onOpenClient?: (clientId: string) => void;
  activeProjectId?: string | null;
  onClearActiveProject?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onSelectProject,
  onOpenCreateModal,
  searchQuery: externalSearchQuery = '',
  onOpenClient,
  activeProjectId,
  onClearActiveProject
}) => {
  const { projects = [], clients = [], profile, entitlements } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId || null);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'in_progress' | 'near_completion'>('all');
  const [filterStep, setFilterStep] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const effectiveSearchQuery = (externalSearchQuery || internalSearchQuery).toLowerCase().trim();

  const filteredProjects = projects.filter(p => {
    const client = clients.find(c => c.id === p.clientId);
    const matchesSearch = !effectiveSearchQuery || 
      p.title.toLowerCase().includes(effectiveSearchQuery) ||
      (client && client.name.toLowerCase().includes(effectiveSearchQuery)) ||
      (client && client.company && client.company.toLowerCase().includes(effectiveSearchQuery));

    // Filter tab
    if (activeFilterTab === 'active' && p.currentStep === 'livre') return false;
    if (activeFilterTab === 'in_progress' && (p.currentStep === 'livre' || p.currentStep === 'brief_valide' || p.currentStep === 'demande_recue')) return false;
    if (activeFilterTab === 'near_completion' && p.currentStep !== 'validation_finale' && p.currentStep !== 'revisions' && p.currentStep !== 'maquette_validee') return false;

    const matchesStep = filterStep === 'all' || p.currentStep === filterStep;
    return matchesSearch && matchesStep;
  });

  const handleProjectClick = (projectId: string) => {
    if (onSelectProject) {
      onSelectProject(projectId);
    } else {
      setSelectedProjectId(projectId);
    }
  };

  const handleOpenNew = () => {
    if (onOpenCreateModal) {
      onOpenCreateModal();
    } else {
      setShowCreateModal(true);
    }
  };

  if (selectedProjectId) {
    return (
      <ProjectDetailView
        projectId={selectedProjectId}
        onBack={() => {
          setSelectedProjectId(null);
          if (onClearActiveProject) onClearActiveProject();
        }}
        onOpenClient={onOpenClient}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-fadeIn pb-16">
      {/* 1. View Header with title & New Project button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">
            Projets Créatifs
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Suivi de production, jalons clés et gestion des livrables
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f7c548] hover:bg-[#e5b336] text-[#0f0326] text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20 self-start sm:self-auto"
        >
          <Plus size={16} className="stroke-[2.5]" />
          <span>Nouveau projet</span>
        </button>
      </div>

      {/* 2. Filter Pills & Search Bar (matching inspiration mockup) */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)] overflow-x-auto">
          {[
            { id: 'all', label: 'Tous les projets' },
            { id: 'active', label: 'Actifs' },
            { id: 'in_progress', label: 'En production' },
            { id: 'near_completion', label: 'En validation' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeFilterTab === tab.id
                  ? 'bg-[var(--card-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input & Step Dropdown */}
        <div className="flex items-center gap-2.5 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Rechercher par titre, client..."
              value={internalSearchQuery}
              onChange={(e) => setInternalSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs glass-input placeholder:text-[var(--text-secondary)]/70"
            />
          </div>

          <select
            value={filterStep}
            onChange={(e) => setFilterStep(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs glass-input cursor-pointer"
          >
            <option value="all">Toutes étapes</option>
            {PROJECT_STEPS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-[var(--text-secondary)] space-y-3 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] mx-auto">
              <Folder size={24} />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Aucun projet ne correspond aux critères sélectionnés.</p>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">Modifiez vos filtres ou lancez un nouveau projet pour enrichir votre tableau de production.</p>
            <div className="pt-2">
              <button
                onClick={handleOpenNew}
                className="px-4 py-2 rounded-xl bg-[#f7c548] text-[#0f0326] text-xs font-semibold hover:bg-[#e5b336] transition-colors cursor-pointer"
              >
                Lancer un nouveau projet
              </button>
            </div>
          </div>
        ) : (
          filteredProjects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const stepDef = PROJECT_STEPS.find(s => s.key === project.currentStep);
            const tasks = Array.isArray(project.tasks) ? project.tasks : [];
            const completedTasks = tasks.filter(t => t.completed).length;
            const stepIdx = PROJECT_STEPS.findIndex(s => s.key === project.currentStep);
            const progress = stepIdx >= 0 ? Math.round(((stepIdx + 1) / PROJECT_STEPS.length) * 100) : 40;

            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="glass-panel glass-panel-hover p-5 sm:p-6 rounded-2xl space-y-4 cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] shrink-0">
                      <Folder size={18} />
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30">
                      {stepDef?.shortLabel || stepDef?.label || project.currentStep}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold font-display text-base text-[var(--text-primary)] group-hover:text-[#f7c548] transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5 truncate">
                      {client?.company || client?.name || 'Client studio'}
                    </p>
                  </div>

                  {/* Progress bar (7px height, golden fill) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>Progression</span>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--card-surface-elevated)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#f7c548] rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[11px]">
                    <Calendar size={13} className="text-[#f7c548]" />
                    <span>{project.deadline ? new Date(project.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Sans date'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#f7c548] text-[#0f0326] text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--card-surface)]">
                        {(client?.name || 'CL').slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-[var(--text-primary)] text-xs tabular-nums">
                      {formatCurrencySafe(project.totalTTC || project.budget, profile?.currency || 'EUR')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};
