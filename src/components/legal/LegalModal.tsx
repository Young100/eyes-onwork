import React from 'react';
import { X, ShieldCheck, FileText, Scale } from 'lucide-react';
import { LEGAL_TERMS_OF_SERVICE, LEGAL_PRIVACY_POLICY, LEGAL_SUBSCRIPTION_TERMS, LegalDocumentVersion } from '../../data/legalDocuments';

export type LegalDocType = 'cgu' | 'privacy' | 'subscription';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: LegalDocType;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, documentType }) => {
  if (!isOpen) return null;

  let doc: LegalDocumentVersion;
  let icon = <FileText className="w-5 h-5 text-[#f7c548]" />;

  switch (documentType) {
    case 'privacy':
      doc = LEGAL_PRIVACY_POLICY;
      icon = <ShieldCheck className="w-5 h-5 text-[#f7c548]" />;
      break;
    case 'subscription':
      doc = LEGAL_SUBSCRIPTION_TERMS;
      icon = <Scale className="w-5 h-5 text-[#f7c548]" />;
      break;
    case 'cgu':
    default:
      doc = LEGAL_TERMS_OF_SERVICE;
      icon = <FileText className="w-5 h-5 text-[#f7c548]" />;
      break;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#0E1524]/95 border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#f7c548]/15 border border-[#f7c548]/30">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {doc.title}
              </h2>
              <p className="text-xs text-[#8E97AB]">
                Version officielle {doc.version} · Dernière mise à jour : {doc.lastUpdated}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-sm text-[#D1D5DB] leading-relaxed">
          <div className="p-4 rounded-2xl bg-[#f7c548]/10 border border-[#f7c548]/20 text-xs text-[#fce49c] flex items-center gap-3">
            <Scale className="w-4 h-4 shrink-0" />
            <span>
              Document contractuel officiel opposable régissant les services de la plateforme eyes-onwork.
            </span>
          </div>

          {doc.sections.map((sec, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-sm font-semibold text-white text-uppercase tracking-wider">
                {sec.title}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed pl-2 border-l border-[#f7c548]/30">
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-[#8E97AB]">
          <span>© 2026 eyes-onwork · Tous droits réservés</span>
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-all cursor-pointer"
          >
            J’ai pris connaissance
          </button>
        </div>
      </div>
    </div>
  );
};
