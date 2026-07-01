import { useRef, useState } from "react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Card } from "@/react-app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import {
  Trash2,
  Plus,
  GripVertical,
  Check,
  Clock,
  Star,
  CircleDot,
  ToggleLeft,
  ListChecks,
  Type,
  Hash,
  ListOrdered,
  ImageIcon,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Question, QuestionType, QuestionOption } from "@/shared/types";
import { isOptionType } from "@/shared/types";
import { uploadLogo } from "@/react-app/lib/data";

// Re-exported so existing importers (QuizEditor) keep working.
export type { Question, QuestionType, QuestionOption };

interface QuestionEditorProps {
  question: Question;
  index: number;
  onChange: (question: Question) => void;
  onDelete: () => void;
}

const questionTypeConfig: Record<QuestionType, { label: string; icon: typeof CircleDot; description: string }> = {
  MCQ: { label: "Multiple Choice", icon: CircleDot, description: "Single correct answer" },
  TF: { label: "True / False", icon: ToggleLeft, description: "Two options" },
  MULTI: { label: "Multi-Select", icon: ListChecks, description: "Multiple correct answers" },
  SHORT: { label: "Type Answer", icon: Type, description: "Players type a text answer" },
  NUMERIC: { label: "Numeric", icon: Hash, description: "Players enter a number" },
  ORDER: { label: "Ordering", icon: ListOrdered, description: "Arrange items in order" },
};

const durationOptions = [10, 15, 20, 30, 45, 60, 90, 120];
const pointOptions = [500, 750, 1000, 1500, 2000];

function emptyOptions(n = 4): QuestionOption[] {
  return Array.from({ length: n }, () => ({ id: crypto.randomUUID(), text: "" }));
}

