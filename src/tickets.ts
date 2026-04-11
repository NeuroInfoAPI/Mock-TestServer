import { randomUUID } from "node:crypto";

interface TicketData {
  authKey: string;
  expiresAt: number;
}

export class TicketStore {
  private readonly ttlMs: number;
  private readonly entries = new Map<string, TicketData>();

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
  }

  issue(authKey: string): string {
    this.cleanupExpired();

    const ticket = randomUUID().replace(/-/g, "");
    this.entries.set(ticket, {
      authKey,
      expiresAt: Date.now() + this.ttlMs,
    });

    return ticket;
  }

  consume(ticket: string): TicketData | null {
    const entry = this.entries.get(ticket);
    this.entries.delete(ticket);

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null;
    return entry;
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [ticket, data] of this.entries) {
      if (data.expiresAt < now) this.entries.delete(ticket);
    }
  }

  get ttlSeconds(): number {
    return Math.floor(this.ttlMs / 1000);
  }
}
