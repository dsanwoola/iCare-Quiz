import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Textarea } from "@/react-app/components/ui/textarea";
import { useToast } from "@/react-app/components/ui/toast";
import QuestionEditor, {
  Question,
  QuestionType,
} from "@/react-app/components/QuestionEditor";
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Loader2,
  FileText,
  Upload,
  ImageIcon,
  X,
} from "lucide-react";
import mammoth from "mammoth";
import type { QuizInput } from "@/shared/types";
import { isOptionType } from "@/shared/types";
import { getQuiz, createQuiz, updateQuiz, uploadLogo } from "@/react-app/lib/data";

// Parse quiz document text into question objects
function parseQuizDocument(text: string): Array<{
  type: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  durationSeconds: number;
  basePoints: number;
}> {
  const questions: Array<{
    type: string;
    prompt: string;
    options: Array<{ id: string; text: string }>;
    correctAnswers: string[];
    durationSeconds: number;
    basePoints: number;
  }> = [];

  // Split by question numbers (1., 2., 3., etc.)
  const questionPattern = /(\d+)\.\s*(.+?)(?=\n\s*\d+\.|$)/gs;
  let match;

  while ((match = questionPattern.exec(text)) !== null) {
    const questionBlock = match[2].trim();
    
    // Split into lines
    const lines = questionBlock.split("\n").map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) continue;

    // First line (or lines until we hit an option) is the question prompt
    let promptLines: string[] = [];
    let optionStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      // Check if line starts with option pattern (o A., A., a., etc.)
      if (/^(o\s+)?[A-Da-d][\.\)]/i.test(lines[i])) {
        optionStartIndex = i;
        break;
      }
      promptLines.push(lines[i]);
    }

    const prompt = promptLines.join(" ").trim();
    if (!prompt) continue;

    // Parse options
    const options: Array<{ id: string; text: string }> = [];
    const correctAnswers: string[] = [];
    const optionPattern = /^(o\s+)?([A-Da-d])[\.\)]\s*(.+)/i;

    for (let i = optionStartIndex; i < lines.length; i++) {
      const line = lines[i];
      const optionMatch = line.match(optionPattern);

      if (optionMatch) {
        let optionText = optionMatch[3].trim();
        const optionId = crypto.randomUUID();

        // Check if this option has the ✅ checkmark (correct answer)
        if (optionText.includes("✅") || optionText.includes("✓")) {
          correctAnswers.push(optionId);
          optionText = optionText.replace(/[✅✓]/g, "").trim();
        }

        options.push({ id: optionId, text: optionText });
      }
    }

    // Only add if we have options
    if (options.length >= 2) {
      questions.push({
        type: correctAnswers.length > 1 ? "MULTI" : "MCQ",
        prompt,
        options,
        correctAnswers,
        durationSeconds: 20,
        basePoints: 1000,
      });
    }
  }

  return questions;
}

function createEmptyQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: "MCQ",
    prompt: "",
    options: [
      { id: crypto.randomUUID(), text: "" },
      { id: crypto.randomUUID(), text: "" },
      { id: crypto.randomUUID(), text: "" },
      { id: crypto.randomUUID(), text: "" },
    ],
    correctAnswers: [],
    durationSeconds: 20,
    basePoints: 1000,
  };
}

