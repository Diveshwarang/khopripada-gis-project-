import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  X,
  Trash2,
  MapPin,
  AlertCircle,
  FileDown,
  Navigation,
  FileSpreadsheet,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Search,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import {
  db,
  exportGrievancesToGeoJson,
  exportGrievancesToCsv,
} from '../services/offlineDb';
import {
  transitionToInspectionVerification,
  transitionToResolutionApproval,
} from '../services/dataService';
import { compressImageToBase64 } from '../utils/imageUtils';
import type { UserRole, CivicIssue, IssueStatus } from '../types';
import { updateIssueStatus } from '../services/issueService';
import { PREDEFINED_SURVEY_ISSUES } from '../data/seedIssues';

export interface DrawerGrievanceItem {
  id: string;
  issue_id?: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  synced: boolean;
  description?: string;
  reporterName?: string;
  assigned_officer?: string | null;
  assigned_to?: string | null;
  officer_notes?: string;
  photoBase64?: string;
  resolution_photo_url?: string;
  approval_status?: string;
  created_at?: string;
}

interface GrievanceListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFlyToGrievance: (coords: [number, number]) => void;
  userRole?: UserRole;
  onGrievanceStatusUpdated?: () => void;
  issues?: CivicIssue[];
  onOpenSingleIssueAudit?: (issue: any) => void;
}

