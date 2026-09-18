import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import {
  Play,
  Square,
  Eye,
  ChevronRight,
  Trophy,
  Users,

  CheckCircle2,
  XCircle,
  Loader2,
  Home,
  Download,
  Volume2,
  VolumeX,
  MonitorPlay,
} from "lucide-react";
import { sounds, playSound, initAudio, setMuted, getMuted } from "@/react-app/lib/feedback";
import { useWakeLock } from "@/react-app/hooks/useWakeLock";
import CountdownRing from "@/react-app/components/CountdownRing";
import CountdownAdSlot from "@/react-app/components/CountdownAd";
import StickyWall from "@/react-app/components/StickyWall";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import type {
  SessionInfo,
  CurrentQuestion,
  QuestionResult,
  LeaderboardEntry,
  QuestionOption,
  Question,
  ParticipantInfo,
  TeamStanding,
  StickyNote,
} from "@/shared/types";
import { isOptionType } from "@/shared/types";
import {
  getSession,
  getQuiz,
  openQuestion,
  startCountdown,
  closeQuestion,
  revealQuestion,
  nextQuestion,
  endSession,
  getQuestionResults,
  getLeaderboard,
  subscribeAnswerCount,
  subscribeParticipants,
  computeTeamStandings,
  setGameMode,
  exportSessionCsv,
  subscribeNotes,
  deleteNote,
  closeQuickBoard,
} from "@/react-app/lib/data";
import { Zap, Hand } from "lucide-react";

type GamePhase = "PREVIEW" | "GET_READY" | "QUESTION_OPEN" | "QUESTION_CLOSED" | "REVEAL" | "LEADERBOARD" | "COMPLETE";

