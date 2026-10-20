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
import {
  transitionToInspectionVerification,
  transitionToResolutionApproval,
} from '../services/dataService';
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
  const [officerNotesMap, setOfficerNotesMap] = useState<Record<number, string>>({});
  const [proofPhotoMap, setProofPhotoMap] = useState<Record<number, string>>({});
  const [drawerToast, setDrawerToast] = useState<string | null>(null);
  const officerFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadGrievances = async () => {
    setLoading(true);
    try {
      const records = await db.offline_grievances.reverse().toArray();
      if (userRole === 'officer') {
        // Field Officer sees issues assigned to them or in-flight
        const officerWorklist = records.filter((g) => {
          const st = g.status || 'reported';
          return (
            st === 'assigned_for_inspection' ||
            st === 'pending_inspection_verification' ||
            st === 'under_inspection' ||
            st === 'pending_resolution_approval' ||
            st === 'reported' ||
            st === 'in_progress'
          );
        });
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


  // Step 3 (Officer): Start Field Inspection -> updates status to pending_inspection_verification
  const handleStartFieldInspection = async (id: number) => {
    try {
      await transitionToInspectionVerification(id, 'Officer requested inspection authorization.');
      setDrawerToast('Inspection request sent to Admin for sign-off');
      setTimeout(() => setDrawerToast(null), 3500);
      await loadGrievances();
      if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
    } catch (err) {
      console.error('Failed to start inspection:', err);
    }
  };

  // Step 5 (Officer): Submit Resolution & Photo -> updates status to pending_resolution_approval
  const handleSubmitResolutionAndPhoto = async (id: number) => {
    const photo = proofPhotoMap[id];
    const notes = officerNotesMap[id] || 'Field repair completed as per specifications.';
    try {
      await transitionToResolutionApproval(id, photo || '', notes);
      setDrawerToast('Resolution proof submitted! Awaiting Admin audit.');
      setTimeout(() => setDrawerToast(null), 3500);
      await loadGrievances();
      if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
    } catch (err) {
      console.error('Failed to submit resolution:', err);
    }
  };

  const handleAttachProofPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activePhotoUploadId === null) return;
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      setProofPhotoMap((prev) => ({ ...prev, [activePhotoUploadId]: compressed }));
      await db.offline_grievances.update(activePhotoUploadId, { resolution_photo_url: compressed });
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

      {/* Toast Notice */}
      {drawerToast && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-[#10B981]/20 border border-[#10B981]/50 text-[#6EE7B7] text-xs font-semibold animate-in fade-in">
          {drawerToast}
        </div>
      )}

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
            const monsoonBadge = isFloods ? 'Floods / Isolated' : 'Year-round';
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
                      Photo Evidence
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
                        {isApproved ? 'Verified' : g.approval_status === 'rejected' ? 'Rejected' : 'Pending Approval'}
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

                {/* Officer Action Bar: Multi-Tier Verification Lifecycle */}
                {userRole === 'officer' && (
                  <div className="p-2.5 rounded-xl bg-[#0C171C] border border-[#334B56] space-y-2 mt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#94A3B8] font-medium">Lifecycle Stage:</span>
                      <span className="font-mono text-[#38BDF8] font-bold uppercase">
                        {currentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Stage A: assigned_for_inspection -> [Start Field Inspection] */}
                    {(currentStatus === 'assigned_for_inspection' || currentStatus === 'reported') && (
                      <button
                        type="button"
                        onClick={() => handleStartFieldInspection(g.id!)}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:brightness-110 text-[#0C171C] font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Start Field Inspection</span>
                      </button>
                    )}

                    {/* Stage B: pending_inspection_verification -> Awaiting Admin Authorization */}
                    {currentStatus === 'pending_inspection_verification' && (
                      <div className="p-2 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-[#FDE68A] text-[10px] font-semibold text-center animate-pulse">
                        Inspection request sent to Admin for sign-off
                      </div>
                    )}

                    {/* Stage C: under_inspection / in_progress -> Camera Upload + Notes + [Submit Resolution & Photo] */}
                    {(currentStatus === 'under_inspection' || currentStatus === 'in_progress') && (
                      <div className="space-y-2 pt-1 border-t border-[#334B56]/60">
                        <div className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Inspection Authorized — Proceed with Repair</span>
                        </div>

                        {/* Camera upload or preview */}
                        {proofPhotoMap[g.id!] || g.resolution_photo_url ? (
                          <div className="relative w-full h-20 rounded-lg overflow-hidden border border-[#10B981]/50 bg-[#132228]">
                            <img
                              src={proofPhotoMap[g.id!] || g.resolution_photo_url}
                              alt="Repair proof"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/95 text-[#10B981] border border-[#10B981]/40">
                              Proof Photo Ready
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePhotoUploadId(g.id!);
                              officerFileInputRef.current?.click();
                            }}
                            className="w-full py-2 px-3 rounded-lg border border-dashed border-[#38BDF8]/60 bg-[#1B2F38] hover:bg-[#233B46] text-[#38BDF8] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Capture Repair Photo Proof</span>
                          </button>
                        )}

                        {/* Officer Repair Notes */}
                        <input
                          type="text"
                          value={officerNotesMap[g.id!] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOfficerNotesMap((prev) => ({ ...prev, [g.id!]: val }));
                          }}
                          placeholder="e.g. Unblocked stormwater drain channel & reinforced culvert"
                          className="w-full bg-[#132228] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-[11px] focus:outline-none focus:border-[#10B981]"
                        />

                        {/* Submit Resolution & Photo Button */}
                        <button
                          type="button"
                          onClick={() => handleSubmitResolutionAndPhoto(g.id!)}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Submit Resolution & Photo</span>
                        </button>
                      </div>
                    )}

                    {/* Stage D: pending_resolution_approval */}
                    {currentStatus === 'pending_resolution_approval' && (
                      <div className="p-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/50 text-[#6EE7B7] text-[10px] font-semibold text-center">
                        Resolution & photo submitted • Awaiting Sarpanch/Admin audit
                      </div>
                    )}
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
