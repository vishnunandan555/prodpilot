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
  const [repoName, setRepoName] = useState('chunkstream');
  const [renderWebUrl, setRenderWebUrl] = useState(
    localStorage.getItem('prodpilot_render_url') || 'https://prodpilot.onrender.com'
  );

  React.useEffect(() => {
    fetch(`${apiBaseUrl}/repos`)
      .then((res) => res.json())
      .then((data) => {
        if (data.active_repo?.name) {
          setRepoName(data.active_repo.name);
        }
      })
      .catch(() => {});
  }, [apiBaseUrl]);

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
              <p className="text-xs text-[#8b949e] mt-0.5">
                Daemon host, public web gateway, and alert routing settings
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicator Card */}
        <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
            <span className="text-xs font-medium text-[#f0f6fc]">
              Backend Control Plane Daemon
            </span>
          </div>
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

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Cloudflare Tunnel / Backend API URL */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc]">
              Backend API URL (Local Daemon or Cloudflare Tunnel)
            </label>
            <p className="text-xs text-[#8b949e]">
              Local daemon URL (<code className="text-[#58a6ff] font-mono">http://127.0.0.1:8765</code>) or public tunnel endpoint.
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

          {/* 2. Connected Service */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc]">
              Default Target Service
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[#8b949e] font-semibold block mb-1 uppercase tracking-wider">Service Identifier</span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#8b949e] font-semibold block mb-1 uppercase tracking-wider">Production Port</span>
                <input
                  type="text"
                  disabled
                  value="8000"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#6e7681]"
                />
              </div>
            </div>
          </div>

          {/* 3. Render Static Web URL */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
            <label className="block text-xs font-semibold text-[#f0f6fc]">
              Public Hosted Web Gateway URL
            </label>
            <p className="text-xs text-[#8b949e]">
              Endpoint included in notifications for mobile incident approvals and live triage.
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
