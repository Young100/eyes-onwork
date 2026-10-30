import React from 'react';
import { Bell, Sparkles, User, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const { profile, workspace, openUpgradeModal, notifications, markNotificationAsRead } = useApp();
  const [showNotifications, setShowNotifications] = React.useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 bg-[#121826]/70 backdrop-blur-md border-b border-[#1E293B] px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider text-[#8E97AB] font-mono">Workspace</span>
        <span className="text-white font-semibold text-sm">{workspace.name}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      </div>

      <div className="flex items-center gap-4">
        {workspace.planId === 'free' && (
          <button
            onClick={() => openUpgradeModal('Augmentez vos plafonds de devis et projets sans restriction.')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f7c548]/15 border border-[#f7c548]/30 text-[#f7c548] hover:bg-[#f7c548]/25 transition-all text-xs font-semibold cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Débloquer Pro</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-[#8E97AB] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f7c548] ring-2 ring-[#121826]" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#121826] border border-[#1E293B] shadow-2xl p-4 z-50 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Activité récente</span>
                <span className="text-[10px] text-[#8E97AB]">{notifications.length} notifications</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#8E97AB] text-center py-4">Aucune notification pour le moment.</p>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => markNotificationAsRead(n.id)}
                      className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        n.read ? 'bg-transparent border-[#1E293B]/50 text-[#8E97AB]' : 'bg-[#f7c548]/5 border-[#f7c548]/20 text-white'
                      }`}
                    >
                      <div className="font-semibold text-[#f7c548]">{n.title}</div>
                      <div className="text-[11px] mt-0.5">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-[#1E293B]">
          <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#f7c548]/30 flex items-center justify-center text-[#f7c548] font-bold text-xs">
            {profile.name.charAt(0)}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-white leading-tight">{profile.name}</div>
            <div className="text-[10px] text-[#8E97AB] leading-tight">{profile.studioName}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
