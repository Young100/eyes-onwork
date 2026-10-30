import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ContextHelpTooltipProps {
  content: string;
  title?: string;
  className?: string;
}

export const ContextHelpTooltip: React.FC<ContextHelpTooltipProps> = ({ content, title, className = '' }) => {
  const { profile } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  // If user disabled contextual help bubbles, don't render
  if (profile.showHelpBubbles === false) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-[#8E97AB] hover:text-[#f7c548] transition-colors rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f7c548] cursor-pointer"
        title="Aide contextuelle"
        aria-label="Aide contextuelle"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-xl bg-[#0B0F1A]/95 backdrop-blur-xl border border-[#f7c548]/40 text-xs shadow-2xl space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-bold text-[#f7c548] text-[11px] uppercase tracking-wide">
              {title || 'Conseil studio'}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#8E97AB] hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[#e0e0e0] text-[11px] leading-relaxed">
            {content}
          </p>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-[#0B0F1A] border-r border-b border-[#f7c548]/40 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
};
