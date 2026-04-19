import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./utils/supabase";
import { ThemeProvider } from "./context/ThemeContext";
import { SessionProvider } from "./context/SessionContext";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import RequireMember from "./components/RequireMember";
import AuthRedirect from "./components/AuthRedirect";
import Auth from "./components/Auth";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import Onboarding from "./components/Onboarding";
import DashboardGateway from "./components/DashboardGateway";
import {
  GroupScopeIndexRedirect,
  LegacyStokvelToGroup,
  LegacyMeetingsListRedirect,
  LegacyMeetingDetailRedirect,
} from "./components/LegacyMemberRedirects";
import Apply from "./pages/Apply";
import AdminPlaceholder from "./pages/AdminPlaceholder";
import AdminCreateStokvel from "./pages/AdminCreateStokvel";
import AdminGroups from "./pages/AdminGroups";
import AdminEditStokvel from "./pages/AdminEditStokvel";
import AdminReviewStokvel from "./pages/AdminReviewStokvel";
import Account from "./pages/Account";
import StokvelDashboard from "./pages/StokvelDashboard";
import SingleStokvel from "./pages/SingleStokvel";
import Meetings from "./pages/Meetings";
import MeetingDetails from "./pages/MeetingDetails";
import MyPayout from "./pages/MyPayout";
import Support from "./pages/Support";
import Landing from "./pages/Landing";
import PublicStokvels from "./pages/PublicStokvels";
import AcceptInvitation from "./pages/AcceptInvitation";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-[#0f172a] text-slate-300">
        <p className="text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SessionProvider session={session}>
        <div className="h-full min-h-0 overflow-hidden">
          <BrowserRouter>
          <Routes>
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/stokvels" element={<PublicStokvels />} />
              <Route
                path="/auth"
                element={session ? <AuthRedirect /> : <Auth />}
              />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
            </Route>

            <Route element={<RequireAuth session={session} />}>
              <Route element={<RequireMember />}>
                <Route path="/dashboard" element={<DashboardGateway />} />
                <Route path="/onboarding" element={<Onboarding />} />

                <Route
                  path="/stokvels/:id"
                  element={<LegacyStokvelToGroup />}
                />
                <Route
                  path="/meetings"
                  element={<LegacyMeetingsListRedirect />}
                />
                <Route
                  path="/meetings/:id"
                  element={<LegacyMeetingDetailRedirect />}
                />

                <Route element={<DashboardLayout />}>
                  <Route path="/apply" element={<Apply />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/my-payout" element={<MyPayout />} />
                  <Route path="/group/:stokvel_id">
                    <Route index element={<GroupScopeIndexRedirect />} />
                    <Route path="dashboard" element={<StokvelDashboard />} />
                    <Route path="stokvels" element={<SingleStokvel />} />
                    <Route path="meetings" element={<Meetings />} />
                    <Route
                      path="meetings/:meeting_id"
                      element={<MeetingDetails />}
                    />
                  </Route>
                </Route>
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route
                    index
                    element={<Navigate to="/admin/groups" replace />}
                  />
                  <Route path="groups" element={<AdminGroups />} />
                  <Route
                    path="groups/:id/review"
                    element={<AdminReviewStokvel />}
                  />
                  <Route
                    path="groups/:id/edit"
                    element={<AdminEditStokvel />}
                  />
                  <Route path="account" element={<Account />} />
                  <Route
                    path="tickets"
                    element={<AdminPlaceholder title="Issue Tickets" />}
                  />
                  <Route path="create-group" element={<AdminCreateStokvel />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </div>
      </SessionProvider>
    </ThemeProvider>
  );
}
