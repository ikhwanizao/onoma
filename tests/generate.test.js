import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici'
import { createApp } from '../server/app.js'

const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com'

const TEN_NAMES = [
  'PHANTOM FLOOR', '3am in the structure', 'VANTABLACK', 'level 4 lights out',
  'BELLTOWER', 'no cameras down here', 'GARGOYLE', 'cold concrete hymn',
  'SÉANCE', 'last car on the roof',
]

let mockAgent
let previousDispatcher

beforeEach(() => {
  previousDispatcher = getGlobalDispatcher()
  mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)
  process.env.GEMINI_API_KEY = 'test-key'
})

afterEach(async () => {
  setGlobalDispatcher(previousDispatcher)
  await mockAgent.close()
  delete process.env.RATE_LIMIT_MAX
  delete process.env.RATE_LIMIT_BYPASS_KEY
})

function mockGemini({ status = 200, names = TEN_NAMES, body } = {}) {
  mockAgent
    .get(GEMINI_ORIGIN)
    .intercept({ path: /generateContent/, method: 'POST' })
    .reply(
      status,
      body ?? { candidates: [{ content: { parts: [{ text: JSON.stringify(names) }] } }] },
      { headers: { 'content-type': 'application/json' } },
    )
}

describe('POST /api/generate', () => {
  it('rejects a Beat Profile without tags', async () => {
    const res = await request(createApp()).post('/api/generate').send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('TAGS_REQUIRED')
  })

  it('rejects a Beat Profile with an empty tags array', async () => {
    const res = await request(createApp()).post('/api/generate').send({ tags: [] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('TAGS_REQUIRED')
  })

  it('returns a Batch of names for a valid Beat Profile', async () => {
    mockGemini()
    const res = await request(createApp())
      .post('/api/generate')
      .send({ tags: ['dark trap', 'eerie bells'], bpm: 140, vibeNotes: '3am parking garage' })
    expect(res.status).toBe(200)
    expect(res.body.names).toEqual(TEN_NAMES)
  })

  it('tells the LLM to avoid names the client has already seen', async () => {
    let outbound
    mockAgent
      .get(GEMINI_ORIGIN)
      .intercept({ path: /generateContent/, method: 'POST' })
      .reply(
        200,
        (opts) => {
          outbound = JSON.parse(opts.body)
          return { candidates: [{ content: { parts: [{ text: JSON.stringify(TEN_NAMES) }] } }] }
        },
        { headers: { 'content-type': 'application/json' } },
      )
    const res = await request(createApp())
      .post('/api/generate')
      .send({ tags: ['trap'], avoid: ['VANDAL', 'concrete silence'] })
    expect(res.status).toBe(200)
    const prompt = outbound.contents[0].parts[0].text
    expect(prompt).toContain('VANDAL')
    expect(prompt).toContain('concrete silence')
  })

  it('returns 502 when Gemini responds with an unusable payload', async () => {
    mockGemini({ body: { candidates: [] } })
    const res = await request(createApp()).post('/api/generate').send({ tags: ['lofi'] })
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('GENERATION_FAILED')
  })

  it('returns a friendly 503 when the Gemini daily quota is exhausted', async () => {
    mockGemini({
      status: 429,
      body: {
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded for metric: GenerateRequestsPerDayPerProjectPerModel-FreeTier',
        },
      },
    })
    const res = await request(createApp()).post('/api/generate').send({ tags: ['drill'] })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('QUOTA_EXHAUSTED')
    expect(res.body.error.message).toMatch(/out of names for today/i)
  })

  it('treats a per-minute Gemini 429 as a retryable failure, not daily exhaustion', async () => {
    mockGemini({
      status: 429,
      body: {
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded for metric: GenerateRequestsPerMinutePerProjectPerModel',
        },
      },
    })
    const res = await request(createApp()).post('/api/generate').send({ tags: ['drill'] })
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('GENERATION_FAILED')
  })

  it('never returns names containing the reference artist, even if the LLM disobeys', async () => {
    mockGemini({ names: ['Travis Scott Nights', 'UTOPIA FLOOR', 'travis scott type', 'RAGER'] })
    const res = await request(createApp())
      .post('/api/generate')
      .send({ tags: ['rage trap'], referenceArtist: 'Travis Scott' })
    expect(res.status).toBe(200)
    expect(res.body.names).toEqual(['UTOPIA FLOOR', 'RAGER'])
  })

  it('matches the reference artist on word boundaries, not substrings', async () => {
    mockGemini({ names: ['EYES ON ME', 'YE STORM', 'goodbye moon', 'DONDA NIGHTS'] })
    const res = await request(createApp())
      .post('/api/generate')
      .send({ tags: ['soul'], referenceArtist: 'Ye' })
    expect(res.status).toBe(200)
    expect(res.body.names).toEqual(['EYES ON ME', 'goodbye moon', 'DONDA NIGHTS'])
  })

  it('returns 502 rather than an empty Batch when every name gets filtered', async () => {
    mockGemini({ names: ['Metro Boomin Vibes', 'metro boomin nights'] })
    const res = await request(createApp())
      .post('/api/generate')
      .send({ tags: ['trap'], referenceArtist: 'Metro Boomin' })
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('GENERATION_FAILED')
  })

  it('rate-limits repeated generations from the same IP', async () => {
    process.env.RATE_LIMIT_MAX = '2'
    const app = createApp()
    mockGemini()
    mockGemini()
    const first = await request(app).post('/api/generate').send({ tags: ['trap'] })
    const second = await request(app).post('/api/generate').send({ tags: ['trap'] })
    const third = await request(app).post('/api/generate').send({ tags: ['trap'] })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.body.error.code).toBe('RATE_LIMITED')
    expect(third.body.error.retryAfterSeconds).toBeGreaterThan(0)
    expect(third.body.error.retryAfterSeconds).toBeLessThanOrEqual(60 * 60)
  })

  it('skips rate limiting for requests carrying the bypass key', async () => {
    process.env.RATE_LIMIT_MAX = '1'
    process.env.RATE_LIMIT_BYPASS_KEY = 'operator-secret'
    const app = createApp()
    mockGemini()
    mockGemini()
    const first = await request(app).post('/api/generate').send({ tags: ['trap'] })
    const limited = await request(app).post('/api/generate').send({ tags: ['trap'] })
    const bypassed = await request(app)
      .post('/api/generate')
      .set('x-bypass-key', 'operator-secret')
      .send({ tags: ['trap'] })
    const wrongKey = await request(app)
      .post('/api/generate')
      .set('x-bypass-key', 'guessed-wrong')
      .send({ tags: ['trap'] })
    expect(first.status).toBe(200)
    expect(limited.status).toBe(429)
    expect(bypassed.status).toBe(200)
    expect(wrongKey.status).toBe(429)
  })
})
