import React, { useState } from 'react';
import {
  Settings,
  Server,
  Globe,
  GitBranch,
  ShieldCheck,
  Send,
  Save,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function SettingsView({
  apiBaseUrl,
  onSaveApiUrl,
  apiConnected,
}) {
  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [saved, setSaved] = useState(false);
  const [repoName, setRepoName] = useState('demo-prod');
  const [renderWebUrl, setRenderWebUrl] = useState(
    localStorage.getItem('prodpilot_render_url') || 'https://prodpilot.onrender.com'
  );

  const handleSave = (e) => {
    e.preventDefault();
    onSaveApiUrl(urlInput.trim());
    localStorage.setItem('prodpilot_render_url', renderWebUrl.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas text-gh-text overflow-y-auto p-6 md:p-8">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gh-text-bright flex items-center gap-2.5">
            <Settings size={20} className="text-indigo-400" />
            <span>Platform Settings</span>
          </h1>
          <p className="text-xs text-gh-text-dim mt-1">
            Configure ProdPilot Model 1 topology: Laptop Backend, Cloudflare Tunnel & Render Static Web App.
          </p>
        </div>

        {/* Model 1 Architecture Card */}
        <div className="p-4 rounded-xl bg-gh-surface border border-gh-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
              Architecture Model 1
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                apiConnected
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {apiConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
          <p className="text-xs text-gh-text leading-relaxed">
            ProdPilot runs the heavy Python SRE agent and verification engine locally on your laptop, exposes port 8765 via Cloudflare Tunnel, and provides a mobile incident interface on Render.
          </p>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* 1. Cloudflare Tunnel / Backend API URL */}
          <div className="p-4 rounded-xl bg-gh-surface border border-gh-border space-y-3">
            <label className="block text-xs font-bold text-gh-text-bright">
              Backend API URL (Cloudflare Tunnel)
            </label>
            <p className="text-[11px] text-gh-text-dim">
              Set this to your live Cloudflare Tunnel URL (e.g., <code className="text-indigo-300">https://*.trycloudflare.com</code>) or local backend (<code className="text-indigo-300">http://127.0.0.1:8765</code>).
            </p>
            <div className="flex items-center gap-2">
              <Server size={16} className="text-gh-text-muted flex-shrink-0" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://xyz.trycloudflare.com"
                className="flex-1 px-3 py-2 bg-gh-inset border border-gh-border rounded-lg text-xs font-mono text-gh-text-bright focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 2. Connected Repository */}
          <div className="p-4 rounded-xl bg-gh-surface border border-gh-border space-y-3">
            <label className="block text-xs font-bold text-gh-text-bright">
              Connected Target Repository
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-gh-text-dim block mb-1">Service / Repo Name</span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-3 py-2 bg-gh-inset border border-gh-border rounded-lg text-xs font-mono text-gh-text-bright focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-gh-text-dim block mb-1">Target Production Port</span>
                <input
                  type="text"
                  disabled
                  value="8000 (FastAPI)"
                  className="w-full px-3 py-2 bg-gh-inset border border-gh-border rounded-lg text-xs font-mono text-gh-text-dim"
                />
              </div>
            </div>
          </div>

          {/* 3. Render Static Web URL */}
          <div className="p-4 rounded-xl bg-gh-surface border border-gh-border space-y-3">
            <label className="block text-xs font-bold text-gh-text-bright">
              Render Hosted Web URL
            </label>
            <p className="text-[11px] text-gh-text-dim">
              The public URL for this static frontend on Render, included in mobile Telegram alert links.
            </p>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-gh-text-muted flex-shrink-0" />
              <input
                type="text"
                value={renderWebUrl}
                onChange={(e) => setRenderWebUrl(e.target.value)}
                placeholder="https://prodpilot.onrender.com"
                className="flex-1 px-3 py-2 bg-gh-inset border border-gh-border rounded-lg text-xs font-mono text-gh-text-bright focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gh-text-dim">
              Changes are immediately applied to active API client & SSE streams.
            </span>
            <button
              type="submit"
              className="gh-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
            >
              {saved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
              <span>{saved ? 'Settings Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
