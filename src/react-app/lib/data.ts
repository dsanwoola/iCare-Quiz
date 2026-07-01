import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { auth, db, storage } from "./firebase";
import type {
  AnswerResult,
  CurrentQuestion,
  JoinResult,
  LeaderboardEntry,
  ParticipantInfo,
  PublicQuestion,
  Question,
  QuestionResult,
  QuizAnalytics,
  QuizDetail,
  QuizInput,
  QuizSummary,
  QuizTemplate,
  QuizTemplateDetail,
  SessionHistoryItem,
  SessionInfo,
  SessionStatus,
  Team,
  TeamStanding,
} from "@/shared/types";
import { PRESET_TEAMS } from "@/shared/types";
import { STARTER_TEMPLATES } from "@/react-app/data/templates";

// ============================================
// Helpers
// ============================================

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to do that.");
  return uid;
}

/**
 * Ensure the current visitor has an auth identity for reads/writes that the
 * security rules require. Waits for any persisted session (e.g. after a page
 * refresh) to restore before falling back to anonymous sign-in, so a player
 * keeps the same uid across reloads.
 */
export async function ensurePlayerAuth(): Promise<string> {
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser!.uid;
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function tsToIsoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function generateGamePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicQuestionFrom(q: Question, index: number, total: number): PublicQuestion {
  // For ordering questions, present the items shuffled so the authored order
  // (which is the correct order) isn't given away.
  const options = q.type === "ORDER" ? shuffle(q.options) : q.options;
  return {
    questionId: q.id,
    questionIndex: index,
    totalQuestions: total,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl ?? null,
    options,
    durationSeconds: q.durationSeconds,
    basePoints: q.basePoints,
  };
}

// ============================================
// Quizzes
// ============================================

export async function listQuizzes(): Promise<QuizSummary[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(collection(db, "quizzes"), where("ownerUid", "==", uid), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      description: data.description ?? null,
      questionCount: data.questionCount ?? (data.questions?.length || 0),
      gamePin: data.gamePin ?? null,
      createdAt: tsToIso(data.createdAt),
    };
  });
}

export async function getQuiz(quizId: string): Promise<QuizDetail> {
  const snap = await getDoc(doc(db, "quizzes", quizId));
  if (!snap.exists()) throw new Error("Quiz not found");
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title,
    description: data.description ?? null,
    logoUrl: data.logoUrl ?? null,
    gamePin: data.gamePin ?? null,
    questions: (data.questions || []) as Question[],
  };
}

