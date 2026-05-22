import React from 'react';
import { Timeline } from './Timeline';
import { Clock, Activity, Video, Award } from 'lucide-react';

interface Keyframe {
  path: string;
  time: number;
}

interface VideoDashboardProps {
  videoSrc: string | null;
  metadata: {
    duration_seconds: number;
    fps: number;
    total_frames: number;
    process_time_seconds: number;
  } | null;
  keyframes: Keyframe[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  setCurrentTime: (time: number) => void;
}

export function VideoDashboard({
  videoSrc,
  metadata,
  keyframes,
  videoRef,
  currentTime,
  setCurrentTime
}: VideoDashboardProps) {
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full pb-4">
      {/* Video Player Wrapper */}
      <div className="flex-shrink-0 bg-black/40 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative aspect-video group backdrop-blur-md">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Video className="w-10 h-10 text-slate-600 animate-pulse" />
            <p className="text-sm font-semibold font-mono">Cargando reproductor...</p>
          </div>
        )}
      </div>

      {metadata && (
        <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/5 hover:border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 select-none">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1.5 flex items-center gap-1 font-sans">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Duración
              </span>
              <span className="text-lg font-bold text-slate-100 font-mono">{metadata.duration_seconds}s</span>
            </div>

            <div className="bg-white/5 border border-white/5 hover:border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 select-none">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1.5 flex items-center gap-1 font-sans">
                <Activity className="w-3.5 h-3.5 text-slate-500" /> FPS
              </span>
              <span className="text-lg font-bold text-slate-100 font-mono">{metadata.fps}</span>
            </div>

            <div className="bg-white/5 border border-white/5 hover:border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 select-none">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1.5 flex items-center gap-1 font-sans">
                <Video className="w-3.5 h-3.5 text-slate-500" /> Fotogramas
              </span>
              <span className="text-lg font-bold text-slate-100 font-mono">{metadata.total_frames}</span>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-indigo-500/5 border border-cyan-500/20 hover:border-cyan-500/35 hover:bg-cyan-500/15 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 relative overflow-hidden select-none">
              <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-cyan-400/5 rounded-full blur-xl"></div>
              <span className="text-[9px] uppercase tracking-widest text-cyan-300 font-bold mb-1.5 flex items-center gap-1 font-sans relative z-10">
                <Award className="w-3.5 h-3.5 text-cyan-400" /> Tiempo IA
              </span>
              <span className="text-lg font-bold text-cyan-200 font-mono relative z-10">{metadata.process_time_seconds}s</span>
            </div>
          </div>

          {/* Interactive seek timeline with keyframe tracks */}
          <Timeline
            duration={metadata.duration_seconds}
            currentTime={currentTime}
            keyframes={keyframes}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  );
}
