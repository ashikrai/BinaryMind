import { useLocation, useNavigate , Link} from "react-router-dom";
import { useEffect } from "react";
import { GoogleSignInButton } from "@/features/auth/GoogleSignInButton";
import { useAuth } from "@/features/auth/authStore";
import logo from "../media/images/BMind Logo.png";

export default function Login() {
  const session = useAuth((s) => s.session);
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const isWriteIntent = loc.state?.from === "/write";

  useEffect(() => {
    if (session) nav(loc.state?.from ?? "/", { replace: true });
  }, [session, nav, loc.state]);

  return (
    <div className="space-y-6 text-center">
      <Link to="/" className="font-serif text-3xl font-bold">
        <img src={logo} width={70} style={{ margin: "auto" }} alt="Binary Mind" />
      </Link>
      <h1 className="font-serif text-3xl font-bold">
        {isWriteIntent ? "Sign in to start writing" : "Welcome to Binary Mind"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isWriteIntent ? (
          <>
            You need an account to write and publish stories.
            <br />
            Sign in with Google — it only takes a second.
          </>
        ) : (
          <>
            Sign in to write and publish your stories.
            <br />
            Reading is always free — no account required.
          </>
        )}
      </p>
      <div className="pt-4">
        <GoogleSignInButton />
      </div>
      <p className="pt-6 text-sm text-muted-foreground">
        Your Google account is used to create or access your Binary Mind profile.
      </p>
    </div>
  );
}
