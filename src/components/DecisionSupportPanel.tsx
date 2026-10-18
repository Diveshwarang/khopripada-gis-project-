import React, { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Coins,
  Navigation,
  Sparkles,
  Flame,
} from 'lucide-react';
import type { CachedIssue } from '../services/offlineDb';

interface DecisionSupportPanelProps {
  issues: CachedIssue[];
  onFlyToIssue: (issue: CachedIssue) => void;
}

export const DecisionSupportPanel: React.FC<DecisionSupportPanelProps> = ({
  issues,
  onFlyToIssue,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Filter issues that have AI scores or sort by priority score descending
  const topIssues = React.useMemo(() => {
    return [...issues]
      .filter((iss) => iss.ai_priority_score !== undefined || iss.severity === 'high' || iss.severity === 'critical')
      .sort((a, b) => {
        const scoreA = a.ai_priority_score ?? (a.severity === 'critical' ? 95 : a.severity === 'high' ? 85 : 50);
        const scoreB = b.ai_priority_score ?? (b.severity === 'critical' ? 95 : b.severity === 'high' ? 85 : 50);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [issues]);

  const totalTopBudget = React.useMemo(() => {
    return topIssues.reduce((sum, item) => sum + (item.estimated_budget_inr || 45000), 0);
  }, [topIssues]);

  if (topIssues.length === 0) return null;

  return (
    <div className="pointer-events-auto backdrop-blur-2xl bg-slate-900/95 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden w-80 sm:w-96 text-slate-100 transition-all animate-in fade-in slide-in-from-left-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            <Brain className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-950 px-1.5 py-0.2 rounded border border-purple-500/40">
                ML Priority Model
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                Admin Support
              </span>
            </div>
            <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1 mt-0.5">
              Panchayat Decision Support
              <Sparkles className="w-3 h-3 text-amber-400" />
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title={isCollapsed ? 'Expand Top 5 Priorities' : 'Collapse Panel'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sub-Header: Financial Capex Forecast */}
      {!isCollapsed && (
        <div className="px-3.5 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Top 5 Est. Works Capex:</span>
          </div>
          <span className="font-mono font-bold text-emerald-400 text-xs">
            ₹{totalTopBudget.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* Issues List Container */}
      {!isCollapsed && (
        <div className="p-2.5 space-y-2 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/50">
          {topIssues.map((issue, idx) => {
            const rank = issue.ai_rank || idx + 1;
            const score = issue.ai_priority_score || (99 - idx * 4);
            const budget = issue.estimated_budget_inr || (120000 - idx * 18000);
            const isSelected = selectedIssueId === issue.issue_id;

            return (
              <div
                key={issue.issue_id}
                onClick={() => {
                  setSelectedIssueId(issue.issue_id);
                  onFlyToIssue(issue);
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-950/50 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-purple-500/40 hover:bg-slate-850'
                }`}
              >
                {/* Header: Rank + ID + Score */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-purple-900/80 border border-purple-500/50 text-[10px] font-bold font-mono text-purple-200 flex items-center justify-center">
                      #{rank}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-rose-950/90 border border-rose-500/50 text-rose-300 flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5" />
                      Urgent
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {issue.issue_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-900">
                    <span>Score:</span>
                    <span>{score}/100</span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-white leading-snug line-clamp-1 mb-1">
                  {issue.title}
                </h4>

                {/* Category & Budget */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span className="capitalize">{issue.category.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    Est: ₹{budget.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* AI Recommendation Snippet */}
                {issue.ai_recommendation && (
                  <p className="text-[10px] text-slate-300 italic bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 line-clamp-2 mb-2">
                    "{issue.ai_recommendation}"
                  </p>
                )}

                {/* Action button */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                  <span className="font-mono text-slate-500">
                    {issue.latitude.toFixed(4)}°N, {issue.longitude.toFixed(4)}°E
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIssueId(issue.issue_id);
                      onFlyToIssue(issue);
                    }}
                    className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    <span>Fly to Asset</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
