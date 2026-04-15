# Google Apps Script leaderboard (offline-first)

This app is a **static export** (`next.config.ts` has `output: "export"`), typically opened via `file://` on Chromebooks.

That means:
- There is **no server** to write files like `public/data/scores.json` at runtime.
- The browser can only persist dynamic data locally (e.g. `localStorage`/IndexedDB).
- Remote sync must happen via **HTTPS** calls (e.g. Google Apps Script Web App).

## Client configuration

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_GAS_LEADERBOARD_URL`: the deployed Apps Script Web App URL
- `NEXT_PUBLIC_GAS_AUTH_TOKEN` (optional): a shared token your script checks

Rebuild after changing env vars (static export bakes them in).

## Expected Apps Script API contract

The client calls your web app via **`GET` query params** (to avoid CORS preflight under `file://`):

### `action: "list"`

Request:

```text
GET /exec?action=list&token=optional-token
```

Response:

```json
{ "ok": true, "entries": [ { "id": "name:alice", "name": "Alice", "score": 12, "createdAt": "...", "updatedAt": "..." } ] }
```

### `action: "upsertMany"`

Request:

```text
GET /exec?action=upsertMany&token=optional-token&payload=<urlencoded-json>
```

Response:

```json
{ "ok": true, "entries": [ /* canonical sheet entries */ ] }
```

If your script returns a canonical `entries` list after writes, the client will store that offline.

## Sheet schema (recommended)

Header row:

1. `id` (string, unique key; for name-based entries use `name:<normalized>`)
2. `name` (string; display name)
3. `score` (number)
4. `createdAt` (ISO string)
5. `updatedAt` (ISO string)

## Where sync runs

Sync is triggered inside `getCombinedLeaderboard()` (best-effort; never throws), implemented in:

- `flappybird/lib/googleSheetsLeaderboard.ts`

If `NEXT_PUBLIC_GAS_LEADERBOARD_URL` is not set or the device is offline, it simply skips and continues to use local cached scores.

