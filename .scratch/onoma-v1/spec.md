# Spec: Onoma v1 — Beat Name Generator

Status: ready-for-agent

## Problem Statement

Beatmakers hit the Naming Block: they finish a beat and stall on choosing a name, either losing momentum staring at the export dialog or settling for a throwaway name (`untitled_final_v3`) that sucks. Naming is a creative task that arrives exactly when the creative energy has been spent on the beat itself. Secondarily, some beatmakers want a name *before* the beat exists, as a spark for a creative direction (Name-First Inspiration).

## Solution

Onoma is a free, stateless, one-page web app. The beatmaker fills in a Beat Profile — a handful of free-entry Tags describing the beat ("dark trap", "eerie bells", "hyperpop"), plus optional BPM, reference artist, and vibe notes — and gets a Batch of ~10 AI-generated Beat Names in deliberately mixed naming styles (hard one-words, moody lowercase phrases, stylized spellings). Names are catchy but anchored to the Beat Profile, so they fit the beat rather than being random. The beatmaker copies the one they like and leaves; regenerating is free and instant. No accounts, no saved state, nothing to learn.

## User Stories

1. As a beatmaker, I want to describe my beat with free-entry Tags, so that name generation is anchored to what my beat actually sounds like.
2. As a beatmaker, I want to type any tag I can think of (not pick from a fixed list), so that my genre is first-class even if it's niche or regional (hyperpop, amapiano, jersey club).
3. As a beatmaker, I want tag suggestion chips I can tap to fill common tags instantly, so that describing my beat takes seconds when I'm feeling lazy.
4. As a beatmaker, I want to remove a tag I've entered with one tap, so that I can correct my Beat Profile without retyping everything.
5. As a beatmaker, I want to optionally enter a BPM, so that the tempo can flavor the generated names.
6. As a beatmaker, I want BPM to be optional, so that I can generate names before the beat exists (Name-First Inspiration).
7. As a beatmaker, I want to optionally name a reference artist, so that the names match that artist's aesthetic.
8. As a beatmaker, I want the reference artist to shape style only and never appear inside a generated name, so that my beat names are original.
9. As a beatmaker, I want an optional free-text vibe notes field, so that I can convey things tags can't ("3am parking garage", "sounds like a chase scene").
10. As a beatmaker, I want one Generate button that returns a Batch of ~10 names in one click, so that I can scan and pick instead of pulling a slot machine.
11. As a beatmaker, I want the Batch to mix naming styles (hard one-words, moody phrases, stylized spellings), so that I see the range of options without configuring anything.
12. As a beatmaker, I want to copy any name with a single click/tap, so that I can paste it straight into my DAW's export dialog.
13. As a beatmaker, I want visible confirmation that a name was copied, so that I don't paste the wrong thing.
14. As a beatmaker, I want a Regenerate action that produces a fresh Batch from the same Beat Profile, so that I can keep browsing without re-entering anything.
15. As a beatmaker, I want generation to feel fast, with a clear loading state while the Batch is being produced, so that I know the app is working and my flow isn't broken.
16. As a beatmaker, I want to use the app without creating an account or logging in, so that naming a beat takes less than a minute end to end.
17. As a beatmaker, I want the app to work well on my phone, so that I can name a beat from the couch or the studio chair.
18. As a beatmaker writing Tags in my own language, I want the names to come back in that language (or natural code-mixing), so that names feel authentic to my scene.
19. As a beatmaker, I want names with real edge where the vibe calls for it (mild profanity, stylized spellings), but never slurs, so that the names sound like beat culture and are safe to publish.
20. As a beatmaker, I want a clear message when I've hit the rate limit, so that I know to wait rather than assume the app is broken.
21. As a beatmaker, I want a friendly "out of names for today" message if the daily generation quota is exhausted, so that I know to come back tomorrow rather than assume the app is broken.
22. As a beatmaker who submits no Tags, I want a clear validation message, so that I know Tags are the one required field.
23. As a beatmaker, I want a clear, non-technical error message if generation fails for any other reason, so that I can retry without confusion.
24. As a beatmaker who likes the tool, I want a visible Ko-fi/donation link, so that I can support it.
25. As the operator, I want per-IP rate limiting on generation, so that one abuser cannot drain the free daily LLM quota for everyone.
26. As the operator, I want the LLM API key kept server-side only, so that it can never be extracted from the browser and abused.
27. As the operator, I want the whole system to run at $0/month at hobby traffic (free hosting tier, free LLM tier), so that the tool never costs me money while it's small.
28. As the operator, I want the service capped so worst-case abuse is bounded, so that a traffic spike can't create a surprise bill.

