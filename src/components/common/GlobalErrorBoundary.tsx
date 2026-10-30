import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught unexpected error:', error, errorInfo);
    this.setState({ errorInfo });

    // Journalise l'erreur côté serveur
    try {
      fetch('/api/system/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'GlobalErrorBoundary',
          message: error.message || 'React render crash',
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
    } catch {}
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleLogout = () => {
    try {
      if (typeof window !== 'undefined') {
        // Nettoyer les clés auth
        localStorage.removeItem('eyesonwork_auth');
        sessionStorage.clear();
        window.location.href = window.location.origin + window.location.pathname;
      }
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center p-4 relative overflow-hidden select-none">
          {/* Ambient background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#f7c548]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-[#D9695F]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-md w-full glass-modal p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E1724] to-[#14101A] border border-[#D9695F]/40 text-[#D9695F] shadow-lg shadow-black/40">
              <AlertTriangle className="w-8 h-8 stroke-[1.75]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-display text-white tracking-tight">
                Un problème est survenu
              </h1>
              <p className="text-xs text-[#8E97AB] leading-relaxed">
                Une erreur inattendue a empêché l'affichage de cette page. Vos données et projets sont en sécurité.
              </p>
            </div>

            {/* Détails techniques visibles en dev ou repliés */}
            {this.state.error && (
              <div className="text-left p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] text-[#A6AFC2] font-mono overflow-auto max-h-32">
                <span className="text-[#D9695F] font-semibold block mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </span>
                {import.meta.env?.DEV && this.state.error.stack && (
                  <pre className="text-[10px] text-[#6F7B95] whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(1, 4).join('\n')}
                  </pre>
                )}
              </div>
            )}

            {/* Actions : Réessayer & Me déconnecter */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-[#f7c548]/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>

              <button
                type="button"
                onClick={this.handleLogout}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-white/90 bg-white/10 hover:bg-white/15 border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#D9695F]" />
                <span>Me déconnecter</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#6F7B95] pt-2 border-t border-white/5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#f7c548]" />
              <span>Incident journalisé automatiquement pour l'équipe technique</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
