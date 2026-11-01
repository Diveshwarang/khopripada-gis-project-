import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CivicIssue } from '../types';
import { normalizeIssue, fetchIssues } from '../services/dataService';

interface IssuesContextType {
  issues: CivicIssue[];
  setIssues: React.Dispatch<React.SetStateAction<CivicIssue[]>>;
  fetchAllIssues: () => Promise<void>;
  isLoading: boolean;
}

const IssuesContext = createContext<IssuesContextType | undefined>(undefined);

export const IssuesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Initial data fetch: Query Supabase with historical fallback
  const fetchAllIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all issues:', error);
        const fallback = await fetchIssues();
        if (fallback && fallback.length > 0) {
          console.log(`[Issues Sync] Loaded ${fallback.length} fallback issues from cache`);
          setIssues(fallback);
        }
        return;
      }

      if (data) {
        console.log(`[Issues Sync] Loaded ${data.length} total issues from DB`);
        if (data.length > 0) {
          setIssues(data.map(normalizeIssue));
        } else {
          // If Supabase table is empty, load baseline historical issues
          const fallback = await fetchIssues();
          if (fallback && fallback.length > 0) {
            console.log(`[Issues Sync] Supabase table empty, loaded ${fallback.length} baseline issues`);
            setIssues(fallback);
          } else {
            setIssues([]);
          }
        }
      }
    } catch (err) {
      console.error('Error in fetchAllIssues:', err);
      const fallback = await fetchIssues();
      if (fallback && fallback.length > 0) {
        setIssues(fallback);
      }
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
            // Avoid duplicate entries
            const exists = prev.some(
              (item) => item.id === payload.new.id || item.issue_id === payload.new.id
            );
            if (exists) return prev;
            return [normalizeIssue(payload.new) as CivicIssue, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'issues' },
        (payload) => {
          setIssues((prev) =>
            prev.map((item) =>
              item.id === payload.new.id || item.issue_id === payload.new.id
                ? (normalizeIssue(payload.new) as CivicIssue)
                : item
            )
          );
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
        setIssues((prev) => {
          const target = e.data.issue;
          const targetId = target.id || target.issue_id;
          const exists = prev.some(
            (item) => item.id === targetId || item.issue_id === targetId
          );
          if (exists) {
            return prev.map((item) =>
              item.id === targetId || item.issue_id === targetId ? target : item
            );
          }
          return [target, ...prev];
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
    <IssuesContext.Provider value={{ issues, setIssues, fetchAllIssues, isLoading }}>
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
