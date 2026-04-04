export namespace NiaTestServer {
  export type WsEventType =
    | "scheduleUpdate"
    | "subathonUpdate"
    | "subathonGoalUpdate"
    | "streamOnline"
    | "streamUpdate"
    | "streamOffline"
    | "secretneuroaccountOnline"
    | "streamRaidIncoming"
    | "streamRaidOutgoing";

  type WsInvalidReason =
    | "malformed"
    | "unauthenticated"
    | "missingEventtype"
    | "invalidEventtype"
    | "missingToken"
    | "invalidToken"
    | "authError";

  interface WsStreamOnlineData {
    isLive: true;
    id: string;
    title: string;
    game: { id: string; name: string };
    language: string;
    tags: string[];
    isMature: boolean;
    viewerCount: number;
    startedAt: number;
    thumbnailUrl: string;
  }

  interface WsStreamOfflineData {
    isLive: false;
  }

  interface WsStreamUpdateData {
    title: string;
    game: { id: string; name: string };
    language: string;
    isMature: boolean;
  }

  interface WsStreamRaidData {
    channel: { displayName: string; name: string; id: string };
    viewerCount: number;
  }

  interface ScheduleEntry {
    day: number;
    time: number;
    message: string;
    type: "normal" | "offline" | "canceled" | "TBD" | "unknown";
  }

  interface WsScheduleUpdateData {
    year: number;
    week: number;
    schedule: ScheduleEntry[];
    isFinal: boolean;
  }

  interface SubathonGoal {
    name: string;
    completed: boolean;
    reached: boolean;
  }

  interface WsSubathonUpdateData {
    year: number;
    name: string;
    subcount: number;
    goals: { [goal: number]: SubathonGoal };
    isActive: boolean;
    startTimestamp?: number;
    endTimestamp?: number;
  }

  interface WsSubathonGoalUpdateData {
    year: number;
    goalNumber: number;
    goal: SubathonGoal;
    subcount: number;
  }

  interface WsEventDataMap {
    streamOnline: WsStreamOnlineData;
    streamOffline: WsStreamOfflineData;
    streamUpdate: WsStreamUpdateData;
    secretneuroaccountOnline: WsStreamOnlineData;
    streamRaidIncoming: WsStreamRaidData;
    streamRaidOutgoing: WsStreamRaidData;
    scheduleUpdate: WsScheduleUpdateData;
    subathonUpdate: WsSubathonUpdateData;
    subathonGoalUpdate: WsSubathonGoalUpdateData;
  }

  type ClientRequest =
    | { type: "addEvent"; data?: { eventType?: unknown } }
    | { type: "removeEvent"; data?: { eventType?: unknown } }
    | { type: "listEvents"; data?: Record<string, never> };

  interface ConnectionData {
    sessionId: string;
    authHint: string | null;
    openedAt: number;
  }

  const WS_PATH = "/api/ws";
  const TICKET_PATH = "/api/ws/ticket";
  const EVENT_SUBSCRIPTION_PREFIX = "sub.event:";
  const TICKET_TTL_MS = 30_000;

  export const ALL_EVENT_TYPES: readonly WsEventType[] = [
    "scheduleUpdate",
    "subathonUpdate",
    "subathonGoalUpdate",
    "streamOnline",
    "streamUpdate",
    "streamOffline",
    "secretneuroaccountOnline",
    "streamRaidIncoming",
    "streamRaidOutgoing",
  ] as const;

  const ALL_EVENT_TYPES_SET = new Set<WsEventType>(ALL_EVENT_TYPES);
  const textDecoder = new TextDecoder();

  const DB_SCHEDULE_MESSAGES = [
    "Neuro Stream",
    "Neuro Karaoke",
    "Evil Stream",
    "Evil's Birthday",
    "Offline",
    "Dev Stream",
    "Dev Stream + Neuro Stream",
    "Chill Stream",
    "Bakery Stream",
    "Beach Stream",
    "Cave Stream",
    "Cities Skylines 2!",
    "Cowboy stream!",
    "Collab",
    "Assassin's Creed: Shadows (sponsored)",
    "Cyberpunk themed stream",
    "Chess with viewers",
    "CodeMiko interview",
    "Cursed house review with Filipino Frank",
    "Deep diving conspiracy theories",
  ] as const;

  const DB_VOD_TITLES = [
    "Neuro stream? today is a great day",
    "Evil sabotages Vedal in Hollow Knight",
    "evil is back",
    "EVIL'S BIRTHDAY",
    "slightly experimental neuro stream",
    "Hollow Knight but Vedal and Evil won't stop buggin",
    "Prepare for Evil!!!",
    "Evil's singing can make dreams come true",
    "you wouldn't believe",
    "Evil and Vedal bugging out in Hollow Knight",
    "neuro stream!",
    "Neuro and Camila drawing competition",
    "Devious Evil stream today",
    "Neuro Karaoke is here to make your day better",
    "neuro is SO back",
  ] as const;

  const DB_SUBATHON_NAMES = ["Neuro-sama Subathon", "Neuro-sama Subathon 2", "Neuro-sama Subathon 3"] as const;

  const DB_SUBATHON_GOAL_NAMES = [
    "Commission art of Neuro's choice",
    "Neuro gets access to Amazon",
    "Unban requests",
    "Neuro covers a song of her choice",
    "Neuro buys stocks",
    "Neuro tweets on Vedal's account",
    "Chat picks presentation topic",
    "Karaoke in VRChat",
    "Cave stream 3D",
    "Evil ASMR stream",
    "Evil outfit contest",
    "Neuro designs a website",
    "Neuro original song",
    "Swap models with Neuro",
    "Twin rap battle",
    "Vedal plush",
    "VRChat slumber party",
    "Shock collar stream",
    "Twins on Amazon",
    "Regularly updated Neuro blog",
  ] as const;

  const STREAM_GAMES = [
    "Hollow Knight",
    "Just Chatting",
    "Cities: Skylines II",
    "VRChat",
    "Cyberpunk 2077",
    "Assassin's Creed: Shadows",
    "Chess",
  ] as const;

  const STREAM_TAGS = ["AI", "VTuber", "Karaoke", "Collab", "Dev", "Gaming", "Chaos", "Neuro", "Evil"] as const;

  const RAID_CHANNELS = [
    { displayName: "Filian", name: "filian" },
    { displayName: "Camila", name: "camila" },
    { displayName: "CodeMiko", name: "codemiko" },
    { displayName: "Monii", name: "moniibagel" },
    { displayName: "Mage Mimi", name: "magemimi" },
  ] as const;

  export interface StartOptions {
    host?: string;
    port?: number;
  }

  export interface Runtime {
    readonly host: string;
    readonly port: number;
    readonly endpoint: string;
    readonly ticketApiUrl: string;
    getAllEventTypes(): readonly WsEventType[];
    getActiveClients(): number;
    getSubscribedCount(eventType: WsEventType): number;
    emitDefaultEvent(eventType: WsEventType): void;
    stop(reason?: string): void;
  }

  export function start(options: StartOptions = {}): Runtime {
    const host = options.host ?? "0.0.0.0";
    const requestedPort = Number.isFinite(Number(options.port)) ? Number(options.port) : 8787;

    const ticketStore = new Map<string, number>();
    const connections = new Set<Bun.ServerWebSocket<ConnectionData>>();
    let isStopped = false;

    const server = Bun.serve<ConnectionData>({
      hostname: host,
      port: requestedPort,
      fetch(req, bunServer) {
        const url = new URL(req.url);

        if (req.method === "GET" && url.pathname === "/health") {
          return jsonResponse({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
        }

        if (req.method === "GET" && url.pathname === TICKET_PATH) {
          const ticket = issueTicket(ticketStore);
          return jsonResponse({
            data: {
              ticket,
              expiresIn: Math.floor(TICKET_TTL_MS / 1000),
              usage: `Connect with ws://localhost:${requestedPort}${WS_PATH}?ticket=<ticket>`,
            },
          });
        }

        if (url.pathname !== WS_PATH) {
          return new Response("Not Found", { status: 404 });
        }

        const sessionId = createSessionId();
        const authHint = extractAuthHint(req, url);
        const incomingTicket = url.searchParams.get("ticket");

        // Test mode: any ticket/token is accepted. Known tickets are still consumed for realistic flow.
        if (incomingTicket) {
          consumeTicket(ticketStore, incomingTicket);
        }

        if (
          bunServer.upgrade(req, {
            data: {
              sessionId,
              authHint,
              openedAt: Date.now(),
            },
          })
        ) {
          return;
        }

        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        open(ws) {
          connections.add(ws);
          ws.send(
            encodeMessage("welcome", {
              sessionId: ws.data.sessionId,
            }),
          );
          log(`client connected | session=${ws.data.sessionId} | auth=${ws.data.authHint ?? "none"} | active=${connections.size}`);
        },
        close(ws, code, reason) {
          connections.delete(ws);
          const lifetimeMs = Date.now() - ws.data.openedAt;
          log(
            `client disconnected | session=${ws.data.sessionId} | code=${code} | reason=${String(reason || "<none>")} | lifetimeMs=${lifetimeMs} | active=${connections.size}`,
          );
        },
        message(ws, rawMessage) {
          const text = typeof rawMessage === "string" ? rawMessage : textDecoder.decode(rawMessage);
          const request = parseClientRequest(text);

          if (!request) {
            sendInvalid(ws, "malformed", "Could not parse message.");
            return;
          }

          handleClientRequest(ws, request);
        },
        sendPings: true,
        idleTimeout: 120,
      },
    });

    function handleClientRequest(ws: Bun.ServerWebSocket<ConnectionData>, request: ClientRequest): void {
      switch (request.type) {
        case "addEvent": {
          const eventType = request.data?.eventType;
          if (!eventType) {
            sendInvalid(ws, "missingEventtype", "Event type is required.");
            return;
          }

          if (!isWsEventType(eventType)) {
            sendInvalid(ws, "invalidEventtype", `Unknown event type: ${String(eventType)}`);
            return;
          }

          const subscribed = addEventSubscription(ws, eventType);
          ws.send(
            encodeMessage("addSuccess", {
              eventType,
              subscribed,
            }),
          );
          return;
        }

        case "removeEvent": {
          const eventType = request.data?.eventType;
          if (!eventType) {
            sendInvalid(ws, "missingEventtype", "Event type is required.");
            return;
          }

          if (!isWsEventType(eventType)) {
            sendInvalid(ws, "invalidEventtype", `Unknown event type: ${String(eventType)}`);
            return;
          }

          const unsubscribed = removeEventSubscription(ws, eventType);
          ws.send(
            encodeMessage("removeSuccess", {
              eventType,
              unsubscribed,
            }),
          );
          return;
        }

        case "listEvents": {
          const subscribedEvents = ALL_EVENT_TYPES.filter((eventType) => ws.subscriptions.includes(EVENT_SUBSCRIPTION_PREFIX + eventType));

          ws.send(
            encodeMessage("listEvents", {
              subscribedEvents,
              availableEvents: [...ALL_EVENT_TYPES],
            }),
          );
          return;
        }
      }
    }

    function addEventSubscription(ws: Bun.ServerWebSocket<ConnectionData>, eventType: WsEventType): boolean {
      const topic = EVENT_SUBSCRIPTION_PREFIX + eventType;
      if (ws.subscriptions.includes(topic)) return false;
      ws.subscribe(topic);
      return true;
    }

    function removeEventSubscription(ws: Bun.ServerWebSocket<ConnectionData>, eventType: WsEventType): boolean {
      const topic = EVENT_SUBSCRIPTION_PREFIX + eventType;
      if (!ws.subscriptions.includes(topic)) return false;
      ws.unsubscribe(topic);
      return true;
    }

    function sendInvalid(ws: Bun.ServerWebSocket<ConnectionData>, reason: WsInvalidReason, message?: string): void {
      ws.send(
        encodeMessage("invalid", {
          reason,
          message,
        }),
      );
    }

    function emitEvent<T extends WsEventType>(eventType: T, eventData: WsEventDataMap[T], origin: "internal" | "manual"): void {
      if (isStopped) return;

      const message = encodeMessage("event", {
        eventType,
        eventData,
        timestamp: Date.now(),
      });

      server.publish(EVENT_SUBSCRIPTION_PREFIX + eventType, message);
      log(`broadcast ${eventType} | origin=${origin} | clients=${getSubscribedCount(eventType)}`);
    }

    function getEventSubscriberCounts(): Record<WsEventType, number> {
      const counts: Record<WsEventType, number> = {
        scheduleUpdate: 0,
        subathonUpdate: 0,
        subathonGoalUpdate: 0,
        streamOnline: 0,
        streamUpdate: 0,
        streamOffline: 0,
        secretneuroaccountOnline: 0,
        streamRaidIncoming: 0,
        streamRaidOutgoing: 0,
      };

      for (const ws of connections) {
        for (const eventType of ALL_EVENT_TYPES) {
          if (ws.subscriptions.includes(EVENT_SUBSCRIPTION_PREFIX + eventType)) {
            counts[eventType] += 1;
          }
        }
      }

      return counts;
    }

    function getSubscribedCount(eventType: WsEventType): number {
      return getEventSubscriberCounts()[eventType];
    }

    function emitDefaultEvent(eventType: WsEventType): void {
      emitEvent(eventType, generateEventData(eventType), "manual");
    }

    function stop(reason = "shutdown"): void {
      if (isStopped) return;
      isStopped = true;

      log(`shutdown requested | reason=${reason}`);

      for (const ws of connections) {
        ws.close(1001, "Server shutdown");
      }
      connections.clear();

      try {
        server.stop(true);
      } catch {}
    }

    const runtimePort = server.port ?? requestedPort;

    return {
      host,
      port: runtimePort,
      endpoint: `ws://localhost:${runtimePort}${WS_PATH}`,
      ticketApiUrl: `http://localhost:${runtimePort}${TICKET_PATH}`,
      getAllEventTypes: () => ALL_EVENT_TYPES,
      getActiveClients: () => connections.size,
      getSubscribedCount,
      emitDefaultEvent,
      stop,
    };
  }

  function parseClientRequest(text: string): ClientRequest | null {
    try {
      const parsed = JSON.parse(text) as { type?: unknown; data?: unknown };
      if (typeof parsed !== "object" || parsed == null) return null;
      if (typeof parsed.type !== "string") return null;
      if (parsed.type === "addEvent" || parsed.type === "removeEvent" || parsed.type === "listEvents") {
        return parsed as ClientRequest;
      }
    } catch {
      return null;
    }

    return null;
  }

  function isWsEventType(value: unknown): value is WsEventType {
    return typeof value === "string" && ALL_EVENT_TYPES_SET.has(value as WsEventType);
  }

  function issueTicket(ticketStore: Map<string, number>): string {
    cleanupExpiredTickets(ticketStore);
    const ticket = crypto.randomUUID().replace(/-/g, "");
    ticketStore.set(ticket, Date.now() + TICKET_TTL_MS);
    return ticket;
  }

  function consumeTicket(ticketStore: Map<string, number>, ticket: string): boolean {
    const expiresAt = ticketStore.get(ticket);
    ticketStore.delete(ticket);
    if (!expiresAt) return false;
    return expiresAt >= Date.now();
  }

  function cleanupExpiredTickets(ticketStore: Map<string, number>): void {
    const now = Date.now();
    for (const [ticket, expiresAt] of ticketStore.entries()) {
      if (expiresAt < now) {
        ticketStore.delete(ticket);
      }
    }
  }

  function extractAuthHint(req: Request, url: URL): string | null {
    const ticket = url.searchParams.get("ticket");
    if (ticket) return `ticket:${ticket.slice(0, 8)}...`;

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      return `token:${token.slice(0, 8)}...`;
    }

    return null;
  }

  function encodeMessage<T extends string, D extends Record<string, unknown>>(type: T, data: D): string {
    return JSON.stringify({ type, data });
  }

  function createSessionId(): string {
    return `sim-${Date.now().toString(36)}-${randomInt(1000, 9999)}`;
  }

  function generateEventData<T extends WsEventType>(eventType: T): WsEventDataMap[T] {
    switch (eventType) {
      case "streamOnline":
      case "secretneuroaccountOnline":
        return createStreamOnlineData() as WsEventDataMap[T];
      case "streamOffline":
        return { isLive: false } as WsEventDataMap[T];
      case "streamUpdate":
        return createStreamUpdateData() as WsEventDataMap[T];
      case "streamRaidIncoming":
      case "streamRaidOutgoing":
        return createStreamRaidData() as WsEventDataMap[T];
      case "scheduleUpdate":
        return createScheduleUpdateData() as WsEventDataMap[T];
      case "subathonUpdate":
        return createSubathonUpdateData() as WsEventDataMap[T];
      case "subathonGoalUpdate":
        return createSubathonGoalUpdateData(createSubathonUpdateData()) as WsEventDataMap[T];
    }
  }

  function createStreamOnlineData(): WsStreamOnlineData {
    return {
      isLive: true,
      id: randomDigits(12),
      title: pickOne(DB_VOD_TITLES),
      game: {
        id: randomDigits(6),
        name: pickOne(STREAM_GAMES),
      },
      language: "en",
      tags: pickMany(STREAM_TAGS, randomInt(2, 4)),
      isMature: Math.random() < 0.15,
      viewerCount: randomInt(1200, 320000),
      startedAt: Date.now() - randomInt(5 * 60 * 1000, 4 * 60 * 60 * 1000),
      thumbnailUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_vedal987-${randomInt(640, 1920)}x${randomInt(360, 1080)}.jpg`,
    };
  }

  function createStreamUpdateData(): WsStreamUpdateData {
    return {
      title: pickOne(DB_VOD_TITLES),
      game: {
        id: randomDigits(6),
        name: pickOne(STREAM_GAMES),
      },
      language: "en",
      isMature: Math.random() < 0.15,
    };
  }

  function createStreamRaidData(): WsStreamRaidData {
    const channel = pickOne(RAID_CHANNELS);
    return {
      channel: {
        displayName: channel.displayName,
        name: channel.name,
        id: randomDigits(9),
      },
      viewerCount: randomInt(50, 25000),
    };
  }

  function createScheduleUpdateData(): WsScheduleUpdateData {
    const now = new Date();
    const year = now.getUTCFullYear();
    const week = getIsoWeek(now);
    const startOfWeek = getStartOfIsoWeek(now).getTime();
    const entryCount = randomInt(3, 7);
    const schedule: ScheduleEntry[] = [];

    for (let i = 0; i < entryCount; i++) {
      const day = randomInt(0, 6);
      const hour = randomInt(16, 23);
      const minute = pickOne([0, 15, 30, 45] as const);
      const time = startOfWeek + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000 + minute * 60 * 1000;

      schedule.push({
        day,
        time,
        message: pickOne(DB_SCHEDULE_MESSAGES),
        type: pickScheduleType(),
      });
    }

    return {
      year,
      week,
      schedule,
      isFinal: Math.random() < 0.7,
    };
  }

  function createSubathonUpdateData(): WsSubathonUpdateData {
    const year = pickOne([2023, 2024, 2025] as const);
    const goalCount = randomInt(4, 10);
    const goals: { [goal: number]: SubathonGoal } = {};
    const pickedGoalNames = pickMany(DB_SUBATHON_GOAL_NAMES, goalCount);
    const subcount = randomInt(800, 380000);

    pickedGoalNames.forEach((goalName, index) => {
      const goalNumber = (index + 1) * 1000;
      const reached = subcount >= goalNumber;

      goals[goalNumber] = {
        name: goalName,
        completed: reached ? Math.random() < 0.92 : false,
        reached,
      };
    });

    const isActive = Math.random() < 0.8;
    const startTimestamp = Date.now() - randomInt(1, 8) * 24 * 60 * 60 * 1000;
    const endTimestamp = isActive ? undefined : startTimestamp + randomInt(3, 18) * 60 * 60 * 1000;

    return {
      year,
      name: pickOne(DB_SUBATHON_NAMES),
      subcount,
      goals,
      isActive,
      startTimestamp,
      endTimestamp,
    };
  }

  function createSubathonGoalUpdateData(subathon: WsSubathonUpdateData): WsSubathonGoalUpdateData | null {
    const goalNumbers = Object.keys(subathon.goals).map((goal) => Number(goal));
    if (goalNumbers.length === 0) return null;

    const goalNumber = pickOne(goalNumbers);
    const goal = subathon.goals[goalNumber];
    if (!goal) return null;

    return {
      year: subathon.year,
      goalNumber,
      goal: deepClone(goal),
      subcount: subathon.subcount,
    };
  }

  function randomDigits(length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += randomInt(0, 9).toString();
    }
    return out;
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickOne<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    return items[randomInt(0, items.length - 1)] as T;
  }

  function pickMany<T>(items: readonly T[], count: number): T[] {
    if (items.length === 0) return [];
    const clone = [...items];

    for (let i = clone.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }

    return clone.slice(0, Math.max(1, Math.min(count, clone.length)));
  }

  function pickScheduleType(): "normal" | "offline" | "canceled" | "TBD" | "unknown" {
    const roll = Math.random();
    if (roll < 0.72) return "normal";
    if (roll < 0.82) return "offline";
    if (roll < 0.9) return "TBD";
    if (roll < 0.96) return "canceled";
    return "unknown";
  }

  function getIsoWeek(date: Date): number {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  }

  function getStartOfIsoWeek(date: Date): Date {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
    utcDate.setUTCHours(0, 0, 0, 0);
    return utcDate;
  }

  function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function jsonResponse(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
      },
    });
  }

  function log(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}
