import React, { useEffect } from 'react';
import { X, MapPin, Download, ShieldCheck, Camera } from 'lucide-react';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  photoUrl: string | null;
  title: string;
  category?: string;
  coords?: [number, number] | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  photoUrl,
  title,
  category,
  coords,
  onClose,
}) => {
  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[3500] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900/95 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
                {category && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                    {category.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>KoboCollect Field Inspection Evidence • Ground-Truth Verified</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={photoUrl}
              download={`${title.toLowerCase().replace(/\s+/g, '_')}_field_photo.jpg`}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Download High-Res Ground Photo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save Image</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Resolution Media Viewport */}
        <div className="relative flex-1 bg-slate-950/90 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <img
            src={photoUrl}
            alt={title}
            className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
          />

          {/* Location Badge Overlay */}
          {coords && (
            <div className="absolute bottom-6 left-6 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-emerald-400 shadow-xl flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{coords[0].toFixed(5)}°N, {coords[1].toFixed(5)}°E</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoLightboxModal;
