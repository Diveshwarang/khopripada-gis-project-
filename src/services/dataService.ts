import { supabase } from '../lib/supabase';
import { db, seedIssuesFromCsv, seedFacilitiesFromCsv } from './offlineDb';
import type { CivicIssue, Facility } from '../types';

// Cross-tab broadcast channel for instantaneous local synchronization
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('panchayat-sync')
  : null;

/**
 * Normalizes an issue record from either Supabase or Dexie into the canonical CivicIssue schema
 */
export const normalizeIssue = (raw: any): CivicIssue => {
  const id = raw.id ?? raw.issue_id ?? `ISS_${Date.now()}`;
  return {
    id,
    issue_id: raw.issue_id || (typeof id === 'string' ? id : `ISS_${id}`),
    title: raw.title || 'Untitled Grievance',
    category: raw.category || 'other',
    severity: raw.severity || 'medium',
    status: raw.status || 'pending_initial_approval',
    latitude: typeof raw.latitude === 'number' ? raw.latitude : parseFloat(raw.latitude) || 19.3542,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : parseFloat(raw.longitude) || 72.8845,
    description: raw.description || raw.notes || '',
    notes: raw.notes || raw.description || '',
    reporter_name: raw.reporter_name || raw.reported_by || raw.reporterName || 'Citizen',
    reported_by: raw.reported_by || raw.reporter_name || raw.reporterName || 'Citizen',
    submitted_by: raw.submitted_by || 'Resident',
    photo_url: raw.photo_url || raw.photoBase64 || '',
    photoBase64: raw.photoBase64 || raw.photo_url || '',
    resolution_photo_url: raw.resolution_photo_url || '',
    officer_notes: raw.officer_notes || '',
    assigned_to: raw.assigned_to || '',
    verified_by: raw.verified_by || '',
    approval_status: raw.approval_status || (raw.status === 'resolved' || raw.status === 'under_inspection' ? 'approved' : 'pending_approval'),
    ai_priority_score: typeof raw.ai_priority_score === 'number' ? raw.ai_priority_score : undefined,
    ai_rank: typeof raw.ai_rank === 'number' ? raw.ai_rank : undefined,
    estimated_budget_inr: typeof raw.estimated_budget_inr === 'number' ? raw.estimated_budget_inr : undefined,
    ai_recommendation: raw.ai_recommendation || '',
    created_at: raw.created_at || (raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString()),
    updated_at: raw.updated_at || new Date().toISOString(),
    timestamp: raw.timestamp || (raw.created_at ? new Date(raw.created_at).getTime() : Date.now()),
  };
};

/**
 * Normalizes a facility record into canonical Facility schema
 */
export const normalizeFacility = (raw: any): Facility => {
  const facility_id = raw.facility_id || raw.id || `FAC_${Date.now()}`;
  return {
    id: raw.id || facility_id,
    facility_id,
    name: raw.name || 'Unnamed Facility',
    category: raw.category || 'water',
    operational_status: raw.operational_status || 'functional',
    latitude: typeof raw.latitude === 'number' ? raw.latitude : parseFloat(raw.latitude) || 19.3542,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : parseFloat(raw.longitude) || 72.8845,
    monsoon_accessible: raw.monsoon_accessible || 'Year-round',
    upi_available: Boolean(raw.upi_available),
    notes: raw.notes || '',
    photo_url: raw.photo_url || raw.photoBase64 || '',
    photoBase64: raw.photoBase64 || raw.photo_url || '',
    approval_status: raw.approval_status || 'approved',
    status: raw.status || raw.operational_status || 'functional',
    submitted_by: raw.submitted_by || 'Admin',
    verified_by: raw.verified_by || '',
    business_hours: raw.business_hours || '',
    service_type: raw.service_type || '',
    health_services: raw.health_services || '',
    operational_hours: raw.operational_hours || '',
    grade_levels: raw.grade_levels || '',
    midday_meal_available: Boolean(raw.midday_meal_available || raw.midday_meal),
    drinking_water_available: Boolean(raw.drinking_water_available || raw.filtered_water),
    water_supply_timings: raw.water_supply_timings || raw.supply_timings || '',
    water_potability: raw.water_potability || raw.potability_status || '',
    maintenance_authority: raw.maintenance_authority || '',
    community_usage: raw.community_usage || '',
    seating_capacity: raw.seating_capacity || '',
    lighting_fixture_type: raw.lighting_fixture_type || raw.fixture_type || '',
    power_grid_feeder: raw.power_grid_feeder || raw.power_grid || '',
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
};

/**
 * Fetch all Civic Issues:
 * Queries Supabase first. If Supabase succeeds, caches records to Dexie.
 * If offline or Supabase error occurs, smoothly falls back to Dexie.
 */
export const fetchIssues = async (): Promise<CivicIssue[]> => {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const canonical = data.map(normalizeIssue);
      // Asynchronously backup to local Dexie for offline support
      for (const item of canonical) {
        db.offline_grievances.put({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id).replace(/\D/g, '') || '0', 10) || undefined,
          title: item.title,
          category: item.category as any,
          severity: item.severity as any,
          latitude: item.latitude,
          longitude: item.longitude,
          timestamp: item.timestamp || Date.now(),
          synced: true,
          description: item.description,
          reporterName: item.reporter_name,
          photoBase64: item.photoBase64,
          approval_status: item.approval_status,
          submitted_by: item.submitted_by,
          status: item.status,
        }).catch(() => {});
      }
      return canonical;
    }
  } catch (err) {
    console.warn('Supabase fetchIssues unavailable, falling back to local storage:', err);
  }

  // Fallback to local Dexie storage
  const offlineRecords = await db.offline_grievances.reverse().toArray();
  if (offlineRecords.length > 0) {
    return offlineRecords.map(normalizeIssue);
  }

  // Fallback to seeded issues from CSV
  const seeded = await seedIssuesFromCsv(false);
  return seeded.map(normalizeIssue);
};

