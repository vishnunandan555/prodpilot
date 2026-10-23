import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  PhoneCall,
  Send,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Radio,
  Calendar,
  Plus,
  RefreshCw,
  User,
  ShieldAlert
} from 'lucide-react';

export default function TeamView({ apiUrl = 'http://127.0.0.1:8765', currentUser = null }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('sre');
  const [password, setPassword] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.warn('Failed to fetch team users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [apiUrl]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          role,
          password: password || 'prodpilot123',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create team member');
      }

      setShowAddModal(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      setAddError(err.message || 'Failed to add user');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Users size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  On-Call Team & Team Accounts
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  {users.length} MEMBERS
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Operator credentials, escalation privileges & SRE on-call rotation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Plus size={13} />
              <span>Add Member</span>
            </button>
            <button
              onClick={fetchUsers}
              className="p-1 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#8b949e] hover:text-[#f0f6fc] transition"
              title="Refresh team members"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Escalation Policy Matrix */}
        <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2.5">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#8b949e] font-semibold flex items-center gap-2">
              <Bell size={14} className="text-[#58a6ff]" />
              <span>Automated Incident Escalation Ladder</span>
            </h2>
            <span className="text-[10px] font-mono text-[#58a6ff]">Target MTTA &lt; 5s · MTTD &lt; 10s</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#121929] text-[#58a6ff] font-bold border border-[#1d2d47] text-[10px]">
                  TIER 0
                </span>
                <span className="text-[10px] text-[#3fb950]">Autonomous</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc] text-xs">Autonomous Agent Fleet</h3>
              <p className="text-[11px] text-[#6e7681]">
                Google Antigravity SDK generates repro tests and stages isolated fix forward.
              </p>
            </div>

            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#1c180e] text-[#e3b341] font-bold border border-[#3b2e13] text-[10px]">
                  TIER 1
                </span>
                <span className="text-[10px] text-[#e3b341]">Immediate</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc] text-xs">Primary On-Call SRE</h3>
              <p className="text-[11px] text-[#6e7681]">
                Mobile push via Telegram bot. 1-tap approve or rollback decision within 60s.
              </p>
            </div>

            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#261317] text-[#ff7b72] font-bold border border-[#4a1c24] text-[10px]">
                  TIER 2
                </span>
                <span className="text-[10px] text-[#ff7b72]">Escalation</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc] text-xs">Secondary Engineering Lead</h3>
              <p className="text-[11px] text-[#6e7681]">
                Automated escalation if no developer decision is acknowledged within 5 minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Real Team Accounts List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e]">
              Registered Team Operators ({users.length})
            </h2>
            <span className="text-[10px] font-mono text-[#6e7681]">Synced from database `users`</span>
          </div>

          {users.length === 0 ? (
            <div className="p-8 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-2">
              <Users size={24} className="mx-auto text-[#6e7681]" />
              <p className="text-xs font-mono text-[#c9d1d9]">No team members registered yet</p>
              <p className="text-[11px] font-mono text-[#8b949e]">
                Add an on-call engineer or administrator account to handle incident approvals.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono inline-flex items-center gap-1.5 transition"
              >
                <Plus size={13} />
                <span>Add First Member</span>
              </button>
            </div>
          ) : (
            users.map((u) => {
              const isCurrent = currentUser?.username === u.username;
              return (
                <div
                  key={u.id}
                  className={`p-3.5 rounded-lg bg-[#0d111a] border transition font-mono ${
                    isCurrent ? 'border-[#388bfd] border-l-4 border-l-[#58a6ff]' : 'border-[#1b2234]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
                        <User size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#f0f6fc]">{u.full_name || u.username}</span>
                          <span className="text-[10px] text-[#6e7681]">(@{u.username})</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#07090f] text-[#58a6ff] border border-[#1b2234] uppercase font-bold">
                            {u.role || 'SRE'}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-bold">
                              YOU (CURRENT SESSION)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8b949e] mt-0.5">
                          {u.email || 'No email provided'} • Joined: {u.created_at || 'Recently'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] text-[10px]">
                        ACTIVE OPERATOR
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Team Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d111a] border border-[#1b2234] rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-[#07090f] px-5 py-4 border-b border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#58a6ff]" />
                <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">Add Team Member / SRE</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[#6e7681] hover:text-[#f0f6fc]">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-5 space-y-3">
              {addError && (
                <div className="p-2.5 rounded bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs font-mono">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alex_sre"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@prodpilot.io"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none"
                >
                  <option value="sre">SRE (Site Reliability Engineer)</option>
                  <option value="admin">Administrator (Full Access)</option>
                  <option value="lead">Engineering Lead</option>
                  <option value="viewer">Observer / Read-Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••• (default: prodpilot123)"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-mono text-[#8b949e]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono disabled:opacity-50"
                >
                  {addLoading ? 'Creating Member...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
