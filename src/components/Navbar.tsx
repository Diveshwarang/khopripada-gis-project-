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
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import type { Role } from '../types/auth';
import { UserProfileBadge } from './UserProfileBadge';
import {
  subscribeOfflineSync,
  setSimulatedOfflineMode,
  type OfflineSyncState,
} from '../services/offlineSync';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

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
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

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
    { id: 'user', label: t('role_resident'), desc: t('role_resident_desc') },
    { id: 'officer', label: t('role_officer'), desc: t('role_officer_desc') },
    { id: 'admin', label: t('role_admin'), desc: t('role_admin_desc') },
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
    if (roleId === 'admin') return <Shield className="w-4 h-4 text-[#CC6346] dark:text-[#E05A47]" />;
    if (roleId === 'officer') return <ClipboardCheck className="w-4 h-4 text-[#55949F] dark:text-[#38BDF8]" />;
    return <User className="w-4 h-4 text-[#80A68A] dark:text-[#10B981]" />;
  };

  const getPanchayatId = (role: Role) => {
    if (role === 'admin') return t('role_admin_id');
    if (role === 'officer') return t('role_officer_id');
    return t('role_ward_01');
  };

  return (
    <>
      {/* 0. AMBIENT SYNC NOTIFICATION BANNER */}
      {syncState.syncNotification && (
        <div className="w-full z-[3000] bg-gradient-to-r from-[#55949F] to-[#80A68A] dark:from-[#0D9488] dark:to-[#10B981] text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 animate-bounce" />
          <span>{syncState.syncNotification}</span>
        </div>
      )}

      {/* 1. MOBILE TOP BAR (< 768px, HEIGHT: 56px / H-14) */}
      <header className="flex md:hidden h-14 w-full bg-white/95 dark:bg-[#132228]/95 backdrop-blur-md border-b border-[#D3DFD8] dark:border-[#334B56] px-2 items-center justify-between gap-1 z-[2000] flex-shrink-0 select-none transition-colors duration-200">
        {/* Left: Branding + Ambient Dot */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] flex items-center justify-center text-[#55949F] dark:text-[#38BDF8] shadow-xs shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#1C2927] dark:text-white tracking-wide shrink-0 leading-tight">
              Khopripada
            </span>
            {/* Mobile Ambient Connectivity Badge */}
            <button
              onClick={handleToggleOffline}
              className="flex items-center gap-1 text-[9px] font-mono tracking-wider transition active:scale-95 text-left cursor-pointer"
              title={effectivelyOnline ? 'Online (Tap to test offline)' : 'Offline (Tap to reconnect)'}
            >
              {effectivelyOnline ? (
                <span className="flex items-center gap-1 text-[#80A68A] dark:text-[#10B981] font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#80A68A] dark:bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#80A68A] dark:bg-[#10B981]" />
                  </span>
                  <span>{t('online_short')}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#F6AA6E] dark:text-[#F59E0B] font-bold animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F6AA6E] dark:bg-[#F59E0B] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F6AA6E] dark:bg-[#F59E0B]" />
                  </span>
                  <span>
                    {t('offline_short')}
                    {syncState.unsyncedCount > 0 ? ` (${syncState.unsyncedCount})` : ''}
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center: Clean Administrative Role Badge */}
        <button
          onClick={() => onOpenMobileSheet?.(mobileSheet === 'role' ? null : 'role')}
          className="min-h-[38px] flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] text-[#55949F] dark:text-[#38BDF8] text-[11px] font-medium tracking-wide cursor-pointer active:scale-95 transition shrink-0"
          title={`${getPanchayatId(userRole)} • Tap to switch portal`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#55949F] dark:bg-[#38BDF8]" />
          <span className="truncate max-w-[72px]">
            {userRole === 'admin' ? t('role_admin') : userRole === 'officer' ? t('role_officer') : t('role_resident')}
          </span>
          <span className="text-[9px] text-[#566E67] dark:text-slate-400 font-mono">▼</span>
        </button>

        {/* Right: Language Switcher, Theme Switcher & Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mobile Language Toggle */}
          <div className="inline-flex rounded-lg border border-[#D3DFD8] dark:border-[#334B56] bg-[#F4F6F5] dark:bg-black/20 p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={
                language === 'en'
                  ? 'px-1.5 py-1 rounded bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold transition shadow-xs'
                  : 'px-1.5 py-1 text-[#566E67] dark:text-slate-400'
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('mr')}
              className={
                language === 'mr'
                  ? 'px-1.5 py-1 rounded bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold transition shadow-xs'
                  : 'px-1.5 py-1 text-[#566E67] dark:text-slate-400'
              }
            >
              मराठी
            </button>
          </div>

          {/* Mobile Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl border border-[#D3DFD8] dark:border-[#334B56] bg-[#F4F6F5] dark:bg-[#1B2F38] text-[#1C2927] dark:text-[#F8FAFC] flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
            title={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-teal-700" />
            )}
          </button>

          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer ${
              isLocating
                ? 'bg-[#55949F]/20 border-[#55949F] text-[#55949F] dark:bg-[#38BDF8]/20 dark:border-[#38BDF8] dark:text-[#38BDF8]'
                : 'bg-[#F4F6F5] dark:bg-[#1B2F38] border-[#D3DFD8] dark:border-[#334B56] text-[#55949F] dark:text-[#38BDF8] hover:text-[#1C2927] dark:hover:text-[#F8FAFC]'
            }`}
            title={t('locate_me')}
            aria-label="Locate me on map"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onOpenMobileSheet?.(mobileSheet === 'layers' ? null : 'layers')}
            className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer ${
              mobileSheet === 'layers'
                ? 'bg-[#55949F]/20 border-[#55949F] text-[#55949F] dark:bg-[#38BDF8]/20 dark:border-[#38BDF8] dark:text-[#38BDF8]'
                : 'bg-[#F4F6F5] dark:bg-[#1B2F38] border-[#D3DFD8] dark:border-[#334B56] text-[#55949F] dark:text-[#38BDF8] hover:text-[#1C2927] dark:hover:text-[#F8FAFC]'
            }`}
            title={t('layers_and_drawer')}
            aria-label="Toggle layers bottom sheet"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {onMobileLogout && (
            <button
              onClick={onMobileLogout}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-[#CC6346]/15 hover:bg-[#CC6346]/30 dark:bg-[#E05A47]/15 dark:hover:bg-[#E05A47]/30 border border-[#CC6346]/40 dark:border-[#E05A47]/40 text-[#CC6346] dark:text-[#FCA5A5] hover:text-[#1C2927] dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition"
              title={t('sign_out')}
              aria-label="Sign Out Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. DESKTOP TOP NAVIGATION BAR (>= 768px, EXACT H-16 UNIFIED GRID) */}
      <header className="hidden md:flex h-16 w-full px-5 lg:px-6 bg-white/95 dark:bg-[#132228]/95 backdrop-blur-md border-b border-[#D3DFD8] dark:border-[#334B56] items-center justify-between gap-3 lg:gap-4 z-[2000] flex-shrink-0 select-none transition-colors duration-200">
        
        {/* Left Section: Branding + Subtitle Badge + Ambient Offline Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] flex items-center justify-center text-[#55949F] dark:text-[#38BDF8] shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex items-center">
            <span className="text-lg font-bold text-[#1C2927] dark:text-[#F8FAFC] tracking-wide whitespace-nowrap">
              {t('smart_village_gis')}
            </span>
            <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-md bg-[#EBF2EE] dark:bg-[#1B2F38] text-[#55949F] dark:text-[#38BDF8] border border-[#D3DFD8] dark:border-[#38BDF8]/40 ml-2 whitespace-nowrap">
              {t('village_title')}
            </span>
          </div>

          {/* Desktop Ambient Connectivity Badge */}
          <div
            onClick={handleToggleOffline}
            className="hidden xl:flex items-center gap-2 pl-3 border-l border-[#D3DFD8] dark:border-[#334B56] cursor-pointer hover:opacity-85 transition select-none"
            title={
              effectivelyOnline
                ? 'Online • Live Sync active (Click to test offline cache)'
                : 'Offline mode active (Click to re-enable live network sync)'
            }
          >
            {effectivelyOnline ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#80A68A] dark:bg-[#10B981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#80A68A] dark:bg-[#10B981] shadow-[0_0_8px_#80A68A]" />
                </span>
                <span className="text-xs text-[#80A68A] dark:text-[#10B981] whitespace-nowrap font-bold tracking-wide">
                  {t('online_sync')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F6AA6E] dark:bg-[#F59E0B] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F6AA6E] dark:bg-[#F59E0B] shadow-[0_0_8px_#F6AA6E]" />
                </span>
                <span className="text-xs text-[#F6AA6E] dark:text-[#F59E0B] whitespace-nowrap font-bold tracking-wide">
                  {t('offline_cache')}
                </span>
                {syncState.unsyncedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#F6AA6E]/20 dark:bg-[#F59E0B]/20 border border-[#F6AA6E]/60 dark:border-[#F59E0B]/60 text-[#F6AA6E] dark:text-[#FCD34D] text-[10px] font-mono font-bold">
                    {syncState.unsyncedCount} {t('unsynced')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Map Tools (Locate Me, Density Heatmap, Layers & Drawer) */}
        <div className="hidden md:inline-flex items-center bg-[#F4F6F5] dark:bg-[#0C171C] border border-[#D3DFD8] dark:border-[#334B56] p-1 rounded-xl gap-1">
          {/* Locate Me */}
          <button
            onClick={onLocateMe}
            disabled={isLocating}
            className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
              isLocating
                ? 'bg-[#55949F]/20 text-[#55949F] dark:bg-[#38BDF8]/20 dark:text-[#38BDF8] border border-[#55949F]/60 dark:border-[#38BDF8]/60 shadow-xs'
                : 'text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-[#F8FAFC] hover:bg-[#EBF2EE] dark:hover:bg-[#1B2F38] border border-transparent'
            }`}
            title="High-precision GPS geolocation with corridor check"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-[#55949F] dark:text-[#38BDF8]' : 'text-[#566E67] dark:text-[#94A3B8]'}`} />
            <span className="whitespace-nowrap">{isLocating ? t('locating') : t('locate_me')}</span>
          </button>

          {/* Density Heatmap (Admin & Officer) */}
          {(userRole === 'admin' || userRole === 'officer') && (
            <button
              onClick={() => onToggleHeatmap(!showHeatmap)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                showHeatmap
                  ? 'bg-[#CC6346]/20 text-[#CC6346] dark:bg-[#E05A47]/20 dark:text-[#FCA5A5] border border-[#CC6346]/60 dark:border-[#E05A47]/60 shadow-xs'
                  : 'text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-[#F8FAFC] hover:bg-[#EBF2EE] dark:hover:bg-[#1B2F38] border border-transparent'
              }`}
              title="Toggle failure density heatmap"
            >
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-[#CC6346] dark:text-[#E05A47] animate-pulse' : 'text-[#566E67] dark:text-[#94A3B8]'}`} />
              <span className="whitespace-nowrap">{t('heatmap')}</span>
            </button>
          )}

          {/* Layers & Drawer Toggle */}
          <button
            onClick={onToggleSidebar}
            className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              sidebarOpen
                ? 'bg-[#EBF2EE] dark:bg-[#1B2F38] text-[#1C2927] dark:text-[#F8FAFC] border border-[#D3DFD8] dark:border-[#334B56] shadow-xs'
                : 'text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-[#F8FAFC] hover:bg-[#EBF2EE] dark:hover:bg-[#1B2F38] border border-transparent'
            }`}
            title="Toggle Layers & Analytics Drawer"
          >
            <Layers className={`w-3.5 h-3.5 ${sidebarOpen ? 'text-[#55949F] dark:text-[#38BDF8]' : 'text-[#566E67] dark:text-[#94A3B8]'}`} />
            <span className="whitespace-nowrap">{t('layers_and_drawer')}</span>
          </button>
        </div>

        {/* Right Section: Language Toggle, Theme Switcher, Action Buttons + Profile Menu */}
        <div className="flex items-center gap-2.5 lg:gap-3 shrink-0">
          
          {/* 1. Language Toggle Switch (Desktop) */}
          <div className="inline-flex rounded-lg border border-[#D3DFD8] dark:border-[#334B56] bg-[#F4F6F5] dark:bg-black/20 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={
                language === 'en'
                  ? 'px-2 py-1 rounded bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold transition shadow-xs'
                  : 'px-2 py-1 text-[#566E67] dark:text-slate-400 hover:text-[#1C2927] dark:hover:text-white transition'
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('mr')}
              className={
                language === 'mr'
                  ? 'px-2 py-1 rounded bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold transition shadow-xs'
                  : 'px-2 py-1 text-[#566E67] dark:text-slate-400 hover:text-[#1C2927] dark:hover:text-white transition'
              }
            >
              मराठी
            </button>
          </div>

          {/* 2. Light/Dark Mode Toggle Button (Desktop) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl border border-[#D3DFD8] dark:border-[#334B56] bg-[#F4F6F5] dark:bg-[#1B2F38] text-[#1C2927] dark:text-[#F8FAFC] hover:border-[#55949F] dark:hover:border-[#38BDF8] flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs shrink-0"
            title={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-teal-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Desktop [ + Propose Facility ] Button */}
          <button
            onClick={onToggleAddFacilityMode}
            className={`h-10 px-3.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap ${
              isAddFacilityMode
                ? 'bg-[#CC6346] dark:bg-[#E05A47] hover:brightness-110 text-white'
                : 'bg-gradient-to-r from-[#55949F] to-[#80A68A] dark:from-[#0D9488] dark:to-[#10B981] hover:brightness-105 text-white'
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
                ? t('cancel_placing')
                : userRole === 'officer'
                ? t('add_scheme_asset')
                : userRole === 'user'
                ? `+ ${t('propose_facility')}`
                : t('add_facility')}
            </span>
          </button>

          {/* Desktop [ ⚠️ Report Grievance ] Button */}
          <button
            onClick={onOpenGrievanceModal}
            className="h-10 px-3.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-gradient-to-r from-[#CC6346] to-[#CC6346]/90 dark:from-[#D9534F] dark:to-[#E05A47] hover:brightness-105 text-white shadow-md transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Report citizen grievance with camera photo capture"
          >
            <AlertTriangle className="w-4 h-4 text-white" />
            <span>{t('report_issue')}</span>
          </button>

          {/* Export Audit (Admin) */}
          {userRole === 'admin' && onOpenExportAuditModal && (
            <button
              onClick={onOpenExportAuditModal}
              className="h-10 px-3.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#F4F6F5] dark:bg-[#1B2F38] hover:bg-[#EBF2EE] dark:hover:bg-[#233B46] text-[#1C2927] dark:text-[#F8FAFC] border border-[#D3DFD8] dark:border-[#334B56] shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Open Executive Panchayat Audit & Reporting Engine (PDF & CSV)"
            >
              <FileText className="w-4 h-4 text-[#55949F] dark:text-[#38BDF8]" />
              <span className="hidden xl:inline">{t('export_audit')}</span>
            </button>
          )}

          {/* Export Worklist (Officer) */}
          {userRole === 'officer' && onOfficerExportWorklist && (
            <button
              onClick={onOfficerExportWorklist}
              className="h-10 px-3.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#F4F6F5] dark:bg-[#1B2F38] hover:bg-[#EBF2EE] dark:hover:bg-[#233B46] text-[#1C2927] dark:text-[#F8FAFC] border border-[#D3DFD8] dark:border-[#334B56] shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Download Field Inspection Worklist PDF"
            >
              <ClipboardList className="w-4 h-4 text-[#55949F] dark:text-[#38BDF8]" />
              <span className="hidden xl:inline">{t('export_worklist')}</span>
            </button>
          )}

          {/* Role Switcher Gateway */}
          <div className="relative shrink-0" ref={portalSwitcherRef}>
            <button
              onClick={() => setIsPortalSwitcherOpen(!isPortalSwitcherOpen)}
              className="h-10 px-3.5 lg:px-4 rounded-xl text-xs lg:text-sm font-semibold inline-flex items-center justify-center gap-2 flex-shrink-0 bg-[#F4F6F5] dark:bg-[#1B2F38] hover:bg-[#EBF2EE] dark:hover:bg-[#233B46] text-[#1C2927] dark:text-[#F8FAFC] border border-[#D3DFD8] dark:border-[#38BDF8]/40 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
              title="Switch between Resident, Field Officer, and Panchayat Admin portals"
            >
              <span className="flex items-center">
                {getRoleIcon(userRole)}
              </span>
              <span className="hidden lg:inline">
                {userRole === 'admin'
                  ? t('role_admin')
                  : userRole === 'officer'
                  ? t('role_officer')
                  : t('role_resident')}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#566E67] dark:text-[#94A3B8] transition-transform duration-200 ${
                  isPortalSwitcherOpen ? 'rotate-180 text-[#1C2927] dark:text-[#F8FAFC]' : ''
                }`}
              />
            </button>

            {/* Role Switcher Dropdown Menu */}
            {isPortalSwitcherOpen && (
              <div className="z-[9999] absolute right-0 mt-2 w-64 sm:w-72 bg-white/98 dark:bg-[#132228]/95 border border-[#D3DFD8] dark:border-[#334B56] rounded-xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 text-[#1C2927] dark:text-[#F8FAFC]">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-[#566E67] dark:text-[#94A3B8] border-b border-[#D3DFD8] dark:border-[#334B56] flex items-center justify-between">
                  <span>{t('switch_portal')}</span>
                  <span className="text-[#55949F] dark:text-[#38BDF8] font-mono text-[9px]">1-Click</span>
                </div>

                {AVAILABLE_ROLES.filter((r) => r.id !== userRole).map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      onPortalSwitch(role.id, role.label);
                      setIsPortalSwitcherOpen(false);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#F4F6F5] dark:hover:bg-[#1B2F38] text-left transition cursor-pointer text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#EBF2EE] dark:bg-[#0C171C] border border-[#D3DFD8] dark:border-[#334B56] flex items-center justify-center flex-shrink-0">
                      {getRoleIcon(role.id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#1C2927] dark:text-[#F8FAFC]">{role.label}</div>
                      <div className="text-[10px] text-[#566E67] dark:text-[#94A3B8] leading-snug mt-0.5 truncate">
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
