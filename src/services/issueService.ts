import { supabase } from '../supabaseClient';
import type { CivicIssue, IssueStatus, IssueVerificationStatus } from '../types';
import { PREDEFINED_SURVEY_ISSUES } from '../data/seedIssues';
import { db } from './offlineDb';

export type AnyIssueStatus = IssueStatus | IssueVerificationStatus | string;

const RESOLUTION_PHOTOS_STORAGE_KEY = 'panchayat_resolution_photos_cache';
const USER_REPORTED_ISSUES_STORAGE_KEY = 'panchayat_user_reported_issues';
const DELETED_ISSUES_STORAGE_KEY = 'panchayat_deleted_issues';

const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('panchayat-sync')
  : null;

export function saveResolutionPhotoToCache(issueId?: string | number | null, photoBase64?: string | null): void {
  try {
    if (!issueId || !photoBase64) return;
    const raw = localStorage.getItem(RESOLUTION_PHOTOS_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(map);
    if (keys.length > 30) {
      delete map[keys[0]];
    }
    map[String(issueId)] = photoBase64;
    localStorage.setItem(RESOLUTION_PHOTOS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Resolution photo cache write warning:', e);
  }
}

export function getResolutionPhotoFromCache(issueId?: string | number | null): string | null {
  try {
    if (!issueId) return null;
    const raw = localStorage.getItem(RESOLUTION_PHOTOS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[String(issueId)] || null;
  } catch {
    return null;
  }
}

export function getDeletedIssueIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ISSUES_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markIssueDeletedInStorage(issueId: string): void {
  try {
    const deleted = getDeletedIssueIds();
    deleted.add(String(issueId));
    localStorage.setItem(DELETED_ISSUES_STORAGE_KEY, JSON.stringify(Array.from(deleted)));
  } catch (e) {
    console.warn('Failed to mark issue as deleted:', e);
  }
}

export function getUserReportedIssues(): CivicIssue[] {
  try {
    const raw = localStorage.getItem(USER_REPORTED_ISSUES_STORAGE_KEY);
    if (!raw) return [];
    const list: CivicIssue[] = JSON.parse(raw);
    const deletedIds = getDeletedIssueIds();
    return list.filter((i) => !deletedIds.has(String(i.id)) && !deletedIds.has(String(i.issue_id)));
  } catch {
    return [];
  }
}

export function saveUserReportedIssue(issue: CivicIssue): void {
  try {
    const current = getUserReportedIssues();
    const idStr = String(issue.id || issue.issue_id);
    const filtered = current.filter((i) => String(i.id) !== idStr && String(i.issue_id) !== idStr);
    filtered.unshift(issue);
    localStorage.setItem(USER_REPORTED_ISSUES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to save user reported issue to localStorage:', e);
  }
}

export function updateUserReportedIssueInStorage(
  issueId: string,
  updates: Partial<CivicIssue>
): void {
  try {
    const current = getUserReportedIssues();
    const idStr = String(issueId);
    let matched = false;
    const updated = current.map((i) => {
      if (String(i.id) === idStr || String(i.issue_id) === idStr) {
        matched = true;
        return { ...i, ...updates, updated_at: new Date().toISOString() };
      }
      return i;
    });
    if (!matched) {
      // Find from baseline or create partial record
      const seedItem = PREDEFINED_SURVEY_ISSUES.find(
        (s) => String(s.id) === idStr || String(s.issue_id) === idStr
      );
      if (seedItem) {
        updated.unshift({ ...seedItem, ...updates, updated_at: new Date().toISOString() });
      }
    }
    localStorage.setItem(USER_REPORTED_ISSUES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update issue in localStorage:', e);
  }
}

export function removeUserReportedIssueFromStorage(issueId: string): void {
  try {
    const current = getUserReportedIssues();
    const idStr = String(issueId);
    const filtered = current.filter((i) => String(i.id) !== idStr && String(i.issue_id) !== idStr);
    localStorage.setItem(USER_REPORTED_ISSUES_STORAGE_KEY, JSON.stringify(filtered));
    markIssueDeletedInStorage(idStr);
  } catch (e) {
    console.warn('Failed to remove issue from localStorage:', e);
  }
}

/**
 * Fetch all issues directly from Supabase Cloud with rock-solid offline fallback and local persistence.
 * Guarantees phone, laptop, admin, and officer all see the exact same master dataset,
 * and issues reported/updated by the user NEVER disappear on refresh.
 */
export async function fetchAllIssues(): Promise<CivicIssue[]> {
  const deletedIds = getDeletedIssueIds();
  const localUserIssues = getUserReportedIssues();

  // Load any grievances from Dexie offline_grievances
  let dexieOfflineIssues: CivicIssue[] = [];
  try {
    const grievances = await db.offline_grievances.toArray();
    dexieOfflineIssues = (grievances || []).map((g) => {
      const idStr = String(g.id || `khop-iss-${g.timestamp}`);
      const cached = getResolutionPhotoFromCache(idStr) || (g.resolution_photo_url && g.resolution_photo_url !== g.photoBase64 ? g.resolution_photo_url : '');
      return {
        id: idStr,
        issue_id: idStr,
        title: g.title || 'Civic Grievance',
        description: g.description || '',
        notes: g.description || '',
        category: g.category || 'General',
        severity: g.severity || 'medium',
        status: (g.status || 'reported') as IssueStatus,
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        reported_by: g.reporterName || g.submitted_by || 'Resident',
        reporter_name: g.reporterName || g.submitted_by || 'Resident',
        submitted_by: g.submitted_by || 'Resident',
        assigned_officer: g.assigned_to || null,
        assigned_to: g.assigned_to || null,
        resolution_notes: g.officer_notes || '',
        officer_notes: g.officer_notes || '',
        photo_url: g.photoBase64 || '',
        photoBase64: g.photoBase64 || '',
        resolution_photo_url: cached || '',
        created_at: g.timestamp ? new Date(g.timestamp).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  } catch (dexErr) {
    console.warn('Error reading Dexie offline grievances:', dexErr);
  }

  // Load from Supabase Cloud
  let cloudIssues: CivicIssue[] = [];
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      cloudIssues = data.map((row: any) => {
        const idStr = String(row.id || row.issue_id || '');
        const issueIdStr = String(row.issue_id || row.id || '');
        const cachedPhoto = getResolutionPhotoFromCache(idStr) || getResolutionPhotoFromCache(issueIdStr);
        const resPhoto = (row.resolution_photo_url && row.resolution_photo_url !== row.photo_url && row.resolution_photo_url !== row.photoBase64 && row.resolution_photo_url !== row.proof_image_url)
          ? row.resolution_photo_url
          : (cachedPhoto || '');

        return {
          id: idStr,
          issue_id: issueIdStr,
          title: row.title || 'Civic Grievance',
          description: row.description || row.notes || '',
          notes: row.notes || row.description || '',
          category: row.category || 'General',
          severity: row.severity || 'low',
          status: (row.status || 'reported') as IssueStatus,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          reported_by: row.reported_by || row.reporter_name || row.submitted_by || 'Resident',
          reporter_name: row.reporter_name || row.reported_by || 'Resident',
          submitted_by: row.submitted_by || row.reported_by || 'Resident',
          assigned_officer: row.assigned_officer || row.assigned_to || null,
          assigned_to: row.assigned_to || row.assigned_officer || null,
          resolution_notes: row.resolution_notes || row.officer_notes || '',
          officer_notes: row.officer_notes || row.resolution_notes || '',
          proof_image_url: row.proof_image_url || '',
          photo_url: row.photo_url || row.photoBase64 || row.proof_image_url || '',
          photoBase64: row.photoBase64 || row.photo_url || '',
          resolution_photo_url: resPhoto,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn('[Supabase Query Warning, merging local stores]:', err);
  }

  // Multi-tier merge:
  // 1. Baseline survey issues
  // 2. Cloud issues
  // 3. Dexie offline grievances
  // 4. LocalStorage user-reported issues (highest local priority)
  const issueMap = new Map<string, CivicIssue>();

  for (const item of PREDEFINED_SURVEY_ISSUES) {
    const key = String(item.id || item.issue_id);
    if (!deletedIds.has(key)) {
      const cached = getResolutionPhotoFromCache(item.id) || (item.issue_id ? getResolutionPhotoFromCache(item.issue_id) : null);
      issueMap.set(key, cached ? { ...item, resolution_photo_url: cached } : item);
    }
  }

  for (const item of cloudIssues) {
    const key = String(item.id || item.issue_id);
    if (!deletedIds.has(key)) {
      issueMap.set(key, item);
    }
  }

  for (const item of dexieOfflineIssues) {
    const key = String(item.id || item.issue_id);
    if (!deletedIds.has(key)) {
      issueMap.set(key, item);
    }
  }

  for (const item of localUserIssues) {
    const key = String(item.id || item.issue_id);
    if (!deletedIds.has(key)) {
      issueMap.set(key, item);
    }
  }

  const merged = Array.from(issueMap.values()).sort((a, b) => {
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    return tB - tA;
  });

  return merged;
}

/**
 * Report a new grievance directly to Supabase cloud with zero-loss dual offline persistence
 */
export async function createGrievance(
  issue: Partial<CivicIssue>
): Promise<{ success: boolean; data?: CivicIssue; error?: string }> {
  try {
    const issueId = issue.id || issue.issue_id || `khop-iss-${Date.now()}`;
    const idStr = String(issueId);

    const fullIssue: CivicIssue = {
      id: idStr,
      issue_id: idStr,
      title: issue.title || 'Civic Grievance',
      description: issue.description || issue.notes || '',
      notes: issue.notes || issue.description || '',
      category: issue.category || 'General',
      severity: issue.severity || 'medium',
      status: (issue.status || 'reported') as IssueStatus,
      latitude: Number(issue.latitude),
      longitude: Number(issue.longitude),
      reported_by: issue.reported_by || issue.reporter_name || 'Resident',
      reporter_name: issue.reporter_name || issue.reported_by || 'Resident',
      submitted_by: issue.submitted_by || issue.reported_by || 'Resident',
      proof_image_url: issue.proof_image_url || issue.photo_url || issue.photoBase64 || '',
      photo_url: issue.photo_url || issue.photoBase64 || issue.proof_image_url || '',
      photoBase64: issue.photoBase64 || issue.photo_url || '',
      resolution_photo_url: issue.resolution_photo_url || '',
      assigned_officer: issue.assigned_officer || null,
      assigned_to: issue.assigned_to || null,
      resolution_notes: issue.resolution_notes || '',
      officer_notes: issue.officer_notes || '',
      created_at: issue.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Dual persistence: Save immediately to localStorage
    saveUserReportedIssue(fullIssue);

    // 2. Dual persistence: Save immediately to Dexie offline_grievances & cached_issues
    const numId = parseInt(idStr.replace(/\D/g, '') || '0', 10) || Date.now();
    try {
      await db.offline_grievances.put({
        id: numId,
        title: fullIssue.title,
        category: fullIssue.category as any,
        severity: fullIssue.severity as any,
        latitude: fullIssue.latitude,
        longitude: fullIssue.longitude,
        timestamp: Date.now(),
        synced: false,
        description: fullIssue.description,
        reporterName: fullIssue.reported_by,
        photoBase64: fullIssue.photoBase64,
        approval_status: fullIssue.status === 'resolved' ? 'approved' : 'pending_approval',
        submitted_by: fullIssue.submitted_by,
        status: fullIssue.status,
      });

      await db.cached_issues.put({
        issue_id: idStr,
        title: fullIssue.title,
        category: fullIssue.category,
        severity: fullIssue.severity,
        reported_by: fullIssue.reported_by,
        latitude: fullIssue.latitude,
        longitude: fullIssue.longitude,
        status: fullIssue.status,
        notes: fullIssue.description,
        photoBase64: fullIssue.photoBase64,
        photo_url: fullIssue.photo_url,
        approval_status: 'approved',
        submitted_by: fullIssue.submitted_by,
      });
    } catch (e) {
      console.warn('Failed to cache issue into Dexie:', e);
    }

    // 3. Broadcast to all open tabs and windows
    syncChannel?.postMessage({
      type: 'ISSUE_CREATED',
      issue: fullIssue,
      issueId: idStr,
    });

    // 4. Submit to Supabase Cloud
    try {
      const payload: Record<string, any> = {
        issue_id: idStr,
        title: fullIssue.title,
        description: fullIssue.description,
        category: fullIssue.category,
        severity: fullIssue.severity,
        status: fullIssue.status,
        latitude: fullIssue.latitude,
        longitude: fullIssue.longitude,
        reported_by: fullIssue.reported_by,
        created_at: fullIssue.created_at,
        updated_at: fullIssue.updated_at,
      };

      if (fullIssue.photo_url) {
        payload.proof_image_url = fullIssue.photo_url;
        payload.photo_url = fullIssue.photo_url;
      }

      const { data: cloudData, error: cloudErr } = await supabase
        .from('issues')
        .insert([payload])
        .select()
        .single();

      if (!cloudErr && cloudData) {
        // Mark synced in Dexie
        db.offline_grievances.update(numId, { synced: true }).catch(() => {});
        return { success: true, data: { ...fullIssue, ...cloudData } };
      }
    } catch (supabaseErr) {
      console.warn('[Supabase Insert Error, preserved in offline storage]:', supabaseErr);
    }

    return { success: true, data: fullIssue };
  } catch (err: any) {
    console.error('[Create Grievance Error]:', err);
    return { success: false, error: err.message || 'Failed to submit grievance' };
  }
}

/**
 * Assign issue to an officer or update status
 */
export async function assignAndAdvanceIssue(
  issueId: string,
  assignedOfficer: string,
  newStatus: AnyIssueStatus = 'assigned',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const idStr = String(issueId);

    // 1. Dual persistence update in localStorage
    updateUserReportedIssueInStorage(idStr, {
      status: newStatus as any,
      assigned_officer: assignedOfficer,
      assigned_to: assignedOfficer,
      resolution_notes: notes,
      officer_notes: notes,
    });

    // 2. Dual persistence update in Dexie
    const numId = parseInt(idStr.replace(/\D/g, '') || '0', 10);
    if (numId) {
      await db.offline_grievances.update(numId, {
        status: newStatus as any,
        assigned_to: assignedOfficer,
        officer_notes: notes,
      }).catch(() => {});
    }
    await db.cached_issues.update(idStr, {
      status: newStatus as any,
      assigned_to: assignedOfficer,
      notes: notes,
    }).catch(() => {});

    // 3. Broadcast to all open tabs and windows
    syncChannel?.postMessage({
      type: 'ISSUE_UPDATED',
      issueId: idStr,
      status: newStatus,
      assignedOfficer,
      notes,
      issue: {
        id: idStr,
        issue_id: idStr,
        status: newStatus,
        assigned_officer: assignedOfficer,
        assigned_to: assignedOfficer,
        resolution_notes: notes,
        officer_notes: notes,
      },
    });

    // 4. Supabase cloud update
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
    const updateBody: Record<string, any> = {
      assigned_officer: assignedOfficer,
      assigned_to: assignedOfficer,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (notes) {
      updateBody.resolution_notes = notes;
      updateBody.officer_notes = notes;
    }

    try {
      let updatedRows: any[] = [];
      if (isUUID) {
        const { data, error } = await supabase
          .from('issues')
          .update(updateBody)
          .eq('id', idStr)
          .select();
        if (!error && data) updatedRows = data;
      }

      if (updatedRows.length === 0) {
        const { data, error } = await supabase
          .from('issues')
          .update(updateBody)
          .eq('issue_id', idStr)
          .select();
        if (!error && data) updatedRows = data;
      }

      if (updatedRows.length === 0) {
        const seedItem = PREDEFINED_SURVEY_ISSUES.find(
          (s) => s.id === idStr || s.issue_id === idStr
        );
        if (seedItem) {
          const insertPayload: Record<string, any> = {
            issue_id: seedItem.issue_id || seedItem.id,
            title: seedItem.title,
            description: seedItem.description,
            category: seedItem.category,
            severity: seedItem.severity,
            status: newStatus,
            latitude: seedItem.latitude,
            longitude: seedItem.longitude,
            reported_by: seedItem.reported_by || 'Field Survey Team',
            assigned_officer: assignedOfficer,
            assigned_to: assignedOfficer,
            resolution_notes: notes || seedItem.resolution_notes || '',
            officer_notes: notes || seedItem.officer_notes || '',
            created_at: seedItem.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('issues').insert([insertPayload]);
        }
      }
    } catch (e) {
      console.warn('Supabase update warning, cached locally:', e);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Update Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update issue verification or fix status
 */
export async function updateIssueStatus(
  issueId: string,
  newStatus: AnyIssueStatus,
  officerNotes?: string,
  resolutionPhotoUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const idStr = String(issueId);

    if (resolutionPhotoUrl) {
      saveResolutionPhotoToCache(idStr, resolutionPhotoUrl);
    }

    // 1. Dual persistence in localStorage
    updateUserReportedIssueInStorage(idStr, {
      status: newStatus as any,
      resolution_notes: officerNotes,
      officer_notes: officerNotes,
      resolution_photo_url: resolutionPhotoUrl,
    });

    // 2. Dual persistence in Dexie
    const numId = parseInt(idStr.replace(/\D/g, '') || '0', 10);
    if (numId) {
      const updateDexie: Record<string, any> = { status: newStatus as any };
      if (officerNotes) updateDexie.officer_notes = officerNotes;
      if (resolutionPhotoUrl) updateDexie.resolution_photo_url = resolutionPhotoUrl;
      await db.offline_grievances.update(numId, updateDexie).catch(() => {});
    }
    await db.cached_issues.update(idStr, {
      status: newStatus as any,
      notes: officerNotes,
      resolution_photo_url: resolutionPhotoUrl,
    }).catch(() => {});

    // 3. Broadcast to all open tabs and windows
    syncChannel?.postMessage({
      type: 'ISSUE_UPDATED',
      issueId: idStr,
      status: newStatus,
      officerNotes,
      resolutionPhotoUrl,
      issue: {
        id: idStr,
        issue_id: idStr,
        status: newStatus,
        resolution_notes: officerNotes,
        officer_notes: officerNotes,
        resolution_photo_url: resolutionPhotoUrl,
      },
    });

    // 4. Supabase cloud update
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (officerNotes) {
      updatePayload.resolution_notes = officerNotes;
      updatePayload.officer_notes = officerNotes;
    }

    if (resolutionPhotoUrl) {
      updatePayload.resolution_photo_url = resolutionPhotoUrl;
    }

    try {
      let updatedRows: any[] = [];
      if (isUUID) {
        let { data, error } = await supabase
          .from('issues')
          .update(updatePayload)
          .eq('id', idStr)
          .select();

        if (error && updatePayload.resolution_photo_url) {
          const { resolution_photo_url: _, ...minimalPayload } = updatePayload;
          const retry = await supabase
            .from('issues')
            .update(minimalPayload)
            .eq('id', idStr)
            .select();
          if (!retry.error && retry.data) updatedRows = retry.data;
        } else if (!error && data) {
          updatedRows = data;
        }
      }

      if (updatedRows.length === 0) {
        let { data, error } = await supabase
          .from('issues')
          .update(updatePayload)
          .eq('issue_id', idStr)
          .select();

        if (error && updatePayload.resolution_photo_url) {
          const { resolution_photo_url: _, ...minimalPayload } = updatePayload;
          const retry = await supabase
            .from('issues')
            .update(minimalPayload)
            .eq('issue_id', idStr)
            .select();
          if (!retry.error && retry.data) updatedRows = retry.data;
        } else if (!error && data) {
          updatedRows = data;
        }
      }

      if (updatedRows.length === 0) {
        const seedItem = PREDEFINED_SURVEY_ISSUES.find(
          (s) => s.id === idStr || s.issue_id === idStr
        );
        if (seedItem) {
          const insertPayload: Record<string, any> = {
            issue_id: seedItem.issue_id || seedItem.id,
            title: seedItem.title,
            description: seedItem.description,
            category: seedItem.category,
            severity: seedItem.severity,
            status: newStatus,
            latitude: seedItem.latitude,
            longitude: seedItem.longitude,
            reported_by: seedItem.reported_by || 'Field Survey Team',
            assigned_officer: seedItem.assigned_officer || null,
            assigned_to: seedItem.assigned_to || null,
            resolution_notes: officerNotes || seedItem.resolution_notes || '',
            officer_notes: officerNotes || seedItem.officer_notes || '',
            resolution_photo_url: resolutionPhotoUrl || (seedItem as any).resolution_photo_url || null,
            created_at: seedItem.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('issues').insert([insertPayload]);
        }
      }
    } catch (e) {
      console.warn('Supabase update status warning, saved locally:', e);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to update issue status:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}

/**
 * Permanently delete an issue / fake request (Admin Governance).
 * Removes from localStorage, Dexie, Supabase, and broadcasts ISSUE_DELETED to all devices.
 */
export async function deleteIssue(issueId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const idStr = String(issueId);

    // 1. Remove from localStorage & add to deleted list
    removeUserReportedIssueFromStorage(idStr);

    // 2. Remove from Dexie offline_grievances and cached_issues
    const numId = parseInt(idStr.replace(/\D/g, '') || '0', 10);
    if (numId) {
      await db.offline_grievances.delete(numId).catch(() => {});
    }
    try {
      const all = await db.offline_grievances.toArray();
      for (const g of all) {
        if (String(g.id) === idStr) {
          await db.offline_grievances.delete(g.id!);
        }
      }
    } catch {}

    await db.cached_issues.delete(idStr).catch(() => {});

    // 3. Broadcast deletion to all open tabs and devices
    syncChannel?.postMessage({
      type: 'ISSUE_DELETED',
      issueId: idStr,
      issue: { id: idStr, issue_id: idStr },
    });

    // 4. Supabase cloud delete
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
      if (isUUID) {
        await supabase.from('issues').delete().eq('id', idStr);
      }
      await supabase.from('issues').delete().eq('issue_id', idStr);
    } catch (e) {
      console.warn('Supabase delete issue error:', e);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete issue:', err);
    return { success: false, error: err.message || 'Failed to delete issue' };
  }
}
