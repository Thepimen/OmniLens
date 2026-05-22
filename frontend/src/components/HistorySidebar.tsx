import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, Film, Clock, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: any) => void;
  currentVideoId: string | null;
}

export function HistorySidebar({ isOpen, onClose, onSelectVideo, currentVideoId }: HistorySidebarProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      } else {
        toast.error("No se pudo cargar el historial de videos.");
      }
    } catch (e) {
      toast.error("Error de conexión al obtener historial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVideos();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que deseas eliminar permanentemente este video y sus embeddings?")) return;

    try {
      const res = await fetch(`http://localhost:4000/api/videos/${videoId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
        toast.success("Video e índice vectorial eliminados.");
      } else {
        toast.error("No se pudo eliminar el video.");
      }
    } catch (e) {
      toast.error("Error de red al intentar eliminar.");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Mask Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sliding Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#04040a]/90 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col p-6 h-full z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 tracking-tight">
                  <Film className="w-5 h-5 text-cyan-400" />
                  Historial de Videos
                </h2>
                <p className="text-xs text-slate-400 mt-1">Análisis completados anteriormente</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10">
                <X className="w-5 h-5 text-slate-400 hover:text-slate-100" />
              </Button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-6 space-y-4 pr-1">
              {loading ? (
                <div className="h-40 flex flex-col items-center justify-center space-y-3">
                  <div className="w-7 h-7 rounded-full border-2 border-t-cyan-400 border-r-cyan-400 border-white/15 animate-spin"></div>
                  <span className="text-xs text-slate-400 font-mono">Cargando historial...</span>
                </div>
              ) : videos.length === 0 ? (
                <div className="h-60 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <Film className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">Historial vacío</p>
                  <p className="text-xs max-w-[220px] text-slate-500 leading-relaxed">Los videos que analices se guardarán aquí para que accedas a ellos inmediatamente en el futuro.</p>
                </div>
              ) : (
                videos.map((vid) => {
                  const isActive = vid.id === currentVideoId;
                  return (
                    <motion.div
                      key={vid.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`group cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden flex items-start justify-between ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-950/20 to-indigo-950/20 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.06)]'
                          : 'bg-white/5 hover:bg-white/8 border-white/5 hover:border-white/10'
                      }`}
                      onClick={() => {
                        onSelectVideo(vid);
                        onClose();
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
                          {vid.filename}
                        </h4>
                        
                        <div className="flex items-center gap-3 mt-3.5 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {vid.duration_seconds}s
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {formatDate(vid.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-500/20 hover:text-red-400 rounded-lg group-hover:opacity-100 opacity-60 transition-opacity"
                          onClick={(e) => handleDelete(e, vid.id)}
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
