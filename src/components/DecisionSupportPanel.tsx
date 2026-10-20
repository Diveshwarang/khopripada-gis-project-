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
    <div className="pointer-events-auto backdrop-blur-2xl bg-[#132228]/95 border border-[#334B56] rounded-2xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] overflow-hidden w-80 sm:w-96 text-[#F8FAFC] transition-all animate-in fade-in slide-in-from-left-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-[#1B2F38] border-b border-[#334B56] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 border border-[#10B981]/60 flex items-center justify-center text-[#6EE7B7] shadow-sm">
            <Brain className="w-4 h-4 text-[#6EE7B7]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6EE7B7] bg-[#10B981]/20 px-1.5 py-0.5 rounded border border-[#10B981]/60">
                ML Priority Model
              </span>
              <span className="text-[10px] text-[#38BDF8] font-mono font-bold">
                Admin Support
              </span>
            </div>
            <h3 className="text-xs font-bold text-[#F8FAFC] tracking-tight flex items-center gap-1 mt-0.5">
              Panchayat Decision Support
              <Sparkles className="w-3 h-3 text-[#38BDF8]" />
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg bg-[#0C171C] hover:bg-[#1B2F38] text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer border border-[#334B56]"
            title={isCollapsed ? 'Expand Top 5 Priorities' : 'Collapse Panel'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sub-Header: Financial Capex Forecast */}
      {!isCollapsed && (
        <div className="px-3.5 py-2 bg-[#0C171C] border-b border-[#334B56] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <Coins className="w-3.5 h-3.5 text-[#FCD34D]" />
            <span>Top 5 Est. Works Capex:</span>
          </div>
          <span className="font-mono font-bold text-[#38BDF8] text-xs">
            ₹{totalTopBudget.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* Issues List Container */}
      {!isCollapsed && (
        <div className="p-2.5 space-y-2 max-h-[380px] overflow-y-auto scrollbar-thin">
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
                className={`bg-[#1B2F38] hover:bg-[#233B46] border-l-4 border-l-[#E05A47] border border-[#334B56] rounded-xl p-3 mb-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#233B46] ring-1 ring-[#38BDF8]'
                    : ''
                }`}
              >
                {/* Header: Rank + ID + Score */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#0C171C] border border-[#334B56] text-[10px] font-bold font-mono text-[#F8FAFC] flex items-center justify-center">
                      #{rank}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5" />
                      Urgent
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      {issue.issue_id}
                    </span>
                  </div>

                  <div className="bg-[#E05A47]/20 text-[#FCA5A5] px-2 py-0.5 rounded-full text-xs font-bold">
                    Score: {score}/100
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs font-semibold text-[#F8FAFC] leading-snug line-clamp-1 mb-1">
                  {issue.title}
                </h4>

                {/* Category & Budget */}
                <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-1.5">
                  <span className="capitalize">{issue.category.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[#38BDF8] font-semibold">
                    Est: ₹{budget.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* AI Recommendation Snippet */}
                {issue.ai_recommendation && (
                  <p className="text-[10px] text-[#94A3B8] italic bg-[#0C171C] p-1.5 rounded-lg border border-[#334B56] line-clamp-2 mb-2">
                    "{issue.ai_recommendation}"
                  </p>
                )}

                {/* Action button */}
                <div className="flex items-center justify-between pt-1.5 border-t border-[#334B56] text-[10px]">
                  <span className="font-mono text-[#38BDF8] font-medium text-[10px]">
                    {issue.latitude.toFixed(4)}°N, {issue.longitude.toFixed(4)}°E
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIssueId(issue.issue_id);
                      onFlyToIssue(issue);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-[#F8FAFC] text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Navigation className="w-2.5 h-2.5 text-[#38BDF8]" />
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
