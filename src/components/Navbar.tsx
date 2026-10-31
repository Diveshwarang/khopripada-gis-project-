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
    if (roleId === 'admin') return <Shield className="w-3.5 h-3.5 text-[#E56A54]" />;
    if (roleId === 'officer') return <ClipboardCheck className="w-3.5 h-3.5 text-[#48999E]" />;
    return <User className="w-3.5 h-3.5 text-emerald-600" />;
  };

  const getRoleDisplay = (roleId: Role) => {
    if (roleId === 'admin') return 'Panchayat Executive';
    if (roleId === 'officer') return 'Field Operations';
    return 'Resident Portal';
  };

  return (
    <>
      {/* 1. MOBILE TOP BAR (< 768px) */}
      <header className="flex md:hidden h-14 w-full bg-white text-slate-800 border-b border-slate-200 px-3 items-center justify-between gap-1 z-[2000] flex-shrink-0 select-none shadow-xs">
        {/* Left: Brand Seal + Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#48999E] shadow-xs flex items-center justify-center text-white shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight text-slate-800">
              Smart Village GIS
            </span>
            <button
              onClick={handleToggleOffline}
              className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600 text-left cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{effectivelyOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>
          </div>
        </div>

        {/* Center: Role Indicator */}
        <button
          onClick={() => onOpenMobileSheet?.(mobileSheet === 'role' ? null : 'role')}
          className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-300 text-xs font-semibold cursor-pointer active:scale-95 transition shrink-0 text-slate-700"
        >
          {getRoleIcon(userRole)}
          <span className="truncate max-w-[85px]">
            {getRoleDisplay(userRole)}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Right: Quick Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className="w-8 h-8 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center cursor-pointer active:scale-95 shadow-xs"
            title="Locate Me"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onToggleSidebar()}
            className="w-8 h-8 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center cursor-pointer active:scale-95 shadow-xs"
            title="Layers & Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {onMobileLogout && (
            <button
              onClick={onMobileLogout}
              className="w-8 h-8 rounded-md bg-red-50 border border-red-200 text-red-600 flex items-center justify-center cursor-pointer active:scale-95 shadow-xs"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. DESKTOP TOP NAVIGATION BAR (>= 768px, CLEAN DASHBOARD AESTHETIC) */}
      <header className="hidden md:flex h-14 w-full px-4 bg-white text-slate-800 border-b border-slate-200 items-center justify-between gap-3 z-[2000] flex-shrink-0 select-none shadow-xs">
        
        {/* Left Brand Section */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#48999E] shadow-xs flex items-center justify-center text-white shrink-0">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
              Smart Village GIS
            </span>
            <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md font-medium whitespace-nowrap">
              Khopripada Digital Twin
            </span>
          </div>

          {/* Status Indicator */}
          <button
            onClick={handleToggleOffline}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wider text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
            title={effectivelyOnline ? 'Online - Live Sync Active (Click to simulate offline)' : 'Offline - Local Cache Active (Click to reconnect)'}
          >
            <span className={`w-2 h-2 rounded-full ${effectivelyOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{effectivelyOnline ? 'ONLINE · LIVE SYNC' : 'OFFLINE · CACHED'}</span>
          </button>
        </div>

        {/* Center Utility Cluster */}
        <div className="flex items-center gap-1.5">
          {/* [ Locate Me ] */}
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
              isLocating
                ? 'bg-slate-100 text-[#48999E] border-slate-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs'
            }`}
            title="Locate Current Position"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          {/* [ Problem Heatmap ] */}
          <button
            onClick={() => onToggleHeatmap(!showHeatmap)}
            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
              showHeatmap
                ? 'bg-orange-100 border-orange-400 text-orange-800 font-semibold shadow-xs'
                : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
            title="Toggle Failure Heatmap"
          >
            <Flame className="w-3.5 h-3.5 text-orange-600" />
            <span>Problem Heatmap</span>
            {showHeatmap && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
            )}
          </button>

          {/* [ Village Analytics ] - Admin & Officer Only */}
          {(userRole === 'admin' || userRole === 'officer') && (
            <button
              onClick={onToggleSidebar}
              className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                sidebarOpen
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs'
              }`}
              title="Toggle Village Analytics and Decision Support"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#48999E]" />
              <span>Village Analytics</span>
            </button>
          )}

          {/* [ Layers & Filters ] */}
          <button
            onClick={onToggleSidebar}
            className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
              sidebarOpen && userRole === 'user'
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs'
            }`}
            title="Toggle Map Layers and Amenity Filters"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>Layers & Filters</span>
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Primary Action: [ + Add Facility ] */}
          <button
            onClick={onToggleAddFacilityMode}
            className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap text-white ${
              isAddFacilityMode
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#48999E] hover:bg-[#3D858A]'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 ${isAddFacilityMode ? 'rotate-45' : ''}`} />
            <span>{isAddFacilityMode ? 'Cancel Placing' : '+ Add Facility'}</span>
          </button>

          {/* Urgent Action: [ Report Problem ] */}
          <button
            onClick={onOpenGrievanceModal}
            className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 bg-[#E56A54] hover:bg-[#D45943] text-white shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Report Problem</span>
          </button>

          {/* Audit Export: [ Export Audit ] */}
          {onOpenExportAuditModal && (
            <button
              onClick={onOpenExportAuditModal}
              className="h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition active:scale-95 cursor-pointer whitespace-nowrap shadow-xs"
              title="Export Official Panchayat Audit"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Audit</span>
            </button>
          )}

          {/* Role Indicator / Selector: [ Panchayat Executive ] */}
          <div className="relative shrink-0" ref={portalSwitcherRef}>
            <button
              onClick={() => setIsPortalSwitcherOpen(!isPortalSwitcherOpen)}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-white text-slate-800 border border-slate-300 hover:border-slate-400 transition cursor-pointer active:scale-95 shadow-xs"
            >
              {getRoleIcon(userRole)}
              <span className="hidden lg:inline">{getRoleDisplay(userRole)}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isPortalSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPortalSwitcherOpen && (
              <div className="z-[9999] absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 flex flex-col gap-1 text-slate-800">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
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
                        ? 'bg-slate-100 text-[#48999E] font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {getRoleIcon(role.id)}
                    <div>
                      <div className="font-bold flex items-center gap-1">
                        {role.label}
                        {userRole === role.id && <span className="text-[10px] text-emerald-600 font-normal">Active</span>}
                      </div>
                      <div className="text-[10px] text-slate-500">{role.desc}</div>
                    </div>
                  </button>
                ))}
                {onMobileLogout && (
                  <button
                    onClick={() => {
                      onMobileLogout();
                      setIsPortalSwitcherOpen(false);
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 text-left transition cursor-pointer text-xs text-red-600 border-t border-slate-100 mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <div className="font-bold">Sign Out</div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
