import React, { useState } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import type { CachedFacility, CachedIssue } from '../services/offlineDb';
import type { UserSessionInfo } from '../utils/reportGenerator';

interface ExportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: CachedFacility[];
  issues: CachedIssue[];
  currentUser?: UserSessionInfo;
  onDownloadPdf: () => void;
  onExportCsv: () => void;
}

export const ExportAuditModal: React.FC<ExportAuditModalProps> = ({
  isOpen,
  onClose,
  facilities,
  issues,
  currentUser,
  onDownloadPdf,
  onExportCsv,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCsv, setIsGeneratingCsv] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const approvedFacilities = facilities.filter(
    (f) => (f.approval_status || 'approved') === 'approved'
  );
  const approvedIssues = issues.filter(
    (i) => (i.approval_status || 'approved') === 'approved'
  );
  const pendingCount =
    facilities.filter((f) => f.approval_status === 'pending_approval').length +
    issues.filter((i) => i.approval_status === 'pending_approval').length;
  const criticalCount = approvedIssues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  ).length;

  const handlePdfClick = async () => {
    try {
      setIsGeneratingPdf(true);
      setSuccessMsg(null);
      // Small timeout to allow UI thread to paint spinner
      await new Promise((resolve) => setTimeout(resolve, 80));
      onDownloadPdf();
      setSuccessMsg('Official Panchayat Audit PDF generated and downloaded successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCsvClick = async () => {
    try {
      setIsGeneratingCsv(true);
      setSuccessMsg(null);
      await new Promise((resolve) => setTimeout(resolve, 80));
      onExportCsv();
      setSuccessMsg('Master Data CSV exported successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to generate CSV:', err);
    } finally {
      setIsGeneratingCsv(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Panchayat Audit & Data Export Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold">
                  Client-Side
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gram Panchayat Khopripada • Official Governance & Spatial Registry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close Export Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Assets
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                {approvedFacilities.length}
              </span>
              <span className="text-[9px] text-slate-400">Approved</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Grievances
              </span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                {approvedIssues.length}
              </span>
              <span className="text-[9px] text-slate-400">Verified</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Pending
              </span>
              <span className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                {pendingCount}
              </span>
              <span className="text-[9px] text-slate-400">In Review</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-rose-400" /> Urgent
              </span>
              <span className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                {criticalCount}
              </span>
              <span className="text-[9px] text-slate-400">High Risk</span>
            </div>
          </div>

          {/* Export Options Cards */}
          <div className="space-y-3">
            {/* Option 1: Official PDF Report */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 transition flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                    PDF DOCUMENT
                  </span>
                  <h4 className="text-sm font-bold text-white">
                    Official Panchayat Audit Report
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Includes formatted tables of top priority civic grievances with color-coded severity,
                  public facilities registry with monsoon status, and formal Gram Sevak & Sarpanch
                  signature blocks for administrative review.
                </p>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Output: <span className="text-emerald-400">Khopripada_Panchayat_Audit_Report_[Date].pdf</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePdfClick}
                disabled={isGeneratingPdf}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/20 flex-shrink-0 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                    <span>Building PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>

            {/* Option 2: Master CSV Data */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 transition flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold font-mono">
                    SPREADSHEET (CSV)
                  </span>
                  <h4 className="text-sm font-bold text-white">
                    Export Master Data CSV
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Raw tabular export of all facilities, surveyed defect points, and citizen grievances
                  including GPS coordinates, operational conditions, and approval statuses with UTF-8 BOM.
                </p>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Output: <span className="text-purple-400">khopripada_civic_data_[Date].csv</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCsvClick}
                disabled={isGeneratingCsv}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-purple-900/30 flex-shrink-0 disabled:opacity-50"
              >
                {isGeneratingCsv ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User Sign-Off Context */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div>
              <span className="text-slate-400">Audit Sign-Off Authority: </span>
              <span className="text-white font-semibold">{currentUser?.name || 'Sarpanch Rajesh Patil'}</span>
              <span className="text-slate-400"> ({currentUser?.designation || 'Sarpanch / Panchayat Lead'})</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400">Verified Gateway</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAuditModal;
