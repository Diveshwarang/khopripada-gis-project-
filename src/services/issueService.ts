import { supabase } from '../supabaseClient';
import type { IssueStatus } from '../types';

export async function updateIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  officerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (officerNotes) {
      updatePayload.resolution_notes = officerNotes;
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

