import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Database,
  Trash2,
  MapPin,
  Calendar,
  AlertCircle,
  FileDown,
  Navigation,
  FileSpreadsheet,
  CheckCircle2,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import {
  db,
  type OfflineGrievance,
  exportGrievancesToGeoJson,
  exportGrievancesToCsv,
} from '../services/offlineDb';
import { compressImageToBase64 } from '../utils/imageUtils';
import type { UserRole } from '../types';

interface GrievanceListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFlyToGrievance: (coords: [number, number]) => void;
  userRole?: UserRole;
  onGrievanceStatusUpdated?: () => void;
}

export const GrievanceListDrawer: React.FC<GrievanceListDrawerProps> = ({
  isOpen,
  onClose,
  onFlyToGrievance,
  userRole = 'user',
  onGrievanceStatusUpdated,
}) => {
  const [grievances, setGrievances] = useState<OfflineGrievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhotoUploadId, setActivePhotoUploadId] = useState<number | null>(null);
  const officerFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadGrievances = async () => {
    setLoading(true);
    try {
      const records = await db.offline_grievances.reverse().toArray();
      if (userRole === 'officer') {
        // Officers ONLY receive and view grievances that have been officially APPROVED by Admin and not resolved
        const officerWorklist = records.filter(
          (g) =>
            (g.approval_status === 'approved' || g.approval_status === undefined) &&
            (g.status || '').toLowerCase() !== 'resolved'
        );
        setGrievances(officerWorklist);
      } else {
        setGrievances(records);
      }
    } catch (err) {
      console.error('Failed to load grievances from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGrievances();
    }
  }, [isOpen, userRole]);

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      await db.offline_grievances.update(id, { status: newStatus });
      setGrievances((prev) =>
        prev
          .map((item) => (item.id === id ? { ...item, status: newStatus } : item))
          .filter((item) => (userRole === 'officer' ? item.status !== 'resolved' : true))
      );
      if (onGrievanceStatusUpdated) {
        onGrievanceStatusUpdated();
      }
    } catch (err) {
      console.error('Failed to update status in IndexedDB:', err);
    }
  };

  const handleAttachProofPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activePhotoUploadId === null) return;
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      await db.offline_grievances.update(activePhotoUploadId, { photoBase64: compressed });
      setGrievances((prev) =>
        prev.map((g) => (g.id === activePhotoUploadId ? { ...g, photoBase64: compressed } : g))
      );
      if (onGrievanceStatusUpdated) {
        onGrievanceStatusUpdated();
      }
    } catch (err) {
      console.error('Failed to attach proof photo:', err);
    } finally {
      setActivePhotoUploadId(null);
      if (officerFileInputRef.current) {
        officerFileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await db.offline_grievances.delete(id);
      setGrievances((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error('Failed to delete grievance:', err);
    }
  };

  const handleExportGeoJson = () => {
    const geoJsonStr = exportGrievancesToGeoJson(grievances);
    const dataStr = 'data:application/geo+json;charset=utf-8,' + encodeURIComponent(geoJsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `khopripada_field_grievances_${Date.now()}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCsv = () => {
    const csvStr = exportGrievancesToCsv(grievances);
    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bapane_gram_panchayat_grievances_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  const severityColors = {
    low: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    medium: 'text-yellow-400 bg-yellow-950/60 border-yellow-500/30',
    high: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    critical: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[2000] w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-200">
      {/* Hidden file input for officer photo evidence */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={officerFileInputRef}
        onChange={handleAttachProofPhoto}
        className="hidden"
      />

      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              userRole === 'officer'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
            }`}>
              {userRole === 'officer' ? <ShieldCheck className="w-4 h-4" /> : <Database className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                {userRole === 'officer' ? (
                  <>
                    Officer Field Worklist
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono">
                      {grievances.length} Active Tasks
                    </span>
                  </>
                ) : userRole === 'admin' ? (
                  <>
                    Offline Field Records
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                      {grievances.length}
                    </span>
                  </>
                ) : (
                  <>
                    Citizen Field Grievances
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/40 text-amber-300 font-mono">
                      {grievances.length}
                    </span>
                  </>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {userRole === 'officer'
                  ? 'Officially Approved Panchayat Tasks • Update Status & Proof'
                  : 'Persistent in IndexedDB • Zero Cloud Dependency'}
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

        {/* Dual Export Bar (GeoJSON for QGIS + CSV for Gram Panchayat) */}
        {grievances.length > 0 && userRole !== 'user' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-medium">Export Formats:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportGeoJson}
                className="px-2.5 py-1 rounded-lg text-emerald-300 hover:text-emerald-200 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                title="Export as standard GeoJSON for QGIS/ArcGIS"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>GeoJSON (QGIS)</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-2.5 py-1 rounded-lg text-cyan-300 hover:text-cyan-200 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                title="Export as CSV for Bapane Gram Panchayat administration"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV (Panchayat)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading IndexedDB records...
          </div>
        ) : grievances.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-2 text-slate-400">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <p className="text-xs">
              {userRole === 'officer'
                ? 'No pending verified tasks assigned in your worklist.'
                : 'No offline grievances logged yet.'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              {userRole === 'officer'
                ? 'Tasks appear here when approved by the Panchayat Admin.'
                : 'Click "Report Grievance" on the map to log issues while surveying Khopripada.'}
            </p>
          </div>
        ) : (
          grievances.map((g) => {
            const hasPhoto = Boolean(g.photoBase64);
            const isFloods = (g.description || '').toLowerCase().includes('flood') || (g.description || '').toLowerCase().includes('inundat') || g.severity === 'critical';
            const monsoonBadge = isFloods ? '⚠️ Floods/Isolated' : '✅ Year-round';
            const isApproved = g.approval_status === 'approved' || g.approval_status === undefined;
            const currentStatus = g.status || 'reported';

            return (
              <div
                key={g.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-2"
              >
                {/* Photo Thumbnail */}
                {hasPhoto ? (
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                    <img
                      src={g.photoBase64}
                      alt={g.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-950/80 text-emerald-400 border border-emerald-500/40">
                      📷 Photo Evidence
                    </span>
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {/* Category Badge & Status Pill */}
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          severityColors[g.severity] || severityColors.medium
                        }`}
                      >
                        ● {g.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {g.category}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        isFloods ? 'text-amber-300 bg-amber-950/60 border-amber-500/30' : 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30'
                      }`}>
                        {monsoonBadge}
                      </span>
                      {/* Approval Status Badge */}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border font-mono ${
                        isApproved
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : g.approval_status === 'rejected'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      }`}>
                        {isApproved ? '✓ Verified' : g.approval_status === 'rejected' ? '✗ Rejected' : '⏳ Pending Approval'}
                      </span>
                    </div>

                    {/* Incident Title */}
                    <h4 className="text-xs font-bold text-slate-100">{g.title}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onFlyToGrievance([g.latitude, g.longitude]);
                        onClose();
                      }}
                      className="p-1 rounded text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Fly to Location"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {g.description && (
                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 line-clamp-2">
                    {g.description}
                  </p>
                )}

                {/* Officer Action Bar: Status Transitions & Photo Attachment */}
                {userRole === 'officer' && (
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 mt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-medium">Worklist Status:</span>
                      <span className="font-mono text-cyan-400 capitalize">
                        {currentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'under_inspection')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          currentStatus === 'under_inspection'
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Inspecting
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'in_progress')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          currentStatus === 'in_progress'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'resolved')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                        title="Mark issue completely resolved"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePhotoUploadId(g.id!);
                          officerFileInputRef.current?.click();
                        }}
                        className="ml-auto px-2 py-1 rounded text-[10px] font-semibold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 cursor-pointer transition"
                        title="Attach field proof photo"
                      >
                        <Camera className="w-3 h-3" />
                        {hasPhoto ? 'Update Photo' : 'Attach Proof'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <MapPin className="w-3 h-3" />
                    {g.latitude.toFixed(5)}°N, {g.longitude.toFixed(5)}°E
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(g.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GrievanceListDrawer;
