import React, { useState, useRef } from 'react';
import { 
  CheckCircle2, 
  MessageSquare, 
  Download, 
  ShieldCheck, 
  ArrowLeft, 
  Sparkles, 
  Check, 
  Send, 
  AlertCircle,
  FileCheck,
  Lock,
  Eye,
  FileText,
  CreditCard,
  Folder,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Mail,
  Phone,
  Star,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrencySafe } from '../../utils/formatUtils';
import { PROJECT_STEPS, PROJECT_TYPE_LABELS, Quote, Invoice } from '../../types';
import { AmbientHalos } from '../layout/AmbientHalos';
import { DocumentA4Modal } from '../billing/DocumentA4Modal';
import { generateDirectDocumentPDF } from '../../utils/pdfGenerator';

interface ClientPortalViewProps {
  shareToken: string;
  isPreviewMode?: boolean;
  onExit: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ 
  shareToken, 
  isPreviewMode = false, 
  onExit 
}) => {
  const { 
    getProjectByShareToken, 
    getClientById, 
    profile, 
    updateProjectStep, 
    addActivity, 
    updateProject,
    addPinComment,
    addGeneralComment,
    validateMockupRound,
    requestMockupChanges,
    acceptQuote,
    getQuotesByProjectId,
    getInvoicesByProjectId,
    submitProjectReview
  } = useApp();

  const project = getProjectByShareToken(shareToken);
  const client = project ? getClientById(project.clientId) : undefined;
  const quotes = project ? getQuotesByProjectId(project.id) : [];
  const invoices = project ? getInvoicesByProjectId(project.id) : [];

  // Active client tab
  const [activeTab, setActiveTab] = useState<'brief' | 'quotes_invoices' | 'mockups' | 'files'>('mockups');

  // Contact Modal
  const [isContactOpen, setIsContactOpen] = useState(false);

  // A4 Document Preview
  const [previewDoc, setPreviewDoc] = useState<{ doc: Quote | Invoice; type: 'quote' | 'invoice' } | null>(null);

  // Electronic Signature Modal
  const [signQuote, setSignQuote] = useState<Quote | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signatoryName, setSignatoryName] = useState(client?.name || '');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Mockups interactive state
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activePinCoords, setActivePinCoords] = useState<{ x: number; y: number } | null>(null);
  const [pinCommentText, setPinCommentText] = useState('');
  const [generalCommentText, setGeneralCommentText] = useState('');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Revision & Validation modals
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [isValidatingModalOpen, setIsValidatingModalOpen] = useState(false);
  const [validationSuccessToast, setValidationSuccessToast] = useState(false);

  // Project Review Rating state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0F1A] text-white relative">
        <AmbientHalos />
        <div className="glass-panel max-w-md w-full p-8 text-center space-y-4 relative z-10">
          <AlertCircle className="w-10 h-10 text-[#D9695F] mx-auto stroke-[1.5]" />
          <h1 className="text-lg font-bold font-display">Lien de projet introuvable</h1>
          <p className="text-xs text-[#8E97AB]">
            Le jeton de sécurité ne correspond à aucun dossier actif. Veuillez vous rapprocher de votre graphiste.
          </p>
          {isPreviewMode && (
            <button
              onClick={onExit}
              className="px-4 py-2 rounded-xl text-xs bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              Revenir à l'application
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentStepDef = PROJECT_STEPS.find(s => s.key === project.currentStep) || PROJECT_STEPS[0];
  const isDelivered = project.currentStep === 'livre';
  const isBalancePaid = project.paidAmount >= project.budget || project.delivery?.isUnlocked;

  // Active round & version (null-safe)
  const mockupRounds = project.mockupRounds || [];
  const currentRound = mockupRounds[selectedRoundIndex] || mockupRounds[0];
  const currentVersions = currentRound?.versions || [];
  const currentVersion = currentVersions[selectedVersionIndex] || currentVersions[0];
  const hasMockupAvailable = Boolean(currentVersion?.fileUrl || (currentVersion as any)?.imageUrl || project.coverImageUrl);

  // Signature canvas setup
  const initCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0B0F1A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSignQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signQuote || !agreeTerms || !signatoryName.trim() || !hasDrawn) return;

    acceptQuote(signQuote.id, signatoryName.trim());
    setSignQuote(null);
    setAgreeTerms(false);
    setHasDrawn(false);
  };

  // Mockup click to drop a PIN
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePinCoords) {
      setActivePinCoords(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setActivePinCoords({ x, y });
    setSelectedPinId(null);
  };

  const handleSavePinComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePinCoords || !pinCommentText.trim() || !currentRound || !currentVersion) return;

    addPinComment(project.id, currentRound.id, currentVersion.id, {
      xPercent: Math.round(activePinCoords.x * 10) / 10,
      yPercent: Math.round(activePinCoords.y * 10) / 10,
      author: client ? client.name : 'Client',
      content: pinCommentText.trim()
    });

    setPinCommentText('');
    setActivePinCoords(null);
  };

  const handleAddGeneralComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalCommentText.trim() || !currentRound || !currentVersion) return;

    addGeneralComment(
      project.id, 
      currentRound.id, 
      currentVersion.id, 
      client ? client.name : 'Client', 
      generalCommentText.trim()
    );
    setGeneralCommentText('');
  };

  // Validation
  const handleConfirmValidation = () => {
    if (isPreviewMode) return;
    if (currentRound) {
      validateMockupRound(project.id, currentRound.id, client ? client.name : 'Client');
    } else {
      updateProjectStep(project.id, 'validation_finale');
    }
    setIsValidatingModalOpen(false);
    setValidationSuccessToast(true);
    setTimeout(() => setValidationSuccessToast(false), 4000);
  };

  // Request revisions
  const handleConfirmRevisions = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreviewMode || !revisionFeedback.trim()) return;

    if (currentRound) {
      requestMockupChanges(project.id, currentRound.id, revisionFeedback.trim(), client ? client.name : 'Client');
    } else {
      const nextRevisions = (project.revisionsUsed || 0) + 1;
      updateProject(project.id, {
        revisionsUsed: nextRevisions,
        currentStep: 'revisions'
      });
      addActivity(project.id, {
        title: `Demande de retouches client (Cycle ${nextRevisions}/${project.revisionLimit || 3})`,
        description: revisionFeedback.trim(),
        type: 'comment',
        authorName: client ? client.name : 'Client'
      });
    }

    setIsRevisionModalOpen(false);
    setRevisionFeedback('');
  };

  // Review submission
  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    submitProjectReview(project.id, {
      rating: reviewRating,
      comment: reviewComment.trim(),
      clientName: client ? client.name : 'Client',
      clientCompany: client ? client.company : 'Entreprise'
    });

    setReviewSubmitted(true);
  };

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile.currency || 'EUR', 0);
  };

  return (
    <div className="min-h-screen relative text-[#F1F3F8] selection:bg-[#f7c548]/30 pb-20">
      <AmbientHalos />

      {/* Top Banner: Designer Preview Notice (Uniquement visible en mode aperçu) */}
      {isPreviewMode && (
        <div className="bg-[#121826]/95 backdrop-blur-md border-b border-[#f7c548]/40 px-4 py-2 flex items-center justify-between text-xs sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#f7c548] animate-pulse" />
            <span className="font-semibold text-[#f7c548]">
              Mode aperçu, visible uniquement par vous
            </span>
            <span className="text-[#8E97AB] hidden sm:inline">
              — {project.title}
            </span>
          </div>

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retour au dashboard graphiste</span>
            <span className="sm:hidden">Retour</span>
          </button>
        </div>
      )}

      {/* Client Portal Header: Opaque, fond sombre premium, flou d'arrière-plan et zone sûre */}
      <header className={`sticky ${isPreviewMode ? 'top-[37px]' : 'top-0'} z-40 bg-[#0B0F1A]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-4.5 h-4.5 text-[#f7c548] shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-white font-display text-sm block truncate">
                {profile.studioName || profile.name}
              </span>
              <span className="text-[#8E97AB] text-[11px] block truncate">
                Espace Client Sécurisé · {project.title}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsContactOpen(true)}
            className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer text-[#F1F3F8] hover:text-white"
          >
            <Mail className="w-3.5 h-3.5 text-[#f7c548]" />
            <span>Contacter</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-8 relative z-10">
        {/* Studio & Project Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-[#8E97AB]">
              <span className="text-white/90 font-medium">{profile.studioName || profile.name}</span>
              <span aria-hidden="true" className="text-white/30">·</span>
              <span className="text-[#f7c548] font-semibold">{PROJECT_TYPE_LABELS[project.type]}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              {project.title}
            </h1>

            <p className="text-xs sm:text-sm text-[#8E97AB]">
              Espace dédié à <strong className="text-white font-display">{client ? client.company : 'votre entreprise'}</strong>
            </p>
          </div>

          <button
            onClick={() => setIsContactOpen(true)}
            className="glass-btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Mail className="w-4 h-4 text-[#f7c548]" />
            <span>Contacter {profile.name.split(' ')[0]}</span>
          </button>
        </div>

        {/* 4 Client Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'mockups', label: 'Maquettes & Validation', icon: Layers, badge: currentRound ? `Tour ${currentRound.roundNumber}` : null },
            { id: 'quotes_invoices', label: 'Devis & Factures', icon: CreditCard, badge: quotes.some(q => q.status === 'sent') ? 'À signer' : null },
            { id: 'files', label: 'Fichiers & Livraison', icon: Folder, badge: isBalancePaid ? 'Débloqué' : 'Verrouillé' },
            { id: 'brief', label: 'Projet & Brief', icon: FileText, badge: null }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[78px] ${
                  isActive 
                    ? 'bg-white/15 border-[#f7c548] text-white shadow-lg shadow-[#f7c548]/10' 
                    : 'bg-white/[0.03] border-white/10 text-[#8E97AB] hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#f7c548]' : 'text-current'}`} />
                  {tab.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      tab.badge === 'À signer' 
                        ? 'bg-[#f7c548] text-[#0B0F1A]' 
                        : tab.badge === 'Débloqué' 
                          ? 'bg-[#5FB59A]/20 text-[#5FB59A]'
                          : 'bg-white/10 text-white/80'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold font-display mt-2 leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            TAB 1: MAQUETTES & VALIDATION (Module 1 Côté client)
            ========================================================================= */}
        {activeTab === 'mockups' && (
          <div className="space-y-6">
            {/* Round & Version Selector */}
            <div className="glass-panel p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#f7c548]" />
                    <span>{currentRound ? currentRound.title : 'Présentation des maquettes'}</span>
                  </h2>
                  <p className="text-xs text-[#8E97AB] mt-0.5">
                    Cliquez directement sur l'image pour épingler une remarque précise à l'attention du studio.
                  </p>
                </div>

                {/* Revision Counter */}
                <div className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-[#8E97AB] self-start sm:self-auto font-medium">
                  Révisions incluses : <strong className="text-white font-display">{project.revisionsUsed || 0}</strong> / {project.revisionLimit || 3}
                </div>
              </div>

              {/* Version switcher */}
              {currentVersions.length > 1 && (
                <div className="flex items-center gap-2 pt-2 border-t border-white/10 overflow-x-auto">
                  <span className="text-[11px] text-[#8E97AB] font-semibold shrink-0">Versions :</span>
                  {currentVersions.map((ver, idx) => (
                    <button
                      key={ver.id}
                      onClick={() => setSelectedVersionIndex(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        selectedVersionIndex === idx
                          ? 'bg-[#f7c548] text-[#0B0F1A]'
                          : 'bg-white/10 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Version {ver.versionNumber} ({ver.title})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Banner if validated */}
            {(validationSuccessToast || currentRound?.status === 'validated' || project.currentStep === 'validation_finale' || isDelivered) && (
              <div className="p-4 rounded-xl bg-[#5FB59A]/15 border border-[#5FB59A]/35 flex items-center gap-3 text-[#5FB59A] text-xs animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-bold block text-sm font-display">Maquette validée !</span>
                  <span>Votre validation a été enregistrée avec succès. Votre graphiste prépare les livrables d’impression.</span>
                </div>
              </div>
            )}

            {/* Interactive Image Frame with Zoom and Pins */}
            <div className="glass-panel p-3 sm:p-5 space-y-4">
              {/* Zoom Controls */}
              <div className="flex items-center justify-between text-xs text-[#8E97AB]">
                <span className="text-[11px]">
                  Astuce : Cliquez sur un détail pour laisser un commentaire épinglé
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                    title="Zoom arrière"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] tabular-nums font-bold text-white px-1">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                    title="Zoom avant"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#8E97AB] hover:text-white transition-colors cursor-pointer"
                    title="Réinitialiser zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewport Frame */}
              <div 
                ref={imageContainerRef}
                onClick={handleImageClick}
                className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-2xl flex items-center justify-center min-h-[350px] cursor-crosshair select-none"
              >
                {currentVersion?.fileUrl || project.coverImageUrl ? (
                  <div 
                    className="transition-transform duration-150 origin-center relative inline-block max-w-full"
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={currentVersion?.fileUrl || project.coverImageUrl}
                      alt={project.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto object-contain max-h-[600px] pointer-events-none rounded-lg"
                    />

                    {/* Render Existing Pins */}
                    {(currentVersion?.pinComments || []).map((pin) => (
                      <div
                        key={pin.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPinId(selectedPinId === pin.id ? null : pin.id);
                        }}
                        style={{ left: `${pin.xPercent}%`, top: `${pin.yPercent}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#f7c548] text-[#0B0F1A] font-bold text-[10px] flex items-center justify-center shadow-lg ring-2 ring-white/80 animate-pulse">
                          {pin.pinNumber}
                        </div>

                        {/* Tooltip on pin click */}
                        {(selectedPinId === pin.id) && (
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-56 p-3 rounded-xl bg-[#0B0F1A] border border-[#f7c548]/50 shadow-2xl text-left text-xs z-30 animate-fadeIn pointer-events-auto">
                            <div className="flex items-center justify-between text-[10px] text-[#f7c548] font-bold mb-1">
                              <span>Point #{pin.pinNumber} · {pin.author}</span>
                              <span className="text-[#8E97AB] font-normal">
                                {new Date(pin.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-white text-[11px] leading-relaxed">
                              {pin.content}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Active pin waiting for comment input */}
                    {activePinCoords && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ left: `${activePinCoords.x}%`, top: `${activePinCoords.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-30 animate-scaleUp"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#D9695F] text-white font-bold text-xs flex items-center justify-center shadow-lg ring-2 ring-white">
                          !
                        </div>

                        <form
                          onSubmit={handleSavePinComment}
                          className="absolute top-9 left-1/2 -translate-x-1/2 w-64 p-3.5 rounded-xl bg-[#0B0F1A] border border-white/20 shadow-2xl space-y-2 text-xs"
                        >
                          <span className="font-bold text-white block">Annoter ce détail</span>
                          <textarea
                            autoFocus
                            required
                            rows={2}
                            value={pinCommentText}
                            onChange={(e) => setPinCommentText(e.target.value)}
                            placeholder="Votre remarque (ex: éclaircir cette nuance, centrer le texte...)"
                            className="w-full px-2.5 py-1.5 text-xs glass-input"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setActivePinCoords(null)}
                              className="px-2.5 py-1 text-[11px] text-[#8E97AB] hover:text-white"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 rounded-lg text-[11px] font-bold text-[#0B0F1A] bg-[#f7c548]"
                            >
                              Épingler
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-16 text-center text-xs text-[#8E97AB]">
                    Aucune maquette disponible pour le moment.
                  </div>
                )}
              </div>

              {/* Pins Count */}
              {(currentVersion?.pinComments || []).length > 0 && (
                <div className="text-xs text-[#8E97AB] pt-1">
                  {(currentVersion?.pinComments || []).length} remarque{(currentVersion?.pinComments || []).length > 1 ? 's' : ''} épinglée{(currentVersion?.pinComments || []).length > 1 ? 's' : ''} sur cette maquette.
                </div>
              )}
            </div>

            {/* Validation & Feedback CTA Buttons */}
            {!(currentRound?.status === 'validated' || project.currentStep === 'validation_finale' || isDelivered) && (
              <div className="glass-panel p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-white block text-sm font-display">Votre décision sur ce tour</span>
                  <span className="text-xs text-[#8E97AB]">
                    {isPreviewMode 
                      ? "En mode aperçu, les actions de validation sont désactivées pour protéger vos dossiers."
                      : !hasMockupAvailable 
                        ? "Les boutons de validation s'activeront dès qu'une maquette sera disponible."
                        : "Vous pouvez approuver la maquette ou demander des modifications accompagnées de vos retours."}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    disabled={!hasMockupAvailable || isPreviewMode}
                    onClick={() => setIsRevisionModalOpen(true)}
                    title={isPreviewMode ? "Désactivé en mode aperçu" : !hasMockupAvailable ? "Aucune maquette disponible" : undefined}
                    className="glass-btn-secondary flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-[#f7c548]" />
                    <span>Demander des modifications</span>
                  </button>

                  <button
                    disabled={!hasMockupAvailable || isPreviewMode}
                    onClick={() => setIsValidatingModalOpen(true)}
                    title={isPreviewMode ? "Désactivé en mode aperçu" : !hasMockupAvailable ? "Aucune maquette disponible" : undefined}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#f7c548]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Valider cette version</span>
                  </button>
                </div>
              </div>
            )}

            {/* General Comments Section */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                Échanges & Commentaires généraux ({(currentVersion?.generalComments || []).length})
              </h3>

              <div className="space-y-3">
                {(currentVersion?.generalComments || []).map((gc) => (
                  <div key={gc.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#f7c548] font-display">{gc.author}</span>
                      <span className="text-[#8E97AB] tabular-nums">
                        {new Date(gc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-white/90 leading-relaxed">{gc.content}</p>
                  </div>
                ))}

                {(!currentVersion || (currentVersion.generalComments || []).length === 0) && (
                  <p className="text-xs text-[#8E97AB] text-center py-2">
                    Aucun commentaire général sur cette version.
                  </p>
                )}
              </div>

              {/* Add comment form */}
              <form onSubmit={handleAddGeneralComment} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={generalCommentText}
                  onChange={(e) => setGeneralCommentText(e.target.value)}
                  placeholder="Écrire un message global pour le studio..."
                  className="flex-1 px-3.5 py-2 text-xs glass-input"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: DEVIS & FACTURES (Module 2 Côté client avec signature électronique)
            ========================================================================= */}
        {activeTab === 'quotes_invoices' && (
          <div className="space-y-6">
            {/* Quotes List */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Propositions commerciales & Devis
                  </h3>
                  <p className="text-xs text-[#8E97AB] mt-0.5">
                    Consultez et signez vos devis directement en ligne avec valeur contractuelle.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {quotes.map(quote => (
                  <div
                    key={quote.id}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white font-display">
                          {quote.quoteNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          quote.status === 'accepted' ? 'bg-[#5FB59A]/15 text-[#5FB59A]' : 'bg-[#f7c548]/15 text-[#f7c548]'
                        }`}>
                          {quote.status === 'accepted' ? 'Signé & Approuvé' : 'À signer'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8E97AB]">
                        Valable jusqu'au {new Date(quote.dueDate).toLocaleDateString('fr-FR')} · {(quote.lines || []).length} prestation(s)
                      </p>
                      {quote.acceptedByName && (
                        <p className="text-[11px] text-[#5FB59A] flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Signé le {new Date(quote.acceptedAt || '').toLocaleDateString('fr-FR')} par {quote.acceptedByName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-sm font-bold text-white tabular-nums block font-display">
                          {formatCurrency(quote.totalTTC)} TTC
                        </span>
                        <span className="text-[10px] text-[#8E97AB]">
                          Acompte : {formatCurrency(quote.depositAmount)}
                        </span>
                      </div>

                      <button
                        onClick={() => setPreviewDoc({ doc: quote, type: 'quote' })}
                        className="glass-btn-secondary p-2 rounded-lg cursor-pointer"
                        title="Prévisualisation PDF & détails"
                      >
                        <Eye className="w-4 h-4 text-[#f7c548]" />
                      </button>

                      <button
                        onClick={() => generateDirectDocumentPDF(quote, 'quote', client, profile)}
                        className="p-2 text-[#8E97AB] hover:text-[#f7c548] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Télécharger en PDF (.pdf)"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {quote.status === 'sent' && (
                        <button
                          onClick={() => {
                            setSignQuote(quote);
                            setTimeout(initCanvas, 100);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer shadow-sm"
                        >
                          Signer en ligne
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoices List */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Factures & Règlements
                  </h3>
                  <p className="text-xs text-[#8E97AB] mt-0.5">
                    Factures d'acompte et de solde émises par {profile.studioName || profile.name}.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {invoices.map(invoice => (
                  <div
                    key={invoice.id}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white font-display">
                          {invoice.invoiceNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white/80 font-medium">
                          {invoice.type === 'deposit' && 'Acompte initial'}
                          {invoice.type === 'balance' && 'Solde final'}
                          {invoice.type === 'full' && 'Facture intégrale'}
                          {invoice.type === 'additional' && 'Prestation sup.'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          invoice.status === 'paid' ? 'bg-[#5FB59A]/15 text-[#5FB59A]' : 'bg-[#f7c548]/15 text-[#f7c548]'
                        }`}>
                          {invoice.status === 'paid' ? 'Payée' : 'À régler'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8E97AB]">
                        Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-sm font-bold text-white tabular-nums block font-display">
                          {formatCurrency(invoice.totalTTC)} TTC
                        </span>
                        <span className="text-[10px] text-[#f7c548]">
                          {invoice.balanceDue > 0 ? `Reste à payer : ${formatCurrency(invoice.balanceDue)}` : 'Règlement reçu'}
                        </span>
                      </div>

                      <button
                        onClick={() => setPreviewDoc({ doc: invoice, type: 'invoice' })}
                        className="glass-btn-secondary p-2 rounded-lg cursor-pointer"
                        title="Prévisualisation PDF & détails"
                      >
                        <Eye className="w-4 h-4 text-[#f7c548]" />
                      </button>

                      <button
                        onClick={() => generateDirectDocumentPDF(invoice, 'invoice', client, profile)}
                        className="p-2 text-[#8E97AB] hover:text-[#5FB59A] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Télécharger en PDF (.pdf)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: FICHIERS & LIVRAISON (Module 3 & 4 Côté client)
            ========================================================================= */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* Delivery Status Card */}
            <div className={`glass-panel p-6 space-y-4 ${
              isBalancePaid ? 'border-[#5FB59A]/30' : 'border-[#f7c548]/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isBalancePaid ? 'bg-[#5FB59A]/20 text-[#5FB59A]' : 'bg-[#f7c548]/20 text-[#f7c548]'
                }`}>
                  {isBalancePaid ? <FileCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    {isBalancePaid ? 'Livrables finaux débloqués !' : 'Livrables finaux protégés'}
                  </h3>
                  <p className="text-xs text-[#8E97AB]">
                    {isBalancePaid 
                      ? 'Votre solde est réglé. Vous pouvez télécharger tous vos fichiers sources et packs d’impression.' 
                      : 'Les livrables finaux en haute résolution seront disponibles dès réception du solde de la facture finale.'}
                  </p>
                </div>
              </div>

              {!isBalancePaid && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="text-[#8E97AB]">
                    Facture de solde en attente de validation ou de paiement.
                  </span>
                  <button
                    onClick={() => setActiveTab('quotes_invoices')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Voir la facture de solde
                  </button>
                </div>
              )}
            </div>

            {/* Unlocked Deliverables Pack */}
            {isBalancePaid && (
              <div className="glass-panel p-6 space-y-5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-bold text-white font-display">
                      Livrables finaux classés par format
                    </h3>
                    <p className="text-xs text-[#8E97AB] mt-0.5">
                      Fichiers optimisés prêts pour vos supports d'impression et votre communication digitale.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const blob = new Blob([`Pack complet des livrables pour ${project.title}`], { type: 'application/zip' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Livrables_${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.zip`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tout télécharger (.ZIP)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#f7c548]">Pack Print</span>
                    <strong className="text-white block text-xs font-display">Fichiers Imprimeur CMJN</strong>
                    <p className="text-[11px] text-[#8E97AB] leading-relaxed">
                      PDF certifié 300 DPI, repères de coupe, 3mm fond perdu.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5FB59A]">Pack Web</span>
                    <strong className="text-white block text-xs font-display">Formats Digitaux RGB</strong>
                    <p className="text-[11px] text-[#8E97AB] leading-relaxed">
                      SVG vectoriel responsive, PNG fond transparent en HD.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#31A8FF]">Pack Sources</span>
                    <strong className="text-white block text-xs font-display">Fichiers Originaux (.AI)</strong>
                    <p className="text-[11px] text-[#8E97AB] leading-relaxed">
                      Vectoriels bruts pour déclinaisons futures ou archivage.
                    </p>
                  </div>
                </div>

                {/* Practical format guide */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-[#8E97AB] space-y-2">
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <HelpCircle className="w-4 h-4 text-[#f7c548]" />
                    <span>Guide d'utilisation des fichiers :</span>
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-[11px]">
                    <li><strong>Pour l'imprimeur ou le marquage :</strong> transmettez impérativement le fichier <code>.AI</code> ou le <code>.PDF</code> HD.</li>
                    <li><strong>Pour votre site web et réseaux sociaux :</strong> utilisez les formats <code>.SVG</code> ou <code>.PNG</code> transparents.</li>
                    <li><strong>Pour vos factures et Word :</strong> privilégiez le <code>.PNG</code> haute résolution.</li>
                  </ul>
                </div>

                {/* Thank-you & Review section */}
                <div className="p-6 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/30 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white font-display">
                      Merci pour votre confiance !
                    </h4>
                    <p className="text-xs text-[#8E97AB] leading-relaxed">
                      {project.delivery?.thankYouMessage || `Ce fut un grand plaisir de collaborer avec vous sur ${project.title}. Votre retour est précieux pour le studio.`}
                    </p>
                  </div>

                  {reviewSubmitted || (project.reviews && project.reviews.length > 0) ? (
                    <div className="p-3.5 rounded-xl bg-[#5FB59A]/15 border border-[#5FB59A]/30 text-xs text-[#5FB59A] flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Votre avis a été chaleureusement enregistré. Merci !</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">Votre note :</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setReviewRating(star)}
                              className="p-1 cursor-pointer text-[#f7c548]"
                            >
                              <Star className={`w-5 h-5 ${star <= reviewRating ? 'fill-[#f7c548]' : 'fill-none opacity-40'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        required
                        rows={3}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Partagez un court témoignage sur notre collaboration, la qualité des échanges ou le résultat final..."
                        className="w-full px-3 py-2 text-xs glass-input"
                      />

                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                      >
                        Publier mon témoignage
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: PROJET & BRIEF (Module 5 Côté client)
            ========================================================================= */}
        {activeTab === 'brief' && (
          <div className="space-y-6">
            {/* Stepper Timeline */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E97AB]">Étape actuelle du dossier :</span>
                <span className="font-bold text-[#f7c548] font-display">{currentStepDef.label}</span>
              </div>

              <div className="relative flex items-center justify-between">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 -z-1" />
                {[
                  { step: 1, label: 'Brief & Devis', done: currentStepDef.order >= 3 },
                  { step: 2, label: 'Recherches', done: currentStepDef.order >= 5 },
                  { step: 3, label: 'Maquettes', done: currentStepDef.order >= 6 },
                  { step: 4, label: 'Validation', done: currentStepDef.order >= 8 },
                  { step: 5, label: 'Livraison', done: currentStepDef.order >= 10 }
                ].map((s) => (
                  <div key={s.step} className="flex flex-col items-center bg-[#0B0F1A] px-2 rounded-xl">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors font-display ${
                      s.done ? 'bg-[#5FB59A] text-[#0B0F1A]' : 'bg-white/10 text-[#8E97AB] border border-white/20'
                    }`}>
                      {s.done ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                    </div>
                    <span className="text-[11px] text-[#8E97AB] mt-1.5 hidden sm:block font-medium">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brief Content Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-panel p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7c548]">Objectifs convenus</span>
                <p className="text-xs text-white leading-relaxed">{project.brief?.objectives || 'Non renseignés'}</p>
              </div>

              <div className="glass-panel p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7c548]">Public cible</span>
                <p className="text-xs text-white leading-relaxed">{project.brief?.targetAudience || 'Non renseigné'}</p>
              </div>

              <div className="glass-panel p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7c548]">Style souhaité</span>
                <p className="text-xs text-white leading-relaxed">{project.brief?.desiredStyle || 'Non renseigné'}</p>
              </div>

              <div className="glass-panel p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7c548]">Palette chromatique</span>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {(project.brief?.colors || []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: c.hex }} />
                      <span className="text-[11px] text-white font-medium">{c.name}</span>
                    </div>
                  ))}
                  {(project.brief?.colors || []).length === 0 && (
                    <span className="text-xs text-[#8E97AB]">Aucune couleur définie</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* 1. Modal Contact Direct */}
      {isContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm glass-panel p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#f7c548]" />
                <h3 className="text-base font-bold text-white font-display">
                  Contacter {profile.name}
                </h3>
              </div>
              <button onClick={() => setIsContactOpen(false)} className="text-[#8E97AB] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <a
                href={`mailto:${profile.email}?subject=Projet ${project.title}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 transition-colors"
              >
                <Mail className="w-4 h-4 text-[#f7c548] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#8E97AB] text-[10px] block">Email direct</span>
                  <span className="text-white font-medium truncate block">{profile.email}</span>
                </div>
              </a>

              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 transition-colors"
              >
                <Phone className="w-4 h-4 text-[#5FB59A] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#8E97AB] text-[10px] block">Téléphone</span>
                  <span className="text-white font-medium truncate block">{profile.phone}</span>
                </div>
              </a>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-[#8E97AB] leading-relaxed">
                Studio disponible du lundi au vendredi de 9h à 18h.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Electronic Signature Canvas */}
      {signQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg my-auto glass-panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Signature électronique du devis
                </h3>
                <p className="text-xs text-[#8E97AB]">
                  Devis N° {signQuote.quoteNumber} — Montant : {formatCurrency(signQuote.totalTTC)} TTC
                </p>
              </div>
              <button onClick={() => setSignQuote(null)} className="text-[#8E97AB] hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSignQuoteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/90 mb-1">
                  Nom et prénom du signataire *
                </label>
                <input
                  type="text"
                  required
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="ex: Camille Bernard"
                  className="w-full px-3.5 py-2 text-xs glass-input font-medium"
                />
              </div>

              {/* Signature Canvas Pad */}
              <div>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <label className="font-semibold text-white/90">
                    Tracé de signature manuscrite (souris ou doigt) *
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[11px] text-[#f7c548] hover:underline cursor-pointer"
                  >
                    Effacer le tracé
                  </button>
                </div>

                <div className="rounded-xl border border-white/20 bg-white p-1 overflow-hidden">
                  <canvas
                    ref={signatureCanvasRef}
                    width={440}
                    height={130}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="w-full h-[120px] touch-none cursor-crosshair block"
                  />
                </div>
                {!hasDrawn && (
                  <span className="text-[11px] text-[#8E97AB] block mt-1">
                    Veuillez apposer votre signature dans le cadre blanc ci-dessus.
                  </span>
                )}
              </div>

              {/* Bon pour accord checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-[#f7c548] focus:ring-[#f7c548]"
                />
                <span className="text-[11px] text-white/90 leading-relaxed">
                  Je confirme être habilité(e) à engager mon entreprise, valide la mention <strong>« Bon pour accord »</strong> et accepte sans réserve les conditions générales de vente et délais convenus.
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSignQuote(null)}
                  className="px-4 py-2 text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!hasDrawn || !agreeTerms || !signatoryName.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] disabled:opacity-40 transition-all cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Valider et signer le devis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Revision Request */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white font-display">
              Demander des modifications (Cycle {(project.revisionsUsed || 0) + 1}/{project.revisionLimit || 3})
            </h3>
            <p className="text-xs text-[#8E97AB]">
              Décrivez de manière exhaustive les corrections attendues afin que le studio puisse les intégrer au prochain tour.
            </p>

            <form onSubmit={handleConfirmRevisions} className="space-y-4">
              <textarea
                required
                rows={4}
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Détaillez vos demandes : ajustement de la typographie, variantes de couleurs, recadrages..."
                className="w-full px-3.5 py-2 text-xs glass-input"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer la demande</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Validation Confirmation */}
      {isValidatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md glass-panel p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#5FB59A]/20 text-[#5FB59A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white font-display">
              Confirmer la validation finale
            </h3>

            <p className="text-xs text-[#8E97AB] leading-relaxed">
              <strong>Cette validation est définitive pour cette étape.</strong><br />
              Le projet passera automatiquement à la phase suivante de finalisation et d’export des fichiers d'impression.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsValidatingModalOpen(false)}
                className="px-4 py-2 text-xs text-[#8E97AB] hover:text-white cursor-pointer"
              >
                Revenir en arrière
              </button>
              <button
                type="button"
                onClick={handleConfirmValidation}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#5FB59A] hover:bg-[#6ecbb0] cursor-pointer font-display"
              >
                Oui, je valide définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. A4 Document Modal */}
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
