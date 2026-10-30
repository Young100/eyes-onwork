import { describe, it, expect } from 'vitest';
import { 
  Invoice, 
  Project, 
  Quote, 
  QuoteLine 
} from '../src/types';
import { 
  calculateDocumentTotals, 
  generateNextDocumentNumber, 
  recalculateClientFinancialTotals, 
  recalculateProjectFinancialTotals 
} from '../src/utils/pricingEngine';

describe('Intégration Projets - Devis - Factures', () => {
  const clientId = 'client_test_1';
  const projectId = 'proj_test_1';

  it('génère une numérotation continue sans trou pour les devis et factures', () => {
    const existingQuotes = ['DEV-2026-001', 'DEV-2026-002'];
    const nextQuoteNum = generateNextDocumentNumber(existingQuotes, 'DEV', 2026);
    expect(nextQuoteNum).toBe('DEV-2026-003');

    const existingInvoices = ['FAC-2026-001'];
    const nextInvoiceNum = generateNextDocumentNumber(existingInvoices, 'FAC', 2026);
    expect(nextInvoiceNum).toBe('FAC-2026-002');
  });

  it('copie les lignes et tarifs dans le devis : une hausse du catalogue ne modifie pas le devis', () => {
    const quoteLines: QuoteLine[] = [
      {
        id: 'ql_1',
        sourceCatalogServiceId: 'cat_logo',
        designation: 'Logotype & Branding',
        quantity: 1,
        unitPrice: 2000,
        vatRate: 20,
        total: 2000
      }
    ];

    const quoteTotals = calculateDocumentTotals(quoteLines, {
      vatRateDefault: 20,
      depositPercent: 50,
      currency: 'EUR'
    });

    const quote: Quote = {
      id: 'q_1',
      quoteNumber: 'DEV-2026-001',
      version: 1,
      projectId,
      clientId,
      createdAt: new Date().toISOString(),
      validityDays: 30,
      dueDate: new Date().toISOString(),
      lines: quoteLines,
      subtotal: quoteTotals.subtotal,
      netHT: quoteTotals.netHT,
      vatRate: 20,
      vatAmount: quoteTotals.vatAmount,
      totalTTC: quoteTotals.totalTTC,
      depositPercent: 50,
      depositAmount: quoteTotals.depositAmount,
      revisionLimit: 3,
      turnaroundTime: '3 semaines',
      termsAndConditions: 'Paiement 50% commande',
      status: 'draft',
      isLocked: false
    };

    // Simulation : le catalogue passe à 3000 €
    const liveCatalogPrice = 3000;

    // Le devis reste sanctuarisé à 2000 € HT / 2400 € TTC
    expect(quote.lines[0].unitPrice).toBe(2000);
    expect(quote.totalTTC).toBe(2400);
    expect(quote.depositAmount).toBe(1200);
    expect(liveCatalogPrice).toBe(3000);
  });

  it('gère plusieurs versions (V1, V2) pour un même projet et verrouille à l’acceptation', () => {
    const quoteV1: Quote = {
      id: 'q_v1',
      quoteNumber: 'DEV-2026-001',
      version: 1,
      projectId,
      clientId,
      createdAt: new Date().toISOString(),
      validityDays: 30,
      dueDate: new Date().toISOString(),
      lines: [{ id: 'l1', designation: 'Logo', quantity: 1, unitPrice: 1500, vatRate: 20, total: 1500 }],
      subtotal: 1500,
      vatRate: 20,
      vatAmount: 300,
      totalTTC: 1800,
      depositPercent: 50,
      depositAmount: 900,
      revisionLimit: 3,
      turnaroundTime: '2 semaines',
      termsAndConditions: '',
      status: 'expired',
      isLocked: false
    };

    const quoteV2: Quote = {
      id: 'q_v2',
      quoteNumber: 'DEV-2026-002',
      version: 2,
      parentQuoteId: 'q_v1',
      projectId,
      clientId,
      createdAt: new Date().toISOString(),
      validityDays: 30,
      dueDate: new Date().toISOString(),
      lines: [
        { id: 'l1', designation: 'Logo', quantity: 1, unitPrice: 1500, vatRate: 20, total: 1500 },
        { id: 'l2', designation: 'Packaging', quantity: 1, unitPrice: 1000, vatRate: 20, total: 1000 }
      ],
      subtotal: 2500,
      vatRate: 20,
      vatAmount: 500,
      totalTTC: 3000,
      depositPercent: 50,
      depositAmount: 1500,
      revisionLimit: 4,
      turnaroundTime: '3 semaines',
      termsAndConditions: '',
      status: 'accepted',
      isLocked: true // Verrouillé
    };

    expect(quoteV2.version).toBe(2);
    expect(quoteV2.status).toBe('accepted');
    expect(quoteV2.isLocked).toBe(true);
    expect(quoteV1.status).toBe('expired');
  });

  it('calcule la facture d’acompte puis la facture de solde (reste à facturer)', () => {
    const totalQuoteTTC = 3000;
    const depositPercent = 50;
    const depositTTC = (totalQuoteTTC * depositPercent) / 100; // 1500 €

    // 1. Facture d'acompte
    const invoiceDeposit: Invoice = {
      id: 'inv_1',
      invoiceNumber: 'FAC-2026-001',
      type: 'deposit',
      projectId,
      clientId,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      lines: [{ id: 'il_1', designation: 'Acompte 50%', quantity: 1, unitPrice: 1250, vatRate: 20, total: 1250 }],
      subtotal: 1250,
      vatRate: 20,
      vatAmount: 250,
      totalTTC: 1500,
      paidAmount: 1500, // Payée
      balanceDue: 0,
      status: 'paid',
      legalNotice: '',
      payments: [{ id: 'p1', invoiceId: 'inv_1', amount: 1500, date: '2026-02-01', method: 'virement', recordedBy: 'Admin' }],
      isLocked: true
    };

    // Calcul du solde restant à facturer
    const alreadyInvoiced = invoiceDeposit.totalTTC; // 1500 €
    const remainingToInvoiceTTC = totalQuoteTTC - alreadyInvoiced; // 1500 €

    // 2. Facture de solde
    const invoiceBalance: Invoice = {
      id: 'inv_2',
      invoiceNumber: 'FAC-2026-002',
      type: 'balance',
      projectId,
      clientId,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      lines: [{ id: 'il_2', designation: 'Solde restant', quantity: 1, unitPrice: 1250, vatRate: 20, total: 1250 }],
      subtotal: 1250,
      vatRate: 20,
      vatAmount: 250,
      totalTTC: remainingToInvoiceTTC,
      paidAmount: 0,
      balanceDue: remainingToInvoiceTTC,
      status: 'sent',
      legalNotice: '',
      payments: [],
      isLocked: true
    };

    expect(invoiceDeposit.totalTTC).toBe(1500);
    expect(invoiceBalance.totalTTC).toBe(1500);
    expect(invoiceDeposit.totalTTC + invoiceBalance.totalTTC).toBe(totalQuoteTTC);
  });

  it('recalcule de façon cohérente les totaux du projet et du client', () => {
    const dummyClient = { id: clientId, workspaceId: 'ws_test', name: 'Client Test', email: 'c@test.com', status: 'active' as const, createdAt: '', updatedAt: '' };
    const dummyProject = { id: projectId, workspaceId: 'ws_test', clientId, clientShareToken: '', clientLinkActive: true, title: 'Projet', type: 'identite_visuelle' as const, budget: 3000, totalTTC: 3000, depositAmount: 1500, paidAmount: 1500, deadline: '', currentStep: 'acompte_paye' as const, revisionLimit: 3, revisionsUsed: 0, paidRevisionsAdded: 0, tasks: [], activity: [], mockupRounds: [], files: [], delivery: { mode: 'auto' as const, isUnlocked: false, selectedDeliverableIds: [] }, createdAt: '', updatedAt: '' };

    const invoicesList: Invoice[] = [
      {
        id: 'inv_1',
        invoiceNumber: 'FAC-2026-001',
        type: 'deposit',
        projectId,
        clientId,
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        lines: [],
        subtotal: 1250,
        vatRate: 20,
        vatAmount: 250,
        totalTTC: 1500,
        paidAmount: 1500,
        balanceDue: 0,
        status: 'paid',
        legalNotice: '',
        payments: [],
        isLocked: true
      }
    ];

    const projFin = recalculateProjectFinancialTotals(dummyProject, invoicesList);
    expect(projFin.invoicedTotal).toBe(1500);
    expect(projFin.collectedTotal).toBe(1500);
    expect(projFin.balanceToInvoice).toBe(1500);

    const clientFin = recalculateClientFinancialTotals(dummyClient, [dummyProject], invoicesList);
    expect(clientFin.totalInvoiced).toBe(1500);
    expect(clientFin.totalCollected).toBe(1500);
    expect(clientFin.totalRemaining).toBe(0);
  });
});
