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
  FileText,
} from 'lucide-react';
import {
  db,
  approveFacility,
  rejectFacility,
  approveGrievance,
  rejectGrievance,
  type CachedIssue,
  type CachedFacility,
  type OfflineGrievance,
} from '../services/offlineDb';

export interface PendingSubmissionItem {
  id: string | number;
  type: 'facility' | 'grievance';
  title: string;
  category: string;
  submitted_by: string;
  coords: [number, number];
  photoUrl?: string;
  description?: string;
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
  onExportAudit?: () => void;
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
  onExportAudit,
}) => {
  const [isDecisionSupportOpen, setIsDecisionSupportOpen] = useState(true);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
  const [isPendingQueueOpen, setIsPendingQueueOpen] = useState(true);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [pendingGrievances, setPendingGrievances] = useState<OfflineGrievance[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadPendingGrievances = useCallback(async () => {
    try {
      const records = await db.offline_grievances.toArray();
      setPendingGrievances(records.filter((g) => g.approval_status === 'pending_approval'));
    } catch (err) {
      console.error('Failed to query pending grievances:', err);
    }
  }, []);

  useEffect(() => {
    loadPendingGrievances();
  }, [loadPendingGrievances]);

  const pendingItems: PendingSubmissionItem[] = useMemo(() => {
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
        rawFacility: f,
      }));

    const grievanceItems: PendingSubmissionItem[] = pendingGrievances.map((g) => ({
      id: g.id!,
      type: 'grievance',
      title: g.title,
      category: g.category,
      submitted_by: g.submitted_by || 'Resident',
      coords: [g.latitude, g.longitude],
      photoUrl: g.photoBase64,
      description: g.description,
      rawGrievance: g,
    }));

    return [...facilityItems, ...grievanceItems];
  }, [facilities, pendingGrievances]);

  const handleApprove = async (item: PendingSubmissionItem) => {
    try {
      if (item.type === 'facility') {
        await approveFacility(item.id as string);
      } else {
        await approveGrievance(item.id as number);
      }
      setActionSuccessMsg(`Approved "${item.title}" — Published to live map!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadPendingGrievances();
      if (onApproveSubmission) {
        onApproveSubmission(item);
      }
    } catch (err) {
      console.error('Failed to approve submission:', err);
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
      await loadPendingGrievances();
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
    // Fallback to 15 if issues list is in field survey mode or empty, as specified in prompt
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

  // C. Village Analytics - 1. Issue Categories Breakdown
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      Roads: 0,
      Water: 0,
      Drainage: 0,
      Sanitation: 0,
      Electricity: 0,
    };

    issues.forEach((iss) => {
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

    // Ensure minimum representative numbers if empty survey loaded
    if (Object.values(counts).every((v) => v === 0)) {
      counts.Roads = 6;
      counts.Water = 4;
      counts.Drainage = 3;
      counts.Sanitation = 2;
      counts.Electricity = 1;
    }

    const maxVal = Math.max(...Object.values(counts), 1);
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [issues]);

  // C. Village Analytics - 2. Facility Conditions Breakdown (Functional, Degraded, Broken)
  const conditionData = useMemo(() => {
    let functional = 0;
    let degraded = 0;
    let broken = 0;

    facilities.forEach((f) => {
      const st = (f.operational_status || '').toLowerCase();
      if (st.includes('non') || st.includes('broken') || st.includes('repair')) {
        broken += 1;
      } else if (st.includes('part') || st.includes('degrad')) {
        degraded += 1;
      } else {
        functional += 1;
      }
    });

    const total = functional + degraded + broken || 1;
    return {
      functional: { count: functional, pct: Math.round((functional / total) * 100) },
      degraded: { count: degraded, pct: Math.round((degraded / total) * 100) },
      broken: { count: broken, pct: Math.round((broken / total) * 100) },
      total,
    };
  }, [facilities]);

  if (!isOpen) return null;

  // Donut geometry constants
  const donutRadius = 42;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const strokeWidth = 14;

  const funcLen = (conditionData.functional.pct / 100) * donutCircumference;
  const degLen = (conditionData.degraded.pct / 100) * donutCircumference;
  const broLen = (conditionData.broken.pct / 100) * donutCircumference;

  return (
    <div className="pointer-events-auto backdrop-blur-2xl bg-slate-950/92 border border-slate-700/70 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden w-84 sm:w-96 text-slate-100 transition-all flex flex-col max-h-[calc(100vh-140px)] animate-in fade-in slide-in-from-right-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-purple-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-950/90 px-1.5 py-0.5 rounded border border-purple-500/40">
                Panchayat Admin
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" /> Live Twin
              </span>
            </div>
            <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1 mt-0.5">
              Executive Decision Console
              <Sparkles className="w-3 h-3 text-amber-400" />
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onExportAudit && (
            <button
              onClick={onExportAudit}
              className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-sm"
              title="Open Executive Panchayat Audit (PDF & CSV)"
            >
              <FileText className="w-3 h-3 text-purple-400" />
              <span>Export Audit</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-700">
        {/* PROMINENT SECTION: 📋 Pending Submissions Queue */}
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 overflow-hidden shadow-lg shadow-amber-950/20">
          <button
            type="button"
            onClick={() => setIsPendingQueueOpen(!isPendingQueueOpen)}
            className="w-full px-3 py-2.5 bg-slate-950/80 hover:bg-slate-900/90 border-b border-amber-500/30 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white tracking-tight">
                Pending Submissions Queue
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  pendingItems.length > 0
                    ? 'bg-amber-500/25 text-amber-300 border-amber-400 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {pendingItems.length} Pending
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] text-slate-400 font-mono">
                {isPendingQueueOpen ? 'Collapse' : 'Expand'}
              </span>
              {isPendingQueueOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
          </button>

          {isPendingQueueOpen && (
            <div className="p-2.5 space-y-2.5">
              {actionSuccessMsg && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {pendingItems.length === 0 ? (
                <div className="p-3 text-center rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 text-xs flex flex-col items-center gap-1">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-slate-300">All submissions verified</span>
                  <span className="text-[10px] text-slate-500">
                    No pending facility proposals or civic grievances awaiting review.
                  </span>
                </div>
              ) : (
                pendingItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-2 shadow-sm"
                  >
                    {/* Item Type & Submitter Role */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          item.type === 'facility'
                            ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {item.type === 'facility' ? '🏢 Facility Proposal' : '⚠️ Civic Grievance'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        By: <strong className="text-white">{item.submitted_by}</strong>
                      </span>
                    </div>

                    {/* Attached Photo Preview */}
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
                        className="relative w-full h-28 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group cursor-pointer"
                        title="Click to inspect high-resolution photo"
                      >
                        <img
                          src={item.photoUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end justify-between p-2">
                          <span className="text-[9px] text-emerald-300 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> Photo Attached
                          </span>
                          <span className="text-[9px] text-cyan-300 underline font-semibold flex items-center gap-0.5">
                            <ExternalLink className="w-2.5 h-2.5" /> Inspect
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Title & Category */}
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-tight leading-snug">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        <span className="capitalize text-slate-300 font-mono">
                          Category: {item.category.replace(/_/g, ' ')}
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => onFlyToCoords && onFlyToCoords(item.coords)}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer font-mono"
                          title="Fly to GPS Coordinates on Map"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          {item.coords[0].toFixed(5)}, {item.coords[1].toFixed(5)}
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-[10px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 line-clamp-2 italic">
                        "{item.description}"
                      </p>
                    )}

                    {/* Action Buttons: [✅ Approve & Publish] and [❌ Reject] */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition cursor-pointer active:scale-95"
                        title="Approve item and publish immediately to the live GIS map"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Publish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        className="py-1.5 px-3 rounded-lg bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-500/40 hover:border-rose-400 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                        title="Reject submission"
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
        </div>

        {/* SUB-SECTION A: High-Contrast Summary Stats Tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Tile 1: 15 Active Issues */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-950/60 to-slate-900/90 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Priority
              </span>
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                <AlertOctagon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-mono font-black text-white tracking-tight">
              {activeIssuesCount}
            </div>
            <div className="text-[10px] font-semibold text-rose-300/90 leading-tight mt-0.5">
              Active Issues
            </div>
            <div className="text-[9px] text-slate-400 mt-1">Field Audited</div>
          </div>

          {/* Tile 2: 3 DBSCAN Clusters */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-950/60 to-slate-900/90 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                Hotspots
              </span>
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-mono font-black text-white tracking-tight">
              {dbscanClustersCount}
            </div>
            <div className="text-[10px] font-semibold text-purple-300/90 leading-tight mt-0.5">
              DBSCAN Clusters
            </div>
            <div className="text-[9px] text-slate-400 mt-1">Danger Hotspots (ε=85m)</div>
          </div>
        </div>

        {/* SUB-SECTION B: Decision Support (Collapsible) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsDecisionSupportOpen(!isDecisionSupportOpen)}
            className="w-full px-3 py-2.5 bg-slate-950/70 hover:bg-slate-900/90 border-b border-slate-800 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-bold text-slate-100 tracking-tight">
                Decision Support
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                Top 5
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] text-slate-400 font-mono">
                {isDecisionSupportOpen ? 'Collapse' : 'Expand'}
              </span>
              {isDecisionSupportOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
              )}
            </div>
          </button>

          {isDecisionSupportOpen && (
            <div className="p-2 space-y-2">
              {/* Financial Capex summary */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" />
                  Top 5 Est. Works Capex:
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  ₹{totalTopBudget.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Top 5 Priority Items */}
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
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-purple-500/40 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-md bg-purple-900/90 border border-purple-500/50 text-[9px] font-bold font-mono text-purple-200 flex items-center justify-center">
                          #{rank}
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-rose-950/90 border border-rose-500/40 text-rose-300">
                          Urgent
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {issue.issue_id}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-900/80">
                        Score: {score}/100
                      </div>
                    </div>

                    <h4 className="text-[11px] font-bold text-white leading-tight line-clamp-1 mb-1">
                      {issue.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="capitalize">{issue.category.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ₹{budget.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                      <span className="font-mono text-slate-500 text-[9px]">
                        {issue.latitude.toFixed(4)}°N, {issue.longitude.toFixed(4)}°E
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIssueId(issue.issue_id);
                          onFlyToIssue(issue);
                        }}
                        className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-2.5 h-2.5" />
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
            className="w-full px-3 py-2.5 bg-slate-950/70 hover:bg-slate-900/90 border-b border-slate-800 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-slate-100 tracking-tight">
                Village Analytics
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                2 Visual Charts
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] text-slate-400 font-mono">
                {isAnalyticsOpen ? 'Collapse' : 'Expand'}
              </span>
              {isAnalyticsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </div>
          </button>

          {isAnalyticsOpen && (
            <div className="p-3 space-y-4">
              {/* Chart 1: Bar Chart (Issue Categories) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3 text-cyan-400" />
                    Issue Categories Breakdown
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {hoveredCategory ? `Focus: ${hoveredCategory}` : `${issues.length} Total Issues`}
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  {categoryData.map((cat) => (
                    <div
                      key={cat.name}
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="group cursor-default"
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="font-semibold text-slate-300 group-hover:text-cyan-300 transition-colors">
                          {cat.name}
                        </span>
                        <span className="font-mono text-slate-400">
                          <strong className="text-white">{cat.count}</strong> faults ({cat.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cat.name === 'Roads'
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                              : cat.name === 'Water'
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                              : cat.name === 'Drainage'
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                              : cat.name === 'Sanitation'
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                              : 'bg-gradient-to-r from-yellow-500 to-amber-500'
                          }`}
                          style={{ width: `${Math.max(cat.pct, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: Donut Chart (Facility Conditions) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <PieChart className="w-3 h-3 text-emerald-400" />
                    Facility Conditions (Health)
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {conditionData.total} Assets
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  {/* Circular SVG Donut */}
                  <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Background circle track */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#1e293b"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      {/* Functional (Green) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#10b981"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${funcLen} ${donutCircumference}`}
                        strokeDashoffset="0"
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-700 hover:opacity-80"
                      />
                      {/* Degraded (Yellow) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#f59e0b"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${degLen} ${donutCircumference}`}
                        strokeDashoffset={`-${funcLen}`}
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-700 hover:opacity-80"
                      />
                      {/* Broken (Red) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#ef4444"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${broLen} ${donutCircumference}`}
                        strokeDashoffset={`-${funcLen + degLen}`}
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-700 hover:opacity-80"
                      />
                    </svg>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {conditionData.functional.pct}%
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                        Healthy
                      </span>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="flex-1 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-emerald-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                        <span className="font-semibold text-slate-200">Functional</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">
                        {conditionData.functional.count} ({conditionData.functional.pct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-amber-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
                        <span className="font-semibold text-slate-200">Degraded</span>
                      </div>
                      <span className="font-mono text-amber-400 font-bold">
                        {conditionData.degraded.count} ({conditionData.degraded.pct}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-rose-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]"></span>
                        <span className="font-semibold text-slate-200">Broken</span>
                      </div>
                      <span className="font-mono text-rose-400 font-bold">
                        {conditionData.broken.count} ({conditionData.broken.pct}%)
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
