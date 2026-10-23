import React, { useState } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  X,
  KeyRound,
  Mail,
  CheckCircle2
} from 'lucide-react';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  apiUrl = 'http://127.0.0.1:8765'
}) {
  const [tab, setTab] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Auto-dismiss success message after 3.5s
  React.useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [successMsg]);

  // Auto-dismiss error message after 6s
  React.useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  // Clear messages when modal opens or closes
  React.useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setError(null);
    setSuccessMsg(null);
  };

  const handleFieldChange = (setter, value) => {
    setter(value);
    if (error) setError(null);
    if (successMsg) setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? `${apiUrl}/auth/login` : `${apiUrl}/auth/signup`;
      const payload = tab === 'login'
        ? { username: username.trim(), password }
        : { username: username.trim(), password, full_name: fullName.trim(), email: email.trim() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setSuccessMsg(data.message || 'Authenticated successfully');
      setTimeout(() => {
        setSuccessMsg(null);
        onLoginSuccess(data.user, data.token);
        if (onClose) onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#0d111a] border border-[#1b2234] rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-[#07090f] px-5 py-4 border-b border-[#1b2234] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#1f293d] border border-[#2e3d5b] flex items-center justify-center text-white text-xs font-bold font-mono">
              P
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#f0f6fc]">
                {tab === 'login' ? 'Operator Sign In' : 'Create Operator Account'}
              </h2>
              <p className="text-xs text-[#8b949e]">
                ProdPilot Production Console
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-[#6e7681] hover:text-[#f0f6fc] p-1 rounded hover:bg-[#161b26] transition"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-[#1b2234] px-5 pt-3">
          <button
            type="button"
            onClick={() => handleTabChange('login')}
            className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition ${
              tab === 'login'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#6e7681] hover:text-[#c9d1d9]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('signup')}
            className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition ${
              tab === 'signup'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#6e7681] hover:text-[#c9d1d9]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span className="truncate">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-[#ff7b72]/70 hover:text-[#ff7b72] p-0.5 rounded transition hover:bg-[#3d181f]"
                title="Dismiss error"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={14} className="flex-shrink-0" />
                <span className="truncate">{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-[#3fb950]/70 hover:text-[#3fb950] p-0.5 rounded transition hover:bg-[#153422]"
                title="Dismiss message"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {tab === 'signup' && (
            <>
              <div>
                <label className="block text-xs text-[#8b949e] mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-2.5 text-[#6e7681]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => handleFieldChange(setFullName, e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-9 pr-3 py-2 bg-[#07090f] border border-[#1b2234] rounded text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#8b949e] mb-1 font-medium">Work Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-2.5 text-[#6e7681]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleFieldChange(setEmail, e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#07090f] border border-[#1b2234] rounded text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-[#8b949e] mb-1 font-medium">Username</label>
            <div className="relative">
              <User size={13} className="absolute left-3 top-2.5 text-[#6e7681]" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => handleFieldChange(setUsername, e.target.value)}
                placeholder="username"
                className="w-full pl-9 pr-3 py-2 bg-[#07090f] border border-[#1b2234] rounded text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#8b949e] mb-1 font-medium">Password</label>
            <div className="relative">
              <KeyRound size={13} className="absolute left-3 top-2.5 text-[#6e7681]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => handleFieldChange(setPassword, e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-[#07090f] border border-[#1b2234] rounded text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
