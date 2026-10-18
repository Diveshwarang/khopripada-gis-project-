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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Verification Success Notice for Resident */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Grievance Submitted
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto mt-2 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={() => {
                setVerificationNotice(null);
                onClose();
              }}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-bold text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-amber-950/50"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {userRole === 'user' ? 'Report Citizen Grievance' : 'Report Field Grievance'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {userRole === 'user'
                      ? 'Resident Proposal • Saves as Pending for Panchayat Verification'
                      : 'Saves directly to browser IndexedDB with Photo (Works 100% Offline)'}
                  </p>
                </div>
              </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {successMsg ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-emerald-400">Grievance & Photo Stored!</h3>
            <p className="text-xs text-slate-300 max-w-xs">
              Saved locally in <code className="text-emerald-300 font-mono">SmartVillageOfflineDB</code>. Rendered immediately on the village map canvas.
            </p>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 overflow-y-auto scrollbar-thin">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Incident Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Broken water pipeline valve near school"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Category & Status/Severity Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category Badge
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as OfflineGrievance['category'])}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Status (Colored Pill)
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as OfflineGrievance['severity'])}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monsoon Access Condition
              </label>
              <select
                value={monsoonCondition}
                onChange={(e) => setMonsoonCondition(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                <option value="floods">⚠️ Floods/Isolated (Inundated or Cut Off)</option>
                <option value="year_round">✅ Year-round (Passable Access)</option>
              </select>
            </div>

            {/* Spatial Location Coordinates */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[11px]">
                  <MapPin className="w-3.5 h-3.5" />
                  Spatial Coordinates (Khopripada Grid)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Auto-filled</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px]">Lat:</span>
                  <input
                    type="number"
                    step="0.00001"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value))}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Lng:</span>
                  <input
                    type="number"
                    step="0.00001"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value))}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Photo Upload & Camera Input Section */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="text-[11px] font-semibold text-slate-200 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  Incident Photo Evidence
                </span>
                <span className="text-[10px] text-slate-400 font-mono">IndexedDB Photo Storage</span>
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
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                  >
                    {isCompressing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></span>
                        <span>Compressing Photo...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>📷 Upload Photo / Take Pic</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    Uses phone camera on site or file picker on desktop • Automatically compressed
                  </p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
                  <img
                    src={photoBase64}
                    alt="Inspection Evidence"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end justify-between p-2">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                      <ImageIcon className="w-3 h-3" />
                      Captured & Compressed
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-600 transition cursor-pointer"
                      >
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-1 rounded bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-600/50 transition cursor-pointer"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Field Inspection Notes
              </label>
              <textarea
                rows={2}
                placeholder="Details regarding hazard, affected families, or damage extent..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
              />
            </div>

            {/* Reporter Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Surveyor / Inspector Name
              </label>
              <input
                type="text"
                placeholder="e.g. Field Surveyor Rahul / Panchayat Volunteer"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
