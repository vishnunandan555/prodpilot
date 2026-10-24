import React, { useState } from 'react';
import {
  X,
  Plus,
  AlertCircle,
  Tag,
  PenTool,
  Eye,
  Send,
  Loader2,
  Check,
  Bold,
  Italic,
  Code,
  Quote,
  List
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const SUGGESTED_LABELS = [
  { name: 'incident', color: 'ff7b72' },
  { name: 'bug', color: 'd73a4a' },
  { name: 'high', color: 'f0883e' },
  { name: 'enhancement', color: 'a2eeef' },
  { name: 'documentation', color: '0075ca' },
  { name: 'sev-1', color: 'b60205' }
];

export default function NewIssueModal({
  isOpen,
  onClose,
  projectId,
  apiUrl,
  onIssueCreated
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleLabel = (labelName) => {
    setSelectedLabels((prev) =>
      prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
    );
  };

  const handleAddCustomLabel = (e) => {
    e.preventDefault();
    const clean = customLabelInput.trim().toLowerCase();
    if (clean && !selectedLabels.includes(clean)) {
      setSelectedLabels((prev) => [...prev, clean]);
      setCustomLabelInput('');
    }
  };

  const insertMarkdown = (before, after = '') => {
    setBody((prev) => `${prev}${before}${after}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Issue title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          labels: selectedLabels
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to create issue on GitHub');
      }

      // Reset and callback
      setTitle('');
      setBody('');
      setSelectedLabels([]);
      if (onIssueCreated) {
        onIssueCreated(data.issue || data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create issue:', err);
      setError(err.message || 'Error creating issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b1019] border border-[#1b263b] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b263b] bg-[#0e1524]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#238636]" />
            <h2 className="text-sm font-semibold text-[#f0f6fc]">Create New Issue</h2>
            <span className="text-xs text-[#8b949e]">in GitHub Repository</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#162032] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#261317] border border-[#4a1c24] rounded-lg text-xs text-[#ff7b72]">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1.5">
              Title <span className="text-[#ff7b72]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. [Incident] High memory consumption on worker-3"
              className="w-full px-3 py-2 bg-[#090d16] border border-[#212e48] rounded-lg text-xs text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition"
              required
            />
          </div>

          {/* Labels Selector */}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Labels</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {SUGGESTED_LABELS.map((lbl) => {
                const isSelected = selectedLabels.includes(lbl.name);
                return (
                  <button
                    key={lbl.name}
                    type="button"
                    onClick={() => toggleLabel(lbl.name)}
                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-mono transition border ${
                      isSelected
                        ? 'bg-[#1f2b40] text-[#79c0ff] border-[#388bfd]'
                        : 'bg-[#121824] text-[#8b949e] border-[#1b263b] hover:border-[#2b3a5a]'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: `#${lbl.color}` }}
                    />
                    <span>{lbl.name}</span>
                    {isSelected && <Check size={11} className="text-[#58a6ff]" />}
                  </button>
                );
              })}
            </div>

            {/* Custom label addition */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                placeholder="Add custom label..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomLabel(e);
                  }
                }}
                className="w-44 px-2.5 py-1 bg-[#090d16] border border-[#212e48] rounded-md text-[11px] text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#388bfd]"
              />
              <button
                type="button"
                onClick={handleAddCustomLabel}
                className="px-2 py-1 rounded bg-[#162032] hover:bg-[#1f2b40] text-[#79c0ff] border border-[#273855] text-[11px] font-medium transition"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Body with Write / Preview Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#8b949e]">Description (Markdown)</label>
              <div className="flex items-center bg-[#090d16] border border-[#1b263b] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded transition ${
                    activeTab === 'write'
                      ? 'bg-[#162032] text-[#79c0ff] font-medium'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'
                  }`}
                >
                  <PenTool size={11} />
                  <span>Write</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded transition ${
                    activeTab === 'preview'
                      ? 'bg-[#162032] text-[#79c0ff] font-medium'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'
                  }`}
                >
                  <Eye size={11} />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {activeTab === 'write' ? (
              <div className="border border-[#212e48] rounded-lg overflow-hidden focus-within:border-[#388bfd] transition">
                {/* Markdown Formatting Toolbar */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0e1524] border-b border-[#1b263b] text-[#8b949e]">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                    title="Bold"
                  >
                    <Bold size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                    title="Italic"
                  >
                    <Italic size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('```\n', '\n```')}
                    className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                    title="Code block"
                  >
                    <Code size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('> ')}
                    className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                    title="Quote"
                  >
                    <Quote size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('- ')}
                    className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                    title="List"
                  >
                    <List size={12} />
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the issue, reproduction steps, error traces, or expected behavior... (Markdown supported)"
                  rows={8}
                  className="w-full p-3 bg-[#090d16] text-xs text-[#f0f6fc] placeholder-[#484f58] focus:outline-none resize-y"
                />
              </div>
            ) : (
              <div className="p-3 bg-[#090d16] border border-[#212e48] rounded-lg min-h-[190px] max-h-[300px] overflow-y-auto">
                {body.trim() ? (
                  <MarkdownRenderer content={body} />
                ) : (
                  <p className="text-xs text-[#484f58] italic">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b263b]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-[#121824] hover:bg-[#1b2438] text-[#8b949e] hover:text-[#f0f6fc] text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Submitting to GitHub...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Submit New Issue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
