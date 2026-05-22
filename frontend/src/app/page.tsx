'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Plus, Trash2, Download, Settings, MoreVertical, History, Activity, Clock, X, FileVideo
} from 'lucide-react';
import { toast } from 'sonner';

import { UploadZone } from '@/components/UploadZone';
import { VideoDashboard } from '@/components/VideoDashboard';
import { ChatPanel } from '@/components/ChatPanel';
import { HistorySidebar } from '@/components/HistorySidebar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface Keyframe {
  path: string;
  time: number;
}

interface JobResult {
  metadata: {
    duration_seconds: number;
    fps: number;
    total_frames: number;
    process_time_seconds: number;
  };
  keyframes?: Keyframe[];
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

let socket: Socket;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>(''); // '', 'uploading', 'queued', 'processing', 'completed', 'error'
  const [jobMessage, setJobMessage] = useState<string>('');
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);

  // Chat & UI State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // WebSockets Connection
  useEffect(() => {
    socket = io('http://localhost:4000');
    
    socket.on('connect', () => {
      console.log('Connected to API Gateway via WebSocket');
    });

    socket.on('job_queued', (data: { filename: string, jobId: string }) => {
      if (!file || data.filename === file.name) {
        setJobId(data.jobId);
        setJobStatus('queued');
        setJobMessage('Video queued for processing...');
      }
    });

    socket.on('job_processing', (data: { jobId: string, progress: number, message?: string }) => {
      if (data.jobId === jobId) {
        setJobStatus('processing');
        setJobProgress(data.progress);
        if (data.message) {
          setJobMessage(data.message);
        }
      }
    });

    socket.on('job_completed', (data: { jobId: string, result: JobResult }) => {
      if (data.jobId === jobId) {
        setJobStatus('completed');
        setJobProgress(100);
        setJobMessage('Processing complete!');
        setJobResult(data.result);
        toast.success('Video analizado exitosamente. ¡Comienza a chatear!');
      }
    });

    socket.on('job_failed', (data: { jobId: string, error: string }) => {
      if (data.jobId === jobId) {
        setJobStatus('error');
        setJobMessage(`Error: ${data.error}`);
        toast.error(`Analysis failed: ${data.error}`);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from API Gateway');
      toast.error('Connection to server lost.');
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId, file]);

  const onFileAccepted = useCallback((selectedFile: File) => {
    // Reset all state for new upload
    setJobId(null);
    setJobStatus('');
    setJobMessage('');
    setJobProgress(0);
    setJobResult(null);
    setUploadProgress(0);
    setMessages([]);
    setChatInput('');
    setUploading(false);
    setCurrentTime(0);

    setFile(selectedFile);
    setVideoSrc(URL.createObjectURL(selectedFile));
  }, []);

  const uploadVideo = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setJobStatus('uploading');
    setJobMessage('Subiendo video al servidor...');

    const formData = new FormData();
    formData.append('video', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://localhost:4000/api/upload', true);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setJobId(response.jobId);
          setJobStatus('queued');
          setJobMessage('Subida completada. Esperando en cola de procesamiento...');
          toast.success('Video subido correctamente.');
        } else {
          setJobStatus('error');
          setJobMessage('Error al subir el video.');
          toast.error('Error al subir el video.');
        }
        setUploading(false);
      };
      
      xhr.onerror = () => {
        setJobStatus('error');
        setJobMessage('Error de red al subir.');
        setUploading(false);
        toast.error('Error de red durante la subida.');
      };
      
      xhr.send(formData);
    } catch (error) {
      setUploading(false);
      setJobStatus('error');
      setJobMessage('Fallo al iniciar subida.');
      toast.error('No se pudo iniciar la subida.');
    }
  }, [file]);

  // Auto trigger upload after drop
  useEffect(() => {
    if (file && !uploading && jobStatus === '') {
      uploadVideo();
    }
  }, [file, uploading, jobStatus, uploadVideo]);

  const resetState = () => {
    setFile(null);
    setVideoSrc(null);
    setJobId(null);
    setJobStatus('');
    setJobMessage('');
    setJobProgress(0);
    setJobResult(null);
    setUploadProgress(0);
    setMessages([]);
    setChatInput('');
    setUploading(false);
    setCurrentTime(0);
    setIsFocusMode(false);
  };

  const resetChat = () => {
    setMessages([]);
    toast.success('Historial de chat limpiado.');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !jobId) return;
    const userMsg = chatInput;
    
    // Map current history to format expected by worker
    const chatHistory = messages.map(m => ({ role: m.role, content: m.text }));
    
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          video_id: jobId, 
          question: userMsg,
          chat_history: chatHistory
        })
      });
      
      const data = await res.json();
      
      if (data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
      } else {
        toast.error(`Error del asistente: ${data.reason}`);
      }
    } catch (error) {
      toast.error('No se pudo conectar con el asistente AI.');
    } finally {
      setIsChatting(false);
    }
  };

  const onSelectVideo = (video: any) => {
    resetState();
    setJobId(video.id);
    setJobStatus('completed');
    setJobProgress(100);
    setJobMessage('Procesamiento completado');
    setJobResult({
      metadata: {
        duration_seconds: video.duration_seconds,
        fps: video.fps,
        total_frames: video.total_frames,
        process_time_seconds: video.process_time_seconds
      },
      keyframes: video.keyframes
    });
    setVideoSrc(`http://localhost:4000/videos/${video.filename}`);
    
    // Set a placeholder file name for layout logic
    setFile({ name: video.filename, size: 0 } as any);
    toast.success(`Video reanudado: ${video.filename}`);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-[#030209] text-slate-100 relative overflow-hidden font-sans">
      
      {/* Decorative top background blur */}
      <div className="absolute top-0 left-1/4 w-[50%] h-[30%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Floating Header */}
      <header className="absolute top-0 w-full z-40 px-6 py-4 flex justify-between items-center pointer-events-none select-none">
        <div className="flex items-center gap-3 pointer-events-auto select-none">
          <div className="h-10 w-10 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 font-bold text-white text-xl border border-white/10">
            <Video className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-tight">OmniLens</h1>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* History Sidebar Button */}
          <Button
            variant="glass"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 hover:border-white/20 bg-white/5"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold">Historial</span>
          </Button>

          {/* New Upload Button */}
          {file && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={resetState}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full text-xs font-bold border border-white/10 transition-colors shadow-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Video</span>
            </motion.button>
          )}

          {/* Settings / Actions Dropdown Menu */}
          <div className="relative group">
            <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md border border-white/10 transition-all cursor-pointer">
              <MoreVertical className="w-4.5 h-4.5 text-slate-300" />
            </button>

            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#080911]/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all origin-top-right transform scale-95 group-hover:scale-100 duration-200 z-50">
              <div className="p-1.5 space-y-1">
                <button
                  onClick={resetChat}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> Limpiar Chat
                </button>
                <div className="h-px bg-white/5 my-1 mx-2"></div>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                  onClick={() => toast.info('Exportación no disponible en este momento')}
                >
                  <Download className="w-4 h-4" /> Exportar Transcripción
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                  onClick={() => toast.info('Ajustes no implementados')}
                >
                  <Settings className="w-4 h-4" /> Configuración
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full pt-20 pb-6 px-6 overflow-hidden flex flex-col z-10">
        {!file ? (
          <UploadZone onFileAccepted={onFileAccepted} />
        ) : (
          <div className="flex-1 flex gap-6 overflow-hidden max-h-full">
            
            {/* Left Column (Video viewport): Animate hide/show for Focus Mode */}
            <AnimatePresence mode="popLayout">
              {!isFocusMode && (
                <motion.div
                  initial={{ width: 0, opacity: 0, x: -100 }}
                  animate={{ width: '50%', opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: -100 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                  className="hidden lg:flex flex-col gap-6 overflow-hidden h-full"
                >
                  {/* Selected Video Metadata Information / Upload State */}
                  {jobStatus !== 'completed' && jobStatus !== 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      
                      {jobStatus === 'uploading' && (
                        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                          
                          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20 shadow-inner">
                            <FileVideo className="w-10 h-10 text-indigo-400 animate-bounce" />
                          </div>
                          
                          <h3 className="text-xl font-bold text-slate-100 mb-2 tracking-tight">{jobMessage}</h3>
                          <p className="text-xs text-slate-400 mb-8 max-w-xs leading-relaxed">
                            Cargando {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                          </p>

                          {/* Upload Progress Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-white/5 p-0.5 relative shadow-inner mb-3">
                            <motion.div
                              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              transition={{ ease: "circOut", duration: 0.3 }}
                            />
                          </div>
                          <span className="text-sm font-mono font-bold text-cyan-400">{uploadProgress}%</span>
                        </div>
                      )}

                      {(jobStatus === 'queued' || jobStatus === 'processing') && (
                        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                          
                          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-500 animate-[spin_1.5s_linear_infinite]"></div>
                            <div className="absolute inset-2.5 rounded-full border-r-2 border-indigo-500 animate-[spin_2.5s_linear_infinite_reverse]"></div>
                            <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
                          </div>

                          <h3 className="text-xl font-bold text-slate-100 mb-2 tracking-tight">{jobMessage}</h3>
                          <p className="text-xs text-slate-400 mb-8 max-w-xs leading-relaxed">
                            Extrayendo audio, fotogramas clave y construyendo el índice vectorial semántico...
                          </p>

                          {/* Process Progress Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-white/5 p-0.5 relative shadow-inner mb-3">
                            <motion.div
                              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${jobProgress}%` }}
                              transition={{ ease: "circOut", duration: 0.4 }}
                            />
                          </div>
                          <span className="text-sm font-mono font-bold text-cyan-400">{jobProgress}%</span>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Complete State Player & Metadata Dashboard */}
                  {jobStatus === 'completed' && (
                    <VideoDashboard
                      videoSrc={videoSrc}
                      metadata={jobResult?.metadata || null}
                      keyframes={jobResult?.keyframes || []}
                      videoRef={videoRef}
                      currentTime={currentTime}
                      setCurrentTime={setCurrentTime}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right Column: AI chat panel */}
            <motion.div
              layout
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className={`h-full ${isFocusMode ? 'w-full' : 'w-full lg:w-1/2'} flex flex-col`}
            >
              <ChatPanel
                messages={messages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                isChatting={isChatting}
                onSendMessage={handleSendMessage}
                isFocusMode={isFocusMode}
                toggleFocusMode={() => setIsFocusMode(prev => !prev)}
                videoRef={videoRef}
                disabled={jobStatus !== 'completed'}
              />
            </motion.div>

          </div>
        )}
      </main>

      {/* Slidout Sidebar History panel */}
      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectVideo={onSelectVideo}
        currentVideoId={jobId}
      />
    </div>
  );
}
