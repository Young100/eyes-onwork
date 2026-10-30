import JSZip from 'jszip';
import { Client, Invoice, Project, Quote } from '../types';

/**
 * Exports clients, invoices, or payments as standard CSV files
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const processCell = (cell: string | number) => {
    let str = cell === null || cell === undefined ? '' : String(cell);
    if (str.includes('"') || str.includes(';') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(processCell).join(';'),
    ...rows.map(row => row.map(processCell).join(';'))
  ].join('\r\n');

  // Prepend UTF-8 BOM so Excel opens accents and special characters without encoding errors
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportClientsCsv(clients: Client[]): void {
  const headers = ['ID', 'Société', 'Nom du contact', 'Email', 'Téléphone', 'WhatsApp', 'Adresse', 'Statut', 'Date création'];
  const rows = clients.map(c => [
    c.id,
    c.company,
    c.name,
    c.email,
    c.phone,
    c.whatsapp || '',
    c.address,
    c.status,
    new Date(c.createdAt).toLocaleDateString('fr-FR')
  ]);
  exportToCsv(`clients_eyesonwork_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportInvoicesCsv(invoices: Invoice[], clients: Client[]): void {
  const headers = ['Numéro', 'Client', 'Type', 'Statut', 'Date émission', 'Date échéance', 'Total HT', 'TVA %', 'Montant TVA', 'Total TTC', 'Encaissé', 'Solde dû'];
  const rows = invoices.map(inv => {
    const cl = clients.find(c => c.id === inv.clientId);
    return [
      inv.invoiceNumber,
      cl?.company || 'Client',
      inv.type,
      inv.status,
      new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      new Date(inv.dueDate).toLocaleDateString('fr-FR'),
      inv.subtotal,
      inv.vatRate,
      inv.vatAmount,
      inv.totalTTC,
      inv.paidAmount,
      inv.balanceDue
    ];
  });
  exportToCsv(`factures_eyesonwork_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportPaymentsCsv(invoices: Invoice[], clients: Client[]): void {
  const headers = ['ID Paiement', 'Facture N°', 'Client', 'Date versement', 'Mode', 'Montant', 'Référence', 'Enregistré par'];
  const rows: (string | number)[][] = [];

  invoices.forEach(inv => {
    const cl = clients.find(c => c.id === inv.clientId);
    (inv.payments || []).forEach(p => {
      rows.push([
        p.id,
        inv.invoiceNumber,
        cl?.company || 'Client',
        new Date(p.date).toLocaleDateString('fr-FR'),
        p.method,
        p.amount,
        p.reference || '',
        p.recordedBy
      ]);
    });
  });

  exportToCsv(`encaissements_eyesonwork_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

/**
 * Creates and downloads a complete ZIP archive with all studio data in JSON format
 */
export async function exportFullStudioZip(data: {
  profile: any;
  clients: Client[];
  projects: Project[];
  quotes: Quote[];
  invoices: Invoice[];
  notifications: any[];
  catalog?: any[];
  appointments?: any[];
  leads?: any[];
  auditLogs?: any[];
}): Promise<void> {
  const zip = new JSZip();

  // 1. JSON Dump
  zip.file('studio_profile.json', JSON.stringify(data.profile, null, 2));
  zip.file('clients.json', JSON.stringify(data.clients, null, 2));
  zip.file('projets.json', JSON.stringify(data.projects, null, 2));
  zip.file('devis.json', JSON.stringify(data.quotes, null, 2));
  zip.file('factures.json', JSON.stringify(data.invoices, null, 2));
  zip.file('catalogue_prestations.json', JSON.stringify(data.catalog || [], null, 2));
  zip.file('rendez_vous.json', JSON.stringify(data.appointments || [], null, 2));
  zip.file('demandes_prospects.json', JSON.stringify(data.leads || [], null, 2));
  zip.file('journal_audit.json', JSON.stringify(data.auditLogs || [], null, 2));

  // 2. Readme
  zip.file(
    'LISEZ-MOI.txt',
    `Sauvegarde complète exportée depuis eyes-onwork le ${new Date().toLocaleString('fr-FR')}.\nContient l'ensemble de votre base de données studio en format standard JSON.\nVous pouvez réimporter ces fichiers à tout moment.`
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sauvegarde_eyesonwork_${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Simple CSV parser for client import
 */
export function parseClientsCsv(csvText: string): Partial<Client>[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return [];

  // Determine separator (; or ,)
  const header = lines[0];
  const sep = header.includes(';') ? ';' : ',';

  const clients: Partial<Client>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2 && parts[0]) {
      clients.push({
        company: parts[0] || 'Nouvelle Société',
        name: parts[1] || 'Contact',
        email: parts[2] || '',
        phone: parts[3] || '',
        address: parts[4] || '',
        status: 'active'
      });
    }
  }

  return clients;
}
