import React, { useState } from 'react';
import { 
  Folder, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  Check, 
  Lock, 
  Unlock, 
  Plus, 
  FileText, 
  FileArchive, 
  Image as ImageIcon,
  Sparkles,
  Layers,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Project, ProjectFile, FileCategory } from '../../../types';
import { CustomSelect } from '../../common/CustomSelect';

interface ProjectFilesTabProps {
  project: Project;
}

export const ProjectFilesTab: React.FC<ProjectFilesTabProps> = ({ project }) => {
  const { uploadProjectFile, deleteProjectFile, updateDeliveryConfig } = useApp();

  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<FileCategory>('deliverables');
  const [uploadName, setUploadName] = useState('');
  const [uploadExt, setUploadExt] = useState('ZIP');
  const [uploadSize, setUploadSize] = useState('14.2 Mo');
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [zipDownloaded, setZipDownloaded] = useState(false);

  const categoriesConfig: { key: FileCategory; label: string; desc: string }[] = [
    { key: 'client_provided', label: 'Fournis par le client', desc: 'Logos existants, textes validés, photos HD, chartes' },
    { key: 'sources', label: 'Recherches & Sources', desc: 'Fichiers de travail (.AI, .PSD, .FIG), moodboards, explorations' },
    { key: 'mockups', label: 'Maquettes & Présentations', desc: 'Planches de validation, rendus 3D et exports de revue' },
    { key: 'deliverables', label: 'Livrables finaux', desc: 'Fichiers finaux prêts pour l’impression (CMJN) et le web (SVG/PNG)' }
  ];

  const getFormatBadge = (ext: string) => {
    const upper = ext.toUpperCase().replace('.', '');
    switch (upper) {
      case 'AI':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF9A00]/20 text-[#FF9A00] border border-[#FF9A00]/30">AI</span>;
      case 'PSD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#31A8FF]/20 text-[#31A8FF] border border-[#31A8FF]/30">PSD</span>;
      case 'PDF':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9695F]/20 text-[#D9695F] border border-[#D9695F]/30">PDF</span>;
      case 'PNG':
      case 'JPG':
      case 'WEBP':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5FB59A]/20 text-[#5FB59A] border border-[#5FB59A]/30">{upper}</span>;
      case 'SVG':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">SVG</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80 border border-white/15">{upper}</span>;
    }
  };

  const files = project.files || [];
  const filteredFiles = files.filter(f => activeCategory === 'all' || f.category === activeCategory);

  const handleDownload = (file: ProjectFile) => {
    // Generate simulated instant download
    const blob = new Blob([`Fichier ${file.name} - eyes-onwork projet ${project.title}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = () => {
    setZipDownloaded(true);
    const blob = new Blob([`Archive ZIP des livrables pour ${project.title}`], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_fichiers.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setZipDownloaded(false), 3000);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) return;

    uploadProjectFile(project.id, {
      name: uploadName.trim().endsWith(`.${uploadExt.toLowerCase()}`) ? uploadName.trim() : `${uploadName.trim()}.${uploadExt.toLowerCase()}`,
      category: uploadCategory,
      version: 1,
      sizeBytes: 15000000,
      formattedSize: uploadSize || '12.4 Mo',
      extension: uploadExt.toLowerCase(),
      url: project.coverImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      uploadedBy: 'designer'
    });

    setUploadName('');
    setIsUploadModalOpen(false);
  };

  const isDeliveryLocked = !project.delivery.isUnlocked && project.paidAmount < project.budget;

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Action */}
      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Fichiers du projet & Livrables finaux
            </h3>
            <p className="text-xs text-[#8E97AB] mt-0.5">
              Classement en 4 catégories : sources, contenus client, maquettes et livrables d’impression.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Déposer un fichier</span>
            </button>

            <button
              onClick={handleDownloadAllZip}
              className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {zipDownloaded ? <Check className="w-3.5 h-3.5 text-[#5FB59A]" /> : <Download className="w-3.5 h-3.5 text-[#f7c548]" />}
              <span>{zipDownloaded ? 'Archive générée !' : 'Tout télécharger (.ZIP)'}</span>
            </button>
          </div>
        </div>

        {/* Deliverable Protection Status */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDeliveryLocked ? 'bg-[#f7c548]/10 border-[#f7c548]/25' : 'bg-[#5FB59A]/10 border-[#5FB59A]/25'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isDeliveryLocked ? 'bg-[#f7c548]/20 text-[#f7c548]' : 'bg-[#5FB59A]/20 text-[#5FB59A]'
            }`}>
              {isDeliveryLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div className="text-xs">
              <span className="font-bold text-white font-display block">
                {isDeliveryLocked ? 'Accès client aux livrables finaux : Verrouillé' : 'Accès client aux livrables finaux : Débloqué'}
              </span>
              <span className="text-[#8E97AB] text-[11px]">
                {isDeliveryLocked 
                  ? 'Le client ne pourra télécharger les livrables d’impression que lorsque le solde sera encaissé.' 
                  : 'Le solde est réglé (ou débloqué manuellement). Le client peut télécharger tous les livrables.'}
              </span>
            </div>
          </div>

          <button
            onClick={() => updateDeliveryConfig(project.id, { isUnlocked: !project.delivery.isUnlocked })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            {project.delivery.isUnlocked ? 'Reverrouiller' : 'Forcer le déblocage'}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
            activeCategory === 'all'
              ? 'bg-[#f7c548] text-[#0B0F1A]'
              : 'bg-white/[0.04] text-[#8E97AB] hover:text-white border border-white/10'
          }`}
        >
          Tous les fichiers ({project.files.length})
        </button>

        {categoriesConfig.map(cat => {
          const count = project.files.filter(f => f.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                activeCategory === cat.key
                  ? 'bg-white/20 text-white font-bold border border-white/20'
                  : 'bg-white/[0.04] text-[#8E97AB] hover:text-white border border-white/10'
              }`}
            >
              <span>{cat.label}</span>
              <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Files Grid / List */}
      <div className="space-y-3">
        {filteredFiles.length > 0 ? (
          filteredFiles.map(file => (
            <div
              key={file.id}
              className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                  {file.extension.match(/(jpg|png|webp|svg)/i) ? (
                    <ImageIcon className="w-5 h-5 text-[#5FB59A]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#f7c548]" />
                  )}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white font-display truncate">
                      {file.name}
                    </span>
                    {getFormatBadge(file.extension)}
                  </div>
                  <div className="text-[11px] text-[#8E97AB] flex items-center gap-2">
                    <span>{file.formattedSize}</span>
                    <span>·</span>
                    <span>Ajouté le {new Date(file.uploadedAt).toLocaleDateString('fr-FR')}</span>
                    <span>·</span>
                    <span className="capitalize text-white/60">
                      {file.uploadedBy === 'client' ? 'Par le client' : 'Par vous'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setPreviewFile(file)}
                  className="glass-btn-secondary p-2 rounded-lg cursor-pointer"
                  title="Aperçu"
                >
                  <Eye className="w-3.5 h-3.5 text-[#f7c548]" />
                </button>

                <button
                  onClick={() => handleDownload(file)}
                  className="glass-btn-secondary p-2 rounded-lg cursor-pointer"
                  title="Télécharger"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                </button>

                <button
                  onClick={() => deleteProjectFile(project.id, file.id)}
                  className="p-2 text-[#8E97AB] hover:text-[#D9695F] rounded-lg transition-colors cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel p-12 text-center text-xs text-[#8E97AB] space-y-3">
            <Folder className="w-8 h-8 text-[#8E97AB]/50 mx-auto" />
            <p>Aucun fichier dans cette catégorie.</p>
          </div>
        )}
      </div>

      {/* Guide d'utilisation des formats */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#f7c548]" />
          <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">
            Guide pratique des livrables (transmis au client)
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#8E97AB]">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
            <strong className="text-white block font-display">Vectoriel (.AI, .EPS, .SVG)</strong>
            <p className="text-[11px] leading-relaxed">
              Pour l'imprimeur, la signalétique, la broderie et la découpe laser. Agrandissable à l'infini sans perte de netteté.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
            <strong className="text-white block font-display">Web & Écran (.PNG transparent, .SVG)</strong>
            <p className="text-[11px] leading-relaxed">
              Pour votre site internet, vos emails, vos présentations PowerPoint et vos publications réseaux sociaux.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
            <strong className="text-white block font-display">Documents (.PDF HD CMJN)</strong>
            <p className="text-[11px] leading-relaxed">
              Fichiers certifiés PDF/X avec traits de coupe et 3mm de fond perdu, prêts pour l’envoi direct en imprimerie.
            </p>
          </div>
        </div>
      </div>

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg my-auto glass-panel p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white font-display">
                Déposer un fichier sur le dossier
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-[#8E97AB] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <CustomSelect
                label="Catégorie du fichier"
                required
                value={uploadCategory}
                onChange={val => setUploadCategory(val as FileCategory)}
                options={[
                  { value: 'deliverables', label: '4. Livrables finaux (Print / Web)' },
                  { value: 'sources', label: '2. Recherches & Sources (.AI, .PSD)' },
                  { value: 'mockups', label: '3. Maquettes & Présentations' },
                  { value: 'client_provided', label: '1. Fournis par le client' }
                ]}
                sheetTitle="Sélectionner la catégorie"
              />

              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1.5">
                  Nom du fichier *
                </label>
                <input
                  type="text"
                  required
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="ex: Packaging_Serum_Flacon_30ml_CMJN"
                  className="w-full px-3.5 py-2 text-xs glass-input font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CustomSelect
                  label="Format"
                  value={uploadExt}
                  onChange={val => setUploadExt(val)}
                  options={[
                    { value: 'PDF', label: 'PDF (Impression / Certifié)' },
                    { value: 'AI', label: 'AI (Illustrator Vectoriel)' },
                    { value: 'PSD', label: 'PSD (Photoshop)' },
                    { value: 'SVG', label: 'SVG (Web Vectoriel)' },
                    { value: 'PNG', label: 'PNG (Haute rés. transparent)' },
                    { value: 'ZIP', label: 'ZIP (Pack complet)' }
                  ]}
                  sheetTitle="Format du fichier"
                />

                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1.5">
                    Poids indicatif
                  </label>
                  <input
                    type="text"
                    value={uploadSize}
                    onChange={e => setUploadSize(e.target.value)}
                    placeholder="ex: 18.4 Mo"
                    className="w-full px-3 py-2 text-xs glass-input"
                  />
                </div>
              </div>

              {/* Simulated drop area */}
              <div className="p-6 border-2 border-dashed border-white/20 rounded-xl text-center space-y-2 bg-white/[0.02]">
                <Upload className="w-6 h-6 text-[#f7c548] mx-auto" />
                <p className="text-xs text-white">
                  Glissez-déposez votre fichier ici, ou parcourez votre disque
                </p>
                <p className="text-[10px] text-[#8E97AB]">
                  Fichiers acceptés jusqu'à 50 Mo (vectoriel, zip, archives HD)
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer"
                >
                  Enregistrer le fichier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm font-display">{previewFile.name}</span>
                {getFormatBadge(previewFile.extension)}
              </div>
              <button onClick={() => setPreviewFile(null)} className="text-[#8E97AB] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/15 bg-black/50 max-h-96 flex items-center justify-center">
              {previewFile.url ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-96 object-contain" />
              ) : (
                <div className="p-12 text-center text-xs text-[#8E97AB]">
                  Aperçu non disponible pour ce type de fichier source
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-[#8E97AB]">{previewFile.formattedSize}</span>
              <button
                onClick={() => handleDownload(previewFile)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
