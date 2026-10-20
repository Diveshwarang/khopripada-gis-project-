import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  CloudOff,
  Radio,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { db } from '../services/offlineDb';

interface NetworkStatusBarProps {
  onOpenGrievancesList?: () => void;
  isSimulatedOffline?: boolean;
  onToggleSimulateOffline?: () => void;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({
  onOpenGrievancesList,
  isSimulatedOffline = false,
  onToggleSimulateOffline,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [grievanceCount, setGrievanceCount] = useState<number>(0);
  const [networkType, setNetworkType] = useState<string>('');
  const [downlink, setDownlink] = useState<number | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read Network Information API if available
    const navConn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; addEventListener?: (event: string, cb: () => void) => void } }).connection;
    if (navConn) {
      if (navConn.effectiveType) setNetworkType(navConn.effectiveType.toUpperCase());
      if (navConn.downlink) setDownlink(navConn.downlink);

      const updateConn = () => {
        if (navConn.effectiveType) setNetworkType(navConn.effectiveType.toUpperCase());
        if (navConn.downlink) setDownlink(navConn.downlink);
      };

      if (navConn.addEventListener) {
        navConn.addEventListener('change', updateConn);
      }
    }

    // Subscribe to Dexie grievance count updates
    const updateGrievanceCount = async () => {
      try {
        const count = await db.offline_grievances.count();
        setGrievanceCount(count);
      } catch (e) {
        console.error('Failed to read grievance count:', e);
      }
    };

    updateGrievanceCount();
    const interval = setInterval(updateGrievanceCount, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const effectivelyOnline = isOnline && !isSimulatedOffline;

  return (
    <div
      className={`w-full z-[1001] px-4 py-1.5 flex items-center justify-between text-xs transition-colors border-b shadow-md backdrop-blur-md select-none ${
        effectivelyOnline
          ? 'bg-[#132228]/95 border-[#334B56] text-[#F8FAFC]'
          : 'bg-[#132228]/95 border-[#E05A47]/60 text-[#F8FAFC]'
      }`}
    >
      {/* Left: Connection Status Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {effectivelyOnline ? (
            <span className="flex items-center gap-1.5 font-semibold text-[#6EE7B7]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Online • Live Mapping</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-[#FCA5A5] animate-pulse">
              <WifiOff className="w-3.5 h-3.5 text-[#E05A47]" />
              <span>Offline Mode • Serving Cached Tiles & Local IndexedDB</span>
            </span>
          )}
        </div>

        {/* Network telemetry (if supported) */}
        {effectivelyOnline && (networkType || downlink) && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-[#94A3B8] bg-[#0C171C] px-2 py-0.5 rounded border border-[#334B56]">
            <Radio className="w-3 h-3 text-[#38BDF8]" />
            <span>{networkType || 'Broadband'}</span>
            {downlink && <span>• {downlink} Mbps</span>}
          </div>
        )}
      </div>

      {/* Right: IndexedDB Records & Actions */}
      <div className="flex items-center gap-3">
        {/* Offline Grievances Counter */}
        <button
          onClick={onOpenGrievancesList}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-[#F8FAFC] transition active:scale-95 cursor-pointer text-xs"
          title="Click to view local IndexedDB grievance records"
        >
          <Database className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span>Offline Grievances:</span>
          <span className="font-bold text-[#38BDF8] font-mono bg-[#0C171C] px-1.5 rounded border border-[#334B56]">
            {grievanceCount}
          </span>
        </button>

        {/* Offline Mode Test Toggle Button */}
        {onToggleSimulateOffline && (
          <button
            onClick={onToggleSimulateOffline}
            className={`hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition active:scale-95 cursor-pointer ${
              isSimulatedOffline
                ? 'bg-[#E05A47]/20 border-[#E05A47]/60 text-[#FCA5A5] font-medium'
                : 'bg-[#1B2F38] border-[#334B56] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
            title="Toggle simulated offline state to test caching and local operations"
          >
            {isSimulatedOffline ? <CloudOff className="w-3.5 h-3.5 text-[#FCA5A5]" /> : <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8]" />}
            <span>{isSimulatedOffline ? 'Simulating Offline' : 'Test Offline'}</span>
          </button>
        )}

        {/* Purge Cache & Hard Reload Button */}
        <button
          onClick={async () => {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                await registration.unregister();
              }
            }
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map((name) => caches.delete(name)));
            }
            window.location.reload();
          }}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[#E05A47]/60 bg-[#E05A47]/20 hover:bg-[#E05A47]/30 text-[#FCA5A5] transition active:scale-95 cursor-pointer"
          title="Force-clear Service Worker & tile cache, and reload latest code"
        >
          <RotateCcw className="w-3 h-3 text-[#FCA5A5]" />
          <span>Reset Cache</span>
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusBar;
