import { jsPDF } from 'jspdf';
import { Client, DesignerProfile, Invoice, Quote, Project } from '../types';
import { formatCurrencySafe } from './pricingEngine';

export function generateDocumentPdf(
  doc: Quote | Invoice,
  type: 'quote' | 'invoice',
  client?: Client,
  profile?: DesignerProfile,
  project?: Project
): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const currency = profile?.currency || 'EUR';
  const isInvoice = type === 'invoice';
  const invoice = isInvoice ? (doc as Invoice) : undefined;
  const quote = !isInvoice ? (doc as Quote) : undefined;

  // Palette sobre et élégante (Charcoal, Gold, Soft Grey)
  pdf.setFillColor(11, 15, 26);
  pdf.rect(0, 0, 210, 297, 'F');

  // En-tête Studio
  pdf.setTextColor(201, 169, 110); // Accent Gold
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(profile?.studioName || 'STUDIO GRAPHIQUE', 20, 25);

  pdf.setTextColor(142, 151, 171); // Slate muted
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(profile?.name || 'Designer Freelance', 20, 31);
  pdf.text(profile?.email || 'contact@studio.fr', 20, 36);
  pdf.text(profile?.phone || '', 20, 41);
  if (profile?.siret) pdf.text(`SIRET : ${profile.siret}`, 20, 46);

  // Titre & Numéro du document
  const docTitle = isInvoice 
    ? (invoice?.isCreditNote ? 'AVOIR' : 'FACTURE') 
    : `DEVIS ${quote?.version ? `(V${quote.version})` : ''}`;
  const docNumber = isInvoice ? invoice?.invoiceNumber : quote?.quoteNumber;

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text(docTitle, 190, 25, { align: 'right' });

  pdf.setTextColor(201, 169, 110);
  pdf.setFontSize(12);
  pdf.text(`N° ${docNumber || ''}`, 190, 33, { align: 'right' });

  pdf.setTextColor(142, 151, 171);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Émis le : ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}`, 190, 39, { align: 'right' });
  pdf.text(`Échéance : ${new Date(doc.dueDate).toLocaleDateString('fr-FR')}`, 190, 44, { align: 'right' });

  // Séparateur fin doré
  pdf.setDrawColor(201, 169, 110);
  pdf.setLineWidth(0.4);
  pdf.line(20, 52, 190, 52);

  // Bloc Destinataire / Client
  pdf.setFillColor(18, 24, 38);
  pdf.roundedRect(20, 58, 85, 34, 2, 2, 'F');
  pdf.roundedRect(110, 58, 80, 34, 2, 2, 'F');

  // Client info
  pdf.setTextColor(201, 169, 110);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('CLIENT / DESTINATAIRE', 25, 64);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text(client?.company || client?.name || 'Client', 25, 71);

  pdf.setTextColor(142, 151, 171);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  if (client?.company && client.name) pdf.text(`Attn : ${client.name}`, 25, 76);
  if (client?.email) pdf.text(client.email, 25, 81);
  if (client?.address) pdf.text(client.address, 25, 86);

  // Objet & Modalités
  pdf.setTextColor(201, 169, 110);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('DÉTAILS DU PROJET & MODALITÉS', 115, 64);

  pdf.setTextColor(243, 244, 246);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  if (!isInvoice && quote) {
    pdf.text(`Délai estimé : ${quote.turnaroundTime || 'Selon planning'}`, 115, 71);
    pdf.text(`Révisions incluses : ${quote.revisionLimit || 3} tours`, 115, 76);
    pdf.text(`Acompte à la commande : ${quote.depositPercent}%`, 115, 81);
  } else if (invoice) {
    const typeLabel = invoice.type === 'deposit' ? 'Facture d’acompte' : (invoice.type === 'balance' ? 'Facture de solde' : 'Facture globale');
    pdf.text(`Type : ${typeLabel}`, 115, 71);
    if (invoice.originalInvoiceNumber) {
      pdf.text(`Référence annulée : ${invoice.originalInvoiceNumber}`, 115, 76);
    }
  }

  // Tableau des prestations : utilise STRICTEMENT les lignes copiées dans le document
  let startY = 102;
  pdf.setFillColor(28, 36, 56);
  pdf.rect(20, startY, 170, 8, 'F');

  pdf.setTextColor(201, 169, 110);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('DÉSIGNATION & PRESTATIONS', 24, startY + 5.5);
  pdf.text('QTÉ', 125, startY + 5.5, { align: 'center' });
  pdf.text('P.U HT', 145, startY + 5.5, { align: 'right' });
  pdf.text('TVA', 162, startY + 5.5, { align: 'right' });
  pdf.text('TOTAL HT', 186, startY + 5.5, { align: 'right' });

  startY += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(243, 244, 246);
  pdf.setFontSize(8.5);

  (doc.lines || []).forEach((line) => {
    const qty = line.quantity || 1;
    const price = line.unitPrice || 0;
    const lineHT = qty * price;
    const vatRate = line.vatRate !== undefined ? `${line.vatRate}%` : `${doc.vatRate || 20}%`;

    pdf.setFont('helvetica', 'bold');
    pdf.text(line.designation || 'Prestation graphique', 24, startY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(qty), 125, startY, { align: 'center' });
    pdf.text(formatCurrencySafe(price, currency), 145, startY, { align: 'right' });
    pdf.text(vatRate, 162, startY, { align: 'right' });
    pdf.text(formatCurrencySafe(lineHT, currency), 186, startY, { align: 'right' });

    if (line.description) {
      startY += 4.5;
      pdf.setTextColor(142, 151, 171);
      pdf.setFontSize(7.5);
      pdf.text(line.description, 24, startY);
      pdf.setTextColor(243, 244, 246);
      pdf.setFontSize(8.5);
    }

    startY += 7.5;
    pdf.setDrawColor(255, 255, 255);
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.2);
    pdf.line(20, startY - 2, 190, startY - 2);
  });

  // Bloc Totaux Récapitulatifs
  const totalsY = Math.max(startY + 4, 180);
  pdf.setFillColor(18, 24, 38);
  pdf.roundedRect(110, totalsY, 80, 48, 2, 2, 'F');

  pdf.setFontSize(8.5);
  pdf.setTextColor(142, 151, 171);
  pdf.text('Sous-total HT :', 115, totalsY + 7);
  pdf.text(formatCurrencySafe(doc.subtotal || 0, currency), 185, totalsY + 7, { align: 'right' });

  if (doc.discountAmount && doc.discountAmount > 0) {
    pdf.text(`Remise (${doc.discountPercent || 0}%) :`, 115, totalsY + 13);
    pdf.text(`-${formatCurrencySafe(doc.discountAmount, currency)}`, 185, totalsY + 13, { align: 'right' });
  }

  pdf.text(`TVA estimée :`, 115, totalsY + 19);
  pdf.text(formatCurrencySafe(doc.vatAmount || 0, currency), 185, totalsY + 19, { align: 'right' });

  pdf.setDrawColor(201, 169, 110);
  pdf.setLineWidth(0.3);
  pdf.line(115, totalsY + 23, 185, totalsY + 23);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('TOTAL TTC :', 115, totalsY + 29);
  pdf.setTextColor(201, 169, 110);
  pdf.text(formatCurrencySafe(doc.totalTTC || 0, currency), 185, totalsY + 29, { align: 'right' });

  if (isInvoice && invoice) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(52, 211, 153);
    pdf.text('Déjà réglé :', 115, totalsY + 36);
    pdf.text(formatCurrencySafe(invoice.paidAmount || 0, currency), 185, totalsY + 36, { align: 'right' });

    pdf.setTextColor(244, 114, 182);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Reste à payer :', 115, totalsY + 42);
    pdf.text(formatCurrencySafe(invoice.balanceDue || 0, currency), 185, totalsY + 42, { align: 'right' });
  } else if (!isInvoice && quote) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(201, 169, 110);
    pdf.text(`Acompte exigible (${quote.depositPercent}%) :`, 115, totalsY + 36);
    pdf.text(formatCurrencySafe(quote.depositAmount || 0, currency), 185, totalsY + 36, { align: 'right' });
  }

  // Mentions légales & Coordonnées bancaires
  pdf.setTextColor(142, 151, 171);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Coordonnées bancaires & Règlement :', 20, totalsY + 7);
  if (profile?.iban) pdf.text(`IBAN : ${profile.iban}`, 20, totalsY + 12);
  if (profile?.bic) pdf.text(`BIC : ${profile.bic}`, 20, totalsY + 17);
  pdf.text('Paiement par virement bancaire sous 30 jours à réception.', 20, totalsY + 22);

  // Pied de page légal
  pdf.setDrawColor(30, 41, 59);
  pdf.line(20, 275, 190, 275);

  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `${profile?.studioName || 'Studio Graphique'} — Conformément à l'art. L.441-6 du code de commerce, pénalités de retard applicables et indemnité forfaitaire pour frais de recouvrement de 40 €.`,
    105,
    282,
    { align: 'center', maxWidth: 165 }
  );

  return pdf;
}

export const generateDirectDocumentPDF = generateDocumentPdf;

export interface SubscriptionInvoiceData {
  invoiceNumber: string;
  date: string;
  planName: string;
  amount: number;
  period: string;
  clientName: string;
  clientEmail: string;
  currency?: string;
  cycle?: string;
  studioName?: string;
  ownerEmail?: string;
}

export function generateSubscriptionInvoicePDF(data: SubscriptionInvoiceData): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  pdf.setFontSize(16);
  pdf.text('FACTURE D’ABONNEMENT EYES-ONWORK', 20, 30);
  pdf.setFontSize(10);
  pdf.text(`Facture N° : ${data.invoiceNumber}`, 20, 45);
  pdf.text(`Date : ${data.date}`, 20, 52);
  pdf.text(`Formule : ${data.planName}`, 20, 59);
  pdf.text(`Montant TTC : ${data.amount} €`, 20, 66);
  pdf.text(`Période : ${data.period}`, 20, 73);
  pdf.text(`Client : ${data.clientName} (${data.clientEmail})`, 20, 80);
  return pdf;
}