export async function createQuiz(input: QuizInput): Promise<string> {
  const uid = requireUid();
  const ref = await addDoc(collection(db, "quizzes"), {
    ownerUid: uid,
    title: input.title,
    description: input.description ?? null,
    logoUrl: input.logoUrl ?? null,
    gamePin: null,
    isPublished: false,
    questionCount: input.questions.length,
    questions: input.questions,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuiz(quizId: string, input: QuizInput): Promise<void> {
  await updateDoc(doc(db, "quizzes", quizId), {
    title: input.title,
    description: input.description ?? null,
    logoUrl: input.logoUrl ?? null,
    questionCount: input.questions.length,
    questions: input.questions,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await deleteDoc(doc(db, "quizzes", quizId));
}

export async function uploadLogo(file: File): Promise<string> {
  const uid = requireUid();
  const ext = file.name.split(".").pop() || "png";
  const path = `quiz-logos/${uid}/${crypto.randomUUID()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ============================================
// Sessions
// ============================================

function sessionInfoFromDoc(id: string, data: DocumentData): SessionInfo {
  return {
    id,
    quizId: data.quizId,
    quizTitle: data.quizTitle,
    quizLogoUrl: data.quizLogoUrl ?? null,
    gamePin: data.gamePin,
    status: data.status as SessionStatus,
    currentQuestionIndex: data.currentQuestionIndex ?? 0,
    questionStatus: data.questionStatus ?? "CLOSED",
    totalQuestions: data.totalQuestions ?? 0,
    participantCount: data.participantCount ?? 0,
    isRoomLocked: !!data.isRoomLocked,
    teamMode: !!data.teamMode,
    teams: (data.teams ?? []) as Team[],
    createdAt: tsToIso(data.createdAt),
  };
}

async function generateUniquePin(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const pin = generateGamePin();
    const snap = await getDocs(
      query(
        collection(db, "sessions"),
        where("gamePin", "==", pin),
        where("status", "in", ["WAITING", "LIVE"]),
        qLimit(1)
      )
    );
    if (snap.empty) return pin;
  }
  return generateGamePin();
}

/** Create a new session for a quiz, or reuse the existing active one. */
export async function createSession(quizId: string): Promise<SessionInfo> {
  const uid = requireUid();
  const quiz = await getQuiz(quizId);

  // Reuse an existing active (WAITING/LIVE) session for this quiz.
  const existing = await getDocs(
    query(
      collection(db, "sessions"),
      where("quizId", "==", quizId),
      where("status", "in", ["WAITING", "LIVE"]),
      qLimit(1)
    )
  );
  if (!existing.empty) {
    const d = existing.docs[0];
    // Unlock a waiting room when the host returns to start a game.
    if (d.data().status === "WAITING" && d.data().isRoomLocked) {
      await updateDoc(d.ref, { isRoomLocked: false, updatedAt: serverTimestamp() });
    }
    return sessionInfoFromDoc(d.id, { ...d.data(), isRoomLocked: false });
  }

  const pin = await generateUniquePin();
  const ref = await addDoc(collection(db, "sessions"), {
    quizId,
    hostUid: uid,
    quizTitle: quiz.title,
    quizLogoUrl: quiz.logoUrl ?? null,
    gamePin: pin,
    status: "WAITING",
    currentQuestionIndex: 0,
    questionStatus: "CLOSED",
    questionStartedAt: null,
    currentQuestion: null,
    revealedAnswers: null,
    totalQuestions: quiz.questions.length,
    participantCount: 0,
    isRoomLocked: false,
    teamMode: false,
    teams: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return sessionInfoFromDoc(ref.id, snap.data() as DocumentData);
}

export async function getSession(sessionId: string): Promise<SessionInfo> {
  const snap = await getDoc(doc(db, "sessions", sessionId));
  if (!snap.exists()) throw new Error("Session not found");
  return sessionInfoFromDoc(snap.id, snap.data());
}

/** Realtime session subscription — replaces the player & host SSE streams. */
export function subscribeSession(
  sessionId: string,
  cb: (session: SessionInfo | null) => void
): () => void {
  return onSnapshot(doc(db, "sessions", sessionId), (snap) => {
    cb(snap.exists() ? sessionInfoFromDoc(snap.id, snap.data()) : null);
  });
}

export async function getSessionByPin(pin: string): Promise<SessionInfo> {
  await ensurePlayerAuth();
  const snap = await getDocs(
    query(
      collection(db, "sessions"),
      where("gamePin", "==", pin),
      where("status", "in", ["WAITING", "LIVE"]),
      qLimit(1)
    )
  );
  if (snap.empty) throw new Error("Game not found. Check your PIN and try again.");
  const d = snap.docs[0];
  if (d.data().isRoomLocked) {
    throw new Error("This game is locked and not accepting new players.");
  }
  return sessionInfoFromDoc(d.id, d.data());
}

/** Join a session as an anonymous player. */
export async function joinSession(pin: string, nickname: string): Promise<JoinResult> {
  const uid = await ensurePlayerAuth();

  const sessionsSnap = await getDocs(
    query(
      collection(db, "sessions"),
      where("gamePin", "==", pin),
      where("status", "in", ["WAITING", "LIVE"]),
      qLimit(1)
    )
  );
  if (sessionsSnap.empty) throw new Error("Game not found. Check your PIN and try again.");
  const sessionDoc = sessionsSnap.docs[0];
  const session = sessionDoc.data();
  if (session.isRoomLocked) {
    throw new Error("This game is locked and not accepting new players.");
  }

  // Reject duplicate nicknames (case-insensitive) among active players.
  const participantsSnap = await getDocs(
    collection(db, "sessions", sessionDoc.id, "participants")
  );
  const active = participantsSnap.docs.filter((p) => !p.data().isKicked);
  const taken = active.some(
    (p) => p.data().nickname?.toLowerCase() === nickname.toLowerCase()
  );
  if (taken) throw new Error("This nickname is already taken. Choose another.");

  // Auto-assign a team (round-robin) when the room is in team mode.
  let team: Team | null = null;
  const teams = (session.teams ?? []) as Team[];
  if (session.teamMode && teams.length > 0) {
    team = teams[active.length % teams.length];
  }

  await setDoc(doc(db, "sessions", sessionDoc.id, "participants", uid), {
    uid,
    nickname,
    role: "PLAYER",
    totalPoints: 0,
    streak: 0,
    isKicked: false,
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
    teamColor: team?.color ?? null,
    joinedAt: serverTimestamp(),
  });

  return {
    participantId: uid,
    sessionId: sessionDoc.id,
    nickname,
    quizTitle: session.quizTitle,
    quizLogoUrl: session.quizLogoUrl ?? null,
    status: session.status as SessionStatus,
    teamId: team?.id ?? null,
    team,
  };
}

function participantInfoFrom(
  d: QueryDocumentSnapshot<DocumentData>,
  index: number
): ParticipantInfo {
  const data = d.data();
  return {
    id: d.id,
    nickname: data.nickname,
    role: data.role ?? "PLAYER",
    totalPoints: data.totalPoints ?? 0,
    streak: data.streak ?? 0,
    currentRank: index + 1,
    isKicked: !!data.isKicked,
    teamId: data.teamId ?? null,
  };
}

export function subscribeParticipants(
  sessionId: string,
  cb: (participants: ParticipantInfo[]) => void
): () => void {
  const q = query(
    collection(db, "sessions", sessionId, "participants"),
    orderBy("totalPoints", "desc"),
    orderBy("joinedAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const active = snap.docs.filter((d) => !d.data().isKicked);
    cb(active.map(participantInfoFrom));
  });
}

export async function kickParticipant(sessionId: string, participantId: string): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId, "participants", participantId), {
    isKicked: true,
  });
}

export async function setRoomLocked(sessionId: string, locked: boolean): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    isRoomLocked: locked,
    updatedAt: serverTimestamp(),
  });
}

/** Enable/disable team mode. Enabling assigns existing players to teams. */
export async function setTeamMode(sessionId: string, enabled: boolean): Promise<void> {
  const sessionRef = doc(db, "sessions", sessionId);
  if (!enabled) {
    await updateDoc(sessionRef, { teamMode: false, updatedAt: serverTimestamp() });
    return;
  }
  const pSnap = await getDocs(collection(db, "sessions", sessionId, "participants"));
  const active = pSnap.docs.filter((d) => !d.data().isKicked);
  const batch = writeBatch(db);
  active.forEach((d, i) => {
    const team = PRESET_TEAMS[i % PRESET_TEAMS.length];
    batch.update(d.ref, { teamId: team.id, teamName: team.name, teamColor: team.color });
  });
  batch.update(sessionRef, { teamMode: true, teams: PRESET_TEAMS, updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Aggregate participant scores into ranked team standings. */
export function computeTeamStandings(
  participants: ParticipantInfo[],
  teams: Team[]
): TeamStanding[] {
  const tally = new Map<string, { points: number; count: number }>();
  teams.forEach((t) => tally.set(t.id, { points: 0, count: 0 }));
  for (const p of participants) {
    if (!p.teamId) continue;
    const e = tally.get(p.teamId);
    if (e) {
      e.points += p.totalPoints;
      e.count += 1;
    }
  }
  return teams
    .map((team) => ({
      team,
      totalPoints: tally.get(team.id)?.points ?? 0,
      memberCount: tally.get(team.id)?.count ?? 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export async function endSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    status: "ENDED",
    questionStatus: "CLOSED",
    updatedAt: serverTimestamp(),
  });
}

export async function listSessionHistory(): Promise<SessionHistoryItem[]> {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, "sessions"),
      where("hostUid", "==", uid),
      orderBy("createdAt", "desc"),
      qLimit(50)
    )
  );
  const items: SessionHistoryItem[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const pSnap = await getDocs(collection(db, "sessions", d.id, "participants"));
    const participantCount = pSnap.docs.filter((p) => !p.data().isKicked).length;
    items.push({
      id: d.id,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      gamePin: data.gamePin,
      status: data.status as SessionStatus,
      participantCount,
      questionCount: data.totalQuestions ?? 0,
      createdAt: tsToIso(data.createdAt),
      endedAt: data.status === "ENDED" ? tsToIsoOrNull(data.updatedAt) : null,
    });
  }
  return items;
}

// ============================================
// Live gameplay — host controls
// ============================================

async function setQuestion(
  sessionId: string,
  questions: Question[],
  index: number,
  status: "CLOSED" | "OPEN" | "REVEAL"
) {
  const q = questions[index];
  await updateDoc(doc(db, "sessions", sessionId), {
    currentQuestionIndex: index,
    questionStatus: status,
    questionStartedAt: status === "OPEN" ? serverTimestamp() : null,
    currentQuestion: q ? publicQuestionFrom(q, index, questions.length) : null,
    revealedAnswers: null,
    updatedAt: serverTimestamp(),
  });
}

export async function startGame(sessionId: string, questions: Question[]): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    status: "LIVE",
    currentQuestionIndex: 0,
    questionStatus: "CLOSED",
    currentQuestion: questions[0] ? publicQuestionFrom(questions[0], 0, questions.length) : null,
    revealedAnswers: null,
    updatedAt: serverTimestamp(),
  });
}

export async function openQuestion(sessionId: string): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    questionStatus: "OPEN",
    questionStartedAt: serverTimestamp(),
    revealedAnswers: null,
    updatedAt: serverTimestamp(),
  });
}

export async function closeQuestion(sessionId: string): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    questionStatus: "CLOSED",
    updatedAt: serverTimestamp(),
  });
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Grade a submitted answer against a question, per its type. */
function gradeAnswer(question: Question, payload: string[]): boolean {
  if (question.type === "SHORT") {
    const given = normalizeText(payload[0] ?? "");
    return given.length > 0 && question.correctAnswers.some((a) => normalizeText(a) === given);
  }
  if (question.type === "NUMERIC") {
    const given = parseFloat(payload[0] ?? "");
    const target = parseFloat(question.correctAnswers[0] ?? "");
    if (isNaN(given) || isNaN(target)) return false;
    return Math.abs(given - target) <= (question.numericTolerance ?? 0);
  }
  if (question.type === "ORDER") {
    // Exact sequence match.
    return (
      payload.length === question.correctAnswers.length &&
      payload.every((id, i) => id === question.correctAnswers[i])
    );
  }
  // Option-based types: exact set match.
  const correct = question.correctAnswers;
  return (
    payload.length === correct.length &&
    payload.every((a) => correct.includes(a)) &&
    correct.every((a) => payload.includes(a))
  );
}

/**
 * Reveal the current question. The host is the scoring authority: it reads all
 * submitted answers, grades them against the correct answers (which never reach
 * players' clients), applies a speed + streak bonus, and writes the results.
 */
export async function revealQuestion(sessionId: string, questions: Question[]): Promise<void> {
  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error("Session not found");
  const index = sessionSnap.data().currentQuestionIndex ?? 0;
  const question = questions[index];
  if (!question) return;

  const durationMs = question.durationSeconds * 1000;
  const answersSnap = await getDocs(
    query(
      collection(db, "sessions", sessionId, "answers"),
      where("questionId", "==", question.id)
    )
  );
  const participantsSnap = await getDocs(collection(db, "sessions", sessionId, "participants"));

  const answeredBy = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  answersSnap.docs.forEach((a) => answeredBy.set(a.data().uid, a));

  const batch = writeBatch(db);

  for (const p of participantsSnap.docs) {
    if (p.data().isKicked) continue;
    const ans = answeredBy.get(p.id);
    const prevStreak = p.data().streak ?? 0;

    if (!ans) {
      if (prevStreak !== 0) batch.update(p.ref, { streak: 0 });
      continue;
    }

    const payload: string[] = ans.data().answerPayload || [];
    const correct = gradeAnswer(question, payload);
    const answerTimeMs: number = ans.data().answerTimeMs ?? durationMs;

    let points = 0;
    let newStreak = 0;
    if (correct) {
      const factor = Math.max(0, 1 - answerTimeMs / durationMs / 2); // 1.0 (fast) → 0.5 (slow)
      const speedPoints = Math.round(question.basePoints * factor);
      newStreak = prevStreak + 1;
      const streakBonus =
        newStreak >= 2 ? Math.round(question.basePoints * 0.1 * Math.min(newStreak - 1, 5)) : 0;
      points = speedPoints + streakBonus;
    }

    batch.update(ans.ref, { isCorrect: correct, pointsAwarded: points });
    batch.update(p.ref, {
      totalPoints: (p.data().totalPoints ?? 0) + points,
      streak: newStreak,
    });
  }

  batch.update(sessionRef, {
    questionStatus: "REVEAL",
    revealedAnswers: question.correctAnswers,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/** Advance to the next question, or end the game if there are none left. */
export async function nextQuestion(
  sessionId: string,
  questions: Question[]
): Promise<{ isComplete: boolean; questionIndex: number }> {
  const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionSnap.exists()) throw new Error("Session not found");
  const nextIndex = (sessionSnap.data().currentQuestionIndex ?? 0) + 1;

  if (nextIndex >= questions.length) {
    await endSession(sessionId);
    return { isComplete: true, questionIndex: nextIndex };
  }
  await setQuestion(sessionId, questions, nextIndex, "CLOSED");
  return { isComplete: false, questionIndex: nextIndex };
}

export async function getQuestionResults(
  sessionId: string,
  question: Question
): Promise<QuestionResult> {
  const answersSnap = await getDocs(
    query(
      collection(db, "sessions", sessionId, "answers"),
      where("questionId", "==", question.id)
    )
  );
  const answers = answersSnap.docs.map((d) => d.data());
  const totalAnswers = answers.length;

  const optionCounts: Record<string, number> = {};
  question.options.forEach((o) => (optionCounts[o.id] = 0));
  let correctCount = 0;
  let totalTimeMs = 0;

  for (const ans of answers) {
    const payload: string[] = ans.answerPayload || [];
    payload.forEach((id) => {
      if (optionCounts[id] !== undefined) optionCounts[id]++;
    });
    if (gradeAnswer(question, payload)) correctCount++;
    totalTimeMs += ans.answerTimeMs ?? 0;
  }

  return {
    questionId: question.id,
    prompt: question.prompt,
    options: question.options,
    correctAnswers: question.correctAnswers,
    answerDistribution: question.options.map((o) => ({
      optionId: o.id,
      count: optionCounts[o.id] || 0,
      percentage: totalAnswers > 0 ? Math.round((optionCounts[o.id] / totalAnswers) * 100) : 0,
    })),
    totalAnswers,
    correctCount,
    averageTimeMs: totalAnswers > 0 ? Math.round(totalTimeMs / totalAnswers) : null,
  };
}

export function subscribeAnswerCount(
  sessionId: string,
  questionId: string,
  cb: (count: number) => void
): () => void {
  const q = query(
    collection(db, "sessions", sessionId, "answers"),
    where("questionId", "==", questionId)
  );
  return onSnapshot(q, (snap) => cb(snap.size));
}

function leaderboardFrom(docs: QueryDocumentSnapshot<DocumentData>[]): LeaderboardEntry[] {
  return docs
    .filter((d) => !d.data().isKicked)
    .map((d, index) => ({
      rank: index + 1,
      participantId: d.id,
      nickname: d.data().nickname,
      totalPoints: d.data().totalPoints ?? 0,
      lastAnswerPoints: null,
      streak: d.data().streak ?? 0,
      teamId: d.data().teamId ?? null,
    }));
}

export function subscribeLeaderboard(
  sessionId: string,
  cb: (entries: LeaderboardEntry[]) => void,
  max = 10
): () => void {
  const q = query(
    collection(db, "sessions", sessionId, "participants"),
    orderBy("totalPoints", "desc"),
    orderBy("joinedAt", "asc")
  );
  return onSnapshot(q, (snap) => cb(leaderboardFrom(snap.docs).slice(0, max)));
}

export async function getLeaderboard(sessionId: string, max = 10): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, "sessions", sessionId, "participants"),
      orderBy("totalPoints", "desc"),
      orderBy("joinedAt", "asc")
    )
  );
  return leaderboardFrom(snap.docs).slice(0, max);
}

// ============================================
// Live gameplay — player
// ============================================

/** Build the player-facing current question (with a live timer) from a session. */
export function currentQuestionFromSession(session: DocumentData): CurrentQuestion | null {
  const cq = session.currentQuestion as PublicQuestion | null;
  if (!cq) return null;
  let timeRemainingMs: number | null = null;
  let startedIso: string | null = null;
  if (session.questionStatus === "OPEN" && session.questionStartedAt instanceof Timestamp) {
    const started = session.questionStartedAt.toDate().getTime();
    startedIso = new Date(started).toISOString();
    timeRemainingMs = Math.max(0, cq.durationSeconds * 1000 - (Date.now() - started));
  }
  return {
    ...cq,
    questionStatus: session.questionStatus,
    questionStartedAt: startedIso,
    timeRemainingMs,
  };
}

/** Subscribe to the raw session document (for players who need the timer fields). */
export function subscribeSessionRaw(
  sessionId: string,
  cb: (data: DocumentData | null) => void
): () => void {
  return onSnapshot(doc(db, "sessions", sessionId), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

/**
 * Submit an answer. Players record their choice only — they cannot grade it
 * (correct answers stay host-side). Grading happens when the host reveals.
 */
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  answer: string[],
  answerTimeMs: number
): Promise<void> {
  const uid = requireUid();
  const answerId = `${questionId}_${uid}`;
  await setDoc(doc(db, "sessions", sessionId, "answers", answerId), {
    uid,
    questionId,
    answerPayload: answer,
    answerTimeMs,
    isCorrect: null,
    pointsAwarded: 0,
    submittedAt: serverTimestamp(),
  });
}

/** After a reveal, fetch the player's own graded result for a question. */
export async function getMyAnswerResult(
  sessionId: string,
  questionId: string,
  revealedAnswers: string[]
): Promise<AnswerResult | null> {
  const uid = requireUid();
  const ansSnap = await getDoc(
    doc(db, "sessions", sessionId, "answers", `${questionId}_${uid}`)
  );
  const meSnap = await getDoc(doc(db, "sessions", sessionId, "participants", uid));
  const totalPoints = meSnap.exists() ? meSnap.data().totalPoints ?? 0 : 0;

  const leaderboard = await getLeaderboard(sessionId, 1000);
  const rank = leaderboard.find((e) => e.participantId === uid)?.rank ?? leaderboard.length;

  if (!ansSnap.exists()) {
    return { isCorrect: false, pointsAwarded: 0, correctAnswers: revealedAnswers, totalPoints, rank };
  }
  const data = ansSnap.data();
  return {
    isCorrect: !!data.isCorrect,
    pointsAwarded: data.pointsAwarded ?? 0,
    correctAnswers: revealedAnswers,
    totalPoints,
    rank,
  };
}

// ============================================
// Public template library
// ============================================

function templateFromDoc(id: string, d: DocumentData): QuizTemplate {
  return {
    id,
    title: d.title,
    description: d.description ?? null,
    category: d.category ?? "General",
    questionCount: d.questionCount ?? (d.questions?.length || 0),
    authorName: d.authorName ?? null,
    createdAt: tsToIso(d.createdAt),
  };
}

export async function listTemplates(): Promise<QuizTemplate[]> {
  const snap = await getDocs(query(collection(db, "templates"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => templateFromDoc(d.id, d.data()));
}

export async function getTemplate(id: string): Promise<QuizTemplateDetail> {
  const snap = await getDoc(doc(db, "templates", id));
  if (!snap.exists()) throw new Error("Template not found");
  const d = snap.data();
  return { ...templateFromDoc(snap.id, d), questions: (d.questions || []) as Question[] };
}

/** Deep-clone questions with fresh ids (remapping option-id references). */
function cloneQuestions(questions: Question[]): Question[] {
  return questions.map((q) => {
    const idMap = new Map<string, string>();
    const options = q.options.map((o) => {
      const nid = crypto.randomUUID();
      idMap.set(o.id, nid);
      return { ...o, id: nid };
    });
    const usesOptionIds = q.type !== "SHORT" && q.type !== "NUMERIC";
    return {
      ...q,
      id: crypto.randomUUID(),
      options,
      correctAnswers: usesOptionIds ? q.correctAnswers.map((x) => idMap.get(x) ?? x) : q.correctAnswers,
    };
  });
}

/** Clone a public template into the host's own quizzes; returns the new quiz id. */
export async function useTemplate(templateId: string): Promise<string> {
  const t = await getTemplate(templateId);
  return createQuiz({
    title: t.title,
    description: t.description,
    logoUrl: null,
    questions: cloneQuestions(t.questions),
  });
}

/** Publish one of the host's quizzes to the public library. */
export async function publishTemplate(quizId: string, category: string): Promise<void> {
  const owner = requireUid();
  const quiz = await getQuiz(quizId);
  await addDoc(collection(db, "templates"), {
    ownerUid: owner,
    title: quiz.title,
    description: quiz.description ?? null,
    category,
    questionCount: quiz.questions.length,
    questions: quiz.questions,
    authorName: auth.currentUser?.displayName ?? null,
    createdAt: serverTimestamp(),
  });
}

/** One-time seed of the curated starter templates (no-op if any exist). */
export async function seedStarterTemplates(): Promise<number> {
  const owner = requireUid();
  const existing = await getDocs(query(collection(db, "templates"), qLimit(1)));
  if (!existing.empty) return 0;
  let count = 0;
  for (const t of STARTER_TEMPLATES) {
    await addDoc(collection(db, "templates"), {
      ownerUid: owner,
      title: t.title,
      description: t.description,
      category: t.category,
      questionCount: t.questions.length,
      questions: t.questions,
      authorName: "iCare Quiz",
      createdAt: serverTimestamp(),
    });
    count++;
  }
  return count;
}

// ============================================
// Per-quiz analytics
// ============================================

/** Aggregate stats across every session the host has run for a quiz. */
export async function getQuizAnalytics(quizId: string): Promise<QuizAnalytics> {
  const uid = requireUid();
  const quiz = await getQuiz(quizId);

  const sessionsSnap = await getDocs(
    query(collection(db, "sessions"), where("quizId", "==", quizId), where("hostUid", "==", uid))
  );

  let totalPlayers = 0;
  let totalAnswers = 0;
  let totalCorrect = 0;
  let totalPoints = 0;
  let lastPlayedAt: string | null = null;

  const perQ = new Map<string, { answers: number; correct: number; timeMs: number; timed: number }>();
  quiz.questions.forEach((q) => perQ.set(q.id, { answers: 0, correct: 0, timeMs: 0, timed: 0 }));

  for (const s of sessionsSnap.docs) {
    const createdAt = tsToIso(s.data().createdAt);
    if (!lastPlayedAt || createdAt > lastPlayedAt) lastPlayedAt = createdAt;

    const partsSnap = await getDocs(collection(db, "sessions", s.id, "participants"));
    const active = partsSnap.docs.filter((p) => !p.data().isKicked);
    totalPlayers += active.length;
    active.forEach((p) => (totalPoints += p.data().totalPoints || 0));

    const ansSnap = await getDocs(collection(db, "sessions", s.id, "answers"));
    ansSnap.docs.forEach((a) => {
      const d = a.data();
      totalAnswers++;
      if (d.isCorrect) totalCorrect++;
      const e = perQ.get(d.questionId);
      if (e) {
        e.answers++;
        if (d.isCorrect) e.correct++;
        if (typeof d.answerTimeMs === "number") {
          e.timeMs += d.answerTimeMs;
          e.timed++;
        }
      }
    });
  }

  const questions = quiz.questions.map((q, i) => {
    const e = perQ.get(q.id)!;
    return {
      questionId: q.id,
      index: i,
      prompt: q.prompt,
      type: q.type,
      totalAnswers: e.answers,
      correctCount: e.correct,
      correctRate: e.answers ? Math.round((e.correct / e.answers) * 100) : 0,
      averageTimeMs: e.timed ? Math.round(e.timeMs / e.timed) : null,
    };
  });

  const possibleAnswers = totalPlayers * quiz.questions.length;

  return {
    quizId,
    quizTitle: quiz.title,
    sessionCount: sessionsSnap.size,
    totalPlayers,
    totalAnswers,
    overallCorrectRate: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    averageScore: totalPlayers ? Math.round(totalPoints / totalPlayers) : 0,
    completionRate: possibleAnswers ? Math.round((totalAnswers / possibleAnswers) * 100) : null,
    lastPlayedAt,
    questions,
  };
}

// ============================================
// CSV export (client-side)
// ============================================

export async function exportSessionCsv(sessionId: string): Promise<void> {
  const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionSnap.exists()) throw new Error("Session not found");
  const session = sessionSnap.data();
  const quiz = await getQuiz(session.quizId);
  const questions = quiz.questions;

  const participantsSnap = await getDocs(
    query(
      collection(db, "sessions", sessionId, "participants"),
      orderBy("totalPoints", "desc"),
      orderBy("joinedAt", "asc")
    )
  );
  const participants = participantsSnap.docs.filter((d) => !d.data().isKicked);

  const answersSnap = await getDocs(collection(db, "sessions", sessionId, "answers"));
  const answerMap = new Map<string, DocumentData>();
  answersSnap.docs.forEach((a) => answerMap.set(`${a.data().questionId}_${a.data().uid}`, a.data()));

  const headers = [
    "Rank",
    "Nickname",
    "Total Points",
    ...questions.flatMap((_, i) => [`Q${i + 1} Correct`, `Q${i + 1} Points`, `Q${i + 1} Time (s)`]),
  ];

  const rows = participants.map((p, idx) => {
    const row: (string | number)[] = [idx + 1, p.data().nickname, p.data().totalPoints ?? 0];
    questions.forEach((q) => {
      const ans = answerMap.get(`${q.id}_${p.id}`);
      if (ans) {
        row.push(ans.isCorrect ? "Yes" : "No");
        row.push(ans.pointsAwarded ?? 0);
        row.push(((ans.answerTimeMs ?? 0) / 1000).toFixed(2));
      } else {
        row.push("No Answer", 0, "-");
      }
    });
    return row;
  });

  const escapeCSV = (val: string | number) => {
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(session.quizTitle || "quiz").replace(/[^a-zA-Z0-9]/g, "_")}_results_${session.gamePin}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