## Implementation Decisions

- **Architecture**: a single container deployed on Google Cloud Run. Express (Node.js, plain JavaScript — no TypeScript) serves the built React static assets and exposes exactly one API endpoint. No database, no sessions, no persistence of any kind. (User explicitly rejected Vercel and TypeScript.)
- **Frontend**: React built with Vite, styled with Tailwind. One page: Beat Profile form (tag input with suggestion chips, BPM number field, reference artist text field, vibe notes textarea), Generate/Regenerate button, Batch display with per-name copy, Ko-fi link. Mobile-first.
- **Tag input**: free-entry chips — typing + enter creates a chip; suggestion chips below the field append on tap. Tags are not an enum anywhere in the system; they pass through as strings.
- **API contract**: `POST /api/generate` accepts a JSON Beat Profile `{ tags: string[] (required, ≥1), bpm?: number, referenceArtist?: string, vibeNotes?: string }` and returns `{ names: string[] }` of ~10 Beat Names. Responses: `400` for a missing/empty tags array, `429` when the caller is rate-limited, and a distinct error response for upstream-quota-exhausted that the UI renders as the friendly "out of names for today" message.
- **LLM**: Gemini flash-lite-class model via the Gemini API free tier (~1,000–1,500 requests/day; exact model ID and live per-project cap to be confirmed in AI Studio at build time). One Batch = one API request. API key supplied via Secret Manager/env var; never shipped to the browser.
- **Prompt rules** (enforced in the server-side prompt): names anchored to the Beat Profile; deliberately mixed naming styles within each Batch; never include the reference artist's name in output; mild profanity/edge permitted, slurs never; output language mirrors the input language.
- **Rate limiting**: in-memory per-IP limiting in Express, valid because Cloud Run is pinned to `max-instances = 1` (see ADR-0001). Do not raise the instance cap without moving rate-limit state to a shared store.
- **Cost posture**: Cloud Run scale-to-zero + free tier, Gemini free tier, no external stores — $0/month at hobby traffic; the single instance and daily LLM quota bound the worst case.

## Testing Decisions

- **Single seam**: the Express app's HTTP surface, `POST /api/generate`, exercised in-process (supertest-style — no live server, no browser). This is the same contract the frontend consumes, so tests assert external behavior only: status codes, response shape, and rate-limit/quota behavior — never internal functions or prompt internals.
- **Gemini is mocked at the outbound network boundary** in test setup (e.g., intercepting the HTTPS request). No dependency-injection interface is added to production code for testability; production stays seam-free.
- **What gets tested through the seam**: Tags-required validation (400), happy-path Batch shape (~10 non-empty strings), reference-artist-never-in-output given a mocked LLM response, per-IP rate limiting (429 after the limit within the window), upstream-quota-exhausted mapping to the friendly error response, and malformed-upstream-response handling.
- **No UI test rig in v1**: the React layer is a thin form over the endpoint; a browser e2e harness would cost more than the logic it protects.
- **Prior art**: none — greenfield repo; these are the first tests.

## Out of Scope

- Accounts, login, or any user identity
- Any persistence: name/profile history, library, favorites, localStorage history
- Audio upload and audio analysis (held as the future paid path)
- A name-style selector in the Beat Profile (mixed batches are the v1 answer; revisit only if users complain)
- A clean-mode/profanity toggle
- Monetization beyond the Ko-fi link: no paid tiers, no ads
- Horizontal scaling / multi-instance deployment (blocked by ADR-0001 until rate-limit state moves to a shared store)
- TypeScript, Vercel, or any serverless-function architecture

## Further Notes

- Domain vocabulary is defined in `CONTEXT.md` (Naming Block, Beat Name, Batch, Beat Profile, Tag, Name-First Inspiration) — use it in code, tests, and tickets.
- ADR-0001 records the single-instance/in-memory-rate-limiting decision and its reversal condition.
- Gemini free-tier limits are per-project and not guaranteed; verify the live cap in AI Studio before launch and size the per-IP limit so no single IP can consume more than a small fraction of the daily quota.
- Candidate tagline: "stop exporting untitled_final_v3.wav".
- Free-tier Gemini API data may be used by Google for product improvement — acceptable for beat-name prompts; do not send anything sensitive.
