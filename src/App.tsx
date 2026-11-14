import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import type { DivisionId, PlatformState, PublicPageId, UserAccount } from './types/kwan';
import { api } from './lib/api';

const PublicWebsite = lazy(() => import('./components/public/PublicWebsite').then((module) => ({ default: module.PublicWebsite })));
const PrimaryEnvironment = lazy(() =>
  import('./components/environments/PrimaryEnvironment').then((module) => ({ default: module.PrimaryEnvironment }))
);
const LowerSecondaryEnvironment = lazy(() =>
  import('./components/environments/LowerSecondaryEnvironment').then((module) => ({
    default: module.LowerSecondaryEnvironment,
  }))
);
const UpperSecondaryEnvironment = lazy(() =>
  import('./components/environments/UpperSecondaryEnvironment').then((module) => ({
    default: module.UpperSecondaryEnvironment,
  }))
);
const TutorWorkspace = lazy(() =>
  import('./components/tutor/TutorWorkspace').then((module) => ({ default: module.TutorWorkspace }))
);
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
);

const SESSION_KEY = 'kwan_session_token';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-medium">
      Loading KWAN Education Platform...
    </div>
  );
}

function getInitialRouteFromUrl(): { page: PublicPageId; forcePublic: boolean } {
  const params = new URLSearchParams(window.location.search);
  const rawPage = params.get('page');
  const view = params.get('view');
  const page = rawPage && /^[a-z0-9-]+$/i.test(rawPage) ? rawPage : 'home';
  const forcePublic = view === 'public' || Boolean(rawPage && page !== 'home');
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
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('kwan_session_user_id');
    setCurrentUser(null);
    setShowPublicWhileSignedIn(false);
    setAdminPreviewDivision(null);
    setPublicPage('home');
  };

  useEffect(() => {
    api
      .fetchState()
      .then(async (data) => {
        setState(data);
        if (sessionStorage.getItem(SESSION_KEY)) {
          try {
            const { user } = await api.currentUser();
            setCurrentUser(user);
          } catch {
            sessionStorage.removeItem(SESSION_KEY);
          }
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
      <>
        <LoadingScreen />
        <Analytics />
      </>
    );
  }

  if (error || !state) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md text-center space-y-2">
            <h1 className="text-lg font-bold text-slate-900">Unable to Load Platform</h1>
            <p className="text-xs text-red-700">{error || 'Missing platform state'}</p>
          </div>
        </div>
        <Analytics />
      </>
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
      <>
        <Analytics />
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
        <Suspense fallback={<LoadingScreen />}>
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
        </Suspense>
        </div>
      </>
    );
  }

  // Authenticated Role Routing: Admin / Tutor / 3 Distinct Student Divisions
  if (currentUser && !showPublicWhileSignedIn) {
    if (currentUser.role === 'admin') {
      return (
        <>
          <Analytics />
          <div>
          <Suspense fallback={<LoadingScreen />}>
            <AdminDashboard
              state={state}
              user={currentUser}
              onStateChange={(next) => handleStateUpdate(next)}
              onPreviewDivision={(div) => setAdminPreviewDivision(div)}
              onLogout={signOut}
            />
          </Suspense>
          <div className="fixed bottom-4 right-4 z-30">
            <a
              href="/?page=home&view=public"
              className="inline-block px-3.5 py-2 text-xs font-semibold bg-white text-slate-900 border border-slate-300 rounded-lg shadow-md hover:bg-slate-50"
            >
              View Live Website
            </a>
          </div>
          </div>
        </>
      );
    }

    if (currentUser.role === 'tutor') {
      return (
        <>
          <Analytics />
          <Suspense fallback={<LoadingScreen />}>
          <TutorWorkspace
            state={state}
            user={currentUser}
            onStateChange={(next) => handleStateUpdate(next)}
            onLogout={signOut}
          />
          </Suspense>
        </>
      );
    }

    const backToResourcesBar = (
      <div className="fixed bottom-4 right-4 z-30">
        <a
          href="/?page=resources&view=public"
          className="inline-block px-3.5 py-2 text-xs font-semibold bg-white text-slate-900 border border-slate-300 rounded-lg shadow-md hover:bg-slate-50"
        >
          Browse KWAN Resources &amp; Blog
        </a>
      </div>
    );

    if (currentUser.division === 'primary') {
      return (
        <>
          <Analytics />
          <Suspense fallback={<LoadingScreen />}>
            <PrimaryEnvironment
              state={state}
              user={currentUser}
              onStateChange={handleStateUpdate}
              onLogout={signOut}
            />
          </Suspense>
          {backToResourcesBar}
        </>
      );
    }

    if (currentUser.division === 'lower_secondary') {
      return (
        <>
          <Analytics />
          <Suspense fallback={<LoadingScreen />}>
            <LowerSecondaryEnvironment
              state={state}
              user={currentUser}
              onStateChange={handleStateUpdate}
              onLogout={signOut}
            />
          </Suspense>
          {backToResourcesBar}
        </>
      );
    }

    return (
      <>
        <Analytics />
        <Suspense fallback={<LoadingScreen />}>
          <UpperSecondaryEnvironment
            state={state}
            user={currentUser}
            onStateChange={handleStateUpdate}
            onLogout={signOut}
          />
        </Suspense>
        {backToResourcesBar}
      </>
    );
  }

  return (
    <>
      <Analytics />
      <Suspense fallback={<LoadingScreen />}>
      <PublicWebsite
        state={state}
        activePage={publicPage}
        currentUser={currentUser}
        onNavigate={(page) => {
          setPublicPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLoginSuccess={(user, nextState, sessionToken) => {
          if (nextState) setState(nextState);
          if (sessionToken) sessionStorage.setItem(SESSION_KEY, sessionToken);
          setCurrentUser(user);
          setShowPublicWhileSignedIn(false);
        }}
        onReturnToWorkspace={() => setShowPublicWhileSignedIn(false)}
        onStateChange={(next) => setState(next)}
      />
      </Suspense>
    </>
  );
}
