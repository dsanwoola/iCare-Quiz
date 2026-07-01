import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { Zap, Clock, Trophy, CheckCircle2, XCircle, Wifi, WifiOff, Loader2, Star, Medal, Volume2, VolumeX } from "lucide-react";
import type { CurrentQuestion, AnswerResult, LeaderboardEntry, Team, QuestionOption } from "@/shared/types";
import { isOptionType } from "@/shared/types";
import { ArrowUp, ArrowDown } from "lucide-react";
import { sounds, playSound, initAudio, setMuted, getMuted } from "@/react-app/lib/feedback";
import { useWakeLock } from "@/react-app/hooks/useWakeLock";
import {
  subscribeSessionRaw,
  subscribeLeaderboard,
  currentQuestionFromSession,
  submitAnswer as submitAnswerApi,
  getMyAnswerResult,
  ensurePlayerAuth,
  computeTeamStandings,
} from "@/react-app/lib/data";

type GamePhase = "WAITING" | "QUESTION" | "ANSWERED" | "RESULT" | "COMPLETE";

export default function PlayerGame() {
  const { gamePin } = useParams();
  const navigate = useNavigate();

  const [nickname] = useState(() => sessionStorage.getItem("nickname") || "Player");
  const [sessionId] = useState(() => sessionStorage.getItem("sessionId"));
  const [participantId] = useState(() => sessionStorage.getItem("participantId"));

  const [phase, setPhase] = useState<GamePhase>("WAITING");
  const [question, setQuestion] = useState<CurrentQuestion | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [orderItems, setOrderItems] = useState<QuestionOption[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(() => getMuted());

  const [authReady, setAuthReady] = useState(false);
  const questionStartTime = useRef<number | null>(null);
  const lastQuestionId = useRef<string | null>(null);
  const resultLoadedFor = useRef<string | null>(null);

  // Establish (or restore) the player's anonymous identity before reading data.
  useEffect(() => {
    let cancelled = false;
    ensurePlayerAuth()
      .then(() => !cancelled && setAuthReady(true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep screen awake during gameplay
  useWakeLock();
  const lastTickTime = useRef<number | null>(null);
  const hasPlayedQuestionSound = useRef(false);
  const hasPlayedResultSound = useRef(false);
  const hasPlayedGameOverSound = useRef(false);

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

  // Realtime leaderboard — keeps the header score and final standings live.
  useEffect(() => {
    if (!sessionId || !authReady) return;
    return subscribeLeaderboard(sessionId, (entries) => {
      setLeaderboard(entries);
      const me = entries.find((e) => e.participantId === participantId);
      if (me) {
        setRank(me.rank);
        setTotalPoints(me.totalPoints);
      }
    });
  }, [sessionId, participantId, authReady]);

  // Realtime game state via the session document (replaces SSE polling).
  useEffect(() => {
    if (!sessionId || !participantId) {
      navigate("/join");
      return;
    }
    if (!authReady) return;

    const unsub = subscribeSessionRaw(sessionId, (data) => {
      if (!data) {
        setIsConnected(false);
        return;
      }
      setIsConnected(true);
      setTeamMode(!!data.teamMode);
      setTeams((data.teams || []) as Team[]);

      if (data.status === "ENDED") {
        setPhase((p) => (p === "COMPLETE" ? p : "COMPLETE"));
        return;
      }

      const cq = currentQuestionFromSession(data);
      if (!cq) return;

      // New question detected — reset per-question state.
      if (cq.questionId !== lastQuestionId.current) {
        lastQuestionId.current = cq.questionId;
        setQuestion(cq);
        setSelectedAnswers([]);
        setTypedAnswer("");
        setOrderItems(cq.options);
        setAnswerResult(null);
        questionStartTime.current = Date.now();
        hasPlayedQuestionSound.current = false;
        hasPlayedResultSound.current = false;
        setPhase(cq.questionStatus === "OPEN" ? "QUESTION" : "WAITING");
      } else {
        setQuestion(cq);
      }

      if (cq.questionStatus === "OPEN") {
        setPhase((currentPhase) => {
          if (currentPhase === "WAITING") {
            if (!hasPlayedQuestionSound.current) {
              hasPlayedQuestionSound.current = true;
              playSound(sounds.questionAppear);
            }
            return "QUESTION";
          }
          return currentPhase;
        });
        if (cq.timeRemainingMs !== null) {
          setTimeRemaining(Math.ceil(cq.timeRemainingMs / 1000));
        }
      } else if (cq.questionStatus === "REVEAL") {
        setPhase((p) => (p === "COMPLETE" ? p : "RESULT"));
        // Load our graded result once per question.
        const revealed: string[] = data.revealedAnswers || [];
        if (resultLoadedFor.current !== cq.questionId) {
          resultLoadedFor.current = cq.questionId;
          getMyAnswerResult(sessionId, cq.questionId, revealed)
            .then((res) => res && setAnswerResult(res))
            .catch(() => {});
        }
      } else if (cq.questionStatus === "CLOSED") {
        setPhase((currentPhase) => (currentPhase === "QUESTION" ? "ANSWERED" : currentPhase));
      }
    });

    return unsub;
  }, [sessionId, participantId, navigate, authReady]);

  // Timer countdown with sound effects
  useEffect(() => {
    if (phase !== "QUESTION" || timeRemaining === null || timeRemaining <= 0) return;

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
          // Time's up sound
          if (newTime === 0) {
            playSound(sounds.timeUp);
          }
          return newTime;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeRemaining]);

  // Show points animation and play result sounds
  useEffect(() => {
    if (answerResult && !hasPlayedResultSound.current) {
      hasPlayedResultSound.current = true;
      if (answerResult.isCorrect) {
        playSound(sounds.correct);
        if (answerResult.pointsAwarded > 0) {
          setTimeout(() => playSound(sounds.points), 300);
        }
      } else {
        playSound(sounds.wrong);
      }
    }
  }, [answerResult]);

  // Game over sound
  useEffect(() => {
    if (phase === "COMPLETE" && !hasPlayedGameOverSound.current) {
      hasPlayedGameOverSound.current = true;
      playSound(sounds.gameOver);
    }
  }, [phase]);

  const handleSelectOption = async (optionId: string) => {
    if (phase !== "QUESTION" || isSubmitting) return;
    
    initAudio(); // Ensure audio is initialized on user interaction
    playSound(sounds.select);

    const isMultiSelect = question?.type === "MULTI";

    let newSelection: string[];
    if (isMultiSelect) {
      if (selectedAnswers.includes(optionId)) {
        newSelection = selectedAnswers.filter((id) => id !== optionId);
      } else {
        newSelection = [...selectedAnswers, optionId];
      }
      setSelectedAnswers(newSelection);
    } else {
      newSelection = [optionId];
      setSelectedAnswers(newSelection);
      await submitAnswer(newSelection);
    }
  };

  const handleSubmitMulti = async () => {
    if (selectedAnswers.length === 0 || isSubmitting) return;
    playSound(sounds.tap);
    await submitAnswer(selectedAnswers);
  };

  const submitTyped = async () => {
    if (!typedAnswer.trim() || isSubmitting) return;
    playSound(sounds.tap);
    await submitAnswer([typedAnswer.trim()]);
  };

  const moveOrderItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= orderItems.length) return;
    const next = [...orderItems];
    [next[i], next[j]] = [next[j], next[i]];
    setOrderItems(next);
    playSound(sounds.select);
  };

  const submitOrder = async () => {
    if (isSubmitting) return;
    playSound(sounds.tap);
    await submitAnswer(orderItems.map((o) => o.id));
  };

  const submitAnswer = async (answers: string[]) => {
    if (!sessionId || !participantId || !question) return;

    setIsSubmitting(true);
    const answerTimeMs = questionStartTime.current
      ? Date.now() - questionStartTime.current
      : question.durationSeconds * 1000;

    try {
      // Answers are recorded now and graded by the host on reveal — this keeps
      // the correct answers off the player's device.
      await submitAnswerApi(sessionId, question.questionId, answers, answerTimeMs);
      setPhase("ANSWERED");
    } catch (err) {
      console.error("Failed to submit answer", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!sessionId || !participantId) {
      navigate("/join");
    }
  }, [sessionId, participantId, navigate]);

  const optionStyles = [
    { bg: "from-rose-500 to-red-600", shadow: "shadow-rose-500/30" },
    { bg: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/30" },
    { bg: "from-amber-400 to-orange-500", shadow: "shadow-amber-500/30" },
    { bg: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/30" },
  ];

  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (position === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (position === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center font-bold text-white/60">{position}</span>;
  };

  const myEntry = leaderboard.find((e) => e.participantId === participantId);
  const myTeam = teamMode && myEntry?.teamId ? teams.find((t) => t.id === myEntry.teamId) ?? null : null;
  const teamStandings = teamMode
    ? computeTeamStandings(
        leaderboard.map((e) => ({
          id: e.participantId,
          nickname: e.nickname,
          role: "PLAYER",
          totalPoints: e.totalPoints,
          streak: e.streak,
          currentRank: e.rank,
          isKicked: false,
          teamId: e.teamId,
        })),
        teams
      )
    : [];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white safe-area-inset">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between border-b border-white/10 safe-area-top">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-yellow-500/30 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-lg leading-tight truncate">{nickname}</div>
            {myTeam ? (
              <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: myTeam.color }} />
                <span style={{ color: myTeam.color }} className="font-semibold">{myTeam.name} Team</span>
              </div>
            ) : (
              <div className="text-[10px] sm:text-xs text-white/50">PIN: {gamePin}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right bg-white/10 rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2">
            <div className="text-base sm:text-xl font-black tabular-nums">{totalPoints.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">points</div>
          </div>
          <button
            onClick={toggleMute}
            className={`p-2 rounded-full transition-colors ${isSoundMuted ? 'bg-white/10 text-white/50' : 'bg-white/20 text-white'}`}
            aria-label={isSoundMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isSoundMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <div className={`p-2 rounded-full ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-3 sm:p-4 pb-6 sm:pb-8">
        {/* Waiting for question */}
        {phase === "WAITING" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-white/80 border-t-transparent animate-spin" style={{ animationDuration: '1s' }} />
              <div className="absolute inset-4 rounded-full border-2 border-purple-400/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Star className="w-8 h-8 sm:w-12 sm:h-12 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-2 sm:mb-3">Get Ready!</h2>
            <p className="text-white/60 text-base sm:text-lg">Next question incoming...</p>
            {question && (
              <div className="mt-4 sm:mt-6 bg-white/10 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-sm sm:text-base">
                <span className="text-white/70">Question </span>
                <span className="font-bold">{question.questionIndex + 1}</span>
                <span className="text-white/70"> of </span>
                <span className="font-bold">{question.totalQuestions}</span>
              </div>
            )}
          </div>
        )}

        {/* Question active */}
        {phase === "QUESTION" && question && (
          <div className="flex-1 flex flex-col">
            {/* Timer and Question progress row */}
            <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
              <div
                className={`
                  relative w-12 h-12 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shrink-0
                  ${timeRemaining !== null && timeRemaining <= 5 
                    ? "bg-gradient-to-br from-red-500/40 to-red-600/40 animate-pulse" 
                    : "bg-white/10"
                  }
                  backdrop-blur-sm border-2 border-white/20 shadow-xl
                `}
              >
                <Clock className={`absolute top-0.5 sm:top-1.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${timeRemaining !== null && timeRemaining <= 5 ? 'text-red-300' : 'text-white/40'}`} />
                <span className={`text-xl sm:text-3xl font-black tabular-nums ${timeRemaining !== null && timeRemaining <= 5 ? 'text-red-200' : ''}`}>
                  {timeRemaining ?? "—"}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                <span className="text-white/70">Question</span>
                <span className="font-bold">{question.questionIndex + 1}/{question.totalQuestions}</span>
              </div>
            </div>

            {/* Question text */}
            <div className="text-center mb-3 sm:mb-5 px-2">
              <h2 className="text-xl sm:text-3xl font-bold leading-snug">{question.prompt}</h2>
              {question.imageUrl && (
                <img
                  src={question.imageUrl}
                  alt=""
                  className="mt-3 mx-auto max-h-40 sm:max-h-52 rounded-xl object-contain"
                />
              )}
            </div>

            {/* Options grid */}
            {isOptionType(question.type) && (
            <div className="flex-1 flex flex-col gap-1.5 sm:gap-3">
              {question.options.map((opt, idx) => {
                const isSelected = selectedAnswers.includes(opt.id);
                const style = optionStyles[idx % optionStyles.length];
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    disabled={isSubmitting}
                    className={`
                      relative overflow-hidden rounded-lg sm:rounded-2xl p-3 sm:p-5 text-left font-bold text-sm sm:text-xl
                      bg-gradient-to-br ${style.bg}
                      shadow-lg ${style.shadow}
                      transition-all duration-150 
                      active:scale-[0.97] active:brightness-90
                      ${isSelected ? "ring-2 sm:ring-4 ring-white scale-[1.01] brightness-110" : ""}
                      ${isSubmitting ? "opacity-60 pointer-events-none" : ""}
                      min-h-[44px] sm:min-h-[68px] flex items-center
                    `}
                  >
                    <span className="flex-1 pr-5 sm:pr-8 break-words leading-tight">{opt.text}</span>
                    {isSelected && (
                      <div className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 bg-white/30 rounded-full p-0.5 sm:p-1">
                        <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* Ordering (ORDER) */}
            {question.type === "ORDER" && (
              <div className="flex-1 flex flex-col gap-2">
                <p className="text-center text-white/60 text-sm mb-1">Tap the arrows to arrange in order</p>
                {orderItems.map((opt, i) => (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 rounded-lg sm:rounded-2xl p-3 sm:p-4 bg-white/15 border-2 border-white/25"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-semibold text-sm sm:text-lg break-words">{opt.text}</span>
                    <div className="flex flex-col">
                      <button onClick={() => moveOrderItem(i, -1)} disabled={i === 0} className="disabled:opacity-30">
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => moveOrderItem(i, 1)}
                        disabled={i === orderItems.length - 1}
                        className="disabled:opacity-30"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className="mt-2 bg-white text-indigo-900 font-black text-base sm:text-xl py-3 sm:py-5 rounded-lg sm:rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-white/20 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      Submit Order
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Typed answer (SHORT / NUMERIC) */}
            {!isOptionType(question.type) && question.type !== "ORDER" && (
              <div className="flex-1 flex flex-col justify-center gap-4">
                <input
                  type={question.type === "NUMERIC" ? "number" : "text"}
                  inputMode={question.type === "NUMERIC" ? "decimal" : "text"}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTyped()}
                  placeholder={question.type === "NUMERIC" ? "Enter a number" : "Type your answer"}
                  disabled={isSubmitting}
                  autoFocus
                  className="w-full text-center text-xl sm:text-3xl font-bold rounded-2xl px-4 py-5 sm:py-7 bg-white/15 border-2 border-white/30 text-white placeholder:text-white/40 focus:outline-none focus:border-white"
                />
                <button
                  onClick={submitTyped}
                  disabled={isSubmitting || !typedAnswer.trim()}
                  className="bg-white text-indigo-900 font-black text-base sm:text-xl py-3 sm:py-5 rounded-lg sm:rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-white/20 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      Submit Answer
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Submit button for multi-select */}
            {question.type === "MULTI" && selectedAnswers.length > 0 && (
              <button
                onClick={handleSubmitMulti}
                disabled={isSubmitting}
                className="mt-3 sm:mt-5 bg-white text-indigo-900 font-black text-sm sm:text-xl py-3 sm:py-5 rounded-lg sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-xl shadow-white/20 active:scale-[0.98] transition-transform"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    Submit ({selectedAnswers.length} selected)
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Answered - waiting for reveal */}
        {phase === "ANSWERED" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/30 flex items-center justify-center mb-6 sm:mb-8 animate-pulse border-2 border-green-400/30">
                <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-400" />
              </div>
              {/* Ripple effect */}
              <div className="absolute inset-0 rounded-full border-2 border-green-400/50 animate-ping" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-2 sm:mb-3">Locked In!</h2>
            <p className="text-white/60 text-base sm:text-lg">Waiting for the reveal...</p>
          </div>
        )}

        {/* Result reveal */}
        {phase === "RESULT" && (
          <div className="flex-1 flex flex-col px-2 sm:px-4">
            {/* Result header - compact */}
            <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
              {answerResult ? (
                <>
                  <div
                    className={`
                      w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0
                      ${answerResult.isCorrect 
                        ? "bg-gradient-to-br from-green-400/40 to-emerald-500/40 border-2 border-green-400/50" 
                        : "bg-gradient-to-br from-red-500/40 to-rose-600/40 border-2 border-red-400/50"
                      }
                    `}
                  >
                    {answerResult.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 sm:w-8 sm:h-8 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 sm:w-8 sm:h-8 text-red-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <h2 className={`text-lg sm:text-2xl font-black ${answerResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                      {answerResult.isCorrect ? "Correct!" : "Wrong!"}
                    </h2>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70">
                      {answerResult.pointsAwarded > 0 && (
                        <span className="text-green-400 font-bold">+{answerResult.pointsAwarded}</span>
                      )}
                      <span>Score: {answerResult.totalPoints.toLocaleString()}</span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                        #{answerResult.rank}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-orange-500/40 to-amber-600/40 flex items-center justify-center shrink-0 border-2 border-orange-400/50">
                    <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg sm:text-2xl font-black text-orange-400">Time's Up!</h2>
                    <p className="text-white/60 text-xs sm:text-sm">You didn't answer in time</p>
                  </div>
                </>
              )}
            </div>

            {/* Question text */}
            {question && (
              <>
                <div className="text-center mb-3 sm:mb-4 px-2">
                  <h3 className="text-base sm:text-xl font-bold leading-snug">{question.prompt}</h3>
                  {question.imageUrl && (
                    <img src={question.imageUrl} alt="" className="mt-2 mx-auto max-h-28 sm:max-h-36 rounded-xl object-contain" />
                  )}
                </div>

                {/* Ordering result */}
                {question.type === "ORDER" && (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-xs uppercase tracking-wider text-white/60">Correct order</div>
                    {(answerResult?.correctAnswers || []).map((id, i) => {
                      const opt = question.options.find((o) => o.id === id);
                      const correctHere = orderItems.findIndex((o) => o.id === id) === i;
                      return (
                        <div
                          key={id}
                          className={`flex items-center gap-2 rounded-xl p-3 border-2 ${
                            correctHere ? "bg-green-500/15 border-green-400/50" : "bg-red-500/10 border-red-400/40"
                          }`}
                        >
                          <span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm">
                            {i + 1}
                          </span>
                          <span className="flex-1 font-semibold text-sm sm:text-base">{opt?.text ?? id}</span>
                          {correctHere ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Typed-answer result (SHORT / NUMERIC) */}
                {!isOptionType(question.type) && question.type !== "ORDER" && (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="rounded-xl p-4 bg-green-500/20 border-2 border-green-400/60">
                      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">
                        Correct answer{(answerResult?.correctAnswers.length ?? 0) > 1 ? "s" : ""}
                      </div>
                      <div className="text-lg font-bold">{(answerResult?.correctAnswers || []).join(", ")}</div>
                    </div>
                    {typedAnswer && (
                      <div
                        className={`rounded-xl p-4 border-2 ${
                          answerResult?.isCorrect
                            ? "bg-green-500/10 border-green-400/40"
                            : "bg-red-500/10 border-red-400/40"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Your answer</div>
                        <div className="text-lg font-bold">{typedAnswer}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Options with correct answers highlighted */}
                {isOptionType(question.type) && (
                <div className="flex-1 flex flex-col gap-1.5 sm:gap-2">
                  {question.options.map((opt) => {
                    const isCorrect = answerResult?.correctAnswers.includes(opt.id);
                    const wasSelected = selectedAnswers.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={`
                          relative rounded-lg sm:rounded-xl p-3 sm:p-4 text-left font-semibold text-sm sm:text-base
                          ${isCorrect 
                            ? "bg-gradient-to-br from-green-500/30 to-emerald-600/30 border-2 border-green-400/60" 
                            : wasSelected 
                              ? "bg-gradient-to-br from-red-500/30 to-rose-600/30 border-2 border-red-400/60"
                              : "bg-white/10 border border-white/20"
                          }
                          min-h-[40px] sm:min-h-[52px] flex items-center
                        `}
                      >
                        <span className="flex-1 pr-8 break-words leading-tight">{opt.text}</span>
                        {isCorrect && (
                          <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                          </div>
                        )}
                        {!isCorrect && wasSelected && (
                          <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2">
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Game complete */}
        {phase === "COMPLETE" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-4 sm:py-6">
            <div className="relative mb-6 sm:mb-8">
              <Trophy className="w-16 h-16 sm:w-24 sm:h-24 text-yellow-400" />
              <div className="absolute inset-0 animate-ping">
                <Trophy className="w-16 h-16 sm:w-24 sm:h-24 text-yellow-400/30" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black mb-1 sm:mb-2">Game Over!</h2>
            <p className="text-white/60 text-base sm:text-lg mb-6 sm:mb-8">Final Results</p>

            <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-sm mb-6 sm:mb-8 border border-white/10 shadow-2xl">
              <div className="text-xs sm:text-sm text-white/50 uppercase tracking-wider mb-1.5 sm:mb-2">Your Final Score</div>
              <div className="text-3xl sm:text-5xl font-black mb-3 sm:mb-4 tabular-nums">{totalPoints.toLocaleString()}</div>
              {rank && (
                <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/20 text-yellow-400 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-bold text-base sm:text-lg">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                  #{rank}
                </div>
              )}
            </div>

            {/* Team standings */}
            {teamMode && teamStandings.length > 0 && (
              <div className="w-full max-w-sm bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10 mb-4">
                <h3 className="text-xs sm:text-sm font-bold text-white/50 mb-3 uppercase tracking-wider">
                  Team Standings
                </h3>
                <div className="space-y-2">
                  {teamStandings.map((s) => (
                    <div
                      key={s.team.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ backgroundColor: `${s.team.color}22` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-bold text-white/60">{s.rank}</span>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.team.color }} />
                        <span className="font-semibold">{s.team.name}</span>
                      </div>
                      <span className="font-bold tabular-nums">{s.totalPoints.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="w-full max-w-sm bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10">
              <h3 className="text-xs sm:text-sm font-bold text-white/50 mb-3 sm:mb-4 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                <Medal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Top Players
              </h3>
              <div className="space-y-1.5 sm:space-y-2">
                {leaderboard.slice(0, 5).map((entry) => {
                  const isMe = entry.participantId === participantId;
                  return (
                    <div
                      key={entry.participantId}
                      className={`
                        flex items-center justify-between py-2 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base
                        ${isMe ? "bg-gradient-to-r from-primary/30 to-secondary/30 border border-primary/30" : "bg-white/5"}
                      `}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {getRankIcon(entry.rank)}
                        <span className={`font-semibold truncate ${isMe ? "text-white" : "text-white/80"}`}>
                          {entry.nickname}
                          {isMe && <span className="text-primary ml-1">(You)</span>}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums shrink-0 ml-2">{entry.totalPoints.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => navigate("/join")}
              className="mt-6 sm:mt-8 bg-white text-indigo-900 font-black text-base sm:text-lg py-3 sm:py-4 px-8 sm:px-10 rounded-xl sm:rounded-2xl shadow-xl shadow-white/20 active:scale-[0.97] transition-transform"
            >
              Play Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
