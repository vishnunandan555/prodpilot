import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  Camera,
  Upload,
  Check,
  X,
  ShieldCheck,
  Send,
  Sparkles,
  Save,
  AlertCircle
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
];

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  apiUrl = 'http://127.0.0.1:8765',
  onUpdateUser
}) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    role: 'SRE',
    telegram_chat_id: '',
    bio: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setForm({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        avatar_url: currentUser.avatar_url || '',
        role: currentUser.role || 'SRE',
        telegram_chat_id: currentUser.telegram_chat_id || '',
        bio: currentUser.bio || ''
      });
      setError(null);
      setSuccess(null);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image file must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      setForm((prev) => ({ ...prev, avatar_url: dataUrl }));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          avatar_url: form.avatar_url.trim(),
          role: form.role.trim(),
          telegram_chat_id: form.telegram_chat_id.trim(),
          bio: form.bio.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      if (onUpdateUser && data.user) {
        onUpdateUser(data.user);
      }
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-xl bg-[#0e1420] border border-[#23314d] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1b2438] bg-[#121824] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
              <User size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f0f6fc]">Manage Profile & Account</h3>
              <p className="text-[11px] text-[#8b949e]">
                Personalize your on-call identity, avatar, and emergency alert channels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#f0f6fc] text-xl leading-none p-1 rounded hover:bg-[#1a2334] transition"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#241316] border border-[#481c25] text-xs text-[#ff7b72] flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] text-xs text-[#3fb950] flex items-center gap-2">
              <Check size={15} className="flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Profile Photo & Avatar Section */}
          <div className="p-4 rounded-xl bg-[#080b11] border border-[#1b2234] space-y-3">
            <label className="block text-xs font-semibold text-[#f0f6fc]">
              Profile Photo & Avatar
            </label>

            <div className="flex items-center gap-4">
              {/* Avatar Preview */}
              <div className="relative group">
                <div className="w-16 h-16 rounded-full bg-[#161f30] border-2 border-[#2b3a5a] overflow-hidden flex items-center justify-center text-lg font-bold text-[#58a6ff] shadow-inner">
                  {form.avatar_url ? (
                    <img
                      src={form.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{(form.full_name || currentUser.username || 'A').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                  title="Upload Photo"
                >
                  <Camera size={18} />
                </button>
              </div>

              {/* Upload & URL input */}
              <div className="flex-1 space-y-2">
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
                    <Upload size={12} />
                    <span>Upload Image</span>
                  </button>
                  {form.avatar_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, avatar_url: '' }))}
                      className="text-xs text-[#ff7b72] hover:underline px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  type="url"
                  placeholder="Or paste an image URL (https://...)"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
            </div>

            {/* Quick Preset Selector */}
            <div>
              <span className="text-[10px] text-[#8b949e] font-mono block mb-1.5">
                Or choose a preset avatar:
              </span>
              <div className="flex items-center gap-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatar_url: url }))}
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 transition ${
                      form.avatar_url === url
                        ? 'border-[#58a6ff] scale-110 shadow-md'
                        : 'border-[#1b2234] hover:border-[#2f3d59] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Identity Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                value={`@${currentUser.username}`}
                className="w-full bg-[#0a0e17] border border-[#1b2438] text-xs text-[#6e7681] px-3 py-2 rounded-md font-mono cursor-not-allowed"
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="damu@company.io"
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                <Phone size={12} className="text-[#3fb950]" />
                <span>Phone Number</span>
                <span className="text-[10px] text-[#3fb950] font-mono">(Twilio Voice)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
              />
              <p className="text-[10px] text-[#6e7681] mt-1">
                Dials your phone directly during unacknowledged Sev-1 incidents.
              </p>
            </div>
          </div>

          {/* Role & Telegram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#c9d1d9] mb-1 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-[#58a6ff]" />
                <span>Role / Designation</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
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
                value={form.telegram_chat_id}
                onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                placeholder="e.g. 8787477099 or @username"
                className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff]"
              />
              <p className="text-[10px] text-[#6e7681] mt-1">
                Receives 1-tap mobile approval callbacks.
              </p>
            </div>
          </div>

          {/* Bio / On-Call Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
              On-Call Bio / Schedule Notes
            </label>
            <textarea
              rows={2}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="e.g. Primary on-call timezone IST (UTC+5:30), escalation point for transcoding cluster."
              className="w-full bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-md focus:outline-none focus:border-[#58a6ff] resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1b2438]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#8b949e] hover:text-[#c9d1d9] text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
