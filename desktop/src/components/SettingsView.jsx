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
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto p-5 md:p-6 font-sans">
      <div className="max-w-2xl w-full mx-auto space-y-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Settings size={15} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                Platform Configuration
              </h1>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Model 1 topology: Local Linux Host, Cloudflare Tunnel & Mobile Web Gateway
              </p>
            </div>
          </div>
        </div>

        {/* Model 1 Architecture Card */}
        <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#58a6ff]">
              Architecture Topology: Model 1
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                apiConnected
                  ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
              }`}
            >
              {apiConnected ? 'ONLINE :8765' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-[#8b949e] font-mono leading-relaxed">
            The Python SRE agent and verification engine execute locally on the Linux workstation, exposing port 8765 via Cloudflare Tunnel, while mobile incident approvals sync instantly via Render.
          </p>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Cloudflare Tunnel / Backend API URL */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc] font-mono">
              Backend API URL (Cloudflare Tunnel or Local RPC)
            </label>
            <p className="text-[11px] text-[#8b949e] font-mono">
              Live Cloudflare Tunnel endpoint (<code className="text-[#58a6ff]">https://*.trycloudflare.com</code>) or local daemon (<code className="text-[#58a6ff]">http://127.0.0.1:8765</code>).
            </p>
            <div className="flex items-center gap-2">
              <Server size={15} className="text-[#6e7681] flex-shrink-0" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://127.0.0.1:8765"
                className="flex-1 px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          {/* 2. Connected Repository */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc] font-mono">
              Connected Target Service
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[#8b949e] font-mono block mb-1">Service Identifier</span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#8b949e] font-mono block mb-1">Production Port</span>
                <input
                  type="text"
                  disabled
                  value="8000 (FastAPI)"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#6e7681]"
                />
              </div>
            </div>
          </div>

          {/* 3. Render Static Web URL */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc] font-mono">
              Public Render Hosted Web URL
            </label>
            <p className="text-[11px] text-[#8b949e] font-mono">
              Public Web URL included in Telegram mobile alert buttons for out-of-band approvals.
            </p>
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-[#6e7681] flex-shrink-0" />
              <input
                type="text"
                value={renderWebUrl}
                onChange={(e) => setRenderWebUrl(e.target.value)}
                placeholder="https://prodpilot.onrender.com"
                className="flex-1 px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#6e7681] font-mono">
              Changes apply instantly to active API client & SSE streams.
            </span>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded text-xs font-medium bg-[#238636] hover:bg-[#2ea043] text-white flex items-center gap-1.5 transition"
            >
              {saved ? <Check size={13} className="text-white" /> : <Save size={13} />}
              <span>{saved ? 'Saved!' : 'Save Config'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
