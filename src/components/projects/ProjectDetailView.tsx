import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  Layers, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Eye, 
  Trash2, 
  Palette, 
  FolderOpen,
  CreditCard,
  Folder,
  MessageCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Project, PROJECT_STEPS, PROJECT_TYPE_LABELS } from '../../types';
import { ProjectMockupsTab } from './tabs/ProjectMockupsTab';
import { ProjectBillingTab } from './tabs/ProjectBillingTab';
import { ProjectFilesTab } from './tabs/ProjectFilesTab';
import { TimeTrackingModal } from '../time/TimeTrackingModal';
import { getWhatsAppShareUrl } from '../../utils/whatsappUtils';
import { formatCurrencySafe } from '../../utils/formatUtils';

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
  onOpenClient?: (clientId: string) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ projectId, onBack, onOpenClient }) => {
  const { 
    getProjectById, 
    getClientById, 
    updateProjectStep, 
    addTask, 
    toggleTask, 
    deleteTask, 
    addActivity, 
    openClientPortal,
    profile,
    deleteProject,
    archiveProject,
    canDeleteProject
  } = useApp();

  const project = getProjectById(projectId);
  const client = project ? getClientById(project.clientId) : undefined;

  const [activeTab, setActiveTab] = useState<'brief' | 'tasks' | 'mockups' | 'files' | 'billing' | 'activity'>('brief');
  const [projectArchiveProposal, setProjectArchiveProposal] = useState<{
    project: Project;
    reason: string;
    quoteCount: number;
    invoiceCount: number;
  } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogDesc, setNewLogDesc] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);

  if (!project) {
    return (
      <div className="glass-panel p-12 text-center text-[#8E97AB] space-y-4">
        <p>Projet introuvable ou supprimé.</p>
        <button onClick={onBack} className="text-xs text-[#f7c548] hover:underline cursor-pointer">
          Retour à la liste des projets
        </button>
      </div>
    );
  }

  // Format currency (no monospace)
  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile.currency || 'EUR', 0);
  };

  const currentStepDef = PROJECT_STEPS.find(s => s.key === project.currentStep) || PROJECT_STEPS[0];
  const stepProgress = Math.round((currentStepDef.order / 10) * 100);

  // Copy client share link
  const handleCopyClientLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?clientToken=${project.clientShareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Add task handler
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask(project.id, newTaskTitle.trim(), newTaskDueDate || undefined);
    setNewTaskTitle('');
    setNewTaskDueDate('');
  };

  // Add activity log handler
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTitle.trim()) return;
    addActivity(project.id, {
      title: newLogTitle.trim(),
      description: newLogDesc.trim() || undefined,
      type: 'comment',
      authorName: profile.name
    });
    setNewLogTitle('');
    setNewLogDesc('');
  };

  const isRevisionLimitReached = project.revisionsUsed >= project.revisionLimit;

  return (
    <div className="space-y-6 animate-fadeIn pb-20 lg:pb-12">
      {/* Top Bar: Back navigation & Client Portal trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-[#8E97AB] hover:text-white transition-colors cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.5]" />
          <span>Retour aux projets</span>
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time Tracking & Margins */}
          <button
            onClick={() => setIsTimeModalOpen(true)}
            className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            title="Chronomètre et calcul de marge du projet"
          >
            <Clock className="w-3.5 h-3.5 text-[#f7c548]" />
            <span className="hidden sm:inline">Temps & Rentabilité</span>
          </button>

          {/* WhatsApp Quick Share */}
          {(client?.whatsapp || client?.phone) && (
            <a
              href={getWhatsAppShareUrl(
                client.whatsapp || client.phone,
                `Bonjour ${client.name},\n\nVoici le lien sécurisé pour suivre votre projet "${project.title}" et consulter vos maquettes et devis :\n${window.location.origin}/?token=${project.clientShareToken}\n\nBien cordialement,\n${profile.name}`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#5FB59A] border-[#5FB59A]/30 hover:border-[#5FB59A]/60 cursor-pointer"
              title="Envoyer le lien d'accès par WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#5FB59A]" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}

          {/* Copy client link */}
          <button
            onClick={handleCopyClientLink}
            className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#5FB59A]" /> : <Copy className="w-3.5 h-3.5 text-[#f7c548]" />}
            <span>{copiedLink ? 'Lien copié !' : 'Copier lien client'}</span>
          </button>

          {/* Créer un devis */}
          <button
            onClick={() => setActiveTab('billing')}
            className="glass-btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#f7c548] border-[#f7c548]/30 hover:border-[#f7c548]/60 cursor-pointer"
            title="Créer ou consulter les devis et factures du projet"
          >
            <FileText className="w-3.5 h-3.5 text-[#f7c548]" />
            <span>Créer un devis</span>
          </button>

          {/* Prévisualiser comme le client */}
          <button
            onClick={() => openClientPortal(project.clientShareToken, true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all shadow-md shadow-[#f7c548]/20 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Prévisualiser comme le client</span>
          </button>
        </div>
      </div>

      {/* Hero Project Card */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs text-[#8E97AB]">
              <span className="font-bold text-[#f7c548] font-display">
                {client ? client.company : 'Client'}
              </span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span>{PROJECT_TYPE_LABELS[project.type]}</span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span>Échéance : {new Date(project.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
              {project.title}
            </h1>

            {/* Revision Counter with Limit warning */}
            <div className="pt-1 flex items-center gap-3 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold tabular-nums ${
                isRevisionLimitReached 
                  ? 'bg-[#D9695F]/20 text-[#D9695F] border border-[#D9695F]/40' 
                  : 'bg-white/10 text-white/90 border border-white/10'
              }`}>
                {isRevisionLimitReached ? <AlertTriangle className="w-3.5 h-3.5 text-[#D9695F]" /> : <Clock className="w-3.5 h-3.5 text-[#f7c548]" />}
                <span>Révisions : {project.revisionsUsed} / {project.revisionLimit} incluses</span>
              </div>

              {isRevisionLimitReached && (
                <span className="text-xs text-[#D9695F] font-semibold">
                  Limite de révisions atteinte. Prévoir avenant ou facturation complémentaire.
                </span>
              )}
            </div>
          </div>

          {/* Financial summary card */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 shrink-0 w-full sm:w-auto min-w-[260px] space-y-3">
            <div className="flex items-center justify-between text-xs text-[#8E97AB]">
              <span>Budget du projet</span>
              <span className="text-white font-bold text-base tabular-nums font-display">
                {formatCurrency(project.budget)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#8E97AB]">
              <span>Acompte initial ({project.depositAmount > 0 ? Math.round((project.depositAmount / project.budget) * 100) : 0}%)</span>
              <span className="text-[#f7c548] font-semibold tabular-nums">
                {formatCurrency(project.depositAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#8E97AB] pt-2 border-t border-white/10">
              <span>Solde restant</span>
              <span className="text-[#f7c548] font-bold tabular-nums font-display">
                {formatCurrency(Math.max(0, project.budget - project.paidAmount))}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive 10-step Stepper */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8E97AB]">Étape actuelle :</span>
              <span className="font-bold text-[#f7c548] font-display">{currentStepDef.label}</span>
              <span className="text-[#8E97AB] hidden sm:inline">— {currentStepDef.description}</span>
            </div>
            <span className="text-xs text-[#5FB59A] tabular-nums font-bold">
              Progression : {stepProgress}%
            </span>
          </div>

          {/* Stepper buttons (1 to 10) */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {PROJECT_STEPS.map((s) => {
              const isPast = s.order < currentStepDef.order;
              const isCurrent = s.order === currentStepDef.order;

              return (
                <button
                  key={s.key}
                  onClick={() => updateProjectStep(project.id, s.key)}
                  title={`Passer à l'étape : ${s.label}`}
                  className={`
                    flex flex-col items-center p-2 rounded-xl text-center transition-all cursor-pointer border
                    ${isCurrent 
                      ? 'bg-[#f7c548]/20 border-[#f7c548] text-white shadow-md shadow-[#f7c548]/15' 
                      : isPast 
                        ? 'bg-[#5FB59A]/15 border-[#5FB59A]/30 text-[#5FB59A] hover:bg-[#5FB59A]/25' 
                        : 'bg-white/[0.03] border-white/10 text-[#8E97AB] hover:bg-white/[0.08] hover:text-white'}
                  `}
                >
                  <span className="text-[11px] font-bold font-display">
                    {s.order}
                  </span>
                  <span className="text-[10px] font-medium truncate w-full mt-0.5">
                    {s.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'brief', label: 'Brief créatif', icon: FileText },
          { id: 'tasks', label: `Checklist (${(project.tasks || []).filter(t => t.completed).length}/${(project.tasks || []).length})`, icon: CheckCircle2 },
          { id: 'mockups', label: `Maquettes (${(project.mockupRounds || []).length})`, icon: Layers },
          { id: 'files', label: `Fichiers (${(project.files || []).length})`, icon: Folder },
          { id: 'billing', label: 'Prestations & Facturation', icon: CreditCard },
          { id: 'activity', label: `Journal (${(project.activity || []).length})`, icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer
                ${isActive 
                  ? 'bg-white/15 text-white border-b-2 border-[#f7c548]' 
                  : 'text-[#8E97AB] hover:text-white hover:bg-white/5'}
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#f7c548]' : 'text-current'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Brief Créatif */}
      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Objectives & Audience */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E97AB] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f7c548]" />
                <span>Objectifs & Cible du projet</span>
              </h3>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-white block mb-1">Objectifs stratégiques :</span>
                  <p className="text-[#8E97AB]">{project.brief.objectives || 'Non renseignés'}</p>
                </div>

                <div>
                  <span className="font-semibold text-white block mb-1">Public cible visé :</span>
                  <p className="text-[#8E97AB]">{project.brief.targetAudience || 'Non renseigné'}</p>
                </div>
              </div>
            </div>

            {/* Desired Style & Typography References */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E97AB] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#f7c548]" />
                <span>Direction artistique & Références</span>
              </h3>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-white block mb-1">Style graphique souhaité :</span>
                  <p className="text-[#8E97AB]">{project.brief.desiredStyle || 'Non renseigné'}</p>
                </div>

                <div>
                  <span className="font-semibold text-white block mb-1">Typographie & Références visuelles :</span>
                  <p className="text-[#8E97AB]">{project.brief.typographyAndReferences || 'Non renseignées'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {/* Color Palette */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E97AB]">
                Palette chromatique ({(project.brief?.colors || []).length})
              </h3>

              <div className="space-y-2">
                {(project.brief?.colors || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <span 
                      className="w-7 h-7 rounded-lg shadow-inner border border-white/20 shrink-0" 
                      style={{ backgroundColor: c.hex }} 
                    />
                    <div className="text-xs min-w-0">
                      <span className="text-white font-semibold block truncate font-display">{c.name}</span>
                      <span className="text-[#8E97AB] text-[11px] uppercase font-medium">{c.hex}</span>
                    </div>
                  </div>
                ))}
                {(project.brief?.colors || []).length === 0 && (
                  <p className="text-xs text-[#8E97AB] py-1">Aucune couleur définie</p>
                )}
              </div>
            </div>

            {/* Expected Formats */}
            <div className="glass-panel p-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E97AB]">
                Formats attendus
              </h3>
              <ul className="space-y-1.5 text-xs text-[#8E97AB]">
                {(project.brief?.expectedFormats || []).map((fmt, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f7c548] mt-1.5 shrink-0" />
                    <span>{fmt}</span>
                  </li>
                ))}
                {(project.brief?.expectedFormats || []).length === 0 && (
                  <li className="text-[#8E97AB]">Non spécifiés</li>
                )}
              </ul>
            </div>

            {/* Assets provided */}
            <div className="glass-panel p-6 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E97AB]">
                Contenus fournis par le client
              </h3>
              <p className="text-xs text-[#8E97AB] leading-relaxed">
                {project.brief.clientProvidedAssets || 'Aucun élément fourni pour le moment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Checklist de tâches */}
      {activeTab === 'tasks' && (
        <div className="glass-panel p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Checklist des livrables & jalons
              </h3>
              <p className="text-xs text-[#8E97AB] mt-0.5">
                Cochez les tâches au fur et à mesure de votre progression.
              </p>
            </div>

            <span className="text-xs font-bold text-[#5FB59A] tabular-nums">
              {(project.tasks || []).filter(t => t.completed).length} sur {(project.tasks || []).length} terminées
            </span>
          </div>

          {/* New Task Form */}
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Ajouter une tâche (ex: Préparer le tracé de découpe, export SVG...)"
              className="flex-1 px-3.5 py-2 text-xs glass-input"
            />
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="px-3 py-2 text-xs glass-input sm:w-44"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors whitespace-nowrap cursor-pointer"
            >
              Ajouter
            </button>
          </form>

          {/* Tasks List */}
          <div className="space-y-2">
            {(project.tasks || []).map((task) => (
              <div
                key={task.id}
                className={`
                  p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors
                  ${task.completed ? 'bg-white/[0.02] border-white/5 text-[#8E97AB]' : 'bg-white/[0.04] border-white/10 text-white'}
                `}
              >
                <div 
                  onClick={() => toggleTask(project.id, task.id)}
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                      task.completed 
                        ? 'bg-[#5FB59A] text-[#0B0F1A]' 
                        : 'border border-white/30 hover:border-[#f7c548]'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </button>
                  <span className={`text-xs ${task.completed ? 'line-through text-[#8E97AB]' : 'text-white font-medium'}`}>
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {task.dueDate && (
                    <span className="text-[11px] text-[#8E97AB] tabular-nums font-medium">
                      Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  <button
                    onClick={() => deleteTask(project.id, task.id)}
                    className="p-1 text-[#8E97AB] hover:text-[#D9695F] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {(project.tasks || []).length === 0 && (
              <p className="text-center py-6 text-xs text-[#8E97AB]">
                Aucune tâche enregistrée.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Journal d'activité */}
      {activeTab === 'activity' && (
        <div className="glass-panel p-6 space-y-6">
          <div className="pb-3 border-b border-white/10">
            <h3 className="text-base font-bold text-white font-display">
              Journal d'activité daté
            </h3>
            <p className="text-xs text-[#8E97AB] mt-0.5">
              Historique immuable des échanges, approbations et jalons franchis.
            </p>
          </div>

          {/* Quick note addition */}
          <form onSubmit={handleAddLog} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="text-xs font-bold text-[#f7c548] font-display">
              Consigner un échange ou une note
            </div>
            <input
              type="text"
              required
              value={newLogTitle}
              onChange={(e) => setNewLogTitle(e.target.value)}
              placeholder="Titre de l'événement (ex: Appel téléphonique de cadrage, validation palette...)"
              className="w-full px-3.5 py-2 text-xs glass-input"
            />
            <textarea
              rows={2}
              value={newLogDesc}
              onChange={(e) => setNewLogDesc(e.target.value)}
              placeholder="Détails complémentaires (optionnel)..."
              className="w-full px-3.5 py-2 text-xs glass-input"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
            >
              Enregistrer l'événement
            </button>
          </form>

          {/* Activity Timeline */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/15">
            {(project.activity || []).map((act) => (
              <div key={act.id} className="relative group">
                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-[#f7c548] ring-4 ring-[#0B0F1A]" />
                
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white font-display">
                      {act.title}
                    </h4>
                    <span className="text-[11px] text-[#8E97AB] tabular-nums">
                      {new Date(act.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {act.description && (
                    <p className="text-xs text-[#8E97AB] leading-relaxed">
                      {act.description}
                    </p>
                  )}

                  {act.authorName && (
                    <span className="text-[11px] text-[#f7c548] block pt-1 font-medium">
                      Par {act.authorName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Mockups & Cycles de validation */}
      {activeTab === 'mockups' && (
        <ProjectMockupsTab 
          project={project} 
          onOpenClientPortal={() => openClientPortal(project.clientShareToken, true)} 
        />
      )}

      {/* Tab 4: Fichiers & Livrables */}
      {activeTab === 'files' && (
        <ProjectFilesTab project={project} />
      )}

      {/* Tab 5: Devis & Facturation */}
      {activeTab === 'billing' && (
        <ProjectBillingTab project={project} />
      )}

      {/* Time Tracking Modal */}
      {isTimeModalOpen && (
        <TimeTrackingModal
          project={project}
          isOpen={true}
          onClose={() => setIsTimeModalOpen(false)}
        />
      )}
    </div>
  );
};
