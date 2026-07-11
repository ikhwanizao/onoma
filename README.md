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
| `RATE_LIMIT_MAX` | `20` | Generations per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` (1 h) | Rate-limit window |
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

Before launch: verify your project's live Gemini free-tier quota in [AI Studio](https://aistudio.google.com/rate-limit) and size `RATE_LIMIT_MAX` so one IP can't eat more than a small fraction of it.
