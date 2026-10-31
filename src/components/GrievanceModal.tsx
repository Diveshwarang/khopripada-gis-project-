import React, { useState, useRef } from 'react';
import {
  AlertTriangle,
  X,
  MapPin,
  Save,
  CheckCircle2,
  Camera,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { db, type OfflineGrievance } from '../services/offlineDb';
import { compressImageToBase64 } from '../utils/imageUtils';
import type { UserRole } from '../types';
import { upsertIssue } from '../services/dataService';

interface GrievanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords: [number, number];
  onGrievanceSaved: (grievance: OfflineGrievance) => void;
  userRole?: UserRole;
}

export const GrievanceModal: React.FC<GrievanceModalProps> = ({
  isOpen,
  onClose,
  initialCoords,
  onGrievanceSaved,
  userRole = 'user',
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<OfflineGrievance['category']>('water');
  const [severity, setSeverity] = useState<OfflineGrievance['severity']>('high');
  const [monsoonCondition, setMonsoonCondition] = useState<string>('floods');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [lat, setLat] = useState(initialCoords[0]);
  const [lng, setLng] = useState(initialCoords[1]);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync coords if initialCoords change
  React.useEffect(() => {
    setLat(initialCoords[0]);
    setLng(initialCoords[1]);
  }, [initialCoords]);

  if (!isOpen) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      setPhotoBase64(compressed);
    } catch (err) {
      console.error('Failed to compress grievance image:', err);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      // Pack monsoon condition into notes or description cleanly
      const monsoonNote = monsoonCondition === 'floods'
        ? '[Monsoon Condition: Floods/Isolated]'
        : '[Monsoon Condition: Year-round]';

      const fullDescription = description.trim()
        ? `${description.trim()} ${monsoonNote}`
        : monsoonNote;

      const isResident = userRole === 'user';
      const isOfficer = userRole === 'officer';
      const isAdmin = userRole === 'admin';

      const initialStatus = isResident
        ? 'pending_initial_approval'
        : isOfficer
        ? 'assigned_for_inspection'
        : 'under_inspection';

      const newGrievance: OfflineGrievance = {
        title: title.trim(),
        category,
        severity,
        latitude: lat,
        longitude: lng,
        timestamp: Date.now(),
        synced: false,
        description: fullDescription,
        reporterName: reporterName.trim() || (isResident ? 'Khopripada Resident' : isOfficer ? 'Field Officer' : 'Panchayat Admin'),
        photoBase64: photoBase64 || undefined,
        approval_status: isAdmin ? 'approved' : 'pending_approval',
        submitted_by: isResident ? 'Resident' : isOfficer ? 'Officer' : 'Admin',
        status: initialStatus,
      };

      const id = await db.offline_grievances.add(newGrievance);
      newGrievance.id = id;

      // Realtime cross-device sync via Supabase dataService
      await upsertIssue({
        id,
        title: newGrievance.title,
        category: newGrievance.category,
        severity: newGrievance.severity,
        latitude: newGrievance.latitude,
        longitude: newGrievance.longitude,
        description: newGrievance.description,
        reporter_name: newGrievance.reporterName,
        photoBase64: newGrievance.photoBase64,
        approval_status: newGrievance.approval_status,
        submitted_by: newGrievance.submitted_by,
        status: newGrievance.status,
      });

      onGrievanceSaved(newGrievance);

      if (isResident) {
        setVerificationNotice(
          'Submitted to Gram Panchayat. Awaiting Sarpanch/Admin verification.'
        );
      } else {
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          setTitle('');
          setDescription('');
          setPhotoBase64(null);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to save offline grievance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg mx-auto max-h-[85dvh] sm:max-h-[90dvh] bg-[#0D1C2A] border-t sm:border border-[#1D3B52] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col text-[#F1F5F9] overflow-hidden">
        {/* Mobile touch-drag handle pill */}
        <div className="w-10 h-1 bg-[#1D3B52] rounded-full mx-auto my-2 sm:hidden flex-shrink-0" />

        {/* Verification Success Notice for Resident */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-[#F59E0B] shadow-xs animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Grievance Submitted
              </h3>
              <p className="text-xs text-[#8CB0C9] max-w-sm mx-auto mt-2 leading-relaxed bg-[#081018] p-3 rounded-xl border border-[#1D3B52]">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={() => {
                setVerificationNotice(null);
                onClose();
              }}
              className="mt-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#38BDF8] text-[#081018] font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#1D3B52] bg-[#081018] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {userRole === 'user' ? 'Report Citizen Grievance' : 'Report Field Grievance'}
                  </h2>
                  <p className="text-xs text-[#8CB0C9]">
                    {userRole === 'user'
                      ? 'Resident Proposal • Saves as Pending for Panchayat Verification'
                      : 'Saves directly to browser IndexedDB with Photo (Works 100% Offline)'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#8CB0C9] hover:text-[#F1F5F9] hover:bg-[#142C3F] transition cursor-pointer"
                title="Close"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Banner */}
            {successMsg ? (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-800 text-emerald-400 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-emerald-400">Grievance & Photo Stored!</h3>
                <p className="text-xs text-[#8CB0C9] max-w-xs">
                  Saved locally in <code className="text-[#00E5FF] font-mono">SmartVillageOfflineDB</code>. Rendered immediately on the village map canvas.
                </p>
              </div>
            ) : (
              /* Form Content */
              <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 overflow-y-auto scrollbar-thin flex-1">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                    Incident Title <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broken water pipeline valve near school"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] placeholder-[#5A7C93] focus:outline-none focus:border-[#00E5FF] transition"
                  />
                </div>

                {/* Category & Status/Severity Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                      Category Badge
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as OfflineGrievance['category'])}
                      className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] focus:outline-none focus:border-[#00E5FF] transition cursor-pointer"
                    >
                      <option value="water" className="bg-[#0D1C2A]">Water Supply</option>
                      <option value="roads" className="bg-[#0D1C2A]">Roads / Access</option>
                      <option value="sanitation" className="bg-[#0D1C2A]">Drainage & Waste</option>
                      <option value="electricity" className="bg-[#0D1C2A]">Electricity</option>
                      <option value="health" className="bg-[#0D1C2A]">Public Health</option>
                      <option value="other" className="bg-[#0D1C2A]">Other Infrastructure</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                      Status (Colored Pill)
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as OfflineGrievance['severity'])}
                      className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] focus:outline-none focus:border-[#00E5FF] transition cursor-pointer"
                    >
                      <option value="low" className="bg-[#0D1C2A]">Solved / Low Priority</option>
                      <option value="medium" className="bg-[#0D1C2A]">In Progress / Medium</option>
                      <option value="high" className="bg-[#0D1C2A]">New / High Priority</option>
                      <option value="critical" className="bg-[#0D1C2A]">Critical / Urgent Hotspot</option>
                    </select>
                  </div>
                </div>

                {/* Monsoon Access Condition Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                    Monsoon Access Condition
                  </label>
                  <select
                    value={monsoonCondition}
                    onChange={(e) => setMonsoonCondition(e.target.value)}
                    className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] focus:outline-none focus:border-[#00E5FF] transition cursor-pointer"
                  >
                    <option value="floods" className="bg-[#0D1C2A]">Floods / Isolated (Inundated or Cut Off)</option>
                    <option value="year_round" className="bg-[#0D1C2A]">Year-round (Passable Access)</option>
                  </select>
                </div>

                {/* Spatial Location Coordinates */}
                <div className="p-2.5 rounded-xl bg-[#081018]/60 border border-[#1D3B52]">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#00E5FF] flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3.5 h-3.5" />
                      Spatial Coordinates (Khopripada Grid)
                    </span>
                    <span className="text-[10px] text-[#5A7C93] font-mono">Auto-filled</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[#8CB0C9] text-[10px]">Lat:</span>
                      <input
                        type="number"
                        step="0.00001"
                        inputMode="decimal"
                        value={lat}
                        onChange={(e) => setLat(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 min-h-[38px] bg-[#081018] border border-[#1D3B52] rounded text-[#F1F5F9] focus:outline-none focus:border-[#00E5FF] text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[#8CB0C9] text-[10px]">Lng:</span>
                      <input
                        type="number"
                        step="0.00001"
                        inputMode="decimal"
                        value={lng}
                        onChange={(e) => setLng(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 min-h-[38px] bg-[#081018] border border-[#1D3B52] rounded text-[#F1F5F9] focus:outline-none focus:border-[#00E5FF] text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Upload & Camera Input Section */}
                <div className="p-3 rounded-xl bg-[#081018]/60 border border-[#1D3B52]">
                  <label className="text-[11px] font-semibold text-[#8CB0C9] block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
                      Incident Photo Evidence
                    </span>
                    <span className="text-[10px] text-[#5A7C93] font-mono">IndexedDB Photo Storage</span>
                  </label>

                  {/* Explicit camera/file input */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="photo-upload"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {!photoBase64 ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressing}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#1D3B52] hover:border-[#00E5FF] bg-[#081018] hover:bg-[#142C3F] text-[#8CB0C9] hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                      >
                        {isCompressing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin"></span>
                            <span>Compressing Photo...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-[#00E5FF]" />
                            <span>Upload Evidence Photo</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-[#5A7C93] text-center">
                        Uses phone camera on site or file picker on desktop • Automatically compressed
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-[#1D3B52] bg-[#081018] group">
                      <img
                        src={photoBase64}
                        alt="Inspection Evidence"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-2">
                        <span className="text-[10px] text-white font-mono font-bold flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-white/20">
                          <ImageIcon className="w-3 h-3 text-[#00E5FF]" />
                          Captured & Compressed
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2 py-0.5 rounded bg-[#142C3F] hover:bg-[#1D3B52] text-white text-[10px] font-semibold border border-[#1D3B52] transition cursor-pointer"
                          >
                            Retake
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="p-1 rounded bg-[#EF4444] hover:bg-[#DC2626] text-white border border-[#EF4444] transition cursor-pointer"
                            title="Remove Photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                    Field Inspection Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details regarding hazard, affected families, or damage extent..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] placeholder-[#5A7C93] focus:outline-none focus:border-[#00E5FF] transition resize-none"
                  />
                </div>

                {/* Reporter Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#8CB0C9] mb-1">
                    Surveyor / Inspector Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Field Surveyor Rahul / Panchayat Volunteer"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full px-3 py-2 text-[16px] sm:text-xs min-h-[44px] bg-[#081018] border border-[#1D3B52] rounded-xl text-[#F1F5F9] placeholder-[#5A7C93] focus:outline-none focus:border-[#00E5FF] transition"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1D3B52]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#8CB0C9] hover:text-[#F1F5F9] bg-[#081018] hover:bg-[#142C3F] border border-[#1D3B52] rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isCompressing}
                    className="min-h-[44px] px-5 py-2.5 text-xs font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to IndexedDB</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GrievanceModal;
