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
        approval_status: isAdmin ? 'approved' : isResident ? 'pending_approval' : 'approved',
        submitted_by: isResident ? 'Resident' : isOfficer ? 'Officer' : 'Admin',
        status: isResident ? 'reported' : 'under_inspection',
      };

      const id = await db.offline_grievances.add(newGrievance);
      newGrievance.id = id;

      onGrievanceSaved(newGrievance);

      if (isResident) {
        setVerificationNotice(
          'Submitted for Panchayat Verification. Your submission will appear on the map once reviewed and approved by the Sarpanch/Admin.'
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-[#0C171C]/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#132228] border border-[#334B56] rounded-2xl shadow-2xl overflow-hidden text-[#F8FAFC] flex flex-col max-h-[92dvh] overscroll-contain">
        {/* Verification Success Notice for Resident */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#E05A47]/20 border border-[#E05A47]/60 flex items-center justify-center text-[#FCA5A5] shadow-[0_0_25px_rgba(224,90,71,0.3)] animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-[#F8FAFC] mt-2">
                Grievance Submitted
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mt-2 leading-relaxed bg-[#0C171C] p-3 rounded-xl border border-[#334B56]">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={() => {
                setVerificationNotice(null);
                onClose();
              }}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs transition active:scale-95 cursor-pointer shadow-md"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#334B56] bg-[#0C171C]/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#E05A47]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC] tracking-tight">
                    {userRole === 'user' ? 'Report Citizen Grievance' : 'Report Field Grievance'}
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    {userRole === 'user'
                      ? 'Resident Proposal • Saves as Pending for Panchayat Verification'
                      : 'Saves directly to browser IndexedDB with Photo (Works 100% Offline)'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] transition cursor-pointer"
                title="Close"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Banner */}
            {successMsg ? (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#10B981]/20 border border-[#10B981] text-[#6EE7B7] flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#6EE7B7]">Grievance & Photo Stored!</h3>
                <p className="text-xs text-[#94A3B8] max-w-xs">
                  Saved locally in <code className="text-[#38BDF8] font-mono">SmartVillageOfflineDB</code>. Rendered immediately on the village map canvas.
                </p>
              </div>
            ) : (
              /* Form Content */
              <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 overflow-y-auto scrollbar-thin">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Incident Title <span className="text-[#E05A47]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broken water pipeline valve near school"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] transition"
                  />
                </div>

                {/* Category & Status/Severity Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Category Badge
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as OfflineGrievance['category'])}
                      className="w-full px-3 py-2 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] transition cursor-pointer"
                    >
                      <option value="water">💧 Water Supply</option>
                      <option value="roads">🛣️ Roads / Access</option>
                      <option value="sanitation">🧹 Drainage & Waste</option>
                      <option value="electricity">⚡ Electricity</option>
                      <option value="health">🏥 Public Health</option>
                      <option value="other">📌 Other Infrastructure</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      Status (Colored Pill)
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as OfflineGrievance['severity'])}
                      className="w-full px-3 py-2 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] transition cursor-pointer"
                    >
                      <option value="low">🟢 Solved / Low Priority</option>
                      <option value="medium">🟡 In Progress / Medium</option>
                      <option value="high">🟠 New / High Priority</option>
                      <option value="critical">🔴 Critical / Urgent Hotspot</option>
                    </select>
                  </div>
                </div>

                {/* Monsoon Access Condition Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Monsoon Access Condition
                  </label>
                  <select
                    value={monsoonCondition}
                    onChange={(e) => setMonsoonCondition(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] transition cursor-pointer"
                  >
                    <option value="floods">⚠️ Floods/Isolated (Inundated or Cut Off)</option>
                    <option value="year_round">✅ Year-round (Passable Access)</option>
                  </select>
                </div>

                {/* Spatial Location Coordinates */}
                <div className="p-2.5 rounded-xl bg-[#0C171C] border border-[#334B56]">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#38BDF8] flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3.5 h-3.5" />
                      Spatial Coordinates (Khopripada Grid)
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">Auto-filled</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[#94A3B8] text-[10px]">Lat:</span>
                      <input
                        type="number"
                        step="0.00001"
                        inputMode="decimal"
                        value={lat}
                        onChange={(e) => setLat(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 min-h-[38px] bg-[#132228] border border-[#334B56] rounded text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[#94A3B8] text-[10px]">Lng:</span>
                      <input
                        type="number"
                        step="0.00001"
                        inputMode="decimal"
                        value={lng}
                        onChange={(e) => setLng(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 min-h-[38px] bg-[#132228] border border-[#334B56] rounded text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Upload & Camera Input Section */}
                <div className="p-3 rounded-xl bg-[#0C171C] border border-[#334B56]">
                  <label className="text-[11px] font-semibold text-[#94A3B8] block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Incident Photo Evidence
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">IndexedDB Photo Storage</span>
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
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#334B56] hover:border-[#38BDF8] bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                      >
                        {isCompressing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-[#38BDF8]/30 border-t-[#38BDF8] rounded-full animate-spin"></span>
                            <span>Compressing Photo...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-[#38BDF8]" />
                            <span>📷 Upload Photo / Take Pic</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-[#94A3B8] text-center">
                        Uses phone camera on site or file picker on desktop • Automatically compressed
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] group">
                      <img
                        src={photoBase64}
                        alt="Inspection Evidence"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#132228]/95 via-transparent to-transparent flex items-end justify-between p-2">
                        <span className="text-[10px] text-[#38BDF8] font-mono font-bold flex items-center gap-1 bg-[#132228]/90 px-2 py-0.5 rounded border border-[#38BDF8]/40">
                          <ImageIcon className="w-3 h-3" />
                          Captured & Compressed
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2 py-0.5 rounded bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] text-[10px] font-semibold border border-[#334B56] transition cursor-pointer"
                          >
                            Retake
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="p-1 rounded bg-[#E05A47]/90 hover:bg-[#E05A47] text-[#F8FAFC] border border-[#E05A47] transition cursor-pointer"
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
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Field Inspection Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details regarding hazard, affected families, or damage extent..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] transition resize-none"
                  />
                </div>

                {/* Reporter Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Surveyor / Inspector Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Field Surveyor Rahul / Panchayat Volunteer"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#0C171C] border border-[#334B56] rounded-xl text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] transition"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isCompressing}
                    className="px-5 py-2 text-xs font-bold text-[#F8FAFC] bg-gradient-to-r from-[#D9534F] to-[#E05A47] hover:brightness-110 active:scale-95 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
