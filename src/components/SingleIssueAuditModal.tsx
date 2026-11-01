import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  FileText,
  Camera,
} from 'lucide-react';
import { generateSingleIssueAuditPDF, type UserSessionInfo } from '../utils/reportGenerator';
import type { CivicIssue } from '../types';

interface SingleIssueAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: CivicIssue | any | null;
  currentUser?: UserSessionInfo;
}

export const SingleIssueAuditModal: React.FC<SingleIssueAuditModalProps> = ({
  isOpen,
  onClose,
  issue,
  currentUser,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !issue) return null;

  const issueId = String(issue.issue_id || issue.id || 'KHOP-ISS-001');
  const rawStatus = (issue.status || 'reported').toLowerCase();
  const isResolved = rawStatus === 'resolved' || rawStatus === 'verified_closed';
  const isAuditPending = rawStatus === 'pending_resolution_approval';

  const statusDisplay = isResolved
    ? { label: 'Step 5: Verified & Officially Resolved', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    : isAuditPending
    ? { label: 'Step 4: Audit Submitted • Awaiting Sarpanch Sign-Off', bg: 'bg-amber-100 text-amber-800 border-amber-300' }
    : rawStatus === 'under_inspection'
    ? { label: 'Step 3: Under Active Field Inspection', bg: 'bg-blue-100 text-blue-800 border-blue-300' }
    : { label: 'Step 1: Registered Civic Complaint', bg: 'bg-rose-100 text-rose-800 border-rose-300' };

  const reportedPhoto = issue.photoBase64 || issue.photo_url || (issue as any).proof_image_url || null;
  const rawResolution = issue.resolution_photo_url || null;
  // STRICT SEPARATION: Ensure resolution photo is distinct from the initial reported defect photo
  const resolutionPhoto = (rawResolution && rawResolution !== reportedPhoto && rawResolution !== issue.photo_url && rawResolution !== issue.photoBase64)
    ? rawResolution
    : null;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      await generateSingleIssueAuditPDF(issue, currentUser);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to generate audit PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[94dvh] bg-[#081018] border border-[#1D3B52] rounded-2xl shadow-2xl flex flex-col text-[#F1F5F9] overflow-hidden">
        {/* Top Control Bar (Screen Only - Hidden in Print) */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 border-b border-[#1D3B52] bg-[#0D1C2A] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/20 border border-[#38BDF8]/50 text-[#38BDF8] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight truncate">
                  Official Issue Audit Record
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] shrink-0">
                  Form 12-B
                </span>
              </div>
              <p className="text-[11px] text-[#8CB0C9] mt-0.5 truncate">
                Physical Record for Sarpanch Inspection, Countersignature & Official Filing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-lg bg-[#00E5FF] hover:bg-[#38BDF8] text-[#081018] text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download high-resolution official A4 PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#142C3F] hover:bg-[#1D3B52] border border-[#1D3B52] hover:border-[#00E5FF]/60 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title="Print directly to physical printer (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="hidden sm:inline">Print Hardcopy</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-[#8CB0C9] hover:text-white hover:bg-[#142C3F] transition flex items-center justify-center cursor-pointer"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success toast if downloaded */}
        {downloadSuccess && (
          <div className="mx-6 mt-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-600 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Official Audit Record PDF downloaded successfully! Ready for physical Sarpanch sign-off.</span>
          </div>
        )}

        {/* Printable Document Sheet Preview Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#04080D]">
          {/* Printable Document Container */}
          <div
            id="printable-audit-certificate"
            className="w-full max-w-[210mm] mx-auto bg-white text-slate-900 border-2 border-slate-700 shadow-xl p-5 sm:p-7 rounded-sm space-y-4 font-sans text-xs"
          >
            {/* 1. Official Government Header */}
            <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-700">
                Government of Maharashtra • Palghar District Administration
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                Bapane Gram Panchayat — Village Khopripada
              </h1>
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                Civic Grievance & Infrastructure Resolution Audit Certificate
              </div>
              <div className="text-[9px] text-slate-600 italic">
                [ Statutory Form 12-B • Maintained Under Section 4B Maharashtra Village Panchayats Act • Gram Sabha Works Register ]
              </div>
            </div>

            {/* 2. File Reference & Verification Status Banner */}
            <div className="bg-slate-50 border border-slate-300 rounded p-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-slate-900 font-mono">
                  AUDIT FILE NO: GPB/KHOP/AUDIT/2026/{issueId.toUpperCase()}
                </div>
                <div className="text-[10px] text-slate-600">
                  Registered: <b>{issue.created_at ? new Date(issue.created_at).toLocaleDateString('en-IN') : formattedDate}</b> | Audit Date: <b>{formattedDate}</b>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase ${statusDisplay.bg}`}>
                {statusDisplay.label}
              </div>
            </div>

            {/* 3. Issue Specification & Geodetic Telemetry Grid */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-slate-800 text-white font-bold px-3 py-1 text-[10px] uppercase tracking-wider">
                Civic Asset & Ground Survey Telemetry
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 text-[11px]">
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Defect / Incident Title</span>
                  <span className="font-bold text-slate-900">{issue.title || 'Civic Infrastructure Fault'}</span>
                </div>
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Category / Sector</span>
                  <span className="font-bold text-slate-900 capitalize">{issue.category || 'General Public Works'}</span>
                </div>
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">GPS Coordinates (Geodetic Point)</span>
                  <span className="font-mono font-bold text-sky-800">
                    {Number(issue.latitude || 19.3542).toFixed(5)}° N, {Number(issue.longitude || 72.8845).toFixed(5)}° E
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Priority Severity Level</span>
                  <span className="font-bold uppercase text-rose-700">● {issue.severity || 'Medium'} Priority</span>
                </div>
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Complainant / Source</span>
                  <span className="font-semibold text-slate-800">
                    {issue.reported_by || issue.reporter_name || 'Resident Citizen Survey'}
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Assigned Field Officer</span>
                  <span className="font-semibold text-slate-800">
                    {issue.assigned_officer || issue.assigned_to || 'Panchayat Engineering Division'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Citizen Grievance & Defect Statement */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-slate-100 font-bold px-3 py-1 text-[10px] uppercase tracking-wider text-slate-800 border-b border-slate-300">
                1. Citizen Grievance Narrative & Problem Scope
              </div>
              <div className="p-3 text-[11px] leading-relaxed text-slate-800 bg-white">
                {issue.description || 'No additional narrative description submitted during intake survey.'}
              </div>
            </div>

            {/* 5. Field Inspection & Technical Rectification Log */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-slate-100 font-bold px-3 py-1 text-[10px] uppercase tracking-wider text-slate-800 border-b border-slate-300">
                2. Technical Inspection & Rectification Work Log
              </div>
              <div className="p-3 text-[11px] leading-relaxed text-slate-800 bg-white">
                {issue.resolution_notes || issue.officer_notes || 'Ground repair inspected and completed as per standard public works specifications. Functional verification confirmed on site with photographic evidence.'}
              </div>
            </div>

            {/* 6. Dual Photographic Evidence Record */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-slate-100 font-bold px-3 py-1 text-[10px] uppercase tracking-wider text-slate-800 border-b border-slate-300">
                3. Photographic Evidence Record (Mandatory for Sarpanch Sign-off)
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                {/* Photo 1: Initial Defect */}
                <div className="border border-slate-300 rounded p-2 flex flex-col items-center text-center bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-700 uppercase mb-1.5">
                    Frame A: Initial Field Defect
                  </span>
                  {reportedPhoto ? (
                    <div className="relative w-full h-36 rounded overflow-hidden border border-slate-300 bg-black/5">
                      <img
                        src={reportedPhoto}
                        alt="Initial Defect"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-black/75 text-white">
                        Initial Intake
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-36 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center p-3 text-slate-400 bg-white">
                      <Camera className="w-5 h-5 mb-1" />
                      <span className="font-bold text-[10px] text-slate-600">Attach Physical Photo</span>
                      <span className="text-[8px] text-slate-400 mt-0.5 text-center">
                        Staple or paste 4" x 6" photographic print of initial site condition
                      </span>
                    </div>
                  )}
                </div>

                {/* Photo 2: Resolution Proof */}
                <div className="border border-slate-300 rounded p-2 flex flex-col items-center text-center bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-700 uppercase mb-1.5">
                    Frame B: Post-Repair Completion Proof
                  </span>
                  {resolutionPhoto ? (
                    <div className="relative w-full h-36 rounded overflow-hidden border border-slate-300 bg-black/5">
                      <img
                        src={resolutionPhoto}
                        alt="Resolution Proof"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-800 text-white">
                        ✓ Repair Verified
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-36 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center p-3 text-slate-400 bg-white">
                      <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-600" />
                      <span className="font-bold text-[10px] text-slate-600">Attach Completion Photo</span>
                      <span className="text-[8px] text-slate-400 mt-0.5 text-center">
                        Staple or paste 4" x 6" photographic proof of completed ground repair
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 7. Tripartite Physical Certification & Sarpanch Seal Block */}
            <div className="border border-slate-300 rounded p-3 bg-slate-50 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                4. Statutory Tripartite Sign-off & Formal Sarpanch Endorsement
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {/* 1. Field Officer */}
                <div className="flex flex-col justify-between border-r border-slate-200 pr-2 min-h-[90px]">
                  <div>
                    <span className="font-bold text-[10px] text-slate-900 block uppercase">
                      Field Inspecting Officer
                    </span>
                    <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                      Certified on-site technical completion
                    </span>
                  </div>
                  <div className="pt-6 border-b border-dashed border-slate-400 text-center">
                    <span className="text-[9px] font-semibold text-slate-700">
                      {issue.assigned_officer || 'Field Engineer'}
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 text-center pt-0.5">
                    Signature & Date
                  </div>
                </div>

                {/* 2. Gram Sevak */}
                <div className="flex flex-col justify-between border-r border-slate-200 pr-2 min-h-[90px]">
                  <div>
                    <span className="font-bold text-[10px] text-slate-900 block uppercase">
                      Gram Sevak / Secretary
                    </span>
                    <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                      Works Registry Entry Vol. IV
                    </span>
                  </div>
                  <div className="pt-6 border-b border-dashed border-slate-400 text-center">
                    <span className="text-[9px] font-semibold text-slate-700">
                      Gram Sevak, Bapane GP
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 text-center pt-0.5">
                    Registry Entry & Date
                  </div>
                </div>

                {/* 3. Sarpanch Stamp & Signature */}
                <div className="flex flex-col justify-between min-h-[90px] relative">
                  <div>
                    <span className="font-bold text-[10px] text-amber-800 block uppercase">
                      Sarpanch (Gram Panchayat Head)
                    </span>
                    <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                      Formal Resolution Sign-off & Seal
                    </span>
                  </div>

                  {/* Stamp box indicator */}
                  <div className="my-1 py-2 border-2 border-dashed border-amber-300 rounded bg-amber-50/50 text-center">
                    <span className="text-[7.5px] font-bold font-mono text-amber-800 block leading-tight uppercase">
                      [ Official Gram Panchayat ]
                    </span>
                    <span className="text-[7.5px] font-bold font-mono text-amber-800 block leading-tight uppercase">
                      Rubber Stamp & Seal Here
                    </span>
                  </div>

                  <div className="pt-2 border-b border-dashed border-slate-400 text-center">
                    <span className="text-[9px] font-bold text-slate-900">
                      Signature of Sarpanch
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 text-center pt-0.5">
                    Date of Formal Closure: __________________
                  </div>
                </div>
              </div>
            </div>

            {/* 8. Statutory Retention Footnote */}
            <div className="pt-2 border-t border-slate-300 text-[8px] text-slate-500 leading-tight">
              <b>MANDATORY PHYSICAL FILING DIRECTIVE:</b> As prescribed under Section 4B of the Maharashtra Village Panchayats Act, this signed audit certificate along with photographic evidence must be permanently filed in the Bapane Gram Panchayat Office Public Works physical archive for a mandatory minimum of five (5) years for District Administration and Accountant General (AG) Social Audits.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleIssueAuditModal;
