import jsPDF from 'jspdf';
import { DesignerProfile, Invoice, Project, Quote } from '../types';
import { formatMontant, sanitizePdfFileName } from './formatUtils';

export function generateMonthlyStatsPDF(
  monthLabel: string,
  profile: DesignerProfile,
  metrics: {
    totalInvoiced: number;
    totalCollected: number;
    totalPending: number;
    quotesAcceptedCount: number;
    quotesSentCount: number;
    acceptanceRate: number;
    completedProjectsCount: number;
    activeProjectsCount: number;
    topClients: { name: string; total: number }[];
    revenueByCategory: { category: string; total: number }[];
  }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currency = profile.currency || 'EUR';

  const margin = 20;
  const contentWidth = 170;
  const rightEdge = margin + contentWidth;

  const darkNavy = [11, 15, 26] as const;
  const gold = [201, 169, 110] as const;
  const darkText = [30, 38, 52] as const;
  const textMuted = [74, 84, 104] as const;
  const borderLight = [226, 232, 240] as const;
  const bgCard = [248, 249, 252] as const;
  const green = [46, 133, 98] as const;

  // Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((profile.studioName || profile.name).toUpperCase(), margin, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text('RAPPORT D’ACTIVITÉ', rightEdge, 16, { align: 'right' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(monthLabel.toUpperCase(), rightEdge, 23, { align: 'right' });

  let y = 44;

  // Title & intro
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(`Synthèse de gestion & Performance financière — ${monthLabel}`, margin, y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}  ·  Studio ${profile.studioName}`, margin, y + 6);

  y += 16;

  // 4 KPI Cards in a row
  const kpiW = (contentWidth - 9) / 4;
  const kpiH = 24;

  const kpis = [
    { label: 'Facturé TTC', val: formatMontant(metrics.totalInvoiced, currency), color: darkNavy },
    { label: 'Encaissé', val: formatMontant(metrics.totalCollected, currency), color: green },
    { label: 'Reste à percevoir', val: formatMontant(metrics.totalPending, currency), color: gold },
    { label: 'Taux conversion', val: `${metrics.acceptanceRate}%`, color: darkNavy }
  ];

  kpis.forEach((kpi, idx) => {
    const kX = margin + idx * (kpiW + 3);
    doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(kX, y, kpiW, kpiH, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.label.toUpperCase(), kX + 3, y + 6);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kX + 3, y + 16);
  });

  y += 32;

  // Top Clients Table
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Clients les plus rentables', margin, y);

  y += 4;
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text('CLIENT / ENTREPRISE', margin + 4, y + 4.8);
  doc.text('CHIFFRE D’AFFAIRES TTC', rightEdge - 4, y + 4.8, { align: 'right' });

  y += 7;
  (metrics.topClients || []).forEach(cl => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text(cl.name, margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text(formatMontant(cl.total, currency), rightEdge - 4, y + 5, { align: 'right' });

    y += 7.5;
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, y, rightEdge, y);
  });

  y += 12;

  // Breakdown by category
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Répartition par type de prestation', margin, y);

  y += 4;
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text('PRESTATION', margin + 4, y + 4.8);
  doc.text('MONTANT TOTAL', rightEdge - 4, y + 4.8, { align: 'right' });

  y += 7;
  (metrics.revenueByCategory || []).forEach(cat => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text(cat.category, margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text(formatMontant(cat.total, currency), rightEdge - 4, y + 5, { align: 'right' });

    y += 7.5;
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, y, rightEdge, y);
  });

  // Footer
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, 280, rightEdge, 280);
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Généré avec eyes-onwork  ·  Données certifiées conformes au grand livre studio', margin, 290);
  doc.text('Page 1 / 1', rightEdge, 290, { align: 'right' });

  doc.save(sanitizePdfFileName(`RAPPORT_MENSUEL_${monthLabel}`));
}
