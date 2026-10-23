import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Search,
  FileCode,
  Sparkles,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function AutomationsView() {
  const [searchTerm, setSearchTerm] = useState('');

  const automationsList = [
    {
      title: 'Issue triage',
      cadence: 'Daily',
      desc: 'Review the latest GitHub issues and propose priorities and owners.'
    },
    {
      title: 'Changelog draft',
      cadence: 'Weekly',
      desc: 'Summarize key merged PRs this week into a release-note draft.'
    },
    {
      title: 'Repo audit',
      cadence: 'Manual',
      desc: 'Audit open PRs and identify blockers or risky changes.'
    },
    {
      title: 'Telemetry review',
      cadence: 'Manual',
      desc: 'Review a PR for user-facing changes and suggest required telemetry events.'
    },
    {
      title: 'Performance improvements',
      cadence: 'Weekly',
      desc: 'Identify 10 performance improvements, then open a PR for the highest-impact.'
    },
    {
      title: 'Accessibility audit',
      cadence: 'Daily',
      desc: 'Review PRs merged yesterday and summarize any accessibility issues.'
    },
    {
      title: 'Cost tips',
      cadence: 'Weekly',
      desc: 'Get personalized tips to reduce token usage and cost.'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas overflow-y-auto">
      {/* Header */}
      <div className="h-12 px-6 border-b border-gh-border bg-gh-surface flex items-center justify-between flex-shrink-0">
        <span className="font-semibold text-[14px] text-gh-text-bright">Automations</span>
        <button className="gh-btn-primary px-3 py-1 text-[12px] flex items-center gap-1">
          <Plus size={13} />
          <span>New automation</span>
        </button>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
        {/* Center Hero (Screen 3 Match) */}
        <div className="text-center space-y-3 py-6">
          <div className="w-10 h-10 rounded-lg bg-gh-surface border border-gh-border flex items-center justify-center mx-auto text-gh-text-muted">
            <Calendar size={20} />
          </div>
          <h2 className="text-[20px] font-bold text-gh-text-bright">Set up automations</h2>
          <p className="text-[13px] text-gh-text-muted max-w-lg mx-auto leading-relaxed">
            Use agents to handle recurring work on a cadence you choose or triggered by events. You can start from scratch or turn an existing agent skill into an automation.
          </p>
          <div className="pt-2">
            <button className="gh-btn-primary px-4 py-2 text-[13px] font-medium">
              Start automating
            </button>
          </div>
        </div>

        {/* Grid of Automation Cards (Screen 3 Match) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {automationsList.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-gh-surface border border-gh-border rounded-lg space-y-2 hover:border-gh-text-muted transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] text-gh-text-bright">{item.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gh-subtle text-gh-text-muted border border-gh-border font-mono">
                  {item.cadence}
                </span>
              </div>
              <p className="text-[12px] text-gh-text-muted leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Skills Section (Screen 3 Match) */}
        <div className="pt-4 space-y-3">
          <div>
            <h3 className="font-semibold text-[14px] text-gh-text-bright">Skills</h3>
            <p className="text-[12px] text-gh-text-muted">Turn an existing agent skill into an automation.</p>
          </div>

          <div className="text-[12px] text-gh-text-dim">vishnunandan555/care_app</div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gh-text-dim" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search 9 skills..."
              className="w-full pl-9 pr-3 py-1.5 bg-gh-surface border border-gh-border rounded-md text-[13px] text-gh-text placeholder-gh-text-dim outline-none focus:border-gh-blue-border"
            />
          </div>

          <div className="bg-gh-surface border border-gh-border rounded-lg divide-y divide-gh-border">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCode size={16} className="text-gh-text-muted" />
                <div>
                  <div className="font-medium text-[13px] text-gh-text-bright">care-auth-contexts</div>
                  <div className="text-[11px] text-gh-text-dim font-mono">skills/care-auth-contexts</div>
                </div>
              </div>
              <button className="gh-btn-secondary px-3 py-1 text-[12px]">
                New automation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
