import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  flag?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  sheetTitle?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  label,
  searchable,
  disabled = false,
  required = false,
  className = '',
  triggerClassName = '',
  id,
  name,
  sheetTitle
}) => {
  const { theme } = useApp();
  const isLight = theme === 'light';

  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 200,
    placeAbove: false
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Auto-enable search for lists with more than 5 options if not explicitly specified
  const shouldEnableSearch = searchable !== undefined ? searchable : options.length > 5;

  // Selected option
  const selectedOption = options.find(o => o.value === value);

  // Filtered options based on search query
  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
      opt.value.toLowerCase().includes(q)
    );
  });

  // Check screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update floating coordinates when open on desktop
  const updateCoords = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(320, Math.max(120, filteredOptions.length * 48 + 50));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    const width = Math.max(rect.width, 220);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    if (left < 12) left = 12;

    setCoords({
      top: placeAbove ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
      left,
      width,
      placeAbove
    });
  }, [filteredOptions.length, isMobile]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen, updateCoords]);

  // Focus search input or option when opened
  useEffect(() => {
    if (isOpen) {
      if (shouldEnableSearch && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      const initialIdx = filteredOptions.findIndex(o => o.value === value);
      setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
    } else {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [isOpen, shouldEnableSearch, value, filteredOptions.length]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsListRef.current) {
      const items = optionsListRef.current.querySelectorAll('[role="option"]');
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDownTrigger = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleKeyDownMenu = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
        >
          {label} {required && <span className="text-[#f7c548]">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDownTrigger}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={label || placeholder}
        className={`
          w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium text-left
          flex items-center justify-between gap-2.5 transition-all cursor-pointer
          border shadow-sm
          ${isLight 
            ? 'bg-white border-[#8a7968]/25 text-[#1d1335] hover:border-[#f7c548]/70 focus:border-[#f7c548] focus:ring-2 focus:ring-[#f7c548]/20' 
            : 'bg-[#160830] border-[#8a7968]/30 text-[#eeebd3] hover:border-[#f7c548]/50 focus:border-[#f7c548] focus:ring-2 focus:ring-[#f7c548]/20'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
          ${triggerClassName}
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.flag && (
            <span className="text-base shrink-0 leading-none" aria-hidden="true">
              {selectedOption.flag}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-[#f7c548]" aria-hidden="true">
              {selectedOption.icon}
            </span>
          )}
          <span className={`block truncate ${!selectedOption ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-medium'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.subLabel && (
            <span className="text-[11px] text-[var(--text-secondary)] truncate hidden sm:inline">
              ({selectedOption.subLabel})
            </span>
          )}
        </div>

        <ChevronDown 
          className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#f7c548]' : ''}`} 
        />
      </button>

      {/* Hidden input for HTML form submission */}
      {name && (
        <input 
          type="hidden" 
          name={name} 
          value={value} 
          required={required} 
        />
      )}

      {/* Render Menu via Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          /* Mobile Bottom Sheet Drawer */
          <>
            <div 
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9998] animate-fadeIn"
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={dropdownRef}
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle || label || placeholder}
              onKeyDown={handleKeyDownMenu}
              className={`
                fixed inset-x-0 bottom-0 z-[9999] rounded-t-3xl border-t p-4 max-h-[85vh] flex flex-col shadow-2xl animate-scaleUp pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]
                ${isLight ? 'bg-white border-[#8a7968]/20 text-[#1d1335]' : 'bg-[#1a0a3a] border-[#8a7968]/25 text-[#eeebd3]'}
              `}
            >
              {/* Drag Handle */}
              <div className="w-12 h-1 bg-[var(--text-secondary)]/30 rounded-full mx-auto mb-3 shrink-0" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
                <span className="text-sm font-bold font-display text-[var(--text-primary)]">
                  {sheetTitle || label || placeholder}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              {shouldEnableSearch && (
                <div className="pt-3 pb-2 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une option..."
                      className={`
                        w-full pl-9 pr-8 py-2 text-xs rounded-xl focus:outline-none focus:border-[#f7c548]
                        ${isLight ? 'bg-[#f6f1e7] text-[#1d1335] border border-[#8a7968]/25' : 'bg-[#160830] text-[#eeebd3] border border-[#8a7968]/30'}
                      `}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable Options List */}
              <div 
                ref={optionsListRef}
                id={listboxId}
                role="listbox"
                className="overflow-y-auto flex-1 divide-y divide-[var(--border-subtle)] py-1"
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                    Aucune option trouvée pour « {searchQuery} »
                  </div>
                ) : (
                  filteredOptions.map((opt, index) => {
                    const isSelected = opt.value === value;
                    const isHighlighted = index === highlightedIndex;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onClick={() => handleSelectOption(opt)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`
                          w-full min-h-[48px] px-3.5 py-3 text-xs text-left flex items-center justify-between gap-3 transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
                          ${isSelected 
                            ? (isLight ? 'bg-[#fef4db] text-[#b37d0c] font-semibold' : 'bg-[#f7c548]/20 text-[#f7c548] font-semibold')
                            : isHighlighted 
                              ? (isLight ? 'bg-[#f5ede0] text-[#1d1335]' : 'bg-[#25124d] text-[#eeebd3]')
                              : 'text-[var(--text-primary)] hover:bg-[var(--card-surface-elevated)]'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {opt.flag && (
                            <span className="text-base shrink-0 leading-none" aria-hidden="true">
                              {opt.flag}
                            </span>
                          )}
                          {opt.icon && (
                            <span className="shrink-0 text-[#f7c548]" aria-hidden="true">
                              {opt.icon}
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="block truncate">{opt.label}</span>
                            {opt.subLabel && (
                              <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                                {opt.subLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-[#f7c548] shrink-0 stroke-[2.5]" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          /* Desktop Floating Portal Panel */
          <div
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            onKeyDown={handleKeyDownMenu}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: '340px',
              zIndex: 9999
            }}
            className={`
              rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-scaleUp
              ${isLight ? 'bg-white border-[#8a7968]/20 text-[#1d1335]' : 'bg-[#25124d] border-[#8a7968]/25 text-[#eeebd3]'}
            `}
          >
            {/* Search Input on Desktop if searchable */}
            {shouldEnableSearch && (
              <div className="p-2 border-b border-[var(--border-subtle)] shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer..."
                    className={`
                      w-full pl-8 pr-7 py-1.5 text-xs rounded-xl focus:outline-none focus:border-[#f7c548]
                      ${isLight ? 'bg-[#f6f1e7] text-[#1d1335] border border-[#8a7968]/25' : 'bg-[#160830] text-[#eeebd3] border border-[#8a7968]/30'}
                    `}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div 
              ref={optionsListRef}
              className="overflow-y-auto flex-1 p-1.5 max-h-[280px]"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-[var(--text-secondary)]">
                  Aucun résultat
                </div>
              ) : (
                filteredOptions.map((opt, index) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`
                        w-full min-h-[42px] px-3 py-2 rounded-xl text-xs text-left flex items-center justify-between gap-2.5 transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer my-0.5
                        ${isSelected 
                          ? (isLight ? 'bg-[#fef4db] text-[#b37d0c] font-semibold' : 'bg-[#f7c548]/20 text-[#f7c548] font-semibold')
                          : isHighlighted 
                            ? (isLight ? 'bg-[#f5ede0] text-[#1d1335]' : 'bg-[#160830] text-[#eeebd3]')
                            : 'text-[var(--text-primary)] hover:bg-[var(--card-surface-elevated)]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {opt.flag && (
                          <span className="text-base shrink-0 leading-none" aria-hidden="true">
                            {opt.flag}
                          </span>
                        )}
                        {opt.icon && (
                          <span className="shrink-0 text-[#f7c548]" aria-hidden="true">
                            {opt.icon}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="block truncate">{opt.label}</span>
                          {opt.subLabel && (
                            <span className="block text-[10px] text-[var(--text-secondary)] truncate">
                              {opt.subLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-[#f7c548] shrink-0 stroke-[2.5]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
};
