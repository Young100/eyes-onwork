import React, { useState } from 'react';
import { 
  Plus, 
  Layers, 
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  X, 
  Upload, 
  FileText,
  DollarSign,
  MapPin,
  Check
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Project, MockupRound } from '../../../types';

interface ProjectMockupsTabProps {
  project: Project;
  onOpenClientPortal: () => void;
}

export const ProjectMockupsTab: React.FC<ProjectMockupsTabProps> = ({ project, onOpenClientPortal }) => {
  const { 
    addMockupRound, 
    addMockupVersion, 
    addPaidRevision, 
    profile 
  } = useApp();

  const [isAddRoundOpen, setIsAddRoundOpen] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState('');

  const [activeUploadRoundId, setActiveUploadRoundId] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState(project.coverImageUrl || '');

  const [isPaidRevModalOpen, setIsPaidRevModalOpen] = useState(false);
  const [paidRevCost, setPaidRevCost] = useState('180');

  const isLimitReached = project.revisionsUsed >= project.revisionLimit;

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoundTitle.trim()) return;
    addMockupRound(project.id, newRoundTitle.trim());
    setNewRoundTitle('');
    setIsAddRoundOpen(false);
  };

  const handleUploadVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUploadRoundId || !uploadTitle.trim()) return;

    addMockupVersion(project.id, activeUploadRoundId, {
      title: uploadTitle.trim(),
      description: uploadDesc.trim() || undefined,
      fileName: uploadFileName.trim() || 'maquette_creation.jpg',
      fileType: uploadFileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
      fileSize: '3.6 Mo',
      fileUrl: uploadFileUrl || project.coverImageUrl || ''
    });

    setActiveUploadRoundId(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadFileName('');
  };

  const handleAddPaidRevision = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(paidRevCost) || 150;
    addPaidRevision(project.id, cost);
    setIsPaidRevModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Revision Counter & Controls */}
      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Maquettes & Cycles de validation
            </h3>
            <p className="text-xs text-[#8E97AB] mt-0.5">
              Organisez les déclinaisons graphiques par tours et suivez les retours annotés du client.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsAddRoundOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nouveau tour de validation</span>
            </button>

            <button
              onClick={onOpenClientPortal}
              className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#f7c548]" />
              <span>Aperçu client annotable</span>
            </button>
          </div>
        </div>

        {/* Revision Counter Box */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLimitReached 
            ? 'bg-[#D9695F]/15 border-[#D9695F]/35' 
            : 'bg-white/[0.03] border-white/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isLimitReached ? 'bg-[#D9695F]/20 text-[#D9695F]' : 'bg-[#f7c548]/15 text-[#f7c548]'
            }`}>
              {isLimitReached ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-white font-display flex items-center gap-2">
                <span>Compteur de révisions : {project.revisionsUsed} / {project.revisionLimit} utilisées</span>
                {project.paidRevisionsAdded > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#f7c548]/20 text-[#f7c548] font-medium">
                    +{project.paidRevisionsAdded} révision{project.paidRevisionsAdded > 1 ? 's' : ''} facturée{project.paidRevisionsAdded > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8E97AB] mt-0.5">
                {isLimitReached 
                  ? 'La limite contractuelle est atteinte. Tout nouveau cycle fera l\'objet d\'une facturation complémentaire.' 
                  : `Il reste ${project.revisionLimit - project.revisionsUsed} cycle(s) de retouches inclus dans le devis initial.`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsPaidRevModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            + Facturer une révision payante
          </button>
        </div>
      </div>

      {/* Rounds List */}
      <div className="space-y-6">
        {(project.mockupRounds || []).map((round) => {
          const isValidated = round.status === 'validated';
          const isChanges = round.status === 'changes_requested';
          const versions = round.versions || [];

          return (
            <div key={round.id} className="glass-panel p-5 sm:p-6 space-y-5">
              {/* Round Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs text-white font-display">
                    T{round.roundNumber}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">
                      {round.title}
                    </h4>
                    <span className="text-[11px] text-[#8E97AB]">
                      Créé le {new Date(round.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {round.validatedAt && ` · Validé le ${new Date(round.validatedAt).toLocaleDateString('fr-FR')}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    isValidated 
                      ? 'bg-[#5FB59A]/15 text-[#5FB59A] border border-[#5FB59A]/30' 
                      : isChanges 
                        ? 'bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30' 
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  }`}>
                    {isValidated ? 'Validé par le client' : isChanges ? 'Modifications demandées' : 'En attente du client'}
                  </span>

                  <button
                    onClick={() => setActiveUploadRoundId(round.id)}
                    className="glass-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#f7c548]" />
                    <span>Ajouter version</span>
                  </button>
                </div>
              </div>

              {/* Feedback banner if changes requested */}
              {round.feedbackMessage && (
                <div className="p-3.5 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-xs space-y-1">
                  <div className="font-bold text-[#f7c548] font-display flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Retour du client pour ce tour :</span>
                  </div>
                  <p className="text-white/90 leading-relaxed italic pl-5">
                    "{round.feedbackMessage}"
                  </p>
                </div>
              )}

              {/* Versions List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {versions.map((ver) => {
                  const pinComments = ver.pinComments || [];
                  return (
                    <div key={ver.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f7c548]/20 text-[#f7c548] uppercase">
                            V{ver.versionNumber}
                          </span>
                          <h5 className="text-xs font-bold text-white font-display mt-1">
                            {ver.title}
                          </h5>
                        </div>
                        <span className="text-[10px] text-[#8E97AB]">{ver.fileSize}</span>
                      </div>

                      {/* Preview thumbnail */}
                      {ver.fileUrl && (
                        <div className="rounded-xl overflow-hidden aspect-video bg-black/40 border border-white/10 relative group">
                          <img 
                            src={ver.fileUrl} 
                            alt={ver.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <button
                            onClick={onOpenClientPortal}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-semibold cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-[#f7c548]" />
                            <span>Ouvrir l'annotateur</span>
                          </button>
                        </div>
                      )}

                      {/* Pinned Comments Counter */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-[#8E97AB]">
                        <span className="flex items-center gap-1 font-medium text-white/80">
                          <MapPin className="w-3.5 h-3.5 text-[#f7c548]" />
                          {pinComments.length} point{pinComments.length > 1 ? 's' : ''} annoté{pinComments.length > 1 ? 's' : ''}
                        </span>
                        <span>{new Date(ver.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>

                      {/* List of pin comments */}
                      {pinComments.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {pinComments.map((pin) => (
                            <div key={pin.id} className="p-2 rounded-lg bg-white/[0.04] text-[11px] space-y-0.5 border border-white/5">
                              <div className="flex items-center gap-1.5 text-[#f7c548] font-bold">
                                <span className="w-4 h-4 rounded-full bg-[#f7c548] text-[#0B0F1A] text-[9px] flex items-center justify-center font-bold">
                                  {pin.pinNumber}
                                </span>
                                <span>{pin.author}</span>
                              </div>
                              <p className="text-white/90 pl-5.5 leading-snug">
                                {pin.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {versions.length === 0 && (
                <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-xs text-[#8E97AB]">
                  Aucune maquette dans ce tour. Cliquez sur « Ajouter version » pour déposer un fichier.
                </div>
              )}
            </div>
          );
        })}

        {(project.mockupRounds || []).length === 0 && (
          <div className="glass-panel p-12 text-center text-xs text-[#8E97AB] space-y-3">
            <Layers className="w-8 h-8 text-[#8E97AB] mx-auto stroke-[1.5]" />
            <p>Aucun tour de maquette initialisé pour le moment.</p>
            <button
              onClick={() => setIsAddRoundOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
            >
              Créer le Tour 1
            </button>
          </div>
        )}
      </div>

      {/* Modal: New Validation Round */}
      {isAddRoundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-modal w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-base font-bold text-white font-display">
                Créer un nouveau tour de validation
              </h4>
              <button onClick={() => setIsAddRoundOpen(false)} className="text-[#8E97AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRound} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Intitulé du tour
                </label>
                <input
                  type="text"
                  required
                  value={newRoundTitle}
                  onChange={(e) => setNewRoundTitle(e.target.value)}
                  placeholder={`Ex: Tour ${project.mockupRounds.length + 1} — Ajustements chromatiques`}
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRoundOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8E97AB] hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Créer le tour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Mockup Version */}
      {activeUploadRoundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-modal w-full max-w-lg p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-base font-bold text-white font-display">
                Téléverser une version de maquette
              </h4>
              <button onClick={() => setActiveUploadRoundId(null)} className="text-[#8E97AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Titre de la maquette *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ex: Version 2.0 — Déclinaison dorure mate"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Nom du fichier
                </label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="Ex: logo_maquette_v2.jpg"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Notes explicatives pour le client
                </label>
                <textarea
                  rows={3}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Précisez les points clés modifiés et les choix créatifs..."
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>

              <div className="p-4 rounded-xl border border-dashed border-white/20 text-center space-y-2 bg-white/[0.02]">
                <Upload className="w-6 h-6 text-[#f7c548] mx-auto" />
                <div className="text-xs font-medium text-white">
                  Fichier prêt pour aperçu interactif
                </div>
                <div className="text-[11px] text-[#8E97AB]">
                  Supporte JPG, PNG, WebP et PDF jusqu'à {profile.maxFileSizeMb} Mo
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveUploadRoundId(null)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8E97AB] hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Publier la maquette
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Paid Revision */}
      {isPaidRevModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-modal w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-base font-bold text-white font-display">
                Ajouter une révision payante
              </h4>
              <button onClick={() => setIsPaidRevModalOpen(false)} className="text-[#8E97AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPaidRevision} className="space-y-4">
              <p className="text-xs text-[#8E97AB] leading-relaxed">
                Cette action augmente la limite contractuelle de révisions d'une unité et ajoute le montant au budget du projet.
              </p>

              <div>
                <label className="block text-xs font-medium text-[#8E97AB] mb-1">
                  Montant de la révision supplémentaire ({profile.currency || '€'})
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="10"
                  value={paidRevCost}
                  onChange={(e) => setPaidRevCost(e.target.value)}
                  className="w-full px-3 py-2 text-xs glass-input font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaidRevModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8E97AB] hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Valider et ajouter (+{paidRevCost} €)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
