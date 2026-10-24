/**
 * Clean formatting utilities for SRE Console
 */

export const INACTIVE_STATUSES = ['RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'MANUAL_TAKEOVER', 'DISMISSED'];

export function isIncidentActive(status) {
  if (!status) return false;
  return !INACTIVE_STATUSES.includes(status.toUpperCase());
}

export function isIncidentInactive(status) {
  if (!status) return false;
  return INACTIVE_STATUSES.includes(status.toUpperCase());
}

export function formatIncidentId(id) {
  if (!id) return '';
  // Convert 'inc-20261023205121-e768' into '#e768'
  const match = id.match(/-([a-f0-9]{4,8})$/i);
  return match ? `#${match[1]}` : id;
}

export function formatDate(val, fallback = 'Recently') {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d.toLocaleString();
}

export function formatRelativeTime(val, fallback = 'recently') {
  if (!val) return fallback;
  const d = new Date(val);
  if (isNaN(d.getTime())) return fallback;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return 'just now';
  if (diff < 60) return `${Math.max(1, Math.round(diff))}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function formatStatusLabel(status) {
  if (!status) return 'Open';
  switch (status.toUpperCase()) {
    case 'AWAITING_APPROVAL':
    case 'GATE':
    case 'DECIDE':
      return 'Pending Review';
    case 'INVESTIGATING':
    case 'UNDERSTAND':
      return 'Investigating';
    case 'TRIAGED':
      return 'Triaged';
    case 'REPRODUCE':
    case 'REPRODUCED':
      return 'Reproduced';
    case 'FIXING':
    case 'FIXED':
    case 'VERIFY':
    case 'VERIFIED':
      return 'Patch Verified';
    case 'STAGE':
    case 'STAGED':
      return 'Canary Staged';
    case 'DEPLOYED':
    case 'RESOLVED':
      return 'Resolved';
    case 'ROLLED_BACK':
      return 'Rolled Back';
    case 'MANUAL_TAKEOVER':
      return 'Manual Takeover';
    case 'WAITING_FOR_DEVELOPER':
      return 'Needs Review';
    case 'DISMISSED':
      return 'Dismissed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function getStatusBadgeStyle(status) {
  const norm = (status || '').toUpperCase();
  if (norm === 'RESOLVED' || norm === 'DEPLOYED') {
    return 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]';
  }
  if (norm === 'AWAITING_APPROVAL' || norm === 'GATE' || norm === 'DECIDE') {
    return 'bg-[#241a0d] text-[#e3b341] border-[#3d2b12]';
  }
  if (norm === 'WAITING_FOR_DEVELOPER' || norm === 'LOW') {
    return 'bg-[#182338] text-[#58a6ff] border-[#293652]';
  }
  if (norm === 'ROLLED_BACK') {
    return 'bg-[#1e1628] text-[#c084fc] border-[#36254a]';
  }
  if (norm === 'MANUAL_TAKEOVER') {
    return 'bg-[#161b26] text-[#8b949e] border-[#293652]';
  }
  return 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]';
}
