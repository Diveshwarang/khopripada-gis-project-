import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CivicIssue } from '../types';
import { normalizeIssue, fetchIssues } from '../services/dataService';
import { db, seedIssuesFromCsv } from '../services/offlineDb';

interface IssuesContextType {
  issues: CivicIssue[];
  setIssues: React.Dispatch<React.SetStateAction<CivicIssue[]>>;
  addIssue: (issue: CivicIssue) => void;
  fetchAllIssues: () => Promise<void>;
  isLoading: boolean;
}

const IssuesContext = createContext<IssuesContextType | undefined>(undefined);

export const IssuesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to add or update an issue in state immediately
  const addIssue = useCallback((newIssue: CivicIssue) => {
    setIssues((prev) => {
      const key = String(newIssue.issue_id || newIssue.id);
      const filtered = prev.filter((item) => String(item.issue_id || item.id) !== key);
      return [newIssue, ...filtered];
    });
  }, []);

  // 1. Initial data fetch: Query Supabase AND merge all historical + offline issues
  const fetchAllIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch remote Supabase issues
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching all issues from Supabase:', error);
      }

      const supabaseList = (!error && Array.isArray(data)) ? data.map(normalizeIssue) : [];

      // 2. Fetch offline grievances from Dexie
      const offlineGrievances = await db.offline_grievances.reverse().toArray().catch(() => []);
      const offlineList = (offlineGrievances || []).map(normalizeIssue);

      // 3. Fetch historical baseline issues from Dexie (cached_issues) or CSV (unified_issues.csv)
      let cachedIssues = await db.cached_issues.toArray().catch(() => []);
      if (!cachedIssues || cachedIssues.length === 0) {
        cachedIssues = await seedIssuesFromCsv(true, '/data/unified_issues.csv').catch(() => []);
      }
      if (!cachedIssues || cachedIssues.length === 0) {
        cachedIssues = await seedIssuesFromCsv(true, '/data/issues.csv').catch(() => []);
      }
      const cachedList = (cachedIssues || []).map(normalizeIssue);

      // 4. Merge ALL sources into one unified list:
      // Historical baseline (204 issues) + Offline user grievances + Remote Supabase issues
      const mergedMap = new Map<string, CivicIssue>();

      // Baseline historical issues
      for (const item of cachedList) {
        const key = String(item.issue_id || item.id);
        if (key) mergedMap.set(key, item);
      }

      // Offline user grievances (may overlay or append)
      for (const item of offlineList) {
        const key = String(item.issue_id || item.id);
        if (key) mergedMap.set(key, item);
      }

      // Remote Supabase issues
      for (const item of supabaseList) {
        const key = String(item.issue_id || item.id);
        if (key) mergedMap.set(key, item);
      }

      const allMerged = Array.from(mergedMap.values());
      console.log(`[Issues Sync] Loaded ${allMerged.length} total issues from DB`);
      setIssues(allMerged);
    } catch (err) {
      console.error('Error in fetchAllIssues:', err);
      const fallback = await fetchIssues();
      setIssues(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Real-Time Sync & Subscriptions
  useEffect(() => {
    fetchAllIssues();

    // Supabase Real-Time listener for INSERT and UPDATE
    const channel = supabase
      .channel('issues_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'issues' },
        (payload) => {
          setIssues((prev) => {
            const newIssue = normalizeIssue(payload.new);
            const key = String(newIssue.issue_id || newIssue.id);
            const filtered = prev.filter((item) => String(item.issue_id || item.id) !== key);
            return [newIssue, ...filtered];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'issues' },
        (payload) => {
          setIssues((prev) => {
            const updated = normalizeIssue(payload.new);
            const key = String(updated.issue_id || updated.id);
            return prev.map((item) =>
              String(item.issue_id || item.id) === key ? { ...item, ...updated } : item
            );
          });
        }
      )
      .subscribe();

    // Cross-tab broadcast listener for immediate local synchronization
    const syncChannel =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('panchayat-sync')
        : null;

    const handleBroadcast = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'ISSUE_UPDATED' && e.data.issue) {
        const target = normalizeIssue(e.data.issue);
        setIssues((prev) => {
          const key = String(target.issue_id || target.id);
          const filtered = prev.filter((item) => String(item.issue_id || item.id) !== key);
          return [target, ...filtered];
        });
      }
    };

    if (syncChannel) {
      syncChannel.addEventListener('message', handleBroadcast);
    }

    return () => {
      supabase.removeChannel(channel);
      if (syncChannel) {
        syncChannel.removeEventListener('message', handleBroadcast);
        syncChannel.close();
      }
    };
  }, [fetchAllIssues]);

  return (
    <IssuesContext.Provider value={{ issues, setIssues, addIssue, fetchAllIssues, isLoading }}>
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
