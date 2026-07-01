import { useState } from "react";
import { Button } from "@/react-app/components/ui/button";
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
import { Loader2, Globe, Check } from "lucide-react";
import { TEMPLATE_CATEGORIES } from "@/shared/types";
import { publishTemplate } from "@/react-app/lib/data";

interface PublishTemplateModalProps {
  quizId: string;
  quizTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PublishTemplateModal({ quizId, quizTitle, open, onOpenChange }: PublishTemplateModalProps) {
  const [category, setCategory] = useState<string>("General");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await publishTemplate(quizId, category);
      setDone(true);
      setTimeout(() => {
        onOpenChange(false);
        setDone(false);
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !publishing && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Publish to Template Library
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <p className="font-semibold">Published!</p>
            <p className="text-sm text-muted-foreground">Anyone can now find and use it.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share <span className="font-medium text-foreground">“{quizTitle}”</span> publicly so other hosts can copy
              and play it. Make sure it contains nothing private.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-sm text-center">{error}</div>
            )}
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full gradient-primary text-white border-0 h-12 rounded-xl font-semibold"
            >
              {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Globe className="w-4 h-4 mr-2" />Publish</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
