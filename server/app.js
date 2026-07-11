import express from 'express'
import rateLimit from 'express-rate-limit'
import { generateNames, QuotaExhaustedError } from './gemini.js'

export function createApp() {
  const app = express()
  // Cloud Run fronts the app with exactly one proxy layer (see ADR-0001)
  app.set('trust proxy', 1)
  app.use(express.json())

  // In-memory per-IP limiting is valid only while max-instances = 1 (ADR-0001)
  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Slow down — try again in a bit.' },
      }),
  })

  app.post('/api/generate', limiter, async (req, res) => {
    const { tags, bpm, referenceArtist, vibeNotes } = req.body ?? {}
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === 'string' && t.trim())
      : []
    if (cleanTags.length === 0) {
      return res.status(400).json({
        error: { code: 'TAGS_REQUIRED', message: 'Add at least one tag describing the beat.' },
      })
    }

    try {
      let names = await generateNames({ tags: cleanTags, bpm, referenceArtist, vibeNotes })
      if (typeof referenceArtist === 'string' && referenceArtist.trim()) {
        const artist = referenceArtist.trim().toLowerCase()
        names = names.filter((n) => !n.toLowerCase().includes(artist))
      }
      res.json({ names })
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        return res.status(503).json({
          error: {
            code: 'QUOTA_EXHAUSTED',
            message: 'Onoma is out of names for today — come back tomorrow.',
          },
        })
      }
      console.error('generation failed:', err.message)
      res.status(502).json({
        error: { code: 'GENERATION_FAILED', message: 'Name generation hiccuped. Try again.' },
      })
    }
  })

  return app
}
