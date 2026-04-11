import { ConnectionData, WsEventDataMap, WsEventType, WsInvalidReason, ALL_EVENT_TYPES } from "./contracts";

const EVENT_SUBSCRIPTION_PREFIX = "sub.event:";
const EVENT_TYPES_SET = new Set<WsEventType>(ALL_EVENT_TYPES);

function encodeMessage<T extends string, D extends Record<string, unknown>>(type: T, data: D): string {
  return JSON.stringify({ type, data });
}

export class WsHub {
  private readonly connections = new Set<Bun.ServerWebSocket<ConnectionData>>();
  private readonly connectionsByAuth = new Map<string, number>();
  private readonly decoder = new TextDecoder();

  onOpen(ws: Bun.ServerWebSocket<ConnectionData>): void {
    this.connections.add(ws);
    this.connectionsByAuth.set(ws.data.authKey, (this.connectionsByAuth.get(ws.data.authKey) || 0) + 1);

    ws.send(
      encodeMessage("welcome", {
        sessionId: ws.data.sessionId,
      }),
    );
  }

  onClose(ws: Bun.ServerWebSocket<ConnectionData>): void {
    this.connections.delete(ws);

    const current = this.connectionsByAuth.get(ws.data.authKey) || 1;
    if (current <= 1) this.connectionsByAuth.delete(ws.data.authKey);
    else this.connectionsByAuth.set(ws.data.authKey, current - 1);
  }

  onMessage(ws: Bun.ServerWebSocket<ConnectionData>, raw: string | BufferSource): void {
    const text = typeof raw === "string" ? raw : this.decoder.decode(raw);

    let parsed: { type?: unknown; data?: { eventType?: unknown } } | null = null;
    try {
      parsed = JSON.parse(text) as { type?: unknown; data?: { eventType?: unknown } };
    } catch {
      this.sendInvalid(ws, "malformed", "Could not parse message.");
      return;
    }

    if (!parsed || typeof parsed.type !== "string") {
      this.sendInvalid(ws, "malformed", "Message type is missing.");
      return;
    }

    if (parsed.type === "addEvent") {
      const eventType = parsed.data?.eventType;
      if (typeof eventType !== "string" || eventType.length === 0) {
        this.sendInvalid(ws, "missingEventtype", "Event type is required.");
        return;
      }

      if (!EVENT_TYPES_SET.has(eventType as WsEventType)) {
        this.sendInvalid(ws, "invalidEventtype", `Unknown event type: ${eventType}`);
        return;
      }

      const subscribed = this.addSubscription(ws, eventType as WsEventType);
      ws.send(
        encodeMessage("addSuccess", {
          eventType,
          subscribed,
        }),
      );
      return;
    }

    if (parsed.type === "removeEvent") {
      const eventType = parsed.data?.eventType;
      if (typeof eventType !== "string" || eventType.length === 0) {
        this.sendInvalid(ws, "missingEventtype", "Event type is required.");
        return;
      }

      if (!EVENT_TYPES_SET.has(eventType as WsEventType)) {
        this.sendInvalid(ws, "invalidEventtype", `Unknown event type: ${eventType}`);
        return;
      }

      const unsubscribed = this.removeSubscription(ws, eventType as WsEventType);
      ws.send(
        encodeMessage("removeSuccess", {
          eventType,
          unsubscribed,
        }),
      );
      return;
    }

    if (parsed.type === "listEvents") {
      const subscribedEvents = ALL_EVENT_TYPES.filter((eventType) => ws.subscriptions.includes(EVENT_SUBSCRIPTION_PREFIX + eventType));
      ws.send(
        encodeMessage("listEvents", {
          subscribedEvents,
          availableEvents: [...ALL_EVENT_TYPES],
        }),
      );
      return;
    }

    this.sendInvalid(ws, "malformed", `Unknown message type: ${parsed.type}`);
  }

  broadcast<T extends WsEventType>(eventType: T, eventData: WsEventDataMap[T], timestamp: number = Date.now()): void {
    if (!EVENT_TYPES_SET.has(eventType)) return;

    const message = encodeMessage("event", {
      eventType,
      eventData,
      timestamp,
    });

    for (const ws of this.connections) {
      if (!ws.subscriptions.includes(EVENT_SUBSCRIPTION_PREFIX + eventType)) continue;
      ws.send(message);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionCountForAuth(authKey: string): number {
    return this.connectionsByAuth.get(authKey) || 0;
  }

  getSubscriptionCounts(): Record<WsEventType, number> {
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

    for (const ws of this.connections) {
      for (const eventType of ALL_EVENT_TYPES) {
        if (ws.subscriptions.includes(EVENT_SUBSCRIPTION_PREFIX + eventType)) {
          counts[eventType] += 1;
        }
      }
    }

    return counts;
  }

  private addSubscription(ws: Bun.ServerWebSocket<ConnectionData>, eventType: WsEventType): boolean {
    const topic = EVENT_SUBSCRIPTION_PREFIX + eventType;
    if (ws.subscriptions.includes(topic)) return false;

    ws.data.subscriptions.add(eventType);
    ws.subscribe(topic);
    return true;
  }

  private removeSubscription(ws: Bun.ServerWebSocket<ConnectionData>, eventType: WsEventType): boolean {
    const topic = EVENT_SUBSCRIPTION_PREFIX + eventType;
    if (!ws.subscriptions.includes(topic)) return false;

    ws.data.subscriptions.delete(eventType);
    ws.unsubscribe(topic);
    return true;
  }

  private sendInvalid(ws: Bun.ServerWebSocket<ConnectionData>, reason: WsInvalidReason, message?: string): void {
    ws.send(
      encodeMessage("invalid", {
        reason,
        message,
      }),
    );
  }
}
