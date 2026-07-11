import { fetch } from 'undici'

const BASE_URL = 'https://generativelanguage.googleapis.com'
const BATCH_SIZE = 10

export class QuotaExhaustedError extends Error {}
export class UpstreamError extends Error {}

function buildPrompt({ tags, bpm, referenceArtist, vibeNotes }) {
  const profile = [
    `Tags: ${tags.join(', ')}`,
    bpm ? `BPM: ${bpm}` : null,
    referenceArtist ? `Reference artist (style anchor only): ${referenceArtist}` : null,
    vibeNotes ? `Vibe notes: ${vibeNotes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `You name beats for beatmakers. Generate exactly ${BATCH_SIZE} beat names for the beat described below.

${profile}

Rules:
- Every name must be anchored to the profile above — evocative, not random.
- Deliberately mix naming styles across the batch: hard one-word names in caps (like "GARGOYLE"), moody lowercase phrases (like "3am in the structure"), and stylized spellings (like "HEARTLE$$").
- If a reference artist is given, match their aesthetic but NEVER include the artist's name (or an obvious variation of it) in any name.
- Mild profanity and edge are fine when the vibe calls for it. Never use slurs.
- Write the names in the same language as the profile (natural code-mixing is fine).
- Names must be short: 1 to 6 words.

Return ONLY a JSON array of ${BATCH_SIZE} strings.`
}

export async function generateNames(profile) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
  const res = await fetch(`${BASE_URL}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(profile) }] }],
      generationConfig: {
        temperature: 1.2,
        responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    }),
  })

  if (res.status === 429) throw new QuotaExhaustedError('Gemini daily quota exhausted')
  if (!res.ok) throw new UpstreamError(`Gemini responded ${res.status}`)

  let names
  try {
    const data = await res.json()
    names = JSON.parse(data.candidates[0].content.parts[0].text)
  } catch {
    throw new UpstreamError('Gemini returned an unparseable response')
  }
  if (!Array.isArray(names) || !names.every((n) => typeof n === 'string' && n.trim())) {
    throw new UpstreamError('Gemini returned an unexpected shape')
  }
  return names
}
