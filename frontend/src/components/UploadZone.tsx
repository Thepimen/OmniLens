import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
}

export function UploadZone({ onFileAccepted }: UploadZoneProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileAccepted(acceptedFiles[0]);
    }
  }, [onFileAccepted]);

  const onDropRejected = useCallback((fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const error = fileRejections[0].errors[0];
      if (error.code === 'file-invalid-type') {
        toast.error("Formato no soportado. Sube un archivo MP4, MOV o M4V.");
      } else if (error.code === 'file-too-large') {
        toast.error("El archivo supera el tamaño máximo de 500MB.");
      } else {
        toast.error(`Error al subir: ${error.message}`);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 
      'video/mp4': ['.mp4'], 
      'video/quicktime': ['.mov'], 
      'video/x-m4v': ['.m4v'] 
    }, 
    maxSize: 500 * 1024 * 1024, // 500MB
    maxFiles: 1,
    multiple: false
  });

  return (
    <div {...getRootProps()} className="flex-1 flex flex-col items-center justify-center relative w-full h-full p-6 outline-none cursor-pointer group">
      <input {...getInputProps()} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className={`w-full max-w-2xl aspect-video rounded-[2.5rem] border backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center transition-all duration-300 relative overflow-hidden ${
          isDragActive 
            ? 'bg-indigo-500/10 border-indigo-400/50 shadow-[0_0_80px_rgba(99,102,241,0.35)]' 
            : 'bg-white/5 border-white/10 group-hover:bg-white/10 group-hover:border-white/20 group-hover:shadow-2xl group-hover:shadow-indigo-500/10'
        }`}
      >
        {/* Glow during drag */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-cyan-500/20 animate-pulse pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center pointer-events-none">
          <motion.div
            animate={isDragActive ? { y: -8, scale: 1.08 } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`w-24 h-24 mb-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
              isDragActive 
                ? 'bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_40px_rgba(6,182,212,0.4)]' 
                : 'bg-gradient-to-tr from-indigo-500/10 to-cyan-500/10 border-white/10 group-hover:border-indigo-400/30'
            }`}
          >
            <UploadCloud className={`w-12 h-12 transition-colors duration-300 ${isDragActive ? 'text-cyan-300' : 'text-indigo-400'}`} />
          </motion.div>
          
          <h2 className={`text-2xl font-extrabold mb-3 tracking-tight transition-colors duration-300 ${isDragActive ? 'text-cyan-300' : 'text-slate-100'}`}>
            {isDragActive ? '¡Suéltalo aquí!' : 'Arrastra y suelta tu video'}
          </h2>
          
          <p className="text-slate-400 text-sm mb-6 font-medium">o haz clic en cualquier lugar para explorar tus carpetas</p>
          
          <div className="flex gap-3 text-xs font-mono text-slate-400">
            <span className="px-3.5 py-1.5 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md font-semibold tracking-wider">MP4</span>
            <span className="px-3.5 py-1.5 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md font-semibold tracking-wider">MOV</span>
            <span className="px-3.5 py-1.5 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md font-semibold tracking-wider">Máx 500MB</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