/**
 * Upserts a Civic Issue into Supabase and local Dexie, and broadcasts the change in real-time
 */
export const upsertIssue = async (issueData: Partial<CivicIssue>): Promise<CivicIssue> => {
  const normalized = normalizeIssue(issueData);

  // 1. Save to local Dexie immediately for zero-latency UI
  try {
    const numId = typeof normalized.id === 'number'
      ? normalized.id
      : parseInt(String(normalized.id).replace(/\D/g, ''), 10) || Date.now();

    await db.offline_grievances.put({
      id: numId,
      title: normalized.title,
      category: normalized.category as any,
      severity: normalized.severity as any,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      timestamp: normalized.timestamp || Date.now(),
      synced: false,
      description: normalized.description,
      reporterName: normalized.reporter_name,
      photoBase64: normalized.photoBase64,
      approval_status: normalized.approval_status,
      submitted_by: normalized.submitted_by,
      status: normalized.status,
    });
  } catch (err) {
    console.error('Failed to cache issue to Dexie:', err);
  }

  // 2. Broadcast via BroadcastChannel for instant cross-tab / cross-window sync
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type: 'ISSUE_UPDATED',
        issue: normalized,
      });
    } catch {}
  }

  // 3. Upsert to Supabase
  try {
    const payload: any = {
      title: normalized.title,
      category: normalized.category,
      severity: normalized.severity,
      status: normalized.status,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      description: normalized.description,
      notes: normalized.notes,
      reporter_name: normalized.reporter_name,
      submitted_by: normalized.submitted_by,
      photo_url: normalized.photo_url || normalized.photoBase64,
      resolution_photo_url: normalized.resolution_photo_url,
      officer_notes: normalized.officer_notes,
      assigned_to: normalized.assigned_to,
      verified_by: normalized.verified_by,
      approval_status: normalized.approval_status,
      updated_at: new Date().toISOString(),
    };

    if (normalized.id && typeof normalized.id === 'string' && !normalized.id.startsWith('ISS_')) {
      payload.id = normalized.id;
    }

    const { data, error } = await supabase
      .from('issues')
      .upsert(payload)
      .select()
      .single();

    if (!error && data) {
      return normalizeIssue(data);
    }
  } catch (err) {
    console.warn('Supabase upsertIssue failed (queued in Dexie):', err);
  }

  return normalized;
};

/**
 * Fetch all Facilities:
 * Queries Supabase first. If offline, falls back to Dexie / CSV cache.
 */
export const fetchFacilities = async (): Promise<Facility[]> => {
  try {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const canonical = data.map(normalizeFacility);
      for (const item of canonical) {
        db.cached_facilities.put({
          facility_id: item.facility_id,
          name: item.name,
          category: item.category,
          operational_status: item.operational_status,
          latitude: item.latitude,
          longitude: item.longitude,
          monsoon_accessible: item.monsoon_accessible || 'Year-round',
          approval_status: item.approval_status,
          submitted_by: item.submitted_by,
          photoBase64: item.photoBase64,
          photo_url: item.photo_url,
          notes: item.notes,
          upi_available: item.upi_available,
        }).catch(() => {});
      }
      return canonical;
    }
  } catch (err) {
    console.warn('Supabase fetchFacilities unavailable, falling back to local storage:', err);
  }

  const cached = await db.cached_facilities.toArray();
  if (cached.length > 0) {
    return cached.map(normalizeFacility);
  }

  const seeded = await seedFacilitiesFromCsv(false);
  return seeded.map(normalizeFacility);
};

/**
 * Upserts a Facility into Supabase and local Dexie, and broadcasts the change in real-time
 */
