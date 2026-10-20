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
    low: 'text-[#6EE7B7] bg-[#10B981]/20 border-[#10B981]/50',
    medium: 'text-[#FDE68A] bg-[#F59E0B]/20 border-[#F59E0B]/50',
    high: 'text-[#FCA5A5] bg-[#E05A47]/30 border-[#E05A47]/60',
    critical: 'text-[#FCA5A5] bg-[#E05A47]/40 border-[#E05A47]',
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[2000] w-full max-w-md bg-[#132228]/98 backdrop-blur-2xl border-l border-[#334B56] shadow-2xl flex flex-col text-[#F8FAFC] animate-in slide-in-from-right duration-200">
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
      <div className="p-4 border-b border-[#334B56] bg-[#0C171C]/90 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              userRole === 'officer'
                ? 'bg-[#10B981]/20 border border-[#10B981]/50 text-[#6EE7B7]'
                : 'bg-[#1B2F38] border border-[#334B56] text-[#38BDF8]'
            }`}>
              {userRole === 'officer' ? <ShieldCheck className="w-4 h-4" /> : <Database className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2">
                {userRole === 'officer' ? (
                  <>
                    Officer Field Worklist
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/50 text-[#6EE7B7] font-mono">
                      {grievances.length} Active Tasks
                    </span>
                  </>
                ) : userRole === 'admin' ? (
                  <>
                    Offline Field Records
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] font-mono">
                      {grievances.length}
                    </span>
                  </>
                ) : (
                  <>
                    Citizen Field Grievances
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/50 text-[#FCA5A5] font-mono">
                      {grievances.length}
                    </span>
                  </>
                )}
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                {userRole === 'officer'
                  ? 'Officially Approved Panchayat Tasks • Update Status & Proof'
                  : 'Persistent in IndexedDB • Zero Cloud Dependency'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] transition cursor-pointer"
            title="Close Drawer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Export Bar (GeoJSON for QGIS + CSV for Gram Panchayat) */}
        {grievances.length > 0 && userRole !== 'user' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#334B56]/50">
            <span className="text-[10px] text-[#94A3B8] font-medium">Export Formats:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportGeoJson}
                className="px-2.5 py-1 rounded-lg text-[#38BDF8] hover:text-[#F8FAFC] bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                title="Export as standard GeoJSON for QGIS/ArcGIS"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>GeoJSON (QGIS)</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-2.5 py-1 rounded-lg text-[#FCD34D] hover:text-[#F8FAFC] bg-[#1B2F38] hover:bg-[#233B46] border border-[#FCD34D]/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
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
          <div className="text-center py-12 text-[#94A3B8] text-xs">
            Loading IndexedDB records...
          </div>
        ) : grievances.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-2 text-[#94A3B8]">
            <AlertCircle className="w-8 h-8 text-[#334B56]" />
            <p className="text-xs">
              {userRole === 'officer'
                ? 'No pending verified tasks assigned in your worklist.'
                : 'No offline grievances logged yet.'}
            </p>
            <p className="text-[11px] text-[#94A3B8]/80 max-w-xs">
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
                className="p-3 rounded-xl bg-[#1B2F38] border border-[#334B56] hover:border-[#38BDF8]/60 transition flex flex-col gap-2"
              >
                {/* Photo Thumbnail */}
                {hasPhoto ? (
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-[#334B56] bg-[#0C171C]">
                    <img
                      src={g.photoBase64}
                      alt={g.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#132228]/95 text-[#38BDF8] border border-[#38BDF8]/40">
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
                      <span className="text-[10px] uppercase font-semibold text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#0C171C] border border-[#334B56]">
                        {g.category}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        isFloods ? 'text-[#FCA5A5] bg-[#E05A47]/20 border-[#E05A47]/50' : 'text-[#6EE7B7] bg-[#10B981]/20 border-[#10B981]/50'
                      }`}>
                        {monsoonBadge}
                      </span>
                      {/* Approval Status Badge */}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border font-mono ${
                        isApproved
                          ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/60'
                          : g.approval_status === 'rejected'
                          ? 'bg-[#E05A47]/30 text-[#FCA5A5] border-[#E05A47]'
                          : 'bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/50'
                      }`}>
                        {isApproved ? '✓ Verified' : g.approval_status === 'rejected' ? '✗ Rejected' : '⏳ Pending Approval'}
                      </span>
                    </div>

                    {/* Incident Title */}
                    <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onFlyToGrievance([g.latitude, g.longitude]);
                        onClose();
                      }}
                      className="p-1 rounded text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#233B46] transition cursor-pointer"
                      title="Fly to Location"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="p-1 rounded text-[#94A3B8] hover:text-[#FCA5A5] hover:bg-[#233B46] transition cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {g.description && (
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed bg-[#0C171C] p-2 rounded-lg border border-[#334B56] line-clamp-2">
                    {g.description}
                  </p>
                )}

                {/* Officer Action Bar: Status Transitions & Photo Attachment */}
                {userRole === 'officer' && (
                  <div className="p-2 rounded-lg bg-[#0C171C] border border-[#334B56] space-y-2 mt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#94A3B8] font-medium">Worklist Status:</span>
                      <span className="font-mono text-[#F8FAFC] capitalize">
                        {currentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'under_inspection')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          currentStatus === 'under_inspection'
                            ? 'bg-[#38BDF8] text-[#0C171C] font-bold shadow-sm'
                            : 'bg-[#1B2F38] text-[#94A3B8] hover:bg-[#233B46] hover:text-[#F8FAFC]'
                        }`}
                      >
                        Inspecting
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'in_progress')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          currentStatus === 'in_progress'
                            ? 'bg-[#E05A47] text-[#F8FAFC] font-bold shadow-sm'
                            : 'bg-[#1B2F38] text-[#94A3B8] hover:bg-[#233B46] hover:text-[#F8FAFC]'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(g.id!, 'resolved')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
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
                        className="ml-auto px-2 py-1 rounded text-[10px] font-semibold bg-[#1B2F38] hover:bg-[#233B46] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334B56] flex items-center gap-1 cursor-pointer transition"
                        title="Attach field proof photo"
                      >
                        <Camera className="w-3 h-3" />
                        {hasPhoto ? 'Update Photo' : 'Attach Proof'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[#334B56]/50 text-[10px] font-mono text-[#94A3B8]">
                  <span className="flex items-center gap-1 text-[#38BDF8]">
                    <MapPin className="w-3 h-3" />
                    {g.latitude.toFixed(5)}°N, {g.longitude.toFixed(5)}°E
                  </span>
                  <span className="flex items-center gap-1 text-[#94A3B8]">
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
