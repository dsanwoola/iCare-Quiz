import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { ArrowLeft, Users, Zap, Sparkles, Loader2 } from "lucide-react";
import { sounds, playSound, initAudio } from "@/react-app/lib/feedback";
import { getSessionByPin, joinSession } from "@/react-app/lib/data";

export default function JoinGame() {
  const navigate = useNavigate();
  const { gamePin: urlPin } = useParams();
  const [gamePin, setGamePin] = useState(urlPin || "");
  const [nickname, setNickname] = useState("");
  const [step, setStep] = useState<"pin" | "nickname">(urlPin ? "nickname" : "pin");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(!!urlPin);

  // Validate PIN from URL on mount
  useEffect(() => {
    if (urlPin && urlPin.length === 6 && /^\d+$/.test(urlPin)) {
      validatePinFromUrl(urlPin);
    } else if (urlPin) {
      setError("Invalid game PIN");
      setStep("pin");
      setIsValidatingPin(false);
    }
  }, [urlPin]);

  const validatePinFromUrl = async (pin: string) => {
    try {
      const data = await getSessionByPin(pin);
      sessionStorage.setItem("quizTitle", data.quizTitle);
      setStep("nickname");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Game not found");
      setStep("pin");
    } finally {
      setIsValidatingPin(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    initAudio();
    playSound(sounds.tap);

    if (gamePin.length !== 6 || !/^\d+$/.test(gamePin)) {
      setError("Please enter a valid 6-digit game PIN");
      playSound(sounds.wrong);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getSessionByPin(gamePin);
      playSound(sounds.correct);
      sessionStorage.setItem("quizTitle", data.quizTitle);
      setIsTransitioning(true);
      setTimeout(() => {
        setStep("nickname");
        setIsTransitioning(false);
      }, 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Game not found");
      playSound(sounds.wrong);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    playSound(sounds.tap);

    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length < 2) {
      setError("Nickname must be at least 2 characters");
      playSound(sounds.wrong);
      return;
    }

    if (trimmedNickname.length > 20) {
      setError("Nickname must be 20 characters or less");
      playSound(sounds.wrong);
      return;
    }

    setIsLoading(true);
    try {
      const data = await joinSession(gamePin, trimmedNickname);

      playSound(sounds.gameStart);
      sessionStorage.setItem("participantId", data.participantId);
      sessionStorage.setItem("sessionId", data.sessionId);
      sessionStorage.setItem("nickname", data.nickname);
      sessionStorage.setItem("quizTitle", data.quizTitle);
      if (data.quizLogoUrl) {
        sessionStorage.setItem("quizLogoUrl", data.quizLogoUrl);
      } else {
        sessionStorage.removeItem("quizLogoUrl");
      }

      navigate(`/play/${gamePin}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join game");
      playSound(sounds.wrong);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 safe-area-inset">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-secondary/5 to-transparent rounded-full" />
      </div>

      <Link
        to="/"
        className="absolute top-6 left-6 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 p-2 -m-2 active:scale-95"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back</span>
      </Link>

      {isValidatingPin ? (
        <div className="text-center">
          <div className="gradient-secondary p-4 rounded-2xl shadow-lg shadow-secondary/30 inline-block mb-6">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Finding game...</h2>
          <p className="text-muted-foreground">PIN: {gamePin}</p>
        </div>
      ) : (
      <div className={`w-full max-w-md transition-all duration-200 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-10">
          <div className="gradient-secondary p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-secondary/30">
            <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold">iCare Quiz Arena</span>
        </div>

        {step === "pin" ? (
          <form onSubmit={handlePinSubmit} className="space-y-4 sm:space-y-6">
            <div className="text-center mb-6 sm:mb-10">
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 text-blue-900">Join Game</h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Enter the PIN shown on screen
              </p>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={gamePin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setGamePin(value);
                    setError("");
                  }}
                  className="text-center text-3xl sm:text-5xl font-mono tracking-[0.3em] sm:tracking-[0.4em] h-16 sm:h-24 rounded-xl sm:rounded-2xl border-2 focus:border-secondary bg-card/50 backdrop-blur-sm transition-all placeholder:text-muted-foreground/30"
                  autoFocus
                />
                {gamePin.length === 6 && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Sparkles className="w-6 h-6 text-secondary animate-pulse" />
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm text-center animate-shake">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={gamePin.length !== 6 || isLoading}
                className="w-full gradient-secondary text-white border-0 h-12 sm:h-16 text-lg sm:text-xl rounded-xl sm:rounded-2xl font-bold disabled:opacity-50 shadow-lg shadow-secondary/30 active:scale-[0.98] transition-transform"
              >
                {isLoading ? (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    Join Game
                  </>
                )}
              </Button>
            </div>

            {/* Visual hint */}
            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8">
              Look at the main screen for the game PIN
            </p>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 sm:space-y-6">
            <div className="text-center mb-6 sm:mb-10">
              <button
                type="button"
                onClick={() => setStep("pin")}
                className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold mb-4 sm:mb-5 active:scale-95 transition-transform"
              >
                <span className="font-mono">PIN: {gamePin}</span>
                <span className="text-secondary/60">← tap to change</span>
              </button>
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 text-blue-900">Your Nickname</h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                How should we call you?
              </p>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <Input
                type="text"
                placeholder="Enter nickname"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                maxLength={20}
                className="text-center text-xl sm:text-3xl h-14 sm:h-20 rounded-xl sm:rounded-2xl border-2 focus:border-secondary bg-card/50 backdrop-blur-sm transition-all"
                autoFocus
              />

              <div className="text-center text-xs sm:text-sm text-muted-foreground">
                {nickname.length}/20 characters
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-2 sm:py-3 text-xs sm:text-sm text-center animate-shake">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={nickname.trim().length < 2 || isLoading}
                className="w-full gradient-secondary text-white border-0 h-12 sm:h-16 text-lg sm:text-xl rounded-xl sm:rounded-2xl font-bold disabled:opacity-50 shadow-lg shadow-secondary/30 active:scale-[0.98] transition-transform"
              >
                {isLoading ? (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    Join Game
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
      )}
    </div>
  );
}
