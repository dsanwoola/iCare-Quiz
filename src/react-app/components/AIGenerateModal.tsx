import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import { Sparkles, Wand2 } from "lucide-react";
import { generateQuiz, type GenerateQuizOptions } from "@/react-app/lib/ai";
import { createQuiz } from "@/react-app/lib/data";

interface AIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLES = ["World capitals", "1990s pop music", "Human anatomy", "JavaScript basics", "Solar system"];

export default function AIGenerateModal({ open, onOpenChange }: AIGenerateModalProps) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState<GenerateQuizOptions["difficulty"]>("Medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Enter a topic to generate a quiz.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const quiz = await generateQuiz({
        topic: topic.trim(),
        count: parseInt(count),
        difficulty,
      });
      const id = await createQuiz(quiz);
      onOpenChange(false);
      // Land in the editor so the host can review/tweak before playing.
      navigate(`/host/quiz/${id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="gradient-primary w-8 h-8 rounded-lg flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            Generate Quiz with AI
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Sparkles className="w-16 h-16 text-primary animate-pulse" />
            </div>
            <p className="font-semibold">Writing your quiz…</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crafting {count} {difficulty.toLowerCase()} questions about “{topic}”
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Topic</label>
              <Input
                placeholder="e.g. The Roman Empire"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-11 rounded-xl"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setTopic(ex)}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Questions</label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["5", "10", "15", "20"].map((n) => (
                      <SelectItem key={n} value={n}>{n} questions</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Difficulty</label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as GenerateQuizOptions["difficulty"])}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Easy", "Medium", "Hard"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              onClick={handleGenerate}
              className="w-full gradient-primary text-white border-0 h-12 rounded-xl font-semibold"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Quiz
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You'll be able to review and edit every question before playing.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
