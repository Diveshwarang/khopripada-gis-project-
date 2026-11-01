import { supabase } from '../supabaseClient';
import type { CivicIssue, IssueStatus, IssueVerificationStatus } from '../types';
import { PREDEFINED_SURVEY_ISSUES } from '../data/seedIssues';

export type AnyIssueStatus = IssueStatus | IssueVerificationStatus | string;

/**
 * Fetch all issues directly from Supabase Cloud.
 * Guarantees phone, laptop, admin, and officer all see the exact same master dataset.
 * If Supabase is empty or unreachable, automatically seeds and falls back to PREDEFINED_SURVEY_ISSUES.
 */
export async function fetchAllIssues(): Promise<CivicIssue[]> {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Query Warning, falling back to survey baseline]:', error);
      return PREDEFINED_SURVEY_ISSUES;
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: String(row.id || row.issue_id || ''),
        issue_id: String(row.issue_id || row.id || ''),
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
        proof_image_url: row.proof_image_url || row.photo_url || row.photoBase64 || '',
        photo_url: row.photo_url || row.proof_image_url || row.photoBase64 || '',
        photoBase64: row.photoBase64 || '',
        resolution_photo_url: row.resolution_photo_url || '',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }));
    }

    // Table is empty: attempt cloud auto-seed
    console.log('[Supabase Sync] Issues table is empty. Auto-seeding survey baseline...');
    try {
      const seedPayload = PREDEFINED_SURVEY_ISSUES.map(({ id: _id, ...rest }) => ({
        ...rest,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('issues')
        .insert(seedPayload)
        .select();

      if (!insertError && inserted && inserted.length > 0) {
        console.log(`[Supabase Sync] Successfully auto-seeded ${inserted.length} baseline issues to cloud.`);
        return inserted.map((row: any) => ({
          id: String(row.id || row.issue_id || ''),
          issue_id: String(row.issue_id || row.id || ''),
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
          proof_image_url: row.proof_image_url || row.photo_url || row.photoBase64 || '',
          photo_url: row.photo_url || row.proof_image_url || row.photoBase64 || '',
          photoBase64: row.photoBase64 || '',
          resolution_photo_url: row.resolution_photo_url || '',
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }));
      } else if (insertError) {
        console.warn('[Supabase Sync] Auto-seed insert error (e.g. RLS):', insertError);
      }
    } catch (seedErr) {
      console.warn('[Supabase Sync] Auto-seed exception:', seedErr);
    }

    return PREDEFINED_SURVEY_ISSUES;
  } catch (err) {
    console.error('[Network Error fetching issues, falling back to survey baseline]:', err);
    return PREDEFINED_SURVEY_ISSUES;
  }
}

const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('panchayat-sync')
  : null;

/**
 * Report a new grievance directly to Supabase cloud
 */
export async function createGrievance(
  issue: Partial<CivicIssue>
): Promise<{ success: boolean; data?: CivicIssue; error?: string }> {
  try {
    const issueId = issue.issue_id || issue.id || `khop-iss-${Date.now()}`;
    const payload: Record<string, any> = {
      issue_id: String(issueId),
      title: issue.title || 'Civic Grievance',
      description: issue.description || issue.notes || '',
      category: issue.category || 'General',
      severity: issue.severity || 'medium',
      status: issue.status || 'reported',
      latitude: Number(issue.latitude),
      longitude: Number(issue.longitude),
      reported_by: issue.reported_by || issue.reporter_name || 'Resident',
      reporter_name: issue.reporter_name || issue.reported_by || 'Resident',
      submitted_by: issue.submitted_by || issue.reported_by || 'Resident',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (issue.proof_image_url || issue.photo_url || issue.photoBase64) {
      const img = issue.proof_image_url || issue.photo_url || issue.photoBase64;
      payload.proof_image_url = img;
      payload.photo_url = img;
    }

    const { data, error } = await supabase
      .from('issues')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Insert Error, trying minimal payload]:', error);
      delete payload.proof_image_url;
      delete payload.photo_url;
      const { data: retryData, error: retryError } = await supabase
        .from('issues')
        .insert([payload])
        .select()
        .single();
      if (retryError) throw retryError;
      syncChannel?.postMessage({ type: 'ISSUE_CREATED', issue: retryData });
      return { success: true, data: retryData };
    }

    syncChannel?.postMessage({ type: 'ISSUE_CREATED', issue: data });
    return { success: true, data };
  } catch (err: any) {
    console.error('[Supabase Insert Error]:', err);
    return { success: false, error: err.message || 'Failed to submit grievance to cloud' };
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
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issueId);
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

    let updatedRows: any[] = [];
    if (isUUID) {
      const { data, error } = await supabase
        .from('issues')
        .update(updateBody)
        .eq('id', issueId)
        .select();
      if (!error && data) updatedRows = data;
    }

    if (updatedRows.length === 0) {
      const { data, error } = await supabase
        .from('issues')
        .update(updateBody)
        .eq('issue_id', issueId)
        .select();
      if (!error && data) updatedRows = data;
    }

    // If row wasn't present in Supabase yet (e.g. from local seed baseline), insert it now!
    if (updatedRows.length === 0) {
      const seedItem = PREDEFINED_SURVEY_ISSUES.find(
        (s) => s.id === issueId || s.issue_id === issueId
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

    syncChannel?.postMessage({
      type: 'ISSUE_UPDATED',
      issueId,
      status: newStatus,
      assignedOfficer,
      notes,
    });

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
  officerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issueId);
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (officerNotes) {
      updatePayload.resolution_notes = officerNotes;
      updatePayload.officer_notes = officerNotes;
    }

    let updatedRows: any[] = [];
    if (isUUID) {
      const { data, error } = await supabase
        .from('issues')
        .update(updatePayload)
        .eq('id', issueId)
        .select();
      if (!error && data) updatedRows = data;
    }

    if (updatedRows.length === 0) {
      const { data, error } = await supabase
        .from('issues')
        .update(updatePayload)
        .eq('issue_id', issueId)
        .select();
      if (!error && data) updatedRows = data;
    }

    // If row wasn't present in Supabase yet (e.g. from local seed baseline), insert it now!
    if (updatedRows.length === 0) {
      const seedItem = PREDEFINED_SURVEY_ISSUES.find(
        (s) => s.id === issueId || s.issue_id === issueId
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
          created_at: seedItem.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('issues').insert([insertPayload]);
      }
    }

    syncChannel?.postMessage({
      type: 'ISSUE_UPDATED',
      issueId,
      status: newStatus,
      officerNotes,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to update issue status:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}
