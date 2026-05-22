import React from 'react';

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className = '' }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, value));
  return (
    <div className={`w-full bg-black/45 rounded-full h-3.5 overflow-hidden border border-white/5 relative p-0.5 shadow-inner ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-400 rounded-full relative shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-white/30 blur-[2px] rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
