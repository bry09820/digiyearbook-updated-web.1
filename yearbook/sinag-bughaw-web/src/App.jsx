import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/hooks/useAuth';
import { Component, useEffect, useState } from 'react';
import ConsentModal from '@/features/auth/components/ConsentModal';
import { AppConfigProvider, useAppConfig } from '@/features/platform/AppConfigProvider';
import FeatureRoute from '@/features/platform/FeatureRoute';
import MaintenancePage from '@/pages/MaintenancePage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import ScreenProtection from '@/components/privacy/ScreenProtection';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

// Auth
import LandingPage        from '@/pages/LandingPage';
import TermsPage          from '@/pages/TermsPage';
import LoginPage          from '@/features/auth/pages/LoginPage';
import RegisterPage       from '@/features/auth/pages/RegisterPage';
import SSOCallbackPage    from '@/features/auth/pages/SSOCallbackPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';

// Dashboard
import DashboardPage from '@/pages/DashboardPage';

// Profile
import ProfilePage        from '@/features/profile/pages/ProfilePage';
import StudentProfileView from '@/features/profile/pages/StudentProfileView';
import SettingsPage       from '@/features/profile/pages/SettingsPage';

// Yearbook
import FlipbookPage          from '@/features/yearbook/pages/FlipbookPage';
import YearbookHomePage      from '@/features/yearbook/pages/YearbookHomePage';
import FlipbookViewerPage    from '@/features/yearbook/pages/FlipbookViewerPage'; // FIXED (was pointing to FlipbookViewer component directly)
import GalleryPage           from '@/features/yearbook/pages/GalleryPage';

// Batch
import BatchmatesPage          from '@/features/batch/pages/BatchmatesPage';
import SectionsPage            from '@/features/batch/pages/SectionsPage';
import SectionDetailPage       from '@/features/batch/pages/SectionDetailPage';
import DiscoveryPage           from '@/features/batch/pages/DiscoveryPage';
import DiscoveryStudentProfile from '@/features/batch/pages/DiscoveryStudentProfile';

// Messaging
import MessagesPage   from '@/features/messaging/pages/MessagesPage';
import { ChatHeadsProvider } from '@/features/messaging/context/ChatHeadsContext';
import GlobalChatHeads from '@/features/messaging/components/GlobalChatHeads';

// Subscription / Payment
import PaymentPage        from '@/features/subscription/pages/PaymentPage';
import PaymentSuccessPage from '@/features/subscription/pages/PaymentSuccessPage';
import PaymentCancelPage  from '@/features/subscription/pages/PaymentCancelPage';

// Search
import DirectoryPage from '@/features/search/pages/DirectoryPage';

// Transcripts
import TranscriptsPage from '@/features/transcripts/pages/TranscriptsPage';

// Faculty
import FacultyPage from '@/features/faculty/pages/FacultyPage';

// Analytics
import AnalyticsPage from '@/features/analytics/pages/AnalyticsPage';

// Alumni Tracker
import AlumniTrackerPage from '@/features/alumni/pages/AlumniTrackerPage';

// Fallback
import NotFoundPage from '@/pages/NotFoundPage';


// ROUTE GUARDS


function ConsentWrapper({ children }) {
  const { user }        = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user && !user.consent_accepted) setShow(true);
  }, [user]);

  return (
    <>
      {show && <ConsentModal onAccepted={() => setShow(false)} />}
      {children}
    </>
  );
}

function AlumniRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user || !user.email_verified) return <Navigate to="/login" replace />;
  const alumni = user.is_alumni === true
    || user.role === 'alumni'
    || user.academic_status === 'Alumni';
  if (!alumni) return <Navigate to="/dashboard" replace />;
  return <ConsentWrapper>{children}</ConsentWrapper>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!user || !user.email_verified) return <Navigate to="/login" replace />;
  return <ConsentWrapper>{children}</ConsentWrapper>;
}

function GuestRoute({ children }) {
  const { user, loading }              = useAuth();
  const { isOn, loading: configLoading } = useAppConfig();
  if (loading || configLoading) return null;
  if (isOn('maintenance_mode')) return <Navigate to="/maintenance" replace />;
  // Only skip login/register when the user is fully verified.
  if (user?.email_verified) return <Navigate to="/dashboard" replace />;
  return children;
}

function MaintenanceLayout() {
  const { isOn, loading } = useAppConfig();
  if (loading) return null;
  if (isOn('maintenance_mode')) return <Navigate to="/maintenance" replace />;
  return <Outlet />;
}

function OwnProfileRoute({ children }) {
  const { user, loading } = useAuth();
  const { id }            = useParams();

  if (loading) return <FullPageSpinner />;
  if (!user || !user.email_verified) return <Navigate to="/login" replace />;
  if (id && parseInt(id) !== user.id) return <Navigate to={`/students/${id}`} replace />;
  return <ConsentWrapper>{children}</ConsentWrapper>;
}


// APP


