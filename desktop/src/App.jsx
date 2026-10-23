import React, { useState, useEffect, useRef } from 'react';
import WindowHeader from './components/WindowHeader';
import Sidebar from './components/Sidebar';
import RightDrawer from './components/RightDrawer';
import SessionView from './components/SessionView';
import IssuesView from './components/IssuesView';
import AutomationsView from './components/AutomationsView';
import CustomizeView from './components/CustomizeView';

const API_BASE_URL = 'http://127.0.0.1:8765';
const PROD_BASE_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [activeNav, setActiveNav] = useState('session'); // 'session', 'issues', 'automations', 'customize', 'incidents'
  const [activeDrawerTab, setActiveDrawerTab] = useState('changes');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [events, setEvents] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const eventSourceRef = useRef(null);

  // Initial and periodic fetch of incidents
  const fetchIncidents = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/incidents`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
        setApiConnected(true);

        // Select first active or newest incident if none selected
        if (!selectedIncident && data.length > 0) {
          const active = data.find(i => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED') || data[0];
          fetchIncidentDetail(active.id);
        } else if (selectedIncident) {
          const updated = data.find(i => i.id === selectedIncident.id);
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
      const res = await fetch(`${API_BASE_URL}/incidents/${id}`);
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
  }, [selectedIncident?.id]);

  // Subscribe to live SSE events for active incident
  useEffect(() => {
    if (!selectedIncident?.id) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const sse = new EventSource(`${API_BASE_URL}/incidents/${selectedIncident.id}/events`);
      eventSourceRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setEvents((prev) => [...prev, parsed]);

          if (parsed.stage === 'AWAITING_APPROVAL' || parsed.kind === 'awaiting_approval') {
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
  }, [selectedIncident?.id]);

  // One-Tap Approval: Promote canary onto production port 8000
  const handleApprove = async (incidentId, action = 'fix_forward') => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, source: 'desktop_ui' }),
      });

      if (res.ok) {
        setDeploySuccess(true);
        setTimeout(() => setDeploySuccess(false), 5000);
      }
      setTimeout(() => fetchIncidentDetail(incidentId), 1000);
      setTimeout(fetchIncidents, 1500);
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async (incidentId) => {
    await handleApprove(incidentId, 'rollback');
  };

  // Demo Controls
  const handleTriggerCrash = async () => {
    try {
      await fetch(`${PROD_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 'item_crash', qty: 1, price: 99.0 }] }), // triggers missing discount KeyError
      });
    } catch (err) {
      // Ignored: 500 error expected
    }
    setTimeout(fetchIncidents, 2000);
  };

  const handleResetDemo = async () => {
    try {
      await fetch(`${PROD_BASE_URL}/reset`, { method: 'POST' });
    } catch (err) {
      // Ignored
    }
    setTimeout(fetchIncidents, 1000);
  };

  return (
    <div className="h-screen w-screen bg-gh-canvas text-gh-text flex flex-col font-sans select-none overflow-hidden">
      {/* Top Linux Window Header */}
      <WindowHeader
        apiConnected={apiConnected}
        onTriggerCrash={handleTriggerCrash}
        onResetDemo={handleResetDemo}
        isRefreshing={isRefreshing}
      />

      {/* Main 3-Column Copilot Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          incidents={incidents}
          activeIncident={selectedIncident}
          onSelectIncident={(inc) => {
            setSelectedIncident(inc);
            fetchIncidentDetail(inc.id);
          }}
          issues={[{ id: 1 }, { id: 3 }]}
        />

        {/* Center Workspace (Dynamic Views) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-gh-canvas">
          {(activeNav === 'session' || activeNav === 'incidents' || activeNav === 'new_session') && (
            <SessionView
              incident={selectedIncident}
              events={events}
              onApprove={handleApprove}
              onRollback={handleRollback}
              isDeploying={actionLoading}
              deploySuccess={deploySuccess}
            />
          )}

          {activeNav === 'issues' && (
            <IssuesView
              onOpenSession={(issue) => {
                setActiveNav('session');
              }}
            />
          )}

          {activeNav === 'automations' && <AutomationsView />}

          {activeNav === 'customize' && <CustomizeView />}

          {activeNav === 'pull_requests' && (
            <div className="flex-1 flex items-center justify-center text-gh-text-muted text-[13px] p-8 text-center">
              <div>
                <div className="font-semibold text-gh-text-bright mb-1">No Open Pull Requests</div>
                <p className="text-[12px] text-gh-text-dim">
                  Pull requests created by ProdPilot agent runs will appear here for review.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Inspector Drawer (Screenshot Match) */}
        <RightDrawer
          incident={selectedIncident}
          events={events}
          activeTab={activeDrawerTab}
          setActiveTab={setActiveDrawerTab}
        />
      </div>
    </div>
  );
}
