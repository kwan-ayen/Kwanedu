import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type {
  BlogCategory,
  BlogPost,
  ClassLevel,
  DivisionId,
  PlatformState,
  PublicPageId,
  ResourceItem,
  UpperSecondaryStream,
  UserAccount,
  WebsiteSection,
} from '../../types/kwan';
import {
  api,
  DIVISION_META,
  formatUGX,
  UPPER_SECONDARY_COMBINATIONS,
} from '../../lib/api';
import { SafeImage } from '../shared/SafeImage';
import { HeroImageSlider } from '../shared/HeroImageSlider';
import { PaymentCheckoutModal } from '../shared/PaymentCheckoutModal';

interface PublicWebsiteProps {
  state: PlatformState;
  activePage: PublicPageId;
  currentUser: UserAccount | null;
  onNavigate: (page: PublicPageId) => void;
  onLoginSuccess: (user: UserAccount, nextState?: PlatformState, sessionToken?: string) => void;
  onReturnToWorkspace?: () => void;
  onStateChange: (next: PlatformState) => void;
}

const DIVISION_CARDS: {
  id: DivisionId;
  title: string;
  classesLabel: string;
  vibe: string;
  accentHex: string;
  description: string;
  imageUrl: string;
}[] = [
  {
    id: 'primary',
    title: 'Primary Education',
    classesLabel: 'P.4 – P.7',
    vibe: 'Playful · Illustrated · Parent View',
    accentHex: '#10B981',
    description:
      'Friendly, colourful, illustrated lessons, short videos, interactive exercises, rewards, and parent visibility.',
    imageUrl: '/src/assets/images/division_primary_1794577152032.jpg',
  },
  {
    id: 'lower_secondary',
    title: 'Lower Secondary',
    classesLabel: 'S.1 – S.4',
    vibe: 'Structured · O-Level Labs · Red/Green Pen',
    accentHex: '#0f766e',
    description:
      'Structured subject modules, downloadable notes, timed quizzes, red & green pen marking, and UCE preparation.',
    imageUrl: '/src/assets/images/division_lower_secondary_1794577152479.jpg',
  },
  {
    id: 'upper_secondary',
    title: 'Upper Secondary',
    classesLabel: 'S.5 – S.6',
    vibe: 'Scholarly · Combinations · Seminar Rubrics',
    accentHex: '#18181b',
    description:
      'Principal subject combinations, seminar research projects, practical error analysis, and rubric assessments.',
    imageUrl: '/src/assets/images/division_upper_secondary_1794577153179.jpg',
  },
];

function buildPageHref(page: PublicPageId, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ page, view: 'public', ...extra });
  return `/?${params.toString()}`;
}

function getInitialDivisionFromUrl(): DivisionId {
  const raw = new URLSearchParams(window.location.search).get('division');
  if (raw === 'primary' || raw === 'lower_secondary' || raw === 'upper_secondary') {
    return raw;
  }
  return 'primary';
}

const BUILT_IN_PUBLIC_PAGE_IDS = new Set(['home', 'about', 'blog', 'resources', 'get_started', 'login']);

const HERO_SPOTLIGHT_PHRASES = [
  'Primary Education (P.4 – P.7) · Illustrated Lessons & Interactive Fraction Labs',
  'Lower Secondary (S.1 – S.4) · Structured O-Level Notes, Quizzes & Red-Green Marking',
  'Upper Secondary (S.5 – S.6) · Sciences & Arts Combinations with Seminar Rubrics',
  'Three Distinct Learning Environments · Live Course Completion & Quiz Analytics',
];

