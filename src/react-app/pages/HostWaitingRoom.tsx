import { useState, useEffect, useRef, type ChangeEvent } from "react";
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
import { Users2, Timer, Zap, Hand, Megaphone, Sparkle, MessageCircle, Send, Link2, ImagePlus, CalendarClock, Trash2, ClipboardList, Download } from "lucide-react";
import type { SessionInfo, ParticipantInfo, Question, GameMode } from "@/shared/types";
import { PRESET_TEAMS, GET_READY_OPTIONS } from "@/shared/types";
import {
  createSession as createSessionApi,
  getSession,
  getQuiz,
  subscribeParticipants,
  setRoomLocked,
  kickParticipant,
  setTeamMode,
  setGetReadySeconds,
  setGameMode,
  setSessionAd,
  setSessionCover,
  setScheduledStart,
  setSessionLimits,
  openQuickBoard,
  closeQuickBoard,
  subscribeNotes,
  deleteNote,
  setSessionBrand,
  setCollectPlayerInfo,
  getSessionContacts,
  uploadLogo,
  startGame as startGameApi,
} from "@/react-app/lib/data";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import StickyWall from "@/react-app/components/StickyWall";
import type { StickyNote } from "@/shared/types";

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isTogglingTeams, setIsTogglingTeams] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [adText, setAdText] = useState("");
  const [adSaved, setAdSaved] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandSaved, setBrandSaved] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [scheduleInput, setScheduleInput] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const coverInputRef = useRef<HTMLInputElement>(null);
  const autoStartedRef = useRef(false);
  const { showError } = useToast();
  const { config, tier, atLeast, isProUser: pro, isAdmin } = useAppConfig();
  const biz = atLeast("business");

  const applyGameMode = async (mode: GameMode) => {
    if (!session) return;
    if (mode === "auto" && !pro) {
      showError("Automatic mode is a Pro feature", "Ask an admin to upgrade your account.");
      return;
    }
    setSession({ ...session, gameMode: mode });
    try {
      await setGameMode(session.id, mode);
    } catch {
      /* reverts on next load */
    }
  };

  const saveAd = async () => {
    if (!session) return;
    const text = adText.trim();
    await setSessionAd(session.id, text ? { text, imageUrl: null, url: null } : null);
    setSession({ ...session, ad: text ? { text, imageUrl: null, url: null } : null });
    setAdSaved(true);
    setTimeout(() => setAdSaved(false), 1500);
  };

  // Business: white-label brand name shown to players.
  const saveBrand = async () => {
    if (!session) return;
    const name = brandName.trim() || null;
    await setSessionBrand(session.id, name);
    setSession({ ...session, brandName: name });
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 1500);
  };

  // Toggle collecting each player's phone + State/LGA at join.
  const toggleCollect = async () => {
    if (!session) return;
    const next = !session.collectPlayerInfo;
    setSession({ ...session, collectPlayerInfo: next });
    try {
      await setCollectPlayerInfo(session.id, next);
    } catch {
      setSession((s) => (s ? { ...s, collectPlayerInfo: !next } : s));
    }
  };

  const downloadContacts = async () => {
    if (!session) return;
    try {
      const rows = await getSessionContacts(session.id);
      if (rows.length === 0) {
        showError("No contacts yet", "Numbers appear here as players join.");
        return;
      }
      const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        ["Nickname", "Phone", "State", "LGA/LCDA", "Joined"].join(","),
        ...rows.map((r) => [r.nickname, r.phone, r.state ?? "", r.lga ?? "", r.joinedAt ?? ""].map(esc).join(",")),
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `players-${session.gamePin}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showError("Couldn't download", "Please try again.");
    }
  };

  // Pro: full-screen lobby cover image.
  const pickCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadLogo(file);
      await setSessionCover(session.id, url);
      setSession({ ...session, coverImageUrl: url });
    } catch {
      showError("Couldn't upload image", "Please try a different file");
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const removeCover = async () => {
    if (!session) return;
    await setSessionCover(session.id, null);
    setSession({ ...session, coverImageUrl: null });
  };

  // Pro: schedule an automatic start (epoch millis) or clear it.
  const applySchedule = async (startAtMs: number | null) => {
    if (!session) return;
    autoStartedRef.current = false;
    await setScheduledStart(session.id, startAtMs);
    setSession({ ...session, scheduledStartAt: startAtMs });
    if (startAtMs === null) setScheduleInput("");
  };

  const scheduleInMinutes = (minutes: number) => applySchedule(Date.now() + minutes * 60000);

  const scheduleAtInput = () => {
    if (!scheduleInput) return;
    const at = new Date(scheduleInput).getTime();
    if (!Number.isFinite(at)) return;
    if (at <= Date.now()) {
      showError("Pick a future time", "The start time must be later than now.");
      return;
    }
    applySchedule(at);
  };

  const formatCountdown = (ms: number) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  };

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
        // Apply the admin's app-wide default pacing for Pro hosts on new games.
        if (!urlSessionId && data.gameMode === "manual" && config.defaultGameMode === "auto" && pro) {
          data = { ...data, gameMode: "auto" };
          setGameMode(data.id, "auto").catch(() => {});
        }
        setSession(data);
        setAdText(data.ad?.text ?? "");
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

  const joinUrl = session ? `${window.location.origin}/join/${session.gamePin}` : "";

  const copyLink = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(joinUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Open a share sheet for the join link. WhatsApp is the primary channel here.
  const shareVia = (platform: "whatsapp" | "sms" | "telegram") => {
    if (!session) return;
    const title = `🎮 Join my quiz "${session.quizTitle}" on Neighbours Quiz Arena!`;
    const message = `${title}\n\n📍 Click to join: ${joinUrl}\n\nSee you there! 🎉`;
    const text = encodeURIComponent(message);
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${text}`, "_blank");
    } else if (platform === "sms") {
      window.open(`sms:?body=${text}`, "_blank");
    } else {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(title)}`,
        "_blank"
      );
    }
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

  // Tick every second while a start is scheduled, so the countdown stays live.
  const startAtMs = session?.status === "WAITING" ? session?.scheduledStartAt ?? null : null;
  useEffect(() => {
    if (!startAtMs) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    setNowMs(Date.now());
    return () => clearInterval(iv);
  }, [startAtMs]);

  // Host-screen auto-start: fire once when the scheduled time is reached. Also
  // catches up if the host opens the lobby after the time already passed. The
  // start path is idempotent (guarded by autoStartedRef + WAITING status), so a
  // future server scheduler can drop in without conflicting.
  useEffect(() => {
    if (!startAtMs || questions.length === 0) return;
    if (autoStartedRef.current) return;
    if (nowMs >= startAtMs) {
      autoStartedRef.current = true;
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, startAtMs, questions.length]);

  // Host-only live feed for an open Quick Board.
  useEffect(() => {
    const boardId = session?.activeBoard?.id;
    if (!session || !boardId) {
      setNotes([]);
      return;
    }
    return subscribeNotes(session.id, boardId, setNotes);
  }, [session?.id, session?.activeBoard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stamp the join cap from the host's tier so the (public) session doc carries
  // it for the join screen to enforce.
  useEffect(() => {
    if (!session) return;
    setBrandName(session.brandName ?? "");
    // Super-admins get unlimited players (-1); everyone else gets their tier cap.
    const cap = isAdmin ? -1 : config.limits.maxPlayers[tier];
    const notes = config.limits.notesPerPlayer[tier];
    if (session.maxPlayers !== cap || session.notesPerPlayer !== notes) {
      setSession((s) => (s ? { ...s, maxPlayers: cap, notesPerPlayer: notes } : s));
      setSessionLimits(session.id, cap, notes).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, tier, config]);

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

          {/* Get-ready countdown interval */}
          {session && (
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer className="w-4 h-4" />
                Get-ready countdown:
              </span>
              <div className="inline-flex rounded-xl border border-border overflow-hidden">
                {GET_READY_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      setSession({ ...session, getReadySeconds: s });
                      try {
                        await setGetReadySeconds(session.id, s);
                      } catch {
                        /* revert handled by next load */
                      }
                    }}
                    className={`px-3 sm:px-4 py-1.5 text-sm font-semibold transition-colors ${
                      session.getReadySeconds === s
                        ? "gradient-primary text-white"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game pacing: manual vs automatic (Pro) */}
          {session && (
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Pacing:</span>
              <div className="inline-flex rounded-xl border border-border overflow-hidden">
                {(["manual", "auto"] as GameMode[]).map((m) => {
                  const active = session.gameMode === m;
                  const locked = m === "auto" && !pro;
                  return (
                    <button
                      key={m}
                      onClick={() => applyGameMode(m)}
                      className={`px-3 sm:px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        active ? "gradient-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {m === "auto" ? <Zap className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
                      {m === "auto" ? "Automatic" : "Manual"}
                      {locked && (
                        <span className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-yellow-600">
                          <Sparkle className="w-3 h-3" />
                          PRO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {session?.gameMode === "auto" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              ⚡ The game runs itself — questions open, close, reveal and advance automatically.
            </p>
          )}

          {/* Collect player phone + LGA at join */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ClipboardList className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Collect player details</div>
                    <p className="text-[11px] text-muted-foreground">
                      Ask each player for phone + State/LGA before they join. Numbers stay private to you.
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={session.collectPlayerInfo}
                  onClick={toggleCollect}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                    session.collectPlayerInfo ? "gradient-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      session.collectPlayerInfo ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
              {session.collectPlayerInfo && (
                <Button
                  variant="outline"
                  onClick={downloadContacts}
                  className="mt-2 w-full rounded-xl h-10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download player contacts (CSV)
                </Button>
              )}
            </div>
          )}

          {/* Full-screen lobby cover image (Pro) */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5 justify-center">
                <ImagePlus className="w-4 h-4 text-primary" />
                Lobby cover image
                {!pro && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-yellow-600">
                    <Sparkle className="w-3 h-3" /> PRO
                  </span>
                )}
              </label>
              {session.coverImageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={session.coverImageUrl} alt="Lobby cover" className="w-full h-40 object-cover" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removeCover}
                    className="absolute top-2 right-2 h-8 rounded-lg bg-card/90"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!pro || isUploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground hover:border-primary disabled:opacity-60"
                >
                  {isUploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  {pro ? (isUploadingCover ? "Uploading…" : "Upload a full-screen cover") : "Upgrade to Pro for a lobby cover"}
                </button>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={pickCover} />
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {!session.coverImageUrl && config.defaultCoverImageUrl
                  ? "An app-wide default cover is currently showing to players — upload to override it."
                  : "Shown full-screen on players’ phones while they wait. Disappears when the game starts."}
              </p>
            </div>
          )}

          {/* Scheduled auto-start + live countdown (Pro) */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5 justify-center">
                <CalendarClock className="w-4 h-4 text-primary" />
                Scheduled start
                {!pro && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-yellow-600">
                    <Sparkle className="w-3 h-3" /> PRO
                  </span>
                )}
              </label>
              {startAtMs ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Auto-starts in</p>
                  <div className="text-3xl font-black tabular-nums text-primary my-1">
                    {formatCountdown(startAtMs - nowMs)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    at {new Date(startAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · keep this
                    screen open
                  </p>
                  <Button variant="outline" size="sm" onClick={() => applySchedule(null)} className="mt-2 rounded-lg">
                    Cancel schedule
                  </Button>
                </div>
              ) : (
                <div className={pro ? "" : "opacity-60"}>
                  <div className="flex gap-2 justify-center flex-wrap mb-2">
                    {[5, 15, 30].map((mins) => (
                      <Button
                        key={mins}
                        variant="outline"
                        size="sm"
                        disabled={!pro}
                        onClick={() => scheduleInMinutes(mins)}
                        className="rounded-lg"
                      >
                        In {mins} min
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduleInput}
                      disabled={!pro}
                      onChange={(e) => setScheduleInput(e.target.value)}
                      className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl h-10"
                      disabled={!pro || !scheduleInput}
                      onClick={scheduleAtInput}
                    >
                      Set
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {pro
                  ? "The game starts automatically at this time — keep this screen open. You can still Start now anytime."
                  : "Upgrade to Pro to auto-start your game at a set time."}
              </p>
            </div>
          )}

          {/* Sponsor slot for the get-ready screen (Pro) */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5 justify-center">
                <Megaphone className="w-4 h-4 text-primary" />
                Sponsor message
                {!pro && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-yellow-600">
                    <Sparkle className="w-3 h-3" /> PRO
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  value={adText}
                  onChange={(e) => setAdText(e.target.value)}
                  disabled={!pro}
                  maxLength={120}
                  placeholder={pro ? "e.g. Snacks by Mama's Kitchen — order at table 4!" : "Upgrade to Pro to sponsor the countdown"}
                  className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                />
                <Button variant="outline" className="rounded-xl h-10" disabled={!pro} onClick={saveAd}>
                  {adSaved ? <Check className="w-4 h-4 text-success" /> : "Save"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {pro
                  ? "Shown to players between questions. Leave blank to show the default ad."
                  : "Players see a “your ad here” slot between questions — sell it once you're Pro."}
              </p>
            </div>
          )}

          {/* Sticky Wall — open an anonymous note board any time */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5 justify-center">
                <Megaphone className="w-4 h-4 text-primary" />
                Sticky Wall
              </label>
              {session.activeBoard ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-semibold text-center mb-2">
                    “{session.activeBoard.prompt}”
                  </p>
                  <div className="h-64 mb-2">
                    <StickyWall
                      prompt={session.activeBoard.prompt}
                      notes={notes}
                      maxNotes={config.limits.wallMaxNotes[tier]}
                      onDelete={(id) => deleteNote(session.id, id).catch(() => {})}
                      compact
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-10"
                    onClick={() => closeQuickBoard(session.id).catch(() => {})}
                  >
                    Close board
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    maxLength={300}
                    placeholder="Ask anything — e.g. What should we fix first?"
                    className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl h-10"
                    disabled={!quickPrompt.trim()}
                    onClick={() => {
                      openQuickBoard(session.id, quickPrompt)
                        .then((b) => {
                          setSession((s) => (s ? { ...s, activeBoard: b } : s));
                          setQuickPrompt("");
                        })
                        .catch(() => showError("Couldn't open the board", "Please try again"));
                    }}
                  >
                    Open
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                Players type an answer; it lands here as an anonymous sticky note.
              </p>
            </div>
          )}

          {/* White-label brand (Business) */}
          {session && (
            <div className="mt-5 max-w-md mx-auto">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5 justify-center">
                <Sparkle className="w-4 h-4 text-primary" />
                White-label brand
                {!biz && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-yellow-600">
                    <Sparkle className="w-3 h-3" /> BUSINESS
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={!biz}
                  maxLength={40}
                  placeholder={biz ? "e.g. Mama's Kitchen Quiz Night" : "Upgrade to Business to remove app branding"}
                  className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                />
                <Button variant="outline" className="rounded-xl h-10" disabled={!biz} onClick={saveBrand}>
                  {brandSaved ? <Check className="w-4 h-4 text-success" /> : "Save"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {biz
                  ? "Replaces “Neighbours Quiz Arena” on players' screens. Leave blank to show the app name."
                  : "Business hosts can show their own brand instead of the app name."}
              </p>
            </div>
          )}

          {session && !pro && (
            <div className="mt-4 text-center">
              <Link
                to="/upgrade"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Sparkle className="w-4 h-4 text-yellow-500" />
                Upgrade to Pro to unlock Automatic mode & sponsor ads →
              </Link>
            </div>
          )}

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

              {/* Invite players — share the join link (WhatsApp & friends) */}
              <div className="mt-4 w-full max-w-md">
                <p className="text-xs sm:text-sm text-muted-foreground text-center mb-2">Invite players</p>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    onClick={() => shareVia("whatsapp")}
                    className="h-14 flex-col gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 rounded-xl"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span className="text-[11px] font-semibold">WhatsApp</span>
                  </Button>
                  <Button
                    onClick={() => shareVia("sms")}
                    className="h-14 flex-col gap-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 rounded-xl"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">SMS</span>
                  </Button>
                  <Button
                    onClick={() => shareVia("telegram")}
                    className="h-14 flex-col gap-1 bg-[#0088cc] hover:bg-[#0077b3] text-white border-0 rounded-xl"
                  >
                    <Send className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">Telegram</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyLink}
                    className="h-14 flex-col gap-1 rounded-xl"
                  >
                    {linkCopied ? <Check className="w-5 h-5 text-success" /> : <Link2 className="w-5 h-5" />}
                    <span className="text-[11px] font-semibold">{linkCopied ? "Copied" : "Copy link"}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Players List */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-green-800">Players</h2>
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
            <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 text-green-800">Waiting for players...</h3>
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
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-900" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-1 text-green-800">Host Tips</h3>
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
