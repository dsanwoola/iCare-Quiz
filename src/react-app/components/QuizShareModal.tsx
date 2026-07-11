import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import {
  Share2,
  MessageCircle,
  Send,
  Copy,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createSession } from "@/react-app/lib/data";

interface QuizShareModalProps {
  quizId: string;
  quizTitle: string;
  gamePin: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuizShareModal({
  quizId,
  quizTitle,
  open,
  onOpenChange,
}: QuizShareModalProps) {
  const navigate = useNavigate();
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Creating (or reusing) a session mints the shareable game PIN.
  useEffect(() => {
    let cancelled = false;
    if (open && !gamePin) {
      createSession(quizId)
        .then((session) => {
          if (cancelled) return;
          setGamePin(session.gamePin);
          setSessionId(session.id);
        })
        .catch(() => {
          if (!cancelled) setError("Could not start a game for this quiz");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, quizId, gamePin]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setGamePin(null);
      setSessionId(null);
      setError(null);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const getJoinUrl = () => `${window.location.origin}/join/${gamePin}`;

  const getShareMessage = () => {
    return `🎮 Join my quiz "${quizTitle}" on Neighbours Quiz Arena!\n\n📍 Click to join: ${getJoinUrl()}\n\nSee you there! 🎉`;
  };

  const copyPin = async () => {
    if (!gamePin) return;
    await navigator.clipboard.writeText(gamePin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = async () => {
    if (!gamePin) return;
    await navigator.clipboard.writeText(getJoinUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareAndNavigate = async (platform: "whatsapp" | "sms" | "telegram") => {
    if (!gamePin || !sessionId) return;

    setIsSharing(true);
    setError(null);

    try {
      const message = encodeURIComponent(getShareMessage());

      switch (platform) {
        case "whatsapp":
          window.open(`https://wa.me/?text=${message}`, "_blank");
          break;
        case "sms":
          window.open(`sms:?body=${message}`, "_blank");
          break;
        case "telegram": {
          const text = encodeURIComponent(`🎮 Join my quiz "${quizTitle}" on Neighbours Quiz Arena!`);
          window.open(`https://t.me/share/url?url=${encodeURIComponent(getJoinUrl())}&text=${text}`, "_blank");
          break;
        }
      }

      // Navigate to waiting room after sharing
      onOpenChange(false);
      navigate(`/host/session/${sessionId}/waiting`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Quiz
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-destructive mb-4">{error}</p>
          </div>
        )}

        {gamePin && (
          <div className="space-y-6">
            {/* PIN Display */}
            <div className="text-center p-6 bg-muted/50 rounded-2xl">
              <p className="text-sm text-muted-foreground mb-2">Game PIN</p>
              <div className="text-4xl font-black tracking-[0.15em] text-primary mb-3">
                {gamePin}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyPin}
                className="rounded-lg"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy PIN
                  </>
                )}
              </Button>
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-3 rounded-2xl border">
                <QRCodeSVG value={getJoinUrl()} size={140} level="M" />
              </div>
              <p className="text-xs text-muted-foreground">Scan to join</p>
            </div>

            {/* Join Link */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Join Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm font-mono truncate">
                  {getJoinUrl()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg"
                >
                  {linkCopied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Share Options */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Share via:
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => shareAndNavigate("whatsapp")}
                  disabled={isSharing}
                  className="h-14 flex-col gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 rounded-xl"
                >
                  {isSharing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  )}
                  <span className="text-xs">WhatsApp</span>
                </Button>

                <Button
                  onClick={() => shareAndNavigate("sms")}
                  disabled={isSharing}
                  className="h-14 flex-col gap-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 rounded-xl"
                >
                  {isSharing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-5 h-5" />
                  )}
                  <span className="text-xs">SMS</span>
                </Button>

                <Button
                  onClick={() => shareAndNavigate("telegram")}
                  disabled={isSharing}
                  className="h-14 flex-col gap-1 bg-[#0088cc] hover:bg-[#0077b3] text-white border-0 rounded-xl"
                >
                  {isSharing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span className="text-xs">Telegram</span>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              After sharing, you'll go to the waiting room to start the game
            </p>
          </div>
        )}

        {!gamePin && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Loading quiz PIN...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
