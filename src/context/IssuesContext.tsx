import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { fetchAllIssues } from '../services/issueService';
import { db } from '../services/offlineDb';
import type { CivicIssue } from '../types';
import { PREDEFINED_SURVEY_ISSUES } from '../data/seedIssues';

/**
 * Normalizes incoming raw database rows (e.g. from real-time events) into typed CivicIssue
 */
function normalizeRealtimeIssue(row: any): CivicIssue {
  const idStr = String(row.id || row.issue_id || '');
  return {
    id: idStr,
    issue_id: String(row.issue_id || row.id || ''),
    title: row.title || 'Civic Grievance',
    description: row.description || row.notes || '',
    notes: row.notes || row.description || '',
    category: row.category || 'General',
    severity: row.severity || 'low',
    status: (row.status || 'reported'),
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
  };
}

/**
 * Live multi-device real-time synchronization hook.
 * Directly listens to Supabase Postgres real-time events (INSERT, UPDATE, DELETE)
 * so that any submission from mobile immediately broadcasts to the laptop.
 */
export function useIssuesSync() {
  const [issues, setIssues] = useState<CivicIssue[]>(PREDEFINED_SURVEY_ISSUES);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadIssues = useCallback(async () => {
    try {
      const cloudIssues = await fetchAllIssues();
      if (cloudIssues && cloudIssues.length > 0) {
        console.log(`[Cloud Sync] Loaded ${cloudIssues.length} live issues from Supabase`);
        setIssues(cloudIssues);
      } else if (!navigator.onLine) {
        // Fallback to local Dexie only when genuinely offline
        const offlineRecords = await db.offline_grievances.reverse().toArray().catch(() => []);
        console.log(`[Offline Fallback] Loaded ${offlineRecords.length} offline issues`);
        if (offlineRecords && offlineRecords.length > 0) {
          setIssues(offlineRecords.map(normalizeRealtimeIssue));
        } else {
          setIssues(PREDEFINED_SURVEY_ISSUES);
        }
      } else {
        setIssues(PREDEFINED_SURVEY_ISSUES);
      }
    } catch (err) {
      console.warn('[Sync Warning] Supabase fetch error, checking offline cache:', err);
      const offlineRecords = await db.offline_grievances.reverse().toArray().catch(() => []);
      if (offlineRecords && offlineRecords.length > 0) {
        setIssues(offlineRecords.map(normalizeRealtimeIssue));
      } else {
        setIssues(PREDEFINED_SURVEY_ISSUES);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load from Supabase cloud
    reloadIssues();

    // 2. Real-time multi-device subscription channel
    const channel = supabase
      .channel('public:issues')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          console.log('[Realtime Event Received]:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newRow = normalizeRealtimeIssue(payload.new);
            setIssues((prev) => {
              if (prev.some((item) => String(item.id) === String(newRow.id))) return prev;
              return [newRow, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = normalizeRealtimeIssue(payload.new);
            setIssues((prev) =>
              prev.map((item) =>
                String(item.id) === String(updatedRow.id) ? { ...item, ...updatedRow } : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String((payload.old as any).id || (payload.old as any).issue_id || '');
            setIssues((prev) => prev.filter((item) => String(item.id) !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime Status]:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reloadIssues]);

  return { issues, setIssues, reloadIssues, loading };
}

interface IssuesContextType {
  issues: CivicIssue[];
  setIssues: React.Dispatch<React.SetStateAction<CivicIssue[]>>;
  addIssue: (issue: CivicIssue) => void;
  fetchAllIssues: () => Promise<void>;
  reloadIssues: () => Promise<void>;
  isLoading: boolean;
  loading: boolean;
}

const IssuesContext = createContext<IssuesContextType | undefined>(undefined);

export const IssuesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { issues, setIssues, reloadIssues, loading } = useIssuesSync();

  const addIssue = useCallback(
    (newIssue: CivicIssue) => {
      setIssues((prev) => {
        const key = String(newIssue.issue_id || newIssue.id);
        const filtered = prev.filter((item) => String(item.issue_id || item.id) !== key);
        return [newIssue, ...filtered];
      });
    },
    [setIssues]
  );

  return (
    <IssuesContext.Provider
      value={{
        issues,
        setIssues,
        addIssue,
        fetchAllIssues: reloadIssues,
        reloadIssues,
        isLoading: loading,
        loading,
      }}
    >
      {children}
    </IssuesContext.Provider>
  );
};

export const useIssues = () => {
  const context = useContext(IssuesContext);
  if (!context) {
    throw new Error('useIssues must be used within an IssuesProvider');
  }
  return context;
};
