import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/authStore";
import logo from "@/media/images/BMind Logo.png";
import {
  BookOpen,
  PenSquare,
  Users,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const VALUES = [
  {
    icon: PenSquare,
    title: "Write Without Limits",
    body: "A distraction-free Notion-style editor lets you focus on what matters — your ideas. Rich text, code blocks, images, embeds — everything you need, nothing you don't.",
  },
  {
    icon: BookOpen,
    title: "Read with Purpose",
    body: "Every story is presented in a clean, typography-first reading experience. No ads, no clutter — just the words and the mind behind them.",
  },
  {
    icon: Users,
    title: "A Community of Thinkers",
    body: "BinaryMind is built for developers, designers, founders, and curious minds. Share your perspective and discover insights from people who think deeply.",
  },
  {
    icon: Zap,
    title: "Built for Speed",
    body: "Instant search, real-time updates, and a responsive interface that works beautifully on any device — from your morning commute to your late-night writing sessions.",
  },
  {
    icon: ShieldCheck,
    title: "Your Work, Your Control",
    body: "Your drafts are yours. Publish when you're ready, archive what you want to keep private, and manage your stories with full visibility into reads, likes, and reach.",
  },
  {
    icon: Sparkles,
    title: "Craft Meets Technology",
    body: "The name says it all — Binary for the logic, Mind for the creativity. We believe the best ideas live at the intersection of rigorous thinking and human expression.",
  },
] as const;

const STATS = [
  { value: "10K+", label: "Stories published" },
  { value: "50K+", label: "Monthly readers" },
  { value: "5K+", label: "Active writers" },
  { value: "120+", label: "Topics covered" },
] as const;

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------
function HeroSection() {
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden border-b bg-background py-24">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-foreground) 1px,transparent 1px),linear-gradient(90deg,var(--color-foreground) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <img src={logo} alt="BinaryMind logo" className="h-20 w-20 rounded-2xl shadow-lg" />
        <h1 className="font-serif text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
          About{" "}
          <span className="text-primary">BinaryMind</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          A modern home for ideas, stories, and the people who write them. Built
          for thinkers who believe that words — and the thinking behind them —
          can change the way we see the world.
        </p>
        {!session && (
          <Button
            size="lg"
            className="mt-2 rounded-full gap-2"
            onClick={() => navigate("/login")}
          >
            Join BinaryMind <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  );
}

function MissionSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
        Our Mission
      </p>
      <h2 className="mb-6 font-serif text-3xl font-bold text-foreground md:text-4xl">
        Turning ideas into conversations that matter.
      </h2>
      <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>
          BinaryMind was born from a simple frustration: the best ideas rarely
          make it out of people's heads. Brilliant engineers, designers, and
          founders carry insights worth sharing — but publishing platforms make
          it harder than it should be. Too many ads, too much noise, too little
          craft.
        </p>
        <p>
          So we built something different. A platform that respects your time as
          a reader and your effort as a writer. Where the reading experience is
          clean, the writing experience is powerful, and the community is people
          who care about quality over quantity.
        </p>
        <p>
          The name <strong className="text-foreground">BinaryMind</strong> captures
          the duality we believe in: the precision of binary thinking (logic,
          code, systems) fused with the depth of the mind (creativity, empathy,
          narrative). The best writing lives in that overlap.
        </p>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto grid max-w-4xl grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
        {STATS.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 px-8 py-10">
            <span className="font-serif text-4xl font-extrabold text-primary">{value}</span>
            <span className="text-center text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-primary/50">Above Stats details are for demo purpose, realts stats are coming soon as the applicaiton is in its growing phase</p>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-12 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          What We Stand For
        </p>
        <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
          Built around six core beliefs
        </h2>
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {VALUES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col gap-3 rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaSection() {
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();

  return (
    <section className="border-t bg-primary/5">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center">
        <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
          Ready to share your story?
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Join thousands of writers who publish on BinaryMind every week. It's
          free, it's fast, and your first draft is closer than you think.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {session ? (
            <Button size="lg" className="rounded-full gap-2" onClick={() => navigate("/write")}>
              <PenSquare className="h-4 w-4" /> Start writing
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                className="rounded-full gap-2"
                onClick={() => navigate("/login")}
              >
                <PenSquare className="h-4 w-4" /> Start writing — it's free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => navigate("/search")}
              >
                Explore stories <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Already a member?{" "}
          <Link
            to="/login"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function About() {
  return (
    <div>
      <HeroSection />
      <MissionSection />
      <StatsSection />
      <ValuesSection />
      <CtaSection />
    </div>
  );
}