export const GrievanceListDrawer: React.FC<GrievanceListDrawerProps> = ({
  isOpen,
  onClose,
  onFlyToGrievance,
  userRole = 'user',
  onGrievanceStatusUpdated,
  issues,
  onOpenSingleIssueAudit,
}) => {
  const [grievances, setGrievances] = useState<DrawerGrievanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activePhotoUploadId, setActivePhotoUploadId] = useState<string | null>(null);
  const [officerNotesMap, setOfficerNotesMap] = useState<Record<string, string>>({});
  const [proofPhotoMap, setProofPhotoMap] = useState<Record<string, string>>({});
  const [drawerToast, setDrawerToast] = useState<string | null>(null);
  const officerFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadGrievances = async () => {
    setLoading(true);
    try {
      const records = await db.offline_grievances.reverse().toArray().catch(() => []);
      const mergedMap = new Map<string, DrawerGrievanceItem>();

      // 1. Add Dexie offline records
      for (const r of records) {
        const idStr = String(r.id);
        mergedMap.set(idStr, {
          id: idStr,
          issue_id: idStr,
          title: r.title,
          category: r.category,
          severity: r.severity,
          status: r.status || 'reported',
          latitude: r.latitude,
          longitude: r.longitude,
          timestamp: r.timestamp || Date.now(),
          synced: r.synced,
          description: r.description || '',
          reporterName: r.reporterName || r.submitted_by || 'Resident',
          assigned_officer: (r as any).assigned_officer || null,
          assigned_to: (r as any).assigned_to || null,
          officer_notes: (r as any).officer_notes || '',
          photoBase64: r.photoBase64,
          resolution_photo_url: r.resolution_photo_url,
          approval_status: r.approval_status || 'approved',
        });
      }

      // 2. Add live database issues (or baseline seed)
      const currentList = issues && issues.length > 0 ? issues : PREDEFINED_SURVEY_ISSUES;
      for (const item of currentList) {
        const idStr = String(item.id || item.issue_id || `iss-${Math.random()}`);
        mergedMap.set(idStr, {
          id: idStr,
          issue_id: String(item.issue_id || item.id || idStr),
          title: item.title,
          category: item.category,
          severity: item.severity,
          status: item.status || 'reported',
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          timestamp: (item as any).timestamp || (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
          synced: true,
          description: item.description || (item as any).notes || '',
          reporterName: item.reported_by || item.reporter_name || 'Resident',
          assigned_officer: item.assigned_officer || (item as any).assigned_to || null,
          assigned_to: (item as any).assigned_to || item.assigned_officer || null,
          officer_notes: item.resolution_notes || (item as any).officer_notes || '',
          photoBase64: item.photoBase64,
          resolution_photo_url: item.proof_image_url || item.photo_url || (item as any).resolution_photo_url,
          approval_status: (item as any).approval_status || 'approved',
          created_at: item.created_at,
        });
      }

      setGrievances(Array.from(mergedMap.values()));
    } catch (err) {
      console.error('Failed to load grievances from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGrievances();
    }
  }, [isOpen, userRole, issues]);

  // Handle direct status change for Officer and Admin
  const handleStatusChange = async (id: string, newStatus: string) => {
    let targetStatus = newStatus as IssueStatus;
    if (userRole === 'officer' && (targetStatus === 'resolved' || targetStatus === 'verified_closed')) {
      targetStatus = 'pending_resolution_approval';
    }
    try {
      const res = await updateIssueStatus(id, targetStatus);
      if (res.success) {
        setGrievances((prev) =>
          prev.map((g) => (g.id === id || g.issue_id === id ? { ...g, status: targetStatus } : g))
        );
        setDrawerToast(`Status updated to "${targetStatus.replace(/_/g, ' ')}"`);
        setTimeout(() => setDrawerToast(null), 3000);
        if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
      } else {
        alert('Failed to update status: ' + res.error);
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  // Step 3 (Officer): Start Field Inspection -> updates status to under_inspection
  const handleStartFieldInspection = async (id: string) => {
    try {
      await updateIssueStatus(id, 'under_inspection');
      await transitionToInspectionVerification(parseInt(id.replace(/\D/g, '') || '0', 10) || 0, 'Officer requested inspection authorization.').catch(() => {});
      setGrievances((prev) =>
        prev.map((g) => (g.id === id || g.issue_id === id ? { ...g, status: 'under_inspection' } : g))
      );
      setDrawerToast('Field inspection started for this issue.');
      setTimeout(() => setDrawerToast(null), 3500);
      if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
    } catch (err) {
      console.error('Failed to start inspection:', err);
    }
  };

  // Step 4 (Officer): Submit Resolution & Photo -> sends audit to admin (pending_resolution_approval)
  const handleSubmitResolutionAndPhoto = async (id: string) => {
    const photo = proofPhotoMap[id];
    const notes = officerNotesMap[id] || 'Field repair completed as per specifications.';
    try {
      await updateIssueStatus(id, 'pending_resolution_approval', notes);
      await transitionToResolutionApproval(parseInt(id.replace(/\D/g, '') || '0', 10) || 0, photo || '', notes).catch(() => {});
      setGrievances((prev) =>
        prev.map((g) => (g.id === id || g.issue_id === id ? { ...g, status: 'pending_resolution_approval', officer_notes: notes } : g))
      );
      setDrawerToast('Repair audit submitted to Panchayat Admin for verification!');
      setTimeout(() => setDrawerToast(null), 3500);
      if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
    } catch (err) {
      console.error('Failed to submit resolution audit:', err);
    }
  };

  // Step 5 (Admin): Verify and Mark Officially Resolved
  const handleAdminVerifyResolution = async (id: string, notes?: string) => {
    try {
      const auditNotes = notes || 'Repair inspected, verified and officially resolved by Admin.';
      const res = await updateIssueStatus(id, 'resolved', auditNotes);
      if (res.success) {
        setGrievances((prev) =>
          prev.map((g) => (g.id === id || g.issue_id === id ? { ...g, status: 'resolved', officer_notes: auditNotes } : g))
        );
        setDrawerToast('Issue officially verified & marked Resolved by Admin!');
        setTimeout(() => setDrawerToast(null), 3500);
        if (onGrievanceStatusUpdated) onGrievanceStatusUpdated();
      }
    } catch (err) {
      console.error('Failed to verify resolution:', err);
    }
  };

  const handleAttachProofPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activePhotoUploadId === null) return;
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      setProofPhotoMap((prev) => ({ ...prev, [activePhotoUploadId]: compressed }));
      const numId = parseInt(activePhotoUploadId.replace(/\D/g, '') || '0', 10);
      if (numId) {
        await db.offline_grievances.update(numId, { resolution_photo_url: compressed }).catch(() => {});
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

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      const numId = parseInt(id.replace(/\D/g, '') || '0', 10);
      if (numId) {
        await db.offline_grievances.delete(numId).catch(() => {});
      }
      setGrievances((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error('Failed to delete grievance:', err);
    }
  };

  const handleExportGeoJson = () => {
    const geoJsonStr = exportGrievancesToGeoJson(grievances as any);
    const dataStr = 'data:application/geo+json;charset=utf-8,' + encodeURIComponent(geoJsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `khopripada_field_grievances_${Date.now()}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCsv = () => {
    const csvStr = exportGrievancesToCsv(grievances as any);
    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bapane_gram_panchayat_grievances_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered grievances based on status tabs & search query
  const filteredGrievances = useMemo(() => {
    return grievances.filter((g) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        const st = (g.status || 'reported').toLowerCase();
        if (statusFilter === 'reported' && st !== 'reported' && st !== 'pending_initial_approval') return false;
        if (statusFilter === 'assigned' && st !== 'assigned' && st !== 'assigned_for_inspection') return false;
        if (statusFilter === 'under_inspection' && st !== 'under_inspection' && st !== 'pending_inspection_verification') return false;
        if (statusFilter === 'resolved' && st !== 'resolved' && st !== 'verified_closed') return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (g.title || '').toLowerCase().includes(q);
        const matchesCategory = (g.category || '').toLowerCase().includes(q);
        const matchesDesc = (g.description || '').toLowerCase().includes(q);
        const matchesOfficer = (g.assigned_officer || g.assigned_to || '').toLowerCase().includes(q);
        const matchesReporter = (g.reporterName || '').toLowerCase().includes(q);
        return matchesTitle || matchesCategory || matchesDesc || matchesOfficer || matchesReporter;
      }

      return true;
    });
  }, [grievances, statusFilter, searchQuery]);

  // Status counts for badge tabs
  const statusCounts = useMemo(() => {
    const counts = { all: grievances.length, reported: 0, assigned: 0, under_inspection: 0, resolved: 0 };
    for (const g of grievances) {
      const st = (g.status || 'reported').toLowerCase();
      if (st === 'reported' || st === 'pending_initial_approval') counts.reported++;
      else if (st === 'assigned' || st === 'assigned_for_inspection') counts.assigned++;
      else if (st === 'under_inspection' || st === 'pending_inspection_verification') counts.under_inspection++;
      else if (st === 'resolved' || st === 'verified_closed') counts.resolved++;
    }
    return counts;
  }, [grievances]);

  if (!isOpen) return null;

  const severityColors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80',
    medium: 'text-amber-300 bg-amber-950/60 border-amber-800/80',
    high: 'text-rose-400 bg-rose-950/60 border-rose-800/80',
    critical: 'text-rose-300 bg-rose-900/80 border-rose-600',
  };

  const getStatusBadge = (status?: string) => {
    const st = (status || 'reported').toLowerCase();
    if (st === 'assigned' || st === 'assigned_for_inspection') {
      return { label: 'Step 2: Assigned', bg: 'bg-amber-950/60 text-amber-300 border-amber-700/60' };
    }
    if (st === 'under_inspection' || st === 'pending_inspection_verification') {
      return { label: 'Step 3: Field Inspection', bg: 'bg-blue-950/60 text-blue-300 border-blue-700/60' };
    }
    if (st === 'pending_resolution_approval') {
      return { label: 'Step 4: Audit Sent to Admin', bg: 'bg-amber-950/60 text-amber-300 border-amber-500/80 animate-pulse' };
    }
    if (st === 'resolved') {
      return { label: 'Step 5: Verified & Resolved', bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60' };
    }
    if (st === 'verified_closed') {
      return { label: 'Step 5: Verified & Closed', bg: 'bg-teal-950/60 text-teal-300 border-teal-700/60' };
    }
    return { label: 'Step 1: Registered', bg: 'bg-rose-950/60 text-rose-300 border-rose-700/60' };
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="sm:hidden fixed inset-0 z-[2400] bg-black/60 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 z-[2500] sm:z-[2000] w-full max-w-lg sm:max-w-md max-h-[90dvh] sm:max-h-full bg-[#081018] border-t sm:border-t-0 sm:border-l border-[#1D3B52] rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col text-[#F1F5F9] animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 overflow-hidden">
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-[#1D3B52] rounded-full mx-auto my-2 sm:hidden flex-shrink-0" />

        {/* Hidden file input for officer photo evidence */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={officerFileInputRef}
          onChange={handleAttachProofPhoto}
          className="hidden"
        />

        {/* 1. Header with Cloud Live Indicator */}
        <div className="p-4 border-b border-[#1D3B52] bg-[#0D1C2A] flex flex-col gap-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#EF4444] flex items-center justify-center shadow-xs">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Village Issues Registry
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#FCA5A5] font-mono font-bold">
                    {grievances.length} Total
                  </span>
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8CB0C9] mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Supabase Cloud Database • Real-Time Sync</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8CB0C9] hover:text-white hover:bg-[#142C3F] transition cursor-pointer"
              title="Close Drawer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5A7C93]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by title, category, officer..."
              className="w-full bg-[#081018] border border-[#1D3B52] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#F1F5F9] placeholder-[#5A7C93] focus:outline-none focus:border-[#00E5FF] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[#5A7C93] hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            {[
              { id: 'all', label: 'All', count: statusCounts.all },
              { id: 'reported', label: 'Reported', count: statusCounts.reported },
              { id: 'assigned', label: 'Assigned', count: statusCounts.assigned },
              { id: 'under_inspection', label: 'Inspecting', count: statusCounts.under_inspection },
              { id: 'resolved', label: 'Resolved', count: statusCounts.resolved },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/60 shadow-[0_0_8px_rgba(0,229,255,0.25)]'
                      : 'bg-[#081018] text-[#8CB0C9] border border-[#1D3B52] hover:text-white hover:border-[#1D3B52]/80'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      isActive ? 'bg-[#00E5FF]/30 text-[#00E5FF]' : 'bg-[#142C3F] text-[#5A7C93]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Export Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1D3B52]/60">
            <span className="text-[10px] text-[#5A7C93] font-mono uppercase tracking-wider">
              {filteredGrievances.length} displayed
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportGeoJson}
                className="px-2 py-0.5 rounded-md text-[#38BDF8] bg-[#081018] hover:bg-[#142C3F] border border-[#38BDF8]/40 text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Export GeoJSON for GIS software"
              >
                <FileDown className="w-3 h-3" />
                <span>GeoJSON</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-2 py-0.5 rounded-md text-[#FCD34D] bg-[#081018] hover:bg-[#142C3F] border border-[#FCD34D]/40 text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Export CSV for Gram Panchayat records"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toast Notice */}
        {drawerToast && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 text-xs font-semibold animate-in fade-in flex items-center gap-2 shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{drawerToast}</span>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-12 text-[#8CB0C9] text-xs animate-pulse">
              Syncing live issues from database...
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-2 text-[#8CB0C9]">
              <AlertCircle className="w-8 h-8 text-[#1D3B52]" />
              <p className="text-xs font-semibold text-slate-300">
                No issues match your filter criteria.
              </p>
              <p className="text-[11px] text-[#5A7C93] max-w-xs">
                Switch filters to "All" or tap "Report Grievance" on the map to log a new civic complaint.
              </p>
            </div>
          ) : (
            filteredGrievances.map((g) => {
              const hasPhoto = Boolean(g.photoBase64 || g.resolution_photo_url);
              const statusBadge = getStatusBadge(g.status);
              const isOfficerOrAdmin = userRole === 'officer' || userRole === 'admin';
              const rawStatus = (g.status || 'reported').toLowerCase();

              return (
                <div
                  key={g.id}
                  className="p-3.5 rounded-xl bg-[#0D1C2A] border border-[#1D3B52] hover:border-[#00E5FF]/40 transition flex flex-col gap-2.5 text-[#F1F5F9] shadow-md"
                >
                  {/* Photo Evidence Thumbnail if present */}
                  {hasPhoto && (
                    <div className="relative w-full h-28 rounded-lg overflow-hidden border border-[#1D3B52] bg-[#081018]">
                      <img
                        src={g.photoBase64 || g.resolution_photo_url}
                        alt={g?.title || 'Grievance Photo'}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/80 text-[#00E5FF] border border-[#00E5FF]/40">
                        Photo Evidence
                      </span>
                    </div>
                  )}

                  {/* Header Row: Severity, Category, Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Severity */}
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                            severityColors[g.severity] || severityColors.medium
                          }`}
                        >
                          ● {g.severity.toUpperCase()}
                        </span>

                        {/* Category */}
                        <span className="text-[9px] font-semibold text-[#8CB0C9] px-1.5 py-0.5 rounded bg-[#081018] border border-[#1D3B52]">
                          {g.category || 'General'}
                        </span>

                        {/* Status Step Badge */}
                        <span
                          className={`text-[9px] font-semibold font-mono px-2 py-0.5 rounded border ${statusBadge.bg}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-white leading-snug pt-0.5">
                        {g.title}
                      </h4>
                    </div>

                    {/* Fly to Map Location Button */}
                    <button
                      onClick={() => {
                        onFlyToGrievance([g.latitude, g.longitude]);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg bg-[#081018] border border-[#1D3B52] text-[#00E5FF] hover:bg-[#142C3F] hover:border-[#00E5FF]/60 transition cursor-pointer shrink-0 active:scale-95 shadow-sm"
                      title="Fly directly to this issue on the map"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  {g.description && (
                    <p className="text-[11px] text-[#8CB0C9] leading-relaxed bg-[#081018] p-2 rounded-lg border border-[#1D3B52]">
                      {g.description}
                    </p>
                  )}

                  {/* Officer Notes if any */}
                  {g.officer_notes && (
                    <div className="text-[10px] text-sky-300 bg-sky-950/40 p-2 rounded-lg border border-sky-800/60 leading-relaxed">
                      <b className="text-sky-400">Officer Note:</b> {g.officer_notes}
                    </div>
                  )}

                  {/* Metadata Row: Assigned Officer & Reported By */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[#5A7C93] pt-0.5 border-t border-[#1D3B52]/60">
                    <div className="flex items-center gap-1 truncate">
                      <User className="w-3 h-3 text-[#00E5FF] shrink-0" />
                      <span className="truncate">
                        Officer: <b className="text-[#8CB0C9]">{g.assigned_officer || g.assigned_to || 'Unassigned'}</b>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 truncate justify-end">
                      <Clock className="w-3 h-3 text-[#5A7C93] shrink-0" />
                      <span className="truncate text-[#8CB0C9]">
                        {g.created_at ? new Date(g.created_at).toLocaleDateString() : 'Survey Active'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Status Changer (Officer & Admin) */}
                  {isOfficerOrAdmin && (
                    <div className="mt-1 pt-2 border-t border-[#1D3B52] bg-[#081018]/80 -mx-3.5 -mb-3.5 p-3 rounded-b-xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#8CB0C9] uppercase tracking-wider">
                          Live Status Control:
                        </span>
                        <select
                          value={
                            rawStatus === 'assigned_for_inspection' ? 'assigned' :
                            rawStatus === 'pending_inspection_verification' ? 'under_inspection' :
                            rawStatus === 'pending_resolution_approval' ? 'pending_resolution_approval' :
                            rawStatus === 'verified_closed' ? 'resolved' :
                            rawStatus
                          }
                          onChange={(e) => handleStatusChange(g.id, e.target.value)}
                          className="bg-[#0D1C2A] border border-[#1D3B52] text-[#00E5FF] text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-[#00E5FF] cursor-pointer"
                        >
                          <option value="reported">Step 1: Registered</option>
                          <option value="assigned">Step 2: Assigned</option>
                          <option value="under_inspection">Step 3: Field Inspection</option>
                          <option value="pending_resolution_approval">Step 4: Audit Sent to Admin</option>
                          {userRole === 'admin' ? (
                            <>
                              <option value="resolved">Step 5: Verified & Resolved</option>
                              <option value="verified_closed">Step 5: Verified & Closed</option>
                            </>
                          ) : (
                            <option value="resolved" disabled>Step 5: Verified & Resolved (Admin Only)</option>
                          )}
                        </select>
                      </div>

                      {/* Quick Action Buttons */}
                      {(rawStatus === 'reported' || rawStatus === 'assigned') && (
                        <button
                          type="button"
                          onClick={() => handleStartFieldInspection(g.id)}
                          className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Start Field Inspection</span>
                        </button>
                      )}

                      {(rawStatus === 'under_inspection' || rawStatus === 'in_progress') && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePhotoUploadId(g.id);
                              officerFileInputRef.current?.click();
                            }}
                            className="w-full py-1 px-2.5 rounded-lg border border-dashed border-[#00E5FF]/60 bg-[#0D1C2A] text-[#00E5FF] text-[10px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Camera className="w-3 h-3" />
                            <span>{proofPhotoMap[g.id] ? 'Photo Attached (Retake)' : 'Capture Repair Photo Proof'}</span>
                          </button>
                          <input
                            type="text"
                            value={officerNotesMap[g.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOfficerNotesMap((prev) => ({ ...prev, [g.id]: val }));
                            }}
                            placeholder="Field repair completion notes..."
                            className="w-full bg-[#0D1C2A] border border-[#1D3B52] rounded-lg px-2 py-1 text-white text-[11px] placeholder-[#5A7C93] focus:outline-none focus:border-[#00E5FF]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSubmitResolutionAndPhoto(g.id)}
                            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-[#0C171C] font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Submit Repair Audit to Admin</span>
                          </button>
                        </div>
                      )}

                      {/* Step 4: Pending Resolution Approval Queue */}
                      {rawStatus === 'pending_resolution_approval' && (
                        userRole === 'admin' ? (
                          <div className="space-y-1.5">
                            <div className="text-[10px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-600/60 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                              <div className="flex-1">
                                <span className="font-semibold block text-amber-200">Repair Audit Awaiting Admin Sign-Off</span>
                                {g.officer_notes && (
                                  <span className="text-[10px] text-[#8CB0C9] italic block mt-0.5">
                                    "{g.officer_notes}"
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAdminVerifyResolution(g.id, g.officer_notes)}
                              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>✓ Verify & Mark Officially Resolved</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-600/60 text-amber-300 text-xs flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                            <div>
                              <span className="font-semibold block text-amber-200">Audit Sent to Admin</span>
                              <span className="text-[10px] text-amber-300/80">Awaiting Panchayat Admin sign-off and verification</span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Action Bar: Official Audit Sheet & Coordinates Footer */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#1D3B52]/40 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenSingleIssueAudit && onOpenSingleIssueAudit(g)}
                      className="px-2.5 py-1 rounded-lg bg-[#081018] border border-[#38BDF8]/40 hover:border-[#38BDF8] text-[#38BDF8] hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
                      title="Download or Print Official Audit Certificate for Sarpanch Sign-off"
                    >
                      <FileText className="w-3 h-3 text-[#38BDF8]" />
                      <span>Official Audit Sheet (Print/PDF)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[#00E5FF]">
                        <MapPin className="w-3 h-3" />
                        {g.latitude.toFixed(4)}°N, {g.longitude.toFixed(4)}°E
                      </span>
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="text-red-400 hover:text-red-300 transition cursor-pointer p-0.5"
                          title="Delete record from local database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default GrievanceListDrawer;
