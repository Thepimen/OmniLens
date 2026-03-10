'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { io, Socket } from 'socket.io-client';
import { FiUploadCloud, FiFile, FiCheckCircle, FiActivity, FiVideo, FiSend, FiMessageSquare } from 'react-icons/fi';

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

  useEffect(() => {
    // Initialize socket connection
    socket = io('http://localhost:4000');

    socket.on('connect', () => {
      console.log('Connected to API Gateway via WebSocket');
    });

    socket.on('job_queued', (data: any) => {
      if (data.filename === file?.name || !file) {
        setJobId(data.jobId);
        setJobStatus('queued');
        setJobMessage('Video queued for processing...');
      }
    });

    socket.on('job_processing', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('processing');
        setJobProgress(data.progress);
        if (data.message) setJobMessage(data.message);
      }
    });

    socket.on('job_completed', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('completed');
        setJobProgress(100);
        setJobMessage('Processing complete!');
        setJobResult(data.result);
      }
    });

    socket.on('job_failed', (data: any) => {
      if (data.jobId === jobId) {
        setJobStatus('error');
        setJobMessage(`Error: ${data.error}`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId, file]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      resetState();
    }
  }, []);

  const resetState = () => {
    setJobId(null);
    setJobStatus('');
    setJobMessage('');
    setJobProgress(0);
    setJobResult(null);
    setUploadProgress(0);
    setMessages([]);
    setChatInput('');
  };

  const parseTextWithTimestamps = (text: string) => {
    // Matches [MM:SS] format
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
            className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-xs font-bold bg-indigo-100 text-indigo-800 hover:bg-indigo-300 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
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
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-m4v': ['.m4v']
    },
    maxFiles: 1
  });

  const uploadVideo = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setJobStatus('uploading');
    setJobMessage('Uploading file to server...');

    const formData = new FormData();
    formData.append('video', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://localhost:4000/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setJobId(response.jobId);
          setJobStatus('queued');
          setJobMessage('Upload complete. Waiting in queue...');
        } else {
          setJobStatus('error');
          setJobMessage('Upload failed.');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        setJobStatus('error');
        setJobMessage('Network error occurred during upload.');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (error) {
      console.error(error);
      setUploading(false);
      setJobStatus('error');
      setJobMessage('Failed to trigger upload.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#f8fafc] via-white to-[#f1f5f9] font-sans">
      <div className="w-full max-w-6xl space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-indigo-500/30 shadow-lg transform rotate-3 mb-6">
            <FiVideo className="h-8 w-8 text-white -rotate-3" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">OmniLens</h1>
          <p className="text-lg text-slate-500">Upload a video for AI-powered RAG indexing and interactive chat.</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 lg:p-12 border border-slate-100 transition-all duration-300">

          {/* Dropzone */}
          {!uploading && !jobStatus && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ease-in-out
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <input {...getInputProps()} />
              <FiUploadCloud className={`mx-auto h-12 w-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              {isDragActive ? (
                <p className="text-blue-600 font-medium text-lg">Drop the video here...</p>
              ) : (
                <div>
                  <p className="text-gray-700 font-medium text-lg mb-1">Drag & drop your video here</p>
                  <p className="text-gray-400 text-sm">or click to browse from your computer</p>
                  <p className="text-xs text-gray-400 mt-4 font-mono select-none bg-gray-100 inline-block px-2 py-1 rounded">MP4, MOV up to 500MB</p>
                </div>
              )}
            </div>
          )}

          {/* Selected File Overview */}
          {file && !jobStatus && (
            <div className="mt-6">
              <div className="flex items-center p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="p-3 bg-white rounded-lg shadow-sm mr-4">
                  <FiFile className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-gray-400 hover:text-red-500 px-3 transition-colors"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={uploadVideo}
                className="mt-6 w-full flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 md:text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                Upload & Process Video
              </button>
            </div>
          )}

          {/* Progress State */}
          {jobStatus && (
            <div className="mt-4 space-y-6 animate-fade-in-up">

              <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center">
                  {jobStatus === 'completed' ? (
                    <FiCheckCircle className="text-green-500 mr-2 h-5 w-5" />
                  ) : jobStatus === 'error' ? (
                    <div className="h-3 w-3 bg-red-500 rounded-full mr-2 animate-pulse" />
                  ) : (
                    <FiActivity className="text-blue-500 mr-2 h-5 w-5 animate-spin-slow" />
                  )}
                  {jobMessage}
                </span>

                {jobStatus === 'uploading' && <span>{uploadProgress}%</span>}
                {(jobStatus === 'processing' || jobStatus === 'queued') && <span>{jobProgress}%</span>}
              </div>

              {/* Progress Bar */}
              {(jobStatus === 'uploading' || jobStatus === 'processing' || jobStatus === 'queued') && (
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${jobStatus === 'uploading' ? uploadProgress : jobProgress}%` }}
                  ></div>
                </div>
              )}

              {/* Results */}
              {jobResult && (
                <div className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-6 shadow-inner">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Extracted Metadata</h3>
                  {/* Meta Data Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-slate-800 transition hover:shadow-md">
                      <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Duration</p>
                      <p className="font-bold text-xl">{jobResult.metadata.duration_seconds}s</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-slate-800 transition hover:shadow-md">
                      <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">FPS</p>
                      <p className="font-bold text-xl">{jobResult.metadata.fps}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-slate-800 transition hover:shadow-md">
                      <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Frames</p>
                      <p className="font-bold text-xl">{jobResult.metadata.total_frames}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl shadow-sm border border-emerald-100 text-emerald-800 transition hover:shadow-md">
                      <p className="text-xs text-emerald-600 font-medium mb-1 uppercase tracking-wider">AI Process Time</p>
                      <p className="font-bold text-xl text-emerald-700">{jobResult.metadata.process_time_seconds}s</p>
                    </div>
                  </div>

                  {/* Transcript Section */}
                  {jobResult.transcript && (
                    <div className="mt-8">
                      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                        Whisper Audio Transcription
                      </h4>
                      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-gray-700 text-sm overflow-y-auto w-full text-left font-serif leading-relaxed max-h-48">
                        {jobResult.transcript}
                      </div>
                    </div>
                  )}

                  {/* Keyframes Section */}
                  {jobResult.keyframes && jobResult.keyframes.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Extracted Scene Keyframes ({jobResult.keyframes.length})
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-4 pt-2">
                        {jobResult.keyframes.map((kf: any, idx: number) => (
                          <div key={idx} className="flex-shrink-0 relative group rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all">
                            <img
                              src={`http://localhost:4000${kf.path}`}
                              alt={`Frame at ${kf.time}s`}
                              className="h-32 w-auto object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-semibold px-2 py-1 bg-black/60 rounded backdrop-blur-sm">{kf.time}s</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video Player & Chat Section Side-by-Side */}
                  <div className="mt-12 border-t border-slate-100 pt-10 animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-slate-800 mb-8 flex items-center">
                      <div className="p-2.5 bg-indigo-100 rounded-xl mr-4">
                        <FiMessageSquare className="h-6 w-6 text-indigo-600" />
                      </div>
                      Interactive Analysis
                      <span className="ml-4 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[10px] rounded-full font-bold uppercase tracking-widest shadow-sm">Powered by LangChain & Vector DB</span>
                    </h3>

                    <div className="flex flex-col lg:flex-row gap-8 items-start">

                      {/* Integrated Video Player - Takes up 40% on large screens */}
                      <div className="w-full lg:w-[45%] bg-black rounded-[2rem] overflow-hidden shadow-2xl border-[6px] border-slate-800 flex items-center justify-center relative group aspect-video">
                        {file ? (
                          <video
                            ref={videoRef}
                            src={URL.createObjectURL(file)}
                            controls
                            className="w-full h-full object-contain bg-black"
                          />
                        ) : (
                          <div className="text-slate-500 flex flex-col items-center">
                            <FiVideo className="w-12 h-12 opacity-30 mb-3" />
                            <p className="text-sm font-medium">Video playback unavailable</p>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 bg-black/70 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                          Source Video
                        </div>
                      </div>

                      {/* Conversational UI - Takes up 60% on large screens */}
                      <div className="w-full lg:w-[55%] flex flex-col bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-200/50 h-[550px] overflow-hidden relative">

                        {/* Chat Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 bg-slate-50">
                          {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400 fade-in">
                              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <FiMessageSquare className="w-8 h-8 text-indigo-500" />
                              </div>
                              <p className="text-xl font-bold text-slate-600 mb-2">Vector Database Ready</p>
                              <p className="text-sm leading-relaxed max-w-sm">Ask me any question about the video contents. I will search the transcript and cite the exact timestamp of where the answer is found.</p>
                            </div>
                          ) : (
                            messages.map((msg, i) => (
                              <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                <div className={`max-w-[85%] rounded-3xl px-6 py-4 text-[15px] shadow-sm leading-relaxed ${msg.role === 'user'
                                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-tr-sm shadow-blue-500/20 font-medium whitespace-pre-wrap'
                                  : 'bg-white border text-slate-700 border-slate-200/60 rounded-tl-sm'
                                  }`}>
                                  {msg.role === 'assistant' ? parseTextWithTimestamps(msg.text) : msg.text}
                                </div>
                              </div>
                            ))
                          )}

                          {/* Loading Indicator */}
                          {isChatting && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-slate-200 text-slate-500 rounded-3xl rounded-tl-sm px-6 py-4 shadow-sm flex items-center space-x-2">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 lg:p-5 bg-white border-t border-slate-100 flex items-center z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                          <input
                            type="text"
                            className="flex-1 bg-slate-100 border-transparent rounded-full px-6 py-4 text-sm focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all placeholder-slate-400 text-slate-700 font-medium"
                            placeholder="Type your question..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            disabled={isChatting}
                            autoComplete="off"
                          />
                          <button
                            onClick={handleSendMessage}
                            disabled={isChatting || !chatInput.trim()}
                            className="ml-4 flex-shrink-0 w-14 h-14 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center transform active:scale-95"
                          >
                            <FiSend className="w-5 h-5 -ml-1 mt-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={resetState}
                    className="mt-6 w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
                  >
                    Upload Another Video
                  </button>
                </div>
              )}

              {jobStatus === 'error' && (
                <button
                  onClick={resetState}
                  className="mt-4 w-full py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium text-sm"
                >
                  Try Again
                </button>
              )}

            </div>
          )}
        </div>
      </div>
      {/* Added some global tailwind utilities for animations since Next.js standard tailwind setup doesn't have these specific keyframes out of the box unless added to tailwind.config, but they work if injected or gracefully fallback. To be safe, adding standard inline tailwind utilities above is better. */}
    </div>
  );
}
