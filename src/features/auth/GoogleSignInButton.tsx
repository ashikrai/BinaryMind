import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "@/constants";
import { useAuth, isGoogleConfigured } from "./authStore";

/**
 * Renders the official Google Identity Services "Sign in with Google" button.
 * Requires VITE_GOOGLE_CLIENT_ID to be set in the environment.
 *
 * The GIS script is injected once lazily when the component mounts.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function ensureGisScript() {
  if (document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = GIS_SCRIPT_SRC;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

export function GoogleSignInButton() {
  const holder = useRef<HTMLDivElement>(null);
  const login = useAuth((s: any) => s.loginWithGoogleCredential);
  const configured = isGoogleConfigured();

  useEffect(() => {
    if (!configured || !holder.current) return;

    ensureGisScript();

    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        window.setTimeout(tryInit, 250);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => login(credential),
      });
      window.google.accounts.id.renderButton(holder.current!, {
        theme: "outline",
        size: "medium",
        text: "signin_with",
        shape: "pill",
        width: 170,
      });
    };
    tryInit();
    return () => {
      cancelled = true;
    };
  }, [configured, login]);

  if (!configured) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="max-w-xs rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
          Google sign-in is not configured.
          <br />
          Add <code className="rounded bg-muted px-1">VITE_GOOGLE_CLIENT_ID</code> to{" "}
          <code className="rounded bg-muted px-1">.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  return <div ref={holder} className="flex justify-center" />;
}
