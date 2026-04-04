# NIA WS Test Server

Use this repository to test your app's `NeuroInfoApiWebsocketClient` integration locally, without waiting for real live events.

This server emulates the NIA WebSocket flow and lets you manually broadcast events from a CLI menu.

## What this test server provides

- WebSocket endpoint: `ws://localhost:8787/api/ws`
- Ticket endpoint: `http://localhost:8787/api/ws/ticket`
- Health endpoint: `http://localhost:8787/health`
- Manual event broadcasting from a terminal menu
- Test mode auth behavior: any token/ticket is accepted

Supported event types:

- `scheduleUpdate`
- `subathonUpdate`
- `subathonGoalUpdate`
- `streamOnline`
- `streamUpdate`
- `streamOffline`
- `secretneuroaccountOnline`
- `streamRaidIncoming`
- `streamRaidOutgoing`

## 1) Prepare this repository

**Requirements**:
- Bun installed

Clone and enter the repository:

```bash
git clone <your-repo-url>
cd NIA-WS-TestServer
```

Install dependencies:

```bash
bun install
```

Start the test server:

```bash
bun run start
```

By default it runs on port `8787`.
For testing, keep this default and point your app code to that URL directly.

When started, the CLI shows:

- Endpoint URL
- Ticket API URL
- A numbered menu to broadcast events

## 2) Refactor your app to support local WS testing

If your app currently hardcodes production URLs, add a small config layer so you can switch between production and local test server.

[Example (`TypeScript`)](./tests/test.ts):

```ts
import { NeuroInfoApiWebsocketClient } from "neuroinfoapi-client";

function createNiaWsClient() {
  const token = "local-test"; // You can still use your real token here. 

  // Set local test server URLs directly in code while testing.
  return new NeuroInfoApiWebsocketClient(token, {
    baseUrl: "ws://localhost:8787/api/ws",
    apiBaseUrl: "http://localhost:8787/api",
    authMethod: "ticket", // works in browser and Node
  });
}

export async function startNiaWs() {
  const wsClient = createNiaWsClient();

  wsClient.on("_connected", (sessionId) => console.log("Connected:", sessionId));
  wsClient.on("_error", (err) => console.error("WS error:", err));

  await wsClient.connect();

  // Subscribe to any events your app needs
  wsClient.on("scheduleUpdate", (data) => console.log("schedule week:", data.week));
  wsClient.on("subathonUpdate", (data) => console.log("subathon:", data.name));

  return wsClient;
}

void startNiaWs().catch((error) => {
  console.error("Failed to start NIA WS client:", error);
});
```

## 3) Point your app to this local test server in code

Like in the example above, set your WebSocket and API base URLs to the local test server:

- `baseUrl`: `ws://localhost:8787/api/ws`
- `apiBaseUrl`: `http://localhost:8787/api`
- token: any placeholder string such as `local-test` or real token.

Start the test server first, then run your app normally.

## 4) Trigger test events

In the test server terminal, enter the number of an event type in the menu.

The server will broadcast that event to all clients currently subscribed to that event.

Typical test flow:

1. Start this test server (`bun run start`)
2. Start your app with local WS URLs set directly in code
3. Wait for `_connected`
4. Trigger `streamOnline` and confirm your handler runs
5. Trigger `streamOffline` and confirm state reset
6. Trigger `scheduleUpdate` / `subathonUpdate` and validate parsing

## 5) Troubleshooting

- Connection fails immediately: check your app uses `ws://localhost:8787/api/ws` for WebSocket.
- Ticket fetch fails: check `apiBaseUrl` in your code is `http://localhost:8787/api` (not `/api/ws`).
- Connected but no events received: make sure your app has subscribed/listeners for that specific event.
- Different port required: update the server port in your project and then update `baseUrl` and `apiBaseUrl` in your app code accordingly.

## Protocol notes (if you are not using the official client)

The server accepts JSON messages:

- `{"type":"addEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"removeEvent","data":{"eventType":"streamOnline"}}`
- `{"type":"listEvents","data":{}}`

And emits messages like:

- `welcome`
- `addSuccess`
- `removeSuccess`
- `listEvents`
- `event`
- `invalid`

If you are using `NeuroInfoApiWebsocketClient`, these protocol details are handled for you.
