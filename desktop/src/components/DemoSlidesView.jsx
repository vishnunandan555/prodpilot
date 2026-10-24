import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Presentation,
  DollarSign,
  Cpu,
  FileText,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Clock,
  Server,
  Terminal,
  Bot,
  PhoneCall,
  GitPullRequest,
  ExternalLink,
  Sparkles,
  Layers,
  HelpCircle,
  PlayCircle
} from 'lucide-react';

export default function DemoSlidesView() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [costTier, setCostTier] = useState('standard'); // 'standard' | 'enterprise'
  const [activeScriptAct, setActiveScriptAct] = useState(0);
  const [selectedTechCategory, setSelectedTechCategory] = useState('all');
  const containerRef = useRef(null);

  const totalSlides = 2;

  const goToPrev = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {
        setIsFullscreen(!isFullscreen);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlideIndex(totalSlides - 1);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (['1', '2'].includes(e.key)) {
        setCurrentSlideIndex(parseInt(e.key, 10) - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, totalSlides, isFullscreen]);

  // ---------------------------------------------------------------------------
  // SLIDE 1 DATA: Cost Estimation
  // ---------------------------------------------------------------------------
  const costItemsStandard = [
    {
      category: 'Compute & Runner',
      service: 'FastAPI Daemon + Side-Port Canaries',
      provider: 'Render Starter / Hetzner VPS / Fly.io',
      specs: '1 vCPU, 1GB RAM (hosts 24/7 daemon + dual ephemeral canary ports 8001 & 8002)',
      cost: '$7.00',
      period: '/mo'
    },
    {
      category: 'Database & State',
      service: 'SQLite WAL Embedded Engine',
      provider: 'Local Storage Engine (Zero Infrastructure)',
      specs: 'ACID transactions, thread-safe WAL pool, zero-latency local disk',
      cost: '$0.00',
      period: 'included'
    },
    {
      category: 'AI Inference',
      service: 'Google GenAI SDK (Gemini 2.5 Flash)',
      provider: 'Google AI (google.genai)',
      specs: '10–15 incident tracebacks, git blame triage & patch diffs ($0.075/1M in, $0.30/1M out)',
      cost: '$0.35',
      period: '/mo'
    },
    {
      category: 'Decision Engine',
      service: 'TypeSafe Jev (Recovery Arbiter)',
      provider: 'OpenRouter Decisions API (typesafe/jev-1.14)',
      specs: 'Evaluates fix_forward vs rollback probabilities (~$0.005/decision run)',
      cost: '$0.08',
      period: '/mo'
    },
    {
      category: 'Voice Telephony',
      service: 'Twilio Voice Hotline Companion',
      provider: 'Twilio Programmable Voice',
      specs: '1 Local DID ($1.15/mo) + ~20 emergency voice call minutes ($0.014/min)',
      cost: '$1.43',
      period: '/mo'
    },
    {
      category: 'Mobile Alerts',
      service: 'Telegram Dispatch & Inline Callbacks',
      provider: 'Telegram Bot API',
      specs: 'Unlimited stage 1–3 rich cards & inline interactive approval buttons',
      cost: '$0.00',
      period: 'free'
    },
    {
      category: 'Version Control',
      service: 'GitHub PR & Branch Lifecycle',
      provider: 'GitHub REST API (Octokit)',
      specs: 'Branch push, automated PR creation with post-mortems (within 5k req/hr free tier)',
      cost: '$0.00',
      period: 'included'
    },
    {
      category: 'Sandbox Repro',
      service: 'Git Worktree Test Sandbox',
      provider: 'Local Subprocess Isolation',
      specs: 'Zero-clone ephemeral branch isolation + local pytest execution',
      cost: '$0.00',
      period: 'local compute'
    },
    {
      category: 'Desktop App',
      service: 'Operator Command Center',
      provider: 'Electron + Vite Client',
      specs: 'Native cross-platform desktop UI (macOS, Linux, Windows)',
      cost: '$0.00',
      period: 'client-side'
    }
  ];

  const costItemsEnterprise = [
    {
      category: 'Compute & Backend',
      service: 'Dedicated Cluster Daemon',
      provider: 'AWS ECS / Render Pro',
      specs: '2 vCPU, 2GB RAM, redundant high-availability',
      cost: '$25.00',
      period: '/mo'
    },
    {
      category: 'Database & State',
      service: 'Postgres / Turso Replicated',
      provider: 'Managed Cloud SQL',
      specs: 'Multi-region replication, automated snapshots',
      cost: '$10.00',
      period: '/mo'
    },
    {
      category: 'AI Inference',
      service: 'Gemini 2.5 Pro + Claude 3.5 Sonnet',
      provider: 'Google AI & OpenRouter',
      specs: '60+ incident triage runs, multi-agent consensus',
      cost: '$5.50',
      period: '/mo'
    },
    {
      category: 'Decision Engine',
      service: 'TypeSafe Jev (High-Precision Arbiter)',
      provider: 'OpenRouter Decisions API (typesafe/jev-1.14)',
      specs: '60+ multi-stage canary decisions & rollback risk scoring',
      cost: '$0.50',
      period: '/mo'
    },
    {
      category: 'Voice Telephony',
      service: 'Twilio Toll-Free Hotline Pool',
      provider: 'Twilio Programmable Voice',
      specs: 'Dedicated team numbers + 250 emergency call mins',
      cost: '$7.50',
      period: '/mo'
    },
    {
      category: 'Mobile Alerts',
      service: 'Telegram + PagerDuty Webhooks',
      provider: 'Telegram / PagerDuty',
      specs: 'Escalation policies & team dispatch',
      cost: '$0.00',
      period: 'included'
    },
    {
      category: 'Version Control',
      service: 'GitHub Enterprise API',
      provider: 'GitHub Cloud / Server',
      specs: 'Automated PRs, security branch protections',
      cost: '$0.00',
      period: 'included'
    },
    {
      category: 'Sandbox Repro',
      service: 'Dedicated Cloud Sandboxes',
      provider: 'Docker / Ephemeral Runners',
      specs: 'Parallel multi-repo reproduction runners',
      cost: '$8.00',
      period: '/mo'
    },
    {
      category: 'Desktop App',
      service: 'Fleet Desktop Console',
      provider: 'Electron Native App',
      specs: 'Unlimited team operators with live telemetry',
      cost: '$0.00',
      period: 'client-side'
    }
  ];

  const currentCostItems = costTier === 'standard' ? costItemsStandard : costItemsEnterprise;
  const currentTotal = costTier === 'standard' ? '$8.86' : '$56.50';

  // ---------------------------------------------------------------------------
  // SLIDE 2 DATA: Tech Stack & Purposes
  // ---------------------------------------------------------------------------
  const techCategories = [
    { id: 'all', label: 'All Technologies' },
    { id: 'backend', label: 'Backend & Ingestion' },
    { id: 'ai', label: 'AI & Remediation' },
    { id: 'sandbox', label: 'Sandbox & Git' },
    { id: 'integrations', label: 'Integrations & Alerts' },
    { id: 'desktop', label: 'Desktop UI' }
  ];

  const technologies = [
    {
      name: 'Python 3.14 & FastAPI',
      category: 'backend',
      badge: 'Core Engine',
      badgeColor: 'text-[#388bfd] bg-[#162033] border-[#233352]',
      purpose:
        'Powers the high-performance async REST backend, server-sent events (SSE) live telemetry stream, and background ingestion routers.'
    },
    {
      name: 'SQLite (WAL Mode)',
      category: 'backend',
      badge: 'Persistence',
      badgeColor: 'text-[#58a6ff] bg-[#162033] border-[#233352]',
      purpose:
        'Provides zero-latency embedded ACID storage with thread-safe connection pooling for runs, audit logs, and deduplication shields.'
    },
    {
      name: 'Google GenAI SDK (google.genai)',
      category: 'ai',
      badge: 'Official Gemini SDK',
      badgeColor: 'text-[#7ee787] bg-[#13281c] border-[#1d472c]',
      purpose:
        'Official Google GenAI Python SDK connecting ProdPilot to Gemini 2.5 Flash for deep semantic log triage, traceback parsing, suspect commit isolation, and surgical Python code patching.'
    },
    {
      name: 'Google Antigravity SDK',
      category: 'ai',
      badge: 'Agent Framework',
      badgeColor: 'text-[#7ee787] bg-[#13281c] border-[#1d472c]',
      purpose:
        'In-process Google AI agent framework utilizing capabilities config and local workspace sandboxing for autonomous multi-turn repair workflows.'
    },
    {
      name: 'TypeSafe Jev (Decision Engine)',
      category: 'ai',
      badge: 'Recovery Arbiter',
      badgeColor: 'text-[#ffa657] bg-[#291b12] border-[#4a2e1c]',
      purpose:
        'Powered by typesafe/jev-1.14 on OpenRouter Decisions API. Evaluates canary health, blast radius, and patch complexity to probabilistically decide FIX_FORWARD vs ROLLBACK with calibrated confidence.'
    },
    {
      name: 'Git Worktrees (`git worktree`)',
      category: 'sandbox',
      badge: 'Sandbox Isolation',
      badgeColor: 'text-[#ffa657] bg-[#291b12] border-[#4a2e1c]',
      purpose:
        'Instantly creates isolated branch directories from the active repo without cloning, preventing dirty worktree conflicts.'
    },
    {
      name: 'Pytest Repro Sandbox',
      category: 'sandbox',
      badge: 'Verification',
      badgeColor: 'text-[#ffa657] bg-[#291b12] border-[#4a2e1c]',
      purpose:
        'Executes reproduction tests to mathematically confirm the crash exists, applies the patch, and re-tests to prove the fix.'
    },
    {
      name: 'Twilio Programmable Voice',
      category: 'integrations',
      badge: 'Emergency Voice',
      badgeColor: 'text-[#ff7b72] bg-[#2a1418] border-[#4b2027]',
      purpose:
        'Outbound interactive telephony companion with live status lifecycles (Ringing, Speaking, Listening) and voice-activated approval.'
    },
    {
      name: 'Telegram Bot API',
      category: 'integrations',
      badge: 'Instant Alerting',
      badgeColor: 'text-[#388bfd] bg-[#162033] border-[#233352]',
      purpose:
        'Dispatches multi-stage markdown cards with suspect commit diffs and inline interactive buttons for one-tap mobile review.'
    },
    {
      name: 'GitHub REST API & Octokit',
      category: 'integrations',
      badge: 'PR Automation',
      badgeColor: 'text-[#c9d1d9] bg-[#1c212c] border-[#2e3748]',
      purpose:
        'Pushes fix branches to origin, opens Pull Requests with Root Cause Analysis post-mortems, and applies takeover safety notices.'
    },
    {
      name: 'Electron 28 & Vite 5',
      category: 'desktop',
      badge: 'Desktop App',
      badgeColor: 'text-[#58a6ff] bg-[#162033] border-[#233352]',
      purpose:
        'Delivers a native operator desktop experience with hardware acceleration, hot reloading, and zero cloud UI latency.'
    },
    {
      name: 'React 18 & TailwindCSS',
      category: 'desktop',
      badge: 'Design System',
      badgeColor: 'text-[#58a6ff] bg-[#162033] border-[#233352]',
      purpose:
        'Renders the sleek dark-mode glassmorphic interface, dynamic 7-stage incident progress bars, and dense table views.'
    }
  ];

  const filteredTech =
    selectedTechCategory === 'all'
      ? technologies
      : technologies.filter((t) => t.category === selectedTechCategory);

  // ---------------------------------------------------------------------------
  // SLIDE 3 DATA: Presentation Script
  // ---------------------------------------------------------------------------
  const scriptActs = [
    {
      act: 'Act I',
      title: 'The 3:00 AM On-Call Crisis',
      timing: '0:00 – 0:45',
      tag: 'THE HOOK',
      tagColor: 'text-[#ff7b72] bg-[#2a1418] border-[#4b2027]',
      spoken:
        '"Picture this: It\'s 3:00 AM on a Saturday. A critical production service crashes with a NullPointer or 500 error. The on-call engineer is sound asleep. By the time they wake up, dig through logs, isolate the commit, reproduce the issue, and push a hotfix, 45 minutes of downtime have passed. What if your infrastructure could diagnose, reproduce, patch, and test the fix before the engineer even opens their laptop?"',
      actionPrompt:
        'Point to the ProdPilot Incidents overview screen or show an incoming simulated crash alert.',
      goal: 'Hook the audience with the universally painful reality of late-night on-call firefighting.'
    },
    {
      act: 'Act II',
      title: 'The Autonomous 7-Stage Fix Loop',
      timing: '0:45 – 2:00',
      tag: 'LIVE DEMO',
      tagColor: 'text-[#7ee787] bg-[#13281c] border-[#1d472c]',
      spoken:
        '"ProdPilot claims the incident the millisecond it occurs. Within 3 seconds, it extracts the exact stack trace, performs a git blame on recent commits, and creates an isolated Git worktree sandbox. Notice what happens next: ProdPilot writes a reproduction test that proves the bug exists. It then invokes Gemini to generate a surgical patch, applies it in the sandbox, re-runs the test, and executes a staging canary check."',
      actionPrompt:
        'Click on incident card (e.g. chunkstream). Point to the 7-stage progress bar: INVESTIGATING → REPRODUCING → FIXING → CANARY_STAGING → AWAITING_APPROVAL.',
      goal: 'Demonstrate mathematically proven remediation — not blind code generation, but verified fixes.'
    },
    {
      act: 'Act III',
      title: 'Human-in-the-Loop & Live Voice Companion',
      timing: '2:00 – 3:15',
      tag: 'TELEPHONY & SAFETY',
      tagColor: 'text-[#58a6ff] bg-[#162033] border-[#233352]',
      spoken:
        '"ProdPilot is autonomous, but never reckless. It does not push directly to production. Instead, it creates a clean GitHub Pull Request and dials the on-call engineer via our Twilio Voice Hotline. Notice our live status button: it tracks every telephony step from Dialing to AI Speaking to Listening. The engineer can approve via voice, click merge in the UI, or hit Manual Takeover — which instantly cancels all background pipeline actions with zero race conditions."',
      actionPrompt:
        'Point to the Voice Hotline button in the incident header. Highlight the Manual Takeover & Resume buttons and GitHub PR link.',
      goal: 'Showcase absolute safety guards, telephone hotlines, and total operator authority.'
    },
    {
      act: 'Act IV',
      title: 'Under the Hood & $10/mo Economics',
      timing: '3:15 – 4:15',
      tag: 'ARCHITECTURE & ROI',
      tagColor: 'text-[#d2a8ff] bg-[#221736] border-[#3e2760]',
      spoken:
        '"Under the hood, ProdPilot is built for maximum speed and rock-bottom cost. It runs on the official Google GenAI SDK (Gemini 2.5 Flash), Python FastAPI, SQLite WAL, Git Worktrees, and an Electron desktop command center. The total operational cost per repository is less than $10 to $15 per month. Against an industry outage cost of $500 to $1,000 per incident in developer hours, ProdPilot delivers over 40x immediate ROI."',
      actionPrompt:
        'Switch back to Slide 1 (Cost Estimation) and Slide 2 (Architecture Matrix).',
      goal: 'Prove feasibility, rock-solid engineering decisions, and overwhelming financial justification.'
    },
    {
      act: 'Act V',
      title: 'Closing & Audience Q&A',
      timing: '4:15 – 5:00',
      tag: 'CONCLUSION',
      tagColor: 'text-[#ffa657] bg-[#291b12] border-[#4a2e1c]',
      spoken:
        '"ProdPilot turns 45 minutes of stressful 3:00 AM downtime into a 4-minute verified Pull Request with full human oversight. Self-healing infrastructure, verified in sandboxes, at consumer pricing. Thank you, and I look forward to your questions."',
      actionPrompt:
        'Open floor for Q&A. Keep dashboard active on the second screen.',
      goal: 'Leave a memorable impression of automated reliability and safety.'
    }
  ];

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-[#0a0d14] text-[#c9d1d9] select-none font-sans overflow-hidden ${
        isFullscreen ? 'p-6 fixed inset-0 z-50 bg-[#070a10]' : 'p-4'
      }`}
    >
      {/* Top Deck Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1b2234] mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#162033] border border-[#233352] text-[#58a6ff]">
            <Presentation size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#f0f6fc]">
                ProdPilot Pitch & Architecture Deck
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#162033] text-[#58a6ff] border border-[#233352]">
                SLIDE {currentSlideIndex + 1} OF {totalSlides}
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              {currentSlideIndex === 0 && 'Slide 1: Comprehensive Cost Estimation & ROI per Repo'}
              {currentSlideIndex === 1 && 'Slide 2: System Architecture & Technologies Used'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Slide Tab Buttons */}
          <div className="hidden md:flex items-center bg-[#0d121d] border border-[#1b2234] rounded-lg p-0.5">
            <button
              onClick={() => setCurrentSlideIndex(0)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${
                currentSlideIndex === 0
                  ? 'bg-[#172033] text-[#58a6ff] font-semibold border border-[#263753]'
                  : 'text-[#8b949e] hover:text-[#f0f6fc]'
              }`}
            >
              <DollarSign size={13} />
              <span>1. Cost Estimation</span>
            </button>
            <button
              onClick={() => setCurrentSlideIndex(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${
                currentSlideIndex === 1
                  ? 'bg-[#172033] text-[#58a6ff] font-semibold border border-[#263753]'
                  : 'text-[#8b949e] hover:text-[#f0f6fc]'
              }`}
            >
              <Cpu size={13} />
              <span>2. Tech Stack</span>
            </button>
          </div>

          {/* Quick Prev/Next */}
          <div className="flex items-center bg-[#0d121d] border border-[#1b2234] rounded-lg p-0.5">
            <button
              onClick={goToPrev}
              disabled={currentSlideIndex === 0}
              className={`p-1.5 rounded hover:bg-[#192233] transition ${
                currentSlideIndex === 0 ? 'text-[#3d444d] cursor-not-allowed' : 'text-[#8b949e] hover:text-[#f0f6fc]'
              }`}
              title="Previous slide (Left Arrow)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs font-mono text-[#8b949e]">
              {currentSlideIndex + 1}/{totalSlides}
            </span>
            <button
              onClick={goToNext}
              disabled={currentSlideIndex === totalSlides - 1}
              className={`p-1.5 rounded hover:bg-[#192233] transition ${
                currentSlideIndex === totalSlides - 1
                  ? 'text-[#3d444d] cursor-not-allowed'
                  : 'text-[#8b949e] hover:text-[#f0f6fc]'
              }`}
              title="Next slide (Right Arrow / Space)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d121d] hover:bg-[#162033] border border-[#1b2234] text-xs font-medium text-[#8b949e] hover:text-[#f0f6fc] transition"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Main Slide Canvas Container */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden relative">
        <div className="w-full h-full max-w-6xl bg-gradient-to-br from-[#0e131f] via-[#0b0f17] to-[#070a10] border border-[#1e273a] rounded-xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Ambient Glow Effects */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#388bfd]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#7ee787]/5 rounded-full blur-3xl pointer-events-none" />

          {/* ---------------------------------------------------------------- */}
          {/* SLIDE 1: COST ESTIMATION                                          */}
          {/* ---------------------------------------------------------------- */}
          {currentSlideIndex === 0 && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
              {/* Slide Title & Subtitle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1b2234] gap-3 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#162033] text-[#58a6ff] border border-[#233352]">
                      ECONOMICS & INFRASTRUCTURE
                    </span>
                    <span className="text-xs text-[#8b949e]">Slide 1 of 2</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f0f6fc] tracking-tight">
                    Monthly Cost Estimation per Repository
                  </h1>
                  <p className="text-xs sm:text-sm text-[#8b949e]">
                    Transparent pricing model for hosting and operating ProdPilot autonomously
                  </p>
                </div>

                {/* Tier Switcher */}
                <div className="flex items-center bg-[#090d16] border border-[#1e273a] rounded-lg p-1 flex-shrink-0">
                  <button
                    onClick={() => setCostTier('standard')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      costTier === 'standard'
                        ? 'bg-[#162033] text-[#58a6ff] border border-[#243553]'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    Standard Repo (5–15 Incidents)
                  </button>
                  <button
                    onClick={() => setCostTier('enterprise')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      costTier === 'enterprise'
                        ? 'bg-[#162033] text-[#58a6ff] border border-[#243553]'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    Enterprise Fleet (60+ Incidents)
                  </button>
                </div>
              </div>

              {/* KPI Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 flex-shrink-0">
                <div className="p-3 rounded-lg bg-[#111622]/90 border border-[#1e273a]">
                  <div className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider mb-0.5">
                    Total Estimated Cost
                  </div>
                  <div className="text-2xl font-black text-[#58a6ff] font-mono">
                    {currentTotal}
                    <span className="text-xs font-normal text-[#8b949e]"> /month</span>
                  </div>
                  <div className="text-[11px] text-[#3fb950] font-medium flex items-center gap-1 mt-0.5">
                    <TrendingUp size={12} />
                    <span>Predictable baseline</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#111622]/90 border border-[#1e273a]">
                  <div className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider mb-0.5">
                    Marginal Cost / Incident
                  </div>
                  <div className="text-2xl font-black text-[#7ee787] font-mono">
                    {costTier === 'standard' ? '~$0.28' : '~$0.93'}
                  </div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5">
                    Direct API tokens + Twilio voice mins
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#111622]/90 border border-[#1e273a]">
                  <div className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider mb-0.5">
                    Avg. Downtime Reduced
                  </div>
                  <div className="text-2xl font-black text-[#ffa657] font-mono">
                    45m → 4m
                  </div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5">
                    ~91% MTTR compression
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#111622]/90 border border-[#1e273a]">
                  <div className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider mb-0.5">
                    Engineering Labor ROI
                  </div>
                  <div className="text-2xl font-black text-[#d2a8ff] font-mono">
                    {costTier === 'standard' ? '30x – 60x' : '15x – 35x'}
                  </div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5">
                    vs. 2 on-call engineers ($120/hr loaded)
                  </div>
                </div>
              </div>

              {/* Main Cost Breakdown Table */}
              <div className="flex-1 overflow-y-auto border border-[#1b2234] rounded-lg bg-[#0d121d]/80 mb-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121824] text-[#8b949e] text-[11px] font-semibold border-b border-[#1b2234] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Service / Component</th>
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Resource Specs & Usage</th>
                      <th className="py-2.5 px-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030] text-[#c9d1d9]">
                    {currentCostItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#141b29] transition">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-[#f0f6fc]">{item.service}</div>
                          <div className="text-[10px] text-[#6e7681]">{item.category}</div>
                        </td>
                        <td className="py-2 px-3 text-[#8b949e]">{item.provider}</td>
                        <td className="py-2 px-3 text-[#8b949e] text-[11px] hidden sm:table-cell">
                          {item.specs}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#f0f6fc]">
                          <span className={item.cost === '$0.00' ? 'text-[#3fb950]' : 'text-[#79c0ff]'}>
                            {item.cost}
                          </span>
                          <span className="text-[10px] text-[#6e7681] font-normal ml-1">
                            {item.period}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom ROI Comparison Banner */}
              <div className="p-3 rounded-lg bg-[#121824] border border-[#1f293d] space-y-2 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#3fb950] flex-shrink-0" />
                    <span className="text-[#8b949e]">
                      <strong className="text-[#f0f6fc]">The Outage Comparison:</strong> A standard 45-minute outage consumes{' '}
                      <span className="text-[#ff7b72] font-semibold">$180 – $360</span> in direct loaded engineer triage (2 SREs @ $120–$150/hr), excluding customer downtime impact. An autonomous resolution in &lt;4 mins recoups an entire year of ProdPilot in one incident.
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#3fb950] font-semibold flex-shrink-0 whitespace-nowrap">
                    Total: {currentTotal} / month
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1b2234] text-[11px] text-[#6e7681] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]" />
                    <span>
                      <strong className="text-[#8b949e]">Infrastructure Reality Note:</strong> Sized for standard microservice workloads (FastAPI, Node.js, Go). For heavy monoliths with large test suites (e.g., Pandas, Chromium), a 2 vCPU / 4GB compute runner (~$12–$18/mo) is recommended; API inference remains &lt;$0.50/mo.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#58a6ff]">2026 Verified Provider Rates</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* SLIDE 2: TECHNOLOGIES & PURPOSES                                 */}
          {/* ---------------------------------------------------------------- */}
          {currentSlideIndex === 1 && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
              {/* Slide Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1b2234] gap-2 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#162033] text-[#58a6ff] border border-[#233352]">
                      ENGINEERING STACK
                    </span>
                    <span className="text-xs text-[#8b949e]">Slide 2 of 2</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f0f6fc] tracking-tight">
                    Technologies Used & Their Purposes
                  </h1>
                  <p className="text-xs sm:text-sm text-[#8b949e]">
                    Comprehensive breakdown of every library, runtime, and API powering the pipeline
                  </p>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {techCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedTechCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition ${
                        selectedTechCategory === cat.id
                          ? 'bg-[#162033] text-[#58a6ff] font-semibold border border-[#233352]'
                          : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#121824]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Technologies Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-4 flex-1 overflow-y-auto">
                {filteredTech.map((tech, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#111622]/90 border border-[#1e273a] hover:border-[#388bfd]/50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${tech.badgeColor}`}>
                          {tech.badge}
                        </span>
                        <span className="text-[10px] uppercase font-mono text-[#6e7681]">
                          {tech.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#f0f6fc] mb-1.5 flex items-center gap-1.5">
                        <Cpu size={14} className="text-[#58a6ff]" />
                        {tech.name}
                      </h3>
                      <p className="text-xs text-[#8b949e] leading-relaxed">
                        {tech.purpose}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* SLIDE FOOTER META                                                */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-center justify-between border-t border-[#1b2234] pt-3 text-xs text-[#6e7681] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
              <span className="font-medium text-[#c9d1d9]">ProdPilot Presentation Deck</span>
              <span className="text-[#3d444d]">·</span>
              <span className="hidden sm:inline">Use [1], [2] or [←] [→] to switch slides</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="font-mono text-[#58a6ff] font-semibold">
                Slide {currentSlideIndex + 1} of {totalSlides}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Navigation Toolbar */}
      <div className="pt-2.5 flex items-center justify-between text-xs text-[#8b949e] flex-shrink-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">←</span>
          <span>Previous</span>
          <span className="mx-1 text-[#3d444d]">·</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">→</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">Space</span>
          <span>Next</span>
          <span className="mx-1 text-[#3d444d]">·</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">1–2</span>
          <span>Direct Jump</span>
          <span className="mx-1 text-[#3d444d]">·</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">F</span>
          <span>Fullscreen</span>
        </div>

        {/* Thumbnail Dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1].map((idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? 'w-6 bg-[#58a6ff]'
                  : 'w-2 bg-[#1f293d] hover:bg-[#388bfd]/50'
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
