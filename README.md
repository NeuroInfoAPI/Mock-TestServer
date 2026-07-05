# NIA Mock Test Server

Local Bun server for testing code using NeuroInfoAPI against a controllable mock backend.

This project now covers:

- REST API mock endpoints (`/api/v2/...`)
- WebSocket endpoint + ticket auth flow (`/api/v2/ws`, `/api/v2/ws/ticket`)
- Browser UI for editing state and emitting events (`/ui`)
- JSON persistence (`src/mock-state.json`)
- Importing real data from upstream NeuroInfoApi v2 via `neuroinfoapi-client`

## Quick Start

Requirements:

- [Bun](https://bun.sh/)

Install deps:

```bash
cd Mock-TestServer
bun install
```

> [!NOTE]
> If some error accours with axios on starting the server please use `npm install` instead of `bun install`.

```bash
bun src/index.ts
```

Alternative script:

```bash
bun run run
```

Default URLs for `neuroinfoapi-client` v2:

- UI: `http://localhost:8787/ui`
- Health: `http://localhost:8787/health`
- REST base: `http://localhost:8787/api/v2`
- WS endpoint: `ws://localhost:8787/api/v2/ws`
- Ticket endpoint: `http://localhost:8787/api/v2/ws/ticket`


`neuroinfoapi-client` setup example:

```ts
import { NeuroInfoApiClient, NeuroInfoApiWebsocketClient } from "neuroinfoapi-client";

const api = new NeuroInfoApiClient("mock-token", {
  baseUrl: "http://localhost:8787/api/v2",
});

const ws = new NeuroInfoApiWebsocketClient("mock-token", {
  baseUrl: "ws://localhost:8787/api/v2/ws",
  apiBaseUrl: "http://localhost:8787/api/v2",
});
```

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

Additional docs/testing parity endpoint:

- `GET /api/test/geterror?code=AP1` (returns documented error payloads)

## UI Features

The UI at `/ui` supports:

- Editing Twitch, Schedule, and Subathon payloads
- Emitting WS events
- Resetting or replacing full state
- Importing selected data from real API into local state

Changes are persisted to:

- `src/mock-state.json`

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

## WS Protocol (for custom clients)

Inbound:

- `{"type":"addEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"removeEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"listEvents","data":{}}`

Outbound message types:

- `welcome`
- `addSuccess`
- `removeSuccess`
- `listEvents`
- `event`
- `invalid`

## Internal Test Endpoints

The mock exposes helper endpoints under `/api/v2/__test/*` for UI and automation. Helpers include:

- state read/write/reset
- Twitch/Schedule/Subathon upserts
- event emission
- upstream import

These are intended for local development only.
