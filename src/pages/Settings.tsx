import { useTheme } from "@/features/theme/themeStore";
import { Button } from "@/components/ui/button";
import { localStore } from "@/storage/localStore";
import { STORAGE_KEYS } from "@/constants";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/authStore";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();

  const clearLocalPreferences = () => {
    // Only clear local preferences (theme, cached session).
    // Blogs and bookmarks now live in Supabase — no local data to clear.
    localStore.remove(STORAGE_KEYS.auth);
    localStore.remove(STORAGE_KEYS.theme);
    localStore.remove(STORAGE_KEYS.bookmarks);
    localStore.remove(STORAGE_KEYS.history);
    toast.success("Local preferences cleared");
    logout();
    nav("/");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      <section>
        <h2 className="mb-3 font-semibold">Appearance</h2>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? "default" : "outline"}
              onClick={() => setTheme(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Account</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Your stories are stored in the cloud and will persist across devices.
          Signing out clears your local session only — your data is safe.
        </p>
        <Button variant="destructive" onClick={clearLocalPreferences}>
          Sign out &amp; clear local session
        </Button>
      </section>
    </div>
  );
}
