import React from 'react';
import { 
  FolderKanban, 
  Users, 
  Receipt, 
  BookOpen, 
  Settings, 
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  currentTab: 'projects' | 'clients' | 'billing' | 'catalog' | 'settings';
  setCurrentTab: (tab: 'projects' | 'clients' | 'billing' | 'catalog' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { workspace, entitlements, openUpgradeModal } = useApp();

  const navItems = [
    { id: 'projects', label: 'Projets', icon: FolderKanban },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'billing', label: 'Facturation & Devis', icon: Receipt },
    { id: 'catalog', label: 'Catalogue', icon: BookOpen },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 bg-[#121826] border-r border-[#1E293B] flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f7c548] to-[#8A6D3B] flex items-center justify-center text-[#0B0F1A] font-bold shadow-lg shadow-[#f7c548]/15">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="font-display font-bold text-base tracking-wide text-white">eyes-onwork</h1>
              <p className="text-[10px] text-[#8E97AB] uppercase tracking-wider">Studio OS pour Designers</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#f7c548]/15 text-[#f7c548] border border-[#f7c548]/30 font-semibold shadow-sm'
                    : 'text-[#8E97AB] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#f7c548]' : 'text-[#8E97AB]'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Plan & Entitlements Badge in Footer */}
      <div className="p-4 border-t border-[#1E293B] space-y-3">
        <div className="p-3.5 rounded-xl bg-[#0B0F1A] border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8E97AB]">Plan actuel :</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#f7c548]/20 text-[#f7c548] border border-[#f7c548]/30">
              {workspace.planId}
            </span>
          </div>

          <div className="text-[11px] text-[#8E97AB] space-y-1">
            <div className="flex justify-between">
              <span>Projets actifs :</span>
              <span className="text-white font-medium">{entitlements.activeProjectsCount} / {entitlements.maxActiveProjects}</span>
            </div>
            <div className="flex justify-between">
              <span>Clients :</span>
              <span className="text-white font-medium">{entitlements.clientsCount} / {entitlements.maxClients}</span>
            </div>
            <div className="flex justify-between">
              <span>Devis ce mois :</span>
              <span className="text-white font-medium">{entitlements.quotesThisMonthCount} / {entitlements.maxQuotesPerMonth}</span>
            </div>
          </div>

          {workspace.planId === 'free' && (
            <button
              onClick={() => openUpgradeModal('Passez à l’offre Pro pour débloquer des devis et projets illimités.')}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#f7c548] to-[#e5b336] text-[#0B0F1A] text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#f7c548]/10 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Passer à Pro</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
