import { createInterface } from "node:readline";
import { NiaTestServer } from "./server";

export namespace NiaTestCli {
  export interface RunOptions {
    server: NiaTestServer.Runtime;
  }

  export async function run(options: RunOptions): Promise<void> {
    const { server } = options;

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let isExiting = false;

    function shutdown(reason: string, exitCode: number): void {
      if (isExiting) return;
      isExiting = true;

      server.stop(reason);

      try {
        rl.close();
      } catch {}

      process.exit(exitCode);
    }

    rl.on("SIGINT", () => process.emit("SIGINT"));
    rl.on("SIGTERM", () => process.emit("SIGTERM"));

    process.on("SIGINT", () => shutdown("SIGINT", 0));
    process.on("SIGTERM", () => shutdown("SIGTERM", 0));
    process.on("uncaughtException", (error) => {
      console.error(error);
      shutdown("uncaughtException", 1);
    });
    process.on("unhandledRejection", (error) => {
      console.error(error);
      shutdown("unhandledRejection", 1);
    });

    printStartupHelp(server);

    while (!isExiting) {
      clearScreen();
      renderMainMenu(server);

      const selection = (await askConsole(rl, "Selection: ")).trim();

      if (selection === "0") {
        shutdown("menu-exit", 0);
        return;
      }

      if (!selection) continue;

      const eventType = toEventTypeFromMenu(selection, server.getAllEventTypes());
      if (!eventType) continue;

      server.emitDefaultEvent(eventType);
    }
  }

  function renderMainMenu(server: NiaTestServer.Runtime): void {
    console.log("NIA WS Test Server");
    console.log(`Endpoint: ${server.endpoint}`);
    console.log(`Ticket API: ${server.ticketApiUrl}`);
    console.log(`Active clients: ${server.getActiveClients()}`);
    console.log("");
    console.log("Send event:");

    const eventTypes = server.getAllEventTypes();
    for (let index = 0; index < eventTypes.length; index++) {
      const eventType = eventTypes[index];
      console.log(`[${index + 1}] ${eventType} (Subs: ${server.getSubscribedCount(eventType)})`);
    }

    console.log("");
    console.log("[0] Exit server");
  }

  function printStartupHelp(server: NiaTestServer.Runtime): void {
    clearScreen();
    console.log("NIA WebSocket Test Server");
    console.log("Server started.");
    console.log(`Endpoint: ${server.endpoint}`);
    console.log(`Ticket API: ${server.ticketApiUrl}`);
    console.log("All tokens/tickets are accepted.");
    console.log("Choose an event number to broadcast it.");
    console.log("");
  }

  function toEventTypeFromMenu(input: string, eventTypes: readonly NiaTestServer.WsEventType[]): NiaTestServer.WsEventType | null {
    const asNumber = Number(input);
    if (!Number.isInteger(asNumber)) return null;
    if (asNumber < 1 || asNumber > eventTypes.length) return null;
    return eventTypes[asNumber - 1] as NiaTestServer.WsEventType;
  }

  function clearScreen(): void {
    if (!process.stdout.isTTY) {
      console.log("\n");
      return;
    }

    process.stdout.write("\x1b[2J\x1b[H");
  }

  function askConsole(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.resume();
      rl.question(question, (answer) => resolve(answer));
    });
  }
}
