import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from '../lib/supabase';
import { db } from './offlineDb';
import { normalizeIssue, normalizeFacility } from './dataService';

export interface OfflineOutboxItem {
  id?: number;
  type: 'grievance' | 'facility';
  action: 'create' | 'update';
  payload: any;
  timestamp: number;
  synced: boolean;
  retries?: number;
  error?: string;
}

const DB_NAME = 'khopripada-offline-sync-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'offline_outbox';
export const TILE_CACHE_NAME = 'khopripada-map-tiles-v1';

let idbPromise: Promise<IDBPDatabase> | null = null;

export const getSyncDb = (): Promise<IDBPDatabase> => {
  if (!idbPromise) {
    idbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      },
    });
  }
  return idbPromise;
};

// Application Online / Offline / Outbox State
export interface OfflineSyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  unsyncedCount: number;
  syncNotification: string | null;
}

let simulatedOffline = false;
let syncNotificationMsg: string | null = null;
let notificationTimeout: any = null;
const listeners = new Set<(state: OfflineSyncState) => void>();

export const isEffectiveOnline = (): boolean => {
  return navigator.onLine && !simulatedOffline;
};

export const setSimulatedOfflineMode = (simulated: boolean) => {
  simulatedOffline = simulated;
  notifyListeners();
  if (isEffectiveOnline()) {
    drainOfflineOutbox();
  }
};

export const getSimulatedOfflineMode = (): boolean => simulatedOffline;

/**
 * Get count of pending unsynced items in IndexedDB outbox
 */
export const getUnsyncedCount = async (): Promise<number> => {
  try {
    const idb = await getSyncDb();
    const all = await idb.getAll(OUTBOX_STORE);
    return all.filter((item: OfflineOutboxItem) => !item.synced).length;
  } catch (err) {
    console.warn('Failed to query outbox count from idb, falling back to Dexie:', err);
    try {
      return await db.offline_grievances.where('synced').equals(0 as any).count();
    } catch {
      return 0;
    }
  }
};

/**
 * Notify all subscribed UI components
 */
const notifyListeners = async () => {
  const count = await getUnsyncedCount();
  const state: OfflineSyncState = {
    isOnline: isEffectiveOnline(),
    isSimulatedOffline: simulatedOffline,
    unsyncedCount: count,
    syncNotification: syncNotificationMsg,
  };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error('Error in sync listener:', e);
    }
  });
};

export const subscribeOfflineSync = (
  listener: (state: OfflineSyncState) => void
): (() => void) => {
  listeners.add(listener);
  // Send initial state immediately
  getUnsyncedCount().then((count) => {
    listener({
      isOnline: isEffectiveOnline(),
      isSimulatedOffline: simulatedOffline,
      unsyncedCount: count,
      syncNotification: syncNotificationMsg,
    });
  });

  return () => {
    listeners.delete(listener);
  };
};

export const clearSyncNotification = () => {
  syncNotificationMsg = null;
  notifyListeners();
};

/**
 * Enqueue a new grievance to IndexedDB offline outbox
 */
export const queueOfflineGrievance = async (
  grievanceData: any
): Promise<number | string> => {
  const timestamp = grievanceData.timestamp || Date.now();
  const rawId = grievanceData.id || timestamp;

  // 1. Save to IndexedDB (idb) outbox
  const idb = await getSyncDb();
  const outboxEntry: OfflineOutboxItem = {
    type: 'grievance',
    action: 'create',
    payload: {
      ...grievanceData,
      id: rawId,
      timestamp,
      synced: false,
    },
    timestamp,
    synced: false,
    retries: 0,
  };
  const outboxId = await idb.add(OUTBOX_STORE, outboxEntry);

  // 2. Also ensure it's in Dexie db.offline_grievances for instant local UI display
  try {
    const numId = typeof rawId === 'number' ? rawId : parseInt(String(rawId).replace(/\D/g, '') || '0', 10) || Date.now();
    await db.offline_grievances.put({
      id: numId,
      title: grievanceData.title || 'Untitled Grievance',
      category: (grievanceData.category || 'other') as any,
      severity: (grievanceData.severity || 'medium') as any,
      latitude: grievanceData.latitude || 19.35509,
      longitude: grievanceData.longitude || 72.88463,
      timestamp,
      synced: false,
      description: grievanceData.description || '',
      reporterName: grievanceData.reporterName || grievanceData.reporter_name || 'Resident',
      photoBase64: grievanceData.photoBase64 || grievanceData.photo_url || '',
      approval_status: grievanceData.approval_status || 'pending_approval',
      submitted_by: grievanceData.submitted_by || 'Resident',
      status: grievanceData.status || 'pending_initial_approval',
    });
  } catch (err) {
    console.error('Failed to sync to Dexie offline_grievances:', err);
  }

  notifyListeners();

  // 3. If online, attempt background drain immediately
  if (isEffectiveOnline()) {
    drainOfflineOutbox();
  }

  return Number(outboxId) || String(outboxId);
};

