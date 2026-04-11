# NIA Mock Test Server

Local Bun server for testing code using NeuroInfoAPI against a controllable mock backend.

This project now covers:

- REST API mock endpoints (`/api/v1/...`)
- WebSocket endpoint + ticket auth flow (`/api/ws`, `/api/ws/ticket`)
- Browser UI for editing state and emitting events (`/ui`)
- JSON persistence (`src/mock-state.json`)
- Importing real data from upstream NeuroInfoApi via `neuroinfoapi-client`

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

Default URLs:

- UI: `http://localhost:8787/ui`
- Health: `http://localhost:8787/health`
- REST base: `http://localhost:8787/api/v1`
- WS endpoint: `ws://localhost:8787/api/ws`
- Ticket endpoint: `http://localhost:8787/api/ws/ticket`

## Auth Behavior in Mock Mode

- Protected REST endpoints still require `Authorization: Bearer <token>`.
- Token content is accepted as-is in mock mode (no real token validation).
- WS allows either:
  - ticket (`/api/ws?ticket=...`) or
  - bearer token in `Authorization` header.
- `/api/ws/ticket` requires an auth header and returns a short-lived one-time ticket.

## What Is Mocked

REST routes include (non-exhaustive):

- Twitch
  - `GET /api/v1/twitch/stream`
  - `GET /api/v1/twitch/vods`
  - `GET /api/v1/twitch/vod?streamId=...`
- Schedule
  - `GET /api/v1/schedule`
  - `GET /api/v1/schedule/latest`
  - `GET /api/v1/schedule/search`
  - `GET /api/v1/schedule/devstreamtimes`
- Subathon
  - `GET /api/v1/subathon/current`
  - `GET /api/v1/subathon/years`
  - `GET /api/v1/subathon?year=...`

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

- `POST /api/v1/__test/import`

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

The mock exposes helper endpoints under `/api/v1/__test/*` for UI and automation, including:

- state read/write/reset
- Twitch/Schedule/Subathon upserts
- event emission
- upstream import

These are intended for local development only.
