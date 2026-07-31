import { z } from "zod";

// ============================================
// Core enums & value objects
// ============================================

// MCQ = single choice, TF = true/false, MULTI = multiple choice,
// SHORT = type-the-answer (text), NUMERIC = numeric answer (with tolerance),
// ORDER = arrange the options into the correct sequence.
export const QuestionTypeEnum = z.enum(["MCQ", "TF", "MULTI", "SHORT", "NUMERIC", "ORDER"]);
export type QuestionType = z.infer<typeof QuestionTypeEnum>;

/** Option-based "pick" types render answer buttons; the rest take other input. */
export const OPTION_TYPES: QuestionType[] = ["MCQ", "TF", "MULTI"];
export function isOptionType(type: QuestionType): boolean {
  return OPTION_TYPES.includes(type);
}

export const QuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string().max(300),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const SessionStatusEnum = z.enum(["WAITING", "LIVE", "ENDED"]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const QuestionStatusEnum = z.enum(["CLOSED", "OPEN", "REVEAL"]);
export type QuestionStatus = z.infer<typeof QuestionStatusEnum>;

// ============================================
// Quiz authoring (client-side validation)
// ============================================

export const QuestionInputSchema = z.object({
  id: z.string(),
  type: QuestionTypeEnum,
  prompt: z.string().min(1, "Question prompt is required").max(500),
  // Optional image shown above the question.
  imageUrl: z.string().nullable().optional(),
  // Empty for SHORT/NUMERIC (typed-answer) questions.
  options: z.array(QuestionOptionSchema).max(6),
  // For option types: correct option ids. For SHORT: accepted text answers.
  // For NUMERIC: a single stringified number.
  correctAnswers: z.array(z.string()).min(1, "Provide at least one correct answer"),
  // Optional ± tolerance for NUMERIC questions.
  numericTolerance: z.number().min(0).optional(),
  durationSeconds: z.number().min(5).max(300).default(20),
  basePoints: z.number().min(1).max(5000).default(1000),
});
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

export const QuizInputSchema = z.object({
  title: z.string().min(1, "Quiz title is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  questions: z.array(QuestionInputSchema).min(1, "At least one question is required"),
});
export type QuizInput = z.infer<typeof QuizInputSchema>;

// A fully-realized question as stored on the quiz document.
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  options: QuestionOption[];
  correctAnswers: string[];
  numericTolerance?: number;
  durationSeconds: number;
  basePoints: number;
}

// ============================================
// Teams
// ============================================

export interface Team {
  id: string;
  name: string;
  color: string;
}

export const PRESET_TEAMS: Team[] = [
  { id: "red", name: "Red", color: "#ef4444" },
  { id: "blue", name: "Blue", color: "#3b82f6" },
  { id: "green", name: "Green", color: "#22c55e" },
  { id: "yellow", name: "Yellow", color: "#eab308" },
];

export interface TeamStanding {
  team: Team;
  totalPoints: number;
  memberCount: number;
  rank: number;
}

// ============================================
// API/response shapes consumed by the UI
// ============================================

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  gamePin: string | null;
  createdAt: string;
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  logoUrl: string | null;
  gamePin: string | null;
  questions: Question[];
}

export interface SessionInfo {
  id: string;
  quizId: string;
  quizTitle: string;
  quizLogoUrl: string | null;
  gamePin: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questionStatus: QuestionStatus;
  totalQuestions: number;
  participantCount: number;
  isRoomLocked: boolean;
  teamMode: boolean;
  teams: Team[];
  getReadySeconds: number;
  gameMode: GameMode;
  ad: CountdownAd | null;
  createdAt: string;
}

/** Allowed "get ready" countdown intervals (seconds). */
export const GET_READY_OPTIONS = [10, 20, 30] as const;

// ============================================
// Game mode, ads, admin & plans
// ============================================

// manual = host clicks through; auto = the game advances itself (Pro only).
export type GameMode = "manual" | "auto";

/** A sponsor/ad shown on the "get ready" countdown screen. */
export interface CountdownAd {
  text: string;
  imageUrl?: string | null;
  url?: string | null;
}

