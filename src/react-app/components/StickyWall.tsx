import { useState } from "react";
import { X, Shuffle, Eye, EyeOff, Maximize2 } from "lucide-react";
import type { StickyNote } from "@/shared/types";
import { NOTE_COLORS } from "@/shared/types";

interface StickyWallProps {
  prompt: string;
  notes: StickyNote[];
  /** -1 = unlimited; otherwise only the newest N are rendered. */
  maxNotes: number;
  /** Host moderation — omit to hide delete affordances. */
  onDelete?: (noteId: string) => void;
  /** Compact mode for the smaller host panel (vs. full projector wall). */
  compact?: boolean;
}

/** Stable pseudo-random from a note id, so tilt never changes on re-render. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Density tier from how many notes are on the wall: 0 = few/large → 3 = many/tiny. */
function densityTier(n: number): number {
  if (n <= 6) return 0;
  if (n <= 18) return 1;
  if (n <= 45) return 2;
  return 3;
}

/** Font size scales with density AND text length, so short answers read big. */
function fontSizeFor(text: string, tier: number): number {
  const base = [34, 26, 20, 15][tier];
  const len = text.length;
  const scale = len <= 20 ? 1 : len <= 45 ? 0.85 : len <= 80 ? 0.72 : 0.62;
  return Math.max(11, Math.round(base * scale));
}

export default function StickyWall({
  prompt,
  notes,
  maxNotes,
  onDelete,
  compact = false,
}: StickyWallProps) {
  const [spotlight, setSpotlight] = useState<StickyNote | null>(null);
  const [handwritten, setHandwritten] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Free tier caps how many notes the wall renders; keep the newest.
  const capped = maxNotes > 0 && notes.length > maxNotes;
  let visible = capped ? notes.slice(-maxNotes) : notes;
  if (shuffleSeed > 0) {
    visible = [...visible].sort(
      (a, b) => ((hashOf(a.id + shuffleSeed) % 1000) - (hashOf(b.id + shuffleSeed) % 1000))
    );
  }

  const tier = densityTier(visible.length);
  const cols = compact ? [1, 2, 2, 3][tier] : [2, 3, 4, 6][tier];
  const noteFont = handwritten
    ? `'Caveat', 'Segoe Script', 'Bradley Hand', cursive`
    : `ui-sans-serif, system-ui, sans-serif`;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Prompt header */}
      <div className="flex items-start justify-between gap-4 mb-3 sm:mb-4 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Sticky Wall
          </p>
          <h2
            className={`font-black text-neutral-900 leading-tight break-words ${
              compact ? "text-lg" : "text-2xl sm:text-4xl"
            }`}
          >
            {prompt}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-neutral-900 text-white text-sm font-bold px-3 py-1.5 tabular-nums">
            {notes.length}
          </span>
          <button
            onClick={() => setHandwritten((h) => !h)}
            title={handwritten ? "Switch to clean type" : "Switch to handwriting"}
            className="p-2 rounded-lg hover:bg-neutral-200/70 text-neutral-600"
          >
            {handwritten ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShuffleSeed((s) => s + 1)}
            title="Shuffle layout"
            className="p-2 rounded-lg hover:bg-neutral-200/70 text-neutral-600"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Whiteboard */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-inner p-4 sm:p-6"
        style={{
          backgroundColor: "#FAFAF7",
          backgroundImage: "radial-gradient(#D8D8D0 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400">
            <div className="w-16 h-16 rounded-xl bg-yellow-200/70 rotate-[-6deg] shadow mb-4" />
            <p className="font-semibold text-neutral-500">Waiting for the first note…</p>
            <p className="text-sm">Answers appear here the moment they're sent.</p>
          </div>
        ) : (
          <div style={{ columnCount: cols, columnGap: "1rem" }}>
            {visible.map((n) => {
              const h = hashOf(n.id);
              const rot = ((h % 900) / 100 - 4.5).toFixed(2);
              const c = NOTE_COLORS[n.color] ?? NOTE_COLORS[0];
              return (
                <div
                  key={n.id}
                  className="group relative mb-4 break-inside-avoid animate-note-pop"
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  <div
                    className="relative rounded-[3px] px-4 py-3 shadow-[0_6px_14px_rgba(0,0,0,0.16)]"
                    style={{ backgroundColor: c.bg, color: c.ink }}
                  >
                    <p
                      className="whitespace-pre-wrap break-words leading-snug font-semibold"
                      style={{ fontFamily: noteFont, fontSize: fontSizeFor(n.text, tier) }}
                    >
                      {n.text}
                    </p>
                    {/* folded corner */}
                    <div
                      className="absolute bottom-0 right-0 w-0 h-0"
                      style={{
                        borderLeft: "14px solid transparent",
                        borderBottom: `14px solid rgba(0,0,0,0.10)`,
                      }}
                    />
                    {/* host controls */}
                    <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                      <button
                        onClick={() => setSpotlight(n)}
                        title="Spotlight"
                        className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(n.id)}
                          title="Remove note"
                          className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {capped && (
          <div className="sticky bottom-0 mt-2 text-center">
            <span className="inline-block rounded-full bg-neutral-900/85 text-white text-xs font-semibold px-3 py-1.5">
              Showing the newest {maxNotes} of {notes.length} — upgrade for the full wall
            </span>
          </div>
        )}
      </div>

      {/* Spotlight overlay */}
      {spotlight && (
        <button
          onClick={() => setSpotlight(null)}
          className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 sm:p-12"
        >
          <div
            className="max-w-3xl w-full rounded-lg px-8 py-10 shadow-2xl"
            style={{
              backgroundColor: (NOTE_COLORS[spotlight.color] ?? NOTE_COLORS[0]).bg,
              color: (NOTE_COLORS[spotlight.color] ?? NOTE_COLORS[0]).ink,
              transform: "rotate(-1.5deg)",
            }}
          >
            <p
              className="whitespace-pre-wrap break-words text-center font-bold leading-snug"
              style={{ fontFamily: noteFont, fontSize: spotlight.text.length > 60 ? 34 : 52 }}
            >
              {spotlight.text}
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
