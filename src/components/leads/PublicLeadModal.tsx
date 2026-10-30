import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  QrCode, 
  Download, 
  ExternalLink,
  ShieldCheck,
  Paperclip
} from 'lucide-react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import { ProjectType, PROJECT_TYPE_LABELS } from '../../types';
import { CustomSelect } from '../common/CustomSelect';

interface PublicLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicLeadModal: React.FC<PublicLeadModalProps> = ({ isOpen, onClose }) => {
  const { currentWorkspace, profile, addClient, addProject, clients, addNotification } = useApp();

  const [activeTab, setActiveTab] = useState<'share' | 'preview'>('share');
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Form state
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('identite_visuelle');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('1 500 € - 3 000 €');
  const [deadline, setDeadline] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-spam hidden field
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const publicUrl = `${window.location.origin}/?public_lead=1`;

  // Generate QR code on mount
  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0B0F1A',
        light: '#FAF9F6'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [publicUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode_demande_${(profile.studioName || 'eyesonwork').replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot) {
      console.warn('Spam submission detected');
      setSubmittedSuccess(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Post to server anti-spam endpoint
      await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          phone,
          projectType,
          description,
          estimatedBudget: budget,
          desiredDeadline: deadline
        })
      }).catch(() => {});

      // 2. Client-side integration: Find or create client
      let targetClient = clients.find(c => c.email.toLowerCase() === email.toLowerCase());
      if (!targetClient) {
        targetClient = addClient({
          workspaceId: currentWorkspace.id,
          name,
          company: company || name,
          email,
          phone: phone || '',
          whatsapp: phone || '',
          address: 'À renseigner',
          status: 'prospect',
          privateNotes: `Demande reçue via le formulaire public le ${new Date().toLocaleDateString('fr-FR')}.\nBudget estimé : ${budget}`
        });
      }

      // 3. Create project at step "demande_recue"
      const newProj = addProject({
        workspaceId: currentWorkspace.id,
        clientId: targetClient.id,
        title: `${company || name} — ${PROJECT_TYPE_LABELS[projectType]}`,
        type: projectType,
        budget: parseInt(budget.replace(/[^0-9]/g, ''), 10) || 1500,
        depositAmount: 0,
        deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        currentStep: 'demande_recue',
        revisionLimit: 3,
        brief: {
          objectives: description,
          targetAudience: 'À préciser lors du cadrage',
          desiredStyle: 'Selon propositions graphiques',
          colors: [],
          typographyAndReferences: '',
          expectedFormats: ['Fichiers vectoriels', 'Exports HD'],
          clientProvidedAssets: ''
        }
      });

      // 4. Notify designer
      addNotification({
        type: 'deadline_approaching',
        title: 'Nouvelle demande de devis reçue !',
        message: `${name} (${company || 'Indépendant'}) a envoyé une demande pour : ${PROJECT_TYPE_LABELS[projectType]}.`,
        linkProjectId: newProj.id,
        linkTab: 'brief'
      });

      setSubmittedSuccess(true);
    } catch (err) {
      console.error('Error submitting lead:', err);
      setSubmittedSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setDescription('');
    setDeadline('');
    setSubmittedSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel p-6 sm:p-8 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#f7c548]/20 text-[#f7c548]">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white font-display">
                Page publique « Demander un devis »
              </h2>
            </div>
            <p className="text-xs text-[#8E97AB] mt-1">
              Partagez ce lien ou votre QR code à vos prospects pour recevoir directement des demandes qualifiées.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8E97AB] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Partager vs Prévisualiser / Tester */}
        <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('share')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'share' ? 'bg-[#f7c548] text-[#0B0F1A]' : 'text-[#8E97AB] hover:text-white'
            }`}
          >
            Partager le lien & QR Code
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'preview' ? 'bg-[#f7c548] text-[#0B0F1A]' : 'text-[#8E97AB] hover:text-white'
            }`}
          >
            Tester le formulaire
          </button>
        </div>

        {activeTab === 'share' ? (
          <div className="space-y-6">
            {/* Share Link Box */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <span className="text-xs font-semibold text-white/90">Lien public direct pour vos clients :</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 px-3 py-2 text-xs glass-input font-mono select-all text-white/80"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* QR Code Presentation */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-[#0B0F1A]/80 border border-white/15">
              {qrDataUrl ? (
                <div className="p-3 bg-[#FAF9F6] rounded-xl shadow-lg shrink-0">
                  <img src={qrDataUrl} alt="QR Code Demande de devis" className="w-36 h-36 rounded-lg" />
                </div>
              ) : (
                <div className="w-36 h-36 rounded-xl bg-white/5 flex items-center justify-center text-xs text-[#8E97AB]">
                  Chargement...
                </div>
              )}

              <div className="space-y-3 text-center sm:text-left flex-1">
                <div>
                  <h3 className="text-sm font-bold text-white font-display">
                    QR Code prêt pour vos cartes de visite & salons
                  </h3>
                  <p className="text-xs text-[#8E97AB] mt-1 leading-relaxed">
                    Scannez pour ouvrir directement le formulaire de brief et recevoir les projets dans votre pipeline eyes-onwork.
                  </p>
                </div>

                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <button
                    onClick={handleDownloadQr}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger le QR Code PNG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {submittedSuccess ? (
              <div className="p-8 text-center space-y-4 rounded-2xl bg-[#5FB59A]/10 border border-[#5FB59A]/20">
                <div className="w-12 h-12 rounded-full bg-[#5FB59A]/20 text-[#5FB59A] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white font-display">
                  Demande envoyée avec succès !
                </h3>
                <p className="text-xs text-[#8E97AB] max-w-md mx-auto">
                  Le client a été automatiquement créé ou rattaché dans votre CRM et un nouveau dossier a été initialisé à l'étape « Demande reçue ».
                </p>
                <button
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Envoyer une autre demande test
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitLead} className="space-y-4 text-xs">
                {/* Honeypot hidden input for anti-spam bots */}
                <input
                  type="text"
                  name="hp_field"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8E97AB] font-semibold mb-1">Nom & Prénom *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ex: Élodie Morel"
                      className="w-full px-3 py-2 glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8E97AB] font-semibold mb-1">Société / Marque</label>
                    <input
                      type="text"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="Ex: Maison Botanica"
                      className="w-full px-3 py-2 glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8E97AB] font-semibold mb-1">Adresse Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="elodie@botanica.fr"
                      className="w-full px-3 py-2 glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8E97AB] font-semibold mb-1">Téléphone ou WhatsApp</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="w-full px-3 py-2 glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CustomSelect
                    label="Type de création"
                    value={projectType}
                    onChange={val => setProjectType(val as ProjectType)}
                    options={Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => ({
                      value: k,
                      label
                    }))}
                    sheetTitle="Type de création"
                  />

                  <CustomSelect
                    label="Budget approximatif"
                    value={budget}
                    onChange={val => setBudget(val)}
                    options={[
                      { value: 'Moins de 1 000 €', label: 'Moins de 1 000 €' },
                      { value: '1 000 € - 2 500 €', label: '1 000 € - 2 500 €' },
                      { value: '2 500 € - 5 000 €', label: '2 500 € - 5 000 €' },
                      { value: 'Plus de 5 000 €', label: 'Plus de 5 000 €' }
                    ]}
                    sheetTitle="Budget approximatif"
                  />
                </div>

                <div>
                  <label className="block text-[#8E97AB] font-semibold mb-1">Description de votre besoin & objectifs *</label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Parlez-moi de votre projet, de votre calendrier et de vos inspirations..."
                    className="w-full px-3 py-2 glass-input text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8E97AB]">
                    <ShieldCheck className="w-4 h-4 text-[#5FB59A]" />
                    <span>Protection anti-spam et données confidentielles</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer font-display disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Envoi en cours...' : 'Envoyer la demande'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
