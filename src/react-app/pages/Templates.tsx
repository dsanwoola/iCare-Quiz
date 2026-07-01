import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { ArrowLeft, LayoutTemplate, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { QuizTemplate } from "@/shared/types";
import { listTemplates, useTemplate, seedStarterTemplates } from "@/react-app/lib/data";
import { useAuth } from "@/react-app/hooks/useAuth";
import AuthDialog from "@/react-app/components/AuthDialog";

const categoryColors: Record<string, string> = {
  Science: "#22c55e",
  Geography: "#3b82f6",
  History: "#eab308",
  "Pop Culture": "#ec4899",
  Education: "#8b5cf6",
  Business: "#f97316",
  General: "#64748b",
};

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { isHost } = useAuth();
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<string>("All");
  const [usingId, setUsingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = () =>
    listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterTemplates();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const visible = category === "All" ? templates : templates.filter((t) => t.category === category);

  const handleUse = async (id: string) => {
    if (!isHost) {
      setAuthOpen(true);
      return;
    }
    setUsingId(id);
    try {
      const newQuizId = await useTemplate(id);
      navigate(`/host/quiz/${newQuizId}/edit`);
    } catch {
      setUsingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to={isHost ? "/host" : "/"} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Template Library</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-muted-foreground mb-6">
          Start from a ready-made quiz. Pick one, and it's copied into your account to edit and play.
        </p>

        {/* Category filter */}
        {!isLoading && templates.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <LayoutTemplate className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No templates yet</h2>
            <p className="text-muted-foreground mb-6">
              {isHost ? "Load our starter templates to populate the library." : "Check back soon — the library is being populated."}
            </p>
            {isHost && (
              <Button onClick={handleSeed} disabled={seeding} className="gradient-primary text-white border-0 rounded-xl">
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Load starter templates
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((t) => {
              const color = categoryColors[t.category] ?? categoryColors.General;
              return (
                <Card key={t.id} className="p-6 rounded-2xl border-2 hover:border-primary/30 transition-all hover:shadow-lg flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {t.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {t.questionCount}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1">{t.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                    {t.description || "No description"}
                  </p>
                  {t.authorName && (
                    <p className="text-xs text-muted-foreground mb-3">by {t.authorName}</p>
                  )}
                  <Button
                    onClick={() => handleUse(t.id)}
                    disabled={usingId === t.id}
                    className="w-full gradient-primary text-white border-0 rounded-xl"
                  >
                    {usingId === t.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : isHost ? (
                      <Wand2 className="w-4 h-4 mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {isHost ? "Use Template" : "Sign in to use"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
