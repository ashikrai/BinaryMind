import { useState } from "react";
import { useAuth } from "@/features/auth/authStore";
import { useMedium } from "@/features/medium/mediumStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MediumSyncPanel } from "@/features/medium/MediumSyncPanel";

export default function Profile() {
  const session = useAuth((s) => s.session!);
  const updateProfile = useAuth((s) => s.updateProfile);
  const setAvatarSource = useAuth((s) => s.setAvatarSource);
  const mediumConnected = useMedium((s) => s.connected);
  const mediumUser = useMedium((s) => s.mediumUser);
  const [avatarSaving, setAvatarSaving] = useState(false);

  const currentSource = session.user.avatarSource ?? "google";

  const handleAvatarSource = async (source: "google" | "medium") => {
    if (source === currentSource) return;
    setAvatarSaving(true);
    try {
      await setAvatarSource(source);
      toast.success(
        source === "medium"
          ? "Now using Medium profile photo and name"
          : "Now using Google profile photo and name",
      );
    } catch {
      toast.error("Failed to update avatar source");
    } finally {
      setAvatarSaving(false);
    }
  };

  const [name, setName] = useState(session.user.name);
  const [bio, setBio] = useState(session.user.bio ?? "");
  const [twitter, setTwitter] = useState(session.user.social?.twitter ?? "");
  const [github, setGithub] = useState(session.user.social?.github ?? "");
  const [website, setWebsite] = useState(session.user.social?.website ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name,
        bio,
        social: { twitter, github, website },
      });
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Your profile</h1>
      <div className="mb-6 flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={session.user.avatar} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{session.user.email}</div>
          <div className="text-xs text-muted-foreground">
            Joined {new Date(session.user.joinedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Avatar source switcher — only visible when Medium is connected */}
      {mediumConnected && mediumUser && (
        <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-3 text-sm font-medium">Profile photo &amp; display name</p>
          <div className="flex flex-wrap gap-3">
            <AvatarSourceOption
              label="Google"
              description="Use your Google account photo and name"
              selected={currentSource === "google"}
              disabled={avatarSaving}
              onClick={() => handleAvatarSource("google")}
            />
            <AvatarSourceOption
              label="Medium"
              description={`Use Medium profile — ${mediumUser.name}`}
              selected={currentSource === "medium"}
              disabled={avatarSaving}
              onClick={() => handleAvatarSource("medium")}
            />
          </div>
        </div>
      )}
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Bio">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Twitter">
            <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
          </Field>
          <Field label="GitHub">
            <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username" />
          </Field>
          <Field label="Website">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Medium Integration                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Separator className="my-8" />
      <section>
        <h2 className="mb-1 font-serif text-xl font-semibold">Medium Sync</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect your Medium account to import existing posts into BinaryMind or push
          BinaryMind posts back to Medium. Imported and pushed posts are always saved as
          <strong> drafts</strong> first — you decide when to publish.
        </p>
        <MediumSyncPanel />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

interface AvatarSourceOptionProps {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function AvatarSourceOption({ label, description, selected, disabled, onClick }: AvatarSourceOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex flex-1 min-w-[180px] items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-background hover:border-primary/50",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-muted-foreground/40",
        ].join(" ")}
      >
        {selected && (
          <span className="h-2 w-2 rounded-full bg-primary" />
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium leading-none">{label}</span>
        <span className="mt-1 text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
