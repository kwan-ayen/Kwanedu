import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { DivisionId, HeroSlide, PublicPageId } from '../../types/kwan';
import { SafeImage } from './SafeImage';

interface HeroImageSliderProps {
  slides: HeroSlide[];
  fallbackAlt: string;
  fallbackImageUrl?: string;
  compact?: boolean;
  autoplay?: boolean;
  intervalSeconds?: number;
  primaryAccent?: string;
  secondaryAccent?: string;
}

function buildSlideHref(target?: PublicPageId, division?: DivisionId): string {
  const params = new URLSearchParams({
    page: target || 'get_started',
    view: 'public',
  });
  if (division) {
    params.set('division', division);
  }
  return `/?${params.toString()}`;
}

export function HeroImageSlider({
  slides,
  fallbackAlt,
  fallbackImageUrl,
  compact = false,
  autoplay = true,
  intervalSeconds = 5,
  secondaryAccent = '#f28c28',
}: HeroImageSliderProps) {
  const activeSlides = slides.filter((s) => s.active !== false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const safeIndex = activeSlides.length > 0 ? activeIndex % activeSlides.length : 0;
  const intervalMs = Math.max(2000, Math.round((intervalSeconds || 5) * 1000));

  useEffect(() => {
    if (!autoplay || paused || activeSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % activeSlides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, paused, activeSlides.length, intervalMs]);

  if (activeSlides.length === 0) {
    if (!fallbackImageUrl) {
      return (
        <div
          className={`w-full rounded-2xl glass-card flex items-center justify-center text-xs text-slate-600 ${
            compact ? 'h-48' : 'h-72 sm:h-96 lg:h-[440px]'
          }`}
        >
          No active promotional banners. Enable or upload a slide in CMS.
        </div>
      );
    }
    return (
      <SafeImage
        src={fallbackImageUrl}
        alt={fallbackAlt}
        className={`w-full object-cover rounded-2xl border border-white/80 shadow-lift ${
          compact ? 'h-48' : 'h-72 sm:h-96 lg:h-[440px]'
        }`}
      />
    );
  }

  const current = activeSlides[safeIndex];
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % activeSlides.length);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional Hero Banners"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === 'ArrowRight') goNext();
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || activeSlides.length <= 1) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        if (Math.abs(delta) > 40) {
          if (delta > 0) goPrev();
          else goNext();
        }
        touchStartX.current = null;
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/75 bg-stone-900 shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28] ${
        compact ? 'h-48' : 'h-72 sm:h-96 lg:h-[440px]'
      }`}
    >
      {/* Compositor-Only Crossfade & Subtle Scale Stack */}
      {activeSlides.map((slide, idx) => (
        <div
          key={slide.id}
          aria-hidden={idx !== safeIndex}
          className={`absolute inset-0 transition-all duration-500 ease-out ${
            idx === safeIndex ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-[1.02] z-0 pointer-events-none'
          }`}
        >
          <SafeImage
            src={slide.imageUrl}
            alt={slide.title || slide.caption || fallbackAlt}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Neutral Charcoal Scrim for WCAG AA Contrast */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(17, 24, 39, 0.90) 0%, rgba(17, 24, 39, 0.42) 48%, rgba(17, 24, 39, 0.08) 100%)',
        }}
      />

      {/* Top-Right Play/Pause & Tabular Slide Counter */}
      {activeSlides.length > 1 && (
        <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-black/45 backdrop-blur-md border border-white/25 text-white text-[11px] font-mono-tabular">
            {String(safeIndex + 1).padStart(2, '0')} / {String(activeSlides.length).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused || !autoplay ? 'Play hero slideshow' : 'Pause hero slideshow'}
            className="p-2 rounded-md bg-black/45 backdrop-blur-md border border-white/25 text-white hover:bg-black/65 transition-colors"
          >
            {paused || !autoplay ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Bottom Promotional Content, CTA Link & Slider Navigation */}
      <div className="absolute inset-x-0 bottom-0 z-30 p-5 sm:p-7 space-y-3.5">
        <div className="flex items-end justify-between gap-4">
          <div
            key={current.id}
            className="text-white space-y-1.5 max-w-lg animate-kwan-slide-text bg-black/30 backdrop-blur-md border border-white/15 rounded-xl p-3.5"
          >
            <p className="text-xs font-semibold tracking-wide" style={{ color: secondaryAccent }}>
              {current.divisionLabel}
            </p>
            {current.title && (
              <h3 className={`${compact ? 'text-sm' : 'text-lg sm:text-xl'} font-display font-bold leading-snug text-white`}>
                {current.title}
              </h3>
            )}
            {!compact && <p className="text-xs sm:text-sm leading-relaxed text-stone-100">{current.caption}</p>}
            {!compact && current.ctaLabel && (
              <div className="pt-1.5">
                <a
                  href={buildSlideHref(current.ctaTarget, current.divisionParam)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: secondaryAccent, color: '#1b1104' }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold hover:opacity-95 transition-opacity whitespace-nowrap shadow-glow"
                >
                  {current.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {activeSlides.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous promotional banner"
                className="p-2 rounded-lg bg-black/45 backdrop-blur-md text-white hover:bg-black/65 border border-white/25 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next promotional banner"
                className="p-2 rounded-lg bg-black/45 backdrop-blur-md text-white hover:bg-black/65 border border-white/25 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Segment Bar Indicators */}
        {activeSlides.length > 1 && (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeSlides.length}, minmax(0, 1fr))` }}>
            {activeSlides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`View banner ${idx + 1}: ${slide.title || slide.divisionLabel}`}
                style={{ backgroundColor: idx === safeIndex ? secondaryAccent : 'rgba(255,255,255,0.35)' }}
                className="h-1.5 rounded-full transition-all hover:opacity-90"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
