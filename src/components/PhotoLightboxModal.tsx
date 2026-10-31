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
      className="fixed inset-0 z-[4000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl mx-auto max-h-[85dvh] sm:max-h-[95dvh] bg-[#0D1C2A] border-t sm:border border-[#1D3B52] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden text-[#F1F5F9] flex flex-col overscroll-contain">
        {/* Mobile touch-drag handle pill */}
        <div className="w-10 h-1 bg-[#1D3B52] rounded-full mx-auto my-2 sm:hidden flex-shrink-0" />
        {/* Modal Top Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#1D3B52] bg-[#081018] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#142C3F] border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] flex-shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F1F5F9] tracking-tight truncate">{title}</h3>
                {category && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 flex-shrink-0">
                    {category.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8CB0C9] flex items-center gap-1.5 mt-0.5 font-mono truncate">
                <ShieldCheck className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                <span className="truncate">Ground-Truth Verified Evidence</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={photoUrl}
              download={`${title.toLowerCase().replace(/\s+/g, '_')}_field_photo.jpg`}
              className="px-2.5 py-1.5 min-h-[44px] rounded-xl bg-[#142C3F] hover:bg-[#1D3B52] text-[#F1F5F9] border border-[#1D3B52] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
              title="Download High-Res Ground Photo"
            >
              <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="hidden sm:inline">Save</span>
            </a>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#8CB0C9] hover:text-[#F1F5F9] hover:bg-[#142C3F] transition cursor-pointer"
              title="Close (Esc)"
              aria-label="Close photo viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Resolution Media Viewport */}
        <div className="relative flex-1 bg-[#081018] flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <img
            src={photoUrl}
            alt={title}
            className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain border border-[#1D3B52] shadow-2xl"
          />

          {/* Location Badge Overlay */}
          {coords && (
            <div className="absolute bottom-6 left-6 px-3 py-1.5 rounded-xl bg-[#081018]/90 backdrop-blur-md border border-[#1D3B52] text-xs font-mono text-[#00E5FF] shadow-xl flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>{coords[0].toFixed(5)}°N, {coords[1].toFixed(5)}°E</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoLightboxModal;
