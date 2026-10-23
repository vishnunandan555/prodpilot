import React, { useState, useEffect, useRef } from 'react';
import WindowHeader from './components/WindowHeader';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import IncidentDetail from './components/IncidentDetail';
import LogsView from './components/LogsView';
import ServersView from './components/ServersView';
import ProjectsView from './components/ProjectsView';
import PlatformServicesView from './components/PlatformServicesView';
import AgentsView from './components/AgentsView';
import TeamView from './components/TeamView';
import SettingsView from './components/SettingsView';
import MasterLogsView from './components/MasterLogsView';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';
import { GlobalProgressBar } from './components/LoadingSkeleton';

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
  const [logsNavParams, setLogsNavParams] = useState(null);

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
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleLoginSuccess = (user, tokenStr) => {
    setCurrentUser(user);
    setToken(tokenStr);
    localStorage.setItem('prodpilot_user', JSON.stringify(user));
    localStorage.setItem('prodpilot_token', tokenStr);
    setShowAuthModal(false);
  };

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('prodpilot_user', JSON.stringify(updatedUser));
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

  // Cache refs to prevent unnecessary re-renders when data has not changed
  const incidentsRef = useRef([]);
  const selectedIncidentRef = useRef(null);

  useEffect(() => {
    selectedIncidentRef.current = selectedIncident;
  }, [selectedIncident]);

  // Initial and periodic fetch of incidents from active API
  const fetchIncidents = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/incidents`);
      if (res.ok) {
        const data = await res.json();
        setApiConnected(true);

        // Only update incidents state if payload actually changed
        if (JSON.stringify(data) !== JSON.stringify(incidentsRef.current)) {
          incidentsRef.current = data;
          setIncidents(data);
        }

        const currentSelected = selectedIncidentRef.current;

        if (data.length === 0) {
          if (currentSelected !== null) {
            setSelectedIncident(null);
          }
          if (window.history.replaceState && parsePathIncidentId()) {
            window.history.replaceState({}, '', '/');
          }
        } else {
          // Check if a specific incident is in URL
          const pathIncId = parsePathIncidentId();
          let target = null;
          if (pathIncId) {
            target = data.find((i) => i.id === pathIncId);
          }

          // If URL had an incident ID that no longer exists in data (e.g. deleted),
          // clean URL and fallback to currentSelected or first active incident
          if (!target) {
            if (currentSelected && data.some((i) => i.id === currentSelected.id)) {
              target = data.find((i) => i.id === currentSelected.id);
            } else {
              target = data.find((i) => !['RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED'].includes(i.status)) || data[0];
            }
            if (target && window.history.replaceState) {
              window.history.replaceState({}, '', `/incidents/${encodeURIComponent(target.id)}`);
            } else if (!target && window.history.replaceState) {
              window.history.replaceState({}, '', '/');
            }
          }

          if (target) {
            const isActiveState = !['RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED'].includes(target.status);
            if (!currentSelected || currentSelected.id !== target.id) {
              setSelectedIncident(target);
              fetchIncidentDetail(target.id);
            } else if (target.status !== currentSelected.status || isActiveState) {
              fetchIncidentDetail(target.id);
            }
          } else {
            setSelectedIncident(null);
          }
        }
      } else {
        setApiConnected(false);
      }
    } catch (err) {
      setApiConnected(false);
    } finally {
      if (manual) setIsRefreshing(false);
    }
  };

  const fetchIncidentDetail = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/incidents/${id}`);
      if (res.ok) {
        const data = await res.json();
        const curr = selectedIncidentRef.current;
        // Only trigger state update if fields actually changed to eliminate tab/view flicker
        if (
          !curr ||
          curr.id !== data.id ||
          curr.status !== data.status ||
          curr.updated_at !== data.updated_at ||
          JSON.stringify(curr.staging) !== JSON.stringify(data.staging) ||
          JSON.stringify(curr.brief) !== JSON.stringify(data.brief) ||
          (data.artifacts?.patch_diff && data.artifacts.patch_diff !== curr.artifacts?.patch_diff)
        ) {
          setSelectedIncident(data);
        }
        if (data.events && Array.isArray(data.events)) {
          setEvents(data.events);
        }
        if (data.status === 'DEPLOYED' || data.status === 'RESOLVED') {
          setDeploySuccess(true);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch detailed incident record, using memory state:', err);
    }
  };

  // Polling loop for active incident updates (relaxed to 15s since SSE streams real-time updates)
  useEffect(() => {
    fetchIncidents(true);
    const interval = setInterval(() => fetchIncidents(false), 15000);
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

  const handleDeleteIncident = async (incidentId) => {
    try {
      const res = await fetch(`${apiUrl}/incidents/${incidentId}`, { method: 'DELETE' });
      if (res.ok) {
        setIncidents((prev) => {
          const remaining = prev.filter((i) => i.id !== incidentId);
          if (selectedIncident?.id === incidentId) {
            const nextSelected = remaining.find((i) => !['RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED'].includes(i.status)) || (remaining.length > 0 ? remaining[0] : null);
            setSelectedIncident(nextSelected);
            if (nextSelected) {
              fetchIncidentDetail(nextSelected.id);
              if (window.history.replaceState) {
                window.history.replaceState({}, '', `/incidents/${encodeURIComponent(nextSelected.id)}`);
              }
            } else {
              if (window.history.replaceState) {
                window.history.replaceState({}, '', '/');
              }
            }
          }
          return remaining;
        });
      }
    } catch (err) {
      console.error('Failed to delete incident:', err);
    }
  };

  const handleClearIncidents = async (status = 'ALL') => {
    try {
      const res = await fetch(`${apiUrl}/incidents/clear?status=${status}`, { method: 'POST' });
      if (res.ok) {
        fetchIncidents(true);
      }
    } catch (err) {
      console.error('Failed to clear incidents:', err);
    }
  };

  const handleNavigate = (nav, params = null) => {
    if (nav === 'logs' && params) {
      setLogsNavParams(params);
    }
    setActiveNav(nav);
  };

  return (
    <div className="h-screen w-screen bg-[#080b11] text-[#c9d1d9] flex flex-col font-sans overflow-hidden relative select-text">
      {/* Top Ambient Activity Bar */}
      <GlobalProgressBar active={isRefreshing} />

      {/* Top Window Header */}
      <div className="hidden sm:block flex-shrink-0">
        <WindowHeader
          apiConnected={apiConnected}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
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
              if (nav === 'incidents' && !selectedIncident && incidents.length > 0) {
                const target = incidents.find((i) => !['RESOLVED', 'DEPLOYED', 'ROLLED_BACK', 'DISMISSED'].includes(i.status)) || incidents[0];
                if (target) {
                  handleSelectIncident(target);
                }
              }
              if (isMobileScreen) setShowMobileList(false);
            }}
            incidents={incidents}
            activeIncident={selectedIncident}
            onSelectIncident={handleSelectIncident}
            apiConnected={apiConnected}
            apiBaseUrl={apiUrl}
            incidentFilter={incidentFilter}
            setIncidentFilter={setIncidentFilter}
            isRefreshing={isRefreshing}
            onDeleteIncident={handleDeleteIncident}
            onClearIncidents={handleClearIncidents}
          />
        )}

        {/* Center Dynamic Views */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#080b11] min-w-0">
          {activeNav === 'dashboard' && (
            <DashboardView
              incidents={incidents}
              onSelectIncident={handleSelectIncident}
              onNavigate={handleNavigate}
              apiConnected={apiConnected}
              apiUrl={apiUrl}
              currentUser={currentUser}
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
              onNavigate={handleNavigate}
              onDeleteIncident={handleDeleteIncident}
            />
          )}

          {activeNav === 'master_logs' && (
            <MasterLogsView
              apiUrl={apiUrl}
              onNavigate={handleNavigate}
              onSelectIncident={(inc) => {
                handleSelectIncident(inc);
                setActiveNav('incidents');
              }}
            />
          )}

          {(activeNav === 'logs' || activeNav === 'telemetry') && (
            <LogsView
              apiUrl={apiUrl}
              incidents={incidents}
              initialSearch={logsNavParams?.searchTerm || ''}
              onNavigate={handleNavigate}
              onSelectIncident={(inc) => {
                handleSelectIncident(inc);
                setActiveNav('incidents');
              }}
            />
          )}

          {activeNav === 'servers' && (
            <ServersView apiUrl={apiUrl} onNavigateToLogs={() => setActiveNav('logs')} />
          )}

          {(activeNav === 'projects' || activeNav === 'repositories') && (
            <ProjectsView apiUrl={apiUrl} />
          )}

          {activeNav === 'services' && (
            <PlatformServicesView apiUrl={apiUrl} onNavigate={(nav) => setActiveNav(nav)} />
          )}

          {activeNav === 'agents' && (
            <AgentsView
              apiUrl={apiUrl}
              incidents={incidents}
              onNavigate={(nav) => setActiveNav(nav)}
            />
          )}

          {activeNav === 'team' && (
            <TeamView
              apiUrl={apiUrl}
              currentUser={currentUser}
              onOpenProfile={() => setShowProfileModal(true)}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsView
              apiBaseUrl={apiUrl}
              onSaveApiUrl={handleSaveApiUrl}
              apiConnected={apiConnected}
              currentUser={currentUser}
              onUpdateUser={handleUpdateUser}
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

      {/* Profile & Account Management Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        apiUrl={apiUrl}
        onUpdateUser={handleUpdateUser}
      />
    </div>
  );
}
