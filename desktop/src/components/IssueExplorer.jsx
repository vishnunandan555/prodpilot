import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Clock,
  Tag,
  User,
  Edit3,
  Check,
  X,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Flame,
  CheckSquare,
  Bold,
  Italic,
  Code,
  Quote,
  List,
  PenTool,
  Eye,
  Bot
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { formatDate, formatRelativeTime } from '../utils/formatters';

export default function IssueExplorer({
  issue: initialIssue,
  projectId,
  apiUrl,
  onBack,
  onIssueUpdated
}) {
  const [issue, setIssue] = useState(initialIssue);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState('');

  // Edit Issue state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialIssue.title || '');
  const [editBody, setEditBody] = useState(initialIssue.body || '');
  const [editTab, setEditTab] = useState('write');
  const [updating, setUpdating] = useState(false);

  // New Comment state
  const [commentText, setCommentText] = useState('');
  const [commentTab, setCommentTab] = useState('write');
  const [postingComment, setPostingComment] = useState(false);

  // AI Triage state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiPosting, setAiPosting] = useState(false);

  // Fetch comments from GitHub
  const fetchComments = async () => {
    if (!projectId || !issue?.number) return;
    setLoadingComments(true);
    setCommentsError('');
    try {
      const res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setCommentsError(errData.detail || 'Failed to fetch comments');
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setCommentsError(err.message || 'Error fetching comments');
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    setIssue(initialIssue);
    setEditTitle(initialIssue.title || '');
    setEditBody(initialIssue.body || '');
    fetchComments();
  }, [initialIssue?.number, projectId]);

  // Extract linked incident ID if present in title or body
  const linkedIncidentId = (() => {
    const text = `${issue.title || ''} ${issue.body || ''}`;
    const match = text.match(/(inc-\d{14}-[a-f0-9]{4})/i) || text.match(/(inc-\d+-[a-f0-9]+)/i);
    return match ? match[1] : null;
  })();

  // Handle Save Issue Edits
  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to update issue');

      const updated = data.issue || { ...issue, title: editTitle, body: editBody };
      setIssue(updated);
      setIsEditing(false);
      if (onIssueUpdated) onIssueUpdated(updated);
    } catch (err) {
      alert(`Error updating issue: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Handle State Toggle (Close / Reopen)
  const handleToggleState = async (newState, stateReason = 'completed') => {
    setUpdating(true);
    try {
      let res;
      if (newState.toLowerCase() === 'closed') {
        res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state_reason: stateReason })
        });
      } else {
        res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'open', state_reason: 'reopened' })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to change state');

      const updated = data.issue || {
        ...issue,
        state: newState.toUpperCase(),
        state_reason: stateReason
      };
      setIssue(updated);
      if (onIssueUpdated) onIssueUpdated(updated);
    } catch (err) {
      alert(`Error changing state: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Handle Post Comment
  const handlePostComment = async (andClose = false) => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to post comment');

      setCommentText('');
      setCommentTab('write');

      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      } else {
        await fetchComments();
      }

      if (andClose && issue.state.toLowerCase() === 'open') {
        await handleToggleState('closed', 'completed');
      }
    } catch (err) {
      alert(`Error posting comment: ${err.message}`);
    } finally {
      setPostingComment(false);
    }
  };

  // Run AI Triage Analysis
  const handleRunAiAnalysis = async () => {
    setAiAnalyzing(true);
    try {
      const res = await fetch(`${apiUrl}/issues/${issue.number}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: issue.title,
          body: issue.body,
          author: issue.author,
          repo: projectId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
      } else {
        alert('AI Analysis failed to generate brief');
      }
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Post AI Triage Note to GitHub
  const handlePostAiTriageNote = async () => {
    if (!aiAnalysis) return;
    setAiPosting(true);
    try {
      const triageComment = `### 🤖 ProdPilot AI Incident Triage Brief
**Readiness Gate:** ${aiAnalysis.ready ? '✅ READY FOR REMEDIATION' : '⚠️ REQUIRES CLARIFICATION'}
**Suspected Area:** \`${aiAnalysis.suspected_area || 'Core runtime'}\`

#### Summary
${aiAnalysis.task_summary || 'No summary generated.'}

${
  aiAnalysis.clarifying_questions?.length > 0
    ? `#### Clarifying Questions
${aiAnalysis.clarifying_questions.map((q) => `- ${q}`).join('\n')}`
    : ''
}

*Automated triage generated by ProdPilot Autonomous SRE.*`;

      const res = await fetch(`${apiUrl}/projects/${projectId}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: triageComment })
      });
      if (res.ok) {
        await fetchComments();
        alert('AI Triage Note posted to GitHub comments!');
      }
    } catch (err) {
      alert(`Failed to post AI note: ${err.message}`);
    } finally {
      setAiPosting(false);
    }
  };

  const isOpen = (issue.state || 'OPEN').toUpperCase() === 'OPEN';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1b263b] flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121824] hover:bg-[#1a2335] text-[#8b949e] hover:text-[#f0f6fc] text-xs font-medium border border-[#1e2a3e] transition"
          >
            <ArrowLeft size={13} />
            <span>All Issues</span>
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOpen
                  ? 'bg-[#12281e] text-[#3fb950] border-[#1b432e]'
                  : 'bg-[#211833] text-[#a371f7] border-[#38265a]'
              }`}
            >
              {isOpen ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-[#3fb950]" />
                  <span>Open</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="text-[#a371f7]" />
                  <span>Closed</span>
                </>
              )}
            </span>
            <span className="text-xs font-mono text-[#8b949e]">#{issue.number}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isOpen ? (
            <button
              onClick={() => handleToggleState('closed', 'completed')}
              disabled={updating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#202d44] text-[#a371f7] border border-[#2b2b48] text-xs font-medium transition"
              title="Close issue on GitHub"
            >
              <CheckCircle2 size={13} />
              <span>Close Issue</span>
            </button>
          ) : (
            <button
              onClick={() => handleToggleState('open', 'reopened')}
              disabled={updating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#12281e] hover:bg-[#183628] text-[#3fb950] border border-[#1b432e] text-xs font-medium transition"
              title="Reopen issue on GitHub"
            >
              <RefreshCw size={13} />
              <span>Reopen Issue</span>
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              isEditing
                ? 'bg-[#1f2b40] text-[#79c0ff] border-[#388bfd]'
                : 'bg-[#121824] hover:bg-[#1a2335] text-[#8b949e] hover:text-[#f0f6fc] border-[#1e2a3e]'
            }`}
          >
            <Edit3 size={13} />
            <span>{isEditing ? 'Cancel Edit' : 'Edit Issue'}</span>
          </button>

          {issue.html_url && (
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#202d44] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
            >
              <span>View on GitHub</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Main Two-Column Platform Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Issue Post, Timeline, Comment Composer (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Issue Header Post Card */}
          <div className="bg-[#0b1019] border border-[#1b263b] rounded-xl overflow-hidden shadow-sm">
            {/* Author bar */}
            <div className="px-5 py-3.5 bg-[#0e1524] border-b border-[#1b263b] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {issue.author_avatar ? (
                  <img
                    src={issue.author_avatar}
                    alt={issue.author}
                    className="w-6 h-6 rounded-full border border-[#273855]"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#1b263b] flex items-center justify-center text-[10px] text-[#79c0ff] font-bold">
                    {issue.author?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-xs font-semibold text-[#f0f6fc]">{issue.author}</span>
                {issue.author?.includes('[bot]') && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-[#1f2b40] text-[#79c0ff] border border-[#273855] uppercase font-mono">
                    <Bot size={9} /> bot
                  </span>
                )}
                <span className="text-[11px] text-[#8b949e]">
                  opened on {formatDate(issue.created_at)}
                </span>
              </div>

              <span className="text-[11px] text-[#8b949e]">
                {formatRelativeTime(issue.created_at)}
              </span>
            </div>

            {/* Content area: Read Mode vs In-place Edit Mode */}
            <div className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8b949e] mb-1">
                      Issue Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-[#090d16] border border-[#212e48] rounded-lg text-xs text-[#f0f6fc] focus:outline-none focus:border-[#388bfd]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-[#8b949e]">
                        Issue Body (Markdown)
                      </label>
                      <div className="flex items-center bg-[#090d16] border border-[#1b263b] rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditTab('write')}
                          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                            editTab === 'write' ? 'bg-[#162032] text-[#79c0ff]' : 'text-[#8b949e]'
                          }`}
                        >
                          <PenTool size={11} /> Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTab('preview')}
                          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                            editTab === 'preview'
                              ? 'bg-[#162032] text-[#79c0ff]'
                              : 'text-[#8b949e]'
                          }`}
                        >
                          <Eye size={11} /> Preview
                        </button>
                      </div>
                    </div>

                    {editTab === 'write' ? (
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={10}
                        className="w-full p-3 bg-[#090d16] border border-[#212e48] rounded-lg text-xs text-[#f0f6fc] focus:outline-none focus:border-[#388bfd]"
                      />
                    ) : (
                      <div className="p-4 bg-[#090d16] border border-[#212e48] rounded-lg min-h-[200px]">
                        <MarkdownRenderer content={editBody} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={updating}
                      className="px-3 py-1.5 rounded-lg bg-[#121824] text-[#8b949e] hover:text-[#f0f6fc] text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={updating}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium"
                    >
                      {updating ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-base font-bold text-[#f0f6fc] mb-4">{issue.title}</h1>
                  <MarkdownRenderer
                    content={issue.body || '*No description provided for this issue.*'}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Activity & Comments Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-[#58a6ff]" />
                <h3 className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider">
                  Discussion Activity ({comments.length})
                </h3>
              </div>
              <button
                onClick={fetchComments}
                disabled={loadingComments}
                className="text-xs text-[#8b949e] hover:text-[#79c0ff] flex items-center gap-1"
                title="Refresh comments"
              >
                <RefreshCw size={11} className={loadingComments ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingComments && comments.length === 0 ? (
              <div className="p-8 text-center bg-[#0b1019] border border-[#1b263b] rounded-xl">
                <Loader2 size={20} className="animate-spin text-[#58a6ff] mx-auto mb-2" />
                <p className="text-xs text-[#8b949e]">Loading comments from GitHub...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="p-8 text-center bg-[#0b1019] border border-dashed border-[#1b263b] rounded-xl">
                <MessageSquare size={22} className="mx-auto text-[#484f58] mb-2" />
                <p className="text-xs text-[#f0f6fc] font-medium">No comments yet</p>
                <p className="text-[11px] text-[#8b949e] mt-1">
                  Start the discussion or post an automated triage note below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#0b1019] border border-[#1b263b] rounded-xl overflow-hidden shadow-sm hover:border-[#263753] transition"
                  >
                    <div className="px-4 py-2.5 bg-[#0e1524] border-b border-[#1b263b] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {c.author_avatar ? (
                          <img
                            src={c.author_avatar}
                            alt={c.author}
                            className="w-5 h-5 rounded-full border border-[#273855]"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#1b263b] flex items-center justify-center text-[10px] text-[#79c0ff] font-bold">
                            {c.author?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <span className="font-semibold text-[#f0f6fc]">{c.author}</span>
                        {c.author?.includes('[bot]') && (
                          <span className="text-[9px] px-1 py-0.1 rounded bg-[#1f2b40] text-[#79c0ff] border border-[#273855] font-mono">
                            bot
                          </span>
                        )}
                        <span className="text-[11px] text-[#8b949e]">
                          commented {formatRelativeTime(c.created_at)}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6e7681] font-mono">
                        {formatDate(c.created_at)}
                      </span>
                    </div>

                    <div className="p-4">
                      <MarkdownRenderer content={c.body} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Comment Composer */}
          <div className="bg-[#0b1019] border border-[#1b263b] rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-[#0e1524] border-b border-[#1b263b] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#f0f6fc]">Add a comment</span>
              <div className="flex items-center bg-[#090d16] border border-[#1b263b] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setCommentTab('write')}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded transition ${
                    commentTab === 'write' ? 'bg-[#162032] text-[#79c0ff]' : 'text-[#8b949e]'
                  }`}
                >
                  <PenTool size={11} /> Write
                </button>
                <button
                  type="button"
                  onClick={() => setCommentTab('preview')}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded transition ${
                    commentTab === 'preview' ? 'bg-[#162032] text-[#79c0ff]' : 'text-[#8b949e]'
                  }`}
                >
                  <Eye size={11} /> Preview
                </button>
              </div>
            </div>

            <div className="p-4">
              {commentTab === 'write' ? (
                <div className="border border-[#212e48] rounded-lg overflow-hidden focus-within:border-[#388bfd] transition">
                  {/* Markdown Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0e1524] border-b border-[#1b263b] text-[#8b949e]">
                    <button
                      type="button"
                      onClick={() => setCommentText((t) => `${t}**text**`)}
                      className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                      title="Bold"
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentText((t) => `${t}*text*`)}
                      className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                      title="Italic"
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentText((t) => `${t}\n\`\`\`\ncode\n\`\`\`\n`)}
                      className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                      title="Code Block"
                    >
                      <Code size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentText((t) => `${t}\n> quote\n`)}
                      className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                      title="Quote"
                    >
                      <Quote size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentText((t) => `${t}\n- item\n`)}
                      className="p-1 hover:text-[#f0f6fc] hover:bg-[#162032] rounded"
                      title="List"
                    >
                      <List size={12} />
                    </button>
                  </div>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave a comment (Markdown supported)..."
                    rows={4}
                    className="w-full p-3 bg-[#090d16] text-xs text-[#f0f6fc] placeholder-[#484f58] focus:outline-none resize-y"
                  />
                </div>
              ) : (
                <div className="p-3 bg-[#090d16] border border-[#212e48] rounded-lg min-h-[100px]">
                  {commentText.trim() ? (
                    <MarkdownRenderer content={commentText} />
                  ) : (
                    <p className="text-xs text-[#484f58] italic">Nothing to preview.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-3">
                {isOpen && (
                  <button
                    type="button"
                    onClick={() => handlePostComment(true)}
                    disabled={postingComment || !commentText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#202d44] disabled:opacity-50 text-[#a371f7] border border-[#2b2b48] text-xs font-medium transition"
                  >
                    <CheckCircle2 size={12} />
                    <span>Close with comment</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePostComment(false)}
                  disabled={postingComment || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs font-medium shadow-sm transition"
                >
                  {postingComment ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Comment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & AI Platform Tools (1 col) */}
        <div className="space-y-4">
          {/* Metadata Card */}
          <div className="bg-[#0b1019] border border-[#1b263b] rounded-xl p-4 space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-2">
                Issue Metadata
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Status:</span>
                  <span
                    className={`font-semibold capitalize ${
                      isOpen ? 'text-[#3fb950]' : 'text-[#a371f7]'
                    }`}
                  >
                    {issue.state?.toLowerCase()} {issue.state_reason ? `(${issue.state_reason})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Author:</span>
                  <span className="text-[#f0f6fc] font-mono">{issue.author}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Comments:</span>
                  <span className="text-[#f0f6fc] font-mono">{comments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Created:</span>
                  <span className="text-[#8b949e]">{formatRelativeTime(issue.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Labels */}
            <div className="pt-3 border-t border-[#1b263b]">
              <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-2">
                Labels
              </span>
              {issue.labels?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map((lbl) => {
                    const name = typeof lbl === 'string' ? lbl : lbl.name;
                    const color = typeof lbl === 'string' ? 'ededed' : lbl.color || 'ededed';
                    return (
                      <span
                        key={name}
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-mono border"
                        style={{
                          backgroundColor: `#${color}18`,
                          borderColor: `#${color}50`,
                          color: `#${color}`
                        }}
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#484f58] italic">None yet</p>
              )}
            </div>

            {/* Assignees */}
            <div className="pt-3 border-t border-[#1b263b]">
              <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-2">
                Assignees
              </span>
              {issue.assignees?.length > 0 ? (
                <div className="space-y-1">
                  {issue.assignees.map((user) => (
                    <div key={user} className="flex items-center gap-1.5 text-xs text-[#f0f6fc]">
                      <User size={12} className="text-[#58a6ff]" />
                      <span>{user}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#484f58] italic">No one assigned</p>
              )}
            </div>
          </div>

          {/* Linked Incident Card (ProdPilot Cross-Reference) */}
          {linkedIncidentId && (
            <div className="bg-[#121824] border border-[#263753] rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={14} className="text-[#ff7b72]" />
                <span className="text-xs font-semibold text-[#f0f6fc]">Linked SRE Incident</span>
              </div>
              <p className="text-[11px] text-[#8b949e] mb-3">
                This issue is tied to live telemetry incident:
              </p>
              <div className="p-2.5 bg-[#090d16] border border-[#1b263b] rounded-lg font-mono text-xs text-[#ff7b72] break-all mb-3">
                {linkedIncidentId}
              </div>
              <a
                href={`/?nav=incidents`}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#261317] hover:bg-[#381b21] text-[#ff7b72] border border-[#4a1c24] text-xs font-medium transition"
              >
                <span>Jump to Incident Console</span>
              </a>
            </div>
          )}

          {/* ProdPilot AI Triage Co-Pilot Card */}
          <div className="bg-[#0e1626] border border-[#1f3354] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#58a6ff]" />
                <span className="text-xs font-semibold text-[#f0f6fc]">AI SRE Triage</span>
              </div>
              <button
                onClick={handleRunAiAnalysis}
                disabled={aiAnalyzing}
                className="p-1 text-[#58a6ff] hover:text-[#79c0ff] transition"
                title="Run analysis"
              >
                <RefreshCw size={12} className={aiAnalyzing ? 'animate-spin' : ''} />
              </button>
            </div>

            <p className="text-[11px] text-[#8b949e]">
              Analyze this issue with ProdPilot's readiness gate and diagnostic intelligence.
            </p>

            {!aiAnalysis ? (
              <button
                onClick={handleRunAiAnalysis}
                disabled={aiAnalyzing}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f2b40] hover:bg-[#2b3c5a] disabled:opacity-50 text-[#79c0ff] border border-[#388bfd] text-xs font-medium transition"
              >
                {aiAnalyzing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing Code & Logs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Run AI Triage Analysis</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 pt-2 border-t border-[#1b2b46]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8b949e]">Readiness Gate:</span>
                  <span
                    className={`font-semibold ${
                      aiAnalysis.ready ? 'text-[#3fb950]' : 'text-[#d29922]'
                    }`}
                  >
                    {aiAnalysis.ready ? 'READY FOR FIX' : 'NEEDS INFO'}
                  </span>
                </div>

                {aiAnalysis.suspected_area && (
                  <div>
                    <span className="text-[10px] text-[#8b949e] uppercase tracking-wider block mb-0.5">
                      Suspected Area
                    </span>
                    <span className="text-xs font-mono text-[#79c0ff] bg-[#090d16] px-2 py-0.5 rounded border border-[#1e2a3e] block truncate">
                      {aiAnalysis.suspected_area}
                    </span>
                  </div>
                )}

                {aiAnalysis.task_summary && (
                  <div>
                    <span className="text-[10px] text-[#8b949e] uppercase tracking-wider block mb-0.5">
                      AI Task Summary
                    </span>
                    <p className="text-[11px] text-[#c9d1d9] leading-snug">
                      {aiAnalysis.task_summary}
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePostAiTriageNote}
                  disabled={aiPosting}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2b44] hover:bg-[#233b5e] text-[#58a6ff] border border-[#2b446e] text-xs font-medium transition"
                >
                  {aiPosting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  <span>Post AI Triage Note to GitHub</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
