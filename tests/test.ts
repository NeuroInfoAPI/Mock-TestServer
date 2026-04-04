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
