import React, { useState, useEffect, useRef } from 'react';
import WindowHeader from './components/WindowHeader';
import Sidebar from './components/Sidebar';
import IncidentDetail from './components/IncidentDetail';
import TelemetryView from './components/TelemetryView';
import SettingsView from './components/SettingsView';

// Read API URL from Vite environment variable (Cloudflare Tunnel URL) with localStorage fallback
const getInitialApiUrl = () => {
  const stored = localStorage.getItem('prodpilot_api_url');
  if (stored) return stored.replace(/\/+$/, '');
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.trim().replace(/\/+$/, '');
  return 'http://127.0.0.1:8765';
};

const PROD_BASE_URL = 'http://127.0.0.1:8000';

const FALLBACK_INCIDENT = {
  id: 'inc-20261023-001',
  service: 'demo-prod',
  status: 'AWAITING_APPROVAL',
  suspected_area: 'KeyError discount on /orders',
  title: '[INCIDENT] Fix discount KeyError on /orders',
  detected_at: '2026-10-23T14:30:00Z',
  health_url: 'http://127.0.0.1:8000/health',
  trace: `Traceback (most recent call last):
  File "app.py", line 45, in calculate_order
    discount = order["discount"]
KeyError: 'discount'`,
  log_tail: `2026-10-23 14:29:58 [INFO] Incoming POST /orders payload={'items': [{'id': 'p1', 'qty': 2, 'price': 25.0}]}
2026-10-23 14:29:59 [ERROR] KeyError: 'discount' in /orders (app.py:45)
2026-10-23 14:30:00 [WARN] Healthcheck probe failed: 500 Internal Server Error
2026-10-23 14:30:05 [WARN] Healthcheck probe failed: 500 Internal Server Error`,
  suspect_commit: {
    hash: 'a1b2c3d',
    author: 'Vishnu Nandan',
    message: 'feat: add discount support to order checkout',
    suspect_file: 'app.py',
    suspect_line: 45,
    minutes_ago: 15
  },
  brief: {
    summary: "KeyError: 'discount' in calculate_order endpoint",
    suspected_area: 'app.py:45',
    introduced_by: 'a1b2c3d'
  },
  artifacts: {
    repro_test: 'tests/test_repro.py',
    patch_diff: `--- a/app.py
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
    rollback: { port: 8002, health: true }
  },
  decision: {
    action: 'fix_forward',
    probabilities: { fix_forward: 0.85, rollback: 0.15 },
    reason: 'Clean 1-line patch with 100% test pass. Suspect commit landed recently.'
  }
};

export default function App() {
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl());
  const [activeNav, setActiveNav] = useState('incidents'); // 'incidents', 'telemetry', 'settings'
  const [incidentFilter, setIncidentFilter] = useState('all');
  const [incidents, setIncidents] = useState([FALLBACK_INCIDENT]);
  const [selectedIncident, setSelectedIncident] = useState(FALLBACK_INCIDENT);
  const [events, setEvents] = useState([]);
  const [apiConnected, setApiConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);

  const eventSourceRef = useRef(null);

  // Parse path for /incidents/:id routing
  const parsePathIncidentId = () => {
    const path = window.location.pathname;
    const match = path.match(/\/incidents\/([^\/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Responsive screen check
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to browser forward/back buttons for /incidents/:id routing
  useEffect(() => {
    const handlePopState = () => {
      const incId = parsePathIncidentId();
      if (incId) {
        setActiveNav('incidents');
        fetchIncidentDetail(incId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [apiUrl]);

  // Save new API Base URL (e.g. from Settings tab)
  const handleSaveApiUrl = (newUrl) => {
    setApiUrl(newUrl);
    localStorage.setItem('prodpilot_api_url', newUrl);
  };

  // Initial and periodic fetch of incidents from active API
  const fetchIncidents = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/incidents`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
        setApiConnected(true);

        // Check if a specific incident is in URL
        const pathIncId = parsePathIncidentId();
        if (pathIncId) {
          const match = data.find((i) => i.id === pathIncId);
          if (match) {
            setSelectedIncident(match);
            fetchIncidentDetail(pathIncId);
          } else {
            fetchIncidentDetail(pathIncId);
          }
        } else if (!selectedIncident && data.length > 0) {
          const active = data.find((i) => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED') || data[0];
          fetchIncidentDetail(active.id);
        } else if (selectedIncident) {
          const updated = data.find((i) => i.id === selectedIncident.id);
          if (updated && updated.status !== selectedIncident.status) {
            fetchIncidentDetail(updated.id);
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

  const fetchIncidentDetail = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/incidents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIncident(data);
      }
    } catch (err) {
      console.error('Failed to fetch incident detail:', err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 3000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  // Subscribe to live SSE events for active incident
  useEffect(() => {
    if (!selectedIncident?.id) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const sse = new EventSource(`${apiUrl}/incidents/${selectedIncident.id}/events`);
      eventSourceRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setEvents((prev) => [...prev, parsed]);

          if (
            parsed.stage === 'AWAITING_APPROVAL' ||
            parsed.kind === 'awaiting_approval' ||
            parsed.kind === 'deployed'
          ) {
            fetchIncidentDetail(selectedIncident.id);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      sse.onerror = () => {
        sse.close();
      };
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [selectedIncident?.id, apiUrl]);

  // Sync URL when selecting an incident
  const handleSelectIncident = (inc) => {
    setSelectedIncident(inc);
    fetchIncidentDetail(inc.id);
    if (window.location.pathname !== `/incidents/${inc.id}`) {
      window.history.pushState(null, '', `/incidents/${inc.id}`);
    }
    if (isMobileScreen) {
      setShowMobileList(false);
    }
  };

  // 1-Tap Mobile Action 1: [🚀 Approve & Deploy Fix]
  const handleApprove = async (incidentId, action = 'fix') => {
    setActionLoading(true);
    try {
      // First attempt with requested action ('fix'), with fallback to 'fix_forward' if backend expects it
      let res = await fetch(`${apiUrl}/incidents/${incidentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, source: 'mobile_web' }),
      });

      if (!res.ok && res.status === 400 && action === 'fix') {
        res = await fetch(`${apiUrl}/incidents/${incidentId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fix_forward', source: 'mobile_web' }),
        });
      }

      if (res.ok) {
        setDeploySuccess(true);
        setTimeout(() => setDeploySuccess(false), 6000);
      }
      setTimeout(() => fetchIncidentDetail(incidentId), 800);
      setTimeout(fetchIncidents, 1200);
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Tap Mobile Action 2: [⏪ Instant Rollback]
  const handleRollback = async (incidentId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/incidents/${incidentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', source: 'mobile_web' }),
      });

      if (res.ok) {
        setDeploySuccess(true);
        setTimeout(() => setDeploySuccess(false), 6000);
      }
      setTimeout(() => fetchIncidentDetail(incidentId), 800);
      setTimeout(fetchIncidents, 1200);
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Tap Mobile Action 3: [🛑 Take Over]
  const handleTakeover = async (incidentId) => {
    setActionLoading(true);
    try {
      // Notify backend via reject endpoint and update local status to MANUAL_TAKEOVER
      await fetch(`${apiUrl}/incidents/${incidentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Manual takeover by on-call engineer',
          source: 'mobile_web',
        }),
      }).catch(() => {});

      setSelectedIncident((prev) =>
        prev ? { ...prev, status: 'MANUAL_TAKEOVER' } : prev
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId ? { ...i, status: 'MANUAL_TAKEOVER' } : i
        )
      );
    } catch (err) {
      console.error('Takeover failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Demo Controls
  const handleTriggerCrash = async () => {
    try {
      await fetch(`${PROD_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 'item_crash', qty: 1, price: 99.0 }] }),
      });
    } catch (err) {
      // Ignored: 500 error expected
    }
    setTimeout(fetchIncidents, 1500);
  };

  const handleResetDemo = async () => {
    try {
      await fetch(`${PROD_BASE_URL}/reset`, { method: 'POST' });
    } catch (err) {
      // Ignored
    }
    setTimeout(fetchIncidents, 1000);
  };

  const isPathIncident = Boolean(parsePathIncidentId());

  return (
    <div className="h-screen w-screen bg-[#070a12] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Window Header (Hidden on small mobile screens to maximize viewable area) */}
      <div className="hidden sm:block flex-shrink-0">
        <WindowHeader
          apiConnected={apiConnected}
          onTriggerCrash={handleTriggerCrash}
          onResetDemo={handleResetDemo}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Hidden on mobile if viewing incident details, toggleable) */}
        {(!isMobileScreen || showMobileList || activeNav === 'settings') && (
          <Sidebar
            activeNav={activeNav}
            setActiveNav={(nav) => {
              setActiveNav(nav);
              if (isMobileScreen) setShowMobileList(false);
            }}
            incidents={incidents}
            activeIncident={selectedIncident}
            onSelectIncident={handleSelectIncident}
            apiConnected={apiConnected}
            apiBaseUrl={apiUrl}
            incidentFilter={incidentFilter}
            setIncidentFilter={setIncidentFilter}
          />
        )}

        {/* Center Dynamic Views */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-gh-canvas min-w-0">
          {activeNav === 'incidents' && (
            <IncidentDetail
              incident={selectedIncident}
              events={events}
              onApprove={handleApprove}
              onRollback={handleRollback}
              onTakeover={handleTakeover}
              actionLoading={actionLoading}
              deploySuccess={deploySuccess}
              isStandaloneMobile={isMobileScreen}
              onBack={isMobileScreen ? () => setShowMobileList(true) : null}
            />
          )}

          {activeNav === 'telemetry' && (
            <TelemetryView
              events={events}
              incident={selectedIncident}
              apiConnected={apiConnected}
              apiBaseUrl={apiUrl}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsView
              apiBaseUrl={apiUrl}
              onSaveApiUrl={handleSaveApiUrl}
              apiConnected={apiConnected}
            />
          )}
        </main>
      </div>
    </div>
  );
}
