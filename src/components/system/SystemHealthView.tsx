import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Server, 
  Mail, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Lock, 
  Cpu, 
  Activity,
  FileCheck
} from 'lucide-react';

interface SystemHealthData {
  status: string;
  uptimeSeconds: number;
  environment: string;
  serverTime: string;
  smtp: {
    configured: boolean;
    sender: string;
    adminEmail: string;
  };
  security: {
    securityHeaders: boolean;
    rateLimitingActive: boolean;
    xssSanitizationActive: boolean;
    corsRestricted: boolean;
    maxUploadSizeMb: number;
  };
  memory: {
    rssMb: string;
    heapUsedMb: string;
  };
  firestoreAdmin?: {
    status: 'connected' | 'error';
    testedAt: string;
    writeSuccess: boolean;
    writeLatencyMs: number;
    readSuccess: boolean;
    readLatencyMs: number;
    cleanupSuccess: boolean;
    error?: string;
    probeDoc: string;
  };
  recentErrorsCount: number;
}

interface ServerErrorItem {
  id: string;
  timestamp: string;
  source: 'server' | 'client';
  message: string;
  stack?: string;
  path?: string;
  ip?: string;
}

export const SystemHealthView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [errors, setErrors] = useState<ServerErrorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const [isTestingProbe, setIsTestingProbe] = useState(false);

  const fetchHealthAndErrors = async () => {
    setIsLoading(true);
    try {
      const [healthRes, errorsRes] = await Promise.all([
        fetch('/api/system/health'),
        fetch('/api/system/errors')
      ]);

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
      }
      if (errorsRes.ok) {
        const eData = await errorsRes.json();
        setErrors(eData.errors || []);
      }
      setLastCheck(new Date());
    } catch (err) {
      console.warn('[SystemHealth] Erreur de chargement:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestFirestoreProbe = async () => {
    setIsTestingProbe(true);
    try {
      const res = await fetch('/api/system/test-firestore', { method: 'POST' });
      if (res.ok) {
        await fetchHealthAndErrors();
      }
    } catch (err) {
      console.warn('[SystemHealth] Probe test error:', err);
    } finally {
      setIsTestingProbe(false);
    }
  };

  useEffect(() => {
    fetchHealthAndErrors();
    const interval = setInterval(fetchHealthAndErrors, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}j ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#5FB59A]/15 text-[#5FB59A] border border-[#5FB59A]/30">
              <Activity className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
              État du Système &amp; Sécurité
            </h1>
          </div>
          <p className="text-xs text-[#8E97AB]">
            Surveillance en temps réel de l'infrastructure, du serveur SMTP, de l'intégrité et des journaux d'erreurs.
          </p>
        </div>

        <button
          onClick={fetchHealthAndErrors}
          disabled={isLoading}
          className="glass-btn-secondary flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-white/10 hover:border-[#f7c548]/50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#f7c548] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser (auto 30s)</span>
        </button>
      </div>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server & Uptime */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8E97AB] uppercase tracking-wider">Serveur Node.js</span>
            <Server className="w-4 h-4 text-[#f7c548]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5FB59A] animate-pulse" />
              <span className="text-base font-bold text-white font-display">En ligne</span>
            </div>
            <span className="text-xs text-[#8E97AB] block mt-1">
              Actif depuis : <strong>{health ? formatUptime(health.uptimeSeconds) : '...'}</strong>
            </span>
          </div>
          <div className="text-[10px] text-white/50 border-t border-white/10 pt-2 flex justify-between">
            <span>Environnement</span>
            <span className="text-white font-mono uppercase">{health?.environment || 'dev'}</span>
          </div>
        </div>

        {/* SMTP Mail Status */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8E97AB] uppercase tracking-wider">Passerelle Email</span>
            <Mail className="w-4 h-4 text-[#06665F]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health?.smtp.configured ? 'bg-[#5FB59A]' : 'bg-[#f7c548]'}`} />
              <span className="text-base font-bold text-white font-display">
                {health?.smtp.configured ? 'Gmail SMTP Actif' : 'Mode Simulation'}
              </span>
            </div>
            <span className="text-xs text-[#8E97AB] block mt-1 truncate" title={health?.smtp.sender}>
              {health?.smtp.sender || 'Non configuré'}
            </span>
          </div>
          <div className="text-[10px] text-white/50 border-t border-white/10 pt-2 flex justify-between">
            <span>Admin Notif</span>
            <span className="text-[#06665F] font-semibold truncate max-w-[130px]">{health?.smtp.adminEmail}</span>
          </div>
        </div>

        {/* Security & Headers */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8E97AB] uppercase tracking-wider">Durcissement HTTP</span>
            <ShieldCheck className="w-4 h-4 text-[#5FB59A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#5FB59A]" />
              <span className="text-base font-bold text-white font-display">Conforme AA</span>
            </div>
            <span className="text-xs text-[#8E97AB] block mt-1">
              En-têtes CSP, nosniff, CORS &amp; XSS actifs
            </span>
          </div>
          <div className="text-[10px] text-white/50 border-t border-white/10 pt-2 flex justify-between">
            <span>Anti-Abus IP</span>
            <span className="text-[#5FB59A] font-semibold">10 req/min</span>
          </div>
        </div>

        {/* Memory & Storage */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8E97AB] uppercase tracking-wider">Téléversements</span>
            <HardDrive className="w-4 h-4 text-[#f7c548]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#5FB59A]" />
              <span className="text-base font-bold text-white font-display">Max 50 Mo</span>
            </div>
            <span className="text-xs text-[#8E97AB] block mt-1">
              Fichiers .exe &amp; scripts bloqués
            </span>
          </div>
          <div className="text-[10px] text-white/50 border-t border-white/10 pt-2 flex justify-between">
            <span>RAM Serveur</span>
            <span className="text-white font-mono">{health?.memory.heapUsedMb || '0'} Mo</span>
          </div>
        </div>
      </div>

      {/* Firestore Admin SDK Diagnostic Probe (Write & Read Test) */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#f7c548]/10 text-[#f7c548]">
              <HardDrive className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white font-display">
                Accès Firestore Admin (SDK Serveur) — Sonde Diagnostic
              </h2>
              <p className="text-[11px] text-[#8E97AB]">
                Test réel d'écriture puis de lecture côté serveur sur le projet Firebase personnel
              </p>
            </div>
          </div>

          <button
            onClick={handleTestFirestoreProbe}
            disabled={isTestingProbe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f7c548]/10 text-[#f7c548] border border-[#f7c548]/30 hover:bg-[#f7c548]/20 transition-colors disabled:opacity-50 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingProbe ? 'animate-spin' : ''}`} />
            <span>{isTestingProbe ? 'Test en cours...' : 'Tester Écriture & Lecture'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-[#8E97AB] uppercase font-semibold">Statut Sonde</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health?.firestoreAdmin?.status === 'connected' ? 'bg-[#5FB59A] animate-pulse' : 'bg-[#D9695F]'}`} />
              <span className={`font-semibold ${health?.firestoreAdmin?.status === 'connected' ? 'text-[#5FB59A]' : 'text-[#D9695F]'}`}>
                {health?.firestoreAdmin?.status === 'connected' ? 'Connecté & Opérationnel' : 'Erreur de connexion'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-[#8E97AB] uppercase font-semibold">Latence d'écriture</span>
            <div className="text-sm font-bold text-white font-mono">
              {health?.firestoreAdmin?.writeLatencyMs !== undefined ? `${health.firestoreAdmin.writeLatencyMs} ms` : 'N/A'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-[#8E97AB] uppercase font-semibold">Latence de lecture</span>
            <div className="text-sm font-bold text-white font-mono">
              {health?.firestoreAdmin?.readLatencyMs !== undefined ? `${health.firestoreAdmin.readLatencyMs} ms` : 'N/A'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-[#8E97AB] uppercase font-semibold">Dernier test</span>
            <div className="text-xs text-[#8E97AB] font-mono truncate">
              {health?.firestoreAdmin?.testedAt ? new Date(health.firestoreAdmin.testedAt).toLocaleTimeString('fr-FR') : 'Au démarrage'}
            </div>
          </div>
        </div>

        {health?.firestoreAdmin?.error && (
          <div className="p-3 rounded-xl bg-[#D9695F]/10 border border-[#D9695F]/30 text-xs text-[#ff9999] font-mono break-all">
            <strong>Erreur signalée :</strong> {health.firestoreAdmin.error}
          </div>
        )}
      </div>

      {/* Security Checklist Details */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <ShieldCheck className="w-4 h-4 text-[#f7c548]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white font-display">
            Checklist de Sécurité &amp; Intégrité
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#5FB59A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-medium">Isolation des données graphiste</strong>
              <span className="text-[11px] text-[#8E97AB]">
                Chaque graphiste ne lit et ne modifie que ses propres projets, clients, devis et factures.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#5FB59A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-medium">Verrouillage des livrables finaux</strong>
              <span className="text-[11px] text-[#8E97AB]">
                Les fichiers sources et exports d'impression haute définition sont inaccessibles tant que le solde n'est pas réglé.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#5FB59A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-medium">Scellement des devis acceptés &amp; factures</strong>
              <span className="text-[11px] text-[#8E97AB]">
                Une fois signé, un devis devient inaltérable. Une facture soldée ne peut plus être modifiée (garantie fiscale).
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#5FB59A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-medium">Échappement XSS &amp; Protection PDF</strong>
              <span className="text-[11px] text-[#8E97AB]">
                Toutes les entrées utilisateurs sont échappées avant affichage et filtrées dans la génération de documents.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Audit Log Table */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#f7c548]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white font-display">
              Journal d'Erreurs &amp; Télémétrie ({errors.length})
            </h2>
          </div>
          <span className="text-[10px] text-[#8E97AB]">Dernière vérification : {lastCheck.toLocaleTimeString('fr-FR')}</span>
        </div>

        {errors.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#5FB59A] mx-auto opacity-80" />
            <p className="text-xs text-white font-medium">Aucune anomalie récente détectée</p>
            <p className="text-[11px] text-[#8E97AB]">Le serveur et l'application frontend fonctionnent sans erreur.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {errors.map(err => (
              <div key={err.id} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${err.source === 'server' ? 'bg-[#f20000]/20 text-[#ff8080]' : 'bg-[#f7c548]/20 text-[#f7c548]'}`}>
                    {err.source.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#8E97AB] font-mono">
                    {new Date(err.timestamp).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-white/90 font-mono text-[11px] break-all">{err.message}</p>
                {err.path && <p className="text-[10px] text-[#8E97AB]">Chemin : {err.path}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
