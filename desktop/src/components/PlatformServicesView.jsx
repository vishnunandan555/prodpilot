import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Bot,
  Send,
  PhoneCall,
  Activity,
  Globe,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Settings,
  Power,
  Check
} from 'lucide-react';
import { ListItemSkeleton } from './LoadingSkeleton';
import TwilioCallModal from './TwilioCallModal';

const SERVICE_ICONS = {
  jev: Zap,
  antigravity: Bot,
  telegram: Send,
  twilio: PhoneCall,
  render_watchdog: Activity,
  auto_revert: ShieldCheck,
  tunnel: Globe,
};

export default function PlatformServicesView({ apiUrl = 'http://127.0.0.1:8765', onNavigate }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [pingResults, setPingResults] = useState({});
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [confirmToggleTarget, setConfirmToggleTarget] = useState(null);
  const [togglingServiceId, setTogglingServiceId] = useState(null);

  const handleExecuteToggle = async () => {
    if (!confirmToggleTarget) return;
    const { service, nextState } = confirmToggleTarget;
    setTogglingServiceId(service.id);
    try {
      const res = await fetch(`${apiUrl}/platform-services/${service.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) {
        setServices((prev) =>
          prev.map((s) =>
            s.id === service.id
              ? {
                  ...s,
                  enabled: nextState,
                  status: nextState ? (s.configured ? 'ONLINE' : 'STANDBY') : 'MUTED',
                }
              : s
          )
        );
        fetchServices(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to update service: ${errData.detail || 'Server error'}`);
      }
    } catch (err) {
      alert(`Error toggling service: ${err.message}`);
    } finally {
      setTogglingServiceId(null);
      setConfirmToggleTarget(null);
    }
  };

  const getServiceWarning = (service, nextState) => {
    if (nextState) {
      return `Re-enabling ${service.name} immediately restores automated workloads.`;
    }
    switch (service.id) {
      case 'telegram':
        return 'Telegram alerts will stop. Updates only appear here.';
      case 'twilio':
        return 'Voice calls to on-call engineers will stop.';
      case 'render_watchdog':
        return "Health checks will pause. Incidents won't be auto-detected.";
      case 'antigravity':
        return 'Auto-remediation will stop. Incidents will still be detected.';
      case 'auto_revert':
        return "Failed deployments won't be rolled back automatically.";
      case 'tunnel':
        return 'The public tunnel will close. Remote access and webhooks will stop.';
      default:
        return `This will temporarily mute all automated workloads for ${service.name}.`;
    }
  };

  const handleToggleTunnel = async (isCurrentlyOnline) => {
    setTunnelLoading(true);
    try {
      const endpoint = isCurrentlyOnline ? `${apiUrl}/tunnel/stop` : `${apiUrl}/tunnel/start`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Failed to update tunnel state');
      }
      await fetchServices();
    } catch (err) {
      alert(`Tunnel error: ${err.message}`);
    } finally {
      setTunnelLoading(false);
    }
  };

  const servicesRef = React.useRef([]);

  const fetchServices = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/platform-services`);
      if (res.ok) {
        const data = await res.json();
        const nextServices = data.services || [];
        if (JSON.stringify(nextServices) !== JSON.stringify(servicesRef.current)) {
          servicesRef.current = nextServices;
          setServices(nextServices);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch platform services:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices(false);
    const interval = setInterval(() => fetchServices(true), 20000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handlePing = async (serviceId) => {
    setPingingId(serviceId);
    try {
      const res = await fetch(`${apiUrl}/platform-services/${serviceId}/ping`, { method: 'POST' });
      const data = await res.json();
      setPingResults((prev) => ({ ...prev, [serviceId]: data }));
      fetchServices();
    } catch (err) {
      setPingResults((prev) => ({
        ...prev,
        [serviceId]: { ok: false, error: err.message }
      }));
    } finally {
      setPingingId(null);
    }
  };

  const [callingPhone, setCallingPhone] = useState(false);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [activeCallData, setActiveCallData] = useState(null);

  const handleTestCall = async () => {
    const twilioSvc = services.find((s) => s.id === 'twilio');
    if (twilioSvc && !twilioSvc.configured) {
      setPingResults((prev) => ({
        ...prev,
        twilio: { ok: false, error: 'Twilio Auth Token and Account SID not configured. Configure in Settings.' }
      }));
      return;
    }
    setCallingPhone(true);
    try {
      const res = await fetch(`${apiUrl}/voice/test-call`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setActiveCallData(data);
        setShowTwilioModal(true);
        setPingResults((prev) => ({
          ...prev,
          twilio: { ok: true, message: `Emergency call placed to ${data.to}! Phone ringing...` }
        }));
      } else {
        setPingResults((prev) => ({
          ...prev,
          twilio: { ok: false, error: data.error || 'Failed to place call. Check Twilio credentials.' }
        }));
      }
    } catch (err) {
      setPingResults((prev) => ({
        ...prev,
        twilio: { ok: false, error: err.message }
      }));
    } finally {
      setCallingPhone(false);
    }
  };

  const onlineCount = services.filter((s) => s.status === 'ONLINE').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#1b2234] bg-[#0d111a] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <Cpu size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#f0f6fc]">Services</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono">
                {onlineCount} / {services.length} Online
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Operational status and health probes for background services
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchServices}
            disabled={loading}
            title="Refresh service status"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#c9d1d9] hover:text-[#f0f6fc] border border-[#222f47] text-xs font-medium transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#58a6ff]' : 'text-[#8b949e]'} />
            <span>Refresh Services</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-5xl w-full mx-auto space-y-4">
        {loading && services.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
            <ListItemSkeleton count={4} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.id] || Cpu;
            const isOnline = svc.status === 'ONLINE';
            const isStandby = svc.status === 'STANDBY';
            const isPinging = pingingId === svc.id;
            const pingRes = pingResults[svc.id];

            return (
              <div
                key={svc.id}
                className="p-5 rounded-xl bg-[#0e1420] border border-[#1b2438] hover:border-[#2b3a5a] transition flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                          isOnline
                            ? 'bg-[#122419] border-[#1f4a2b] text-[#3fb950]'
                            : isStandby
                            ? 'bg-[#161f30] border-[#263550] text-[#79c0ff]'
                            : 'bg-[#241a12] border-[#442c16] text-[#d29922]'
                        }`}
                      >
                        <Icon size={18} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-[#f0f6fc]">{svc.name}</h3>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#161f30] text-[#8b949e] border border-[#263550]">
                            {svc.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8b949e] mt-0.5">{svc.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase flex items-center gap-1.5 flex-shrink-0 ${
                          !svc.enabled || svc.status === 'MUTED'
                            ? 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                            : isOnline
                            ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                            : isStandby
                            ? 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                            : 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {!svc.enabled || svc.status === 'MUTED' ? 'MUTED' : svc.status}
                      </span>

                      <button
                        type="button"
                        disabled={togglingServiceId === svc.id}
                        onClick={() => setConfirmToggleTarget({ service: svc, nextState: !svc.enabled })}
                        title={svc.enabled ? `Click to mute ${svc.name}` : `Click to enable ${svc.name}`}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                          svc.enabled ? 'bg-[#238636]' : 'bg-[#21262d]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            svc.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Current Activity Box */}
                  <div className="mt-3.5 p-3 rounded-lg bg-[#080b11] border border-[#1b2438] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7681] block">
                      Current Activity
                    </span>
                    <p className="text-xs text-[#c9d1d9] font-sans leading-relaxed">
                      {svc.activity}
                    </p>
                  </div>

                  {/* Public Tunnel Active URL Strip */}
                  {svc.id === 'tunnel' && svc.tunnel_url && (
                    <div className="mt-2.5 p-2 rounded-lg bg-[#070b12] border border-[#1b2b45] flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 truncate text-[#79c0ff]">
                        <Globe size={13} className="text-[#58a6ff] shrink-0" />
                        <span className="truncate">{svc.tunnel_url}</span>
                      </div>
                      <a
                        href={svc.tunnel_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-[#8b949e] hover:text-[#58a6ff] transition shrink-0"
                        title="Open Public Tunnel in Browser"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  {/* Ping Test Result Toast / Pill */}
                  {pingRes && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                        pingRes.ok
                          ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                          : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {pingRes.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        <span className="truncate">{pingRes.message || pingRes.error}</span>
                      </div>
                      {pingRes.latency_ms && (
                        <span className="text-[10px] font-bold flex-shrink-0">{pingRes.latency_ms} ms</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer with Latency, Config Link & Ping Button */}
                <div className="flex items-center justify-between pt-3 border-t border-[#161f30] text-[11px] text-[#8b949e]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePing(svc.id)}
                      disabled={isPinging}
                      className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-[11px] font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Radio size={11} className={isPinging ? 'animate-pulse text-[#58a6ff]' : ''} />
                      <span>{isPinging ? 'Pinging...' : 'Test Service'}</span>
                    </button>

                    {svc.id === 'twilio' && (
                      <button
                        onClick={handleTestCall}
                        disabled={callingPhone || !svc.configured}
                        title={!svc.configured ? 'Twilio credentials unconfigured. Add TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN in Settings.' : 'Trigger test emergency call'}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
                          !svc.configured
                            ? 'bg-[#1b2234] text-[#8b949e] border border-[#26334f] opacity-50 cursor-not-allowed'
                            : 'bg-[#122419] hover:bg-[#1a3824] text-[#3fb950] border border-[#1f4a2b]'
                        }`}
                      >
                        <PhoneCall size={11} className={callingPhone ? 'animate-bounce text-[#3fb950]' : ''} />
                        <span>{callingPhone ? 'Calling...' : 'Call Phone'}</span>
                      </button>
                    )}

                    {svc.id === 'tunnel' && (
                      <button
                        onClick={() => handleToggleTunnel(isOnline)}
                        disabled={tunnelLoading}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50 ${
                          isOnline
                            ? 'bg-[#261317] hover:bg-[#381a20] text-[#ff7b72] border border-[#4a1c24]'
                            : 'bg-[#238636] hover:bg-[#2ea043] text-white shadow-sm'
                        }`}
                        title={isOnline ? 'Stop running tunnel' : 'Create quick Cloudflare Tunnel to expose local daemon'}
                      >
                        <Globe size={11} className={tunnelLoading ? 'animate-spin' : ''} />
                        <span>{tunnelLoading ? 'Updating Tunnel...' : isOnline ? 'Stop Tunnel' : 'Create Public Tunnel'}</span>
                      </button>
                    )}

                    {svc.latency_ms !== null && svc.latency_ms !== undefined && (
                      <span className="text-[#3fb950] font-mono text-[10px] font-semibold">
                        {svc.latency_ms} ms
                      </span>
                    )}
                  </div>

                  {svc.config_hint && (
                    <button
                      onClick={() => onNavigate && onNavigate('settings')}
                      className="text-[10px] text-[#6e7681] hover:text-[#58a6ff] hover:underline font-mono truncate max-w-[170px] flex items-center gap-1"
                    >
                      <Settings size={10} />
                      <span className="truncate">{svc.config_hint}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Toggling Platform Services */}
      {confirmToggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0e1420] border border-[#2a3854] rounded-xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmToggleTarget.nextState
                    ? 'bg-[#122419] border-[#1f4a2b] text-[#3fb950]'
                    : 'bg-[#2d1217] border-[#541f27] text-[#ff7b72]'
                }`}
              >
                {confirmToggleTarget.nextState ? <Power size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#f0f6fc]">
                  {confirmToggleTarget.nextState ? 'Enable' : 'Confirm Muting'}{' '}
                  <span className="text-[#58a6ff]">{confirmToggleTarget.service.name}</span>?
                </h3>
                <p className="text-xs text-[#8b949e]">{confirmToggleTarget.service.role}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#080b11] border border-[#1b2438] text-xs text-[#c9d1d9] leading-relaxed">
              {getServiceWarning(confirmToggleTarget.service, confirmToggleTarget.nextState)}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmToggleTarget(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#161f30] hover:bg-[#222f47] text-[#c9d1d9] border border-[#222f47] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingServiceId !== null}
                onClick={handleExecuteToggle}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition flex items-center gap-1.5 shadow-sm ${
                  confirmToggleTarget.nextState
                    ? 'bg-[#238636] hover:bg-[#2ea043]'
                    : 'bg-[#da3633] hover:bg-[#b62324]'
                }`}
              >
                {togglingServiceId ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : confirmToggleTarget.nextState ? (
                  <Check size={13} />
                ) : (
                  <Power size={13} />
                )}
                <span>
                  {confirmToggleTarget.nextState ? 'Yes, Enable Service' : 'Yes, Mute Service'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Twilio Interactive Voice Testing Window Modal */}
      <TwilioCallModal
        isOpen={showTwilioModal}
        onClose={() => setShowTwilioModal(false)}
        apiUrl={apiUrl}
        initialCallData={activeCallData}
      />
    </div>
  );
}
