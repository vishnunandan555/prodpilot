import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  Plus,
  RefreshCw,
  Trash2,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

export default function TeamView({ apiUrl = 'http://127.0.0.1:8765', currentUser = null, onOpenProfile = null }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(null);

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

  const handleOpenAddModal = () => {
    setAddError(null);
    setAddSuccess(null);
    setForm({
      username: '',
      full_name: '',
      email: '',
      phone: '',
      password: ''
    });
    setShowAddModal(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.full_name.trim()) {
      setAddError('Username and Full Name are required.');
      return;
    }

    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password || 'prodpilot123',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to add team member');
      }

      setAddSuccess(`Team member '${data.user?.full_name || form.username}' added successfully`);
      setTimeout(() => {
        setShowAddModal(false);
        fetchUsers();
      }, 600);
    } catch (err) {
      setAddError(err.message || 'Failed to add user');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteUser = async (userId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the on-call team?`)) return;
    try {
      const res = await fetch(`${apiUrl}/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      alert('Failed to remove user: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#1b2234] bg-[#0d111a] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#f0f6fc]">On-Call Team Roster</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono">
                {users.length} {users.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Manually registered team operators and on-call escalation contacts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUsers}
            title="Refresh team members"
            className="p-1.5 rounded-md bg-[#121824] border border-[#222f47] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1a2334] transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#58a6ff]' : ''} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-4xl w-full mx-auto space-y-4">
        {users.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#121824] border border-[#222f47] flex items-center justify-center text-[#8b949e] mx-auto">
              <Users size={22} />
            </div>
            <h3 className="text-sm font-bold text-[#f0f6fc]">No Team Members Registered</h3>
            <p className="text-xs text-[#8b949e] max-w-md mx-auto">
              Add your on-call engineers to route incident notifications, Telegram approval callbacks, and emergency voice alerts.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow"
            >
              <Plus size={14} />
              <span>Add First Team Member</span>
            </button>
          </div>
        ) : (
          /* Real Users Roster */
          <div className="space-y-2.5">
            {users.map((u) => {
              const isCurrent = currentUser?.username === u.username;
              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl bg-[#0e1420] border transition flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'border-[#388bfd] bg-[#0e1626]'
                      : 'border-[#1b2438] hover:border-[#2b3a5a]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#161f30] border border-[#263550] overflow-hidden flex items-center justify-center text-[#58a6ff] font-bold text-xs flex-shrink-0">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.username}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        (u.full_name || u.username).slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#f0f6fc]">
                          {u.full_name || u.username}
                        </span>
                        <span className="text-[11px] text-[#8b949e] font-mono">
                          @{u.username}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] uppercase font-semibold">
                          {u.role || 'SRE'}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.2 rounded font-bold font-mono bg-[#14261d] text-[#3fb950] border border-[#1e462d]">
                            YOU (CURRENT SESSION)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1.5 text-[11px] text-[#8b949e] flex-wrap">
                        {u.email && (
                          <span className="flex items-center gap-1 text-[#c9d1d9]">
                            <Mail size={12} className="text-[#58a6ff]" />
                            <span>{u.email}</span>
                          </span>
                        )}

                        {u.phone && (
                          <span className="flex items-center gap-1 text-[#c9d1d9]">
                            <Phone size={12} className="text-[#3fb950]" />
                            <span>{u.phone}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-[#6e7681]">
                          <Clock size={11} />
                          <span>Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recently'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent && onOpenProfile && (
                      <button
                        onClick={onOpenProfile}
                        className="px-2.5 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <User size={13} />
                        <span>Edit Profile</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(u.id, u.full_name || u.username)}
                      title="Remove Member"
                      className="p-1.5 rounded-lg bg-[#1f1519] border border-[#3e1d25] text-[#ff7b72] hover:bg-[#341b23] transition text-xs flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline text-[11px]">Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e1420] border border-[#23314d] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="px-5 py-4 border-b border-[#1b2438] flex items-center justify-between bg-[#121824]">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#58a6ff]" />
                <h3 className="text-xs font-bold text-[#f0f6fc]">Add Team Member</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8b949e] hover:text-[#f0f6fc] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-5 space-y-3.5">
              {addError && (
                <div className="p-2.5 rounded-lg bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccess && (
                <div className="p-2.5 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0" />
                  <span>{addSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Full Name <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Damu Annan"
                  className="w-full px-3 py-2 bg-[#080b11] border border-[#222f47] rounded-lg text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Username <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g. damu007"
                  className="w-full px-3 py-2 bg-[#080b11] border border-[#222f47] rounded-lg text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Email Address <span className="text-[#8b949e] font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. damu@co.in"
                  className="w-full px-3 py-2 bg-[#080b11] border border-[#222f47] rounded-lg text-xs text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Phone Number <span className="text-[#8b949e] font-normal">(Optional - for Twilio call alerts)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +14155552671"
                  className="w-full px-3 py-2 bg-[#080b11] border border-[#222f47] rounded-lg text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Default: prodpilot123"
                  className="w-full px-3 py-2 bg-[#080b11] border border-[#222f47] rounded-lg text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1b2438]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#1f2b40] text-[#c9d1d9] text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
