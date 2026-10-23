import React, { useState } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  Zap,
  ArrowRight,
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
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? `${apiUrl}/auth/login` : `${apiUrl}/auth/signup`;
      const payload = tab === 'login'
        ? { username, password }
        : { username, password, full_name: fullName, email };

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
        onLoginSuccess(data.user, data.token);
        if (onClose) onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setUsername('admin');
    setPassword('admin');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Demo login failed');
      onLoginSuccess(data.user, data.token);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Demo login failed');
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#f0f6fc] tracking-tight">ProdPilot Identity</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  RBAC
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Operator Sign-In & Workspace Security
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-[#6e7681] hover:text-[#f0f6fc] transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-4 pb-2 flex gap-2 border-b border-[#1b2234] bg-[#0d111a]">
          <button
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex-1 pb-2 text-xs font-mono font-medium border-b-2 transition ${
              tab === 'login'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#6e7681] hover:text-[#c9d1d9]'
            }`}
          >
            Operator Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(null); }}
            className={`flex-1 pb-2 text-xs font-mono font-medium border-b-2 transition ${
              tab === 'signup'
                ? 'border-[#58a6ff] text-[#f0f6fc]'
                : 'border-transparent text-[#6e7681] hover:text-[#c9d1d9]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs font-mono flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 size={14} className="flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'signup' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Full Name</label>
                <div className="relative">
                  <User size={13} className="absolute left-2.5 top-2.5 text-[#6e7681]" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Vishnu Nandan"
                    className="w-full pl-8 pr-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-2.5 top-2.5 text-[#6e7681]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full pl-8 pr-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Username</label>
            <div className="relative">
              <User size={13} className="absolute left-2.5 top-2.5 text-[#6e7681]" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-8 pr-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Password</label>
            <div className="relative">
              <KeyRound size={13} className="absolute left-2.5 top-2.5 text-[#6e7681]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-8 pr-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium font-mono flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In as Operator' : 'Register Operator Account'}</span>
            </button>

            {tab === 'login' && (
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                className="w-full py-1.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-xs font-mono flex items-center justify-center gap-1.5 transition"
              >
                <Zap size={13} />
                <span>1-Click SRE Demo Login (admin / admin)</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
