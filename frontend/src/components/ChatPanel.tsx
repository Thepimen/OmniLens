import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatPanelProps {
  messages: Message[];
  chatInput: string;
  setChatInput: (input: string) => void;
  isChatting: boolean;
  onSendMessage: () => void;
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  disabled: boolean;
}

export function ChatPanel({
  messages,
  chatInput,
  setChatInput,
  isChatting,
  onSendMessage,
  isFocusMode,
  toggleFocusMode,
  videoRef,
  disabled
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatting]);

  const parseTextWithTimestamps = (text: string) => {
    // Matches the exact [MM:SS] structure
    const parts = text.split(/(\[\d{2}:\d{2}\])/g);
    return parts.map((part, index) => {
      if (part.match(/\[\d{2}:\d{2}\]/)) {
        const timeStr = part.replace('[', '').replace(']', '');
        const [minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = minutes * 60 + seconds;
        return (
          <button
            key={index}
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = totalSeconds;
                videoRef.current.play().catch(() => {});
              }
            }}
            className="inline-flex items-center px-2 py-0.5 mx-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/35 border border-cyan-500/30 transition-all shadow-sm cursor-pointer whitespace-nowrap active:scale-95 select-none"
          >
            ▶ {timeStr}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="w-full h-full bg-[#0a0b14]/30 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Panel Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between z-10 bg-white/[0.01] backdrop-blur-md shadow-sm select-none">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 rounded-2xl border border-white/10 text-cyan-400 shadow-inner">
            <MessageSquare className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-100 tracking-tight">Asistente AI</h2>
            <p className="text-[10px] font-bold text-slate-400">Pregunta sobre el video indexado</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Focus Mode trigger */}
          <Button
            variant="glass"
            size="sm"
            onClick={toggleFocusMode}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 border transition-all ${
              isFocusMode 
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.12)]' 
                : 'hover:border-white/20'
            }`}
          >
            {isFocusMode ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
            <span className="text-xs font-semibold">{isFocusMode ? 'Modo Normal' : 'Modo Enfoque'}</span>
          </Button>

          <Badge variant="cyan">Vector RAG</Badge>
        </div>
      </div>

      {/* Messages Scrolling Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar z-10 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-80 py-10 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 bg-gradient-to-br from-white/5 to-white/10 rounded-2xl flex items-center justify-center mb-5 border border-white/5 shadow-2xl"
            >
              <MessageSquare className="w-8 h-8 text-cyan-400 drop-shadow-md" />
            </motion.div>
            <motion.h3
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-slate-200 mb-2 tracking-tight"
            >
              Indexación Completada
            </motion.h3>
            <motion.p
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs font-medium text-slate-400 max-w-[260px] leading-relaxed"
            >
              Puedes hacerme preguntas sobre cualquier fragmento de este video. Los timestamps se generarán automáticamente y te permitirán saltar al segundo exacto.
            </motion.p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-3.5 text-sm leading-relaxed shadow-xl border ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-cyan-600 text-white rounded-tr-sm border-indigo-500/20'
                      : 'bg-white/5 backdrop-blur-md text-slate-200 rounded-tl-sm border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
                  }`}>
                    {msg.role === 'assistant' ? parseTextWithTimestamps(msg.text) : msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {isChatting && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-start">
            <div className="bg-white/5 backdrop-blur-md border border-white/5 text-slate-400 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-xl flex items-center space-x-2 select-none">
              <motion.div className="w-2.5 h-2.5 bg-cyan-400 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6 }}></motion.div>
              <motion.div className="w-2.5 h-2.5 bg-indigo-400 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}></motion.div>
              <motion.div className="w-2.5 h-2.5 bg-cyan-500 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}></motion.div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Action Form */}
      <div className="p-4 bg-black/45 backdrop-blur-2xl border-t border-white/5 z-10 flex shadow-[0_-10px_40px_rgba(0,0,0,0.25)]">
        <div className="relative flex-1 flex items-center bg-white/5 border border-white/5 rounded-full focus-within:border-cyan-500/40 focus-within:bg-white/10 transition-all shadow-inner hover:bg-white/8">
          <input
            type="text"
            className="w-full bg-transparent border-none px-5 py-3.5 text-sm font-medium text-slate-200 focus:outline-none placeholder-slate-500"
            placeholder={disabled ? "Sube o selecciona un video para comenzar..." : "Escribe tu pregunta sobre el video..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            disabled={isChatting || disabled}
          />
          <button
            onClick={onSendMessage}
            disabled={isChatting || !chatInput.trim() || disabled}
            className="mr-1.5 p-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-full transition-all disabled:from-slate-800/80 disabled:to-slate-800/80 disabled:text-slate-600 active:scale-95 shadow-md disabled:shadow-none cursor-pointer"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
