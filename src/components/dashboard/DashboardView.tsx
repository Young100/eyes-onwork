import React, { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Clock, 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight, 
  AlertCircle, 
  Plus, 
  UserPlus, 
  FileText, 
  ChevronRight,
  Sparkles,
  Calendar,
  Trash2,
  X,
  Check,
  Folder,
  CheckSquare,
  Users,
  ExternalLink,
  Smartphone,
  Globe,
  Layers,
  Palette,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PROJECT_STEPS, PROJECT_TYPE_LABELS, Project } from '../../types';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { CustomSelect } from '../common/CustomSelect';

interface DashboardViewProps {
  onSelectProject: (id: string) => void;
  onOpenNewProject: () => void;
  onOpenNewClient: () => void;
  onNavigateToProjects: () => void;
  onNavigateToClients: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectProject,
  onOpenNewProject,
  onOpenNewClient,
  onNavigateToProjects,
  onNavigateToClients
}) => {
  const { 
    projects = [], 
    clients = [], 
    profile, 
    appointments = [],
    hasDemoData,
    deleteDemoData,
    theme
  } = useApp();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [activeChartBar, setActiveChartBar] = useState<number | null>(4); // Default to last bar

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  // Metrics computation
  const activeProjects = safeProjects.filter(p => p && p.currentStep !== 'livre');
  const deliveredProjects = safeProjects.filter(p => p && p.currentStep === 'livre');
  const pendingBriefProjects = safeProjects.filter(p => p && (p.currentStep === 'brief_valide' || p.currentStep === 'devis_accepte' || p.currentStep === 'demande_recue'));

  // Calculate days remaining with full null safety
  const getDaysRemaining = (deadlineStr?: string): number => {
    if (!deadlineStr) return 0;
    const target = new Date(deadlineStr);
    if (isNaN(target.getTime())) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Total collected revenues
  const totalRevenues = safeProjects.reduce((acc, p) => {
    if (!p) return acc;
    return acc + (Number(p.paidAmount) || 0);
  }, 0);

  // Total tasks count and completion
  const { totalTasks, completedTasks, averageProgress } = useMemo(() => {
    let tCount = 0;
    let cCount = 0;
    let progressSum = 0;

    safeProjects.forEach(p => {
      const tasks = Array.isArray(p.tasks) ? p.tasks : [];
      tCount += tasks.length;
      cCount += tasks.filter(t => t.completed).length;

      // Project progress percentage based on step
      const stepIdx = PROJECT_STEPS.findIndex(s => s.key === p.currentStep);
      const stepPct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / PROJECT_STEPS.length) * 100) : 25;
      progressSum += stepPct;
    });

    const avg = safeProjects.length > 0 ? Math.round(progressSum / safeProjects.length) : 68;
    return {
      totalTasks: tCount || 58,
      completedTasks: cCount || 42,
      averageProgress: avg
    };
  }, [safeProjects]);

  // Format currency
  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile?.currency || 'EUR', 0);
  };

  // Format deadline date
  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return 'Sans date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isWorkspaceEmpty = safeProjects.length === 0 && safeClients.length === 0;

  // Bar chart sample data aligned with inspiration mockup
  const barChartData = [
    { label: '1er mai', height: 35, pct: 25, tasks: '12 tâches' },
    { label: '8 mai', height: 45, pct: 32, tasks: '16 tâches' },
    { label: '15 mai', height: 50, pct: 38, tasks: '20 tâches' },
    { label: '22 mai', height: 62, pct: 48, tasks: '24 tâches' },
    { label: '29 mai', height: 85, pct: 72, tasks: '31 tâches' }
  ];

  // Pick category icon for project cards
  const getProjectIcon = (p: Project, index: number) => {
    if (p.type === 'web_design') {
      return <Smartphone className="w-5 h-5 text-[#f7c548]" />;
    }
    if (p.type === 'identite_visuelle') {
      return <Palette className="w-5 h-5 text-[#f7c548]" />;
    }
    if (index % 3 === 0) return <Layers className="w-5 h-5 text-[#f7c548]" />;
    if (index % 3 === 1) return <Globe className="w-5 h-5 text-[#f7c548]" />;
    return <Briefcase className="w-5 h-5 text-[#f7c548]" />;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-16 lg:pb-8">
      {/* 1. Header Greeting & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            {profile?.name ? `Bonjour, ${profile.name.split(' ')[0]} 👋` : 'Bonjour 👋'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Voici ce qui se passe sur vos projets créatifs aujourd'hui.
          </p>
        </div>

        {!isWorkspaceEmpty && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Period Filter Dropdown */}
            <div className="w-36">
              <CustomSelect
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                options={[
                  { value: 'this_month', label: 'Ce mois' },
                  { value: 'this_quarter', label: 'Ce trimestre' },
                  { value: 'this_year', label: 'Cette année' },
                  { value: 'all_time', label: 'Tout le portfolio' }
                ]}
              />
            </div>

            {/* Nouveau projet golden button */}
            <button
              onClick={onOpenNewProject}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#f7c548]/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nouveau projet</span>
            </button>

            {/* Nouveau client button */}
            <button
              onClick={onOpenNewClient}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--card-surface)] hover:bg-[var(--card-surface-elevated)] border border-[var(--border-color)] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#f7c548] stroke-[2]" />
              <span className="hidden sm:inline">Client</span>
            </button>
          </div>
        )}
      </div>

      {/* Demo Data Banner if active */}
      {hasDemoData && (
        <div className="p-3.5 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex items-center gap-2.5 text-[#f7c548]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Vous explorez actuellement des données d’exemple (projets et clients de démonstration).</span>
          </div>
          
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-primary)]">Confirmer la suppression ?</span>
              <button
                onClick={() => {
                  deleteDemoData();
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#d9534f] text-white hover:bg-[#c9302c] font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Oui, effacer</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded-lg bg-[var(--card-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-[#d9534f]/15 hover:bg-[#d9534f]/25 text-[#d9534f] border border-[#d9534f]/30 font-medium transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer les données de démo</span>
            </button>
          )}
        </div>
      )}

      {/* Pristine Empty Workspace Zero-State */}
      {isWorkspaceEmpty && (
        <div className="glass-panel p-8 sm:p-12 text-center space-y-4 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] mx-auto shadow-md">
            <Briefcase className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-xl font-bold text-[var(--text-primary)] font-display">
              Bienvenue dans votre nouvel espace
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Votre espace est prêt à accueillir votre activité de freelance. Ajoutez votre premier client ou créez un projet pour débuter.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenNewProject}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0f0326] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#f7c548]/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Créer un premier projet</span>
            </button>
            <button
              onClick={onOpenNewClient}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--card-surface-elevated)] hover:bg-[var(--card-surface-alt)] border border-[var(--border-color)] transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#f7c548]" />
              <span>Ajouter un client</span>
            </button>
          </div>
        </div>
      )}

      {!isWorkspaceEmpty && (
        <>
          {/* 2. Top KPI Cards (4 in a row) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* KPI 1: Total Projects */}
            <div className="glass-panel p-4 sm:p-5 flex flex-col justify-between space-y-3 glass-panel-hover">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548]">
                  <Folder className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-[#f7c548] flex items-center gap-0.5">
                  ↑ 20%
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-primary)] tabular-nums">
                  {safeProjects.length || 24}
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  Total Projets
                </p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]/80">
                vs mois dernier
              </p>
            </div>

            {/* KPI 2: Tasks Completed */}
            <div className="glass-panel p-4 sm:p-5 flex flex-col justify-between space-y-3 glass-panel-hover">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548]">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-[#f7c548] flex items-center gap-0.5">
                  ↑ 14%
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-primary)] tabular-nums">
                  {completedTasks}
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  Tâches complétées
                </p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]/80">
                {totalTasks} tâches enregistrées
              </p>
            </div>

            {/* KPI 3: Clients Actifs */}
            <div className="glass-panel p-4 sm:p-5 flex flex-col justify-between space-y-3 glass-panel-hover">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548]">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-[#f7c548] flex items-center gap-0.5">
                  ↑ 9%
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-primary)] tabular-nums">
                  {safeClients.length || 12}
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  Clients actifs
                </p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]/80">
                Partenaires & comptes
              </p>
            </div>

            {/* KPI 4: CA / Heures Encaissées */}
            <div className="glass-panel p-4 sm:p-5 flex flex-col justify-between space-y-3 glass-panel-hover">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-[#f7c548] flex items-center gap-0.5">
                  ↑ 18%
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-primary)] tabular-nums truncate block">
                  {totalRevenues > 0 ? formatCurrency(totalRevenues) : '356h'}
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  {totalRevenues > 0 ? 'CA Encaissé' : 'Heures suivies'}
                </p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]/80">
                Performance globale
              </p>
            </div>
          </div>

          {/* 3. Middle Section: Project Progress Overview (Bar Chart) + Overall Portfolio Progress (Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2/3: Bar Chart "Project Progress Overview" */}
            <div className="lg:col-span-2 glass-panel p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-display text-[var(--text-primary)]">
                    Aperçu de progression des projets
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Volume d'activité et jalons franchis sur la période
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                  Ce mois ▾
                </span>
              </div>

              {/* Chart Visual with golden vertical bars */}
              <div className="pt-4 pb-2">
                <div className="flex items-end justify-between h-48 sm:h-52 gap-3 sm:gap-6 px-2 sm:px-6 relative">
                  {/* Background grid lines */}
                  <div className="absolute inset-x-0 top-0 border-b border-[var(--border-subtle)] border-dashed text-[10px] text-[var(--text-secondary)]">
                    <span className="absolute -top-3.5 left-0">100%</span>
                  </div>
                  <div className="absolute inset-x-0 top-1/4 border-b border-[var(--border-subtle)] border-dashed text-[10px] text-[var(--text-secondary)]">
                    <span className="absolute -top-3.5 left-0">75%</span>
                  </div>
                  <div className="absolute inset-x-0 top-2/4 border-b border-[var(--border-subtle)] border-dashed text-[10px] text-[var(--text-secondary)]">
                    <span className="absolute -top-3.5 left-0">50%</span>
                  </div>
                  <div className="absolute inset-x-0 top-3/4 border-b border-[var(--border-subtle)] border-dashed text-[10px] text-[var(--text-secondary)]">
                    <span className="absolute -top-3.5 left-0">25%</span>
                  </div>

                  {/* Bars */}
                  {barChartData.map((bar, index) => {
                    const isActive = activeChartBar === index;
                    return (
                      <div 
                        key={bar.label} 
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer z-10"
                        onClick={() => setActiveChartBar(index)}
                      >
                        {/* Hover / Active Tooltip Badge */}
                        {isActive && (
                          <div className="mb-2 px-2 py-1 rounded-md bg-[#0f0326] text-[#f7c548] border border-[#f7c548]/40 text-[10px] font-bold shadow-lg animate-fadeIn whitespace-nowrap">
                            {bar.label} • {bar.pct}%
                          </div>
                        )}

                        {/* Bar Body */}
                        <div 
                          className={`w-full max-w-[42px] rounded-t-lg transition-all duration-300 relative ${
                            isActive 
                              ? 'bg-[#f7c548] shadow-lg shadow-[#f7c548]/30 scale-x-105' 
                              : 'bg-[#f7c548]/80 hover:bg-[#f7c548]'
                          }`}
                          style={{ height: `${bar.height}%` }}
                        />

                        {/* X-Axis Label */}
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium mt-2">
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart Legend / Summary note */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f7c548]" />
                  <span>Jalons créatifs complétés</span>
                </div>
                <span className="font-medium text-[var(--text-primary)]">
                  Objectif mensuel à 88%
                </span>
              </div>
            </div>

            {/* Right 1/3: Circular Gauge "Overall Portfolio Progress" */}
            <div className="glass-panel p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <h2 className="text-base sm:text-lg font-bold font-display text-[var(--text-primary)]">
                  Progression globale
                </h2>
                <span className="text-xs text-[var(--text-secondary)]">
                  Portfolio
                </span>
              </div>

              {/* Circular Ring Gauge */}
              <div className="flex flex-col items-center justify-center py-2 relative">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 120 120">
                  {/* Track ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-[var(--border-color)]"
                  />
                  {/* Golden Fill ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="#f7c548"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - averageProgress / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold font-display text-[var(--text-primary)] tabular-nums">
                    {averageProgress}%
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    Complété
                  </span>
                </div>
              </div>

              {/* Status Breakdown List */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)] text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#f7c548]" />
                    <span className="text-[var(--text-secondary)]">Complétés & livrés</span>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                    {deliveredProjects.length} projets
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#9e7ce3]" />
                    <span className="text-[var(--text-secondary)]">En production</span>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                    {activeProjects.length} projets
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" />
                    <span className="text-[var(--text-secondary)]">Non démarrés / Devis</span>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                    {pendingBriefProjects.length} projets
                  </span>
                </div>
              </div>

              {/* Status info note */}
              <div className="p-3 rounded-xl bg-[var(--card-surface-elevated)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] leading-tight">
                💡 <strong className="text-[var(--text-primary)]">En bonne voie</strong> pour respecter l'ensemble des échéances trimestrielles du studio.
              </div>
            </div>
          </div>

          {/* 4. Bottom Section: Active Projects Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-display text-[var(--text-primary)]">
                  Projets actifs
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Dossiers créatifs en cours de réalisation et jalons clés
                </p>
              </div>

              <button
                onClick={onNavigateToProjects}
                className="text-xs font-semibold text-[#f7c548] hover:text-[#e5b336] flex items-center gap-1.5 transition-colors cursor-pointer group"
              >
                <span>Voir tous les projets</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Project Cards (3 to 4 cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeProjects.slice(0, 3).map((project, idx) => {
                const daysRemaining = getDaysRemaining(project.deadline);
                const stepIdx = PROJECT_STEPS.findIndex(s => s.key === project.currentStep);
                const progressPct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / PROJECT_STEPS.length) * 100) : 60;
                const projectClient = safeClients.find(c => c.id === project.clientId);
                const clientDisplayName = projectClient?.name || projectClient?.company || 'Client studio';

                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="glass-panel p-5 rounded-2xl glass-panel-hover flex flex-col justify-between space-y-4 cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 flex items-center justify-center shrink-0">
                          {getProjectIcon(project, idx)}
                        </div>

                        {/* Status Badge */}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30">
                          {PROJECT_STEPS.find(s => s.key === project.currentStep)?.shortLabel || 'En cours'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold font-display text-sm text-[var(--text-primary)] group-hover:text-[#f7c548] transition-colors truncate">
                          {project.title}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                          {clientDisplayName}
                        </p>
                      </div>

                      {/* Progress Bar (Strict 7px height with Golden fill) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--text-secondary)] font-medium">Progression</span>
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--card-surface-elevated)] overflow-hidden">
                          <div 
                            className="h-full bg-[#f7c548] rounded-full transition-all duration-500" 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Deadline & Avatars */}
                    <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-[#f7c548]" />
                        <span>{formatDeadline(project.deadline)}</span>
                      </div>

                      {/* Avatar preview */}
                      <div className="flex items-center -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-[#f7c548] text-[#0f0326] text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--card-surface)]">
                          {(clientDisplayName || 'CL').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[var(--card-surface-elevated)] text-[var(--text-secondary)] text-[9px] font-semibold flex items-center justify-center ring-2 ring-[var(--card-surface)]">
                          +2
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
