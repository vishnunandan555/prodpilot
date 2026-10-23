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
  Settings
} from 'lucide-react';
import { ListItemSkeleton } from './LoadingSkeleton';
import TwilioCallModal from './TwilioCallModal';

const SERVICE_ICONS = {
  jev: Zap,
  antigravity: Bot,
  telegram: Send,
  twilio: PhoneCall,
  render_watchdog: Activity,
  tunnel: Globe,
};

export default function PlatformServicesView({ apiUrl = 'http://127.0.0.1:8765', onNavigate }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [pingResults, setPingResults] = useState({});

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/platform-services`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch (err) {
      console.warn('Failed to fetch platform services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 6000);
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
    setCallingPhone(true);
    setShowTwilioModal(true);
    setActiveCallData({ status: 'initiating' });
    try {
      const res = await fetch(`${apiUrl}/voice/test-call`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setActiveCallData(data);
        setPingResults((prev) => ({
          ...prev,
          twilio: { ok: true, message: `Emergency call placed to ${data.to}! Phone ringing...` }
        }));
      } else {
        setPingResults((prev) => ({
          ...prev,
          twilio: { ok: false, error: data.error || 'Failed to place call' }
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
              <h1 className="text-sm font-bold text-[#f0f6fc]">Platform Services</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono">
                {onlineCount} / {services.length} Online
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Health, live availability, and active background workloads of ProdPilot's core engines
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

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase flex items-center gap-1.5 flex-shrink-0 ${
                        isOnline
                          ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                          : isStandby
                          ? 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                          : 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {svc.status}
                    </span>
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
                        disabled={callingPhone}
                        className="px-2.5 py-1 rounded bg-[#122419] hover:bg-[#1a3824] text-[#3fb950] border border-[#1f4a2b] text-[11px] font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <PhoneCall size={11} className={callingPhone ? 'animate-bounce text-[#3fb950]' : ''} />
                        <span>{callingPhone ? 'Calling...' : 'Call Phone'}</span>
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
