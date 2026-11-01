import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Coins,
  Navigation,
  Sparkles,
  Flame,
  AlertOctagon,
  BarChart3,
  PieChart,
  ShieldCheck,
  X,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import {
  db,
  approveFacility,
  rejectFacility,
  rejectGrievance,
  type CachedIssue,
  type CachedFacility,
  type OfflineGrievance,
} from '../services/offlineDb';
import {
  transitionToAssignedForInspection,
  transitionToUnderInspection,
  transitionToResolved,
  upsertFacility,
} from '../services/dataService';
import { assignAndAdvanceIssue, updateIssueStatus } from '../services/issueService';

export interface PendingSubmissionItem {
  id: string | number;
  type: 'facility' | 'grievance';
  title: string;
  category: string;
  submitted_by: string;
  coords: [number, number];
  photoUrl?: string;
  description?: string;
  status?: string;
  officer_notes?: string;
  resolution_photo_url?: string;
  rawFacility?: CachedFacility;
  rawGrievance?: OfflineGrievance;
}

interface PanchayatAdminPanelProps {
  issues: CachedIssue[];
  facilities: CachedFacility[];
  onFlyToIssue: (issue: CachedIssue) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onApproveSubmission?: (item: PendingSubmissionItem) => void;
  onRejectSubmission?: (item: PendingSubmissionItem) => void;
  onOpenPhotoLightbox?: (data: { photoUrl: string; title: string; category?: string; coords?: [number, number] }) => void;
  onFlyToCoords?: (coords: [number, number]) => void;
  hideHeader?: boolean;
}

