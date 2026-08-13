import { useState } from "react";
import { useAuth } from "@/features/auth/authStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function Profile() {
  const session = useAuth((s) => s.session!);
  const updateProfile = useAuth((s) => s.updateProfile);

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