export default function QuizEditor() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const isNew = !quizId || quizId === "new";
  const { showError } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createEmptyQuestion()]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew && quizId) {
      loadQuiz(quizId);
    }
  }, [quizId, isNew]);

  const loadQuiz = async (id: string) => {
    try {
      const data = await getQuiz(id);
      setTitle(data.title);
      setDescription(data.description || "");
      setLogoUrl(data.logoUrl || null);
      setQuestions(
        data.questions.map((q) => ({
          id: q.id || crypto.randomUUID(),
          type: q.type as QuestionType,
          prompt: q.prompt,
          imageUrl: q.imageUrl ?? null,
          options: q.options,
          correctAnswers: q.correctAnswers,
          numericTolerance: q.numericTolerance,
          durationSeconds: q.durationSeconds,
          basePoints: q.basePoints,
        }))
      );
    } catch {
      showError("Failed to load quiz", "Please try refreshing the page");
    } finally {
      setIsLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()]);
  };

  const updateQuestion = (index: number, question: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = question;
    setQuestions(newQuestions);
  };

  const deleteQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Invalid file", "Please upload an image file");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
    } catch (error) {
      showError("Upload failed", "Please try again");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      showError("Invalid file", "Please upload a .docx Word document");
      return;
    }

    setIsUploading(true);

    try {
      // Parse the document client-side using mammoth
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      // Parse the text to extract questions
      const parsedQuestionsRaw = parseQuizDocument(text);

      if (parsedQuestionsRaw.length === 0) {
        throw new Error("No questions found in document. Make sure questions are numbered (1., 2., etc.) with options A-D and ✅ marking correct answers.");
      }

      // Convert parsed questions to our Question format
      const parsedQuestions: Question[] = parsedQuestionsRaw.map((q) => ({
        id: crypto.randomUUID(),
        type: q.type as QuestionType,
        prompt: q.prompt,
        options: q.options,
        correctAnswers: q.correctAnswers,
        durationSeconds: q.durationSeconds,
        basePoints: q.basePoints,
      }));

      // Replace or append questions
      if (questions.length === 1 && !questions[0].prompt) {
        // If only empty question exists, replace it
        setQuestions(parsedQuestions);
      } else {
        // Otherwise append to existing questions
        setQuestions([...questions, ...parsedQuestions]);
      }

      // Extract title from filename if no title set
      if (!title) {
        const fileName = file.name.replace(".docx", "");
        setTitle(fileName);
      }
    } catch (error) {
      showError("Upload failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const validate = (): string[] => {
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push("Quiz title is required");
    }

    if (questions.length === 0) {
      errors.push("Add at least one question");
    }

    questions.forEach((q, i) => {
      if (!q.prompt.trim()) {
        errors.push(`Question ${i + 1}: Enter a question prompt`);
      }

      if (isOptionType(q.type)) {
        const hasEmptyOptions = q.options.some((opt) => !opt.text.trim());
        if (q.type !== "TF" && hasEmptyOptions) {
          errors.push(`Question ${i + 1}: Fill in all answer options`);
        }
        if (q.correctAnswers.length === 0) {
          errors.push(`Question ${i + 1}: Select at least one correct answer`);
        }
      } else if (q.type === "SHORT") {
        if (q.correctAnswers.filter((a) => a.trim()).length === 0) {
          errors.push(`Question ${i + 1}: Add at least one accepted answer`);
        }
      } else if (q.type === "NUMERIC") {
        if (!q.correctAnswers[0] || isNaN(parseFloat(q.correctAnswers[0]))) {
          errors.push(`Question ${i + 1}: Enter a valid correct number`);
        }
      } else if (q.type === "ORDER") {
        if (q.options.length < 2) {
          errors.push(`Question ${i + 1}: Add at least 2 items to order`);
        }
        if (q.options.some((o) => !o.text.trim())) {
          errors.push(`Question ${i + 1}: Fill in all items`);
        }
      }
    });

    return errors;
  };

  const handleSave = async (startSession = false) => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      validationErrors.forEach((err) => showError("Validation Error", err));
      return;
    }

    setIsSaving(true);

    try {
      const quizData: QuizInput = {
        title,
        description: description || null,
        logoUrl: logoUrl,
        questions: questions.map((q) => {
          // Normalize correct answers per type; omit undefined (Firestore rejects it).
          const correctAnswers =
            q.type === "SHORT"
              ? q.correctAnswers.map((a) => a.trim()).filter(Boolean)
              : q.type === "NUMERIC"
                ? [String(parseFloat(q.correctAnswers[0]))]
                : q.type === "ORDER"
                  ? q.options.map((o) => o.id)
                  : q.correctAnswers;
          const keepsOptions = isOptionType(q.type) || q.type === "ORDER";
          const base = {
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            imageUrl: q.imageUrl ?? null,
            options: keepsOptions ? q.options : [],
            correctAnswers,
            durationSeconds: q.durationSeconds,
            basePoints: q.basePoints,
          };
          return q.type === "NUMERIC" ? { ...base, numericTolerance: q.numericTolerance ?? 0 } : base;
        }),
      };

      let resultId = quizId;
      if (isNew) {
        resultId = await createQuiz(quizData);
      } else {
        await updateQuiz(quizId!, quizData);
      }

      if (startSession) {
        navigate(`/host/session/new?quiz=${resultId}`);
      } else {
        navigate("/host");
      }
    } catch (error) {
      showError("Failed to save quiz", error instanceof Error ? error.message : "Please try again");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/host"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">
              {isNew ? "Create Quiz" : "Edit Quiz"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="rounded-xl"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="gradient-primary text-white border-0 rounded-xl"
            >
              <Play className="w-4 h-4 mr-2" />
              Save & Start
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quiz Details */}
        <div className="bg-card border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900">Quiz Details</h2>
              <p className="text-sm text-muted-foreground">
                Give your quiz a title and description
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                placeholder="Enter quiz title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 text-lg rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Textarea
                placeholder="What's this quiz about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Waiting Room Image{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {logoUrl ? (
                <div className="relative inline-block">
                  <img
                    src={logoUrl}
                    alt="Quiz logo"
                    className="w-32 h-32 object-cover rounded-xl border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                    onClick={() => setLogoUrl(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="rounded-xl"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 mr-2" />
                  )}
                  Upload Image
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                This image appears on the player waiting room screen
              </p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-blue-900">
              Questions ({questions.length})
            </h2>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <QuestionEditor
                key={question.id}
                question={question}
                index={index}
                onChange={(q) => updateQuestion(index, q)}
                onDelete={() => deleteQuestion(index)}
              />
            ))}
          </div>
        </div>

        {/* Hidden file input for Word upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".docx"
          className="hidden"
        />

        {/* Add Question Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={addQuestion}
            variant="outline"
            className="flex-1 h-14 rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Question
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={isUploading}
            className="flex-1 h-14 rounded-2xl border-dashed border-2 hover:border-primary hover:bg-primary/5"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 mr-2" />
            )}
            {isUploading ? "Parsing..." : "Upload Word Doc"}
          </Button>
        </div>

        {/* Bottom spacing */}
        <div className="h-20" />
      </main>
    </div>
  );
}
