import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Server,
  Key,
  ShieldCheck,
  Send,
  Save,
  Check,
  RefreshCw,
  ExternalLink,
  Bot,
  AlertCircle,
  Cpu,
  User,
  Phone,
  PhoneCall,
  Mail,
  Camera,
  Upload,
  UserCheck,
  Globe
} from 'lucide-react';
import TwilioCallModal from './TwilioCallModal';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
];

export default function SettingsView({
  apiBaseUrl,
  onSaveApiUrl,
  apiConnected,
  currentUser,
  onUpdateUser
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'credentials'
  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [savedCreds, setSavedCreds] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    role: 'SRE',
    telegram_chat_id: '',
    bio: ''
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        avatar_url: currentUser.avatar_url || '',
        role: currentUser.role || 'SRE',
        telegram_chat_id: currentUser.telegram_chat_id || '',
        bio: currentUser.bio || ''
      });
    }
  }, [currentUser]);

  // Global settings state
  const [settings, setSettings] = useState({
    github_pat: '',
    render_api_key: '',
    telegram_bot_token: '',
    telegram_allowed_chat_id: '',
    cloudflare_tunnel_url: '',
    render_web_url: '',
    jev_api_key: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_from_number: '',
    engineer_phone: '',
    deploy_target: 'disabled'
  });

  // Test states
  const [testingGh, setTestingGh] = useState(false);
  const [ghStatus, setGhStatus] = useState(null);
  const [testingRender, setTestingRender] = useState(false);
  const [renderStatus, setRenderStatus] = useState(null);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState(null);
  const [tunnelActionLoading, setTunnelActionLoading] = useState(false);

  const handleToggleTunnel = async () => {
    setTunnelActionLoading(true);
    const isCurrentlyOnline = !!settings.cloudflare_tunnel_url;
    try {
      const endpoint = isCurrentlyOnline ? `${apiBaseUrl}/tunnel/stop` : `${apiBaseUrl}/tunnel/start`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Failed to update tunnel state');
      } else {
        setSettings((prev) => ({
          ...prev,
          cloudflare_tunnel_url: data.url || ''
        }));
      }
    } catch (err) {
      alert(`Tunnel error: ${err.message}`);
    } finally {
      setTunnelActionLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/settings`);
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setSettings({
          github_pat: s.GITHUB_PAT || '',
          render_api_key: s.RENDER_API_KEY || '',
          telegram_bot_token: s.TELEGRAM_BOT_TOKEN || '',
          telegram_allowed_chat_id: s.TELEGRAM_ALLOWED_CHAT_ID || '',
          cloudflare_tunnel_url: s.CLOUDFLARE_TUNNEL_URL || '',
          render_web_url: s.RENDER_WEB_URL || '',
          jev_api_key: s.JEV_API_KEY || s.OPENROUTER_API_KEY || '',
          twilio_account_sid: s.TWILIO_ACCOUNT_SID || '',
          twilio_auth_token: s.TWILIO_AUTH_TOKEN || '',
          twilio_from_number: s.TWILIO_FROM_NUMBER || '',
          engineer_phone: s.ENGINEER_PHONE || '',
          deploy_target: data.deploy_target || 'disabled'
        });
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [apiBaseUrl]);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    onSaveApiUrl(urlInput.trim());

    try {
      const res = await fetch(`${apiBaseUrl}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSavedCreds(true);
        setTimeout(() => setSavedCreds(false), 2500);
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Image file must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      setProfileForm((prev) => ({ ...prev, avatar_url: dataUrl }));
      setProfileError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setProfileLoading(true);
    setProfileError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profileForm.full_name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          avatar_url: profileForm.avatar_url.trim(),
          role: profileForm.role.trim(),
          telegram_chat_id: profileForm.telegram_chat_id.trim(),
          bio: profileForm.bio.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      setSavedProfile(true);
      if (onUpdateUser && data.user) {
        onUpdateUser(data.user);
      }
      setTimeout(() => setSavedProfile(false), 2500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleTestGithub = async () => {
    setTestingGh(true);
    setGhStatus(null);
    try {
      const res = await fetch(`${apiBaseUrl}/settings/test-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.github_pat })
      });
      const data = await res.json();
      setGhStatus(data);
    } catch (err) {
      setGhStatus({ ok: false, error: err.message });
    } finally {
      setTestingGh(false);
    }
  };

  const handleTestRender = async () => {
    setTestingRender(true);
    setRenderStatus(null);
    try {
      const res = await fetch(`${apiBaseUrl}/settings/test-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: settings.render_api_key })
      });
      const data = await res.json();
      setRenderStatus(data);
    } catch (err) {
      setRenderStatus({ ok: false, error: err.message });
    } finally {
      setTestingRender(false);
    }
  };

  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [activeCallData, setActiveCallData] = useState(null);

  const handleTestTwilioCall = async () => {
    if (!settings.twilio_auth_token || !settings.twilio_account_sid) {
      setTwilioStatus({ ok: false, error: 'Please enter both your Twilio Account SID and Auth Token first.' });
      return;
    }
    if (!settings.twilio_from_number) {
      setTwilioStatus({ ok: false, error: 'Please specify your Twilio From Number first.' });
      return;
    }
    if (!settings.engineer_phone) {
      setTwilioStatus({ ok: false, error: 'Please specify an On-Call Engineer Phone Number first.' });
      return;
    }
    setTestingTwilio(true);
    setTwilioStatus(null);

    try {
      // First save current twilio settings so backend has them
      await fetch(`${apiBaseUrl}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const res = await fetch(`${apiBaseUrl}/voice/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: settings.engineer_phone })
      });
      const data = await res.json();
      if (data.ok) {
        setActiveCallData(data);
        setShowTwilioModal(true);
        setTwilioStatus({ ok: true, message: `Call initiated! SID: ${data.call_sid}. Your phone should ring in a few seconds.` });
      } else {
        setTwilioStatus({ ok: false, error: data.error || 'Failed to place call via Twilio API' });
      }
    } catch (err) {
      setTwilioStatus({ ok: false, error: err.message });
    } finally {
      setTestingTwilio(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#1b2234] bg-[#0d111a] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#f0f6fc]">Settings</h1>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          title="Refresh Settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#c9d1d9] hover:text-[#f0f6fc] border border-[#222f47] text-xs font-medium transition"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-[#58a6ff]' : 'text-[#8b949e]'} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1b2234] pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <User size={14} className={activeTab === 'profile' ? 'text-[#58a6ff]' : ''} />
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'credentials'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <Key size={14} className={activeTab === 'credentials' ? 'text-[#58a6ff]' : ''} />
            <span>Integrations</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: PROFILE & ACCOUNT SETTINGS */}
        {/* ============================================================ */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {profileError && (
              <div className="p-3 rounded-lg bg-[#241316] border border-[#481c25] text-xs text-[#ff7b72] flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{profileError}</span>
              </div>
            )}

            {savedProfile && (
              <div className="p-3 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] text-xs text-[#3fb950] flex items-center gap-2">
                <Check size={15} />
                <span>Saved.</span>
              </div>
            )}

            {/* Profile Avatar Card */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#f0f6fc]">Avatar</h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="relative group w-20 h-20 rounded-full bg-[#161f30] border-2 border-[#2b3a5a] overflow-hidden flex items-center justify-center text-xl font-bold text-[#58a6ff] shadow-inner flex-shrink-0">
                  {profileForm.avatar_url ? (
                    <img
                      src={profileForm.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{(profileForm.full_name || currentUser?.username || 'A').slice(0, 2).toUpperCase()}</span>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                    title="Upload Photo"
                  >
                    <Camera size={20} />
                  </button>
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Upload size={13} />
                      <span>Upload Photo</span>
                    </button>
                    {profileForm.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, avatar_url: '' }))}
                        className="text-xs text-[#ff7b72] hover:underline px-2 py-1"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <input
                    type="url"
                    placeholder="Or paste an image URL (https://...)"
                    value={profileForm.avatar_url}
                    onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  />

                  {/* Preset Avatars */}
                  <div className="pt-1">
                    <span className="text-[10px] text-[#8b949e] font-mono block mb-1">
                      Quick Preset Avatars:
                    </span>
                    <div className="flex items-center gap-2">
                      {PRESET_AVATARS.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setProfileForm((prev) => ({ ...prev, avatar_url: url }))}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 transition ${
                            profileForm.avatar_url === url
                              ? 'border-[#58a6ff] scale-110 shadow-md'
                              : 'border-[#1b2234] hover:border-[#2f3d59] opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Identity & Contact Card */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-4">
              <h3 className="text-xs font-bold text-[#f0f6fc]">Identity & On-Call Contact Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                    Full Name <span className="text-[#ff7b72]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Damu Annan"
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser ? `@${currentUser.username}` : '@damu007'}
                    className="w-full bg-[#080b11] border border-[#1b2234] text-xs text-[#6e7681] px-3 py-2 rounded-md font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                    <Mail size={12} className="text-[#58a6ff]" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="damu@co.in"
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                    <Phone size={12} className="text-[#3fb950]" />
                    <span>Phone Number</span>
                    <span className="text-[10px] text-[#3fb950] font-mono">(Twilio Escalation)</span>
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  />
                  <p className="text-[10px] text-[#6e7681] mt-1">
                    Dials on-call engineer during unacknowledged Sev-1 incidents.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-[#58a6ff]" />
                    <span>Role / Designation</span>
                  </label>
                  <select
                    value={profileForm.role}
                    onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="SRE">Site Reliability Engineer (SRE)</option>
                    <option value="Lead SRE">Lead SRE</option>
                    <option value="DevOps Lead">DevOps Lead</option>
                    <option value="Incident Commander">Incident Commander</option>
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Engineering Manager">Engineering Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                    <Send size={12} className="text-[#58a6ff]" />
                    <span>Telegram Chat ID / User</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.telegram_chat_id}
                    onChange={(e) => setProfileForm({ ...profileForm, telegram_chat_id: e.target.value })}
                    placeholder="e.g. 8787477099 or @damu007"
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
                  />
                  <p className="text-[10px] text-[#6e7681] mt-1">
                    Receives continuous push alerts and 1-tap mobile approvals.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  On-Call Bio / Schedule Notes
                </label>
                <textarea
                  rows={2}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder="e.g. Primary on-call timezone IST (UTC+5:30), escalation point for transcoding cluster."
                  className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold flex items-center gap-2 transition shadow"
                >
                  {profileLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PLATFORM CREDENTIALS & INTEGRATIONS */}
        {/* ============================================================ */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSaveCredentials} className="space-y-5">
            {savedCreds && (
              <div className="p-3 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] text-xs text-[#3fb950] flex items-center gap-2">
                <Check size={15} />
                <span>Saved.</span>
              </div>
            )}

            {/* Backend Control Plane Status */}
            <div className="p-4 rounded-xl bg-[#0d111a] border border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${apiConnected ? 'bg-[#3fb950] animate-pulse' : 'bg-[#f85149]'}`} />
                <div>
                  <p className="text-xs font-semibold text-[#f0f6fc]">Backend</p>
                  <p className="text-[11px] text-[#8b949e]">Daemon active on port 8765</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border ${
                  apiConnected
                    ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                    : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                }`}
              >
                {apiConnected ? 'ONLINE :8765' : 'OFFLINE'}
              </span>
            </div>

            {/* 1. Global GitHub Personal Access Token (PAT) */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#f0f6fc]">
                    GitHub Token
                  </label>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Fallback token for all projects.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/settings/tokens/new?description=ProdPilot+Autonomous+SRE&scopes=repo,workflow,read:user,user:email"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-[#1f2b40] hover:bg-[#283854] text-[#79c0ff] hover:text-[#a5d6ff] border border-[#2d4265] text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                    title="Open GitHub token generator with repo, workflow, read:user permissions pre-checked"
                  >
                    <span>Generate on GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={handleTestGithub}
                    disabled={testingGh || !settings.github_pat}
                    className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition"
                  >
                    <RefreshCw size={12} className={testingGh ? 'animate-spin' : ''} />
                    <span>Test Token</span>
                  </button>
                </div>
              </div>

              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.github_pat}
                onChange={(e) => setSettings({ ...settings, github_pat: e.target.value })}
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
              />

              <div className="flex items-center gap-2 text-[11px] text-[#8b949e] flex-wrap">
                <span className="text-[#6e7681]">Required scopes:</span>
                <span className="px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono text-[10px]">repo</span>
                <span className="px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono text-[10px]">workflow</span>
                <span className="px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono text-[10px]">read:user</span>
                <span className="px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono text-[10px]">user:email</span>
              </div>

              {ghStatus && (
                <div
                  className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                    ghStatus.ok
                      ? 'bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950]'
                      : 'bg-[#261317] border border-[#4a1c24] text-[#ff7b72]'
                  }`}
                >
                  {ghStatus.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{ghStatus.ok ? `Authenticated as @${ghStatus.user?.login}` : `Error: ${ghStatus.error}`}</span>
                </div>
              )}
            </div>

            {/* 2. Global Render API Key */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#f0f6fc]">
                    Render API Key
                  </label>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Used to monitor services and trigger deployments.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://dashboard.render.com/u/settings#api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-[#1f2b40] hover:bg-[#283854] text-[#79c0ff] hover:text-[#a5d6ff] border border-[#2d4265] text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                    title="Open Render Account Settings -> API Keys"
                  >
                    <span>Get Key on Render</span>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={handleTestRender}
                    disabled={testingRender || !settings.render_api_key}
                    className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition"
                  >
                    <RefreshCw size={12} className={testingRender ? 'animate-spin' : ''} />
                    <span>Test Render Key</span>
                  </button>
                </div>
              </div>

              <input
                type="password"
                placeholder="rnd_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.render_api_key}
                onChange={(e) => setSettings({ ...settings, render_api_key: e.target.value })}
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
              />

              {renderStatus && (
                <div
                  className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                    renderStatus.ok
                      ? 'bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950]'
                      : 'bg-[#261317] border border-[#4a1c24] text-[#ff7b72]'
                  }`}
                >
                  {renderStatus.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{renderStatus.ok ? `Connected to Render (${renderStatus.services_count} services found)` : `Error: ${renderStatus.error}`}</span>
                </div>
              )}
            </div>

            {/* 3. Telegram Alert Bot */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#f0f6fc] flex items-center gap-2">
                  <Bot size={14} className="text-[#58a6ff]" />
                  <span>Telegram Alert Bot Credentials</span>
                </label>
                <p className="text-xs text-[#8b949e] mt-0.5">
                  Delivers real-time mobile notifications and enables 1-tap Approve / Rollback actions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Bot Token</label>
                  <input
                    type="password"
                    placeholder="8965014330:AAG..."
                    value={settings.telegram_bot_token}
                    onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Allowed Chat ID</label>
                  <input
                    type="text"
                    placeholder="8787477099"
                    value={settings.telegram_allowed_chat_id}
                    onChange={(e) => setSettings({ ...settings, telegram_allowed_chat_id: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>
            </div>

            {/* 4. Decision Policy Engine */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#f0f6fc] flex items-center gap-2">
                  <Cpu size={14} className="text-[#e3b341]" />
                  <span>OpenRouter Key</span>
                </label>
                <p className="text-xs text-[#8b949e] mt-0.5">
                  Used for triage scoring and canary evaluation.
                </p>
              </div>

              <input
                type="password"
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                value={settings.jev_api_key}
                onChange={(e) => setSettings({ ...settings, jev_api_key: e.target.value })}
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            {/* 5. Cloudflare Tunnel URL */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#f0f6fc] flex items-center gap-2">
                    <Globe size={14} className="text-[#58a6ff]" />
                    <span>Cloudflare Tunnel Public Base URL</span>
                  </label>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Public HTTPS ingress URL for mobile access and external incident push callbacks.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTunnel}
                  disabled={tunnelActionLoading}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0 ${
                    settings.cloudflare_tunnel_url
                      ? 'bg-[#261317] hover:bg-[#381a20] text-[#ff7b72] border border-[#4a1c24]'
                      : 'bg-[#238636] hover:bg-[#2ea043] text-white shadow-sm'
                  }`}
                >
                  <Globe size={12} className={tunnelActionLoading ? 'animate-spin' : ''} />
                  <span>
                    {tunnelActionLoading
                      ? 'Updating Tunnel...'
                      : settings.cloudflare_tunnel_url
                      ? 'Stop Tunnel'
                      : 'Create Public Tunnel'}
                  </span>
                </button>
              </div>

              <input
                type="text"
                placeholder="https://prodpilot-api.yourdomain.com"
                value={settings.cloudflare_tunnel_url}
                onChange={(e) => setSettings({ ...settings, cloudflare_tunnel_url: e.target.value })}
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            {/* 6. Twilio Voice Call Incident Escalation */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#f0f6fc] flex items-center gap-2">
                    <PhoneCall size={14} className="text-[#3fb950]" />
                    <span>Twilio Voice</span>
                  </label>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Calls on-call engineers during SEV-1 outages.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestTwilioCall}
                  disabled={testingTwilio}
                  className="px-3 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#263550] text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 flex-shrink-0"
                >
                  <PhoneCall size={12} className={testingTwilio ? 'animate-bounce text-[#3fb950]' : ''} />
                  <span>{testingTwilio ? 'Placing Call...' : 'Test Call'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.twilio_account_sid}
                    onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    placeholder="Paste Auth Token from Twilio Console"
                    value={settings.twilio_auth_token}
                    onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Twilio Virtual Phone Number (From)</label>
                  <input
                    type="text"
                    placeholder="+17372508034"
                    value={settings.twilio_from_number}
                    onChange={(e) => setSettings({ ...settings, twilio_from_number: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">Engineer On-Call Phone (To)</label>
                  <input
                    type="text"
                    placeholder="+919539916820"
                    value={settings.engineer_phone}
                    onChange={(e) => setSettings({ ...settings, engineer_phone: e.target.value })}
                    className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              {twilioStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    twilioStatus.ok
                      ? 'bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950]'
                      : 'bg-[#261317] border border-[#4a1c24] text-[#ff7b72]'
                  }`}
                >
                  {twilioStatus.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{twilioStatus.message || twilioStatus.error}</span>
                </div>
              )}
            </div>

            {/* 7. Deployment Target Adapter */}
            <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#f0f6fc] flex items-center gap-2">
                    <Server size={14} className="text-[#a371f7]" />
                    <span>Deployment Target Adapter</span>
                  </h3>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Controls where approved remediations and rollbacks are executed.
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  settings.deploy_target === 'local_process'
                    ? 'bg-[#121d2f] text-[#58a6ff] border-[#223d66]'
                    : 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                }`}>
                  {settings.deploy_target || 'DISABLED'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Target Mode:</span>
                  <span className="text-[#f0f6fc] font-mono font-medium">
                    {settings.deploy_target === 'local_process'
                      ? 'Local Process (Demo Server on Port 8000)'
                      : 'Disabled (No Production Adapter)'}
                  </span>
                </div>
                <p className="text-[11px] text-[#6e7681] leading-relaxed">
                  {settings.deploy_target === 'local_process'
                    ? 'Remediation promotions and rollbacks restart the local demo process on port 8000. Real Render cloud production deployment & rollback adapters are not currently configured.'
                    : 'No production deployment adapter is configured. Set PRODPILOT_DEPLOY_TARGET=local_process to enable the local demo server deployment adapter.'}
                </p>
              </div>
            </div>

            {/* Save Credentials Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold flex items-center gap-2 transition shadow"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Twilio Interactive Voice Testing Window Modal */}
      <TwilioCallModal
        isOpen={showTwilioModal}
        onClose={() => setShowTwilioModal(false)}
        apiUrl={apiBaseUrl}
        initialCallData={activeCallData}
        engineerPhone={settings.engineer_phone}
        twilioFrom={settings.twilio_from_number}
      />
    </div>
  );
}
