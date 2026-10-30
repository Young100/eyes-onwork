import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  hasDropdown?: boolean; // When true, ensures no overflow clipping so popovers escape freely
  hoverEffect?: boolean;
  variant?: 'panel' | 'card' | 'modal' | 'subtle';
  as?: React.ElementType;
}

/**
 * Composant GlassCard unifié.
 *
 * Élimine le débordement de la ligne supérieure sur les coins arrondis :
 * - Reflet de bordure supérieure géré par `box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)` qui épouse fidèlement l'arrondi.
 * - Reflet diagonal intégré avec `border-radius: inherit` et `inset: 0`.
 * - Ligne lumineuse centrale rentrée d'au moins le rayon des coins avec fondu transparent aux deux extrémités.
 * - Zéro débordement sur les coins arrondis sur mobile et desktop (360px, 412px, etc.).
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hasDropdown = false,
  hoverEffect = false,
  variant = 'panel',
  as: Component = 'div',
  ...props
}) => {
  const variantClass = variant === 'modal' 
    ? 'glass-modal' 
    : variant === 'card' 
      ? 'glass-card' 
      : 'glass-panel';

  const hoverClass = hoverEffect ? 'glass-panel-hover' : '';
  const overflowClass = hasDropdown ? 'overflow-visible' : '';

  return (
    <Component
      className={`${variantClass} ${hoverClass} ${overflowClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
};
