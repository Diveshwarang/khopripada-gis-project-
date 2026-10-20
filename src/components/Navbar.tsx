import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Locate,
  Flame,
  Layers,
  Plus,
  AlertTriangle,
  FileText,
  ClipboardList,
  ChevronDown,
  User,
  Shield,
  ClipboardCheck,
  LogOut,
} from 'lucide-react';
import type { Role } from '../types/auth';
import { UserProfileBadge } from './UserProfileBadge';

export interface NavbarProps {
  userRole: Role;
  isLiveConnected: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  isLocating: boolean;
  onLocateMe: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: (val: boolean) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isAddFacilityMode: boolean;
  onToggleAddFacilityMode: () => void;
  onOpenGrievanceModal: () => void;
  onOpenExportAuditModal?: () => void;
  onOfficerExportWorklist?: () => void;
  onPortalSwitch: (targetRole: Role, roleLabel?: string) => void;
  onMobileLogout?: () => void;
  onOpenMobileSheet?: (sheet: 'role' | 'layers' | null) => void;
  mobileSheet?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  userRole,
  isLiveConnected,
  isSimulatedOffline,
  onToggleSimulatedOffline,
  isLocating,
  onLocateMe,
  showHeatmap,
  onToggleHeatmap,
  sidebarOpen,
  onToggleSidebar,
  isAddFacilityMode,
  onToggleAddFacilityMode,
  onOpenGrievanceModal,
  onOpenExportAuditModal,
  onOfficerExportWorklist,
  onPortalSwitch,
  onMobileLogout,
  onOpenMobileSheet,
  mobileSheet,
}) => {
  const [isPortalSwitcherOpen, setIsPortalSwitcherOpen] = useState<boolean>(false);
  const portalSwitcherRef = useRef<HTMLDivElement>(null);

  const AVAILABLE_ROLES: { id: Role; label: string; desc: string }[] = [
    { id: 'user', label: 'RESIDENTIAL DESK', desc: 'Public Asset Registry & Grievances' },
    { id: 'officer', label: 'FIELD OPERATIONS', desc: 'Task Execution & Ground Inspection' },
    { id: 'admin', label: 'PANCHAYAT EXECUTIVE', desc: 'Budget Decision Support & Approvals' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (portalSwitcherRef.current && !portalSwitcherRef.current.contains(e.target as Node)) {
        setIsPortalSwitcherOpen(false);
      }
    };
    if (isPortalSwitcherOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isPortalSwitcherOpen]);

  const getRoleIcon = (roleId: Role) => {
    if (roleId === 'admin') return <Shield className="w-4 h-4 text-[#F59E0B]" />;
    if (roleId === 'officer') return <ClipboardCheck className="w-4 h-4 text-[#38BDF8]" />;
    return <User className="w-4 h-4 text-[#10B981]" />;
  };

  const getPanchayatId = (role: Role) => {
    if (role === 'admin') return 'Panchayat ID: GP-KHOP-001 • Sarpanch Admin';
    if (role === 'officer') return 'Officer ID: GS-MH-4012 • Gram Sevak Field Desk';
    return 'Resident Portal • Khopripada Ward 1';
  };

  return (
    <>
      {/* 1. MOBILE TOP BAR (< 768px, HEIGHT: 52px / H-13) */}
      <header className="flex md:hidden h-13 w-full bg-[#132228]/95 backdrop-blur-md border-b border-[#334B56] px-3 items-center justify-between gap-1.5 z-[2000] flex-shrink-0 select-none">
        {/* Left: Branding */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#38BDF8] shadow-sm shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white tracking-wide shrink-0">
            Khopripada
          </span>
        </div>

        {/* Center: Clean Administrative Role Badge */}
        <button
          onClick={() => onOpenMobileSheet?.(mobileSheet === 'role' ? null : 'role')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] text-xs font-medium tracking-wide cursor-pointer active:scale-95 transition"
          title={`${getPanchayatId(userRole)} • Tap to switch portal`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
          <span>{userRole === 'admin' ? 'PANCHAYAT EXEC' : userRole === 'officer' ? 'FIELD OPS' : 'WARD 01'}</span>
          <span className="text-[10px] text-slate-400 font-mono">▼</span>
        </button>

        {/* Right: Action icons in a unified group with 40x40px touch targets */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer ${
              isLocating
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#1B2F38] border-[#334B56] text-[#38BDF8] hover:text-[#F8FAFC]'
            }`}
            title="Locate Me (GPS)"
            aria-label="Locate me on map"
          >
            <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onOpenMobileSheet?.(mobileSheet === 'layers' ? null : 'layers')}
            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer ${
              mobileSheet === 'layers'
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#1B2F38] border-[#334B56] text-[#38BDF8] hover:text-[#F8FAFC]'
            }`}
            title="Layers & Basemaps"
            aria-label="Toggle layers bottom sheet"
          >
            <Layers className="w-4 h-4" />
          </button>

          {onMobileLogout && (
            <button
              onClick={onMobileLogout}
              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-[#E05A47]/15 hover:bg-[#E05A47]/30 border border-[#E05A47]/40 text-[#FCA5A5] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer active:scale-95 transition"
              title="Sign Out Session"
              aria-label="Sign Out Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. DESKTOP TOP NAVIGATION BAR (>= 768px, EXACT H-16 UNIFIED GRID) */}
      <header className="hidden md:flex h-16 w-full px-6 bg-[#132228]/95 backdrop-blur-md border-b border-[#334B56] items-center justify-between gap-4 z-[2000] flex-shrink-0 select-none">
        
        {/* Left Section: Branding + Subtitle Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#38BDF8] shadow-md">
            <Building2 className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div className="flex items-center">
            <span className="text-lg font-bold text-[#F8FAFC] tracking-wide whitespace-nowrap">
              Smart Village GIS
            </span>
            <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-md bg-[#1B2F38] text-[#38BDF8] border border-[#38BDF8]/40 ml-2 whitespace-nowrap">
              Khopripada • Digital Twin
            </span>
          </div>

          {/* Live Network Status Indicator */}
          <div
            onClick={onToggleSimulatedOffline}
            className="hidden lg:flex items-center gap-2 pl-3 border-l border-[#334B56] cursor-pointer hover:opacity-85 transition select-none"
            title={isSimulatedOffline ? 'Click to restore live network sync' : 'Click to toggle simulated offline mode'}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isLiveConnected ? 'bg-[#10B981] opacity-75' : 'bg-[#E05A47] opacity-75'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isLiveConnected
                    ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                    : 'bg-[#E05A47] shadow-[0_0_8px_#E05A47]'
                }`}
              />
            </span>
            <span className="text-xs text-[#94A3B8] whitespace-nowrap font-medium">
              {isLiveConnected ? 'Online • Live Sync' : 'Offline • Local Cache'}
            </span>
          </div>
        </div>

        {/* Center Section: Map Tools (Locate Me, Density Heatmap, Layers & Drawer) */}
        <div className="hidden md:inline-flex items-center bg-[#0C171C] border border-[#334B56] p-1 rounded-xl gap-1">
          {/* Locate Me */}
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
              isLocating
                ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/60 shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
            }`}
            title="High-precision GPS geolocation with corridor check"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-[#38BDF8]' : 'text-[#94A3B8]'}`} />
            <span className="whitespace-nowrap">{isLocating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          {/* Density Heatmap (Admin & Officer) */}
          {(userRole === 'admin' || userRole === 'officer') && (
            <button
              onClick={() => onToggleHeatmap(!showHeatmap)}
              className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                showHeatmap
                  ? 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
              }`}
              title="Toggle failure density heatmap & DBSCAN spatial clusters"
            >
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-[#FCA5A5] animate-pulse' : 'text-[#94A3B8]'}`} />
              <span className="whitespace-nowrap">Density Heatmap</span>
            </button>
          )}

          {/* Layers & Drawer Toggle */}
          <button
            onClick={onToggleSidebar}
            className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              sidebarOpen
                ? 'bg-[#1B2F38] text-[#F8FAFC] border border-[#334B56] shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
            }`}
            title="Toggle Layers & Analytics Drawer"
          >
            <Layers className={`w-3.5 h-3.5 ${sidebarOpen ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`} />
            <span className="whitespace-nowrap">Layers & Drawer</span>
          </button>
        </div>

        {/* Right Section: Action Buttons + Profile Menu */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Desktop [ + Propose Facility ] Button */}
          <button
            onClick={onToggleAddFacilityMode}
            className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap ${
              isAddFacilityMode
                ? 'bg-[#E05A47] hover:brightness-110 text-[#F8FAFC]'
                : 'bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC]'
            }`}
            title={
              userRole === 'officer'
                ? 'Register Government-sanctioned scheme asset by clicking on the map'
                : userRole === 'user'
                ? 'Propose a community facility for Panchayat verification'
                : 'Register and publish village asset directly to the live map'
            }
          >
            <Plus className={`w-4 h-4 ${isAddFacilityMode ? 'rotate-45' : ''}`} />
            <span>
              {isAddFacilityMode
                ? 'Cancel Placing'
                : userRole === 'officer'
                ? '+ Add Govt Scheme Asset'
                : userRole === 'user'
                ? '+ Propose Facility'
                : '+ Add Facility'}
            </span>
          </button>

          {/* Desktop [ ⚠️ Report Grievance ] Button */}
          <button
            onClick={onOpenGrievanceModal}
            className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-gradient-to-r from-[#D9534F] to-[#E05A47] hover:brightness-110 text-[#F8FAFC] shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Report citizen grievance with camera photo capture"
          >
            <AlertTriangle className="w-4 h-4 text-[#F8FAFC]" />
            <span>Report Grievance</span>
          </button>

          {/* Export Audit (Admin) */}
          {userRole === 'admin' && onOpenExportAuditModal && (
            <button
              onClick={onOpenExportAuditModal}
              className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Open Executive Panchayat Audit & Reporting Engine (PDF & CSV)"
            >
              <FileText className="w-4 h-4 text-[#38BDF8]" />
              <span className="hidden xl:inline">Export Audit</span>
            </button>
          )}

          {/* Export Worklist (Officer) */}
          {userRole === 'officer' && onOfficerExportWorklist && (
            <button
              onClick={onOfficerExportWorklist}
              className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Download Field Inspection Worklist PDF"
            >
              <ClipboardList className="w-4 h-4 text-[#38BDF8]" />
              <span className="hidden xl:inline">Export Worklist</span>
            </button>
          )}

          {/* Role Switcher Gateway */}
          <div className="relative shrink-0" ref={portalSwitcherRef}>
            <button
              onClick={() => setIsPortalSwitcherOpen(!isPortalSwitcherOpen)}
              className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#38BDF8]/40 shadow-sm transition cursor-pointer active:scale-95 whitespace-nowrap"
              title="Switch between Resident, Field Officer, and Panchayat Admin portals"
            >
              <span className="flex items-center">
                {getRoleIcon(userRole)}
              </span>
              <span className="hidden lg:inline">
                {userRole === 'admin'
                  ? 'Panchayat Admin'
                  : userRole === 'officer'
                  ? 'Field Officer'
                  : 'Resident View'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 ${
                  isPortalSwitcherOpen ? 'rotate-180 text-[#F8FAFC]' : ''
                }`}
              />
            </button>

            {/* Role Switcher Dropdown Menu */}
            {isPortalSwitcherOpen && (
              <div className="z-[9999] absolute right-0 mt-2 w-64 sm:w-72 bg-[#132228]/95 border border-[#334B56] rounded-xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-[#94A3B8] border-b border-[#334B56] flex items-center justify-between">
                  <span>Switch Portal</span>
                  <span className="text-[#38BDF8] font-mono text-[9px]">1-Click</span>
                </div>

                {AVAILABLE_ROLES.filter((r) => r.id !== userRole).map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      onPortalSwitch(role.id, role.label);
                      setIsPortalSwitcherOpen(false);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1B2F38] text-left transition cursor-pointer text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0C171C] border border-[#334B56] flex items-center justify-center flex-shrink-0">
                      {getRoleIcon(role.id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#F8FAFC]">{role.label}</div>
                      <div className="text-[10px] text-[#94A3B8] leading-snug mt-0.5 truncate">
                        {role.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Profile Menu Pill */}
          <div className="shrink-0 flex items-center">
            <UserProfileBadge onExportAudit={onOpenExportAuditModal} />
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