export const upsertFacility = async (facilityData: Partial<Facility>): Promise<Facility> => {
  const normalized = normalizeFacility(facilityData);

  try {
    await db.cached_facilities.put({
      facility_id: normalized.facility_id,
      name: normalized.name,
      category: normalized.category,
      operational_status: normalized.operational_status,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      monsoon_accessible: normalized.monsoon_accessible || 'Year-round',
      approval_status: normalized.approval_status,
      submitted_by: normalized.submitted_by,
      photoBase64: normalized.photoBase64,
      photo_url: normalized.photo_url,
      notes: normalized.notes,
      upi_available: normalized.upi_available,
      business_hours: normalized.business_hours,
      service_type: normalized.service_type,
      health_services: normalized.health_services,
      operational_hours: normalized.operational_hours,
      grade_levels: normalized.grade_levels,
      midday_meal_available: normalized.midday_meal_available,
      drinking_water_available: normalized.drinking_water_available,
      water_supply_timings: normalized.water_supply_timings,
      water_potability: normalized.water_potability,
      maintenance_authority: normalized.maintenance_authority,
      community_usage: normalized.community_usage,
      seating_capacity: normalized.seating_capacity,
      lighting_fixture_type: normalized.lighting_fixture_type,
      power_grid_feeder: normalized.power_grid_feeder,
    });
  } catch (err) {
    console.error('Failed to cache facility to Dexie:', err);
  }

  if (syncChannel) {
    try {
      syncChannel.postMessage({
        type: 'FACILITY_UPDATED',
        facility: normalized,
      });
    } catch {}
  }

  try {
    const payload: any = {
      facility_id: normalized.facility_id,
      name: normalized.name,
      category: normalized.category,
      operational_status: normalized.operational_status,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      monsoon_accessible: normalized.monsoon_accessible,
      approval_status: normalized.approval_status,
      submitted_by: normalized.submitted_by,
      photo_url: normalized.photo_url || normalized.photoBase64,
      notes: normalized.notes,
      upi_available: normalized.upi_available,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('facilities')
      .upsert(payload, { onConflict: 'facility_id' })
      .select()
      .single();

    if (!error && data) {
      return normalizeFacility(data);
    }
  } catch (err) {
    console.warn('Supabase upsertFacility failed (cached locally):', err);
  }

  return normalized;
};

/**
 * Multi-Tier State Machine Transitions:
 */

// Step 2: Admin reviews resident submission and assigns to Field Officer
export const transitionToAssignedForInspection = async (
  issueId: string | number,
  officerName = 'Field Officer Rahul'
): Promise<CivicIssue> => {
  return await upsertIssue({
    id: issueId,
    status: 'assigned_for_inspection',
    assigned_to: officerName,
    approval_status: 'approved',
  });
};

// Step 3: Field Officer taps "Start Field Inspection", requesting Admin sign-off
export const transitionToInspectionVerification = async (
  issueId: string | number,
  officerNotes?: string
): Promise<CivicIssue> => {
  return await upsertIssue({
    id: issueId,
    status: 'pending_inspection_verification',
    officer_notes: officerNotes || 'Officer requested inspection authorization.',
  });
};

// Step 4: Admin authorizes inspection phase; marker renders AMBER on live map across all devices
export const transitionToUnderInspection = async (
  issueId: string | number,
  adminName = 'Sarpanch Executive'
): Promise<CivicIssue> => {
  return await upsertIssue({
    id: issueId,
    status: 'under_inspection',
    verified_by: adminName,
    approval_status: 'approved',
  });
};

// Step 5: Field Officer uploads repair proof photo and notes
export const transitionToResolutionApproval = async (
  issueId: string | number,
  resolutionPhoto: string,
  officerNotes: string,
  officerName = 'Field Officer'
): Promise<CivicIssue> => {
  return await upsertIssue({
    id: issueId,
    status: 'pending_resolution_approval',
    resolution_photo_url: resolutionPhoto,
    officer_notes: officerNotes,
    assigned_to: officerName,
  });
};

// Step 6: Admin verifies photo proof and marks officially resolved; marker turns GREEN across all devices
export const transitionToResolved = async (
  issueId: string | number,
  adminName = 'Sarpanch Executive'
): Promise<CivicIssue> => {
  return await upsertIssue({
    id: issueId,
    status: 'resolved',
    verified_by: adminName,
    approval_status: 'approved',
  });
};

/**
 * Attach Real-Time PostgreSQL and Cross-Tab Listeners
 */
export const subscribeToPanchayatSync = (
  onIssueChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', issue: CivicIssue) => void,
  onFacilityChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', facility: Facility) => void
) => {
  // 1. Supabase Postgres Realtime Subscription
  const channel = supabase
    .channel('panchayat-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, (payload) => {
      const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const target = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old);
      if (target) {
        onIssueChange(eventType, normalizeIssue(target));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, (payload) => {
      const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const target = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old);
      if (target) {
        onFacilityChange(eventType, normalizeFacility(target));
      }
    })
    .subscribe();

  // 2. Cross-Tab BroadcastChannel listener (provides instant cross-window sync)
  const handleBroadcast = (e: MessageEvent) => {
    if (!e.data) return;
    if (e.data.type === 'ISSUE_UPDATED' && e.data.issue) {
      onIssueChange('UPDATE', e.data.issue);
    } else if (e.data.type === 'FACILITY_UPDATED' && e.data.facility) {
      onFacilityChange('UPDATE', e.data.facility);
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  // Cleanup unsubscribe function
  return () => {
    supabase.removeChannel(channel);
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcast);
    }
  };
};