export default function App() {
  return (
    <AppConfigProvider>
      <AuthProvider>
        <BrowserRouter>
          <ChatHeadsProvider>
          <div id="sb-app-content">
          <RouteErrorBoundary>
          <Routes>
            <Route path="/maintenance" element={<MaintenancePage />} />

            <Route element={<MaintenanceLayout />}>

              {/* Public */}
              <Route path="/terms"          element={<TermsPage />} />
              <Route path="/privacy"        element={<TermsPage />} />
              <Route path="/"               element={<GuestRoute><LandingPage /></GuestRoute>} />
              <Route path="/login"          element={<GuestRoute><LoginPage /></GuestRoute>} />
              <Route path="/register"       element={<GuestRoute><RegisterPage /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
              <Route path="/sso/callback"   element={<SSOCallbackPage />} />

              {/* Dashboard */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

              {/* Profile */}
              <Route path="/profile"     element={<OwnProfileRoute><ProfilePage /></OwnProfileRoute>} />
              <Route path="/profile/:id" element={<OwnProfileRoute><ProfilePage /></OwnProfileRoute>} />
              <Route path="/settings"    element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/students/:id" element={<ProtectedRoute><StudentProfileView /></ProtectedRoute>} />

              {/* Directory */}
              <Route
                path="/directory"
                element={
                  <ProtectedRoute>
                    <FeatureRoute features="enable_student_directory_search">
                      <DirectoryPage />
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />

              {/* Gallery */}
              <Route path="/gallery"     element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />

              {/* Graduation */}

              {/* Yearbook / Flipbook */}
              <Route
                path="/flipbook"
                element={
                  <ProtectedRoute>
                    <FeatureRoute features="enable_flipbook_viewer">
                      <FlipbookPage />
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/yearbook"
                element={
                  <ProtectedRoute>
                    <YearbookHomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/yearbook/:batchId"
                element={
                  <ProtectedRoute>
                    <FeatureRoute features="publish_yearbook">
                      <YearbookHomePage />
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              {/*
               * /yearbook/:batchId/view
               * Uses FlipbookViewerPage (the page wrapper that runs useYearbook
               * and passes data into FlipbookViewer).
               * Previously this imported FlipbookViewer directly that skipped
               * the data hook entirely and crashed on the alumni link import.
               */}
              <Route
                path="/yearbook/:batchId/view"
                element={
                  <ProtectedRoute>
                    <FeatureRoute features="enable_flipbook_viewer">
                      <FlipbookViewerPage />
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />

              {/* Batch */}
              <Route path="/batchmates"            element={<ProtectedRoute><BatchmatesPage /></ProtectedRoute>} />
              <Route path="/sections"              element={<ProtectedRoute><SectionsPage /></ProtectedRoute>} />
              <Route path="/sections/:id"          element={<ProtectedRoute><SectionDetailPage /></ProtectedRoute>} />
              <Route path="/discover"              element={<ProtectedRoute><DiscoveryPage /></ProtectedRoute>} />
              <Route path="/discover/students/:id" element={<ProtectedRoute><DiscoveryStudentProfile /></ProtectedRoute>} />

              {/* Faculty */}
              <Route path="/faculty" element={<ProtectedRoute><FacultyPage /></ProtectedRoute>} />

              {/* Messaging */}
              <Route path="/messages"     element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
              <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

              {/* Payment */}
              <Route path="/payment" element={<Navigate to="/premium" replace />} />
              <Route path="/subscription" element={<Navigate to="/premium" replace />} />
              <Route
                path="/premium"
                element={
                  <ProtectedRoute>
                    <FeatureRoute features="enable_premium_subscription">
                      <PaymentPage />
                    </FeatureRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
              <Route path="/payment/cancel"  element={<ProtectedRoute><PaymentCancelPage /></ProtectedRoute>} />

              {/* Premium-only */}
              <Route path="/transcripts" element={<ProtectedRoute><TranscriptsPage /></ProtectedRoute>} />

              {/* Analytics */}
              <Route
                path="/analytics"
                element={<ProtectedRoute><AnalyticsPageWrapper /></ProtectedRoute>}
              />

              {/* Alumni Tracker */}
              <Route
                path="/alumni"
                element={<AlumniRoute><AlumniTrackerPage /></AlumniRoute>}
              />
              <Route
                path="/alumni-tracker"
                element={<AlumniRoute><AlumniTrackerPage /></AlumniRoute>}
              />

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />

            </Route>
          </Routes>
          </RouteErrorBoundary>
          </div>
          <GlobalChatHeads />
          <ScreenProtection />
          </ChatHeadsProvider>
        </BrowserRouter>
      </AuthProvider>
    </AppConfigProvider>
  );
}


// SHARED HELPERS


function AnalyticsPageWrapper() {
  const { user } = useAuth();
  return <AnalyticsPage isAuthenticated={!!user} currentUser={user} />;
}

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f4f7fe] px-6 text-center">
        <h1 className="m-0 text-2xl font-black text-[#1d2b4b]">This page needs a refresh</h1>
        <p className="m-0 max-w-md text-sm text-slate-500">
          The rest of Sinag-Bughaw is still available. Reload to continue where you left off.
        </p>
        <button
          type="button"
          className="rounded-xl border-0 bg-[#1d2b4b] px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
          onClick={() => window.location.assign('/dashboard')}
        >
          Back to dashboard
        </button>
      </div>
    );
  }
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-[#f4f7fe] px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LoadingSkeleton variant="page" count={1} />
      </div>
    </div>
  );
}
