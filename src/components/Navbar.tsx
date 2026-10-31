import React, { useState, useRef, useEffect } from 'react';
import {
  Locate,
  Flame,
  Layers,
  Plus,
  AlertTriangle,
  ChevronDown,
  User,
  Shield,
  ClipboardCheck,
  LogOut,
  Building2,
  FileText,
  BarChart3,
} from 'lucide-react';
import type { Role } from '../types/auth';
import {
  subscribeOfflineSync,
  setSimulatedOfflineMode,
  type OfflineSyncState,
} from '../services/offlineSync';

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
  facilityCount?: number;
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
  onPortalSwitch,
  onMobileLogout,
  onOpenMobileSheet,
  mobileSheet,
  facilityCount = 22,
}) => {
  const [isPortalSwitcherOpen, setIsPortalSwitcherOpen] = useState<boolean>(false);
  const portalSwitcherRef = useRef<HTMLDivElement>(null);

  const [syncState, setSyncState] = useState<OfflineSyncState>({
    isOnline: navigator.onLine && !isSimulatedOffline,
    isSimulatedOffline,
    unsyncedCount: 0,
    syncNotification: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeOfflineSync((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  const effectivelyOnline = isLiveConnected && syncState.isOnline && !isSimulatedOffline;

  const handleToggleOffline = () => {
    onToggleSimulatedOffline();
    setSimulatedOfflineMode(!isSimulatedOffline);
  };

  const AVAILABLE_ROLES: { id: Role; label: string; desc: string }[] = [
    { id: 'admin', label: 'Panchayat Executive', desc: 'Administrative Approvals & ML Decision Console' },
    { id: 'officer', label: 'Field Operations', desc: 'Task Execution & Ground Inspection Verification' },
    { id: 'user', label: 'Resident Portal', desc: 'Public Asset Registry & Grievance Reporting' },
  ];

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
    if (roleId === 'admin') return <Shield className="w-3.5 h-3.5 text-[#00E5FF]" />;
    if (roleId === 'officer') return <ClipboardCheck className="w-3.5 h-3.5 text-[#38BDF8]" />;
    return <User className="w-3.5 h-3.5 text-emerald-400" />;
  };

  const getRoleBadge = (roleId: Role) => {
    if (roleId === 'admin') return 'ADMIN';
    if (roleId === 'officer') return 'OFFICER';
    return 'RESIDENT';
  };

  return (
    <>
      {/* 1. MOBILE TOP BAR (< 768px, TACTICAL SLIM) */}
      <header className="flex md:hidden h-12 w-full bg-[#081018] text-[#F1F5F9] border-b border-[#1D3B52] px-3 items-center justify-between gap-1 z-[2000] flex-shrink-0 select-none shadow-md">
        {/* Left: Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleOffline}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0D1C2A] border border-[#1D3B52] text-[10px] font-mono text-[#8CB0C9] cursor-pointer"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${effectivelyOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{effectivelyOnline ? 'Online' : 'Offline'}</span>
          </button>
        </div>

        {/* Center: User Pill */}
        <button
          onClick={() => onOpenMobileSheet?.(mobileSheet === 'role' ? null : 'role')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0D1C2A] border border-[#1D3B52] text-xs font-semibold cursor-pointer active:scale-95 transition shrink-0 text-[#F1F5F9]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
          <span className="truncate max-w-[85px] text-xs">Rajesh Patil</span>
          <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-[#00E5FF]/20 text-[#00E5FF]">
            {getRoleBadge(userRole)}
          </span>
          <ChevronDown className="w-3 h-3 text-[#5A7C93]" />
        </button>

        {/* Right: Quick Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className="w-7 h-7 rounded-md border border-[#1D3B52] bg-[#0D1C2A] text-[#8CB0C9] flex items-center justify-center cursor-pointer active:scale-95"
            title="Locate Me"
          >
            <Locate className={`w-3.5 h-3.5 text-[#00E5FF] ${isLocating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onToggleSidebar()}
            className="w-7 h-7 rounded-md border border-[#1D3B52] bg-[#0D1C2A] text-[#8CB0C9] flex items-center justify-center cursor-pointer active:scale-95"
            title="Layers & Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {onMobileLogout && (
            <button
              onClick={onMobileLogout}
              className="w-7 h-7 rounded-md bg-red-950/40 border border-red-800/60 text-red-400 flex items-center justify-center cursor-pointer active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. DESKTOP TOP NAVIGATION BAR (>= 768px, DARK COMMAND-CENTER AESTHETIC) */}
      <header className="hidden md:flex h-12 w-full px-3 bg-[#081018] text-[#F1F5F9] border-b border-[#1D3B52] items-center justify-between gap-3 z-[2000] flex-shrink-0 select-none shadow-xl text-xs">
        
        {/* Left Section: Status pill & Scale/Metrics Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleToggleOffline}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0D1C2A] border border-[#1D3B52] hover:border-[#00E5FF]/40 transition cursor-pointer"
            title={effectivelyOnline ? 'Online - Live Mapping Active (Click to simulate offline)' : 'Offline - Cached Active (Click to reconnect)'}
          >
            <span className={`w-2 h-2 rounded-full ${effectivelyOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[#8CB0C9] font-mono text-[11px]">
              {effectivelyOnline ? 'Online • Live Mapping' : 'Offline • Cached'}
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-[#5A7C93] font-mono text-[11px] border-l border-[#1D3B52] pl-2.5">
            <span>Lat: 19.3551°N</span>
            <span className="text-[#1D3B52]">|</span>
            <span>Facilities: {facilityCount} mapped</span>
          </div>
        </div>

        {/* Center Section: Pill Action Buttons */}
        <div className="flex items-center gap-2">
          {/* User Pill with Role Badge */}
          <div className="relative shrink-0" ref={portalSwitcherRef}>
            <button
              onClick={() => setIsPortalSwitcherOpen(!isPortalSwitcherOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1C2A] border border-[#1D3B52] text-xs text-[#F1F5F9] hover:border-[#00E5FF]/60 transition cursor-pointer active:scale-95 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
              <span className="font-semibold text-xs tracking-tight">Rajesh Patil</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 uppercase">
                {getRoleBadge(userRole)}
              </span>
              <ChevronDown className={`w-3 h-3 text-[#5A7C93] transition-transform ${isPortalSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPortalSwitcherOpen && (
              <div className="z-[9999] absolute left-0 mt-2 w-64 bg-[#0D1C2A] border border-[#1D3B52] rounded-xl shadow-2xl p-2 flex flex-col gap-1 text-[#F1F5F9]">
                <div className="px-2 py-1 text-[10px] font-mono font-bold text-[#5A7C93] uppercase tracking-wider border-b border-[#1D3B52]/60">
                  Switch Portal Access
                </div>
                {AVAILABLE_ROLES.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      onPortalSwitch(role.id, role.label);
                      setIsPortalSwitcherOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left transition cursor-pointer text-xs ${
                      userRole === role.id
                        ? 'bg-[#142C3F] text-[#00E5FF] font-bold border border-[#00E5FF]/40'
                        : 'hover:bg-[#142C3F]/60 text-[#8CB0C9]'
                    }`}
                  >
                    {getRoleIcon(role.id)}
                    <div>
                      <div className="font-bold flex items-center gap-1 text-xs">
                        {role.label}
                        {userRole === role.id && <span className="text-[10px] text-emerald-400 font-normal">Active</span>}
                      </div>
                      <div className="text-[10px] text-[#5A7C93]">{role.desc}</div>
                    </div>
                  </button>
                ))}
                {onMobileLogout && (
                  <button
                    onClick={() => {
                      onMobileLogout();
                      setIsPortalSwitcherOpen(false);
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-950/40 text-left transition cursor-pointer text-xs text-red-400 border-t border-[#1D3B52]/60 mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <div className="font-bold">Sign Out</div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Density Heatmap Button (Bronze / Amber Pill) */}
          <button
            onClick={() => onToggleHeatmap(!showHeatmap)}
            className={`font-semibold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition cursor-pointer ${
              showHeatmap
                ? 'bg-[#F59E0B]/30 text-[#F59E0B] border border-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/50 hover:bg-[#F59E0B]/30'
            }`}
            title="Toggle Failure Density Heatmap"
          >
            <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Density Heatmap</span>
            {showHeatmap && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
            )}
          </button>

          {/* Locate Me Button (Outlined Slate Pill) */}
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className="bg-[#0D1C2A] text-[#8CB0C9] border border-[#1D3B52] hover:text-white hover:border-[#38BDF8]/60 px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
            title="Locate Current Position"
          >
            <Locate className={`w-3.5 h-3.5 text-[#00E5FF] ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          {/* + Add Facility (Cyan-Bordered Pill) */}
          <button
            onClick={onToggleAddFacilityMode}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm ${
              isAddFacilityMode
                ? 'bg-[#00E5FF] text-[#081018] font-bold shadow-[0_0_12px_rgba(0,229,255,0.5)]'
                : 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/40 hover:bg-[#00E5FF]/20'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 ${isAddFacilityMode ? 'rotate-45' : ''}`} />
            <span>{isAddFacilityMode ? 'Cancel' : '+ Add Facility'}</span>
          </button>

          {/* Report Grievance (Clean Amber/Red-Bordered Pill) */}
          <button
            onClick={onOpenGrievanceModal}
            className="bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/40 hover:bg-[#EF4444]/20 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Report Grievance</span>
          </button>

          {/* Export Audit (Compact Technical Outline Button) */}
          {onOpenExportAuditModal && (
            <button
              onClick={onOpenExportAuditModal}
              className="bg-[#0D1C2A] text-[#8CB0C9] border border-[#1D3B52] hover:text-white hover:border-[#8CB0C9] px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
              title="Export Official Panchayat Audit"
            >
              <FileText className="w-3.5 h-3.5 text-[#8CB0C9]" />
              <span className="hidden xl:inline">Export Audit</span>
            </button>
          )}

          {/* Layers & Operations Drawer Toggle */}
          <button
            onClick={onToggleSidebar}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm ${
              sidebarOpen
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                : 'bg-[#0D1C2A] text-[#8CB0C9] border border-[#1D3B52] hover:text-white'
            }`}
            title="Toggle Operations Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
          </button>
        </div>
      </header>
    </>
  );
};

export default Navbar;
