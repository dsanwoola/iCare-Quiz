import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import {
  Zap,
  LogIn,
  LogOut,
  ArrowRight,
  Wand2,
  ListChecks,
  Users2,
  Trophy,
  BarChart3,
  LayoutTemplate,
  Play,
  QrCode,
  Share2,
} from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import AuthDialog from "@/react-app/components/AuthDialog";

const features = [
  { icon: Wand2, title: "AI quiz generation", desc: "Turn any topic into a full, ready-to-play quiz in seconds." },
  { icon: ListChecks, title: "6 question types", desc: "Multiple choice, true/false, type-answer, numeric and ordering — with images." },
  { icon: Users2, title: "Team mode", desc: "Split players into colour-coded teams and battle for the top." },
  { icon: Trophy, title: "Live leaderboards", desc: "Speed and streak scoring that updates in real time." },
  { icon: BarChart3, title: "Quiz analytics", desc: "See accuracy, your hardest questions and response times." },
  { icon: LayoutTemplate, title: "Template library", desc: "Start from ready-made quizzes or publish your own." },
];

const steps = [
  { icon: Wand2, title: "Build or generate", desc: "Create a quiz yourself, or let AI write one from a topic." },
  { icon: QrCode, title: "Share the PIN", desc: "Players join instantly with a 6-digit PIN or QR code." },
  { icon: Play, title: "Play live", desc: "Run the game and watch the leaderboard climb." },
];

export default function HomePage() {
  const { isHost, isPending, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [pin, setPin] = useState("");

  const joinWithPin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.replace(/\D/g, "");
    navigate(clean.length === 6 ? `/join/${clean}` : "/join");
  };

  const Wordmark = () => (
    <span className="font-black tracking-tight">
      <span className="text-gradient">Neighbours Quiz</span> <span className="text-yellow-500">Arena</span>
    </span>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="w-full border-b border-border/60 bg-card/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="gradient-primary p-2 rounded-xl glow-primary">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-base sm:text-lg">
              <Wordmark />
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/templates">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <LayoutTemplate className="w-4 h-4 mr-1.5" />
                Templates
              </Button>
            </Link>
            {isPending ? null : isHost ? (
              <>
                <Link to="/host">
                  <Button variant="outline" size="sm" className="rounded-lg">Dashboard</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setAuthOpen(true)}>
                <LogIn className="w-4 h-4 mr-1.5" />
                Host sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
          <div className="absolute top-1/3 right-1/5 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-float-delayed" />
        </div>

        <div className="max-w-3xl mx-auto text-center px-4 pt-14 sm:pt-20 pb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs sm:text-sm font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Real-time multiplayer quizzes
          </span>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05]">
            Play <span className="text-gradient">quiz battles</span>
            <br />
            with your <span className="text-yellow-500">neighbours</span>
          </h1>

          <p className="mt-5 text-base sm:text-xl text-muted-foreground max-w-xl mx-auto">
            Host a live quiz or jump into a game with a PIN. AI-built quizzes, team play, and instant leaderboards.
          </p>

          {/* CTA band */}
          <div className="mt-8 relative overflow-hidden gradient-primary rounded-3xl px-6 py-10 sm:py-12 text-center text-white shadow-xl shadow-primary/20">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-yellow-400/30 rounded-full blur-2xl" />
            <div className="relative">
              <Trophy className="w-10 h-10 mx-auto mb-3 text-yellow-300" />
              <h2 className="text-2xl sm:text-3xl font-black mb-2">Ready to play?</h2>
              <p className="text-white/80 max-w-md mx-auto mb-6">
                Spin up a quiz in minutes, or drop a PIN to join the neighbours already playing.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {isHost ? (
                  <Link to="/host">
                    <Button className="bg-white text-green-800 hover:bg-white/90 rounded-xl h-12 px-7 text-base font-bold">
                      <Play className="w-5 h-5 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => setAuthOpen(true)}
                    className="bg-white text-green-800 hover:bg-white/90 rounded-xl h-12 px-7 text-base font-bold"
                  >
                    <Wand2 className="w-5 h-5 mr-2" />
                    Host a Quiz
                  </Button>
                )}
                <Link to="/join">
                  <Button className="gradient-secondary text-neutral-900 border-0 rounded-xl h-12 px-7 text-base font-bold">
                    <Share2 className="w-5 h-5 mr-2" />
                    Join a Game
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick join */}
          <form onSubmit={joinWithPin} className="mt-8 flex flex-col sm:flex-row items-stretch gap-2 max-w-md mx-auto">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter game PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="flex-1 h-14 rounded-2xl border-2 border-border bg-card px-5 text-center sm:text-left text-2xl font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:text-base placeholder:font-sans focus:outline-none focus:border-primary transition-colors"
              aria-label="Game PIN"
            />
            <Button
              type="submit"
              className="h-14 px-7 gradient-secondary text-neutral-900 border-0 rounded-2xl text-lg font-bold shadow-lg shadow-secondary/30"
            >
              Join
              <ArrowRight className="w-5 h-5 ml-1.5" />
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Want to host?{" "}
            {isHost ? (
              <Link to="/host" className="text-primary font-semibold hover:underline">
                Go to your dashboard →
              </Link>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="text-primary font-semibold hover:underline">
                Create a quiz →
              </button>
            )}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16 w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold">Everything you need to run a great quiz</h2>
          <p className="text-muted-foreground mt-2">Built for classrooms, team socials, events and game nights.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-card border-2 border-border/70 rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all hover:-translate-y-0.5"
              >
                <div className="gradient-primary w-11 h-11 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 border-y border-border/60 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-bold text-center mb-10">Live in three steps</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative bg-card rounded-2xl p-6 border border-border/70">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full gradient-secondary text-neutral-900 font-black flex items-center justify-center text-sm shadow">
                    {i + 1}
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="gradient-primary p-1.5 rounded-lg">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <Wordmark />
          </div>
          <p>Real-time quiz battles · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
