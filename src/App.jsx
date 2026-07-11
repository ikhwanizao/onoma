import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";

const SUGGESTED_TAGS = [
  "trap",
  "drill",
  "boom bap",
  "r&b",
  "afrobeats",
  "jersey club",
  "lofi",
  "dark",
  "dreamy",
  "aggressive",
  "bouncy",
  "melancholy",
];

const TAGS_REQUIRED_MESSAGE = "Add at least one tag describing the beat.";
const GENERIC_ERROR_MESSAGE = "Name generation hiccuped. Try again.";

const spring = { type: "spring", stiffness: 700, damping: 42 };

function formatCooldown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  function addTag(raw) {
    const tag = raw.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 focus-within:border-amber-400"
        onClick={() => inputRef.current?.focus()}
      >
        <AnimatePresence initial={false}>
          {tags.map((tag) => (
            <motion.span
              layout
              key={tag}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={spring}
              className="flex items-center gap-1 rounded-md bg-amber-400/10 py-1 pl-2.5 pr-1.5 text-sm leading-none text-amber-300"
            >
              {tag}
              <button
                type="button"
                aria-label={`remove ${tag}`}
                className="flex h-4 w-4 items-center justify-center rounded leading-none text-amber-300/60 hover:bg-amber-400/20 hover:text-amber-300"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
              >
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          enterKeyHint="enter"
          placeholder={tags.length ? "" : "dark trap, eerie bells, hyperpop…"}
          className="min-w-32 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {SUGGESTED_TAGS.filter((s) => !tags.includes(s)).map((s) => (
            <motion.button
              layout
              key={s}
              type="button"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              onClick={() => onChange([...tags, s])}
              className="rounded-md border border-zinc-700 px-2.5 py-0.5 font-mono text-xs text-zinc-400 hover:border-amber-400/60 hover:text-amber-300"
            >
              + {s}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const padVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: spring },
};

function NamePad({ name }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  return (
    <motion.button
      type="button"
      variants={padVariants}
      whileTap={{ scale: 0.94 }}
      onClick={copy}
      className={`flex min-h-24 flex-col justify-between rounded-lg border bg-gradient-to-b from-zinc-800 to-zinc-900 p-3 text-left transition-colors ${
        copied
          ? "border-amber-400/70 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
          : "border-zinc-700/80 hover:border-zinc-500"
      }`}
    >
      <span className="text-[0.95rem] font-medium leading-snug text-zinc-100">
        {name}
      </span>
      <span className="mt-2 flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-all ${
            copied
              ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]"
              : "bg-zinc-600"
          }`}
        />
        <span
          className={`font-mono text-[0.65rem] uppercase tracking-wider ${copied ? "text-amber-300" : "text-zinc-400"}`}
        >
          {copied ? "copied" : "copy"}
        </span>
      </span>
    </motion.button>
  );
}

function StepSequencer() {
  return (
    <span
      className="flex items-center justify-center gap-1"
      aria-label="generating"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 animate-seq-step rounded-[3px] bg-zinc-950"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export default function App() {
  const [tags, setTags] = useState([]);
  const [bpm, setBpm] = useState("");
  const [referenceArtist, setReferenceArtist] = useState("");
  const [vibeNotes, setVibeNotes] = useState("");
  const [names, setNames] = useState(null);
  const [batchId, setBatchId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const seenNamesRef = useRef([]);

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;

  const bpmNum = Number(bpm);
  const stepSeconds = Math.min(
    0.2,
    Math.max(0.05, bpmNum > 0 ? 15 / bpmNum : 0.12),
  );

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && cooldownSeconds === 0) {
      setCooldownUntil(null);
      setError(null);
    }
  }, [cooldownUntil, cooldownSeconds]);

  function nudgeBpm(delta) {
    setBpm((prev) => {
      const n = Number(prev);
      const base = prev !== "" && Number.isFinite(n) ? n : 120;
      return String(Math.min(300, Math.max(40, base + delta)));
    });
  }

  async function generate() {
    if (tags.length === 0) {
      setError(TAGS_REQUIRED_MESSAGE);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bypassKey = localStorage.getItem("onoma-bypass-key");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(bypassKey && { "x-bypass-key": bypassKey }),
        },
        body: JSON.stringify({
          tags,
          bpm: bpm ? Number(bpm) : undefined,
          referenceArtist: referenceArtist || undefined,
          vibeNotes: vibeNotes || undefined,
          avoid: seenNamesRef.current.length ? seenNamesRef.current : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? GENERIC_ERROR_MESSAGE);
        const retryAfter = body?.error?.retryAfterSeconds;
        setCooldownUntil(retryAfter ? Date.now() + retryAfter * 1000 : null);
        if (retryAfter) setNow(Date.now());
        return;
      }
      setNames(body.names);
      setBatchId((id) => id + 1);
      seenNamesRef.current = [...seenNamesRef.current, ...body.names].slice(
        -40,
      );
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-xl px-4 py-10">
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold tracking-tight">
              Onoma
              <motion.span
                className="inline-block text-amber-400"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                .
              </motion.span>
            </h1>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              stop exporting untitled_final_v3.wav
            </p>
          </motion.header>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.06 }}
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">
                Describe the beat <span className="text-amber-400">*</span>
              </label>
              <TagInput tags={tags} onChange={setTags} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="bpm"
                  className="mb-1.5 flex min-h-[2.25rem] items-end font-mono text-xs uppercase tracking-wider text-zinc-400"
                >
                  BPM{" "}
                  <span className="normal-case text-zinc-400/80">
                    (optional)
                  </span>
                </label>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-700 bg-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] focus-within:border-amber-400">
                  <button
                    type="button"
                    aria-label="decrease BPM"
                    onClick={() => nudgeBpm(-1)}
                    className="w-9 shrink-0 select-none border-r border-zinc-800 bg-zinc-900 font-mono text-base text-zinc-400 hover:text-amber-300 active:bg-zinc-800"
                  >
                    −
                  </button>
                  <input
                    id="bpm"
                    type="text"
                    inputMode="numeric"
                    value={bpm}
                    onChange={(e) =>
                      setBpm(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    placeholder="140"
                    className="w-full min-w-0 bg-transparent px-1 py-2.5 text-center font-mono text-sm text-amber-300 outline-none [text-shadow:0_0_8px_rgba(251,191,36,0.4)] placeholder:text-amber-300/20"
                  />
                  <button
                    type="button"
                    aria-label="increase BPM"
                    onClick={() => nudgeBpm(1)}
                    className="w-9 shrink-0 select-none border-l border-zinc-800 bg-zinc-900 font-mono text-base text-zinc-400 hover:text-amber-300 active:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="artist"
                  className="mb-1.5 flex min-h-[2.25rem] items-end font-mono text-xs uppercase tracking-wider text-zinc-400"
                >
                  Sounds like{" "}
                  <span className="normal-case text-zinc-400/80">
                    (optional)
                  </span>
                </label>
                <input
                  id="artist"
                  value={referenceArtist}
                  onChange={(e) => setReferenceArtist(e.target.value)}
                  placeholder="Travis Scott"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="vibe"
                className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400"
              >
                Vibe notes{" "}
                <span className="normal-case text-zinc-400/80">(optional)</span>
              </label>
              <textarea
                id="vibe"
                rows="2"
                value={vibeNotes}
                onChange={(e) => setVibeNotes(e.target.value)}
                placeholder="3am parking garage, sounds like a chase scene…"
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading || cooldownSeconds > 0}
              style={{ boxShadow: "0 5px 0 0 var(--color-amber-600)" }}
              whileTap={{ y: 5, boxShadow: "0 0px 0 0 var(--color-amber-600)" }}
              transition={spring}
              className="w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-widest text-zinc-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-6 items-center justify-center font-mono tabular-nums">
                {loading ? (
                  <StepSequencer />
                ) : cooldownSeconds > 0 ? (
                  `wait ${formatCooldown(cooldownSeconds)}`
                ) : names ? (
                  "Regenerate"
                ) : (
                  "Generate names"
                )}
              </span>
            </motion.button>
          </motion.form>

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                role="alert"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, x: [0, -6, 6, -6, 6, 0] }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  default: spring,
                  x: { duration: 0.4, ease: "easeInOut" },
                }}
                className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300"
              >
                {error}
                {cooldownSeconds > 0 && (
                  <span className="mt-1 block font-mono font-semibold tabular-nums text-red-200">
                    next batch in {formatCooldown(cooldownSeconds)}
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          {names && !error && (
            <motion.section
              key={batchId}
              initial="hidden"
              animate="show"
              variants={{
                show: { transition: { staggerChildren: stepSeconds } },
              }}
              className="mt-6 grid grid-cols-2 gap-2"
              aria-label="generated names"
            >
              {names.map((name) => (
                <NamePad key={name} name={name} />
              ))}
            </motion.section>
          )}

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center font-mono text-xs text-zinc-400/80"
          >
            <a
              href="https://ko-fi.com/izao00"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-300"
            >
              enjoying onoma? buy me a coffee ☕
            </a>
          </motion.footer>
        </main>
      </div>
    </MotionConfig>
  );
}
