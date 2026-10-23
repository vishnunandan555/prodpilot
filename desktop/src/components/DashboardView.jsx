import React from 'react';
import {
  ShieldAlert,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  Clock,
  Flame,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Cpu,
  Radio,
  ExternalLink,
  RotateCcw,
  Layers,
  ChevronRight,
  Terminal
} from 'lucide-react';

export default function DashboardView({
  incidents = [],
  onSelectIncident,
  onNavigate,
  onTriggerCrash,
  actionLoading = false,
  apiConnected = true
}) {
  const activeIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED' && i.status !== 'ROLLED_BACK'
  );
  const resolvedIncidents = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'DEPLOYED' || i.status === 'ROLLED_BACK'
  );

  const isDegraded = activeIncidents.length > 0;
  const primaryActive = activeIncidents[0] || null;

  // Realistic time-series data points for traffic & errors
  const timelinePoints = [
    { time: '14:24', volume: 42, errors: 0 },
    { time: '14:25', volume: 55, errors: 0 },
    { time: '14:26', volume: 60, errors: 0 },
    { time: '14:27', volume: 48, errors: 0 },
    { time: '14:28', volume: 72, errors: 0 },
    { time: '14:29', volume: 65, errors: 1 },
    { time: '14:30', volume: 98, errors: isDegraded ? 8 : 0 },
    { time: '14:31', volume: 85, errors: isDegraded ? 14 : 0 },
    { time: '14:32', volume: 62, errors: isDegraded ? 6 : 0 },
    { time: '14:33', volume: 50, errors: 0 },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Banner: Matte Environment Status Bar */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-2 h-2 rounded-full ${
                isDegraded ? 'bg-[#f85149]' : 'bg-[#3fb950]'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Production Operations Center
                </h1>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold uppercase border ${
                    isDegraded
                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  }`}
                >
                  {isDegraded ? 'DEGRADED (SEV-1 ACTIVE)' : 'ALL SYSTEMS NOMINAL'}
                </span>
              </div>
              <p className="text-[11px] text-[#6e7681] mt-0.5 font-mono">
                Model 1 • Laptop Host:8765 • Cloudflare Tunnel Active • Render Edge
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerCrash}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded bg-[#1c1316] hover:bg-[#2c171d] text-[#ff7b72] border border-[#3e1b23] text-xs font-mono font-medium flex items-center gap-1.5 transition disabled:opacity-50"
              title="Simulate 500 error in demo-prod"
            >
              <Flame size={12} className="text-[#ff7b72]" />
              <span>{actionLoading ? 'Injecting...' : 'Simulate Outage'}</span>
            </button>
            <button
              onClick={() => onNavigate('incidents')}
              className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202c45] text-[#58a6ff] border border-[#2b3a58] text-xs font-mono font-medium flex items-center gap-1.5 transition"
            >
              <ShieldAlert size={12} />
              <span>Incidents ({incidents.length})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-6xl w-full mx-auto space-y-4">
        {/* Active Incident Urgent Banner (Solid Matte, No Neon Gradient) */}
        {primaryActive && (
          <div className="rounded-md bg-[#160d10] border border-[#da3633] p-4 space-y-2.5 transition">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                  <span className="px-1.5 py-0.2 rounded bg-[#da3633] text-white font-bold text-[10px] uppercase">
                    SEV-1 OUTAGE
                  </span>
                  <span className="text-[#f0f6fc] font-bold">{primaryActive.id}</span>
                  <span className="text-[#6e7681]">•</span>
                  <span className="text-[#e3b341] bg-[#1c180e] px-1.5 py-0.2 rounded border border-[#3b2e13] text-[10px]">
                    {primaryActive.status}
                  </span>
                  <span className="text-[#6e7681]">•</span>
                  <span className="text-[#8b949e]">Target: <strong className="text-[#c9d1d9]">{primaryActive.service || 'demo-prod'}</strong></span>
                </div>
                <h2 className="text-sm font-semibold text-[#f0f6fc]">
                  {primaryActive.title || 'KeyError: discount on /orders in demo-prod'}
                </h2>
                <p className="text-xs text-[#8b949e] font-mono line-clamp-1">
                  Root Cause: {primaryActive.brief?.summary || 'Missing key in dictionary access during checkout calculation'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    onSelectIncident(primaryActive);
                    onNavigate('incidents');
                  }}
                  className="px-3 py-1.5 rounded bg-[#da3633] hover:bg-[#f85149] text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <span>Open Triage</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#30161a] flex items-center gap-4 text-[11px] font-mono text-[#8b949e]">
              <span>Canary 8001: <strong className="text-[#3fb950]">READY (100% Passed)</strong></span>
              <span>•</span>
              <span>Canary 8002: <strong className="text-[#a371f7]">STANDBY</strong></span>
              <span>•</span>
              <span>Watchdog: <strong className="text-[#c9d1d9]">Armed (10s revert)</strong></span>
            </div>
          </div>
        )}

        {/* 4 Core SRE KPI Cards (Matte, High Density) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Health Status */}
          <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681]">Uptime</span>
              <Activity size={13} className={isDegraded ? 'text-[#ff7b72]' : 'text-[#3fb950]'} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : 'text-[#3fb950]'}`}>
                {isDegraded ? '98.2%' : '100%'}
              </span>
              <span className="text-[10px] text-[#485263] font-mono">24h SLA</span>
            </div>
            <p className="text-[10px] text-[#6e7681] font-mono">
              {isDegraded ? '1 service degraded' : 'Zero unhandled tracebacks'}
            </p>
          </div>

          {/* 2. Active Incidents */}
          <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681]">Active Incidents</span>
              <ShieldAlert size={13} className={activeIncidents.length > 0 ? 'text-[#e3b341]' : 'text-[#6e7681]'} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold font-mono ${activeIncidents.length > 0 ? 'text-[#e3b341]' : 'text-[#f0f6fc]'}`}>
                {activeIncidents.length}
              </span>
              <span className="text-[10px] text-[#485263] font-mono">open / {incidents.length} total</span>
            </div>
            <p className="text-[10px] text-[#6e7681] font-mono">
              {resolvedIncidents.length} resolved today
            </p>
          </div>

          {/* 3. Error Rate */}
          <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681]">5xx Error Rate</span>
              <Cpu size={13} className="text-[#58a6ff]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : 'text-[#f0f6fc]'}`}>
                {isDegraded ? '14.2%' : '0.00%'}
              </span>
              <span className="text-[10px] text-[#485263] font-mono">of requests</span>
            </div>
            <p className="text-[10px] text-[#6e7681] font-mono">
              Threshold: &gt; 1.0% triggers alert
            </p>
          </div>

          {/* 4. MTTR */}
          <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681]">Autonomous MTTR</span>
              <Zap size={13} className="text-[#e3b341]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-[#3fb950]">
                42s
              </span>
              <span className="text-[10px] text-[#485263] font-mono">avg resolution</span>
            </div>
            <p className="text-[10px] text-[#6e7681] font-mono">
              Target SLA: &lt; 90 seconds
            </p>
          </div>
        </div>

        {/* Middle Section: Monitored Services Grid & Traffic Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Services Health Grid (2 Columns) */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681] font-semibold flex items-center gap-1.5">
                <Server size={12} className="text-[#58a6ff]" />
                <span>Monitored Services & Staging Canaries</span>
              </span>
              <button
                onClick={() => onNavigate('services')}
                className="text-[11px] text-[#58a6ff] hover:underline font-mono flex items-center gap-0.5"
              >
                <span>View catalog</span>
                <ChevronRight size={11} />
              </button>
            </div>

            <div className="space-y-1.5">
              {/* Service 1: demo-prod */}
              <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-3 hover:border-[#26334f] transition">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-[#f85149]' : 'bg-[#3fb950]'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f0f6fc] font-mono">demo-prod (order_service)</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234] font-mono">
                        Port 8000
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6e7681] font-mono">
                      FastAPI • Orders microservice • Git blame enabled
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs flex-shrink-0">
                  <span className={isDegraded ? 'text-[#ff7b72] font-semibold text-[11px]' : 'text-[#3fb950] font-semibold text-[11px]'}>
                    {isDegraded ? '500 ERROR' : '200 OK'}
                  </span>
                  <div className="text-[10px] text-[#485263]">p99: 14ms</div>
                </div>
              </div>

              {/* Service 2: Canary Fix 8001 */}
              <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-3 hover:border-[#26334f] transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f0f6fc] font-mono">canary-fix-forward</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-mono">
                        Port 8001
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6e7681] font-mono">
                      Isolated Git Worktree • Antigravity Verified Patch (Green)
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs flex-shrink-0">
                  <span className="text-[#3fb950] font-semibold text-[11px]">STANDBY HEALTHY</span>
                  <div className="text-[10px] text-[#485263]">5/5 tests passed</div>
                </div>
              </div>

              {/* Service 3: Canary Rollback 8002 */}
              <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-3 hover:border-[#26334f] transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#a371f7]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f0f6fc] font-mono">canary-rollback</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#161226] text-[#a371f7] border border-[#2e2350] font-mono">
                        Port 8002
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6e7681] font-mono">
                      Known-Good Prior Git Commit • Zero Data Loss Risk
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs flex-shrink-0">
                  <span className="text-[#a371f7] font-semibold text-[11px]">REVERT READY</span>
                  <div className="text-[10px] text-[#485263]">p99: 12ms</div>
                </div>
              </div>

              {/* Service 4: Operational Engine Port 8765 */}
              <div className="p-3 rounded-md bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-3 hover:border-[#26334f] transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f0f6fc] font-mono">prodpilot-core (laptop backend)</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234] font-mono">
                        Port 8765
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6e7681] font-mono">
                      FastAPI SSE Engine • Cloudflare Tunnel Active
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs flex-shrink-0">
                  <span className="text-[#3fb950] font-semibold text-[11px]">STREAM ACTIVE</span>
                  <div className="text-[10px] text-[#485263]">SQLite Connected</div>
                </div>
              </div>
            </div>
          </div>

          {/* Epok-Style Anomaly Timeline (Matte Datadog Style) */}
          <div className="p-3.5 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681] font-semibold flex items-center gap-1.5">
                  <Activity size={12} className="text-[#58a6ff]" />
                  <span>Traffic & Anomaly Pulse</span>
                </span>
                <span className="text-[9px] font-mono text-[#6e7681]">10m window</span>
              </div>

              {/* Clean Flat Bar Chart */}
              <div className="pt-3 space-y-1">
                <div className="flex items-end justify-between gap-1.5 h-24 px-1">
                  {timelinePoints.map((pt, idx) => {
                    const volumeHeight = `${Math.min(100, Math.max(15, (pt.volume / 100) * 100))}%`;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div
                          style={{ height: volumeHeight }}
                          className={`w-full rounded-xs transition-all ${
                            pt.errors > 0
                              ? 'bg-[#da3633]'
                              : 'bg-[#21262d] group-hover:bg-[#30363d]'
                          }`}
                          title={`${pt.time}: ${pt.volume} reqs (${pt.errors} errors)`}
                        />
                        <span className="text-[8px] font-mono text-[#485263] mt-1">
                          {idx % 3 === 0 ? pt.time : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[9px] text-[#6e7681] font-mono pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-xs bg-[#21262d]" /> 200 OK Traffic
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-xs bg-[#da3633]" /> 5xx Anomaly Spike
                  </span>
                </div>
              </div>
            </div>

            {/* SRE Guardrail Indicators */}
            <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234] space-y-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#6e7681]">Safety Guard:</span>
                <span className="text-[#3fb950] font-semibold">ARMED (1 Attempt Max)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6e7681]">Anti-Loop Fingerprint:</span>
                <span className="text-[#58a6ff]">SHA-256 Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6e7681]">Watchdog Auto-Revert:</span>
                <span className="text-[#c9d1d9]">10s Health Window</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Real-Time SSE Audit Event Log */}
        <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-3.5 space-y-2">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681] font-semibold flex items-center gap-1.5">
              <Terminal size={12} className="text-[#58a6ff]" />
              <span>Real-Time Autonomous Agent Event Stream</span>
            </span>
            <span className="text-[10px] font-mono text-[#58a6ff]">Live SSE</span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            {primaryActive ? (
              <>
                <div className="flex items-start gap-2.5 p-1.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#485263] text-[10px] flex-shrink-0">14:30:12</span>
                  <span className="px-1 py-0.2 rounded bg-[#1c180e] text-[#e3b341] border border-[#3b2e13] text-[9px]">
                    STAGE 6
                  </span>
                  <span className="text-[#c9d1d9] text-[11px]">
                    Fix canary staged on Port 8001 • 100% tests passed • Awaiting developer approval
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-1.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#485263] text-[10px] flex-shrink-0">14:30:08</span>
                  <span className="px-1 py-0.2 rounded bg-[#121929] text-[#58a6ff] border border-[#1d2d47] text-[9px]">
                    STAGE 4
                  </span>
                  <span className="text-[#c9d1d9] text-[11px]">
                    Antigravity Agent generated test-driven repro `test_repro.py` (Red $\rightarrow$ Green) in isolated worktree
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-1.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#485263] text-[10px] flex-shrink-0">14:30:02</span>
                  <span className="px-1 py-0.2 rounded bg-[#261317] text-[#ff7b72] border border-[#4a1c24] text-[9px]">
                    STAGE 1
                  </span>
                  <span className="text-[#c9d1d9] text-[11px]">
                    Crash detected: KeyError 'discount' on /orders • Immediate alert sent to Telegram bot
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-3 text-[#485263] text-xs">
                All systems nominal. Log forwarder tailing production smoothly.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
