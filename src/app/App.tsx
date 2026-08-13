import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { useBlogs } from "@/features/blogs/blogStore";
import { useBookmarks } from "@/features/bookmarks/bookmarkStore";
import { useAuth } from "@/features/auth/authStore";

const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Write = lazy(() => import("@/pages/Write"));
const EditBlog = lazy(() => import("@/pages/EditBlog"));
const ReadBlog = lazy(() => import("@/pages/ReadBlog"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Search = lazy(() => import("@/pages/Search"));
const Bookmarks = lazy(() => import("@/pages/Bookmarks"));
const MyStories = lazy(() => import("@/pages/MyStories"));
const Drafts = lazy(() => import("@/pages/Drafts"));
const Published = lazy(() => import("@/pages/Published"));
const Archive = lazy(() => import("@/pages/Archive"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

/**
 * Boots data on app start:
 * - Always fetches published blogs (public feed works without login).
 * - If a session is already restored from localStorage, also fetches the user's
 *   own drafts and their bookmarks.
 */
function DataBootstrap() {
  const session = useAuth((s) => s.session);
  const fetchBlogs = useBlogs((s) => s.fetchBlogs);
  const fetchLikedBlogs = useBlogs((s) => s.fetchLikedBlogs);
  const fetchBookmarks = useBookmarks((s) => s.fetchBookmarks);

  useEffect(() => {
    fetchBlogs(session?.user.id);
    if (session) {
      fetchLikedBlogs(session.user.id);
      fetchBookmarks(session.user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Redirect /signup → /login, preserving any state (e.g. { from: "/write" }). */
function SignupRedirect() {
  const loc = useLocation();
  return <Navigate to="/login" replace state={loc.state} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter basename={basename}>
            <DataBootstrap />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/blog/:slug" element={<ReadBlog />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                  <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                  <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/bookmarks" element={<RequireAuth><Bookmarks /></RequireAuth>} />
                  <Route path="/my-stories" element={<RequireAuth><MyStories /></RequireAuth>} />
                  <Route path="/drafts" element={<RequireAuth><Drafts /></RequireAuth>} />
                  <Route path="/published" element={<RequireAuth><Published /></RequireAuth>} />
                  <Route path="/archive" element={<RequireAuth><Archive /></RequireAuth>} />
                  <Route path="/write" element={<RequireAuth><Write /></RequireAuth>} />
                  <Route path="/edit/:id" element={<RequireAuth><EditBlog /></RequireAuth>} />
                </Route>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignupRedirect />} />
                </Route>
                <Route path="/not-found" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/not-found" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
