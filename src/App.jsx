import { useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'

const SUGGESTED_TAGS = [
  'trap', 'drill', 'boom bap', 'r&b', 'afrobeats', 'jersey club',
  'lofi', 'dark', 'dreamy', 'aggressive', 'bouncy', 'melancholy',
]

const TAGS_REQUIRED_MESSAGE = 'Add at least one tag describing the beat.'
const GENERIC_ERROR_MESSAGE = 'Name generation hiccuped. Try again.'

const spring = { type: 'spring', stiffness: 500, damping: 30 }

function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function addTag(raw) {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 focus-within:border-lime-400"
        onClick={() => inputRef.current?.focus()}
      >
        <AnimatePresence initial={false}>
          {tags.map((tag) => (
            <motion.span
              layout
              key={tag}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={spring}
              className="flex items-center gap-1 rounded-full bg-lime-400/15 py-1 pl-3 pr-1.5 text-sm leading-none text-lime-300"
            >
              {tag}
              <button
                type="button"
                aria-label={`remove ${tag}`}
                className="flex h-4 w-4 items-center justify-center rounded-full leading-none text-lime-300/60 hover:bg-lime-400/25 hover:text-lime-300"
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
          placeholder={tags.length ? '' : 'dark trap, eerie bells, hyperpop…'}
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
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.85 }}
              transition={spring}
              onClick={() => onChange([...tags, s])}
              className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-400 hover:border-lime-400 hover:text-lime-300"
            >
              + {s}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
}

function NameCard({ name }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(name)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  return (
    <motion.button
      type="button"
      variants={cardVariants}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left hover:border-lime-400/60"
    >
      <span className="text-base text-zinc-100">{name}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'copied' : 'copy'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={spring}
          className={
            copied
              ? 'text-xs font-bold text-lime-300'
              : 'text-xs text-zinc-600 group-hover:text-zinc-400'
          }
        >
          {copied ? 'copied!' : 'copy'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

function LoadingDots() {
  return (
    <span className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce-dot rounded-full bg-zinc-950"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  )
}

export default function App() {
  const [tags, setTags] = useState([])
  const [bpm, setBpm] = useState('')
  const [referenceArtist, setReferenceArtist] = useState('')
  const [vibeNotes, setVibeNotes] = useState('')
  const [names, setNames] = useState(null)
  const [batchId, setBatchId] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    if (tags.length === 0) {
      setError(TAGS_REQUIRED_MESSAGE)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tags,
          bpm: bpm ? Number(bpm) : undefined,
          referenceArtist: referenceArtist || undefined,
          vibeNotes: vibeNotes || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error?.message ?? GENERIC_ERROR_MESSAGE)
        return
      }
      setNames(body.names)
      setBatchId((id) => id + 1)
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto max-w-xl px-4 py-10">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mb-8"
          >
            <h1 className="text-3xl font-extrabold tracking-tight">
              Onoma
              <motion.span
                className="inline-block text-lime-400"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 0.45, repeat: Infinity, repeatDelay: 4 }}
              >
                .
              </motion.span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">stop exporting untitled_final_v3.wav</p>
          </motion.header>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.08 }}
            onSubmit={(e) => {
              e.preventDefault()
              generate()
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-400">
                Describe the beat <span className="text-lime-400">*</span>
              </label>
              <TagInput tags={tags} onChange={setTags} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bpm" className="mb-1.5 block text-sm font-bold text-zinc-400">
                  BPM <span className="font-normal text-zinc-600">(optional)</span>
                </label>
                <input
                  id="bpm"
                  type="number"
                  min="1"
                  max="999"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  placeholder="140"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-400"
                />
              </div>
              <div>
                <label htmlFor="artist" className="mb-1.5 block text-sm font-bold text-zinc-400">
                  Sounds like <span className="font-normal text-zinc-600">(optional)</span>
                </label>
                <input
                  id="artist"
                  value={referenceArtist}
                  onChange={(e) => setReferenceArtist(e.target.value)}
                  placeholder="Travis Scott"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vibe" className="mb-1.5 block text-sm font-bold text-zinc-400">
                Vibe notes <span className="font-normal text-zinc-600">(optional)</span>
              </label>
              <textarea
                id="vibe"
                rows="2"
                value={vibeNotes}
                onChange={(e) => setVibeNotes(e.target.value)}
                placeholder="3am parking garage, sounds like a chase scene…"
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-400"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              style={{ boxShadow: '0 5px 0 0 var(--color-lime-600)' }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ y: 5, scale: 1, boxShadow: '0 0px 0 0 var(--color-lime-600)' }}
              transition={spring}
              className="w-full rounded-2xl bg-lime-400 py-3 font-extrabold uppercase tracking-wider text-zinc-950 hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-6 items-center justify-center">
                {loading ? <LoadingDots /> : names ? 'Regenerate' : 'Generate names'}
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
                transition={{ default: spring, x: { duration: 0.4, ease: 'easeInOut' } }}
                className="mt-4 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {names && !error && (
            <motion.section
              key={batchId}
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              className="mt-6 space-y-2"
              aria-label="generated names"
            >
              {names.map((name) => (
                <NameCard key={name} name={name} />
              ))}
            </motion.section>
          )}

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 text-center text-xs text-zinc-600"
          >
            <a
              href="https://ko-fi.com/izao00"
              target="_blank"
              rel="noreferrer"
              className="hover:text-lime-300"
            >
              enjoying onoma? buy me a coffee ☕
            </a>
          </motion.footer>
        </main>
      </div>
    </MotionConfig>
  )
}
