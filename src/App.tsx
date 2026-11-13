import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { DivisionId, PlatformState, PublicPageId, UserAccount } from './types/kwan';
import { api } from './lib/api';
import { PublicWebsite } from './components/public/PublicWebsite';
import { PrimaryEnvironment } from './components/environments/PrimaryEnvironment';
import { LowerSecondaryEnvironment } from './components/environments/LowerSecondaryEnvironment';
import { UpperSecondaryEnvironment } from './components/environments/UpperSecondaryEnvironment';
import { TutorWorkspace } from './components/tutor/TutorWorkspace';
import { AdminDashboard } from './components/admin/AdminDashboard';

const SESSION_KEY = 'kwan_session_user_id';

const VALID_PUBLIC_PAGES: PublicPageId[] = [
  'home',
  'about',
  'blog',
  'resources',
  'get_started',
  'login',
];

function getInitialRouteFromUrl(): { page: PublicPageId; forcePublic: boolean } {
  const params = new URLSearchParams(window.location.search);
  const rawPage = params.get('page') as PublicPageId | null;
  const view = params.get('view');
  const page = rawPage && VALID_PUBLIC_PAGES.includes(rawPage) ? rawPage : 'home';
  const forcePublic = view === 'public' || Boolean(rawPage && VALID_PUBLIC_PAGES.includes(rawPage));
  return { page, forcePublic };
}

export default function App() {
  const initialRoute = getInitialRouteFromUrl();
  const [state, setState] = useState<PlatformState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publicPage, setPublicPage] = useState<PublicPageId>(initialRoute.page);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [showPublicWhileSignedIn, setShowPublicWhileSignedIn] = useState(initialRoute.forcePublic);
  const [adminPreviewDivision, setAdminPreviewDivision] = useState<DivisionId | null>(null);

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setShowPublicWhileSignedIn(false);
    setAdminPreviewDivision(null);
    setPublicPage('home');
  };

  useEffect(() => {
    api
      .fetchState()
      .then((data) => {
        setState(data);
        const savedId = localStorage.getItem(SESSION_KEY);
        if (savedId) {
          const found = data.users.find((u) => u.id === savedId);
          if (found) setCurrentUser(found);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to connect to KWAN server');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-medium">
        Loading KWAN Education Platform...
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md text-center space-y-2">
          <h1 className="text-lg font-bold text-slate-900">Unable to Load Platform</h1>
          <p className="text-xs text-red-700">{error || 'Missing platform state'}</p>
        </div>
      </div>
    );
  }

  const handleStateUpdate = (next: PlatformState, updatedUser?: UserAccount) => {
    setState(next);
    if (updatedUser) {
      setCurrentUser(updatedUser);
    } else if (currentUser) {
      const fresh = next.users.find((u) => u.id === currentUser.id);
      if (fresh) setCurrentUser(fresh);
    }
  };

  // Admin previewing one of the 3 distinct division environments
  if (currentUser?.role === 'admin' && adminPreviewDivision) {
    const sampleLearner =
      state.users.find((u) => u.role === 'student' && u.division === adminPreviewDivision) || currentUser;
    return (
      <div>
        <div className="bg-slate-950 text-white px-6 py-2.5 flex items-center justify-between gap-4 text-xs">
          <span>
            Administrator Preview Mode — Inspecting <strong>{adminPreviewDivision.replace('_', ' ')}</strong>{' '}
            learning environment
          </span>
          <button
            type="button"
            onClick={() => setAdminPreviewDivision(null)}
            className="px-3 py-1 bg-white text-slate-950 font-semibold rounded flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Admin Console
          </button>
        </div>
        {adminPreviewDivision === 'primary' && (
          <PrimaryEnvironment
            state={state}
            user={sampleLearner}
            onStateChange={handleStateUpdate}
            onLogout={() => setAdminPreviewDivision(null)}
            isAdminPreview
          />
        )}
        {adminPreviewDivision === 'lower_secondary' && (
          <LowerSecondaryEnvironment
            state={state}
            user={sampleLearner}
            onStateChange={handleStateUpdate}
            onLogout={() => setAdminPreviewDivision(null)}
            isAdminPreview
          />
        )}
        {adminPreviewDivision === 'upper_secondary' && (
          <UpperSecondaryEnvironment
            state={state}
            user={sampleLearner}
            onStateChange={handleStateUpdate}
            onLogout={() => setAdminPreviewDivision(null)}
            isAdminPreview
          />
        )}
      </div>
    );
  }

  // Authenticated Role Routing: Admin / Tutor / 3 Distinct Student Divisions
  if (currentUser && !showPublicWhileSignedIn) {
    if (currentUser.role === 'admin') {
      return (
        <div>
          <AdminDashboard
            state={state}
            user={currentUser}
            onStateChange={(next) => handleStateUpdate(next)}
            onPreviewDivision={(div) => setAdminPreviewDivision(div)}
            onLogout={signOut}
          />
          <div className="fixed bottom-4 right-4 z-30">
            <a
              href="/?page=home&view=public"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-3.5 py-2 text-xs font-semibold bg-white text-slate-900 border border-slate-300 rounded-lg shadow-md hover:bg-slate-50"
            >
              View Live Website
            </a>
          </div>
        </div>
      );
    }

    if (currentUser.role === 'tutor') {
      return (
        <TutorWorkspace
          state={state}
          user={currentUser}
          onStateChange={(next) => handleStateUpdate(next)}
          onLogout={signOut}
        />
      );
    }

    const backToResourcesBar = (
      <div className="fixed bottom-4 right-4 z-30">
        <a
          href="/?page=resources&view=public"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-3.5 py-2 text-xs font-semibold bg-white text-slate-900 border border-slate-300 rounded-lg shadow-md hover:bg-slate-50"
        >
          Browse KWAN Resources &amp; Blog
        </a>
      </div>
    );

    if (currentUser.division === 'primary') {
      return (
        <>
          <PrimaryEnvironment
            state={state}
            user={currentUser}
            onStateChange={handleStateUpdate}
            onLogout={signOut}
          />
          {backToResourcesBar}
        </>
      );
    }

    if (currentUser.division === 'lower_secondary') {
      return (
        <>
          <LowerSecondaryEnvironment
            state={state}
            user={currentUser}
            onStateChange={handleStateUpdate}
            onLogout={signOut}
          />
          {backToResourcesBar}
        </>
      );
    }

    return (
      <>
        <UpperSecondaryEnvironment
          state={state}
          user={currentUser}
          onStateChange={handleStateUpdate}
          onLogout={signOut}
        />
        {backToResourcesBar}
      </>
    );
  }

  return (
    <PublicWebsite
      state={state}
      activePage={publicPage}
      currentUser={currentUser}
      onNavigate={(page) => {
        setPublicPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      onLoginSuccess={(user, nextState) => {
        if (nextState) setState(nextState);
        localStorage.setItem(SESSION_KEY, user.id);
        setCurrentUser(user);
        setShowPublicWhileSignedIn(false);
      }}
      onReturnToWorkspace={() => setShowPublicWhileSignedIn(false)}
      onStateChange={(next) => setState(next)}
    />
  );
}