/**
 * Enqueue a new facility proposal to IndexedDB offline outbox
 */
export const queueOfflineFacility = async (
  facilityData: any
): Promise<number | string> => {
  const facility_id = facilityData.facility_id || `FAC_${Date.now()}`;
  const timestamp = Date.now();

  const idb = await getSyncDb();
  const outboxEntry: OfflineOutboxItem = {
    type: 'facility',
    action: 'create',
    payload: {
      ...facilityData,
      facility_id,
      timestamp,
    },
    timestamp,
    synced: false,
    retries: 0,
  };
  const outboxId = await idb.add(OUTBOX_STORE, outboxEntry);

  // Also write to Dexie for instant UI display
  try {
    await db.cached_facilities.put({
      facility_id,
      name: facilityData.name || 'Proposed Facility',
      category: facilityData.category || 'water',
      operational_status: facilityData.operational_status || 'functional',
      latitude: facilityData.latitude || 19.35509,
      longitude: facilityData.longitude || 72.88463,
      monsoon_accessible: facilityData.monsoon_accessible || 'Year-round',
      approval_status: facilityData.approval_status || 'pending_approval',
      submitted_by: facilityData.submitted_by || 'Resident Proposal',
      photoBase64: facilityData.photoBase64 || facilityData.photo_url,
      notes: facilityData.notes,
      upi_available: facilityData.upi_available,
    });
  } catch (err) {
    console.error('Failed to write to Dexie cached_facilities:', err);
  }

  notifyListeners();

  if (isEffectiveOnline()) {
    drainOfflineOutbox();
  }

  return Number(outboxId) || String(outboxId);
};

/**
 * Online Re-sync Pipeline:
 * Drains the offline_outbox table, pushes all pending records to Supabase,
 * updates local Dexie caches, and triggers the confirmation badge.
 */
let isDraining = false;

export const drainOfflineOutbox = async (): Promise<number> => {
  if (isDraining || !isEffectiveOnline()) {
    return 0;
  }

  isDraining = true;
  let syncedItemsCount = 0;

  try {
    const idb = await getSyncDb();
    const allOutbox: OfflineOutboxItem[] = await idb.getAll(OUTBOX_STORE);
    const pendingItems = allOutbox.filter((item) => !item.synced);

    if (pendingItems.length === 0) {
      isDraining = false;
      return 0;
    }

    console.log(`[OfflineSync] Draining ${pendingItems.length} records to Supabase...`);

    for (const item of pendingItems) {
      try {
        if (item.type === 'grievance') {
          const payload = item.payload;
          const canonical = normalizeIssue(payload);

          const { error } = await supabase.from('issues').upsert({
            title: canonical.title,
            category: canonical.category,
            severity: canonical.severity,
            status: canonical.status,
            latitude: canonical.latitude,
            longitude: canonical.longitude,
            description: canonical.description,
            notes: canonical.notes,
            reporter_name: canonical.reporter_name,
            submitted_by: canonical.submitted_by,
            photo_url: canonical.photo_url || canonical.photoBase64,
            approval_status: canonical.approval_status,
            created_at: canonical.created_at,
            updated_at: new Date().toISOString(),
          });

          if (!error) {
            // Remove from outbox
            if (item.id !== undefined) {
              await idb.delete(OUTBOX_STORE, item.id);
            }
            // Mark Dexie record as synced
            const numId = typeof canonical.id === 'number'
              ? canonical.id
              : parseInt(String(canonical.id).replace(/\D/g, '') || '0', 10);
            if (numId) {
              await db.offline_grievances.update(numId, { synced: true });
            }
            syncedItemsCount++;
          } else {
            console.warn('[OfflineSync] Supabase error syncing grievance:', error);
          }
        } else if (item.type === 'facility') {
          const payload = item.payload;
          const canonical = normalizeFacility(payload);

          const { error } = await supabase.from('facilities').upsert(
            {
              facility_id: canonical.facility_id,
              name: canonical.name,
              category: canonical.category,
              operational_status: canonical.operational_status,
              latitude: canonical.latitude,
              longitude: canonical.longitude,
              monsoon_accessible: canonical.monsoon_accessible,
              approval_status: canonical.approval_status,
              submitted_by: canonical.submitted_by,
              photo_url: canonical.photo_url || canonical.photoBase64,
              notes: canonical.notes,
              upi_available: canonical.upi_available,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'facility_id' }
          );

          if (!error) {
            if (item.id !== undefined) {
              await idb.delete(OUTBOX_STORE, item.id);
            }
            syncedItemsCount++;
          } else {
            console.warn('[OfflineSync] Supabase error syncing facility:', error);
          }
        }
      } catch (err) {
        console.error('[OfflineSync] Item sync failed, retaining in outbox:', err);
      }
    }

    if (syncedItemsCount > 0) {
      syncNotificationMsg = 'Sync complete • All offline updates pushed to Gram Panchayat cloud.';
      if (notificationTimeout) clearTimeout(notificationTimeout);
      notificationTimeout = setTimeout(() => {
        syncNotificationMsg = null;
        notifyListeners();
      }, 6000);
    }
  } catch (err) {
    console.error('[OfflineSync] Error during outbox drain:', err);
  } finally {
    isDraining = false;
    notifyListeners();
  }

  return syncedItemsCount;
};

