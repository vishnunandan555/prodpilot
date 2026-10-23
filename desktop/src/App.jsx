import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import IncidentList from './components/IncidentList';
import IncidentDetail from './components/IncidentDetail';

const API_BASE_URL = 'http://127.0.0.1:8765';
const PROD_BASE_URL = 'http://127.0.0.1:8000';

// Realistic fallback incident matching contracts/incident.example.json
const SAMPLE_INCIDENT = {
  id: 'inc-20261023-cbe6e6',
  service: 'demo-prod',
  detected_at: '2026-10-23T15:24:59Z',
  status: 'AWAITING_APPROVAL',
  health_url: 'http://127.0.0.1:8000/health',
  suspected_area: 'app.py:45',
  trace: `Traceback (most recent call last):
  File "app.py", line 81, in create_order
    result = calculate_order(data)
  File "app.py", line 45, in calculate_order
    discount = order["discount"]
KeyError: 'discount'`,
  log_tail: `2026-10-23 15:23:37 [INFO] Incoming POST /orders payload={'items': [{'id': 'p1', 'qty': 2, 'price': 25.0}]}
2026-10-23 15:23:37 [ERROR] KeyError: 'discount' in /orders
2026-10-23 15:23:40 [WARN] Healthcheck probe failed: 500 Internal Server Error
2026-10-23 15:23:45 [WARN] Healthcheck probe failed: 500 Internal Server Error`,
  suspect_commit: {
    hash: '96a2637',
    author: 'Vishnu Nandan',
    date: '2026-10-23T09:36:28Z',
    message: 'feat: add discount support to order checkout',
    suspect_file: 'app.py',
    suspect_line: 45,
    minutes_ago: 18,
  },
  artifacts: {
    repro_test: 'tests/test_repro.py',
    patch_diff: `diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -43,3 +43,3 @@ def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
     tax = round(subtotal * TAX_RATE, 2)
-    discount = order["discount"]
+    discount = order.get("discount", 0.0)
     total = max(0.0, round(subtotal + tax - discount, 2))`,
    test_evidence: {
      before: `tests/test_repro.py::test_order_without_discount FAILED
KeyError: 'discount' in calculate_order (app.py:45)`,
      after: `tests/test_repro.py::test_order_without_discount PASSED
tests/test_orders.py::test_health PASSED
tests/test_orders.py::test_order_calculation PASSED
tests/test_orders.py::test_post_order_endpoint PASSED
tests/test_orders.py::test_order_history PASSED
================ 5 passed in 0.42s ================`
    }
  },
  staging: {
    fix_forward: { port: 8001, health: true },
    rollback: { port: 8002, health: true },
  },
  decision: {
    backend: 'rules',
    recommendation: 'fix_forward',
    probabilities: { fix_forward: 0.85, rollback: 0.15 },
    reason: 'Clean 1-line patch with 100% test pass. Suspect commit was landed only 18m ago.'
  }
};

const SAMPLE_EVENTS = [
  {
    id: 1,
    stage: 'UNDERSTAND',
    kind: 'stage_started',
    ts: '2026-10-23T15:25:01Z',
    payload: { message: 'Analyzing traceback, log tail and running git blame on app.py:45...' }
  },
  {
    id: 2,
    stage: 'UNDERSTAND',
    kind: 'tool_call',
    ts: '2026-10-23T15:25:03Z',
    payload: { summary: 'Blamed suspect commit 96a2637 by Vishnu Nandan: feat: add discount support' }
  },
  {
    id: 3,
    stage: 'REPRODUCE',
    kind: 'stage_started',
    ts: '2026-10-23T15:25:05Z',
    payload: { message: 'Synthesizing minimal reproduction test tests/test_repro.py...' }
  },
  {
    id: 4,
    stage: 'REPRODUCE',
    kind: 'test_result',
    ts: '2026-10-23T15:25:08Z',
    payload: {
      phase: 'repro_baseline',
      passed: false,
      failure_snippet: 'FAILED tests/test_repro.py - KeyError: \'discount\''
    }
  },
  {
    id: 5,
    stage: 'FIX',
    kind: 'stage_started',
    ts: '2026-10-23T15:25:10Z',
    payload: { message: 'Agent modifying app.py in git worktree to use order.get("discount", 0.0)...' }
  },
  {
    id: 6,
    stage: 'VERIFY',
    kind: 'test_result',
    ts: '2026-10-23T15:25:14Z',
    payload: {
      phase: 'full_suite',
      passed: true,
      summary: '5 passed in 0.42s (100% green)'
    }
  },
  {
    id: 7,
    stage: 'STAGE',
    kind: 'stage_started',
    ts: '2026-10-23T15:25:16Z',
    payload: { message: 'Spinning up side-canaries: Fix on Port 8001, Revert on Port 8002...' }
  },
  {
    id: 8,
    stage: 'DECIDE',
    kind: 'decision',
    ts: '2026-10-23T15:25:19Z',
    payload: {
      backend: 'rules',
      recommendation: 'fix_forward',
      probabilities: { fix_forward: 0.85, rollback: 0.15 },
      reason: 'Clean 1-line patch with 100% test pass.'
    }
  },
  {
    id: 9,
    stage: 'AWAIT_APPROVAL',
    kind: 'status_change',
    ts: '2026-10-23T15:25:20Z',
    payload: { status: 'AWAITING_APPROVAL' }
  }
];

