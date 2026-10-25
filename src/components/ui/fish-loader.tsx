'use client';
import React, { useEffect, useState } from 'react';
import { useLoading } from '@/context/LoadingContext';

export function FishLoader() {
  const { isLoading, loadingMessage } = useLoading();
  const [dotCount, setDotCount] = useState(1);

  // Animate the dots (1 → 2 → 3 → 1 every 500ms)
  useEffect(() => {
    if (!isLoading) return;
    setDotCount(1);
    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const dots = '.'.repeat(dotCount);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)' }}
      aria-live="polite"
      aria-busy="true"
    >
      <style>{`
        @keyframes swim {
          0%   { transform: translateX(-60px) scaleX(1); }
          45%  { transform: translateX(60px) scaleX(1); }
          50%  { transform: translateX(60px) scaleX(-1); }
          95%  { transform: translateX(-60px) scaleX(-1); }
          100% { transform: translateX(-60px) scaleX(1); }
        }
        @keyframes bubble {
          0%   { opacity: 0.7; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(1.4); }
        }
        .fish-swim { animation: swim 2.2s ease-in-out infinite; }
        .bubble    { animation: bubble 1.4s ease-out infinite; }
        .bubble2   { animation: bubble 1.4s ease-out 0.55s infinite; }
        .bubble3   { animation: bubble 1.4s ease-out 1.0s infinite; }
      `}</style>

      {/* Fish SVG */}
      <div className="relative mb-4 flex items-center justify-center w-40 h-20">
        {/* Bubbles */}
        <div className="bubble absolute top-1 left-1/2 w-2 h-2 rounded-full bg-white/50" />
        <div className="bubble2 absolute top-3 left-[55%] w-1.5 h-1.5 rounded-full bg-white/40" />
        <div className="bubble3 absolute top-0 left-[48%] w-1 h-1 rounded-full bg-white/30" />

        <div className="fish-swim">
          <svg width="72" height="44" viewBox="0 0 72 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Tail */}
            <path d="M58 22 L72 8 L72 36 Z" fill="#F59E0B" opacity="0.9"/>
            {/* Body */}
            <ellipse cx="32" cy="22" rx="26" ry="14" fill="#FBBF24"/>
            {/* Belly highlight */}
            <ellipse cx="30" cy="24" rx="18" ry="8" fill="#FDE68A" opacity="0.5"/>
            {/* Eye */}
            <circle cx="14" cy="18" r="4" fill="white"/>
            <circle cx="13" cy="18" r="2" fill="#1E3A5F"/>
            <circle cx="12" cy="17" r="0.8" fill="white"/>
            {/* Mouth */}
            <path d="M8 22 Q11 26 14 22" stroke="#D97706" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            {/* Fin top */}
            <path d="M28 8 Q36 2 44 8" stroke="#F59E0B" strokeWidth="2" fill="#FCD34D" strokeLinecap="round"/>
            {/* Fin bottom */}
            <path d="M28 36 Q36 42 44 36" stroke="#F59E0B" strokeWidth="1.5" fill="#FCD34D" opacity="0.6" strokeLinecap="round"/>
            {/* Scales */}
            <path d="M30 14 Q34 18 30 22" stroke="#D97706" strokeWidth="1" fill="none" opacity="0.4"/>
            <path d="M40 14 Q44 18 40 22" stroke="#D97706" strokeWidth="1" fill="none" opacity="0.4"/>
          </svg>
        </div>
      </div>

      {/* Loading text */}
      <p className="text-white text-lg font-semibold tracking-wide drop-shadow">
        {loadingMessage.replace(/\.+$/, '')}
        <span className="inline-block w-6 text-left">{dots}</span>
      </p>
    </div>
  );
}