export default function QuestionEditor({ question, index, onChange, onDelete }: QuestionEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const updateQuestion = (updates: Partial<Question>) => onChange({ ...question, ...updates });

  const handleTypeChange = (type: QuestionType) => {
    if (type === question.type) return;
    if (type === "TF") {
      updateQuestion({
        type,
        options: [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ],
        correctAnswers: [],
      });
    } else if (type === "MCQ" || type === "MULTI") {
      const options = isOptionType(question.type) && question.type !== "TF" ? question.options : emptyOptions();
      updateQuestion({ type, options, correctAnswers: [] });
    } else if (type === "ORDER") {
      const options = question.options.length >= 2 && question.type !== "TF" ? question.options : emptyOptions(3);
      updateQuestion({ type, options, correctAnswers: options.map((o) => o.id) });
    } else {
      // SHORT / NUMERIC — typed answers, no options.
      updateQuestion({ type, options: [], correctAnswers: [""], numericTolerance: type === "NUMERIC" ? 0 : undefined });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadLogo(file);
      updateQuestion({ imageUrl: url });
    } catch {
      /* ignore — surfaced via missing preview */
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // Option handlers (MCQ/TF/MULTI). For ORDER, correctAnswers mirror the order.
  const isOrder = question.type === "ORDER";
  const commitOptions = (options: QuestionOption[], correctAnswers?: string[]) =>
    updateQuestion({
      options,
      correctAnswers: isOrder ? options.map((o) => o.id) : correctAnswers ?? question.correctAnswers,
    });

  const addOption = () => {
    if (question.options.length >= 6) return;
    commitOptions([...question.options, { id: crypto.randomUUID(), text: "" }]);
  };
  const updateOption = (optionId: string, text: string) =>
    commitOptions(question.options.map((o) => (o.id === optionId ? { ...o, text } : o)));
  const removeOption = (optionId: string) => {
    if (question.options.length <= 2) return;
    commitOptions(
      question.options.filter((o) => o.id !== optionId),
      question.correctAnswers.filter((id) => id !== optionId)
    );
  };
  const moveOption = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= question.options.length) return;
    const opts = [...question.options];
    [opts[i], opts[j]] = [opts[j], opts[i]];
    commitOptions(opts);
  };
  const toggleCorrectAnswer = (optionId: string) => {
    if (question.type === "MULTI") {
      const selected = question.correctAnswers.includes(optionId);
      updateQuestion({
        correctAnswers: selected
          ? question.correctAnswers.filter((id) => id !== optionId)
          : [...question.correctAnswers, optionId],
      });
    } else {
      updateQuestion({ correctAnswers: [optionId] });
    }
  };

  // SHORT accepted-answer editing.
  const updateAccepted = (i: number, text: string) =>
    updateQuestion({ correctAnswers: question.correctAnswers.map((a, idx) => (idx === i ? text : a)) });
  const addAccepted = () => updateQuestion({ correctAnswers: [...question.correctAnswers, ""] });
  const removeAccepted = (i: number) =>
    updateQuestion({ correctAnswers: question.correctAnswers.filter((_, idx) => idx !== i) });

  const optionColors = [
    "border-red-400 bg-red-50 dark:bg-red-950/30",
    "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
    "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
    "border-green-400 bg-green-50 dark:bg-green-950/30",
    "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
    "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
  ];

  return (
    <Card className="p-6 rounded-2xl border-2 hover:border-primary/20 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex items-center gap-2 text-muted-foreground cursor-grab">
          <GripVertical className="w-5 h-5" />
          <span className="text-lg font-bold">Q{index + 1}</span>
        </div>

        <div className="flex-1">
          {/* Question Type Selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(questionTypeConfig) as QuestionType[]).map((type) => {
              const config = questionTypeConfig[type];
              const Icon = config.icon;
              const isSelected = question.type === type;
              return (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Question Prompt */}
          <Textarea
            placeholder="Enter your question..."
            value={question.prompt}
            onChange={(e) => updateQuestion({ prompt: e.target.value })}
            className="text-lg min-h-[80px] rounded-xl resize-none"
          />

          {/* Image attachment */}
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <div className="mt-3">
            {question.imageUrl ? (
              <div className="relative inline-block">
                <img src={question.imageUrl} alt="Question" className="h-28 rounded-xl border object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                  onClick={() => updateQuestion({ imageUrl: null })}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-lg"
              >
                {uploadingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                Add image
              </Button>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Answers */}
      {isOptionType(question.type) ? (
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">
            {question.type === "MULTI" ? "Select all correct answers:" : "Select the correct answer:"}
          </p>
          {question.options.map((option, optIdx) => {
            const isCorrect = question.correctAnswers.includes(option.id);
            return (
              <div
                key={option.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  optionColors[optIdx % optionColors.length]
                } ${isCorrect ? "ring-2 ring-success ring-offset-2" : ""}`}
              >
                <button
                  onClick={() => toggleCorrectAnswer(option.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isCorrect ? "bg-success text-white" : "bg-white dark:bg-gray-800 border-2 hover:border-success"
                  }`}
                >
                  {isCorrect && <Check className="w-5 h-5" />}
                </button>

                {question.type === "TF" ? (
                  <span className="flex-1 font-medium">{option.text}</span>
                ) : (
                  <Input
                    placeholder={`Option ${optIdx + 1}`}
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-base"
                  />
                )}

                {question.type !== "TF" && question.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(option.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {question.type !== "TF" && question.options.length < 6 && (
            <Button variant="outline" onClick={addOption} className="w-full rounded-xl border-dashed">
              <Plus className="w-4 h-4 mr-2" />
              Add Option
            </Button>
          )}
        </div>
      ) : question.type === "ORDER" ? (
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">
            Arrange the items in the correct order (top = first). Players see them shuffled.
          </p>
          {question.options.map((option, optIdx) => (
            <div key={option.id} className="flex items-center gap-2 p-3 rounded-xl border-2 border-muted">
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {optIdx + 1}
              </span>
              <Input
                placeholder={`Item ${optIdx + 1}`}
                value={option.text}
                onChange={(e) => updateOption(option.id, e.target.value)}
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-base"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => moveOption(optIdx, -1)}
                  disabled={optIdx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveOption(optIdx, 1)}
                  disabled={optIdx === question.options.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              {question.options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(option.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {question.options.length < 6 && (
            <Button variant="outline" onClick={addOption} className="w-full rounded-xl border-dashed">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      ) : question.type === "NUMERIC" ? (
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1.5">Correct number</p>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 42"
                value={question.correctAnswers[0] ?? ""}
                onChange={(e) => updateQuestion({ correctAnswers: [e.target.value] })}
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1.5">Tolerance (±)</p>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={question.numericTolerance ?? 0}
                onChange={(e) => updateQuestion({ numericTolerance: parseFloat(e.target.value) || 0 })}
                className="rounded-xl"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Answers within ± tolerance of the correct number are marked correct.
          </p>
        </div>
      ) : (
        // SHORT
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">
            Accepted answers (case-insensitive; any match counts):
          </p>
          {question.correctAnswers.map((ans, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border-2 border-green-400 bg-green-50 dark:bg-green-950/30">
              <Check className="w-5 h-5 text-success shrink-0" />
              <Input
                placeholder={`Accepted answer ${i + 1}`}
                value={ans}
                onChange={(e) => updateAccepted(i, e.target.value)}
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-base"
              />
              {question.correctAnswers.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAccepted(i)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={addAccepted} className="w-full rounded-xl border-dashed">
            <Plus className="w-4 h-4 mr-2" />
            Add Accepted Answer
          </Button>
        </div>
      )}

      {/* Settings Row */}
      <div className="flex flex-wrap gap-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Select
            value={question.durationSeconds.toString()}
            onValueChange={(v) => updateQuestion({ durationSeconds: parseInt(v) })}
          >
            <SelectTrigger className="w-[100px] h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((d) => (
                <SelectItem key={d} value={d.toString()}>
                  {d}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-muted-foreground" />
          <Select
            value={question.basePoints.toString()}
            onValueChange={(v) => updateQuestion({ basePoints: parseInt(v) })}
          >
            <SelectTrigger className="w-[110px] h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pointOptions.map((p) => (
                <SelectItem key={p} value={p.toString()}>
                  {p} pts
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
