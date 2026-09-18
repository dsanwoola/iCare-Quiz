import { useEffect, useState } from "react";
import { Loader2, Send, Check } from "lucide-react";
import { NOTE_CHAR_LIMIT, NOTE_COLORS } from "@/shared/types";
import { postNote } from "@/react-app/lib/data";

interface NoteComposerProps {
  sessionId: string;
  boardId: string;
  prompt: string;
  /** Notes this player may post to this board (from their host's tier). */
  maxNotes: number;
  nickname?: string | null;
  dark?: boolean;
}

/** How many notes this device has already posted to a board. Soft, per-device —
 *  the wall is host-read-only so we can't count server-side without exposing it. */
const countKey = (boardId: string) => `nqa-notes-${boardId}`;
function readCount(boardId: string): number {
  try {
    return Number(sessionStorage.getItem(countKey(boardId))) || 0;
  } catch {
    return 0;
  }
}

export default function NoteComposer({
  sessionId,
  boardId,
  prompt,
  maxNotes,
  nickname,
  dark = false,
}: NoteComposerProps) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(() => Math.floor(Math.random() * NOTE_COLORS.length));
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(0);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPosted(readCount(boardId));
    setText("");
    setJustSent(false);
  }, [boardId]);

  const remaining = Math.max(0, maxNotes - posted);
  const canSend = text.trim().length > 0 && remaining > 0 && !posting;

  const send = async () => {
    if (!canSend) return;
    setPosting(true);
    setError(null);
    try {
      await postNote(sessionId, boardId, text, color, nickname ?? null);
      const next = posted + 1;
      setPosted(next);
      try {
        sessionStorage.setItem(countKey(boardId), String(next));
      } catch {
        /* private mode — limit is best-effort */
      }
      setText("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1800);
      // Re-roll the colour so a player's notes aren't all identical.
      setColor(Math.floor(Math.random() * NOTE_COLORS.length));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post that. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const label = dark ? "text-white" : "text-foreground";
  const sub = dark ? "text-white/60" : "text-muted-foreground";

  return (
    <div className="w-full max-w-md mx-auto">
      <p className={`text-xs uppercase tracking-[0.2em] ${sub} mb-1.5 text-center`}>
        Your answer
      </p>
      <h2 className={`text-xl sm:text-2xl font-black text-center mb-4 ${label}`}>{prompt}</h2>

      {remaining > 0 ? (
        <>
          <div
            className="rounded-lg p-3 shadow-lg transition-colors"
            style={{
              backgroundColor: NOTE_COLORS[color].bg,
              color: NOTE_COLORS[color].ink,
              transform: "rotate(-1deg)",
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, NOTE_CHAR_LIMIT))}
              rows={3}
              autoFocus
              placeholder="Type your answer…"
              className="w-full bg-transparent resize-none outline-none placeholder:opacity-50 font-semibold text-lg"
              style={{ fontFamily: `'Caveat', 'Segoe Script', cursive`, fontSize: 22 }}
            />
            <div className="text-right text-[11px] opacity-60 tabular-nums">
              {text.length}/{NOTE_CHAR_LIMIT}
            </div>
          </div>

          {/* Pick your sticky colour */}
          <div className="flex justify-center gap-2 mt-3">
            {NOTE_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setColor(i)}
                aria-label={`Colour ${i + 1}`}
                className={`w-7 h-7 rounded-md transition-transform ${
                  color === i ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-80"
                }`}
                style={{ backgroundColor: c.bg }}
              />
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-destructive/10 text-destructive rounded-xl px-4 py-2 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={send}
            disabled={!canSend}
            className="mt-4 w-full gradient-primary text-white border-0 h-12 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {posting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : justSent ? (
              <>
                <Check className="w-5 h-5" /> Posted!
              </>
            ) : (
              <>
                <Send className="w-5 h-5" /> Send to the wall
              </>
            )}
          </button>

          <p className={`text-[11px] text-center mt-2 ${sub}`}>
            Anonymous — your name isn't shown on the wall.
            {maxNotes > 1 && ` ${remaining} of ${maxNotes} left.`}
          </p>
        </>
      ) : (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-500" />
          </div>
          <p className={`font-bold ${label}`}>Posted! 🎉</p>
          <p className={`text-sm ${sub}`}>Look up at the wall to see it land.</p>
        </div>
      )}
    </div>
  );
}
