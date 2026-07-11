# Onoma

Beat names for beatmakers — stop exporting `untitled_final_v3.wav`.

Describe your beat with a few tags (plus optional BPM, reference artist, and vibe notes) and get a batch of ~10 AI-generated names anchored to what the beat actually sounds like. Stateless: no accounts, nothing stored.

Domain glossary: [CONTEXT.md](CONTEXT.md) · Architecture decisions: [docs/adr/](docs/adr/)

## Develop

```sh
npm install
cp .env.example .env   # then put your Gemini API key in .env
npm run dev:api        # Express API on :8080 (loads .env)
npm run dev            # Vite dev server on :5173, proxies /api
```

## Test

```sh
npm test
```

Tests exercise the single seam (`POST /api/generate`) with the Gemini call mocked at the network boundary. No API key needed.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — (required) | Gemini API key; server-side only |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Model ID |
| `RATE_LIMIT_MAX` | `15` | Generations per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` (1 h) | Rate-limit window |
| `RATE_LIMIT_BYPASS_KEY` | — (off) | Requests with matching `x-bypass-key` header skip rate limiting; plant it on your devices via `localStorage.setItem('onoma-bypass-key', '…')` |
| `PORT` | `8080` | Listen port (set by Cloud Run) |

## Deploy (Cloud Run)

`max-instances=1` is load-bearing — in-memory rate limiting depends on it (see [ADR-0001](docs/adr/0001-single-cloud-run-instance-with-in-memory-rate-limiting.md)).

```sh
gcloud run deploy onoma \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-secrets GEMINI_API_KEY=onoma-gemini-key:latest
```

(Create the secret first: `gcloud secrets create onoma-gemini-key --data-file=-`)

Quota reality check (verified in [AI Studio](https://aistudio.google.com/rate-limit), 2026-07): this project's free tier gives Gemini 3.1 Flash Lite **15 RPM / 500 requests per day** — one request = one batch. The default `RATE_LIMIT_MAX=15` caps a single IP at 360/day so one abuser can't drain the whole quota. Re-check the live caps if Google rebalances tiers.