export default function HostLiveGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { config, tier, isProUser } = useAppConfig();

  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<CurrentQuestion | null>(null);

  // Keep screen awake during gameplay
  useWakeLock();
  const [results, setResults] = useState<QuestionResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [phase, setPhase] = useState<GamePhase>("PREVIEW");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [isSoundMuted, setIsSoundMuted] = useState(() => getMuted());

  // Which Sticky Wall is live: a standalone Quick Board wins, else a BOARD question.
  const liveBoardId =
    session?.activeBoard?.id ?? (question?.type === "BOARD" ? question.questionId : null);
  const liveBoardPrompt = session?.activeBoard?.prompt ?? question?.prompt ?? "";

  // Only the host subscribes to notes — that's what keeps the wall anonymous to
  // the room (players have no read access) and the fan-out to a single listener.
  useEffect(() => {
    if (!sessionId || !liveBoardId) {
      setNotes([]);
      return;
    }
    return subscribeNotes(sessionId, liveBoardId, setNotes);
  }, [sessionId, liveBoardId]);
  const lastTickTime = useRef<number | null>(null);

  // Build a player-safe current question view from the loaded quiz.
  const buildQuestion = useCallback(
    (index: number, qs: Question[]): CurrentQuestion | null => {
      const q = qs[index];
      if (!q) return null;
      return {
        questionId: q.id,
        questionIndex: index,
        totalQuestions: qs.length,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        durationSeconds: q.durationSeconds,
        basePoints: q.basePoints,
        questionStatus: "CLOSED",
        questionStartedAt: null,
        timeRemainingMs: null,
      };
    },
    []
  );

  // Toggle sound mute
  const toggleMute = () => {
    const newMuted = !isSoundMuted;
    setIsSoundMuted(newMuted);
    setMuted(newMuted);
    if (!newMuted) {
      initAudio();
      playSound(sounds.tap);
    }
  };

  // Initial load
  useEffect(() => {
    if (!sessionId) return;
    const init = async () => {
      setLoading(true);
      try {
        const sess = await getSession(sessionId);
        setSession(sess);
        const quiz = await getQuiz(sess.quizId);
        setQuestions(quiz.questions);
        const index = sess.currentQuestionIndex ?? 0;
        setCurrentIndex(index);
        setQuestion(buildQuestion(index, quiz.questions));

        if (sess.status === "LIVE") {
          if (sess.questionStatus === "OPEN") {
            setPhase("QUESTION_OPEN");
            setTimeRemaining(quiz.questions[index]?.durationSeconds ?? null);
          } else if (sess.questionStatus === "REVEAL") {
            setPhase("REVEAL");
            setResults(await getQuestionResults(sessionId, quiz.questions[index]));
          } else {
            setPhase("PREVIEW");
          }
        } else if (sess.status === "ENDED") {
          setPhase("COMPLETE");
          setLeaderboard(await getLeaderboard(sessionId, 10));
        }
      } catch (e) {
        console.error("Failed to load live game", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [sessionId, buildQuestion]);

  // Realtime: live answer count for the current question + participant count.
  useEffect(() => {
    if (!sessionId || !question) return;
    return subscribeAnswerCount(sessionId, question.questionId, setAnswerCount);
  }, [sessionId, question?.questionId]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeParticipants(sessionId, (players) => {
      setParticipants(players);
      setSession((prev) => (prev ? { ...prev, participantCount: players.length } : prev));
    });
  }, [sessionId]);

  const teamStandings: TeamStanding[] =
    session?.teamMode ? computeTeamStandings(participants, session.teams) : [];

  // Timer countdown when question is open
  useEffect(() => {
    if (phase !== "QUESTION_OPEN" || timeRemaining === null) return;

    if (timeRemaining <= 0) {
      playSound(sounds.timeUp);
      handleCloseQuestion();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((t) => {
        if (t !== null && t > 0) {
          const newTime = t - 1;
          // Play tick sounds for last 5 seconds
          if (newTime <= 5 && newTime > 0 && newTime !== lastTickTime.current) {
            lastTickTime.current = newTime;
            if (newTime <= 3) {
              playSound(sounds.tickUrgent);
            } else {
              playSound(sounds.tick);
            }
          }
          return newTime;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeRemaining]);

  // Actions
  const handleOpenQuestion = async () => {
    if (!sessionId || !question) return;
    setActionLoading(true);
    initAudio();
    playSound(sounds.gameStart);
    try {
      await openQuestion(sessionId);
      setPhase("QUESTION_OPEN");
      setTimeRemaining(question.durationSeconds);
      setAnswerCount(0);
      setResults(null);
      lastTickTime.current = null;
    } finally {
      setActionLoading(false);
    }
  };

  // Kick off the "get ready" countdown; players see the synced animated timer.
  const handleStartCountdown = async () => {
    if (!sessionId) return;
    initAudio();
    playSound(sounds.gameStart);
    setCountdownRemaining(session?.getReadySeconds ?? 10);
    setPhase("GET_READY");
    try {
      await startCountdown(sessionId);
    } catch {
      /* the countdown still runs locally; players just won't sync */
    }
  };

  // Drive the get-ready countdown and auto-open the question when it ends.
  useEffect(() => {
    if (phase !== "GET_READY") return;
    const total = session?.getReadySeconds ?? 10;
    const started = Date.now();
    lastTickTime.current = null;
    const id = setInterval(() => {
      const rem = total - (Date.now() - started) / 1000;
      if (rem <= 0) {
        clearInterval(id);
        setCountdownRemaining(0);
        handleOpenQuestion();
        return;
      }
      const whole = Math.ceil(rem);
      if (whole <= 3 && whole !== lastTickTime.current) {
        lastTickTime.current = whole;
        playSound(sounds.tick);
      }
      setCountdownRemaining(rem);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleCloseQuestion = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    try {
      await closeQuestion(sessionId);
      setPhase("QUESTION_CLOSED");
      setTimeRemaining(null);
      setResults(await getQuestionResults(sessionId, questions[currentIndex]));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevealAnswer = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    playSound(sounds.rankReveal);
    try {
      await revealQuestion(sessionId, questions);
      setPhase("REVEAL");
      setResults(await getQuestionResults(sessionId, questions[currentIndex]));
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowLeaderboard = async () => {
    if (!sessionId) return;
    playSound(sounds.points);
    setPhase("LEADERBOARD");
    setLeaderboard(await getLeaderboard(sessionId, 10));
  };

  const handleNextQuestion = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    playSound(sounds.questionAppear);
    try {
      const { isComplete, questionIndex } = await nextQuestion(sessionId, questions);
      if (isComplete) {
        setPhase("COMPLETE");
        playSound(sounds.gameOver);
        setLeaderboard(await getLeaderboard(sessionId, 10));
      } else {
        setCurrentIndex(questionIndex);
        setQuestion(buildQuestion(questionIndex, questions));
        setPhase("PREVIEW");
        setResults(null);
        setAnswerCount(0);
        lastTickTime.current = null;
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndGame = async () => {
    if (sessionId) await endSession(sessionId);
    navigate("/host");
  };

  const isAuto = session?.gameMode === "auto";

  const toggleMode = async () => {
    if (!sessionId || !session) return;
    const next: "manual" | "auto" = isAuto ? "manual" : "auto";
    if (next === "auto" && !isProUser) {
      return; // Pro-gated; the toggle is hidden for non-Pro anyway.
    }
    setSession({ ...session, gameMode: next });
    try {
      await setGameMode(sessionId, next);
    } catch {
      /* ignore */
    }
  };

  // AUTO MODE: advance the game without host clicks. Each phase schedules the
  // next action; switching to manual (or a manual click) cancels the timer.
  useEffect(() => {
    if (!isAuto) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === "PREVIEW") t = setTimeout(() => handleStartCountdown(), 1200);
    else if (phase === "QUESTION_CLOSED") t = setTimeout(() => handleRevealAnswer(), 2500);
    else if (phase === "REVEAL") t = setTimeout(() => handleNextQuestion(), 5000);
    return () => {
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isAuto]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-teal-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-teal-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg">{session?.quizTitle}</span>
            <span className="text-white/60">PIN: {session?.gamePin}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white/80">
              <Users className="w-4 h-4" />
              <span>{session?.participantCount} players</span>
            </div>
            {question && (
              <span className="text-white/60">
                Q{question.questionIndex + 1}/{question.totalQuestions}
              </span>
            )}
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title={isSoundMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {isSoundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {sessionId && (
              <button
                onClick={() => window.open(`/display/${sessionId}`, "_blank")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="Open the audience screen for your projector"
              >
                <MonitorPlay className="w-5 h-5" />
              </button>
            )}
            {(isAuto || isProUser) && phase !== "COMPLETE" && (
              <button
                onClick={toggleMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  isAuto ? "bg-yellow-400 text-neutral-900" : "bg-white/10 hover:bg-white/20"
                }`}
                title={isAuto ? "Switch to manual control" : "Let the game run automatically"}
              >
                {isAuto ? <Zap className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
                {isAuto ? "Auto" : "Manual"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Get-ready countdown */}
        {phase === "GET_READY" && question && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="uppercase tracking-[0.2em] text-white/50 mb-6 text-sm">Get ready…</p>
            <CountdownRing total={session?.getReadySeconds ?? 10} remaining={countdownRemaining} size={220} className="text-yellow-300" />
            <h2 className="mt-8 text-3xl font-bold">
              Question {question.questionIndex + 1} of {question.totalQuestions}
            </h2>
            <p className="text-white/60 mt-2">Everyone, grab your phones!</p>
            <div className="mt-8 w-full">
              <CountdownAdSlot sessionAd={session?.ad} defaultAd={config.defaultAd} dark />
            </div>
          </div>
        )}

        {/* Sticky Wall — the big screen. A Quick Board overrides the quiz flow. */}
        {liveBoardId && sessionId && (
          <div className="h-[calc(100vh-15rem)] min-h-[420px]">
            <StickyWall
              prompt={liveBoardPrompt}
              notes={notes}
              maxNotes={config.limits.wallMaxNotes[tier]}
              onDelete={(id) => deleteNote(sessionId, id).catch(() => {})}
            />
            {session?.activeBoard && (
              <div className="mt-3 text-center">
                <Button
                  variant="outline"
                  onClick={() => closeQuickBoard(sessionId).catch(() => {})}
                  className="rounded-xl"
                >
                  Close board
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Question Preview / Active / Reveal */}
        {!liveBoardId &&
          (phase === "PREVIEW" || phase === "QUESTION_OPEN" || phase === "QUESTION_CLOSED" || phase === "REVEAL") && question && (
          <div className="space-y-8">
            {/* Timer */}
            {phase === "QUESTION_OPEN" && timeRemaining !== null && (
              <div className="flex justify-center">
                <div className={`
                  w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold
                  ${timeRemaining <= 5 ? "bg-red-500/30 text-red-300 animate-pulse" : "bg-white/10"}
                `}>
                  {timeRemaining}
                </div>
              </div>
            )}

            {/* Question */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="text-center mb-2 text-white/60 text-sm uppercase tracking-wide">
                {question.type === "MCQ" && "Multiple Choice"}
                {question.type === "TF" && "True or False"}
                {question.type === "MULTI" && "Select All That Apply"}
                {question.type === "SHORT" && "Type the Answer"}
                {question.type === "NUMERIC" && "Numeric Answer"}
              </div>
              <h2 className="text-4xl font-bold text-center mb-4">{question.prompt}</h2>
              {question.imageUrl && (
                <img src={question.imageUrl} alt="" className="mx-auto max-h-56 rounded-xl object-contain mb-6" />
              )}

              {isOptionType(question.type) ? (
                /* Options Grid */
                <div className="grid grid-cols-2 gap-4">
                  {question.options.map((opt, idx) => (
                    <OptionCard
                      key={opt.id}
                      option={opt}
                      index={idx}
                      isCorrect={results?.correctAnswers.includes(opt.id)}
                      showResult={["QUESTION_CLOSED", "REVEAL"].includes(phase)}
                      count={results?.answerDistribution.find((d) => d.optionId === opt.id)?.count}
                      percentage={results?.answerDistribution.find((d) => d.optionId === opt.id)?.percentage}
                      highlight={phase === "REVEAL" as GamePhase}
                    />
                  ))}
                </div>
              ) : question.type === "ORDER" ? (
                <div className="max-w-md mx-auto text-left">
                  {(["QUESTION_CLOSED", "REVEAL"] as GamePhase[]).includes(phase) ? (
                    <div className="space-y-2">
                      <div className="text-white/60 text-sm uppercase tracking-wide text-center mb-2">
                        Correct order
                      </div>
                      {(questions[currentIndex]?.correctAnswers || []).map((id, i) => {
                        const opt = questions[currentIndex]?.options.find((o) => o.id === id);
                        return (
                          <div key={id} className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                            <span className="w-7 h-7 rounded-lg bg-green-500/30 flex items-center justify-center font-bold">
                              {i + 1}
                            </span>
                            <span className="font-semibold">{opt?.text ?? id}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-white/50 text-lg py-6 text-center">🔀 Players are arranging the items…</div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  {(["QUESTION_CLOSED", "REVEAL"] as GamePhase[]).includes(phase) ? (
                    <div className="inline-block bg-green-500/20 border-2 border-green-400/50 rounded-2xl px-8 py-5">
                      <div className="text-white/60 text-sm uppercase tracking-wide mb-1">
                        Correct answer{(questions[currentIndex]?.correctAnswers.length ?? 0) > 1 ? "s" : ""}
                      </div>
                      <div className="text-3xl font-bold">
                        {(questions[currentIndex]?.correctAnswers || []).join(", ")}
                        {question.type === "NUMERIC" && (questions[currentIndex]?.numericTolerance ?? 0) > 0 &&
                          ` (± ${questions[currentIndex]?.numericTolerance})`}
                      </div>
                    </div>
                  ) : (
                    <div className="text-white/50 text-lg py-6">✍️ Players are typing their answers…</div>
                  )}
                </div>
              )}
            </div>

            {/* Answer Count */}
            {phase === "QUESTION_OPEN" && (
              <div className="text-center">
                <span className="text-2xl font-bold">{answerCount}</span>
                <span className="text-white/60 ml-2">answers received</span>
              </div>
            )}

            {/* Results Summary */}
            {(["QUESTION_CLOSED", "REVEAL"] as GamePhase[]).includes(phase) && results && (
              <div className="flex justify-center gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-green-400">{results.correctCount}</div>
                  <div className="text-white/60">Correct</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-400">{results.totalAnswers - results.correctCount}</div>
                  <div className="text-white/60">Incorrect</div>
                </div>
                {results.averageTimeMs && (
                  <div>
                    <div className="text-3xl font-bold">{(results.averageTimeMs / 1000).toFixed(1)}s</div>
                    <div className="text-white/60">Avg Time</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {phase === "LEADERBOARD" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Leaderboard
            </h2>
            {session?.teamMode && <TeamStandingsCard standings={teamStandings} />}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <LeaderboardRow key={entry.participantId} entry={entry} />
                ))}
                {leaderboard.length === 0 && (
                  <p className="text-center text-white/60 py-8">No scores yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Game Complete */}
        {phase === "COMPLETE" && (
          <div className="space-y-8 text-center">
            <div>
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-4xl font-bold mb-2">Game Complete!</h2>
              <p className="text-white/60">Final Results</p>
            </div>

            {session?.teamMode && (
              <div className="text-left">
                <h3 className="text-xl font-bold mb-3 text-center">🏆 Winning Team</h3>
                <TeamStandingsCard standings={teamStandings} />
              </div>
            )}

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="space-y-3">
                {leaderboard.slice(0, 3).map((entry) => (
                  <LeaderboardRow key={entry.participantId} entry={entry} showTrophy />
                ))}
              </div>
            </div>

            {leaderboard.length > 3 && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="space-y-2">
                  {leaderboard.slice(3).map((entry) => (
                    <LeaderboardRow key={entry.participantId} entry={entry} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Control Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-md border-t border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4">
          {phase === "PREVIEW" && (
            <Button
              size="lg"
              onClick={handleStartCountdown}
              disabled={actionLoading}
              className="bg-green-500 hover:bg-green-600 text-white px-8"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Question ({session?.getReadySeconds ?? 10}s get-ready)
            </Button>
          )}

          {phase === "GET_READY" && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleOpenQuestion}
              disabled={actionLoading}
              className="border-white/30 text-white hover:bg-white/10 px-8"
            >
              <ChevronRight className="w-5 h-5 mr-2" />
              Skip — open question now
            </Button>
          )}

          {phase === "QUESTION_OPEN" && (
            <Button
              size="lg"
              onClick={handleCloseQuestion}
              disabled={actionLoading}
              className="bg-red-500 hover:bg-red-600 text-white px-8"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 mr-2" />}
              End Answering
            </Button>
          )}

          {phase === "QUESTION_CLOSED" && (
            <Button
              size="lg"
              onClick={handleRevealAnswer}
              disabled={actionLoading}
              className="bg-purple-500 hover:bg-purple-600 text-white px-8"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5 mr-2" />}
              Reveal Answer
            </Button>
          )}

          {phase === "REVEAL" && (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={handleShowLeaderboard}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Show Leaderboard
              </Button>
              <Button
                size="lg"
                onClick={handleNextQuestion}
                disabled={actionLoading}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-8"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Next Question
              </Button>
            </>
          )}

          {phase === "LEADERBOARD" && (
            <Button
              size="lg"
              onClick={handleNextQuestion}
              disabled={actionLoading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5 mr-2" />}
              Next Question
            </Button>
          )}

          {phase === "COMPLETE" && (
            <>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => sessionId && exportSessionCsv(sessionId)}
              >
                <Download className="w-5 h-5 mr-2" />
                Download Results
              </Button>
              <Button
                size="lg"
                onClick={handleEndGame}
                className="bg-white text-green-900 hover:bg-white/90 px-8"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

// Option Card Component
function OptionCard({
  option,
  index,
  isCorrect,
  showResult,
  count,
  percentage,
  highlight,
}: {
  option: QuestionOption;
  index: number;
  isCorrect?: boolean;
  showResult?: boolean;
  count?: number;
  percentage?: number;
  highlight?: boolean;
}) {
  const colors = [
    "from-red-500 to-red-600",
    "from-blue-500 to-blue-600",
    "from-yellow-500 to-yellow-600",
    "from-green-500 to-green-600",
  ];

  const bgColor = colors[index % colors.length];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl p-6 bg-gradient-to-br ${bgColor}
        ${highlight && isCorrect ? "ring-4 ring-white shadow-lg shadow-white/30" : ""}
        ${highlight && !isCorrect ? "opacity-50" : ""}
        transition-all duration-300
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold">{option.text}</span>
        {showResult && (
          <div className="flex items-center gap-2">
            {isCorrect ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : highlight ? (
              <XCircle className="w-6 h-6 text-white/70" />
            ) : null}
          </div>
        )}
      </div>

      {showResult && count !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{count} answers</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/80 rounded-full transition-all duration-500"
              style={{ width: `${percentage || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Team Standings Card
function TeamStandingsCard({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" /> Team Standings
      </h3>
      <div className="space-y-3">
        {standings.map((s) => (
          <div
            key={s.team.id}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ backgroundColor: `${s.team.color}22` }}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-xl font-bold text-white/60">{s.rank}</span>
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: s.team.color }} />
              <span className="text-lg font-semibold">
                {s.team.name}
                <span className="text-white/50 text-sm ml-1">({s.memberCount})</span>
              </span>
            </div>
            <span className="text-2xl font-bold">{s.totalPoints.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Leaderboard Row Component
function LeaderboardRow({
  entry,
  showTrophy = false,
  compact = false,
}: {
  entry: LeaderboardEntry;
  showTrophy?: boolean;
  compact?: boolean;
}) {
  const trophyColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-4 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-6 text-white/60">{entry.rank}</span>
          <span className="truncate">
            {entry.nickname}
            {entry.lga && <span className="text-white/40"> — {entry.lga}</span>}
          </span>
        </div>
        <span className="font-semibold shrink-0 ml-2">{entry.totalPoints.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div className={`
      flex items-center justify-between p-4 rounded-xl
      ${entry.rank === 1 ? "bg-yellow-500/20" : entry.rank === 2 ? "bg-gray-400/20" : entry.rank === 3 ? "bg-amber-600/20" : "bg-white/5"}
    `}>
      <div className="flex items-center gap-4">
        {showTrophy && entry.rank <= 3 ? (
          <Trophy className={`w-8 h-8 ${trophyColors[entry.rank]}`} />
        ) : (
          <span className="w-8 h-8 flex items-center justify-center text-2xl font-bold text-white/60">
            {entry.rank}
          </span>
        )}
        <span className="text-xl font-semibold">
          {entry.nickname}
          {entry.lga && <span className="text-white/40 text-base font-normal"> — {entry.lga}</span>}
        </span>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold">{entry.totalPoints.toLocaleString()}</div>
        {entry.lastAnswerPoints !== null && entry.lastAnswerPoints > 0 && (
          <div className="text-sm text-green-400">+{entry.lastAnswerPoints}</div>
        )}
      </div>
    </div>
  );
}
