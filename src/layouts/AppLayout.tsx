import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PenSquare, Search, Bell, Bookmark, LogOut, User, BookOpen, Menu } from "lucide-react";
import { useAuth } from "@/features/auth/authStore";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import logo from "../media/images/BMind Logo.png"
import { SearchModal } from "@/components/SearchModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { APP_NAME } from "@/constants";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";
import { cn } from "@/lib/utils";

// Nav links shown to unauthenticated users
const GUEST_NAV = [
  { label: "Home", to: "/" },
  { label: "Stories", to: "/search" },
  { label: "About", to: "/about" },
] as const;

export function AppLayout() {
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleWriteClick = useCallback(() => {
    if (session) {
      navigate("/write");
    } else {
      navigate("/login", { state: { from: "/write" } });
    }
  }, [session, navigate]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">

          {/* ── Logo + brand name ─────────────────────────────── */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <img src={logo} width="36" alt="" />
            <Link to="/" className="text-xl font-bold tracking-tight">
              <span> Binary</span>
              <span className="text-pink-800/75"> Mind</span>
              {/* {APP_NAME} */}
            </Link>
          </div>
          <div id="navigation" className="flex flex-1 items-center gap-2">
            {session ? (
              /* ── Authenticated ──────────────────────────────── */
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 hidden gap-2 text-muted-foreground sm:inline-flex"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-2 sm:inline-flex"
                    onClick={handleWriteClick}
                  >
                    <PenSquare className="h-4 w-4" />
                    Write
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-2 sm:inline-flex"
                    onClick={() => navigate("/my-stories")}
                  >
                    <BookOpen className="h-4 w-4" />
                    My Stories
                  </Button>
                  <Button variant="ghost" size="icon" asChild aria-label="Bookmarks">
                    <Link to="/bookmarks">
                      <Bookmark className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <ThemeToggle />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={session.user.avatar} alt={session.user.name} />
                          <AvatarFallback>
                            {session.user.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="text-sm font-medium">{session.user.name}</div>
                        <div className="text-xs text-muted-foreground">{session.user.email}</div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/profile")}>
                        <User className="mr-2 h-4 w-4" /> Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-stories?tab=draft")}>
                        Drafts
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-stories?tab=published")}>
                        Published
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-stories?tab=collabs")}>
                        Collaborations
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/my-stories?tab=medium-imports")}>
                        Medium Imports
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/settings")}>
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/about")}>
                        About BMind
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          logout();
                          navigate("/");
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              /* ── Guest ──────────────────────────────────────── */
              <>
                {/* Desktop: centred nav links + Write */}
                <div className="flex-1"/>
                <nav
                  className="hidden items-center justify-center gap-1 sm:flex"
                  aria-label="Main navigation"
                >
                  {GUEST_NAV.map(({ label, to }) => (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "relative px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground",
                        location.pathname === to
                          ? "text-foreground after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={handleWriteClick}
                  >
                    <PenSquare className="h-4 w-4" />
                    Write
                  </Button>
                </nav>

                {/* Right side — always visible */}
                <div className="ml-auto flex items-center gap-2">
                  <ThemeToggle />
                  {/* Desktop: real Google button */}
                  <div className="hidden sm:block">
                    <GoogleSignInButton />
                  </div>
                  {/* Mobile: hamburger dropdown */}
                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Open menu">
                          <Menu className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {GUEST_NAV.map(({ label, to }) => (
                          <DropdownMenuItem key={to} onClick={() => navigate(to)}>
                            {label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleWriteClick}>
                          <PenSquare className="mr-2 h-4 w-4" /> Write
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/login")}>
                          Sign in with Google
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </header>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main>
        <Outlet />
      </main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4">
          {APP_NAME} · A Medium-inspired reading & writing experience
        </div>
      </footer>
    </div>
  );
}
