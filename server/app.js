import express from 'express'
import rateLimit from 'express-rate-limit'
import { generateNames, QuotaExhaustedError } from './gemini.js'

const MAX_TAGS = 20
const MAX_AVOID_NAMES = 40
const MAX_FIELD_LENGTH = 200

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } })
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_FIELD_LENGTH) : undefined
}

// Normalize the raw request body into a Beat Profile, or null when no usable tags
function toBeatProfile(body) {
  const { tags, bpm, referenceArtist, vibeNotes, avoid } = body ?? {}
  const cleanTags = Array.isArray(tags)
    ? tags.map(cleanText).filter(Boolean).slice(0, MAX_TAGS)
    : []
  if (cleanTags.length === 0) return null
  return {
    tags: cleanTags,
    bpm: Number.isFinite(Number(bpm)) && bpm !== '' && bpm !== null ? Number(bpm) : undefined,
    referenceArtist: cleanText(referenceArtist),
    vibeNotes: cleanText(vibeNotes),
    avoid: Array.isArray(avoid)
      ? avoid.map(cleanText).filter(Boolean).slice(-MAX_AVOID_NAMES)
      : undefined,
  }
}

export function createApp() {
  const app = express()
  // Cloud Run fronts the app with exactly one proxy layer (see ADR-0001)
  app.set('trust proxy', 1)
  app.use(express.json())

  // In-memory per-IP limiting is valid only while max-instances = 1 (ADR-0001)
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000
  const limiter = rateLimit({
    windowMs,
    // 15/h caps one IP at 360/day against the project's 500 RPD Gemini quota
    limit: Number(process.env.RATE_LIMIT_MAX) || 15,
    standardHeaders: true,
    legacyHeaders: false,
    // operator backdoor: requests carrying the bypass key are never limited
    skip: (req) =>
      Boolean(process.env.RATE_LIMIT_BYPASS_KEY) &&
      req.get('x-bypass-key') === process.env.RATE_LIMIT_BYPASS_KEY,
    handler: (req, res) => {
      const resetMs = req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : windowMs
      const retryAfterSeconds = Math.min(Math.max(1, Math.ceil(resetMs / 1000)), Math.ceil(windowMs / 1000))
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Slow down — you can generate again in about ${Math.ceil(retryAfterSeconds / 60)} min.`,
          retryAfterSeconds,
        },
      })
    },
  })

  app.post('/api/generate', limiter, async (req, res) => {
    const profile = toBeatProfile(req.body)
    if (!profile) {
      return sendError(res, 400, 'TAGS_REQUIRED', 'Add at least one tag describing the beat.')
    }

    try {
      const names = await generateNames(profile)
      res.json({ names })
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        return sendError(res, 503, 'QUOTA_EXHAUSTED', 'Onoma is out of names for today — come back tomorrow.')
      }
      console.error('generation failed:', err.message)
      sendError(res, 502, 'GENERATION_FAILED', 'Name generation hiccuped. Try again.')
    }
  })

  return app
}
