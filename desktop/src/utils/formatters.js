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

export function parseUtcDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let str = String(val).trim();
  // If string is an ISO timestamp without timezone offset (e.g. 2026-10-24T05:38:01.488 or 2026-10-24 05:38:01),
  // backend outputs UTC from datetime.utcnow(), so append 'Z' to ensure browser parses it as UTC and displays device/Indian time
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(val, fallback = 'Recently') {
  const d = parseUtcDate(val);
  return d ? d.toLocaleString() : fallback;
}

export function formatTime(val, fallback = '') {
  const d = parseUtcDate(val);
  return d ? d.toLocaleTimeString() : fallback;
}

export function formatRelativeTime(val, fallback = 'recently') {
  const d = parseUtcDate(val);
  if (!d) return fallback;
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
    return 'bg-[#2a1708] text-[#f0883e] border-[#542c0f]';
  }
  if (norm === 'ROLLED_BACK') {
    return 'bg-[#1e1628] text-[#c084fc] border-[#36254a]';
  }
  if (norm === 'MANUAL_TAKEOVER') {
    return 'bg-[#161b26] text-[#8b949e] border-[#293652]';
  }
  return 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]';
}

export function getSeverityBadgeStyle(severity) {
  const norm = (severity || '').toUpperCase();
  if (norm === 'LOW' || norm.includes('LOW') || norm === 'SEV-3' || norm === 'SEV-4') {
    return 'bg-[#2a1708] text-[#f0883e] border-[#542c0f]';
  }
  if (norm === 'MEDIUM' || norm.includes('MEDIUM') || norm === 'SEV-2') {
    return 'bg-[#241a0d] text-[#e3b341] border-[#3d2b12]';
  }
  return 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]';
}

export function formatSeverityLabel(severity) {
  if (!severity) return 'SEV-1';
  const norm = severity.toUpperCase();
  if (norm.includes('LOW') || norm === 'SEV-3') {
    return 'LOW';
  }
  if (norm.includes('MEDIUM') || norm === 'SEV-2') {
    return 'MEDIUM';
  }
  if (norm.includes('CRITICAL')) {
    return 'CRITICAL';
  }
  if (norm === 'SEV-1' || norm.includes('HIGH')) {
    return 'SEV-1';
  }
  return norm.replace(/^SEV-1\s+/, '');
}

export function cleanIncidentTitle(inc) {
  if (!inc) return 'Outage in Production Service';
  let raw = inc.title || inc.summary || inc.root_cause_report || '';
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.title) return parsed.title;
      if (parsed.summary) return parsed.summary;
      if (parsed.reason) return `[LOW] ${parsed.reason}`;
    } catch {
      // ignore
    }
  }
  if (inc.title && typeof inc.title === 'string' && !inc.title.trim().startsWith('{')) {
    return inc.title;
  }
  return `Outage in ${inc.service || 'Production Service'}`;
}

export function cleanIncidentSummary(inc) {
  if (!inc) return 'Autonomous diagnostic analysis in progress.';
  let raw = inc.summary || inc.root_cause_report || '';
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.summary) return parsed.summary;
      if (parsed.reason) return parsed.reason;
      if (parsed.title) return parsed.title;
    } catch {
      // ignore
    }
  }
  return raw || 'Autonomous diagnostic analysis in progress.';
}

export function isLowSeverityIncident(inc) {
  if (!inc) return false;
  const sev = (inc.severity || '').toUpperCase();
  const st = (inc.status || '').toUpperCase();
  const id = String(inc.id || '');
  return id.startsWith('inc-low-') || sev === 'LOW' || sev.includes('LOW') || st === 'WAITING_FOR_DEVELOPER';
}

export const INCIDENT_LIFECYCLE_STAGES = [
  { key: 'INVESTIGATE', label: 'Investigation', shortDesc: 'Trace & Blame', duration: '4s', tab: 'investigation' },
  { key: 'ANALYSIS', label: 'Analysis', shortDesc: 'Root Cause', duration: '8s', tab: 'investigation' },
  { key: 'REPRODUCE', label: 'Reproduction', shortDesc: 'Sandbox Proof', duration: '26s', tab: 'investigation' },
  { key: 'FIX', label: 'Fix & Patch', shortDesc: 'Synthesize Patch', duration: '18s', tab: 'changes' },
  { key: 'VERIFY', label: 'Canary Test', shortDesc: 'Canary Health', duration: '35s', tab: 'recovery' },
  { key: 'AWAITING_APPROVAL', label: 'Approval Gate', shortDesc: 'Standby for Sign-off', duration: '14s', tab: 'recovery' },
  { key: 'RESOLVED', label: 'Restored', shortDesc: 'Live 200 OK', duration: '6s', tab: 'overview' },
];

