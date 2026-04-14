# Cloudflare Edge Functions Proxy

This app should not call Plant.id or Anthropic directly from the browser in production.
The frontend now supports a single edge base URL so those calls can be proxied through Cloudflare Workers / Edge Functions.

## Why this matters

- Keeps API keys off the client.
- Makes rate limiting and abuse controls possible.
- Lets you log and inspect usage server-side.
- Gives one place to normalize provider responses before they reach the app.

## Frontend configuration

Set this environment variable in production:

- `VITE_EDGE_API_BASE_URL=https://your-worker.your-domain.com`

When this is set, the frontend will use the edge proxy instead of calling Plant.id or Anthropic directly.

## Recommended edge endpoints

### `POST /plant/health-assessment`

Request body:

```json
{ "imageBase64": "...", "latitude": -0.3476, "longitude": 32.5825, "datetime": "2026-04-14T10:20:00Z" }
```

Optional fields:

- `latitude` - numeric latitude from the client, if available
- `longitude` - numeric longitude from the client, if available
- `datetime` - ISO timestamp for when the photo was taken, if known

Expected response:

```json
{ "plant": "Tomato", "disease": "Late Blight", "confidence": 87, "severity": "High" }
```

This endpoint should call Plant.id internally and return only the normalized fields the app needs.
The worker should forward `latitude`, `longitude`, and `datetime` to Kindwise when present.

### `POST /ai/enrich-disease`

Request body:

```json
{ "disease": "Late Blight", "plant": "Tomato" }
```

Expected response:

```json
{
  "summary": "...",
  "steps": ["..."],
  "relatedDiseases": ["..."],
  "searchTerms": ["..."]
}
```

### `POST /ai/diagnose-symptoms`

Request body:

```json
{ "description": "..." }
```

Expected response:

```json
{
  "disease": "Early Blight",
  "confidence": "High",
  "summary": "...",
  "steps": ["..."],
  "relatedDiseases": ["..."],
  "searchTerms": ["..."]
}
```

## Suggested worker behavior

1. Validate and rate-limit requests.
2. Forward Plant.id / Anthropic calls using secrets stored in the worker.
3. Normalize response fields before returning to the frontend.
4. Avoid returning raw provider payloads to the browser.

## Secret names

Use these Cloudflare Worker secrets:

- `PLANT_ID_KEY` - your Kindwise API key
- `ANTHROPIC_API_KEY` - your Anthropic API key

## When you would update the frontend again

Update [src/lib/agriAi.ts](../src/lib/agriAi.ts) only if the edge response contract changes.
Update [src/stores/detection.ts](../src/stores/detection.ts) only if scan orchestration changes.

The goal is that provider changes happen in the worker, not in the app.