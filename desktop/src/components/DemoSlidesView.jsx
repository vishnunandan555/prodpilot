import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Presentation,
  Layers,
  Sparkles,
  Command,
  ArrowRight
} from 'lucide-react';

// Slide templates/definitions - currently initialized with a ready cover slide
// Custom slides will be added here once specified by the user
export const SLIDES = [
  {
    id: 1,
    title: 'ProdPilot Live Demo',
    subtitle: 'Autonomous SRE & Self-Healing Production Infrastructure',
    tag: 'SLIDE DECK READY',
    description:
      'Presentation deck framework initialized. Tell me what content, diagrams, architecture charts, or bullet points to add, and each slide will be generated here.',
    notes: 'Press Left/Right arrows or Spacebar to navigate between slides. Press F or click Maximize for fullscreen mode.',
    highlights: [
      { label: 'Interactive Slides', desc: 'Static slides for pitch & live architecture walkthroughs' },
      { label: 'Full Navigation', desc: 'Keyboard arrows (← / →), Spacebar, thumbnail bar, and fullscreen' },
      { label: 'Custom Layouts', desc: 'Ready to receive custom text, code snippets, metrics, and diagrams' }
    ]
  }
];

export default function DemoSlidesView() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  const totalSlides = SLIDES.length;
  const currentSlide = SLIDES[currentSlideIndex] || SLIDES[0];

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
      // Don't intercept if user is typing in an input or textarea
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, totalSlides, isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-[#0a0d14] text-[#c9d1d9] select-none font-sans overflow-hidden ${
        isFullscreen ? 'p-6 fixed inset-0 z-50 bg-[#070a10]' : 'p-4'
      }`}
    >
      {/* Top Deck Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1b2234] mb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-[#162033] border border-[#233352] text-[#58a6ff]">
            <Presentation size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#f0f6fc]">Demo Presentation</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#162033] text-[#58a6ff] border border-[#233352]">
                SLIDE {currentSlideIndex + 1} / {totalSlides}
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Static pitch & demonstration deck
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Slide Selector Pill */}
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
              {currentSlideIndex + 1} of {totalSlides}
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
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Main Slide Presentation Canvas (16:9 responsive frame) */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden relative">
        <div className="w-full max-w-5xl aspect-video max-h-full bg-gradient-to-br from-[#0e131f] via-[#0b0f17] to-[#070a10] border border-[#1e273a] rounded-xl shadow-2xl p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden group">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#388bfd]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#7ee787]/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Slide Meta */}
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#162033] text-[#58a6ff] border border-[#233352]">
                {currentSlide.tag || 'PRODPILOT SLIDES'}
              </span>
              <span className="text-xs text-[#8b949e]">Slide #{currentSlide.id}</span>
            </div>
            <div className="text-xs font-mono text-[#6e7681]">
              Use ← / → to navigate
            </div>
          </div>

          {/* Slide Body Content */}
          <div className="my-auto py-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#f0f6fc] tracking-tight mb-3">
              {currentSlide.title}
            </h1>
            {currentSlide.subtitle && (
              <p className="text-lg sm:text-xl font-medium text-[#79c0ff] mb-6">
                {currentSlide.subtitle}
              </p>
            )}
            {currentSlide.description && (
              <p className="text-sm sm:text-base text-[#8b949e] max-w-2xl leading-relaxed mb-8">
                {currentSlide.description}
              </p>
            )}

            {/* Feature Highlights Grid */}
            {currentSlide.highlights && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {currentSlide.highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#121824]/80 border border-[#1f293d] hover:border-[#388bfd]/40 transition"
                  >
                    <div className="text-xs font-semibold text-[#f0f6fc] mb-1 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#58a6ff]" />
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[#8b949e] leading-snug">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Slide Footer */}
          <div className="flex items-center justify-between border-t border-[#1b2234] pt-4 text-xs text-[#6e7681]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
              <span>ProdPilot Deck Engine</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              {currentSlide.notes && (
                <span className="text-[#8b949e] hidden sm:inline">{currentSlide.notes}</span>
              )}
              <span className="font-mono text-[#58a6ff]">
                {currentSlideIndex + 1} / {totalSlides}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Navigation Toolbar */}
      <div className="pt-3 flex items-center justify-between text-xs text-[#8b949e] flex-shrink-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">←</span>
          <span>Previous</span>
          <span className="mx-1 text-[#3d444d]">·</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">→</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">Space</span>
          <span>Next</span>
          <span className="mx-1 text-[#3d444d]">·</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121824] border border-[#1b2234] font-mono">F</span>
          <span>Fullscreen</span>
        </div>

        {/* Thumbnail Dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? 'w-6 bg-[#58a6ff]'
                  : 'w-2 bg-[#1f293d] hover:bg-[#388bfd]/50'
              }`}
              title={`Go to slide ${idx + 1}: ${slide.title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