export function getIncidentLifecycleProgress(incident) {
  if (!incident) {
    return {
      currentIdx: 0,
      stageNumber: 1,
      totalStages: 7,
      completedCount: 0,
      label: 'Stage 1/7: Investigation (Trace & Blame)',
      stageName: 'Investigation',
      shortDesc: 'Trace & Blame',
      statusText: 'Investigation: Trace & Blame',
      percent: 15,
      stages: INCIDENT_LIFECYCLE_STAGES
    };
  }

  const inc = typeof incident === 'string' ? { status: incident } : incident;
  const status = (inc.status || '').toUpperCase();
  const severity = (inc.severity || '').toUpperCase();
  const isWaitingForDev = isLowSeverityIncident(inc) && status !== 'RESOLVED' && status !== 'DEPLOYED';
  const isTakeover = status === 'MANUAL_TAKEOVER';
  const isAwaiting = status === 'AWAITING_APPROVAL' || status === 'GATE' || status === 'DECIDE';
  const isResolved = status === 'DEPLOYED' || status === 'RESOLVED' || status === 'CLOSED' || status === 'ROLLED_BACK';
  const isFailed = status === 'FAILED' || status === 'ERROR';

  const hasDiff = Boolean(
    inc.has_diff ||
    inc.diffContent ||
    inc.artifacts?.patch_diff ||
    inc.patch_diff ||
    inc.github_pr ||
    inc.github_pr_number ||
    inc.pr_number
  );
  const hasStaging = Boolean(
    inc.has_staging ||
    typeof inc.staging?.fix_forward?.health === 'boolean' ||
    typeof inc.staging?.rollback?.health === 'boolean'
  );
  const hasRepro = Boolean(
    inc.has_repro ||
    inc.artifacts?.repro_test ||
    inc.repro_test
  );
  const hasSuspect = Boolean(
    inc.suspect_commit ||
    inc.suspect_author ||
    inc.suspected_area ||
    inc.brief?.suspected_area ||
    inc.brief?.introduced_by
  );

  let currentIdx = 0;
  if (isResolved) {
    currentIdx = 6;
  } else if (isWaitingForDev) {
    // Low-severity incident: autonomous remediation is deferred after root cause analysis.
    // It remains in Stage 2 (Analysis / Root Cause Report Complete) awaiting manual developer review.
    currentIdx = (hasSuspect || status === 'ANALYZING' || status === 'TRIAGED' || inc.root_cause_report || inc.summary) ? 1 : 0;
  } else if (isTakeover || isAwaiting) {
    currentIdx = 5;
  } else if (isFailed) {
    currentIdx = 3;
  } else if (hasStaging || (hasDiff && (status === 'FIXING' || status === 'CANARY_TESTING' || status === 'STAGE' || status === 'STAGED' || status === 'INVESTIGATING'))) {
    currentIdx = 4;
  } else if (status === 'CANARY_TESTING' || status === 'STAGE' || status === 'STAGED' || status === 'VERIFY' || status === 'VERIFIED') {
    currentIdx = 4;
  } else if (status === 'FIXING' || status === 'FIXED') {
    currentIdx = 3;
  } else if (status === 'REPRODUCE' || status === 'REPRODUCED' || hasRepro) {
    currentIdx = 2;
  } else if (status === 'ANALYZING' || status === 'UNDERSTAND' || status === 'TRIAGED' || hasSuspect) {
    currentIdx = 1;
  } else if (status === 'OPEN' || status === 'DETECTED' || status === 'INVESTIGATING') {
    currentIdx = hasSuspect ? 1 : 0;
  } else {
    currentIdx = 0;
  }

  const stageObj = INCIDENT_LIFECYCLE_STAGES[currentIdx] || INCIDENT_LIFECYCLE_STAGES[0];
  const stageNumber = currentIdx + 1;
  const completedCount = isResolved ? 7 : isTakeover ? 5 : isAwaiting ? 5 : isWaitingForDev ? currentIdx : isFailed ? currentIdx : currentIdx;

  let percent = 15;
  if (isResolved) percent = 100;
  else if (isTakeover) percent = 85;
  else if (isAwaiting) percent = 85;
  else if (isWaitingForDev) percent = currentIdx === 1 ? 25 : 10;
  else if (currentIdx === 4) percent = 70;
  else if (currentIdx === 3) percent = 55;
  else if (currentIdx === 2) percent = 40;
  else if (currentIdx === 1) percent = 25;
  else percent = 15;

  let label = `Stage ${stageNumber}/7: ${stageObj.label}${stageObj.shortDesc ? ` (${stageObj.shortDesc})` : ''}`;
  if (isWaitingForDev) {
    label = 'Low Severity: Needs Developer Review';
  } else if (isTakeover) {
    label = 'Manual Takeover: Operator Control';
  } else if (isResolved) {
    label = 'Stage 7/7: Restored (Live 200 OK)';
  }

  let statusText = `${stageObj.label}: ${stageObj.shortDesc}`;
  if (isResolved) statusText = 'Production Restored (200 OK)';
  else if (isTakeover) statusText = 'Operator Control Active (Autonomous Loop Bypassed)';
  else if (isFailed) statusText = 'Remediation Blocked — Manual Operator Intervention Required';
  else if (isWaitingForDev) statusText = 'Needs Review — Autonomous Fix Deferred (Click "Generate Fix" to Dispatch)';
  else if (isAwaiting) statusText = 'Approval Gate: Standby for Operator Sign-off';

  return {
    currentIdx,
    stageNumber,
    totalStages: 7,
    completedCount,
    label,
    stageName: stageObj.label,
    shortDesc: stageObj.shortDesc,
    statusText,
    percent,
    stages: INCIDENT_LIFECYCLE_STAGES
  };
}

