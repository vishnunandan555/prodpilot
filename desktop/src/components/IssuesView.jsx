import React, { useState } from 'react';
import {
  CircleDot,
  MessageSquare,
  Plus,
  Play,
  Bold,
  Italic,
  Code,
  Quote,
  List,
  Link2,
  Table,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export default function IssuesView({
  onOpenSession
}) {
  const [activeTab, setActiveTab] = useState('created');
  const [selectedIssueId, setSelectedIssueId] = useState(3);
  const [commentText, setCommentText] = useState('');

  const issuesList = [
    {
      id: 3,
      title: '[FEATURE] Create UI for MayFly Dashboard',
      repo: 'vishnunandan555/mayfly',
      author: 'vishnunandan555',
      time: '1mo ago',
      comments: 0,
      state: 'open',
      readiness: {
        ready: true,
        score: 0.95,
        summary: 'Clear requirement: Linux GUI dashboard equivalent to MayFly TUI.'
      },
      body: 'Create a very simple UI Dashboard for Linux, which will basically show a GUI equivalent for MayFly TUI Main Dashboard.'
    },
    {
      id: 1,
      title: '[BUG] Missing discount key in order payload causes 500 crash',
      repo: 'vishnunandan555/demo-prod',
      author: 'vishnunandan555',
      time: '2h ago',
      comments: 2,
      state: 'open',
      readiness: {
        ready: true,
        score: 0.98,
        summary: 'Reproduction provided: POST /orders with empty JSON causes KeyError.'
      },
      body: 'When calling POST /orders without a discount field, the service crashes with KeyError: discount.'
    },
    {
      id: 2,
      title: '[CHORE] Refactor auth context and update dependencies',
      repo: 'vishnunandan555/care_app',
      author: 'vishnunandan555',
      time: '3w ago',
      comments: 1,
      state: 'open',
      readiness: {
        ready: false,
        score: 0.40,
        summary: 'Vague task: lacks specific library version and target modules.',
        clarifyingQuestions: [
          'Which auth contexts should be refactored?',
          'Are there breaking changes expected in downstream services?'
        ]
      },
      body: 'We should probably clean up auth context sometime soon.'
    }
  ];

  const currentIssue = issuesList.find(i => i.id === selectedIssueId) || issuesList[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas overflow-hidden">
      {/* Top Bar (Screens 2 & 5) */}
      <div className="h-12 px-4 border-b border-gh-border bg-gh-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[14px] text-gh-text-bright">Issues</span>
          <div className="flex items-center gap-1 text-[12px]">
            <button
              onClick={() => setActiveTab('assigned')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                activeTab === 'assigned' ? 'bg-gh-border text-gh-text-bright' : 'text-gh-text-muted hover:text-gh-text'
              }`}
            >
              Assigned to me
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                activeTab === 'created' ? 'bg-gh-border text-gh-text-bright font-medium' : 'text-gh-text-muted hover:text-gh-text'
              }`}
            >
              Created by me
            </button>
            <button
              onClick={() => setActiveTab('mentions')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                activeTab === 'mentions' ? 'bg-gh-border text-gh-text-bright' : 'text-gh-text-muted hover:text-gh-text'
              }`}
            >
              Mentioning me
            </button>
            <button
              onClick={() => setActiveTab('done')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                activeTab === 'done' ? 'bg-gh-border text-gh-text-bright' : 'text-gh-text-muted hover:text-gh-text'
              }`}
            >
              Done
            </button>
          </div>
        </div>

        <button className="gh-btn-primary px-3 py-1 text-[12px] flex items-center gap-1">
          <Plus size={13} />
          <span>New issue</span>
        </button>
      </div>

      {/* Split Columns View (Screen 5) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Issue List */}
        <div className="w-[380px] border-r border-gh-border overflow-y-auto bg-gh-surface divide-y divide-gh-border">
          {issuesList.map((issue) => {
            const isSelected = issue.id === selectedIssueId;
            return (
              <div
                key={issue.id}
                onClick={() => setSelectedIssueId(issue.id)}
                className={`p-3.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-gh-subtle border-l-2 border-gh-blue-border' : 'hover:bg-gh-subtle'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CircleDot size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-gh-text-bright truncate">
                      {issue.title} <span className="text-gh-text-dim font-mono">#{issue.id}</span>
                    </div>
                    <div className="text-[11px] text-gh-text-muted mt-0.5 truncate">
                      {issue.repo} · {issue.author} · {issue.time}
                    </div>

                    {/* Readiness Gate Badge */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                        issue.readiness.ready
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        Readiness: {issue.readiness.ready ? 'READY: YES' : 'READY: NO'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gh-text-dim">
                    <MessageSquare size={12} />
                    <span>{issue.comments}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Issue Details & Comment Stream (Screen 5) */}
        <div className="flex-1 flex flex-col bg-gh-canvas overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-gh-border space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[18px] font-bold text-gh-text-bright leading-tight">
                {currentIssue.title} <span className="text-gh-text-dim font-mono">#{currentIssue.id}</span>
              </h2>
              <button
                onClick={() => onOpenSession && onOpenSession(currentIssue)}
                className="gh-btn-secondary px-3 py-1.5 text-[12px] flex items-center gap-1.5 flex-shrink-0"
              >
                <Play size={12} />
                <span>Open session</span>
                <ChevronDown size={12} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold text-[11px] flex items-center gap-1">
                <CircleDot size={12} /> Open
              </span>
              <span className="text-gh-text-muted">
                {currentIssue.author} opened this issue {currentIssue.time}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[12px]">
              <button className="gh-btn-secondary px-2.5 py-1 text-[11px]">👤 Assignees</button>
              <button className="gh-btn-secondary px-2.5 py-1 text-[11px]">🏷️ Labels</button>
              <button className="gh-btn-secondary px-2 py-1 text-[11px]">+</button>
            </div>
          </div>

          {/* Issue Conversation & Readiness Gate */}
          <div className="p-5 space-y-4 max-w-3xl">
            {/* Readiness Evaluation Card */}
            <div className="p-3 bg-gh-surface border border-gh-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gh-text-bright flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  ProdPilot Context Brief & Readiness Gate
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                  currentIssue.readiness.ready ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }`}>
                  {currentIssue.readiness.ready ? 'GATE: READY' : 'GATE: BLOCKED'}
                </span>
              </div>
              <p className="text-[12px] text-gh-text-muted leading-relaxed">
                {currentIssue.readiness.summary}
              </p>
              {!currentIssue.readiness.ready && currentIssue.readiness.clarifyingQuestions && (
                <div className="mt-2 p-2.5 bg-gh-subtle rounded border border-gh-border space-y-1 text-[12px]">
                  <div className="font-semibold text-amber-400">Clarifying Questions Drafted:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-gh-text-muted text-[11px]">
                    {currentIssue.readiness.clarifyingQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <button className="gh-btn-primary px-2.5 py-1 text-[11px]">
                      Post Clarifying Questions to GitHub
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Original Comment Box */}
            <div className="bg-gh-surface border border-gh-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-[12px] text-gh-text-muted pb-2 border-b border-gh-border">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gh-subtle text-[9px] flex items-center justify-center font-bold text-gh-text-bright">
                    VN
                  </div>
                  <span className="font-semibold text-gh-text-bright">{currentIssue.author}</span>
                  <span>commented {currentIssue.time}</span>
                </div>
              </div>
              <p className="text-[13px] text-gh-text leading-relaxed whitespace-pre-wrap">
                {currentIssue.body}
              </p>
            </div>

            {/* Markdown Comment Editor */}
            <div className="bg-gh-surface border border-gh-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-gh-border bg-gh-subtle flex items-center gap-2 text-gh-text-muted">
                <button className="p-1 hover:text-gh-text-bright rounded"><Bold size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><Italic size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><Code size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><Quote size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><List size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><Link2 size={13} /></button>
                <button className="p-1 hover:text-gh-text-bright rounded"><Table size={13} /></button>
              </div>

              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment"
                rows={4}
                className="w-full p-3 bg-transparent text-[13px] text-gh-text placeholder-gh-text-dim outline-none resize-none"
              />

              <div className="p-2.5 border-t border-gh-border bg-gh-subtle flex items-center justify-between">
                <button className="gh-btn-secondary px-3 py-1 text-[12px]">
                  Close issue
                </button>
                <button className="gh-btn-primary px-3 py-1 text-[12px]">
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
