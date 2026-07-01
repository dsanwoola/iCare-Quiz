import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { Zap, Users, Wifi, WifiOff, Sparkles } from "lucide-react";
import type { Team } from "@/shared/types";
import { subscribeSession, subscribeParticipants, ensurePlayerAuth } from "@/react-app/lib/data";
import { sounds, playSound, initAudio } from "@/react-app/lib/feedback";

export default function PlayerWaitingRoom() {
  const { gamePin } = useParams();
  const navigate = useNavigate();
  
  const [nickname] = useState(() => sessionStorage.getItem("nickname") || "Player");
  const [quizTitle] = useState(() => sessionStorage.getItem("quizTitle") || "Quiz");
  const [quizLogoUrl] = useState(() => sessionStorage.getItem("quizLogoUrl") || null);
  const [sessionId] = useState(() => sessionStorage.getItem("sessionId"));
  const [participantId] = useState(() => sessionStorage.getItem("participantId"));
  
  const [playerCount, setPlayerCount] = useState(1);
  const [isConnected, setIsConnected] = useState(true);
  const [showTip, setShowTip] = useState(0);
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const hasAlertedRef = useRef(false);

  const myTeam = teamMode ? teams.find((t) => t.id === myTeamId) ?? null : null;

  const tips = [
    "Answer quickly for bonus points!",
    "Watch the timer closely",
    "Every second counts",
    "Stay focused and ready",
  ];

  // Cycle through tips
  useEffect(() => {
    const interval = setInterval(() => {
      setShowTip((prev) => (prev + 1) % tips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Redirect to join if no session info
    if (!sessionId || !participantId) {
      navigate("/join");
      return;
    }

    let unsubSession = () => {};
    let unsubPlayers = () => {};
    let cancelled = false;

    ensurePlayerAuth().then(() => {
      if (cancelled) return;
      unsubSession = subscribeSession(sessionId, (session) => {
      if (!session) {
        setIsConnected(false);
        return;
      }
      setIsConnected(true);
      setTeamMode(session.teamMode);
      setTeams(session.teams);

      // If game has started, navigate to game screen
      if (session.status === "LIVE") {
        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          initAudio();
          playSound(sounds.gameStartAlert);
        }
        navigate(`/play/${gamePin}/game`);
      }
      });

      unsubPlayers = subscribeParticipants(sessionId, (players) => {
        setPlayerCount(players.length);
        const me = players.find((p) => p.id === participantId);
        setMyTeamId(me?.teamId ?? null);
      });
    });

    return () => {
      cancelled = true;
      unsubSession();
      unsubPlayers();
    };
  }, [sessionId, participantId, gamePin, navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden safe-area-inset">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-secondary/5 via-background to-primary/5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary/15 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-secondary/5 to-transparent rounded-full" />
      </div>

      {/* Connection indicator */}
      <div className="absolute top-4 right-4 safe-area-top">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm transition-colors ${
            isConnected
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="hidden sm:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">Reconnecting...</span>
            </>
          )}
        </div>
      </div>

      <div className="text-center max-w-md w-full px-2">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="gradient-secondary p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-secondary/30">
            <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold">iCare Quiz Arena</span>
        </div>

        {/* Player badge */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-primary/20 to-secondary/20 text-foreground px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold border border-primary/20 shadow-lg text-sm sm:text-base">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span>Playing as</span>
            <span className="text-primary font-bold truncate max-w-[120px] sm:max-w-none">{nickname}</span>
          </div>
          {myTeam && (
            <div
              className="inline-flex items-center gap-1.5 px-4 py-2 sm:py-3 rounded-full font-bold text-white shadow-lg text-sm sm:text-base"
              style={{ backgroundColor: myTeam.color }}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              {myTeam.name} Team
            </div>
          )}
        </div>

        {/* Quiz Card */}
        <div className="bg-card/80 backdrop-blur-md border-2 border-secondary/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-6 sm:mb-8 shadow-2xl shadow-secondary/10">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wide">You're playing</p>
          <h1 className="text-xl sm:text-3xl font-bold text-gradient mb-2 sm:mb-3 leading-tight break-words">
            {quizTitle}
          </h1>
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-muted/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base">
            <span className="text-[10px] sm:text-xs text-muted-foreground">PIN:</span>
            <span className="font-mono font-bold tracking-wider">{gamePin}</span>
          </div>
        </div>

        {/* Waiting animation */}
        <div className="mb-6 sm:mb-8">
          {/* Ready image/logo */}
          {quizLogoUrl && (
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-4 sm:mb-6">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 animate-pulse blur-sm" />
              <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-xl bg-white">
                <img 
                  src={quizLogoUrl}
                  alt="Quiz logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-blue-900">Get Ready!</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
            Waiting for the host to start...
          </p>

          {/* Rotating tips */}
          <div className="h-6 sm:h-8 relative overflow-hidden">
            <p 
              key={showTip}
              className="text-xs sm:text-sm text-secondary/80 font-medium animate-fade-in"
            >
              💡 {tips[showTip]}
            </p>
          </div>
        </div>

        {/* Player count */}
        <div className="bg-muted/30 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 inline-flex items-center gap-2.5 sm:gap-3">
          <div className="bg-secondary/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
          </div>
          <div className="text-left">
            <div className="text-xl sm:text-2xl font-bold">{playerCount}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              player{playerCount !== 1 ? "s" : ""} ready
            </div>
          </div>
        </div>
      </div>

      {/* Fun animated dots at bottom */}
      <div className="absolute bottom-6 sm:bottom-8 flex gap-2 sm:gap-3 safe-area-bottom">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gradient-to-br from-secondary to-primary animate-bounce"
            style={{ animationDelay: `${i * 0.1}s`, animationDuration: '1s' }}
          />
        ))}
      </div>
    </div>
  );
}
