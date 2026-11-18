# NIA Mock Test Server

Local Bun server for testing code using NeuroInfoAPI against a controllable mock backend.

This project now covers:

- REST API mock endpoints (`/api/v2/...`)
- WebSocket endpoint + ticket auth flow (`/api/v2/ws`, `/api/v2/ws/ticket`)
- Browser UI for editing state and emitting events (`/ui`)
- JSON persistence (`src/mock-state.json`)
- Importing real data from upstream NeuroInfoApi v2 (`neuroinfoapi.dev`) via `@neuroinfoapi-client/bun`

## Quick Start

Requirements:

- [Bun](https://bun.sh/)

Install deps:

```bash
cd Mock-TestServer
bun install
```

```bash
bun src/index.ts
```

Alternative script:

```bash
bun run run
```

Default URLs for the NeuroInfoAPI client v2:

- UI: `http://localhost:8787/ui`
- Health: `http://localhost:8787/health`
- REST base: `http://localhost:8787/api/v2`
- WS endpoint: `ws://localhost:8787/api/v2/ws`
- Ticket endpoint: `http://localhost:8787/api/v2/ws/ticket`


Client setup example. The old `neuroinfoapi-client` package is deprecated; use `@neuroinfoapi-client/bun`, `@neuroinfoapi-client/node`, or `@neuroinfoapi-client/native` (all 2.8.0+):

```ts
import { NeuroInfoApiClient, NeuroInfoApiWebsocketClient } from "@neuroinfoapi-client/bun";

const api = new NeuroInfoApiClient("mock-token", {
  apiBaseUrl: "localhost:8787/api/v2",
  useTls: false,
});

const ws = new NeuroInfoApiWebsocketClient("mock-token", {
  apiBaseUrl: "localhost:8787/api/v2",
  useTls: false,
});

ws.on("xFeedNewEntries", ({ user, entries }) => console.log(user, entries));
ws.on("shopProductsUpdate", ({ products }) => console.log(products.length));
await ws.connect();
```

The Bun and Node clients authenticate WS connections with the `Authorization` header by default and monitor heartbeats through server protocol pings (90-second timeout). The mock sends protocol pings automatically, so they stay connected. The Native client still uses ticket auth and JSON `ping`/`pong`.

## Auth Behavior in Mock Mode

- Protected REST endpoints still require `Authorization: Bearer <token>`.
- Token content is accepted as-is in mock mode (no real token validation).
- WS allows either:
  - ticket (`/api/v2/ws?ticket=...`) or
  - bearer token in `Authorization` header.
- `/api/v2/ws/ticket` requires an auth header and returns a short-lived one-time ticket.

## What Is Mocked

REST routes include (non-exhaustive):

- Twitch
  - `GET /api/v2/twitch/stream`
  - `GET /api/v2/twitch/scheduleLinkedStreams` (public; empty by default)
  - `GET /api/v2/twitch/vods`
  - `GET /api/v2/twitch/vod?id=...` (`streamId` is also accepted)
- Schedule
  - `GET /api/v2/schedule`
  - `GET /api/v2/schedule/latest`
  - `GET /api/v2/schedule/search`
  - `GET /api/v2/devstream/times`
  - `GET /api/v2/schedule/weeks`
- Subathon
  - `GET /api/v2/subathon` (active/current subathons)
  - `GET /api/v2/subathon/years` (returns `Record<year, name>`)
  - `GET /api/v2/subathon?year=...`
- Blog
  - `GET /api/v2/blog` (`raw=true` includes raw content when stored)
- X Feed
  - `GET /api/v2/x-feed?user=NeurosamaAI` (requires a token)
  - Supported users: `NeurosamaAI`, `EvilNeuroAI`, `Vedal987`
  - Missing or unsupported users return HTTP 400 with the mock error code `INVALID_USER`.
- Shop (requires a token)
  - `GET /api/v2/shop/products` (`currency` optional)
  - `GET /api/v2/shop/product?id=...` (`currency` optional)
  - Invalid or repeated parameters return `AP4`; unknown product IDs return `SH1`.
  - `currency` is trimmed and uppercased. The mock converts with static rates for `USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, `CHF`, `SEK`, and `PLN`. Other currencies keep their original prices, like the real API.

Schedules include `imageUrl: string | null` in REST responses, search results, and `scheduleUpdate` events. Existing state files are migrated automatically.

Additional docs/testing parity endpoint:

- `GET /api/test/geterror?code=AP1` (returns documented error payloads)

## UI Features

The UI at `/ui` supports:

- Editing Twitch (including schedule-linked streams), Schedule (including image URL), Subathon, X Feed, and Shop payloads
- Emitting WS events
- Resetting or replacing full state
- Importing selected data from real API into local state

Changes are persisted to:

- `src/mock-state.json`

Set `NIA_TEST_STATE_DIR` to use a separate directory for `mock-state.json`. `NIA_TEST_HOST` and `NIA_TEST_PORT` override the listening address and port.

## Import From Real API

Use test helper endpoint:

- `POST /api/v2/__test/import`

Payload:

```json
{
  "target": "vods",
  "token": "<real token>",
  "year": 2026,
  "week": 15
}
```

Supported targets:

- `stream`
- `vods`
- `scheduleLatest`
- `scheduleWeek`
- `subathonCurrent`
- `subathonYear`
- `devstreamtimes`
- `blogFeed`
- `xFeed` (also pass `"user": "NeurosamaAI"`, `"EvilNeuroAI"`, or `"Vedal987"`)
- `scheduleLinkedStreams`
- `shopProducts`

`PUT /api/v2/__test/x-feed` accepts `{ "user": "NeurosamaAI", "entries": [] }` and replaces that account's cached feed. Saving or importing entries emits `xFeedNewEntries` and the deprecated `xFeedUpdate` alias for post IDs absent from the previous feed. Both events carry `{ user, entries }`. Use the WS Emit panel to send arbitrary test events without changing the cached feed.

`PUT /api/v2/__test/twitch/scheduleLinkedStreams` replaces the schedule-linked streams list. It emits no events; use the WS Emit panel for `scheduleLinkedStreamOnline`, `scheduleLinkedStreamUpdate`, and `scheduleLinkedStreamOffline`.

`PUT /api/v2/__test/shop/products` replaces the shop catalog. Saving or importing a changed catalog emits `shopProductsUpdate` with `{ products }`.

## WS Protocol (for custom clients)

Inbound:

- `{"type":"addEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"removeEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"listEvents","data":{}}`
- `{"type":"ping","data":{}}`

Outbound message types:

- `welcome`
- `addSuccess`
- `removeSuccess`
- `listEvents`
- `event`
- `invalid`
- `pong`

## Internal Test Endpoints

The mock exposes helper endpoints under `/api/v2/__test/*` for UI and automation. Helpers include:

- state read/write/reset
- Twitch/Schedule/Subathon/Shop upserts
- event emission
- upstream import

These are intended for local development only.

## Checks

```bash
bun run tsc --noEmit
bun run tsc --project tests/tsconfig.json
bun test
```

Integration tests start an isolated server with temporary state. To test with a local client source instead of the installed package, set `NIA_TEST_CLIENT_PATH` to its absolute `NeuroInfoAPI-Client.ts` path.
