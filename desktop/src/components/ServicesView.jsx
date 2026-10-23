import React, { useState } from 'react';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function ServicesView({ apiConnected = true }) {
  const [pinging, setPinging] = useState(null);

  const services = [
    {
      id: 'demo-prod',
      name: 'order_service (Production Target)',
      port: 8000,
      env: 'Production',
      status: 'DEGRADED',
      healthUrl: 'http://127.0.0.1:8000/health',
      uptime: '99.4%',
      p99: '14.2ms',
      lastDeploy: '15m ago (commit a1b2c3d)',
      description: 'E-commerce checkout & order calculation service with live traffic',
      framework: 'FastAPI / Python 3.11'
    },
    {
      id: 'canary-fix',
      name: 'canary-fix-forward (Remediation)',
      port: 8001,
      env: 'Staging Canary',
      status: 'HEALTHY',
      healthUrl: 'http://127.0.0.1:8001/health',
      uptime: '100%',
      p99: '9.8ms',
      lastDeploy: 'Just now (worktree inc-001)',
      description: 'Patched order_service with .get("discount", 0.0) fix. 100% tests pass.',
      framework: 'Isolated Worktree Staging'
    },
    {
      id: 'canary-rollback',
      name: 'canary-rollback (Reversion)',
      port: 8002,
      env: 'Staging Canary',
      status: 'HEALTHY',
      healthUrl: 'http://127.0.0.1:8002/health',
      uptime: '100%',
      p99: '11.0ms',
      lastDeploy: 'Just now (parent commit c9e8a1)',
      description: 'Pre-outage known-good build staged for zero-downtime instant rollback.',
      framework: 'Clean Commit Staging'
    },
    {
      id: 'prodpilot-core',
      name: 'prodpilot-core (Operations Engine)',
      port: 8765,
      env: 'Laptop Host',
      status: 'OPERATIONAL',
      healthUrl: 'http://127.0.0.1:8765/health',
      uptime: '100%',
      p99: '4.2ms',
      lastDeploy: 'Running via scripts/start-all.sh',
      description: 'FastAPI REST & SSE Server, Watcher, Orchestrator & Cloudflare Tunnel bridge.',
      framework: 'FastAPI / SQLite / Cloudflare'
    }
  ];

  const handlePing = (id) => {
    setPinging(id);
    setTimeout(() => {
      setPinging(null);
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={15} className="text-[#58a6ff]" />
            <div>
              <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                Service Catalog & Canary Fleet
              </h1>
              <p className="text-[11px] text-[#6e7681] font-mono">
                Continuous health monitoring, port allocations, and canaries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#6e7681]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
            <span>4 Endpoints Monitored</span>
          </div>
        </div>
      </div>

      {/* Services List Grid (High Density Matte Cards) */}
      <div className="p-5 max-w-5xl w-full mx-auto space-y-3">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="p-3.5 rounded-md bg-[#0d111a] border border-[#1b2234] hover:border-[#26334f] transition space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#1b2234] pb-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    svc.status === 'DEGRADED'
                      ? 'bg-[#f85149]'
                      : svc.status === 'HEALTHY'
                      ? 'bg-[#3fb950]'
                      : 'bg-[#58a6ff]'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap font-mono">
                    <span className="text-xs font-bold text-[#f0f6fc]">{svc.name}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234]">
                      Port {svc.port}
                    </span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase border ${
                        svc.status === 'DEGRADED'
                          ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                          : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                      }`}
                    >
                      {svc.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6e7681] font-mono mt-0.5">{svc.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handlePing(svc.id)}
                  disabled={pinging === svc.id}
                  className="px-2.5 py-1 rounded bg-[#161b26] hover:bg-[#212a3d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] border border-[#212a3d] transition flex items-center gap-1.5"
                >
                  <Activity size={11} className={pinging === svc.id ? 'animate-spin text-[#58a6ff]' : ''} />
                  <span>{pinging === svc.id ? 'Probing...' : 'Probe /health'}</span>
                </button>
              </div>
            </div>

            {/* Service Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
                <span className="text-[#6e7681] block text-[9px] uppercase">Health URL</span>
                <span className="text-[#58a6ff] font-semibold truncate block mt-0.5 text-[11px]">
                  :{svc.port}/health
                </span>
              </div>
              <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
                <span className="text-[#6e7681] block text-[9px] uppercase">Uptime (24h)</span>
                <span className="text-[#c9d1d9] font-semibold block mt-0.5 text-[11px]">{svc.uptime}</span>
              </div>
              <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
                <span className="text-[#6e7681] block text-[9px] uppercase">Latency p99</span>
                <span className="text-[#3fb950] font-semibold block mt-0.5 text-[11px]">{svc.p99}</span>
              </div>
              <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
                <span className="text-[#6e7681] block text-[9px] uppercase">Environment</span>
                <span className="text-[#a371f7] font-semibold block mt-0.5 text-[11px]">{svc.env}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
