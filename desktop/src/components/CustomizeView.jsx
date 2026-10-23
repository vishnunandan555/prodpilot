import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  Server,
  Star,
  Check
} from 'lucide-react';

export default function CustomizeView() {
  const [activeTab, setActiveTab] = useState('browse');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    'All', 'Plan', 'Build', 'Review', 'Test', 'Ship', 'Monitor', 'Design', 'Knowledge', 'Data', 'Communication'
  ];

  const mcpServers = [
    {
      name: 'Markitdown',
      stars: '176.1k',
      type: 'MCP Servers',
      desc: 'Convert various file formats (PDF, Word, Excel, images, audio) to Markdown.',
      installed: false
    },
    {
      name: 'Netdata',
      stars: '80.3k',
      type: 'MCP Servers',
      desc: 'Real-time infrastructure monitoring with metrics, logs, alerts, and ML-based anomaly detection.',
      installed: false
    },
    {
      name: 'Context7',
      stars: '61.2k',
      type: 'MCP Servers',
      desc: 'Up-to-date code docs for any prompt.',
      installed: false
    },
    {
      name: 'Chrome DevTools MCP',
      stars: '49.7k',
      type: 'MCP Servers',
      desc: 'MCP server for Chrome DevTools.',
      installed: false
    },
    {
      name: 'Playwright',
      badge: 'MCP',
      desc: 'Test and automate web apps in browsers.',
      installed: true
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas overflow-y-auto">
      {/* Header (Screen 4 Match) */}
      <div className="h-12 px-6 border-b border-gh-border bg-gh-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('browse')}
            className={`text-[13px] font-medium transition-colors ${
              activeTab === 'browse' ? 'text-gh-text-bright' : 'text-gh-text-muted hover:text-gh-text'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`text-[13px] font-medium transition-colors ${
              activeTab === 'installed' ? 'text-gh-text-bright' : 'text-gh-text-muted hover:text-gh-text'
            }`}
          >
            Installed
          </button>
        </div>

        <button className="gh-btn-primary px-3 py-1 text-[12px] flex items-center gap-1">
          <Plus size={13} />
          <span>Add</span>
        </button>
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Search Input Bar (Screen 4 Match) */}
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-gh-text-dim" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search MCP servers, plugins, skills and more..."
            className="w-full pl-9 pr-28 py-2 bg-gh-surface border border-gh-border rounded-lg text-[13px] text-gh-text placeholder-gh-text-dim outline-none focus:border-gh-blue-border"
          />
          <div className="absolute right-3 flex items-center gap-1 text-[12px] text-gh-text-muted cursor-pointer">
            <span>All types</span>
            <ChevronDown size={13} />
          </div>
        </div>

        {/* Editor's Picks (Screen 4 Match) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[14px] text-gh-text-bright">Editor's picks</h3>
              <p className="text-[12px] text-gh-text-muted">Standout ways to customize Copilot.</p>
            </div>
            <div className="flex items-center gap-1 text-gh-text-muted">
              <button className="p-1 hover:text-gh-text-bright rounded"><ChevronLeft size={14} /></button>
              <button className="p-1 hover:text-gh-text-bright rounded"><ChevronRight size={14} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pick 1 */}
            <div className="bg-gh-surface border border-gh-border rounded-lg p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded bg-blue-950 flex items-center justify-center text-blue-400 font-bold text-xs">
                    AZ
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gh-subtle text-gh-text-muted border border-gh-border">
                    Canvas
                  </span>
                </div>
                <div className="font-semibold text-[13px] text-gh-text-bright">Azure DevOps</div>
                <p className="text-[12px] text-gh-text-muted leading-relaxed">
                  Plan and manage Azure DevOps work in a visual, interactive workspace.
                </p>
              </div>
              <button className="gh-btn-secondary px-3 py-1.5 text-[12px] flex items-center justify-center gap-1 w-full">
                <Plus size={13} /> Install
              </button>
            </div>

            {/* Pick 2 */}
            <div className="bg-gh-surface border border-gh-border rounded-lg p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded bg-amber-950 flex items-center justify-center text-amber-400 font-bold text-xs">
                    ID
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gh-subtle text-gh-text-muted border border-gh-border">
                    Skill
                  </span>
                </div>
                <div className="font-semibold text-[13px] text-gh-text-bright">Impeccable Design</div>
                <p className="text-[12px] text-gh-text-muted leading-relaxed">
                  Design, critique, and polish product interfaces with expert guidance.
                </p>
              </div>
              <button className="gh-btn-secondary px-3 py-1.5 text-[12px] flex items-center justify-center gap-1 w-full">
                <Plus size={13} /> Enable
              </button>
            </div>

            {/* Pick 3 */}
            <div className="bg-gh-surface border border-gh-border rounded-lg p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded bg-purple-950 flex items-center justify-center text-purple-400 font-bold text-xs">
                    MF
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gh-subtle text-gh-text-muted border border-gh-border">
                    Canvas
                  </span>
                </div>
                <div className="font-semibold text-[13px] text-gh-text-bright">Microsoft Foundry</div>
                <p className="text-[12px] text-gh-text-muted leading-relaxed">
                  Build, test, and deploy hosted agents with Microsoft Foundry.
                </p>
              </div>
              <button className="gh-btn-secondary px-3 py-1.5 text-[12px] flex items-center justify-center gap-1 w-full">
                <Plus size={13} /> Install
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills (Screen 4 Match) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[12px]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-gh-border text-gh-text-bright font-medium'
                  : 'text-gh-text-muted hover:text-gh-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* MCP Server Rows List (Screen 4 Match) */}
        <div className="bg-gh-surface border border-gh-border rounded-lg divide-y divide-gh-border">
          {mcpServers.map((server, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-gh-subtle border border-gh-border flex items-center justify-center text-gh-text-muted flex-shrink-0 mt-0.5">
                  <Server size={15} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13px] text-gh-text-bright">{server.name}</span>
                    {server.stars && (
                      <span className="text-[11px] text-gh-text-dim flex items-center gap-0.5">
                        <Star size={11} /> {server.stars}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gh-text-dim">
                    {server.type ? `${server.type} · ` : ''}{server.desc}
                  </div>
                </div>
              </div>

              <button className="gh-btn-secondary px-3 py-1 text-[12px] flex items-center gap-1 flex-shrink-0">
                {server.installed ? <Check size={13} /> : <Plus size={13} />}
                <span>{server.installed ? 'Installed' : 'Add server'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
