import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Loader2,
  FileCheck,
  Check
} from 'lucide-react';
import { Quote, Invoice, Client, Project, DesignerProfile } from '../../types';
import { generateDirectDocumentPDF } from '../../utils/pdfGenerator';
import { formatCurrencySafe } from '../../utils/formatUtils';

interface DocumentA4ModalProps {
  document: Quote | Invoice;
  type: 'quote' | 'invoice';
  client?: Client;
  project?: Project;
  profile: DesignerProfile;
  onClose: () => void;
}

export const DocumentA4Modal: React.FC<DocumentA4ModalProps> = ({
  document,
  type,
  client,
  project,
  profile,
  onClose
}) => {
  const isQuote = type === 'quote';
  const quote = isQuote ? (document as Quote) : undefined;
  const invoice = !isQuote ? (document as Invoice) : undefined;

  const docNumber = isQuote ? quote!.quoteNumber : invoice!.invoiceNumber;
  const docTitle = isQuote ? 'DEVIS' : (
    invoice!.type === 'deposit' ? 'FACTURE D\'ACOMPTE' :
    invoice!.type === 'balance' ? 'FACTURE DE SOLDE' : 'FACTURE'
  );

  const paperRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);

  const [isPrinting, setIsPrinting] = useState(false);

  const formatCurrency = (val: number) => {
    return formatCurrencySafe(val, profile.currency || 'EUR', 2);
  };

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    window.print();
    setTimeout(() => {
      setIsPrinting(false);
    }, 1500);
  };

  const handleDownloadPDF = () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);

    try {
      generateDirectDocumentPDF(document, type, client, profile);
      setDownloadSuccessToast(true);
      setTimeout(() => setDownloadSuccessToast(false), 3500);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const safeLines = document.lines || [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-hidden animate-fadeIn">
      {/* Top Floating Control Bar */}
      <div className="w-full max-w-4xl bg-[#111625]/90 border border-white/10 shadow-xl rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-white shrink-0 z-10 backdrop-blur-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#f7c548]/20 text-[#f7c548] flex items-center justify-center shrink-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xs sm:text-sm tracking-wide truncate text-white">
                Prévisualisation PDF — {docNumber}
              </span>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-[#f7c548]/20 text-[#f7c548] font-medium border border-[#f7c548]/30 shrink-0">
                Format A4 Officiel
              </span>
            </div>
            <p className="text-[11px] text-[#8E97AB] truncate hidden sm:block">
              Vérifiez le document avant téléchargement en fichier .pdf certifié
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom buttons */}
          <div className="hidden md:flex items-center bg-white/[0.06] border border-white/10 rounded-xl p-0.5 text-xs text-[#8E97AB]">
            <button
              onClick={() => setZoomLevel(prev => Math.max(70, prev - 15))}
              className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[10px] text-white/80 tabular-nums">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(130, prev + 15))}
              className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Taille réelle (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            title="Imprimer ou enregistrer en PDF via le navigateur"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20 disabled:opacity-50"
            title="Télécharger directement le fichier PDF (.pdf)"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Génération PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="font-bold">Télécharger PDF</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer la prévisualisation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {downloadSuccessToast && (
        <div className="fixed top-20 z-50 px-4 py-2.5 rounded-xl bg-[#5FB59A] text-[#0B0F1A] font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Fichier {docNumber}.pdf téléchargé avec succès !</span>
        </div>
      )}

      {/* Scrollable Document Area */}
      <div className="w-full flex-1 overflow-y-auto overflow-x-auto py-4 sm:py-6 flex items-start justify-center">
        <div 
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
          className="w-full max-w-4xl"
        >
          {/* Paper Container: High-fidelity styling */}
          <div 
            id="printable-document"
            ref={paperRef}
            className="bg-[#FAF9F6] text-[#1B2233] p-6 sm:p-10 md:p-12 rounded-2xl shadow-2xl border border-white/20 font-sans print:shadow-none print:border-none print:p-0 min-h-[1050px] flex flex-col justify-between"
          >
            <div>
              {/* Header row: Designer on left, Document info on right */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 pb-8 border-b-2 border-[#0B0F1A]/10">
                {/* Designer Identity */}
                <div className="space-y-1.5 max-w-sm">
                  <div className="font-display font-bold text-2xl text-[#0B0F1A] tracking-tight">
                    {profile.studioName || profile.name}
                  </div>
                  <p className="text-xs text-[#525F7A] font-medium leading-relaxed">
                    <strong>{profile.name}</strong><br />
                    {profile.address}<br />
                    Email : <span className="text-[#0B0F1A]">{profile.email}</span><br />
                    Tél : <span className="text-[#0B0F1A]">{profile.phone}</span><br />
                    SIRET : <span className="font-mono text-[#0B0F1A]">{profile.siret}</span>
                  </p>
                </div>

                {/* Document Header & Meta */}
                <div className="sm:text-right space-y-2">
                  <div className="inline-block px-3.5 py-1.5 rounded-lg bg-[#0B0F1A] text-white font-display font-bold text-base tracking-wider uppercase shadow-sm">
                    {docTitle}
                  </div>
                  <div className="text-base font-bold text-[#0B0F1A] font-display">
                    N° {docNumber}
                  </div>
                  <div className="text-xs text-[#525F7A] space-y-1">
                    <div>Date d'émission : <strong className="text-[#0B0F1A]">{new Date(document.createdAt).toLocaleDateString('fr-FR')}</strong></div>
                    {isQuote && (
                      <div>Validité jusqu'au : <strong className="text-[#0B0F1A]">{new Date(quote!.dueDate).toLocaleDateString('fr-FR')}</strong></div>
                    )}
                    {!isQuote && (
                      <div>Échéance de règlement : <strong className="text-[#0B0F1A]">{new Date(invoice!.dueDate).toLocaleDateString('fr-FR')}</strong></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Client Details Section */}
              <div className="my-8 flex justify-end">
                <div className="w-full sm:max-w-sm p-4 rounded-xl bg-[#F0F3F8] border border-[#E2E6EE] space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E97AB] block">
                    Destinataire / Client
                  </span>
                  <div className="font-bold text-sm text-[#0B0F1A] font-display">
                    {client?.company || 'Client'}
                  </div>
                  <div className="text-xs text-[#525F7A] leading-relaxed">
                    À l'attention de <strong>{client?.name || 'Direction'}</strong><br />
                    {client?.address || 'Adresse du client'}<br />
                    {client?.email && <span>Email : {client.email}</span>}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto my-6">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#0B0F1A] text-[#0B0F1A] font-bold uppercase tracking-wider text-[11px] bg-[#0B0F1A]/[0.03]">
                      <th className="py-3 px-3">Description des prestations</th>
                      <th className="py-3 px-3 text-center">Qté</th>
                      <th className="py-3 px-3 text-right">Prix Unit. HT</th>
                      <th className="py-3 px-3 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6EE]">
                    {safeLines.map((line, idx) => (
                      <tr key={line.id || idx}>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#0B0F1A] font-display text-[13px]">
                            {line.designation}
                          </div>
                          {line.description && (
                            <div className="text-[11px] text-[#525F7A] mt-1 max-w-lg leading-relaxed">
                              {line.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center tabular-nums font-medium text-[#525F7A]">
                          {line.quantity}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[#525F7A]">
                          {formatCurrency(line.unitPrice)}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-[#0B0F1A]">
                          {formatCurrency(line.total)}
                        </td>
                      </tr>
                    ))}
                    {safeLines.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-xs text-[#8E97AB]">
                          Aucune ligne de prestation saisie.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-6 border-t-2 border-[#0B0F1A]/10">
                <div className="max-w-md text-xs text-[#525F7A] space-y-2.5">
                  {isQuote && quote?.turnaroundTime && (
                    <div>
                      <span className="font-bold text-[#0B0F1A]">Délai estimé :</span> {quote.turnaroundTime}
                    </div>
                  )}
                  {isQuote && quote?.revisionLimit && (
                    <div>
                      <span className="font-bold text-[#0B0F1A]">Cycles de retouches inclus :</span> {quote.revisionLimit} révisions
                    </div>
                  )}
                  <div className="text-[11px] leading-relaxed bg-white/70 p-3 rounded-lg border border-[#E2E6EE]">
                    <strong className="text-[#0B0F1A] block mb-0.5">Modalités de règlement :</strong>
                    {isQuote 
                      ? quote?.termsAndConditions || profile.legalNotice 
                      : profile.legalNotice}
                  </div>
                  
                  {/* Bank info */}
                  <div className="text-[11px] text-[#525F7A] pt-1">
                    <span className="font-bold text-[#0B0F1A]">Coordonnées bancaires pour virement :</span><br />
                    IBAN : <strong className="font-mono text-[#0B0F1A]">{profile.iban || 'FR76 3000 4000 0000 1234 5678 901'}</strong> · BIC : <strong className="font-mono text-[#0B0F1A]">{profile.bic || 'BNPAFRPPXXX'}</strong>
                  </div>
                </div>

                <div className="w-full sm:w-80 space-y-2 text-xs bg-[#F0F3F8] p-4 rounded-xl border border-[#E2E6EE]">
                  <div className="flex justify-between py-1 border-b border-[#E2E6EE] text-[#525F7A]">
                    <span>Total net HT :</span>
                    <span className="font-bold text-[#0B0F1A] tabular-nums">{formatCurrency(document.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E2E6EE] text-[#525F7A]">
                    <span>TVA ({document.vatRate}%) :</span>
                    <span className="font-bold text-[#0B0F1A] tabular-nums">{formatCurrency(document.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-base font-bold text-[#0B0F1A] font-display border-b-2 border-[#0B0F1A]">
                    <span>Total TTC :</span>
                    <span className="tabular-nums text-[#0B0F1A]">{formatCurrency(document.totalTTC)}</span>
                  </div>

                  {isQuote && (
                    <div className="pt-2 text-[11px] text-[#525F7A] space-y-1">
                      <div className="flex justify-between font-semibold text-[#0B0F1A]">
                        <span>Acompte demandé ({quote!.depositPercent}%) :</span>
                        <span className="tabular-nums">{formatCurrency(quote!.depositAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[#525F7A]">
                        <span>Solde à la livraison :</span>
                        <span className="tabular-nums">{formatCurrency(quote!.totalTTC - quote!.depositAmount)}</span>
                      </div>
                    </div>
                  )}

                  {!isQuote && invoice && (
                    <div className="pt-2 text-[11px] text-[#525F7A] space-y-1">
                      <div className="flex justify-between text-[#525F7A]">
                        <span>Déjà perçu :</span>
                        <span className="tabular-nums font-semibold text-[#5FB59A]">{formatCurrency(invoice.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[#0B0F1A]">
                        <span>Net à payer :</span>
                        <span className="tabular-nums text-[#D9695F] text-sm">{formatCurrency(invoice.balanceDue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signature / Validation Footer */}
            <div className="mt-12 pt-6 border-t-2 border-[#0B0F1A]/10 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
              <div className="space-y-1 text-[11px] text-[#8E97AB] max-w-sm">
                <div className="flex items-center gap-1.5 text-[#525F7A] font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#f7c548]" />
                  <span>Document contractuel édité via eyes-onwork</span>
                </div>
                <p>Dispensé d’immatriculation au RCS et au RM selon l’article L 123-1-1 du code de commerce. TVA non applicable art. 293 B du CGI (si micro-entrepreneur) ou taux standard applicable.</p>
              </div>

              <div className="border-2 border-[#CBD2E1] rounded-xl p-3 w-full sm:w-64 bg-white space-y-2 text-center shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E97AB] block">
                  {isQuote ? 'Bon pour accord & signature' : 'Visa de conformité'}
                </span>
                {isQuote && quote?.status === 'accepted' ? (
                  <div className="py-2 text-[#5FB59A] space-y-1">
                    <CheckCircle2 className="w-6 h-6 mx-auto" />
                    <span className="text-xs font-bold block">Signé électroniquement</span>
                    <span className="text-[10px] text-[#525F7A] block">
                      Par {quote.acceptedByName || 'Client'} le {new Date(quote.acceptedAt || '').toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ) : (
                  <div className="h-14 border border-dashed border-[#CBD2E1] rounded flex items-center justify-center text-[10px] text-[#8E97AB]">
                    Mention « Bon pour accord » + Date et signature
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Bar */}
      <div className="w-full max-w-4xl bg-[#111625]/90 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-[#8E97AB] shrink-0 z-10 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <span>Total TTC : <strong className="text-white text-sm tabular-nums">{formatCurrency(document.totalTTC)}</strong></span>
          <span className="text-white/20">|</span>
          <span className="hidden sm:inline">Fichier : <code className="text-[#f7c548] font-mono">{docNumber}.pdf</code></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            Fermer
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Télécharger le fichier PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
