import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import {
  ArrowLeft,
  BarChart3,
  Users,
  Target,
  Clock,
  Trophy,
  Gamepad2,
  Loader2,
  TrendingDown,
  ListChecks,
} from "lucide-react";
import type { QuizAnalytics, QuestionAnalytics } from "@/shared/types";
import { getQuizAnalytics } from "@/react-app/lib/data";

function rateColor(rate: number) {
  if (rate >= 70) return "#22c55e";
  if (rate >= 40) return "#eab308";
  return "#ef4444";
}

const typeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  TF: "True / False",
  MULTI: "Multi-Select",
  SHORT: "Type Answer",
  NUMERIC: "Numeric",
  ORDER: "Ordering",
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 sm:p-5 rounded-2xl border-2">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs sm:text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function QuestionRow({ q }: { q: QuestionAnalytics }) {
  const color = rateColor(q.correctRate);
  return (
    <Card className="p-4 rounded-xl border">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-muted-foreground">Q{q.index + 1}</span>
            <span className="text-[10px] uppercase tracking-wide bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {typeLabels[q.type] ?? q.type}
            </span>
          </div>
          <p className="font-medium line-clamp-2">{q.prompt}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black tabular-nums" style={{ color }}>
            {q.totalAnswers > 0 ? `${q.correctRate}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">correct</div>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${q.correctRate}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5" />
          {q.correctCount}/{q.totalAnswers} correct
        </span>
        {q.averageTimeMs !== null && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {(q.averageTimeMs / 1000).toFixed(1)}s avg
          </span>
        )}
      </div>
    </Card>
  );
}

export default function QuizAnalyticsPage() {
  const { quizId } = useParams();
  const [data, setData] = useState<QuizAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    getQuizAnalytics(quizId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => setIsLoading(false));
  }, [quizId]);

  const hardest = data
    ? [...data.questions].filter((q) => q.totalAnswers > 0).sort((a, b) => a.correctRate - b.correctRate).slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/host" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold truncate">
              Analytics{data ? <span className="text-muted-foreground font-normal"> · {data.quizTitle}</span> : ""}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : data && data.sessionCount === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No data yet</h2>
            <p className="text-muted-foreground mb-6">Host a game with this quiz to start collecting analytics.</p>
            <Link to="/host">
              <Button className="gradient-primary text-white border-0 rounded-xl">Back to Dashboard</Button>
            </Link>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <StatCard icon={<Gamepad2 className="w-4 h-4" />} label="Games" value={String(data.sessionCount)} />
              <StatCard icon={<Users className="w-4 h-4" />} label="Players" value={String(data.totalPlayers)} />
              <StatCard icon={<Target className="w-4 h-4" />} label="Accuracy" value={`${data.overallCorrectRate}%`} sub={`${data.totalAnswers} answers`} />
              <StatCard icon={<Trophy className="w-4 h-4" />} label="Avg Score" value={data.averageScore.toLocaleString()} />
              <StatCard
                icon={<ListChecks className="w-4 h-4" />}
                label="Completion"
                value={data.completionRate !== null ? `${data.completionRate}%` : "—"}
                sub="answers submitted"
              />
            </div>

            {/* Hardest questions */}
            {hardest.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Hardest Questions
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  {hardest.map((q) => (
                    <Card key={q.questionId} className="p-4 rounded-xl border-2" style={{ borderColor: `${rateColor(q.correctRate)}55` }}>
                      <div className="text-3xl font-black mb-1" style={{ color: rateColor(q.correctRate) }}>
                        {q.correctRate}%
                      </div>
                      <p className="text-sm font-medium line-clamp-2">Q{q.index + 1}. {q.prompt}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Per-question breakdown */}
            <div>
              <h2 className="text-lg font-bold mb-3">Question Breakdown</h2>
              <div className="space-y-3">
                {data.questions.map((q) => (
                  <QuestionRow key={q.questionId} q={q} />
                ))}
              </div>
            </div>

            {data.lastPlayedAt && (
              <p className="text-xs text-muted-foreground text-center">
                Last played {new Date(data.lastPlayedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
