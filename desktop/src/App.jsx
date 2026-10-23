import React, { useState, useEffect, useRef } from 'react';
import WindowHeader from './components/WindowHeader';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import IncidentDetail from './components/IncidentDetail';
import LogsView from './components/LogsView';
import ServicesView from './components/ServicesView';
import RepositoriesView from './components/RepositoriesView';
import AgentsView from './components/AgentsView';
import TeamView from './components/TeamView';
import SettingsView from './components/SettingsView';
import AuthModal from './components/AuthModal';

// Read API URL from Vite environment variable (Cloudflare Tunnel URL) with localStorage fallback
const getInitialApiUrl = () => {
  const stored = localStorage.getItem('prodpilot_api_url');
  if (stored) return stored.replace(/\/+$/, '');
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.trim().replace(/\/+$/, '');
  return 'http://127.0.0.1:8765';
};

const PROD_BASE_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl());
  // Parse path for /incidents/:id routing
  const parsePathIncidentId = () => {
    const path = window.location.pathname;
    const match = path.match(/\/incidents\/([^\/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const getInitialNav = () => {
    const params = new URLSearchParams(window.location.search);
    const navParam = params.get('nav');
    if (navParam) return navParam;
    return parsePathIncidentId() ? 'incidents' : 'dashboard';
  };

  const [activeNav, setActiveNav] = useState(getInitialNav());
  const [incidentFilter, setIncidentFilter] = useState('all');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [events, setEvents] = useState([]);
  const [apiConnected, setApiConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);

  // Real Platform Topology State
  const [connectedServers, setConnectedServers] = useState([]);
  const [activeRepo, setActiveRepo] = useState(null);

  // Authentication: starts from scratch if no operator session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('prodpilot_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('prodpilot_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(() => !localStorage.getItem('prodpilot_user'));

  const handleLoginSuccess = (user, tokenStr) => {
    setCurrentUser(user);
    setToken(tokenStr);
    localStorage.setItem('prodpilot_user', JSON.stringify(user));
    localStorage.setItem('prodpilot_token', tokenStr);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem('prodpilot_user');
    localStorage.removeItem('prodpilot_token');
    setShowAuthModal(true);
  };

  const eventSourceRef = useRef(null);

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
        if (data.status === 'DEPLOYED' || data.status === 'RESOLVED') {
          setDeploySuccess(true);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch detailed incident record, using memory state:', err);
    }
  };

  // Polling loop for active incident updates
  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  // SSE Stream Listener for real-time incident updates
  useEffect(() => {
    if (!selectedIncident?.id) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const sseUrl = `${apiUrl}/incidents/${selectedIncident.id}/events`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setEvents((prev) => [...prev, parsed]);

          if (parsed.stage) {
            setSelectedIncident((curr) => {
              if (!curr) return curr;
              return { ...curr, status: parsed.stage };
            });
          }

          if (parsed.stage === 'DEPLOYED' || parsed.stage === 'RESOLVED') {
            setDeploySuccess(true);
          }
        } catch (e) {
          // Non-JSON or keepalive comment
        }
      };

      es.onerror = () => {
        // SSE error, gracefully wait for retry
      };
    } catch (e) {
      // EventSource failed to initialize
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [selectedIncident?.id, apiUrl]);

  const handleSelectIncident = (inc) => {
    setSelectedIncident(inc);
    setEvents([]);
    setDeploySuccess(inc.status === 'DEPLOYED' || inc.status === 'RESOLVED');
    fetchIncidentDetail(inc.id);

    // Update URL bar if in browser mode without reloading page
    if (window.history.pushState) {
      window.history.pushState({}, '', `/incidents/${encodeURIComponent(inc.id)}`);
    }
  };

  // 1-Tap Mobile Action Approvals
  const handleApprove = async (actionType = 'fix_forward') => {
    if (!selectedIncident) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/incidents/${selectedIncident.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType }),
      });
      if (res.ok) {
        const result = await res.json();
        setDeploySuccess(true);
        setSelectedIncident((curr) => ({
          ...curr,
          status: result.status || 'DEPLOYED',
        }));
        setTimeout(fetchIncidents, 1000);
      }
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async () => {
    return handleApprove('rollback');
  };

  const handleTakeover = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/incidents/${selectedIncident.id}/takeover`, {
        method: 'POST',
      });
      if (res.ok) {
        setSelectedIncident((curr) => ({
          ...curr,
          status: 'MANUAL_TAKEOVER',
        }));
        setTimeout(fetchIncidents, 1000);
      }
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

  return (
    <div className="h-screen w-screen bg-[#080b11] text-[#c9d1d9] flex flex-col font-sans select-none overflow-hidden">
      {/* Top Window Header (Hidden on small mobile screens to maximize viewable area) */}
      <div className="hidden sm:block flex-shrink-0">
        <WindowHeader
          apiConnected={apiConnected}
          onTriggerCrash={handleTriggerCrash}
          onResetDemo={handleResetDemo}
          isRefreshing={isRefreshing}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuthModal(true)}
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
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#080b11] min-w-0">
          {activeNav === 'dashboard' && (
            <DashboardView
              incidents={incidents}
              onSelectIncident={handleSelectIncident}
              onNavigate={(nav) => setActiveNav(nav)}
              onTriggerCrash={handleTriggerCrash}
              actionLoading={actionLoading}
              apiConnected={apiConnected}
              apiUrl={apiUrl}
            />
          )}

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

          {(activeNav === 'logs' || activeNav === 'telemetry') && (
            <LogsView apiUrl={apiUrl} incidents={incidents} activeIncident={selectedIncident} />
          )}

          {activeNav === 'services' && (
            <ServicesView apiConnected={apiConnected} apiUrl={apiUrl} />
          )}

          {activeNav === 'repositories' && (
            <RepositoriesView apiUrl={apiUrl} activeIncident={selectedIncident} />
          )}

          {activeNav === 'agents' && (
            <AgentsView incidents={incidents} />
          )}

          {activeNav === 'team' && (
            <TeamView apiUrl={apiUrl} currentUser={currentUser} />
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

      {/* Authentication & Signup Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
        apiUrl={apiUrl}
      />
    </div>
  );
}