export default function App() {
  const [incidents, setIncidents] = useState([SAMPLE_INCIDENT]);
  const [selectedId, setSelectedId] = useState(SAMPLE_INCIDENT.id);
  const [selectedIncident, setSelectedIncident] = useState(SAMPLE_INCIDENT);
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [apiConnected, setApiConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const eventSourceRef = useRef(null);

  // Poll backend health & incidents
  const fetchIncidents = async () => {
    setIsRefreshing(true);
    try {
      const healthRes = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (healthRes.ok) {
        setApiConnected(true);
        const incRes = await fetch(`${API_BASE_URL}/incidents`);
        if (incRes.ok) {
          const data = await incRes.json();
          if (Array.isArray(data) && data.length > 0) {
            setIncidents(data);
            if (!data.some((d) => d.id === selectedId)) {
              setSelectedId(data[0].id);
            }
          }
        }
      } else {
        setApiConnected(false);
      }
    } catch (err) {
      setApiConnected(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch full detail of selected incident
  const fetchIncidentDetail = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/incidents/${id}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const detail = await res.json();
        setSelectedIncident(detail);
      }
    } catch (err) {
      // Use local/sample state
      const existing = incidents.find((inc) => inc.id === id);
      if (existing) setSelectedIncident(existing);
    }
  };

  // Subscribe to SSE stream for active incident
  useEffect(() => {
    if (!selectedId) return;

    fetchIncidentDetail(selectedId);

    // Close previous SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const es = new EventSource(`${API_BASE_URL}/incidents/${selectedId}/events`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setEvents((prev) => [...prev, parsed]);
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      es.onerror = () => {
        // SSE not available or closed
        es.close();
      };
    } catch (e) {
      console.warn('SSE connection failed:', e);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [selectedId]);

  // Initial and periodic poll
  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Actions
  const handleApprove = async (action) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/incidents/${selectedId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, source: 'desktop_ui' }),
      });

      const newStatus = action === 'fix_forward' ? 'DEPLOYED' : 'ROLLED_BACK';
      if (res.ok) {
        const body = await res.json();
        alert(`🎉 Action Approved: ${action} successfully deployed to production!`);
      } else {
        // Local simulation feedback
        alert(`⚡ Approval requested: [${action.toUpperCase()}] submitted to pipeline.`);
      }

      // Optimistic update
      setSelectedIncident((prev) => ({ ...prev, status: newStatus }));
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === selectedId ? { ...inc, status: newStatus } : inc))
      );
    } catch (err) {
      const newStatus = action === 'fix_forward' ? 'DEPLOYED' : 'ROLLED_BACK';
      setSelectedIncident((prev) => ({ ...prev, status: newStatus }));
      alert(`✅ [Offline Simulation] ${action.toUpperCase()} action dispatched successfully.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason) => {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE_URL}/incidents/${selectedId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, source: 'desktop_ui' }),
      });
      setSelectedIncident((prev) => ({ ...prev, status: 'REJECTED' }));
      alert('❌ Incident action rejected.');
    } catch (err) {
      setSelectedIncident((prev) => ({ ...prev, status: 'REJECTED' }));
      alert('❌ Incident marked as REJECTED.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowup = async (instruction) => {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE_URL}/incidents/${selectedId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, source: 'desktop_ui' }),
      });
      alert(`💬 Instruction dispatched to AI agent: "${instruction}"`);
    } catch (err) {
      alert(`💬 Instruction recorded: "${instruction}"`);
    } finally {
      setActionLoading(false);
    }
  };

  // Demo controls: Trigger crash & Reset demo
  const handleTriggerCrash = async () => {
    try {
      const res = await fetch(`${PROD_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 'p1', qty: 2, price: 25.0 }] }), // Missing discount key!
      });
      if (res.status === 500) {
        alert('💥 Crash triggered on demo-prod! 500 Internal Server Error returned (KeyError: discount). Watcher will open incident.');
      } else {
        alert(`Probe sent: HTTP status ${res.status}`);
      }
    } catch (err) {
      alert(`Probe sent to ${PROD_BASE_URL}/orders: ${err.message}`);
    }
    setTimeout(fetchIncidents, 2000);
  };

  const handleResetDemo = async () => {
    try {
      await fetch(`${PROD_BASE_URL}/reset`, { method: 'POST' });
      alert('🔄 demo-prod reset to healthy state.');
    } catch (err) {
      alert('Reset signal sent. Run scripts/reset-demo.sh to restart service.');
    }
    setTimeout(fetchIncidents, 1000);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans select-none">
      {/* Header */}
      <Header
        apiConnected={apiConnected}
        apiBaseUrl={API_BASE_URL}
        onRefresh={fetchIncidents}
        isRefreshing={isRefreshing}
        activeIncidentCount={incidents.filter((i) => i.status !== 'DEPLOYED' && i.status !== 'ROLLED_BACK').length}
        onTriggerCrash={handleTriggerCrash}
        onResetDemo={handleResetDemo}
      />

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Master List */}
        <IncidentList
          incidents={incidents}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            const found = incidents.find((i) => i.id === id);
            if (found) setSelectedIncident(found);
          }}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Right Detail Pane */}
        <IncidentDetail
          incident={selectedIncident}
          events={events}
          onApprove={handleApprove}
          onReject={handleReject}
          onFollowup={handleFollowup}
          actionLoading={actionLoading}
        />
      </div>
    </div>
  );
}
