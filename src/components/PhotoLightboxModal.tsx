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
      className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-[#132228] border border-[#334B56] rounded-2xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] overflow-hidden text-[#F8FAFC] flex flex-col max-h-[95dvh] overscroll-contain">
        {/* Modal Top Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#334B56] bg-[#132228] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#38BDF8] flex-shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F8FAFC] tracking-tight truncate">{title}</h3>
                {category && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] flex-shrink-0">
                    {category.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5 mt-0.5 font-mono truncate">
                <ShieldCheck className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                <span className="truncate">Ground-Truth Verified Evidence</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={photoUrl}
              download={`${title.toLowerCase().replace(/\s+/g, '_')}_field_photo.jpg`}
              className="px-2.5 py-1.5 min-h-[44px] rounded-xl bg-[#1B2F38] hover:bg-[#233B46] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334B56] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Download High-Res Ground Photo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </a>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] transition cursor-pointer"
              title="Close (Esc)"
              aria-label="Close photo viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Resolution Media Viewport */}
        <div className="relative flex-1 bg-[#0C171C] flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <img
            src={photoUrl}
            alt={title}
            className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain border border-[#334B56] shadow-2xl"
          />

          {/* Location Badge Overlay */}
          {coords && (
            <div className="absolute bottom-6 left-6 px-3 py-1.5 rounded-xl bg-[#132228]/95 backdrop-blur-md border border-[#334B56] text-xs font-mono text-[#38BDF8] shadow-xl flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{coords[0].toFixed(5)}°N, {coords[1].toFixed(5)}°E</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoLightboxModal;
