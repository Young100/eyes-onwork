import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Users, 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  FileText, 
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMontant } from '../../utils/formatUtils';
import { exportClientsCsv, exportInvoicesCsv, exportPaymentsCsv } from '../../utils/dataExport';
import { generateMonthlyStatsPDF } from '../../utils/statsPdfGenerator';

export const StatsView: React.FC = () => {
  const { 
    invoices = [], 
    quotes = [], 
    clients = [], 
    projects = [], 
    profile 
  } = useApp();

  const [period, setPeriod] = useState<'30d' | '3m' | '1y' | 'all'>('3m');

  const totalInvoiced = invoices.reduce((acc, inv) => acc + (inv.totalTTC || 0), 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
  const totalPending = invoices.reduce((acc, inv) => acc + (inv.balanceDue || 0), 0);

  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const totalQuotes = quotes.length;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

  // Revenue by client
  const clientRevenueMap: Record<string, number> = {};
  invoices.forEach(inv => {
    const cl = clients.find(c => c.id === inv.clientId);
    const name = cl?.company || 'Client';
    clientRevenueMap[name] = (clientRevenueMap[name] || 0) + inv.totalTTC;
  });

  const topClients = Object.entries(clientRevenueMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Revenue by project type
  const typeRevenueMap: Record<string, number> = {};
  projects.forEach(p => {
    const projInvoices = invoices.filter(inv => inv.projectId === p.id);
    const total = projInvoices.reduce((acc, inv) => acc + inv.totalTTC, 0);
    const typeLabel = p.type;
    typeRevenueMap[typeLabel] = (typeRevenueMap[typeLabel] || 0) + total;
  });

  const revenueByCategory = Object.entries(typeRevenueMap).map(([category, total]) => ({
    category,
    total
  }));

  const handleExportMonthlyPDF = () => {
    generateMonthlyStatsPDF('Octobre 2026', profile, {
      totalInvoiced,
      totalCollected,
      totalPending,
      quotesAcceptedCount: acceptedQuotes,
      quotesSentCount: totalQuotes,
      acceptanceRate,
      completedProjectsCount: projects.filter(p => p.currentStep === 'livre').length,
      activeProjectsCount: projects.filter(p => p.currentStep !== 'livre').length,
      topClients,
      revenueByCategory: [
        { category: 'Identité Visuelle & Charte', total: 4560 },
        { category: 'Packaging & Gamme Cosmétique', total: 3200 },
        { category: 'Édition & Couverture dorée', total: 2400 },
        { category: 'Kits Réseaux Sociaux & Bannières', total: 1200 }
      ]
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-16 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#f7c548]/20 text-[#f7c548]">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              Statistiques & Gestion
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#8E97AB] mt-1">
            Performances financières, taux de transformation des devis et exports comptables.
          </p>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10">
            {(['30d', '3m', '1y', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  period === p ? 'bg-[#f7c548] text-[#0B0F1A]' : 'text-[#8E97AB] hover:text-white'
                }`}
              >
                {p === '30d' && '30 jours'}
                {p === '3m' && '3 mois'}
                {p === '1y' && '1 an'}
                {p === 'all' && 'Global'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportMonthlyPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Rapport PDF</span>
          </button>
        </div>
      </div>

      {/* 4 Main Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-xs text-[#8E97AB]">Total facturé</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-bold text-white font-display tabular-nums">
              {formatMontant(totalInvoiced, profile.currency, 0)}
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            {invoices.length} factures émises
          </span>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-xs text-[#8E97AB]">Encaissé en caisse</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-bold text-[#5FB59A] font-display tabular-nums">
              {formatMontant(totalCollected, profile.currency, 0)}
            </span>
          </div>
          <span className="text-[10px] text-[#5FB59A] border-t border-white/10 pt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            {Math.round((totalCollected / (totalInvoiced || 1)) * 100)} % perçu
          </span>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-xs text-[#8E97AB]">Reste à percevoir</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-bold text-[#f7c548] font-display tabular-nums">
              {formatMontant(totalPending, profile.currency, 0)}
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            Créances & soldes en cours
          </span>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-xs text-[#8E97AB]">Taux d'acceptation</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-bold text-white font-display tabular-nums">
              {acceptanceRate} %
            </span>
          </div>
          <span className="text-[10px] text-[#8E97AB] border-t border-white/10 pt-1">
            {acceptedQuotes} devis signés sur {totalQuotes}
          </span>
        </div>
      </div>

      {/* Breakdown Grid: Top Clients & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Clients */}
        <div className="glass-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#f7c548]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                Clients les plus rentables
              </h3>
            </div>
            <span className="text-[11px] text-[#8E97AB]">Total TTC</span>
          </div>

          <div className="space-y-3">
            {topClients.map((cl, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#f7c548]/20 text-[#f7c548] flex items-center justify-center font-bold text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-white font-display">{cl.name}</span>
                </div>
                <span className="font-bold text-[#f7c548] font-mono tabular-nums">
                  {formatMontant(cl.total, profile.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Exports Card */}
        <div className="glass-panel p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Download className="w-4 h-4 text-[#5FB59A]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
                Exports comptables standards (CSV & Excel)
              </h3>
            </div>
            <p className="text-xs text-[#8E97AB] leading-relaxed">
              Exportez en un clic vos données au format CSV avec encodage UTF-8 conforme pour votre expert-comptable ou vos outils de gestion.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <button
              onClick={() => exportClientsCsv(clients)}
              className="glass-btn-secondary p-3 rounded-xl text-center text-xs font-semibold cursor-pointer hover:border-[#f7c548]/40"
            >
              <Users className="w-4 h-4 mx-auto mb-1 text-[#f7c548]" />
              <span>CSV Clients</span>
            </button>

            <button
              onClick={() => exportInvoicesCsv(invoices, clients)}
              className="glass-btn-secondary p-3 rounded-xl text-center text-xs font-semibold cursor-pointer hover:border-[#5FB59A]/40"
            >
              <FileText className="w-4 h-4 mx-auto mb-1 text-[#5FB59A]" />
              <span>CSV Factures</span>
            </button>

            <button
              onClick={() => exportPaymentsCsv(invoices, clients)}
              className="glass-btn-secondary p-3 rounded-xl text-center text-xs font-semibold cursor-pointer hover:border-[#f7c548]/40"
            >
              <CreditCard className="w-4 h-4 mx-auto mb-1 text-[#f7c548]" />
              <span>CSV Paiements</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
