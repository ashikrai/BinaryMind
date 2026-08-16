import { Link, Outlet, useNavigate } from "react-router-dom";
import { PenSquare, Search, Bell, Bookmark, LogOut, User } from "lucide-react";
import { useAuth } from "@/features/auth/authStore";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";
import logo from "../media/images/BMind Logo.png"
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

export function AppLayout() {
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <img src={logo} width="40"/>
            <Link to="/" className="font-serif text-2xl font-bold tracking-tight">
              {APP_NAME}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-2 text-muted-foreground sm:inline-flex"
              onClick={() => navigate("/search")}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden gap-2 sm:inline-flex"
                  onClick={handleWriteClick}
                >
                  <PenSquare className="h-4 w-4" />
                  Write
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
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden gap-2 sm:inline-flex"
                  onClick={handleWriteClick}
                >
                  <PenSquare className="h-4 w-4" />
                  Write
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" className="rounded-full" asChild>
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
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
