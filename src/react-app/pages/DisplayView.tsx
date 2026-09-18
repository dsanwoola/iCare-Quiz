import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { Users, Trophy, Medal, Loader2 } from "lucide-react";
import type { CurrentQuestion, LeaderboardEntry, StickyNote } from "@/shared/types";
import { isOptionType } from "@/shared/types";
import {
  subscribeSessionRaw,
  subscribeLeaderboard,
  subscribeParticipants,
  subscribeNotes,
  currentQuestionFromSession,
} from "@/react-app/lib/data";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import { useWakeLock } from "@/react-app/hooks/useWakeLock";
import StickyWall from "@/react-app/components/StickyWall";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Read-only audience screen for the projector. Mirrors the live game with no
 * controls at all, so the room never sees the host's buttons. Signed in as the
 * host (notes are host-readable only), but nothing here can change the game.
 */
export default function DisplayView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { config, tier } = useAppConfig();
  useWakeLock();

  const [gamePin, setGamePin] = useState<string>("");
  const [brandName, setBrandName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("WAITING");
  const [questionStatus, setQuestionStatus] = useState<string>("CLOSED");
  const [question, setQuestion] = useState<CurrentQuestion | null>(null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [activeBoardPrompt, setActiveBoardPrompt] = useState<string>("");
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const unsubs = [
      subscribeSessionRaw(sessionId, (data) => {
        if (!data) return;
        setReady(true);
        setGamePin(data.gamePin ?? "");
        setBrandName(data.brandName ?? null);
        setStatus(data.status ?? "WAITING");
        setQuestionStatus(data.questionStatus ?? "CLOSED");
        setRevealed((data.revealedAnswers as string[]) ?? []);
        setActiveBoardId(data.activeBoard?.id ?? null);
        setActiveBoardPrompt(data.activeBoard?.prompt ?? "");
        setQuestion(currentQuestionFromSession(data));
      }),
      subscribeLeaderboard(sessionId, setLeaderboard, 10),
      subscribeParticipants(sessionId, (p) => setPlayerCount(p.length)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sessionId]);

  // Which board is on the wall right now (Quick Board wins over a BOARD question).
  const boardId = activeBoardId ?? (question?.type === "BOARD" ? question.questionId : null);
  const boardPrompt = activeBoardId ? activeBoardPrompt : question?.prompt ?? "";

  useEffect(() => {
    if (!sessionId || !boardId) {
      setNotes([]);
      return;
    }
    return subscribeNotes(sessionId, boardId, setNotes);
  }, [sessionId, boardId]);

  const joinUrl = `${window.location.origin}/join/${gamePin}`;
  const appName = brandName || "Neighbours Quiz Arena";

  // Live countdown while a question is open.
  let secondsLeft: number | null = null;
  if (question && questionStatus === "OPEN" && question.questionStartedAt) {
    const endsAt = new Date(question.questionStartedAt).getTime() + question.durationSeconds * 1000;
    secondsLeft = Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-teal-900 flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  // ---- The Sticky Wall owns the screen whenever a board is live -------------
  if (boardId) {
    return (
      <div className="min-h-screen bg-neutral-100 p-4 sm:p-8 flex flex-col">
        <div className="flex-1 min-h-0">
          <StickyWall
            prompt={boardPrompt}
            notes={notes}
            maxNotes={config.limits.wallMaxNotes[tier]}
            readOnly
          />
        </div>
        <div className="shrink-0 pt-3 flex items-center justify-center gap-4 text-neutral-500 text-sm">
          <span className="font-semibold">{appName}</span>
          <span>
            Join at <span className="font-mono font-bold">{window.location.host}/join</span> · PIN{" "}
            <span className="font-mono font-bold tracking-widest">{gamePin}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-teal-900 text-white flex flex-col p-6 sm:p-10">
      {/* ---- Lobby: PIN + QR so the room can join ---- */}
      {status === "WAITING" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-lg sm:text-2xl text-white/70 mb-2">{appName}</p>
          <h1 className="text-3xl sm:text-5xl font-black mb-8">Join the game</h1>
          <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-14">
            <div>
              <p className="uppercase tracking-[0.25em] text-white/60 text-sm mb-2">Game PIN</p>
              <div className="text-6xl sm:text-8xl font-black tracking-[0.15em] tabular-nums">
                {gamePin}
              </div>
              <p className="mt-4 text-white/70 text-lg">
                at <span className="font-bold">{window.location.host}/join</span>
              </p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-2xl">
              <QRCodeSVG value={joinUrl} size={220} level="M" />
            </div>
          </div>
          <div className="mt-10 inline-flex items-center gap-3 bg-white/10 rounded-2xl px-6 py-4">
            <Users className="w-7 h-7 text-yellow-300" />
            <span className="text-3xl font-black tabular-nums">{playerCount}</span>
            <span className="text-white/70">joined</span>
          </div>
        </div>
      )}

      {/* ---- Live question ---- */}
      {status === "LIVE" && question && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 text-white/70">
            <span className="text-lg">
              Question {question.questionIndex + 1} / {question.totalQuestions}
            </span>
            {secondsLeft !== null && (
              <span
                className={`text-5xl font-black tabular-nums ${
                  secondsLeft <= 5 ? "text-red-300 animate-pulse" : ""
                }`}
              >
                {secondsLeft}
              </span>
            )}
          </div>

          {question.imageUrl && (
            <img
              src={question.imageUrl}
              alt=""
              className="max-h-[32vh] w-auto mx-auto rounded-2xl mb-4 object-contain"
            />
          )}

          <h2 className="text-3xl sm:text-5xl font-black text-center leading-tight mb-8">
            {question.prompt}
          </h2>

          {isOptionType(question.type) ? (
            <div className="grid sm:grid-cols-2 gap-4 max-w-5xl mx-auto w-full">
              {question.options.map((o, i) => {
                const isCorrect = revealed.includes(o.id);
                const showing = questionStatus === "REVEAL";
                return (
                  <div
                    key={o.id}
                    className={`rounded-2xl px-6 py-5 flex items-center gap-4 border-2 transition-all ${
                      showing && isCorrect
                        ? "bg-green-500/30 border-green-300 scale-[1.02]"
                        : showing
                        ? "bg-white/5 border-white/10 opacity-50"
                        : "bg-white/10 border-white/20"
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black shrink-0">
                      {LETTERS[i]}
                    </span>
                    <span className="text-xl sm:text-3xl font-bold">{o.text}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            questionStatus === "REVEAL" &&
            revealed.length > 0 && (
              <div className="text-center">
                <p className="text-white/60 uppercase tracking-wider text-sm mb-2">Answer</p>
                <p className="text-4xl sm:text-6xl font-black text-green-300">
                  {revealed.join(" · ")}
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* ---- Final results ---- */}
      {status === "ENDED" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Trophy className="w-16 h-16 text-yellow-300 mb-3" />
          <h1 className="text-4xl sm:text-6xl font-black mb-8">Final Results</h1>
          <div className="w-full max-w-2xl space-y-3">
            {leaderboard.slice(0, 10).map((e) => (
              <div
                key={e.participantId}
                className={`flex items-center justify-between rounded-2xl px-6 py-4 ${
                  e.rank === 1 ? "bg-yellow-400/25 border-2 border-yellow-300" : "bg-white/10"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-10 text-center text-2xl font-black">
                    {e.rank <= 3 ? <Medal className="w-6 h-6 mx-auto text-yellow-300" /> : e.rank}
                  </span>
                  <span className="text-2xl font-bold truncate">
                    {e.nickname}
                    {e.lga && <span className="text-white/50 text-lg font-normal"> — {e.lga}</span>}
                  </span>
                </div>
                <span className="text-2xl font-black tabular-nums">
                  {e.totalPoints.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persistent join strip so latecomers can always get in */}
      {status !== "WAITING" && (
        <div className="shrink-0 pt-4 text-center text-white/50 text-sm">
          {appName} · Join at{" "}
          <span className="font-mono font-bold text-white/70">{window.location.host}/join</span> ·
          PIN <span className="font-mono font-bold tracking-widest text-white/70">{gamePin}</span>
        </div>
      )}
    </div>
  );
}
