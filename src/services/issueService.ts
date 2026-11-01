import { supabase } from '../supabaseClient';
import type { CivicIssue, IssueStatus, IssueVerificationStatus } from '../types';

export type AnyIssueStatus = IssueStatus | IssueVerificationStatus | string;

/**
 * Fetch all issues directly from Supabase Cloud.
 * Guarantees phone, laptop, admin, and officer all see the exact same master dataset.
 */
export async function fetchAllIssues(): Promise<CivicIssue[]> {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Query Error]:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
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
  } catch (err) {
    console.error('[Network Error fetching issues]:', err);
    return [];
  }
}

/**
 * Report a new grievance directly to Supabase cloud
 */
export async function createGrievance(
  issue: Partial<CivicIssue>
): Promise<{ success: boolean; data?: CivicIssue; error?: string }> {
  try {
    const payload: Record<string, any> = {
      title: issue.title || 'Civic Grievance',
      description: issue.description || issue.notes || '',
      category: issue.category || 'General',
      severity: issue.severity || 'medium',
      status: issue.status || 'reported',
      latitude: Number(issue.latitude),
      longitude: Number(issue.longitude),
      reported_by: issue.reported_by || issue.reporter_name || 'Resident',
      created_at: new Date().toISOString(),
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
      return { success: true, data: retryData };
    }

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

    const { error } = await supabase
      .from('issues')
      .update(updateBody)
      .eq('id', issueId);

    if (error) {
      const { error: error2 } = await supabase
        .from('issues')
        .update(updateBody)
        .eq('issue_id', issueId);
      if (error2) throw error2;
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
  officerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (officerNotes) {
      updatePayload.resolution_notes = officerNotes;
      updatePayload.officer_notes = officerNotes;
    }

    const { error } = await supabase
      .from('issues')
      .update(updatePayload)
      .eq('id', issueId);

    if (error) {
      const { error: error2 } = await supabase
        .from('issues')
        .update(updatePayload)
        .eq('issue_id', issueId);

      if (error2) throw error2;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to update issue status:', err);
    return { success: false, error: err.message || 'Database update failed' };
  }
}
