import React from 'react';

interface BadgeProps {
  variant?: 'cyan' | 'indigo' | 'rose' | 'muted' | 'success' | 'warning';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'cyan', className = '', children }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono shadow-sm select-none';
  
  const variants = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25 shadow-cyan-500/5',
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25 shadow-indigo-500/5',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/25 shadow-rose-500/5',
    muted: 'bg-white/5 text-slate-400 border-white/5',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