/** House ad shown by default — invites people to buy the slot. */
export const HOUSE_AD: CountdownAd = {
  text: "📣 Your ad here — reach every player between questions. Tap to advertise.",
  imageUrl: null,
  url: null,
};

/** App-wide settings an admin controls (Firestore: config/app). */
export interface AppConfig {
  defaultGameMode: GameMode;
  defaultCountdownSeconds: number;
  countdownSoundEnabled: boolean;
  defaultAd: CountdownAd | null;
  proEmails: string[];
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  defaultGameMode: "manual",
  defaultCountdownSeconds: 10,
  countdownSoundEnabled: true,
  defaultAd: null,
  proEmails: [],
};

// The app admin(s). Enforced in Firestore rules too.
export const ADMIN_EMAILS = ["dsanwoola@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/** A user is "Pro" if they're an admin or their email is on the pro list. */
export function isProEmail(email: string | null | undefined, proEmails: string[]): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return isAdminEmail(e) || proEmails.map((x) => x.toLowerCase()).includes(e);
}

export interface ParticipantInfo {
  id: string;
  nickname: string;
  role: string;
  totalPoints: number;
  streak: number;
  currentRank: number | null;
  isKicked: boolean;
  teamId: string | null;
}

export interface JoinResult {
  participantId: string;
  sessionId: string;
  nickname: string;
  quizTitle: string;
  quizLogoUrl: string | null;
  status: SessionStatus;
  teamId: string | null;
  team: Team | null;
}

// Public (player-safe) view of the current question — never includes the
// correct answers. Pushed onto the session document by the host.
export interface PublicQuestion {
  questionId: string;
  questionIndex: number;
  totalQuestions: number;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  options: QuestionOption[];
  durationSeconds: number;
  basePoints: number;
}

export interface CurrentQuestion extends PublicQuestion {
  questionStatus: QuestionStatus;
  questionStartedAt: string | null;
  timeRemainingMs: number | null;
}

export interface QuestionResult {
  questionId: string;
  prompt: string;
  options: QuestionOption[];
  correctAnswers: string[];
  answerDistribution: { optionId: string; count: number; percentage: number }[];
  totalAnswers: number;
  correctCount: number;
  averageTimeMs: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  nickname: string;
  totalPoints: number;
  lastAnswerPoints: number | null;
  streak: number;
  teamId: string | null;
}

export interface AnswerResult {
  isCorrect: boolean;
  pointsAwarded: number;
  correctAnswers: string[];
  totalPoints: number;
  rank: number;
}

// ============================================
// Analytics
// ============================================

export interface QuestionAnalytics {
  questionId: string;
  index: number;
  prompt: string;
  type: QuestionType;
  totalAnswers: number;
  correctCount: number;
  correctRate: number; // 0–100
  averageTimeMs: number | null;
}

export interface QuizAnalytics {
  quizId: string;
  quizTitle: string;
  sessionCount: number;
  totalPlayers: number;
  totalAnswers: number;
  overallCorrectRate: number; // 0–100
  averageScore: number;
  completionRate: number | null; // 0–100, % of possible answers actually submitted
  lastPlayedAt: string | null;
  questions: QuestionAnalytics[];
}

// ============================================
// Public template library
// ============================================

export const TEMPLATE_CATEGORIES = [
  "General",
  "Science",
  "Geography",
  "History",
  "Pop Culture",
  "Education",
  "Business",
] as const;

export interface QuizTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  questionCount: number;
  authorName: string | null;
  createdAt: string;
}

export interface QuizTemplateDetail extends QuizTemplate {
  questions: Question[];
}

export interface SessionHistoryItem {
  id: string;
  quizId: string;
  quizTitle: string;
  gamePin: string;
  status: SessionStatus;
  participantCount: number;
  questionCount: number;
  createdAt: string;
  endedAt: string | null;
}

export const JoinSessionSchema = z.object({
  pin: z.string().length(6, "Game PIN must be 6 digits"),
  nickname: z.string().min(1, "Nickname is required").max(20, "Nickname too long"),
});
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