export function PublicWebsite({
  state,
  activePage,
  currentUser,
  onNavigate: _onNavigate,
  onLoginSuccess,
  onReturnToWorkspace: _onReturnToWorkspace,
  onStateChange,
}: PublicWebsiteProps) {
  const cms = state.cmsPublished;
  const publicNavItems = cms.navItems.filter((item) => item.id !== 'login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroPhraseIndex, setHeroPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroPhraseIndex((prev) => (prev + 1) % HERO_SPOTLIGHT_PHRASES.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  // Blog State
  const [blogCategoryFilter, setBlogCategoryFilter] = useState<string>('All');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');

  // Resources State
  const [resDivisionFilter, setResDivisionFilter] = useState<'all' | DivisionId>('all');
  const [previewResource, setPreviewResource] = useState<ResourceItem | null>(null);
  const [checkoutResource, setCheckoutResource] = useState<ResourceItem | null>(null);

  // Get Started Registration State (supports ?division=... preselection when opened in new tab)
  const initialDiv = getInitialDivisionFromUrl();
  const [regDivision, setRegDivision] = useState<DivisionId>(initialDiv);
  const [regClass, setRegClass] = useState<ClassLevel>(DIVISION_META[initialDiv].classes[0]);
  const [regStream, setRegStream] = useState<UpperSecondaryStream>('Sciences');
  const [regCombo, setRegCombo] = useState(UPPER_SECONDARY_COMBINATIONS.Sciences[0].label);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirmPass, setShowRegConfirmPass] = useState(false);
  const [regGuardianName, setRegGuardianName] = useState('');
  const [regGuardianContact, setRegGuardianContact] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ required: boolean; setupKeyConfigured: boolean } | null>(null);
  const [setupKey, setSetupKey] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (activePage !== 'login') return;
    api.getAdminSetupStatus().then(setSetupStatus).catch((err) => {
      setSetupError(err instanceof Error ? err.message : 'Unable to check administrator setup status.');
    });
  }, [activePage]);

  const renderCmsSection = (sec: WebsiteSection) => {
    if (!sec.visible) return null;
    const bodyAccent = cms.theme.secondaryAccent || '#10B981';

    if (sec.type === 'hero') {
      return (
        <section
          key={sec.id}
          style={{ color: sec.textColor, backgroundColor: sec.backgroundColor }}
          className="border-b border-white/75 bg-hero-glow relative"
        >
          <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5 glass-card rounded-3xl p-7 lg:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
                Unified Multi-Division Learning · P.4 – S.6
              </p>

              <h1
                className="text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight text-balance leading-[1.08] text-slate-950"
                style={{ fontFamily: cms.theme.headingFont }}
              >
                {sec.heading}
              </h1>

              <div className="min-h-[38px] overflow-hidden flex items-center gap-2.5 px-3.5 py-2 rounded-xl glass-panel text-xs sm:text-sm font-semibold text-slate-900">
                <Sparkles className="w-4 h-4 shrink-0" style={{ color: bodyAccent }} />
                <AnimatePresence mode="wait">
                  <motion.p
                    key={heroPhraseIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35 }}
                    className="truncate"
                  >
                    {HERO_SPOTLIGHT_PHRASES[heroPhraseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <p className="text-lg font-medium max-w-xl text-slate-900">{sec.subheading}</p>
              <p className="text-sm leading-relaxed max-w-xl text-slate-600">{sec.bodyText}</p>

              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <a
                  href={buildPageHref(sec.ctaTarget)}
                  style={{ backgroundColor: bodyAccent, color: '#fff' }}
                  className={`px-6 py-3 text-sm font-bold hover:opacity-95 transition-all inline-flex items-center gap-2 whitespace-nowrap shadow-glow ${cms.theme.buttonStyle}`}
                >
                  {sec.ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={buildPageHref('about')}
                  className={`px-5 py-3 text-sm font-semibold glass-panel text-slate-900 hover:bg-white/85 transition-colors inline-flex items-center gap-2 whitespace-nowrap ${cms.theme.buttonStyle}`}
                >
                  Academic Architecture
                </a>
              </div>
            </div>

            {sec.slides && sec.slides.length > 0 ? (
              <div className="lg:col-span-6 glass-card p-2.5 rounded-3xl">
                <HeroImageSlider
                  slides={sec.slides}
                  fallbackAlt={sec.heading}
                  fallbackImageUrl={sec.imageUrl}
                  autoplay={sec.sliderAutoplay ?? true}
                  intervalSeconds={sec.sliderIntervalSeconds ?? 5}
                  secondaryAccent={bodyAccent}
                />
              </div>
            ) : (
              sec.imageUrl && (
                <div className="lg:col-span-6 glass-card p-2.5 rounded-3xl">
                  <SafeImage
                    src={sec.imageUrl}
                    alt={sec.heading}
                    className="w-full h-72 lg:h-[420px] object-cover rounded-2xl border border-white/80 shadow-lift"
                  />
                </div>
              )
            )}
          </div>
        </section>
      );
    }

    if (sec.type === 'content') {
      return (
        <section key={sec.id} className="py-12 md:py-16" style={{ backgroundColor: sec.backgroundColor, color: sec.textColor }}>
          <div className="max-w-4xl mx-auto px-6">
            <article className="glass-card rounded-2xl p-6 md:p-10 space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: sec.textColor, fontFamily: cms.theme.headingFont }}>
                {sec.heading}
              </h2>
              {sec.subheading && <p className="text-lg font-medium">{sec.subheading}</p>}
              {sec.imageUrl && (
                <SafeImage src={sec.imageUrl} alt={sec.heading} className="w-full max-h-[28rem] object-cover rounded-xl" />
              )}
              <p className="text-sm leading-7 whitespace-pre-line">{sec.bodyText}</p>
              {sec.ctaLabel && sec.ctaTarget && (
                <a
                  href={buildPageHref(sec.ctaTarget)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#059669]"
                >
                  {sec.ctaLabel} <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </article>
          </div>
        </section>
      );
    }

    if (sec.type === 'divisions') {
      return (
        <section key={sec.id} style={{ backgroundColor: sec.backgroundColor, color: sec.textColor }} className="border-b border-white/70 py-16">
          <div className="max-w-7xl mx-auto px-6 space-y-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                  Three Distinct Workspaces
                </p>
                <h2
                  className="text-3xl font-bold tracking-tight text-balance text-slate-950"
                  style={{ fontFamily: cms.theme.headingFont }}
                >
                  {sec.heading}
                </h2>
                <p className="text-sm text-slate-600">{sec.subheading}</p>
              </div>
              <a
                href={buildPageHref('get_started')}
                className="text-sm font-semibold text-slate-900 hover:text-amber-800 hover:underline inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {sec.ctaLabel} <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {DIVISION_CARDS.map((card) => (
                <div
                  key={card.id}
                  className="glass-card text-slate-900 rounded-2xl overflow-hidden hover:shadow-lift hover:bg-white/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="h-1.5 w-full" style={{ backgroundColor: card.accentHex }} />
                    <SafeImage src={card.imageUrl} alt={card.title} className="w-full h-48 object-cover" />
                    <div className="p-6 space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-2 text-slate-500">
                        <span className="font-mono-tabular" style={{ color: card.accentHex }}>
                          {card.classesLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{card.vibe}</span>
                      </div>
                      <h3
                        className="text-xl font-bold text-slate-950"
                        style={{ fontFamily: card.id === 'upper_secondary' ? 'var(--font-serif)' : cms.theme.headingFont }}
                      >
                        {card.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{card.description}</p>
                    </div>
                  </div>
                  <div className="px-6 pb-6 pt-2">
                    <a
                      href={buildPageHref('get_started', { division: card.id })}
                      className="text-sm font-semibold hover:underline inline-flex items-center gap-1.5"
                      style={{ color: card.accentHex }}
                    >
                      Join {card.title} <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (sec.type === 'featured_courses') {
      const featured = state.courses.filter((c) => c.status === 'published').slice(0, 3);
      return (
        <section key={sec.id} style={{ backgroundColor: sec.backgroundColor, color: sec.textColor }} className="border-b border-white/70 py-16 bg-dots">
          <div className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Curriculum Highlights
                </p>
                <h2
                  className="text-3xl font-bold tracking-tight text-balance text-slate-950"
                  style={{ fontFamily: cms.theme.headingFont }}
                >
                  {sec.heading}
                </h2>
                <p className="text-sm text-slate-600">{sec.subheading}</p>
              </div>
              <a
                href={buildPageHref('resources')}
                className="text-sm font-semibold text-slate-900 hover:text-amber-800 hover:underline whitespace-nowrap inline-flex items-center gap-1.5"
              >
                {sec.ctaLabel} <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((c) => (
                <div
                  key={c.id}
                  className="glass-card text-slate-900 rounded-2xl p-6 space-y-3 hover:shadow-lift hover:bg-white/80 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-amber-800">{DIVISION_META[c.division].short}</span>
                      <span className="font-mono-tabular">{c.allowedClasses.join(', ')}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-950">{c.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{c.summary}</p>
                  </div>
                  <div className="pt-4 mt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-950 font-mono-tabular">{formatUGX(c.priceUGX)}</span>
                    <a
                      href={buildPageHref('get_started', { division: c.division })}
                      className="font-semibold text-slate-900 hover:text-amber-800 hover:underline inline-flex items-center gap-1"
                    >
                      Enrol via Division <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (sec.type === 'mission_pillars') {
      return (
        <section key={sec.id} style={{ backgroundColor: sec.backgroundColor, color: sec.textColor }} className="border-b border-white/70 py-16 bg-dots">
          <div className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                Why KWAN Separates Environments
              </p>
              <h2 className="text-3xl font-bold text-slate-950" style={{ fontFamily: cms.theme.headingFont }}>
                {sec.heading}
              </h2>
              <p className="text-sm text-slate-600">{sec.subheading}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card text-slate-900 rounded-2xl p-6 space-y-2">
                <p className="text-xs font-semibold font-mono-tabular text-amber-800">
                  01. Division-Native Interfaces
                </p>
                <h3 className="text-lg font-bold text-slate-950">Age-Authentic Pedagogy</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Visual play and guardian visibility for P.4–P.7, structured marking for S.1–S.4, and independent research rubrics for S.5–S.6.
                </p>
              </div>
              <div className="glass-card text-slate-900 rounded-2xl p-6 space-y-2">
                <p className="text-xs font-semibold font-mono-tabular text-emerald-800">
                  02. Vetted Tutors &amp; Class Rules
                </p>
                <h3 className="text-lg font-bold text-slate-950">Targeted Class Access</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every tutor is approved before teaching, and every course enforces explicit class permissions from P.4 to S.6.
                </p>
              </div>
              <div className="glass-card text-slate-900 rounded-2xl p-6 space-y-2">
                <p className="text-xs font-semibold font-mono-tabular text-slate-800">
                  03. Visual Progress &amp; Analytics
                </p>
                <h3 className="text-lg font-bold text-slate-950">Completion &amp; Score Tracking</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Interactive student progress dashboards visualise course completion rates, quiz scores, and tutor feedback across every division.
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Promo Banner / CTA Band (Frosted Glass Spotlight Card, Zero Blue)
    return (
      <section key={sec.id} style={{ backgroundColor: sec.backgroundColor, color: sec.textColor }} className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="glass-card rounded-3xl p-8 md:p-10 flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                Academic Revision &amp; Clinics
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-balance text-slate-950" style={{ fontFamily: cms.theme.headingFont }}>
                {sec.heading}
              </h2>
              <p className="text-sm text-slate-700 font-medium">{sec.subheading}</p>
              <p className="text-xs text-slate-600">{sec.bodyText}</p>
            </div>
            <a
              href={buildPageHref(sec.ctaTarget)}
              style={{ backgroundColor: bodyAccent, color: '#fff' }}
              className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-bold shadow-glow hover:opacity-95 whitespace-nowrap ${cms.theme.buttonStyle}`}
            >
              {sec.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-animated-canvas text-slate-900"
      style={
        {
          '--brand-primary': cms.theme.primaryAccent,
          '--brand-accent': cms.theme.secondaryAccent,
          '--brand-heading-font': cms.theme.headingFont,
          '--brand-body-font': cms.theme.bodyFont,
          fontFamily: cms.theme.bodyFont,
        } as React.CSSProperties
      }
    >
      {/* Light-Blue Glassmorphism Header (Blue appears strictly in Header & Footer) */}
      <header className="sticky top-0 z-30 glass-header-footer border-b border-[#1D5E96] text-white">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href={buildPageHref('home')}
            className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
            style={{ fontFamily: cms.theme.headingFont }}
          >
            <img src="/kwan-mark.svg" alt="" aria-hidden="true" className="w-9 h-9 rounded-xl shadow-sm" />
            <span>{cms.brandName}</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#E2E8F0]">
            {publicNavItems.map((item) => (
              <a
                key={item.id}
                href={buildPageHref(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors ${
                  item.id === 'get_started'
                    ? 'px-4 py-2 rounded-lg bg-[#10B981] text-white font-semibold hover:bg-[#059669]'
                    : `hover:text-white ${activePage === item.id ? 'text-white font-bold underline underline-offset-8 decoration-2 decoration-[#34D399]' : ''}`
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={currentUser ? '/?view=workspace' : buildPageHref('login')}
              className={`hidden md:inline-flex px-5 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/30 shadow-soft whitespace-nowrap shrink-0 transition-colors ${cms.theme.buttonStyle}`}
            >
              {currentUser ? 'My Workspace' : 'Login'}
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 text-white bg-white/10 border border-white/30 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#1D5E96] bg-[#0F4C81] px-6 py-4 space-y-2">
            {(
              [
                ...publicNavItems.map((navItem) => ({
                  id: navItem.id,
                  label: navItem.label,
                  href: buildPageHref(navItem.id),
                })),
                {
                  id: 'login',
                  label: currentUser ? 'My Workspace' : 'Login',
                  href: currentUser ? '/?view=workspace' : buildPageHref('login'),
                },
              ] as const
            ).map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block w-full text-left py-2 text-sm font-semibold ${
                  item.id === 'get_started'
                    ? 'text-[#34D399]'
                    : 'text-[#E2E8F0] hover:text-white'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Frosted Glass Moving Academic Highlights Marquee Strip (Zero Blue) */}
      {(() => {
        const marqueeItems: { label: string; href: string }[] = [
          {
            label: 'Primary Education (P.4 – P.7) · Illustrated Lessons & Interactive Labs',
            href: buildPageHref('get_started', { division: 'primary' }),
          },
          {
            label: 'Lower Secondary (S.1 – S.4) · Structured O-Level Curriculum & Marking',
            href: buildPageHref('get_started', { division: 'lower_secondary' }),
          },
          {
            label: 'Upper Secondary (S.5 – S.6) · Sciences & Arts Combinations + Seminar Rubrics',
            href: buildPageHref('get_started', { division: 'upper_secondary' }),
          },
          ...state.blogPosts
            .filter((p) => p.status === 'published')
            .slice(0, 3)
            .map((p) => ({ label: `Blog: ${p.title}`, href: buildPageHref('blog') })),
          {
            label: 'Resources Library · Approved Study Notes, Lab Guides & Past Paper Packs',
            href: buildPageHref('resources'),
          },
        ];

        return (
          <div className="glass-panel text-slate-800 border-b border-white/80 overflow-hidden kwan-marquee-container py-2.5 text-xs">
            <div className="animate-kwan-marquee items-center">
              {[0, 1].map((copyIdx) => (
                <div key={copyIdx} className="flex items-center shrink-0" aria-hidden={copyIdx === 1}>
                  {marqueeItems.map((item, idx) => (
                    <a
                      key={`${copyIdx}-${idx}`}
                      href={item.href}
                      className="inline-flex items-center gap-3 px-6 font-medium text-slate-700 hover:text-slate-950 transition-colors whitespace-nowrap"
                    >
                      <span className="font-bold text-amber-700">KWAN</span>
                      <span>{item.label}</span>
                      <span aria-hidden="true" className="text-slate-400 pl-3">
                        ·
                      </span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <main className="flex-1">
        {/* HOME & ABOUT */}
        {activePage === 'home' && (cms.pages.home || []).map(renderCmsSection)}
        {activePage === 'about' && (cms.pages.about || []).map(renderCmsSection)}
        {!BUILT_IN_PUBLIC_PAGE_IDS.has(activePage) && (
          cms.pages[activePage]
            ? cms.pages[activePage].map(renderCmsSection)
            : (
                <section className="max-w-3xl mx-auto px-6 py-24 text-center space-y-4">
                  <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
                  <a href={buildPageHref('home')} className="font-semibold text-[#0F4C81] hover:underline">
                    Return to home
                  </a>
                </section>
              )
        )}

        {/* BLOG */}
        {activePage === 'blog' && (
          <>
            {(cms.pages.blog || []).map(renderCmsSection)}
            <section className="max-w-7xl mx-auto px-6 py-12 space-y-8">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    'All',
                    'Education News',
                    'Study Tips',
                    'Examination Preparation',
                    'Science and Technology',
                    'Career Guidance',
                    'KWAN Announcements',
                    'Learning Resources',
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBlogCategoryFilter(cat)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                      blogCategoryFilter === cat
                        ? 'bg-slate-900 text-white shadow-soft'
                        : 'glass-card text-slate-700 hover:bg-white/90'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {state.blogPosts
                  .filter(
                    (p) =>
                      p.status === 'published' &&
                      (blogCategoryFilter === 'All' || p.category === (blogCategoryFilter as BlogCategory))
                  )
                  .map((post) => (
                    <article
                      key={post.id}
                      className="glass-card rounded-2xl overflow-hidden hover:shadow-lift hover:bg-white/80 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <SafeImage src={post.imageUrl} alt={post.title} className="w-full h-44 object-cover" />
                        <div className="p-5 space-y-2">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-semibold text-amber-800">{post.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{post.publishedAt}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-950 leading-snug">{post.title}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed">{post.excerpt}</p>
                        </div>
                      </div>
                      <div className="px-5 pb-5 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{post.tags.join(' · ')}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPost(post)}
                          className="font-semibold text-slate-900 hover:text-amber-800 hover:underline whitespace-nowrap"
                        >
                          Read Article
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}

        {/* RESOURCES */}
        {activePage === 'resources' && (
          <>
            {(cms.pages.resources || []).map(renderCmsSection)}
            <section className="max-w-7xl mx-auto px-6 py-12 space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'all', label: 'All Divisions' },
                      { id: 'primary', label: 'Primary (P.4–P.7)' },
                      { id: 'lower_secondary', label: 'Lower Secondary (S.1–S.4)' },
                      { id: 'upper_secondary', label: 'Upper Secondary (S.5–S.6)' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setResDivisionFilter(tab.id)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                        resDivisionFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-soft'
                          : 'glass-card text-slate-700 hover:bg-white/90'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600">
                  {currentUser ? `Signed in as ${currentUser.name}` : 'Login to purchase paid study packs'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.resources
                  .filter((r) => r.approved && (resDivisionFilter === 'all' || r.division === resDivisionFilter))
                  .map((res) => {
                    const owned =
                      res.accessType === 'free' || Boolean(currentUser?.purchasedResourceIds.includes(res.id));
                    return (
                      <div
                        key={res.id}
                        className="glass-card rounded-2xl p-6 hover:shadow-lift hover:bg-white/80 transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-amber-800">
                              {DIVISION_META[res.division].short}
                            </span>
                            <span className="font-mono-tabular">{res.targetClasses.join(', ')}</span>
                          </div>
                          <h3 className="text-base font-bold text-slate-950">{res.title}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed">{res.description}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-950 font-mono-tabular">
                            {formatUGX(res.priceUGX)}
                          </span>
                          {owned ? (
                            <button
                              type="button"
                              onClick={() => setPreviewResource(res)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2bb673] rounded-lg hover:opacity-95 flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" /> Open Resource
                            </button>
                          ) : currentUser ? (
                            <button
                              type="button"
                              onClick={() => setCheckoutResource(res)}
                              style={{ backgroundColor: cms.theme.secondaryAccent || '#10B981', color: '#fff' }}
                              className="px-3.5 py-2 text-xs font-bold rounded-lg hover:opacity-95 whitespace-nowrap"
                            >
                              Purchase via KWAN
                            </button>
                          ) : (
                            <a
                              href={buildPageHref('login')}
                              style={{ backgroundColor: cms.theme.secondaryAccent || '#10B981', color: '#fff' }}
                              className="px-3.5 py-2 text-xs font-bold rounded-lg hover:opacity-95 whitespace-nowrap inline-block"
                            >
                              Purchase via KWAN
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </>
        )}

        {/* GET STARTED — INTERACTIVE DYNAMIC REGISTRATION STUDIO */}
        {activePage === 'get_started' && (
          <>
            <section className="max-w-3xl mx-auto px-6 py-12">
              {(() => {
                const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
                const passHasLength = regPassword.length >= 8;
                const passHasMix = /[A-Za-z]/.test(regPassword) && /[0-9]/.test(regPassword);
                const passStrength = !regPassword
                  ? 0
                  : passHasLength && passHasMix && regPassword.length >= 8
                  ? 3
                  : passHasLength
                  ? 2
                  : 1;
                const passwordsMatch =
                  regPassword.length >= 8 && regConfirmPassword.length > 0 && regPassword === regConfirmPassword;

                return (
                  <div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setRegError('');
                        if (!regName.trim()) {
                          setRegError('Please enter your full name.');
                          return;
                        }
                        if (!emailValid) {
                          setRegError('Please enter a valid email address.');
                          return;
                        }
                        if (regPassword.length < 8) {
                          setRegError('Password must be at least 8 characters.');
                          return;
                        }
                        if (regPassword !== regConfirmPassword) {
                          setRegError('Password and Confirm Password do not match.');
                          return;
                        }
                        setRegLoading(true);
                        try {
                          const res = await api.register({
                            name: regName.trim(),
                            email: regEmail.trim(),
                            password: regPassword,
                            confirmPassword: regConfirmPassword,
                            role: 'student',
                            division: regDivision,
                            classLevel: regClass,
                            stream: regDivision === 'upper_secondary' ? regStream : undefined,
                            subjectCombination: regDivision === 'upper_secondary' ? regCombo : undefined,
                            guardianName: regDivision === 'primary' ? regGuardianName : undefined,
                            guardianContact: regDivision === 'primary' ? regGuardianContact : undefined,
                          } as Partial<UserAccount> & { confirmPassword?: string });
                          onLoginSuccess(res.user, res.state, res.sessionToken);
                        } catch (err) {
                          setRegError(err instanceof Error ? err.message : 'Registration failed');
                        } finally {
                          setRegLoading(false);
                        }
                      }}
                      className="glass-card rounded-2xl p-6 md:p-8 space-y-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                        <div>
                          <p className="text-xs font-semibold text-[#0F4C81]">Student Account Onboarding</p>
                          <h2 className="text-2xl font-bold text-slate-950 mt-0.5">Create Your KWAN Account</h2>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600">
                        Tutor accounts are created by the KWAN administrator.
                      </p>
                      <div className="space-y-5 glass-panel rounded-xl p-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="reg-division" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Academic Division
                              </label>
                              <select
                                id="reg-division"
                                value={regDivision}
                                onChange={(e) => {
                                  const nextDiv = e.target.value as DivisionId;
                                  setRegDivision(nextDiv);
                                  setRegClass(DIVISION_META[nextDiv].classes[0]);
                                }}
                                className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300/80 rounded-lg bg-white/85 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="primary">Primary (P.4 – P.7)</option>
                                <option value="lower_secondary">Lower Secondary (S.1 – S.4)</option>
                                <option value="upper_secondary">Upper Secondary (S.5 – S.6)</option>
                              </select>
                            </div>

                            <div>
                              <label htmlFor="reg-class" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Class
                              </label>
                              <select
                                id="reg-class"
                                value={regClass}
                                onChange={(e) => setRegClass(e.target.value as ClassLevel)}
                                className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300/80 rounded-lg bg-white/85 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                {DIVISION_META[regDivision].classes.map((cls) => (
                                  <option key={cls} value={cls}>
                                    {cls}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Upper Secondary Only: Stream (Sciences / Arts) -> Combinations */}
                          {regDivision === 'upper_secondary' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70">
                              <div>
                                <label htmlFor="reg-stream" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                  Stream
                                </label>
                                <select
                                  id="reg-stream"
                                  value={regStream}
                                  onChange={(e) => {
                                    const nextStream = e.target.value as UpperSecondaryStream;
                                    setRegStream(nextStream);
                                    setRegCombo(UPPER_SECONDARY_COMBINATIONS[nextStream][0].label);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300/80 rounded-lg bg-white/85 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                  <option value="Sciences">Sciences</option>
                                  <option value="Arts">Arts</option>
                                </select>
                              </div>

                              <div>
                                <label htmlFor="reg-combination" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                  Combination
                                </label>
                                <select
                                  id="reg-combination"
                                  value={regCombo}
                                  onChange={(e) => setRegCombo(e.target.value)}
                                  className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300/80 rounded-lg bg-white/85 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                  {UPPER_SECONDARY_COMBINATIONS[regStream].map((combo) => (
                                    <option key={combo.code} value={combo.label}>
                                      {combo.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                          {regDivision === 'lower_secondary' && (
                            <p className="text-xs text-slate-600 pt-1">
                              Lower Secondary ({regClass}) follows the broad Ugandan O-Level subject curriculum—no stream or combination selection required.
                            </p>
                          )}

                          {regDivision === 'primary' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                  Parent / Guardian Name (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={regGuardianName}
                                  onChange={(e) => setRegGuardianName(e.target.value)}
                                  placeholder="e.g. Sarah Namukasa"
                                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                  Guardian Phone Contact (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={regGuardianContact}
                                  onChange={(e) => setRegGuardianContact(e.target.value)}
                                  placeholder="+256 772 000 000"
                                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                      {/* Account Identity & Password Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Name
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="reg-name"
                              type="text"
                              required
                              value={regName}
                              onChange={(e) => setRegName(e.target.value)}
                              placeholder="Enter full name"
                              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300/80 bg-white/85 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="reg-email"
                              type="email"
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="name@kwan.ac.ug"
                              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300/80 bg-white/85 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          {regEmail.length > 0 && !emailValid && (
                            <p className="text-[11px] text-amber-700 mt-1">Enter a valid email format.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="reg-password"
                              type={showRegPass ? 'text' : 'password'}
                              required
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="Create password"
                              className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300/80 bg-white/85 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegPass((s) => !s)}
                              aria-label={showRegPass ? 'Hide password' : 'Show password'}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900"
                            >
                              {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {regPassword.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="grid grid-cols-3 gap-1 h-1.5">
                                <div className={`rounded ${passStrength >= 1 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                                <div className={`rounded ${passStrength >= 2 ? 'bg-teal-600' : 'bg-slate-200'}`} />
                                <div className={`rounded ${passStrength >= 3 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Strength: {passStrength === 3 ? 'Strong' : passStrength === 2 ? 'Good' : 'Minimum 8+ characters'}
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                          <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="reg-confirm-password"
                              type={showRegConfirmPass ? 'text' : 'password'}
                              required
                              value={regConfirmPassword}
                              onChange={(e) => setRegConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300/80 bg-white/85 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegConfirmPass((s) => !s)}
                              aria-label={showRegConfirmPass ? 'Hide confirm password' : 'Show confirm password'}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900"
                            >
                              {showRegConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {regConfirmPassword.length > 0 && (
                            <p
                              className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                                passwordsMatch ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {passwordsMatch ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Passwords match
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {regError && (
                        <div className="text-xs text-red-800 bg-red-50/90 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{regError}</span>
                        </div>
                      )}

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                        <button
                          type="submit"
                          disabled={regLoading}
                          style={{ backgroundColor: cms.theme.secondaryAccent || '#10B981', color: '#fff' }}
                          className={`px-6 py-3 text-sm font-bold hover:opacity-95 disabled:opacity-50 inline-flex items-center gap-2 shadow-glow ${cms.theme.buttonStyle}`}
                        >
                          {regLoading
                            ? 'Creating Account...'
                            : `Create Account & Enter ${regClass}`}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <a
                          href={buildPageHref('login')}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-950 hover:underline"
                        >
                          Already registered? Sign in here
                        </a>
                      </div>
                    </form>
                  </div>
                );
              })()}
            </section>
          </>
        )}

        {/* LOGIN — GLASS-EFFECT AUTHENTICATION */}
        {activePage === 'login' && (
          <section className="relative isolate flex min-h-[68vh] items-center justify-center overflow-hidden px-5 py-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#0F4C81]/10 blur-3xl" />
              <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#10B981]/10 blur-3xl" />
              <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
            </div>
            <div className="relative w-full max-w-md">
              {setupStatus?.required ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSetupError('');
                    if (setupPassword.length < 12) {
                      setSetupError('Choose a password with at least 12 characters.');
                      return;
                    }
                    if (setupPassword !== setupPasswordConfirm) {
                      setSetupError('The passwords do not match.');
                      return;
                    }
                    setSetupLoading(true);
                    try {
                      const result = await api.setupAdmin(setupKey, setupPassword);
                      onLoginSuccess(result.user, undefined, result.sessionToken);
                    } catch (err) {
                      setSetupError(err instanceof Error ? err.message : 'Administrator setup failed.');
                    } finally {
                      setSetupLoading(false);
                    }
                  }}
                  className="space-y-5 rounded-3xl border border-white/70 bg-white/65 p-7 shadow-[0_24px_70px_-24px_rgba(10,37,64,0.42)] backdrop-blur-2xl md:p-9"
                >
                  <div className="space-y-2 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F4C81] text-white shadow-lg shadow-[#0F4C81]/20">
                      <Lock className="h-5 w-5" />
                    </div>
                    <p className="pt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0F4C81]">Secure first-time setup</p>
                    <h1 className="text-2xl font-bold text-[#0A2540]">Create the Administrator Password</h1>
                    <p className="text-sm text-slate-600">Ayen Geoffrey Alexander · admin@kwan.ac.ug</p>
                  </div>

                  {!setupStatus.setupKeyConfigured && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Set <code className="font-semibold">ADMIN_SETUP_KEY</code> in the server environment before continuing.
                    </div>
                  )}

                  <div>
                    <label htmlFor="admin-setup-key" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      One-time setup key
                    </label>
                    <input
                      id="admin-setup-key"
                      type="password"
                      required
                      autoComplete="off"
                      value={setupKey}
                      onChange={(e) => setSetupKey(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-inner shadow-slate-900/5 backdrop-blur focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="admin-setup-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      New password (12+ characters)
                    </label>
                    <input
                      id="admin-setup-password"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-inner shadow-slate-900/5 backdrop-blur focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="admin-setup-confirm" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Confirm new password
                    </label>
                    <input
                      id="admin-setup-confirm"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={setupPasswordConfirm}
                      onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm shadow-inner shadow-slate-900/5 backdrop-blur focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                    />
                  </div>

                  {(setupError || setupStatus === null) && (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800">
                      {setupError || 'Checking administrator setup…'}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={setupLoading || !setupStatus.setupKeyConfigured}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {setupLoading ? 'Creating secure account…' : 'Create Admin Password'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoginError('');
                    setLoginLoading(true);
                    try {
                      const res = await api.login(loginEmail, loginPassword);
                      onLoginSuccess(res.user, undefined, res.sessionToken);
                    } catch (err) {
                      setLoginError(err instanceof Error ? err.message : 'Login failed');
                    } finally {
                      setLoginLoading(false);
                    }
                  }}
                  className="space-y-5 rounded-3xl border border-white/70 bg-white/65 p-7 shadow-[0_24px_70px_-24px_rgba(10,37,64,0.42)] backdrop-blur-2xl md:p-9"
                >
                  <div className="space-y-2 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F4C81] text-white shadow-lg shadow-[#0F4C81]/20">
                      <Lock className="h-5 w-5" />
                    </div>
                    <p className="pt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0F4C81]">Secure KWAN access</p>
                    <h1 className="text-2xl font-bold text-[#0A2540]">Welcome back</h1>
                    <p className="text-sm text-slate-600">Sign in to continue to your learning space.</p>
                  </div>

                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F4C81]/70" />
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="username"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-white/80 bg-white/70 py-3 pl-10 pr-4 text-sm shadow-inner shadow-slate-900/5 backdrop-blur focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F4C81]/70" />
                      <input
                        id="login-password"
                        type={showLoginPass ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-white/80 bg-white/70 py-3 pl-10 pr-12 text-sm shadow-inner shadow-slate-900/5 backdrop-blur focus:border-[#0F4C81] focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass((s) => !s)}
                        aria-label={showLoginPass ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#0F4C81]"
                      >
                        {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#059669] disabled:opacity-50"
                  >
                    {loginLoading ? 'Signing in…' : 'Sign in'}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="border-t border-white/70 pt-4 text-center text-xs">
                    <span className="text-slate-500">New student? </span>
                    <a href={buildPageHref('get_started')} className="font-semibold text-[#0F4C81] hover:underline">
                      Create an account
                    </a>
                    <p className="mt-2 text-slate-500">Tutor accounts are created by the administrator.</p>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}

      </main>

      {/* Light-Blue Glassmorphism Institutional Footer (Blue appears strictly in Header & Footer) */}
      <footer className="bg-[#0A2540] text-[#CBD5E1] border-t border-[#163A5F] py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-6 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <img src="/kwan-mark.svg" alt="" aria-hidden="true" className="w-8 h-8 rounded-lg" />
              <p className="text-lg font-bold text-white">{cms.brandName}</p>
            </div>
            <p className="text-xs text-[#CBD5E1] max-w-md leading-relaxed">{cms.footer.tagline}</p>
          </div>
          <div className="md:col-span-3 space-y-2 text-xs">
            <p className="font-bold text-white">Navigation</p>
            <div className="flex flex-col items-start gap-1.5 text-[#CBD5E1]">
              <a href={buildPageHref('home')} className="hover:text-[#10B981] hover:underline transition-colors">
                Home
              </a>
              <a href={buildPageHref('about')} className="hover:text-[#10B981] hover:underline transition-colors">
                About Us
              </a>
              <a href={buildPageHref('blog')} className="hover:text-[#10B981] hover:underline transition-colors">
                Blog
              </a>
              <a href={buildPageHref('resources')} className="hover:text-[#10B981] hover:underline transition-colors">
                Resources
              </a>
              <a
                href={buildPageHref('get_started')}
                className="hover:text-[#10B981] hover:underline transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
          <div className="md:col-span-3 space-y-2 text-xs">
            <p className="font-bold text-white">Contact</p>
            <p className="font-semibold text-[#CBD5E1]">{cms.footer.contactEmail}</p>
            <p className="text-[#CBD5E1]">{cms.footer.location}</p>
            <p className="text-slate-400 pt-2">{cms.footer.copyright}</p>
          </div>
        </div>
      </footer>

      {/* Blog Article Reader Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white/88 backdrop-blur-2xl border border-white rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-5 my-8 shadow-lift">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  {selectedPost.category} · {selectedPost.publishedAt} · {selectedPost.authorName}
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">{selectedPost.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SafeImage src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full h-56 object-cover rounded-xl" />
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{selectedPost.content}</p>

            {selectedPost.commentsEnabled && (
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Discussion ({selectedPost.comments.length})
                </h3>
                {selectedPost.comments.map((c) => (
                  <div key={c.id} className="glass-panel rounded-lg p-3 text-xs">
                    <p className="font-semibold text-slate-900">
                      {c.authorName} · {c.createdAt}
                    </p>
                    <p className="text-slate-700 mt-1">{c.text}</p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Your name"
                    className="w-40 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/85"
                  />
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 min-w-[180px] px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/85"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!commentText.trim()) return;
                      const res = await api.addBlogComment(
                        selectedPost.id,
                        commentAuthor.trim() || 'Visitor',
                        commentText.trim()
                      );
                      onStateChange(res.state);
                      setSelectedPost(res.state.blogPosts.find((p) => p.id === selectedPost.id) || null);
                      setCommentText('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resource Preview Modal */}
      {previewResource && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/88 backdrop-blur-2xl border border-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-lift">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  {DIVISION_META[previewResource.division].short} · {previewResource.format}
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{previewResource.title}</h3>
              </div>
              <button type="button" onClick={() => setPreviewResource(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">{previewResource.description}</p>
            <div className="glass-panel rounded-lg p-4 text-xs text-slate-800 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-700" /> Study Material Content
              </p>
              <p className="leading-relaxed">{previewResource.previewContent}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewResource(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Done Reading
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentCheckoutModal
        open={Boolean(checkoutResource)}
        title={checkoutResource?.title || ''}
        subtitle={`${checkoutResource?.format || ''} · ${
          checkoutResource ? DIVISION_META[checkoutResource.division].short : ''
        }`}
        amountUGX={checkoutResource?.priceUGX || 0}
        onClose={() => setCheckoutResource(null)}
        onConfirm={async (method) => {
          if (!checkoutResource || !currentUser) return;
          const res = await api.purchaseItem({
            userId: currentUser.id,
            itemType: 'resource',
            itemId: checkoutResource.id,
            method,
          });
          onStateChange(res.state);
          onLoginSuccess(res.user, res.state);
        }}
      />
    </div>
  );
}
