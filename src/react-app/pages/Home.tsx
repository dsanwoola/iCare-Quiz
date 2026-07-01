import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Zap, Users, Trophy, Play, Crown, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import AuthDialog from "@/react-app/components/AuthDialog";

export default function HomePage() {
  const { user, isHost, isPending, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with login */}
      <header className="absolute top-0 right-0 p-4 z-10">
        {isPending ? null : isHost ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.name || user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}>
            <LogIn className="w-4 h-4 mr-1" />
            Host Sign In
          </Button>
        )}
      </header>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      {/* Hero Section */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="gradient-primary p-2 sm:p-3 rounded-xl sm:rounded-2xl glow-primary">
            <Zap className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight">
            <span className="text-gradient">iCare Quiz</span>
            <span className="text-blue-900"> Arena</span>
          </h1>
        </div>

        <p className="text-base sm:text-xl md:text-2xl text-muted-foreground text-center max-w-2xl mb-8 sm:mb-12 px-2">
          Real-time quiz battles for classrooms, events, and fun.
          <br />
          <span className="text-foreground font-medium">Host or join in seconds.</span>
        </p>

        {/* Action Cards */}
        <div className={`grid gap-4 sm:gap-6 w-full max-w-3xl ${isHost ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md'}`}>
          {/* Host Card - Only visible to signed-in hosts */}
          {isHost ? (
          <Link to="/host" className="group">
            <div className="relative bg-card border-2 border-primary/20 rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 gradient-primary text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                HOST
              </div>
              <div className="gradient-primary w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 text-blue-900">Create a Quiz</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                Build your quiz, invite players, and control the game in real-time.
              </p>
              <Button className="w-full gradient-primary text-white border-0 text-base sm:text-lg h-10 sm:h-12 rounded-lg sm:rounded-xl font-semibold">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Start Hosting
              </Button>
            </div>
          </Link>
          ) : null}

          {/* Join Card */}
          <Link to="/join" className="group">
            <div className="relative bg-card border-2 border-secondary/20 rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/10 hover:-translate-y-1">
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 gradient-secondary text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                PLAYER
              </div>
              <div className="gradient-secondary w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 text-blue-900">Join a Game</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                Enter a game PIN to join a live quiz and compete for the top spot.
              </p>
              <Button className="w-full gradient-secondary text-white border-0 text-base sm:text-lg h-10 sm:h-12 rounded-lg sm:rounded-xl font-semibold">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Enter Game PIN
              </Button>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mt-8 sm:mt-16 text-xs sm:text-sm text-muted-foreground px-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />
            Real-time sync
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-secondary" />
            Live leaderboards
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent" />
            Time-based scoring
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-success" />
            Mobile-friendly
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground border-t">
        <p>iCare Quiz Arena — Real-time quiz battles</p>
      </footer>
    </div>
  );
}
