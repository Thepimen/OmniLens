'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, FileVideo, Activity, Video, Send, MessageSquare, Plus,
  Settings, Download, Trash2, MoreVertical, X
} from 'lucide-react';

let socket: Socket;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>(''); // 'queued', 'processing', 'completed', 'error'
  const [jobMessage, setJobMessage] = useState<string>('');
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobResult, setJobResult] = useState<any>(null);

  // Chat & Video State
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatting]);

  useEffect(() => {
    socket = io('http://localhost:4000');
    socket.on('connect', () => console.log('Connected to API Gateway via WebSocket'));
    socket.on('job_queued', (data: any) => {
      if (data.filename === file?.name || !file) {
        setJobId(data.jobId); setJobStatus('queued'); setJobMessage('Video queued for processing...');
      }
    });
    socket.on('job_processing', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('processing'); setJobProgress(data.progress);
        if (data.message) setJobMessage(data.message);
      }
    });
    socket.on('job_completed', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('completed'); setJobProgress(100); setJobMessage('Processing complete!');
        setJobResult(data.result);
      }
    });
    socket.on('job_failed', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('error'); setJobMessage(`Error: ${data.error}`);
      }
    });
    return () => { socket.disconnect(); };
  }, [jobId, file]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      resetState();
    }
  }, []);

  const resetState = () => {
    setFile(null);
    setJobId(null); setJobStatus(''); setJobMessage(''); setJobProgress(0); setJobResult(null);
    setUploadProgress(0); setMessages([]); setChatInput(''); setUploading(false);
  };

  const resetChat = () => setMessages([]);

  const parseTextWithTimestamps = (text: string) => {
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
                videoRef.current.play();
              }
            }}
            className="inline-flex items-center px-2 py-0.5 mx-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 hover:bg-teal-500/40 border border-teal-500/30 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            ▶ {timeStr}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !jobId) return;
    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: jobId, question: userMsg })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + data.reason }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Network connection failed.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/x-m4v': ['.m4v'] }, maxFiles: 1
  });

  const uploadVideo = async () => {
    if (!file) return;
    setUploading(true); setUploadProgress(0); setJobStatus('uploading'); setJobMessage('Uploading to server...');

    const formData = new FormData(); formData.append('video', file);

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
          setJobId(response.jobId); setJobStatus('queued'); setJobMessage('Upload complete. Waiting in queue...');
        } else {
          setJobStatus('error'); setJobMessage('Upload failed.');
        }
        setUploading(false);
      };
      xhr.onerror = () => {
        setJobStatus('error'); setJobMessage('Network error occurred.'); setUploading(false);
      };
      xhr.send(formData);
    } catch (error) {
      setUploading(false); setJobStatus('error'); setJobMessage('Failed to trigger upload.');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black text-slate-100 relative overflow-hidden font-sans">
      
      {/* Floating Header */}
      <header className="absolute top-0 w-full z-50 px-6 py-4 flex justify-between items-center pointer-events-none">
         <div className="flex items-center gap-3 pointer-events-auto select-none">
            <div className="h-10 w-10 bg-gradient-to-tr from-teal-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 font-bold text-white text-xl">
               <Video className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400 tracking-tight">OmniLens</h1>
         </div>

         <div className="flex items-center gap-4 pointer-events-auto">
            {/* New Upload Button */}
            {file && (
              <motion.button 
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 onClick={resetState}
                 className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full text-sm font-medium border border-white/10 transition-colors shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>New Upload</span>
              </motion.button>
            )}

            {/* Dropdown Menu */}
            <div className="relative group">
               <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md border border-white/10 transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-300" />
               </button>
               
               <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-white/10 shadow-2xl shadow-black/50 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all origin-top-right transform scale-95 group-hover:scale-100 duration-200">
                  <div className="p-1">
                    <button onClick={resetChat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded-lg transition-colors">
                       <Trash2 className="w-4 h-4" /> Clear Chat
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                       <Download className="w-4 h-4" /> Export Transcript
                    </button>
                    <div className="h-px bg-white/10 my-1 mx-2"></div>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                       <Settings className="w-4 h-4" /> Settings
                    </button>
                  </div>
               </div>
            </div>
         </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full pt-20 pb-6 px-6 overflow-hidden flex flex-col z-10">
        {!file ? (
           // Dropzone Full Screen Center
           <div {...getRootProps()} className="flex-1 flex flex-col items-center justify-center relative outline-none">
              <input {...getInputProps()} />
              <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 whileHover={{ scale: 1.02 }}
                 transition={{ type: "spring", stiffness: 300, damping: 20 }}
                 className={`w-full max-w-2xl aspect-video rounded-[2rem] border backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center cursor-pointer transition-colors duration-300 relative overflow-hidden group
                    ${isDragActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_60px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/10'}`}
              >
                  {/* Glowing background inside dropzone during drag */}
                  <AnimatePresence>
                     {isDragActive && (
                        <motion.div 
                           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                           className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-teal-500/20 animate-pulse" 
                        />
                     )}
                  </AnimatePresence>
                 
                 <div className="relative z-10 flex flex-col items-center pointer-events-none">
                    <motion.div
                       animate={isDragActive ? { y: -10, scale: 1.1 } : { y: 0, scale: 1 }}
                       transition={{ type: "spring", stiffness: 400, damping: 25 }}
                       className={`w-24 h-24 mb-6 rounded-full flex items-center justify-center border transition-colors duration-300
                          ${isDragActive ? 'bg-teal-500/20 border-teal-500/30 shadow-[0_0_30px_rgba(45,212,191,0.3)]' : 'bg-gradient-to-tr from-indigo-500/20 to-teal-500/20 border-white/10 group-hover:border-indigo-500/30'}`}
                    >
                       <UploadCloud className={`w-12 h-12 transition-colors duration-300 ${isDragActive ? 'text-teal-400' : 'text-indigo-400'}`} />
                    </motion.div>
                    <h2 className={`text-2xl font-bold mb-3 transition-colors duration-300 ${isDragActive ? 'text-teal-300' : 'text-slate-200'}`}>
                       {isDragActive ? 'Drop it like it\'s hot!' : 'Drag & drop your magical video'}
                    </h2>
                    <p className="text-slate-400 mb-8 font-medium">or click anywhere to browse from your computer</p>
                    <div className="flex gap-3 text-xs font-mono text-slate-400">
                       <span className="px-3 py-1.5 bg-black/40 rounded-lg border border-white/5 backdrop-blur-md font-semibold">MP4</span>
                       <span className="px-3 py-1.5 bg-black/40 rounded-lg border border-white/5 backdrop-blur-md font-semibold">MOV</span>
                       <span className="px-3 py-1.5 bg-black/40 rounded-lg border border-white/5 backdrop-blur-md font-semibold">Max 500MB</span>
                    </div>
                 </div>
              </motion.div>
           </div>
        ) : (
           // Two Panel App Layout
           <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden max-h-full">
               
               {/* Left Panel: Video & Metadata */}
               <div className="w-full lg:w-1/2 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-6 rounded-3xl">
                  
                  {/* Upload State / Selected File Info */}
                  {!jobStatus && (
                     <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-center min-h-[50%]">
                        <div className="flex items-center justify-between mb-8">
                           <div className="flex items-center gap-5">
                              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-teal-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-inner">
                                 <FileVideo className="w-8 h-8 text-indigo-400" />
                              </div>
                              <div>
                                 <h3 className="text-xl font-bold text-slate-100 truncate max-w-sm">{file.name}</h3>
                                 <p className="text-sm text-slate-400 mt-1 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                              </div>
                           </div>
                           <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-transparent hover:border-white/10">
                              <X className="w-5 h-5 text-slate-400" />
                           </button>
                        </div>
                        <motion.button 
                           whileHover={{ scale: 1.02 }}
                           whileTap={{ scale: 0.98 }}
                           onClick={uploadVideo} 
                           className="w-full py-5 bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 text-white text-lg font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-3 group"
                        >
                           <UploadCloud className="w-6 h-6 group-hover:-translate-y-1 transition-transform" /> 
                           Start Processing
                        </motion.button>
                     </motion.div>
                  )}

                  {/* Processing Status Panel */}
                  {jobStatus && jobStatus !== 'completed' && jobStatus !== 'error' && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-2xl flex flex-col items-center justify-center text-center min-h-[50%] relative overflow-hidden">
                        {/* Background glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>

                        <div className="relative w-28 h-28 mb-8">
                           <div className="absolute inset-0 rounded-full border-t-[3px] border-indigo-500 animate-[spin_2s_linear_infinite]"></div>
                           <div className="absolute inset-2 rounded-full border-r-[3px] border-teal-500 animate-[spin_3s_linear_infinite_reverse]"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <Activity className="w-10 h-10 text-indigo-400 animate-pulse" />
                           </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight">{jobMessage}</h3>
                        <p className="text-slate-400 text-base mb-10 max-w-sm">Analyzing frames, transcribing audio, building RAG index for instant search...</p>
                        
                        {/* Glowing Progress Bar */}
                        <div className="w-full max-w-md bg-black/40 rounded-full h-4 overflow-hidden border border-white/10 relative p-1 shadow-inner">
                           <motion.div 
                              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-400 rounded-full relative shadow-[0_0_20px_rgba(45,212,191,0.6)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${jobStatus === 'uploading' ? uploadProgress : jobProgress}%` }}
                              transition={{ ease: "circOut", duration: 0.5 }}
                           >
                              <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/50 blur-[3px] rounded-full"></div>
                           </motion.div>
                        </div>
                        <div className="mt-4 text-base font-bold font-mono text-teal-400">
                           {jobStatus === 'uploading' ? uploadProgress : jobProgress}%
                        </div>
                     </motion.div>
                  )}

                  {/* Video Player & Results */}
                  {jobStatus === 'completed' && (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 h-full pb-4">
                        {/* Player */}
                        <div className="flex-shrink-0 bg-black/50 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative aspect-video group backdrop-blur-md">
                           <video ref={videoRef} src={URL.createObjectURL(file!)} controls className="w-full h-full object-contain" />
                        </div>

                        {jobResult && (
                           <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
                              {/* Metadata Grid */}
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                 <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Duration</span>
                                    <span className="text-xl font-bold text-slate-100">{jobResult.metadata.duration_seconds}s</span>
                                 </div>
                                 <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">FPS</span>
                                    <span className="text-xl font-bold text-slate-100">{jobResult.metadata.fps}</span>
                                 </div>
                                 <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Frames</span>
                                    <span className="text-xl font-bold text-slate-100">{jobResult.metadata.total_frames}</span>
                                 </div>
                                 <div className="bg-gradient-to-br from-teal-500/20 to-indigo-500/10 backdrop-blur-md border border-teal-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-lg hover:bg-teal-500/20 transition-colors">
                                    <span className="text-[10px] uppercase tracking-wider text-teal-300 font-bold mb-1 relative z-10">AI Time</span>
                                    <span className="text-xl font-bold text-teal-100 relative z-10">{jobResult.metadata.process_time_seconds}s</span>
                                 </div>
                              </div>

                              {/* Keyframes */}
                              {jobResult.keyframes && jobResult.keyframes.length > 0 && (
                                 <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-lg">
                                    <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                       <Video className="w-4 h-4 text-indigo-400" />
                                       Extracted Keyframes
                                    </h4>
                                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                       {jobResult.keyframes.map((kf: any, idx: number) => (
                                          <motion.div 
                                             key={idx} 
                                             whileHover={{ scale: 1.05, y: -5 }}
                                             className="flex-shrink-0 relative group rounded-xl overflow-hidden border border-white/10 shadow-lg cursor-pointer bg-black"
                                             onClick={() => {
                                                if (videoRef.current) {
                                                   videoRef.current.currentTime = kf.time;
                                                   videoRef.current.play();
                                                }
                                             }}
                                          >
                                             <img src={`http://localhost:4000${kf.path}`} alt={`Frame at ${kf.time}s`} className="h-32 w-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 border border-white/10 rounded-xl">
                                                <span className="text-white text-xs font-bold px-2 py-1 bg-teal-500/90 rounded backdrop-blur-sm self-start shadow-lg flex items-center gap-1">
                                                   ▶ {kf.time}s
                                                </span>
                                             </div>
                                          </motion.div>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>
                        )}
                     </motion.div>
                  )}
               </div>
               
               {/* Right Panel: Chat RAG */}
               <div className="w-full lg:w-1/2 h-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
                  {/* Decorative Glow */}
                  <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>

                  <div className="p-6 border-b border-white/10 flex items-center justify-between z-10 bg-white/5 backdrop-blur-sm shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 rounded-xl border border-white/10 text-indigo-300 shadow-inner">
                           <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                           <h2 className="text-lg font-bold text-slate-100 tracking-tight">AI Assistant</h2>
                           <p className="text-xs font-medium text-slate-400">Ask about the video contents</p>
                        </div>
                     </div>
                     <span className="px-3 py-1.5 bg-teal-500/10 text-teal-300 text-[10px] font-bold rounded-full uppercase tracking-widest border border-teal-500/20 shadow-sm">Vector RAG</span>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10 relative">
                     {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-80">
                           <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="w-20 h-20 bg-gradient-to-br from-white/5 to-white/10 rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                              <MessageSquare className="w-10 h-10 text-indigo-400 drop-shadow-lg" />
                           </motion.div>
                           <motion.h3 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-2xl font-bold text-slate-200 mb-3 tracking-tight">Analysis Complete</motion.h3>
                           <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="text-sm font-medium text-slate-400 max-w-sm leading-relaxed">
                              I've indexed this video. Ask me anything, and I'll jump directly to the timestamp. Try asking <span className="text-indigo-400">"What happens at the beginning?"</span>
                           </motion.p>
                        </div>
                     ) : (
                        <AnimatePresence>
                           {messages.map((msg, i) => (
                              <motion.div 
                                 key={i} 
                                 initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                                 animate={{ opacity: 1, y: 0, scale: 1 }}
                                 transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                 className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                 <div className={`max-w-[85%] rounded-3xl px-6 py-4 text-[15px] leading-relaxed shadow-xl ${
                                    msg.role === 'user'
                                       ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-sm border border-indigo-500/30'
                                       : 'bg-white/10 backdrop-blur-md text-slate-200 rounded-tl-sm border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
                                 }`}>
                                    {msg.role === 'assistant' ? parseTextWithTimestamps(msg.text) : msg.text}
                                 </div>
                              </motion.div>
                           ))}
                        </AnimatePresence>
                     )}

                     {isChatting && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-start">
                           <div className="bg-white/10 backdrop-blur-md border border-white/10 text-slate-400 rounded-3xl rounded-tl-sm px-6 py-5 shadow-xl flex items-center space-x-2">
                              <motion.div className="w-2.5 h-2.5 bg-indigo-400 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6 }}></motion.div>
                              <motion.div className="w-2.5 h-2.5 bg-teal-400 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}></motion.div>
                              <motion.div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" animate={{ y: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}></motion.div>
                           </div>
                        </motion.div>
                     )}
                     <div ref={messagesEndRef} className="h-4" />
                  </div>

                  {/* Input Area */}
                  <div className="p-5 bg-black/40 backdrop-blur-2xl border-t border-white/10 z-10 flex shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                     <div className="relative flex-1 flex items-center bg-white/5 border border-white/10 rounded-full focus-within:border-indigo-500/50 focus-within:bg-white/10 transition-all shadow-inner hover:bg-white/10">
                        <input
                           type="text"
                           className="w-full bg-transparent border-none px-6 py-4 text-[15px] font-medium text-slate-200 focus:outline-none placeholder-slate-500"
                           placeholder="Type your question..."
                           value={chatInput}
                           onChange={(e) => setChatInput(e.target.value)}
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                 e.preventDefault();
                                 handleSendMessage();
                              }
                           }}
                           disabled={isChatting || !jobStatus || jobStatus !== 'completed'}
                        />
                        <button
                           onClick={handleSendMessage}
                           disabled={isChatting || !chatInput.trim() || !jobStatus || jobStatus !== 'completed'}
                           className="mr-2 p-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-full transition-all disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 active:scale-95 shadow-md disabled:shadow-none"
                        >
                           <Send className="w-5 h-5 ml-0.5" />
                        </button>
                     </div>
                  </div>
               </div>
               
           </div>
        )}
      </main>
    </div>
  );
}