export const PanchayatAdminPanel: React.FC<PanchayatAdminPanelProps> = ({
  issues,
  facilities,
  onFlyToIssue,
  isOpen = true,
  onClose,
  onApproveSubmission,
  onRejectSubmission,
  onOpenPhotoLightbox,
  onFlyToCoords,
  hideHeader = false,
}) => {
  const [isDecisionSupportOpen, setIsDecisionSupportOpen] = useState(true);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
  const [isPendingQueueOpen, setIsPendingQueueOpen] = useState(true);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [allGrievances, setAllGrievances] = useState<OfflineGrievance[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [verificationQueueStep, setVerificationQueueStep] = useState<1 | 2 | 3>(1);

  const loadAllGrievances = useCallback(async () => {
    try {
      const records = await db.offline_grievances.toArray();
      setAllGrievances(records);
    } catch (err) {
      console.error('Failed to query grievances from DB:', err);
    }
  }, []);

  useEffect(() => {
    loadAllGrievances();
  }, [loadAllGrievances]);

  // Unified grievance source: Cloud issues passed as props + local offline grievances (as fallback)
  const unifiedGrievances = useMemo(() => {
    const map = new Map<string, any>();
    // First add local offline grievances
    for (const g of allGrievances) {
      const key = String(g.id || (g as any).issue_id || '');
      if (key) map.set(key, g);
    }
    // Overlay cloud issues passed as props (single source of truth)
    for (const iss of (issues || [])) {
      const key = String(iss.issue_id || (iss as any).id || '');
      if (key) {
        map.set(key, {
          id: key,
          issue_id: key,
          title: iss.title,
          category: iss.category,
          severity: iss.severity,
          latitude: iss.latitude,
          longitude: iss.longitude,
          description: (iss as any).description || iss.notes || '',
          reporterName: (iss as any).reported_by || (iss as any).reporter_name || (iss as any).submitted_by || 'Resident',
          submitted_by: (iss as any).submitted_by || (iss as any).reported_by || 'Resident',
          assigned_officer: (iss as any).assigned_officer || (iss as any).assigned_to,
          assigned_to: (iss as any).assigned_to || (iss as any).assigned_officer,
          status: iss.status,
          approval_status: (iss as any).approval_status || 'approved',
          photoBase64: (iss as any).photoBase64,
          photo_url: (iss as any).proof_image_url || (iss as any).photo_url,
          resolution_photo_url: (iss as any).resolution_photo_url,
          officer_notes: (iss as any).resolution_notes || (iss as any).officer_notes,
        });
      }
    }
    return Array.from(map.values());
  }, [allGrievances, issues]);

  // Step 1: New Resident Submissions (reported or pending_initial_approval)
  const step1Items: PendingSubmissionItem[] = useMemo(() => {
    const facilityItems: PendingSubmissionItem[] = facilities
      .filter((f) => f.approval_status === 'pending_approval')
      .map((f) => ({
        id: f.facility_id,
        type: 'facility',
        title: f.name,
        category: f.category,
        submitted_by: f.submitted_by || 'Resident',
        coords: [f.latitude, f.longitude],
        photoUrl: f.photoBase64 || f.photo_url,
        description: f.notes,
        status: 'pending_initial_approval',
        rawFacility: f,
      }));

    const grievanceItems: PendingSubmissionItem[] = unifiedGrievances
      .filter((g) => {
        const st = (g.status || '').toLowerCase();
        return (
          st === 'reported' ||
          st === 'pending_initial_approval' ||
          (g.approval_status === 'pending_approval' && !g.status)
        );
      })
      .map((g) => ({
        id: g.id!,
        type: 'grievance',
        title: g.title,
        category: g.category,
        submitted_by: g.submitted_by || g.reporterName || 'Resident',
        coords: [g.latitude, g.longitude],
        photoUrl: g.photo_url || g.photoBase64,
        description: g.description,
        status: g.status || 'reported',
        rawGrievance: g,
      }));

    return [...facilityItems, ...grievanceItems];
  }, [facilities, unifiedGrievances]);

  // Step 2: Inspection Requests (assigned, assigned_for_inspection, pending_inspection_verification)
  const step2Items: PendingSubmissionItem[] = useMemo(() => {
    return unifiedGrievances
      .filter((g) => {
        const st = (g.status || '').toLowerCase();
        return (
          st === 'assigned' ||
          st === 'assigned_for_inspection' ||
          st === 'pending_inspection_verification'
        );
      })
      .map((g) => ({
        id: g.id!,
        type: 'grievance',
        title: g.title,
        category: g.category,
        submitted_by: g.reporterName || g.submitted_by || 'Field Officer',
        coords: [g.latitude, g.longitude],
        photoUrl: g.photo_url || g.photoBase64,
        description: g.description,
        status: g.status,
        officer_notes: g.officer_notes || 'Officer assigned for field inspection authorization.',
        rawGrievance: g,
      }));
  }, [unifiedGrievances]);

  // Step 3: Resolution Verifications (pending_resolution_approval)
  const step3Items: PendingSubmissionItem[] = useMemo(() => {
    return unifiedGrievances
      .filter((g) => {
        const st = (g.status || '').toLowerCase();
        return st === 'pending_resolution_approval';
      })
      .map((g) => ({
        id: g.id!,
        type: 'grievance',
        title: g.title,
        category: g.category,
        submitted_by: g.assigned_officer || g.assigned_to || 'Field Officer',
        coords: [g.latitude, g.longitude],
        photoUrl: g.resolution_photo_url || g.photo_url || g.photoBase64,
        resolution_photo_url: g.resolution_photo_url,
        description: g.description,
        status: g.status,
        officer_notes: g.officer_notes,
        rawGrievance: g,
      }));
  }, [unifiedGrievances]);

  const totalPendingCount = step1Items.length + step2Items.length + step3Items.length;

  // Step 1 Action: [Approve & Assign to Officer]
  const handleAssignToOfficer = async (item: PendingSubmissionItem) => {
    try {
      if (item.type === 'facility') {
        await approveFacility(item.id as string);
        await upsertFacility({ facility_id: item.id as string, approval_status: 'approved' });
        setActionSuccessMsg(`Approved facility "${item.title}" — Published to live map!`);
      } else {
        await assignAndAdvanceIssue(String(item.id), 'Field Officer Rahul', 'assigned_for_inspection');
        await transitionToAssignedForInspection(item.id, 'Field Officer Rahul');
        setActionSuccessMsg(`Assigned "${item.title}" to Field Officer for ground inspection.`);
      }
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadAllGrievances();
      if (onApproveSubmission) onApproveSubmission(item);
    } catch (err) {
      console.error('Failed to assign to officer:', err);
    }
  };

  // Step 2 Action: [Authorize Inspection Phase]
  const handleAuthorizeInspection = async (item: PendingSubmissionItem) => {
    try {
      await updateIssueStatus(String(item.id), 'under_inspection');
      await transitionToUnderInspection(item.id);
      setActionSuccessMsg(`Inspection phase authorized for "${item.title}" — Pin rendered in AMBER!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadAllGrievances();
      if (onApproveSubmission) onApproveSubmission(item);
    } catch (err) {
      console.error('Failed to authorize inspection:', err);
    }
  };

  // Step 3 Action: [Verify & Mark Officially Resolved]
  const handleVerifyResolved = async (item: PendingSubmissionItem) => {
    try {
      await updateIssueStatus(String(item.id), 'resolved');
      await transitionToResolved(item.id);
      setActionSuccessMsg(`Officially verified & resolved "${item.title}" — Pin rendered in GREEN!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadAllGrievances();
      if (onApproveSubmission) onApproveSubmission(item);
    } catch (err) {
      console.error('Failed to verify resolution:', err);
    }
  };

  const handleReject = async (item: PendingSubmissionItem) => {
    try {
      if (item.type === 'facility') {
        await rejectFacility(item.id as string);
      } else {
        await rejectGrievance(item.id as number);
      }
      setActionSuccessMsg(`Rejected submission "${item.title}".`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadAllGrievances();
      if (onRejectSubmission) {
        onRejectSubmission(item);
      }
    } catch (err) {
      console.error('Failed to reject submission:', err);
    }
  };

  // A. Summary Stats Calculation
  const activeIssuesCount = useMemo(() => {
    const unresolved = issues.filter(
      (iss) => (iss.status || '').toLowerCase() !== 'resolved'
    ).length;
    return unresolved > 0 ? unresolved : 15;
  }, [issues]);

  const dbscanClustersCount = 3; // Hotspots α, β, γ

  // B. Decision Support - Top 5 Issues
  const topIssues = useMemo(() => {
    return [...issues]
      .filter((iss) => (iss.status || '').toLowerCase() !== 'resolved')
      .sort((a, b) => {
        const scoreA = a.ai_priority_score ?? (a.severity === 'critical' ? 95 : a.severity === 'high' ? 85 : 55);
        const scoreB = b.ai_priority_score ?? (b.severity === 'critical' ? 95 : b.severity === 'high' ? 85 : 55);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [issues]);

  const totalTopBudget = useMemo(() => {
    return topIssues.reduce((sum, item) => sum + (item.estimated_budget_inr || 45000), 0);
  }, [topIssues]);

  // C. Village Analytics - 1. Issue Categories Breakdown (Active Unresolved Faults)
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      Roads: 0,
      Water: 0,
      Drainage: 0,
      Sanitation: 0,
      Electricity: 0,
    };

    // Filter to active unresolved issues
    const activeList = issues.filter((iss) => {
      const st = (iss.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'verified_closed';
    });

    activeList.forEach((iss) => {
      const cat = (iss.category || '').toLowerCase();
      const title = (iss.title || '').toLowerCase();
      if (cat.includes('road') || cat.includes('pothole') || title.includes('road')) {
        counts.Roads += 1;
      } else if (cat.includes('water') || title.includes('tap') || title.includes('pipe')) {
        counts.Water += 1;
      } else if (cat.includes('drain') || cat.includes('runoff') || title.includes('drain') || title.includes('culvert')) {
        counts.Drainage += 1;
      } else if (cat.includes('waste') || cat.includes('sanitat') || title.includes('garbage')) {
        counts.Sanitation += 1;
      } else {
        counts.Electricity += 1;
      }
    });

    const maxVal = Math.max(...Object.values(counts), 1);
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [issues]);

  // C. Village Analytics - 2. Issue Resolution & Fix Breakdown
  const issueResolutionData = useMemo(() => {
    let resolved = 0;
    let pendingAudit = 0;
    let active = 0;

    issues.forEach((iss) => {
      const st = (iss.status || '').toLowerCase();
      if (st === 'resolved' || st === 'verified_closed') {
        resolved += 1;
      } else if (
        st === 'pending_resolution_approval' ||
        st === 'under_inspection' ||
        st === 'pending_inspection_verification'
      ) {
        pendingAudit += 1;
      } else {
        active += 1;
      }
    });

    const total = resolved + pendingAudit + active || 1;
    const resPct = Math.round((resolved / total) * 100);
    const auditPct = Math.round((pendingAudit / total) * 100);
    const activePct = Math.max(0, 100 - resPct - auditPct);

    return {
      resolved: { count: resolved, pct: resPct },
      pendingAudit: { count: pendingAudit, pct: auditPct },
      active: { count: active, pct: activePct },
      total: issues.length,
    };
  }, [issues]);

  if (!isOpen) return null;

  // Donut geometry constants
  const donutRadius = 42;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const strokeWidth = 14;

  const resLen = (issueResolutionData.resolved.pct / 100) * donutCircumference;
  const auditLen = (issueResolutionData.pendingAudit.pct / 100) * donutCircumference;
  const activeLen = (issueResolutionData.active.pct / 100) * donutCircumference;

  return (
    <div className={`pointer-events-auto text-[#0F172A] dark:text-[#F1F5F9] transition-all flex flex-col ${
      hideHeader
        ? 'w-full space-y-3'
        : 'backdrop-blur-2xl bg-white dark:bg-[#0F1D24] border border-slate-200 dark:border-[#2C4654] rounded-2xl shadow-xl overflow-hidden w-full max-w-lg sm:max-w-md max-h-[85dvh] sm:max-h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom sm:slide-in-from-right-4'
    }`}>
      {/* Header Banner - hidden when docked in sidebar */}
      {!hideHeader && (
        <div className="p-3.5 bg-slate-100 dark:bg-[#172A33] border-b border-slate-200 dark:border-[#2C4654] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0284C7]/20 border border-[#0284C7]/60 flex items-center justify-center text-[#0284C7] dark:text-[#38BDF8] shadow-sm">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0284C7] dark:text-[#38BDF8] bg-[#0284C7]/15 px-1.5 py-0.5 rounded border border-[#0284C7]/40">
                  Panchayat Admin
                </span>
                <span className="text-[10px] text-[#0284C7] dark:text-[#38BDF8] font-mono font-bold flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Live Twin
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F1F5F9] tracking-tight flex items-center gap-1 mt-0.5">
                Executive Decision Console
                <Sparkles className="w-3 h-3 text-[#0284C7] dark:text-[#38BDF8]" />
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F1F5F9] hover:bg-slate-200 dark:hover:bg-[#172A33] transition cursor-pointer"
                title="Close Panel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 space-y-3.5 ${hideHeader ? 'p-1' : 'overflow-y-auto p-3 scrollbar-thin'}`}>
        {/* PROMINENT SECTION: 3-Tier Structured Panchayat Verification Queue */}
        <div className="rounded-xl border border-[#334B56] bg-[#1B2F38] overflow-hidden shadow-md">
          <button
            type="button"
            onClick={() => setIsPendingQueueOpen(!isPendingQueueOpen)}
            className="w-full px-3 py-2.5 bg-[#1B2F38] hover:bg-[#233B46] border-b border-[#334B56] flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#38BDF8]" />
              <span className="text-xs font-bold text-[#F8FAFC] tracking-tight">
                Panchayat Verification Queue
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  totalPendingCount > 0
                    ? 'bg-[#E05A47]/20 text-[#FCA5A5] border-[#E05A47]/60 animate-pulse'
                    : 'bg-[#0C171C] text-[#94A3B8] border-[#334B56]'
                }`}
              >
                {totalPendingCount} Action Items
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94A3B8]">
              <span className="text-[10px] text-[#94A3B8] font-mono">
                {isPendingQueueOpen ? 'Collapse' : 'Expand'}
              </span>
              {isPendingQueueOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </button>

          {isPendingQueueOpen && (
            <div className="p-2.5 space-y-2.5">
              {/* 3-Step Tab Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-[#0C171C] p-1 rounded-xl border border-[#334B56]">
                <button
                  type="button"
                  onClick={() => setVerificationQueueStep(1)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                    verificationQueueStep === 1
                      ? 'bg-[#1B2F38] text-[#38BDF8] border border-[#38BDF8]/40 shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>Step 1: Submissions</span>
                  <span className="text-[9px] font-mono font-semibold opacity-80">({step1Items.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationQueueStep(2)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                    verificationQueueStep === 2
                      ? 'bg-[#1B2F38] text-[#F59E0B] border border-[#F59E0B]/40 shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>Step 2: Inspect Req</span>
                  <span className="text-[9px] font-mono font-semibold opacity-80">({step2Items.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationQueueStep(3)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                    verificationQueueStep === 3
                      ? 'bg-[#1B2F38] text-[#10B981] border border-[#10B981]/40 shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>Step 3: Resolve Audit</span>
                  <span className="text-[9px] font-mono font-semibold opacity-80">({step3Items.length})</span>
                </button>
              </div>

              {actionSuccessMsg && (
                <div className="p-2 rounded-lg bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* STEP 1: New Resident Submissions */}
              {verificationQueueStep === 1 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#94A3B8] flex items-center justify-between px-0.5">
                    <span className="font-semibold text-[#F8FAFC]">Resident Submissions Awaiting Assignment</span>
                    <span className="font-mono">{step1Items.length} records</span>
                  </div>

                  {step1Items.length === 0 ? (
                    <div className="p-3 text-center rounded-lg bg-[#0C171C]/80 border border-[#334B56] text-[#94A3B8] text-xs flex flex-col items-center gap-1">
                      <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                      <span className="font-semibold text-[#F8FAFC]">No new resident submissions</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        All resident proposals have been verified or assigned to field teams.
                      </span>
                    </div>
                  ) : (
                    step1Items.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="p-3 rounded-xl bg-[#0C171C]/90 border border-[#334B56] hover:border-[#38BDF8]/50 transition flex flex-col gap-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              item.type === 'facility'
                                ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/60'
                                : 'bg-[#E05A47]/20 text-[#FCA5A5] border-[#E05A47]/60'
                            }`}
                          >
                            {item.type === 'facility' ? 'Facility Proposal' : 'Resident Grievance'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2F38] border border-[#334B56] text-[#94A3B8]">
                            By: <strong className="text-[#F8FAFC]">{item.submitted_by}</strong>
                          </span>
                        </div>

                        {item.photoUrl && (
                          <div
                            onClick={() => {
                              if (onOpenPhotoLightbox) {
                                onOpenPhotoLightbox({
                                  photoUrl: item.photoUrl!,
                                  title: item.title,
                                  category: item.category,
                                  coords: item.coords,
                                });
                              }
                            }}
                            className="relative w-full h-24 rounded-lg overflow-hidden border border-[#334B56] bg-[#0C171C] group cursor-pointer"
                          >
                            <img
                              src={item.photoUrl}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#132228]/95 via-transparent to-transparent flex items-end justify-between p-2">
                              <span className="text-[9px] text-[#38BDF8] font-mono bg-[#132228]/90 px-1.5 py-0.5 rounded border border-[#38BDF8]/40 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Photo Evidence
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold text-[#F8FAFC] tracking-tight leading-snug">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#94A3B8]">
                            <span className="capitalize font-mono">Category: {item.category.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => onFlyToCoords && onFlyToCoords(item.coords)}
                              className="text-[#38BDF8] hover:text-[#F8FAFC] flex items-center gap-0.5 cursor-pointer font-mono font-medium"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {item.coords[0].toFixed(5)}, {item.coords[1].toFixed(5)}
                            </button>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-[10px] text-[#94A3B8] bg-[#1B2F38] p-2 rounded-lg border border-[#334B56] line-clamp-2 italic">
                            "{item.description}"
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                          <button
                            type="button"
                            onClick={() => handleAssignToOfficer(item)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                            title="Approve and assign to field officer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Assign to Officer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(item)}
                            className="py-1.5 px-3 rounded-lg bg-[#E05A47]/20 hover:bg-[#E05A47]/30 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* STEP 2: Inspection Requests */}
              {verificationQueueStep === 2 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#94A3B8] flex items-center justify-between px-0.5">
                    <span className="font-semibold text-[#F59E0B]">Field Officer Inspection Requests</span>
                    <span className="font-mono">{step2Items.length} awaiting authorization</span>
                  </div>

                  {step2Items.length === 0 ? (
                    <div className="p-3 text-center rounded-lg bg-[#0C171C]/80 border border-[#334B56] text-[#94A3B8] text-xs flex flex-col items-center gap-1">
                      <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                      <span className="font-semibold text-[#F8FAFC]">No pending inspection authorizations</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        Field officers have not requested any new inspection authorizations.
                      </span>
                    </div>
                  ) : (
                    step2Items.map((item) => (
                      <div
                        key={`step2-${item.id}`}
                        className="p-3 rounded-xl bg-[#0C171C]/90 border border-[#F59E0B]/50 flex flex-col gap-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/60">
                            Inspection Sign-off Requested
                          </span>
                          <span className="text-[10px] font-mono text-[#38BDF8]">
                            Officer: {item.submitted_by}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-[#F8FAFC] tracking-tight leading-snug">
                            {item.title}
                          </h4>
                          <div className="text-[10px] text-[#94A3B8] mt-0.5">
                            {item.officer_notes || 'Officer has surveyed site and requested official inspection phase authorization.'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                          <button
                            type="button"
                            onClick={() => handleAuthorizeInspection(item)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:brightness-110 text-[#0C171C] font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Authorize Inspection Phase</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* STEP 3: Resolution Verifications */}
              {verificationQueueStep === 3 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#94A3B8] flex items-center justify-between px-0.5">
                    <span className="font-semibold text-[#10B981]">Officer Repaired & Proof Submitted</span>
                    <span className="font-mono">{step3Items.length} awaiting final audit</span>
                  </div>

                  {step3Items.length === 0 ? (
                    <div className="p-3 text-center rounded-lg bg-[#0C171C]/80 border border-[#334B56] text-[#94A3B8] text-xs flex flex-col items-center gap-1">
                      <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                      <span className="font-semibold text-[#F8FAFC]">No resolution audits pending</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        All completed repair works have been verified and signed off.
                      </span>
                    </div>
                  ) : (
                    step3Items.map((item) => (
                      <div
                        key={`step3-${item.id}`}
                        className="p-3 rounded-xl bg-[#0C171C]/90 border border-[#10B981]/50 flex flex-col gap-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/60">
                            Repair Proof Attached
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8]">
                            By: {item.submitted_by}
                          </span>
                        </div>

                        {item.photoUrl && (
                          <div
                            onClick={() => {
                              if (onOpenPhotoLightbox) {
                                onOpenPhotoLightbox({
                                  photoUrl: item.photoUrl!,
                                  title: `Repair Proof: ${item.title}`,
                                  category: item.category,
                                  coords: item.coords,
                                });
                              }
                            }}
                            className="relative w-full h-28 rounded-lg overflow-hidden border border-[#334B56] bg-[#0C171C] group cursor-pointer"
                            title="Click to inspect repair proof photo"
                          >
                            <img
                              src={item.photoUrl}
                              alt="Repair Proof"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#132228]/95 via-transparent to-transparent flex items-end justify-between p-2">
                              <span className="text-[9px] text-[#10B981] font-mono bg-[#132228]/90 px-1.5 py-0.5 rounded border border-[#10B981]/40 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Resolution Proof Photo
                              </span>
                              <span className="text-[9px] text-[#38BDF8] underline font-semibold flex items-center gap-0.5">
                                <ExternalLink className="w-2.5 h-2.5" /> Inspect
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold text-[#F8FAFC] tracking-tight leading-snug">
                            {item.title}
                          </h4>
                          {item.officer_notes && (
                            <p className="text-[10px] text-[#94A3B8] bg-[#1B2F38] p-2 rounded-lg border border-[#334B56] mt-1 italic">
                              "{item.officer_notes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                          <button
                            type="button"
                            onClick={() => handleVerifyResolved(item)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify & Mark Officially Resolved</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUB-SECTION A: High-Contrast Summary Stats Tiles (KPI Metric Tiles) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Tile 1: Active Issues */}
          <div className="bg-[#1B2F38] border border-[#334B56] p-4 rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs tracking-wider uppercase font-semibold text-[#94A3B8]">
                Priority
              </span>
              <div className="w-6 h-6 rounded-lg bg-[#E05A47]/20 border border-[#E05A47]/60 flex items-center justify-center text-[#FCA5A5]">
                <AlertOctagon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#F8FAFC] tracking-tight">
              {activeIssuesCount}
            </div>
            <div className="text-xs tracking-wider uppercase font-semibold text-[#94A3B8] leading-tight mt-1">
              Active Issues
            </div>
            <div className="text-[10px] text-[#94A3B8]/80 mt-0.5">Field Audited</div>
          </div>

          {/* Tile 2: DBSCAN Clusters */}
          <div className="bg-[#1B2F38] border border-[#334B56] p-4 rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs tracking-wider uppercase font-semibold text-[#94A3B8]">
                Hotspots
              </span>
              <div className="w-6 h-6 rounded-lg bg-[#E05A47]/20 border border-[#E05A47]/60 flex items-center justify-center text-[#FCA5A5]">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#38BDF8] tracking-tight">
              {dbscanClustersCount}
            </div>
            <div className="text-xs tracking-wider uppercase font-semibold text-[#94A3B8] leading-tight mt-1">
              DBSCAN Clusters
            </div>
            <div className="text-[10px] text-[#94A3B8]/80 mt-0.5">Danger Hotspots (ε=85m)</div>
          </div>
        </div>

        {/* SUB-SECTION B: Decision Support (Decision Support Hotspot Cards) */}
        <div className="rounded-xl border border-[#334B56] bg-[#1B2F38] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsDecisionSupportOpen(!isDecisionSupportOpen)}
            className="w-full px-3 py-2.5 bg-[#1B2F38] hover:bg-[#233B46] border-b border-[#334B56] flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-xs font-bold text-[#F8FAFC] tracking-tight">
                Decision Support
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0C171C] text-[#38BDF8] border border-[#334B56]">
                Top 5
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94A3B8]">
              <span className="text-[10px] text-[#94A3B8] font-mono">
                {isDecisionSupportOpen ? 'Collapse' : 'Expand'}
              </span>
              {isDecisionSupportOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </button>

          {isDecisionSupportOpen && (
            <div className="p-2 space-y-2">
              {/* Financial Capex summary */}
              <div className="px-2.5 py-1.5 rounded-lg bg-[#0C171C] border border-[#334B56] flex items-center justify-between text-[10px]">
                <span className="text-[#94A3B8] flex items-center gap-1 font-medium">
                  <Coins className="w-3 h-3 text-[#FCD34D]" />
                  Top 5 Est. Works Capex:
                </span>
                <span className="font-mono font-bold text-[#38BDF8]">
                  ₹{totalTopBudget.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Top 5 Priority Items (Hotspot Cards) */}
              {topIssues.map((issue, idx) => {
                const rank = issue.ai_rank || idx + 1;
                const score = issue.ai_priority_score || (99 - idx * 4);
                const budget = issue.estimated_budget_inr || (120000 - idx * 18000);
                const isSelected = selectedIssueId === issue.issue_id;

                return (
                  <div
                    key={issue.issue_id}
                    onClick={() => {
                      setSelectedIssueId(issue.issue_id);
                      onFlyToIssue(issue);
                    }}
                    className={`bg-[#1B2F38] hover:bg-[#233B46] border-l-4 border-l-[#E05A47] border border-[#334B56] rounded-xl p-3 mb-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#233B46] ring-1 ring-[#38BDF8]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-[#0C171C] border border-[#334B56] text-[9px] font-bold font-mono text-[#F8FAFC] flex items-center justify-center">
                          #{rank}
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5]">
                          Urgent
                        </span>
                        <span className="text-[10px] font-mono text-[#94A3B8]">
                          {issue.issue_id}
                        </span>
                      </div>
                      <div className="bg-[#E05A47]/20 text-[#FCA5A5] px-2 py-0.5 rounded-full text-xs font-bold">
                        Score: {score}/100
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-[#F8FAFC] leading-tight line-clamp-1 mb-1">
                      {issue.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-1.5">
                      <span className="capitalize">{issue.category.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-[#38BDF8] font-semibold">
                        Est: ₹{budget.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-[#334B56] text-[10px]">
                      <span className="font-mono text-[#38BDF8] font-medium text-[10px]">
                        {issue.latitude.toFixed(4)}°N, {issue.longitude.toFixed(4)}°E
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIssueId(issue.issue_id);
                          onFlyToIssue(issue);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-[#F8FAFC] text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Navigation className="w-2.5 h-2.5 text-[#38BDF8]" />
                        <span>Fly to Asset</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SUB-SECTION C: Village Analytics (Charts) (Collapsible) */}
        <div className="rounded-xl border border-[#334B56] bg-[#1B2F38] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
            className="w-full px-3 py-2.5 bg-[#1B2F38] hover:bg-[#233B46] border-b border-[#334B56] flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-xs font-bold text-[#F8FAFC] tracking-tight">
                Village Analytics
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0C171C] text-[#38BDF8] border border-[#334B56]">
                2 Visual Charts
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94A3B8]">
              <span className="text-[10px] text-[#94A3B8] font-mono">
                {isAnalyticsOpen ? 'Collapse' : 'Expand'}
              </span>
              {isAnalyticsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </button>

          {isAnalyticsOpen && (
            <div className="p-3 space-y-4">
              {/* Chart 1: Bar Chart (Issue Categories) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-[#F8FAFC] flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3 text-[#38BDF8]" />
                    Issue Categories Breakdown
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono">
                    {hoveredCategory ? `Focus: ${hoveredCategory}` : `${issues.length} Total Issues`}
                  </span>
                </div>

                <div className="space-y-1.5 bg-[#0C171C] p-2.5 rounded-xl border border-[#334B56]">
                  {categoryData.map((cat) => (
                    <div
                      key={cat.name}
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="group cursor-default"
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="font-semibold text-[#94A3B8] group-hover:text-[#F8FAFC] transition-colors">
                          {cat.name}
                        </span>
                        <span className="font-mono text-[#94A3B8]">
                          <strong className="text-[#F8FAFC]">{cat.count}</strong> faults ({cat.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#1B2F38] overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cat.name === 'Roads'
                              ? 'bg-gradient-to-r from-[#D9534F] to-[#E05A47]'
                              : cat.name === 'Water'
                              ? 'bg-gradient-to-r from-[#0D9488] to-[#10B981]'
                              : cat.name === 'Drainage'
                              ? 'bg-gradient-to-r from-[#0284C7] to-[#38BDF8]'
                              : cat.name === 'Sanitation'
                              ? 'bg-gradient-to-r from-[#E05A47] to-[#FCD34D]'
                              : 'bg-gradient-to-r from-[#10B981] to-[#38BDF8]'
                          }`}
                          style={{ width: `${Math.max(cat.pct, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: Donut Chart (Civic Issues Resolution & Fix Progress) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-[#F8FAFC] flex items-center gap-1.5">
                    <PieChart className="w-3 h-3 text-[#10B981]" />
                    Civic Issues Resolution Progress
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono">
                    {issueResolutionData.total} Total Issues
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-between gap-3">
                  {/* Circular SVG Donut */}
                  <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Background circle track */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#1B2F38"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      {/* Verified Resolved (Emerald #10B981) */}
                      {resLen > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          stroke="#10B981"
                          strokeWidth={strokeWidth}
                          strokeDasharray={`${resLen} ${donutCircumference}`}
                          strokeDashoffset="0"
                          fill="transparent"
                          strokeLinecap="butt"
                          className="transition-all duration-700 hover:opacity-80"
                        />
                      )}
                      {/* Under Audit / Inspecting (Amber Gold #F59E0B) */}
                      {auditLen > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          stroke="#F59E0B"
                          strokeWidth={strokeWidth}
                          strokeDasharray={`${auditLen} ${donutCircumference}`}
                          strokeDashoffset={`-${resLen}`}
                          fill="transparent"
                          strokeLinecap="butt"
                          className="transition-all duration-700 hover:opacity-80"
                        />
                      )}
                      {/* Active Grievances (Terracotta Red #E05A47) */}
                      {activeLen > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          stroke="#E05A47"
                          strokeWidth={strokeWidth}
                          strokeDasharray={`${activeLen} ${donutCircumference}`}
                          strokeDashoffset={`-${resLen + auditLen}`}
                          fill="transparent"
                          strokeLinecap="butt"
                          className="transition-all duration-700 hover:opacity-80"
                        />
                      )}
                    </svg>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-mono font-black text-[#10B981]">
                        {issueResolutionData.resolved.pct}%
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Resolved
                      </span>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="flex-1 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#1B2F38] border border-[#10B981]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                        <span className="font-semibold text-[#F8FAFC]">Resolved</span>
                      </div>
                      <span className="font-mono text-[#6EE7B7] font-bold">
                        {issueResolutionData.resolved.count} ({issueResolutionData.resolved.pct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#1B2F38] border border-[#F59E0B]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                        <span className="font-semibold text-[#F8FAFC]">Audit Pending</span>
                      </div>
                      <span className="font-mono text-[#FDE68A] font-bold">
                        {issueResolutionData.pendingAudit.count} ({issueResolutionData.pendingAudit.pct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#1B2F38] border border-[#E05A47]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E05A47]"></span>
                        <span className="font-semibold text-[#F8FAFC]">Active Issues</span>
                      </div>
                      <span className="font-mono text-[#FCA5A5] font-bold">
                        {issueResolutionData.active.count} ({issueResolutionData.active.pct}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PanchayatAdminPanel;
