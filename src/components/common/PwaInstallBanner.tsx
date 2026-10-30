import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = (window.navigator as any).standalone;
    if (isIosDevice && !isStandalone) {
      setIsIos(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [dismissed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-[#0B0F1A]/95 border border-[#f7c548]/40 shadow-2xl backdrop-blur-xl animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f7c548]/20 text-[#f7c548] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-display">
              Installer l'application eyes-onwork
            </h4>
            <p className="text-[11px] text-[#8E97AB] mt-0.5 leading-relaxed">
              {isIos 
                ? 'Appuyez sur Partager puis "Sur l\'écran d\'accueil" pour une expérience fluide plein écran.'
                : 'Accédez à votre espace studio directement depuis l\'écran d\'accueil avec accès hors-ligne.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowBanner(false);
            setDismissed(true);
          }}
          className="text-[#8E97AB] hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isIos && deferredPrompt && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Installer maintenant</span>
          </button>
        </div>
      )}
    </div>
  );
};