/**
 * Pre-cache Leaflet map tiles covering the Khopripada AOI bounding box (zoom 13 to 17).
 * Caches all CartoDB / OpenStreetMap / satellite tile responses into dedicated cache: 'khopripada-map-tiles-v1'.
 */
export const precacheKhopripadaMapTiles = async (
  onProgress?: (loaded: number, total: number) => void
): Promise<{ loaded: number; total: number }> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { loaded: 0, total: 0 };
  }

  // Khopripada AOI Bounding Box
  const latMin = 19.345;
  const latMax = 19.370;
  const lngMin = 72.865;
  const lngMax = 72.890;

  const latLngToTile = (lat: number, lng: number, zoom: number) => {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
    return { x, y };
  };

  const tileUrls: string[] = [];

  for (let z = 13; z <= 17; z++) {
    const sw = latLngToTile(latMin, lngMin, z);
    const ne = latLngToTile(latMax, lngMax, z);

    const minX = Math.min(sw.x, ne.x);
    const maxX = Math.max(sw.x, ne.x);
    const minY = Math.min(sw.y, ne.y);
    const maxY = Math.max(sw.y, ne.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // 1. OpenStreetMap
        tileUrls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
        // 2. Esri World Imagery (Satellite)
        tileUrls.push(
          `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
        );
      }
    }
  }

  const total = tileUrls.length;
  let loaded = 0;

  try {
    const cache = await caches.open(TILE_CACHE_NAME);

    // Concurrently prefetch in batches of 6
    const batchSize = 6;
    for (let i = 0; i < tileUrls.length; i += batchSize) {
      const batch = tileUrls.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (url) => {
          try {
            const match = await cache.match(url);
            if (!match) {
              const res = await fetch(url, { mode: 'cors' });
              if (res.status === 200 || res.type === 'opaque') {
                await cache.put(url, res);
              }
            }
          } catch {
            // Silently continue for offline or unreachable tiles
          } finally {
            loaded++;
            if (onProgress) onProgress(loaded, total);
          }
        })
      );
    }
  } catch (err) {
    console.warn('[OfflineSync] Failed to prime tile cache:', err);
  }

  return { loaded, total };
};

// Auto-register window online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Online event detected. Auto-draining outbox...');
    notifyListeners();
    drainOfflineOutbox();
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Offline event detected. Local IndexedDB fallback active.');
    notifyListeners();
  });

  // Automatically prime tile cache in background after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      precacheKhopripadaMapTiles().then(({ loaded, total }) => {
        console.log(`[OfflineSync] Primed ${loaded}/${total} Leaflet map tiles for Khopripada AOI.`);
      });
    }, 2500);
  });
}
