# 0001 — Single Cloud Run instance with in-memory rate limiting

## Status

Accepted (2026-07-11)

## Context

Onoma is a stateless, no-account, free public tool whose only real cost/abuse surface is the Gemini API call behind `POST /api/generate`. The Gemini free tier allows roughly 1,000–1,500 requests/day (per-project, not guaranteed — check AI Studio for live caps). Per-IP rate limiting is required to keep one abuser from draining the daily quota, but with no accounts and no database there is no natural place to store rate-limit counters. External stores (Redis/Memorystore, Firestore) add cost and moving parts to an app that must run at $0/month.

## Decision

Deploy as a single container (Express serving the built React frontend plus the API endpoint) with Cloud Run configured to **`max-instances = 1`**, and use plain in-memory per-IP rate limiting (e.g. `express-rate-limit`).

## Consequences

- In-memory counters are correct because there is exactly one instance — no external rate-limit store, no added cost.
- One instance is a hard ceiling on throughput, which doubles as worst-case abuse and cost protection.
- The app cannot scale horizontally. This is acceptable because the Gemini free-tier daily quota (~1,500 requests/day) is the real bottleneck; one instance serves far more traffic than the quota allows anyway.
- Counters reset when the instance is recycled (scale-to-zero). This weakens the rate limit slightly at very low traffic; accepted as harmless for this threat model.
- If Onoma ever outgrows the free tier, raising `max-instances` requires moving rate-limit state to a shared store first — do not raise the cap without that.
