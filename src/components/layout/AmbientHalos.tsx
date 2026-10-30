import React from 'react';
import { useApp } from '../../context/AppContext';

export const AmbientHalos: React.FC = () => {
  const { theme } = useApp();

  if (theme === 'light') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Soft Warm Ivory Canvas (Lumina) */}
        <div 
          className="absolute inset-0 transition-colors duration-500"
          style={{
            background: 'linear-gradient(180deg, #faf7f0 0%, #f5efe3 50%, #faf7f0 100%)'
          }}
        />

        {/* Halo 1: Subtle Warm Honey Halo — Top Right */}
        <div 
          className="absolute -top-[10%] -right-[5%] w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none transition-opacity duration-700"
          style={{
            background: 'radial-gradient(circle, rgba(247, 197, 72, 0.18) 0%, rgba(245, 237, 224, 0.4) 60%, transparent 80%)',
            opacity: 0.7
          }}
        />

        {/* Halo 2: Subtle Warm Cream Halo — Bottom Left */}
        <div 
          className="absolute -bottom-[15%] -left-[5%] w-[650px] h-[650px] rounded-full blur-[150px] pointer-events-none transition-opacity duration-700"
          style={{
            background: 'radial-gradient(circle, rgba(237, 229, 216, 0.6) 0%, rgba(250, 247, 240, 0.3) 60%, transparent 80%)',
            opacity: 0.5
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Deep Midnight Violet Canvas (Aurelia / Nebula) */}
      <div 
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: 'linear-gradient(180deg, #0f0326 0%, #130630 45%, #0f0326 100%)'
        }}
      />

      {/* Halo 1: Deep Violet Surface (#1a0a3a) — Top Left */}
      <div 
        className="absolute -top-[12%] -left-[8%] w-[650px] h-[650px] rounded-full blur-[130px] pointer-events-none transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, #240d4f 0%, rgba(26, 10, 58, 0.4) 60%, transparent 80%)',
          opacity: 0.35
        }}
      />

      {/* Halo 2: Secondary Violet (#160830) — Bottom Right */}
      <div 
        className="absolute -bottom-[15%] -right-[10%] w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, #1a0a3a 0%, rgba(22, 8, 48, 0.4) 60%, transparent 80%)',
          opacity: 0.30
        }}
      />

      {/* Halo 3: Subtle Golden Yellow Accent (#f7c548) — Center */}
      <div 
        className="absolute top-[35%] left-[28%] w-[520px] h-[520px] rounded-full blur-[160px] pointer-events-none transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, #f7c548 0%, rgba(247, 197, 72, 0.15) 55%, transparent 75%)',
          opacity: 0.12
        }}
      />
    </div>
  );
};
