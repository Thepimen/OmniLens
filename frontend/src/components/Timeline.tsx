import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, Clock } from 'lucide-react';
import { Card } from './ui/card';

interface Keyframe {
  path: string;
  time: number;
}

interface TimelineProps {
  duration: number;
  currentTime: number;
  keyframes: Keyframe[];
  onSeek: (time: number) => void;
}

export function Timeline({ duration, currentTime, keyframes, onSeek }: TimelineProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.min(1, Math.max(0, clickX / rect.width));
    onSeek(percentage * duration);
  };

  // Resolve the active keyframe index (the closest keyframe time <= currentTime)
  const activeKeyframeIndex = keyframes.reduce((closestIdx, kf, idx) => {
    if (kf.time <= currentTime && (closestIdx === -1 || kf.time > keyframes[closestIdx].time)) {
      return idx;
    }
    return closestIdx;
  }, -1);

  return (
    <Card className="p-5 flex flex-col gap-4 bg-white/5 border-white/10 backdrop-blur-md rounded-3xl shadow-xl select-none">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 tracking-tight">
          <Video className="w-4 h-4 text-cyan-400" />
          Línea de Tiempo Sincronizada
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-black/30 px-3 py-1 rounded-full border border-white/5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-100 font-bold">{formatTime(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Interactive Scrub Bar Track */}
      <div className="relative pt-3 pb-2">
        <div
          ref={progressBarRef}
          onClick={handleScrub}
          className="h-2.5 w-full bg-slate-950 rounded-full border border-white/5 relative cursor-pointer group shadow-inner"
        >
          {/* Progress bar fill gradient */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.45)]"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          {/* Active playhead needle thumb */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-[0_0_12px_rgba(244,63,94,0.7)] cursor-grab active:cursor-grabbing z-20"
            style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 8px)` }}
            layoutId="timeline-playhead"
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          />

          {/* Keyframe tick marks */}
          {keyframes.map((kf, idx) => {
            const isPassed = kf.time <= currentTime;
            const isCurrentlyActive = idx === activeKeyframeIndex;
            const percentage = duration > 0 ? (kf.time / duration) * 100 : 0;
            return (
              <div
                key={idx}
                className="absolute top-0 bottom-0 flex items-center group/tick pointer-events-none"
                style={{ left: `${percentage}%` }}
              >
                <div
                  className={`w-1 h-3 rounded-full -translate-x-0.5 transition-all duration-200 ${
                    isCurrentlyActive
                      ? 'bg-cyan-400 scale-y-130 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                      : isPassed
                      ? 'bg-indigo-400'
                      : 'bg-white/20 group-hover/tick:bg-white/40'
                  }`}
                />

                {/* Floating preview on hover */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#080812] border border-white/10 p-1.5 rounded-xl shadow-2xl opacity-0 scale-90 group-hover/tick:opacity-100 group-hover/tick:scale-100 transition-all duration-200 pointer-events-none z-30 w-24">
                  <img
                    src={`http://localhost:4000${kf.path}`}
                    alt="tick preview"
                    className="w-full h-12 object-cover rounded-lg"
                  />
                  <div className="text-[9px] font-mono text-center text-slate-400 mt-1 font-bold">
                    {formatTime(kf.time)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* filmstrip horizontal scrolling thumbnails */}
      <div className="flex flex-col gap-2 mt-1">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-sans">
          Fotogramas de Video Recientes ({keyframes.length})
        </span>
        
        <div className="flex gap-4 overflow-x-auto pb-3 pr-1 custom-scrollbar scroll-smooth">
          {keyframes.map((kf, idx) => {
            const isCurrentlyActive = idx === activeKeyframeIndex;
            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.04, y: -2 }}
                className={`flex-shrink-0 relative rounded-2xl overflow-hidden border cursor-pointer bg-slate-900 w-28 group transition-all duration-300 ${
                  isCurrentlyActive
                    ? 'border-cyan-400 ring-2 ring-cyan-400/25 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'border-white/5 hover:border-white/12'
                }`}
                onClick={() => onSeek(kf.time)}
              >
                <img
                  src={`http://localhost:4000${kf.path}`}
                  alt={`Frame thumbnail at ${kf.time}s`}
                  className="h-16 w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <div className="p-1.5 flex items-center justify-center bg-black/60 relative z-10">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isCurrentlyActive ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm' : 'bg-white/5 text-slate-400'
                  }`}>
                    {formatTime(kf.time)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
