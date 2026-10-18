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
          ? 'bg-slate-900/90 border-emerald-500/30 text-slate-200'
          : 'bg-amber-950/90 border-amber-500/50 text-amber-100'
      }`}
    >
      {/* Left: Connection Status Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {effectivelyOnline ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span>Online • Live Mapping</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-amber-400 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode • Serving Cached Tiles & Local IndexedDB</span>
            </span>
          )}
        </div>

        {/* Network telemetry (if supported) */}
        {effectivelyOnline && (networkType || downlink) && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            <Radio className="w-3 h-3 text-emerald-400" />
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
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition active:scale-95 cursor-pointer text-xs"
          title="Click to view local IndexedDB grievance records"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Offline Grievances:</span>
          <span className="font-bold text-cyan-300 font-mono bg-cyan-950/80 px-1.5 rounded border border-cyan-500/40">
            {grievanceCount}
          </span>
        </button>

        {/* Offline Mode Test Toggle Button */}
        {onToggleSimulateOffline && (
          <button
            onClick={onToggleSimulateOffline}
            className={`hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition active:scale-95 cursor-pointer ${
              isSimulatedOffline
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-medium'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle simulated offline state to test caching and local operations"
          >
            {isSimulatedOffline ? <CloudOff className="w-3 h-3 text-amber-400" /> : <RefreshCw className="w-3 h-3" />}
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
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition active:scale-95 cursor-pointer"
          title="Force-clear Service Worker & tile cache, and reload latest code"
        >
          <RotateCcw className="w-3 h-3 text-rose-400" />
          <span>Reset Cache</span>
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusBar;
