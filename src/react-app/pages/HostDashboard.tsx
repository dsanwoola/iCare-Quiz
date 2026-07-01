import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Card } from "@/react-app/components/ui/card";
import { useToast } from "@/react-app/components/ui/toast";
import {
  Plus,
  Play,
  Edit3,
  Trash2,
  ArrowLeft,
  FileText,
  Loader2,
  History,
  Sparkles,
  Share2,
  BarChart3,
  Globe,
  LayoutTemplate,
} from "lucide-react";
import QuizShareModal from "@/react-app/components/QuizShareModal";
import AIGenerateModal from "@/react-app/components/AIGenerateModal";
import PublishTemplateModal from "@/react-app/components/PublishTemplateModal";
import type { QuizSummary } from "@/shared/types";
import { sampleQuizzes } from "@/react-app/data/sampleQuizzes";
import { listQuizzes, createQuiz, deleteQuiz } from "@/react-app/lib/data";

export default function HostDashboard() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingSamples, setAddingSamples] = useState(false);
  const [shareQuiz, setShareQuiz] = useState<{ id: string; title: string; gamePin: string | null } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [publishQuiz, setPublishQuiz] = useState<{ id: string; title: string } | null>(null);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const data = await listQuizzes();
      setQuizzes(data);
    } catch {
      showError("Failed to load quizzes", "Please try refreshing the page");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSamples = async () => {
    setAddingSamples(true);
    try {
      for (const quiz of sampleQuizzes) {
        await createQuiz(quiz);
      }
      await fetchQuizzes();
      showSuccess("Sample quizzes added", "You can now edit or start them");
    } catch {
      showError("Failed to add samples", "Please try again");
    } finally {
      setAddingSamples(false);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    setDeletingId(quizId);
    try {
      await deleteQuiz(quizId);
      setQuizzes(quizzes.filter((q) => q.id !== quizId));
      showSuccess("Quiz deleted");
    } catch {
      showError("Failed to delete quiz", "Please try again");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">
              <span className="text-gradient text-blue-900">My Quizzes</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/templates">
              <Button variant="outline" className="rounded-xl">
                <LayoutTemplate className="w-4 h-4 mr-2" />
                Templates
              </Button>
            </Link>
            <Link to="/host/history">
              <Button variant="outline" className="rounded-xl">
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
            </Link>
            <Button variant="outline" className="rounded-xl" onClick={() => setAiOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              AI Generate
            </Button>
            <Link to="/host/create">
              <Button className="gradient-primary text-white border-0 rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                New Quiz
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-8">
          <Input
            placeholder="Search quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md h-12 rounded-xl"
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery ? "No matches found" : "No quizzes yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Create your first quiz to get started"}
            </p>
            {!searchQuery && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button className="gradient-primary text-white border-0 rounded-xl" onClick={() => setAiOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate with AI
                </Button>
                <Link to="/host/create">
                  <Button variant="outline" className="rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Manually
                  </Button>
                </Link>
                <span className="text-muted-foreground">or</span>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleAddSamples}
                  disabled={addingSamples}
                >
                  {addingSamples ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Add Sample Quizzes
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="p-6 rounded-2xl border-2 hover:border-primary/30 transition-all hover:shadow-lg group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/host/quiz/${quiz.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to={`/host/quiz/${quiz.id}/analytics`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Analytics">
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Publish to library"
                      onClick={() => setPublishQuiz({ id: quiz.id, title: quiz.title })}
                    >
                      <Globe className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(quiz.id)}
                      disabled={deletingId === quiz.id}
                    >
                      {deletingId === quiz.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-1">{quiz.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {quiz.description || "No description"}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {quiz.questionCount} question{quiz.questionCount !== 1 ? "s" : ""}
                  </div>
                  {quiz.gamePin && (
                    <div className="flex items-center gap-1 font-mono text-primary">
                      PIN: {quiz.gamePin}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link to={`/host/quiz/${quiz.id}/edit`}>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-10 w-10"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-10"
                    onClick={() => setShareQuiz({ id: quiz.id, title: quiz.title, gamePin: quiz.gamePin })}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Link to={`/host/session/new?quiz=${quiz.id}`}>
                    <Button className="gradient-primary text-white border-0 rounded-xl h-10 w-10" size="icon">
                      <Play className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AIGenerateModal open={aiOpen} onOpenChange={setAiOpen} />

      {publishQuiz && (
        <PublishTemplateModal
          quizId={publishQuiz.id}
          quizTitle={publishQuiz.title}
          open={!!publishQuiz}
          onOpenChange={(o) => !o && setPublishQuiz(null)}
        />
      )}

      {/* Share Modal */}
      {shareQuiz && (
        <QuizShareModal
          quizId={shareQuiz.id}
          quizTitle={shareQuiz.title}
          gamePin={shareQuiz.gamePin}
          open={!!shareQuiz}
          onOpenChange={(open) => !open && setShareQuiz(null)}
        />
      )}
    </div>
  );
}
