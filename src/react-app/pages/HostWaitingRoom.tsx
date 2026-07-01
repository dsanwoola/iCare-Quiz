import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate, useParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { useToast } from "@/react-app/components/ui/toast";
import {
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Unlock,
  Play,
  Users,
  X,
  Loader2,
  Crown,
  Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Users2 } from "lucide-react";
import type { SessionInfo, ParticipantInfo, Question } from "@/shared/types";
import { PRESET_TEAMS } from "@/shared/types";
import {
  createSession as createSessionApi,
  getSession,
  getQuiz,
  subscribeParticipants,
  setRoomLocked,
  kickParticipant,
  setTeamMode,
  startGame as startGameApi,
} from "@/react-app/lib/data";

export default function HostWaitingRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const quizId = searchParams.get("quiz");

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isTogglingTeams, setIsTogglingTeams] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { showError } = useToast();

  const toggleTeamMode = async () => {
    if (!session) return;
    setIsTogglingTeams(true);
    try {
      const next = !session.teamMode;
      await setTeamMode(session.id, next);
      setSession({ ...session, teamMode: next, teams: next ? PRESET_TEAMS : session.teams });
    } catch (err) {
      console.error("Failed to toggle team mode:", err);
    } finally {
      setIsTogglingTeams(false);
    }
  };

  // Create session on mount or load existing session
  useEffect(() => {
    const init = async () => {
      try {
        let data: SessionInfo;
        if (urlSessionId) {
          data = await getSession(urlSessionId);
          if (data.status === "LIVE") {
            navigate(`/host/session/${data.id}/live`);
            return;
          }
          if (data.status === "ENDED") {
            setError("This session has ended. Please create a new game.");
            return;
          }
        } else if (quizId) {
          data = await createSessionApi(quizId);
          if (data.status === "LIVE") {
            navigate(`/host/session/${data.id}/live`);
            return;
          }
        } else {
          setError("No quiz selected");
          return;
        }
        setSession(data);
        const quiz = await getQuiz(data.quizId);
        setQuestions(quiz.questions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [quizId, urlSessionId, navigate]);

  // Realtime participant updates
  useEffect(() => {
    if (!session) return;
    return subscribeParticipants(session.id, setParticipants);
  }, [session?.id]);

  const copyPin = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.gamePin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleLock = async () => {
    if (!session) return;
    setIsLocking(true);
    try {
      await setRoomLocked(session.id, !session.isRoomLocked);
      setSession({ ...session, isRoomLocked: !session.isRoomLocked });
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    } finally {
      setIsLocking(false);
    }
  };

  const kickPlayer = async (participantId: string) => {
    if (!session) return;
    try {
      await kickParticipant(session.id, participantId);
    } catch (err) {
      console.error("Failed to kick player:", err);
    }
  };

  const startGame = async () => {
    if (!session) return;
    setIsStarting(true);
    try {
      await startGameApi(session.id, questions);
      navigate(`/host/session/${session.id}/live`);
    } catch (err) {
      console.error("Failed to start game:", err);
      showError("Failed to start game", "Please try again");
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Creating game session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link to="/host">
            <Button>Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              to="/host"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base truncate">{session?.quizTitle}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {session?.totalQuestions} questions
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={participants.length === 0 || isStarting}
            className="gradient-primary text-white border-0 rounded-lg sm:rounded-xl h-9 sm:h-11 px-4 sm:px-6 text-sm sm:text-base shrink-0"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1.5 sm:mr-2" />
            )}
            <span className="hidden xs:inline">{isStarting ? "Starting..." : "Start Game"}</span>
            <span className="xs:hidden">{isStarting ? "..." : "Start"}</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Game PIN Display */}
        <Card className="p-5 sm:p-8 mb-6 sm:mb-8 text-center rounded-2xl sm:rounded-3xl border-2 glow-primary">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Game PIN
            </span>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>

          <div className="relative inline-block">
            <div className="text-4xl sm:text-6xl md:text-8xl font-black tracking-[0.15em] sm:tracking-[0.2em] text-gradient mb-4 sm:mb-6">
              {session?.gamePin}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={copyPin}
              className="rounded-lg sm:rounded-xl h-9 sm:h-11 text-sm sm:text-base"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 sm:mr-2 text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5 sm:mr-2" />
                  Copy PIN
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={toggleLock}
              disabled={isLocking}
              className={`rounded-lg sm:rounded-xl h-9 sm:h-11 text-sm sm:text-base ${
                session?.isRoomLocked
                  ? "border-destructive text-destructive hover:bg-destructive/10"
                  : ""
              }`}
            >
              {isLocking ? (
                <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
              ) : session?.isRoomLocked ? (
                <Lock className="w-4 h-4 mr-1.5 sm:mr-2" />
              ) : (
                <Unlock className="w-4 h-4 mr-1.5 sm:mr-2" />
              )}
              {session?.isRoomLocked ? "Locked" : "Lock Room"}
            </Button>

            <Button
              variant="outline"
              onClick={toggleTeamMode}
              disabled={isTogglingTeams}
              className={`rounded-lg sm:rounded-xl h-9 sm:h-11 text-sm sm:text-base ${
                session?.teamMode ? "border-primary text-primary bg-primary/5" : ""
              }`}
            >
              {isTogglingTeams ? (
                <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
              ) : (
                <Users2 className="w-4 h-4 mr-1.5 sm:mr-2" />
              )}
              Teams: {session?.teamMode ? "On" : "Off"}
            </Button>
          </div>

          {session && (
            <div className="mt-6 sm:mt-8 flex flex-col items-center gap-2">
              <div className="bg-white p-3 rounded-2xl shadow-md">
                <QRCodeSVG
                  value={`${window.location.origin}/join/${session.gamePin}`}
                  size={148}
                  level="M"
                />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Scan to join instantly — or go to{" "}
                <span className="font-medium text-foreground">{window.location.host}/join</span>
              </p>
            </div>
          )}
        </Card>

        {/* Players List */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-blue-900">Players</h2>
            <span className="text-xs sm:text-sm text-muted-foreground">
              ({participants.length})
            </span>
          </div>
        </div>

        {participants.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center rounded-xl sm:rounded-2xl border-dashed border-2">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 text-blue-900">Waiting for players...</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Share the game PIN above to let players join
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {participants.map((participant, index) => {
              const team = session?.teamMode
                ? session.teams.find((t) => t.id === participant.teamId)
                : null;
              return (
              <Card
                key={participant.id}
                className="p-2.5 sm:p-4 rounded-lg sm:rounded-xl group hover:border-primary/30 transition-all relative overflow-hidden"
              >
                {/* Entry animation gradient */}
                <div className="absolute inset-0 gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />

                <div className="relative">
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-lg mb-1.5 sm:mb-2 ${
                      team
                        ? ""
                        : [
                            "bg-red-500",
                            "bg-blue-500",
                            "bg-green-500",
                            "bg-yellow-500",
                            "bg-purple-500",
                            "bg-pink-500",
                            "bg-indigo-500",
                            "bg-orange-500",
                          ][index % 8]
                    }`}
                    style={team ? { backgroundColor: team.color } : undefined}
                  >
                    {participant.nickname.charAt(0).toUpperCase()}
                  </div>

                  {/* Nickname */}
                  <p className="text-xs sm:text-sm font-medium truncate" title={participant.nickname}>
                    {participant.nickname}
                  </p>
                  {team && (
                    <p className="text-[10px] sm:text-xs font-medium" style={{ color: team.color }}>
                      {team.name}
                    </p>
                  )}

                  {/* Kick button */}
                  <button
                    onClick={() => kickPlayer(participant.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive hover:text-white"
                    title="Kick player"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </Card>
              );
            })}
          </div>
        )}

        {/* Instructions */}
        <Card className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-muted/50">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="gradient-accent w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-1 text-blue-900">Host Tips</h3>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
                <li>• Wait for all players to join before starting</li>
                <li>• Lock the room to prevent late joiners</li>
                <li>• Click on a player to kick them if needed</li>
                <li>• Questions will appear on your screen for everyone to see</li>
              </ul>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
