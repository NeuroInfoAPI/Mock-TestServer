import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { extractBearerToken, isUnlimitedToken, requireAuthHeader } from "./auth";
import {
  ALL_EVENT_TYPES,
  ALL_SCHEDULE_DAY_TYPES,
  ALL_SCHEDULE_STATUSES,
  BlogFeedData,
  ConnectionData,
  ImportTarget,
  MockState,
  ScheduleResponse,
  ScheduleSearchResultItem,
  ScheduleStatus,
  SubathonData,
  TwitchStreamData,
  TwitchVod,
  WsEventType,
} from "./contracts";
import { compareYearWeek, getIsoWeekAndYear, getScheduleKey } from "./defaults";
import { errorPayload, isApiErrorCode } from "./errors";
import { StateStore } from "./stateStore";
import { TicketStore } from "./tickets";
import {
  asNumberArray,
  asBlogFeedData,
  asScheduleResponse,
  asSubathonArray,
  asSubathonData,
  asTwitchStreamData,
  asTwitchVods,
  importFromUpstream,
} from "./upstream";
import { WsHub } from "./wsHub";

export namespace Index {}

const PORT = Number(process.env.NIA_TEST_PORT ?? 8787);
const HOST = process.env.NIA_TEST_HOST ?? "0.0.0.0";
const SOURCE_DIR = __dirname;
const UI_DIR = join(SOURCE_DIR, "ui");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const IMPORT_TARGETS: ImportTarget[] = [
  "stream",
  "vods",
  "scheduleLatest",
  "scheduleWeek",
  "subathonCurrent",
  "subathonYear",
  "devstreamtimes",
  "blogFeed",
];

function getApiPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/v2(\/.*)$/);
  return match?.[1] ?? null;
}

function isWsPath(pathname: string): boolean {
  return getApiPath(pathname) === "/ws";
}

function isWsTicketPath(pathname: string): boolean {
  return getApiPath(pathname) === "/ws/ticket";
}

function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function textResponse(text: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(text, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function isWsEventType(value: unknown): value is WsEventType {
  return typeof value === "string" && ALL_EVENT_TYPES.includes(value as WsEventType);
}

function isImportTarget(value: unknown): value is ImportTarget {
  return typeof value === "string" && IMPORT_TARGETS.includes(value as ImportTarget);
}

function latestScheduleFromState(state: MockState): ScheduleResponse | null {
  if (state.schedule.latestKey && state.schedule.weeks[state.schedule.latestKey]) {
    return state.schedule.weeks[state.schedule.latestKey];
  }

  const schedules = Object.values(state.schedule.weeks);
  if (schedules.length === 0) return null;

  const sorted = schedules.sort((a, b) => compareYearWeek(b, a));
  return sorted[0] ?? null;
}

function makeSubathonYears(state: MockState): Record<number, string> {
  const years: Record<number, string> = {};
  for (const year of Object.keys(state.subathon.byYear)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b)) {
    const entry = state.subathon.byYear[String(year)];
    if (entry) years[year] = entry.name;
  }
  return years;
}

function makeScheduleWeeksIndex(state: MockState): Record<number, number[]> {
  const grouped = new Map<number, Set<number>>();

  for (const schedule of Object.values(state.schedule.weeks)) {
    if (!grouped.has(schedule.year)) grouped.set(schedule.year, new Set<number>());
    grouped.get(schedule.year)!.add(schedule.week);
  }

  const result: Record<number, number[]> = {};
  const years = [...grouped.keys()].sort((a, b) => a - b);
  for (const year of years) {
    result[year] = [...grouped.get(year)!].sort((a, b) => a - b);
  }

  return result;
}

function makeBlogFeedResponse(feed: BlogFeedData, includeRaw: boolean): BlogFeedData {
  if (includeRaw) return feed;

  return {
    ...feed,
    entries: feed.entries.map(({ rawContent, ...entry }) => entry),
  };
}

async function serveUiAsset(pathname: string): Promise<Response> {
  if (pathname === "/ui" || pathname === "/ui/") {
    return new Response(Bun.file(join(UI_DIR, "index.html")), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  if (pathname === "/ui/style.css") {
    return new Response(Bun.file(join(UI_DIR, "style.css")), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/css; charset=utf-8",
      },
    });
  }

  if (pathname === "/ui/app.js") {
    return new Response(Bun.file(join(UI_DIR, "app.js")), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/javascript; charset=utf-8",
      },
    });
  }

  return textResponse("Not Found", 404);
}

async function startServer() {
  const stateStore = await StateStore.create(SOURCE_DIR);
  const wsHub = new WsHub();
  const tickets = new TicketStore(30_000);

  const server = Bun.serve<ConnectionData>({
    hostname: HOST,
    port: PORT,
    fetch: async (request, bunServer) => {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (isWsPath(url.pathname)) {
        const ticket = url.searchParams.get("ticket");
        let authKey: string | null = null;

        if (ticket) {
          const consumed = tickets.consume(ticket);
          if (!consumed) return textResponse("Invalid or expired ticket", 401);
          authKey = consumed.authKey;
        } else {
          const token = extractBearerToken(request);
          if (!token) return textResponse("Missing authentication (ticket or token required)", 401);
          authKey = token;
        }

        if (!isUnlimitedToken(authKey) && wsHub.getConnectionCountForAuth(authKey) >= 5) {
          return textResponse("Connection limit reached (max 5)", 429);
        }

        const upgraded = bunServer.upgrade(request, {
          headers: CORS_HEADERS,
          data: {
            sessionId: randomUUID(),
            authKey,
            openedAt: Date.now(),
            subscriptions: new Set<WsEventType>(),
          },
        });

        if (upgraded) return;
        return textResponse("Upgrade failed", 500);
      }

      if (url.pathname === "/") {
        return Response.redirect("/ui", 302);
      }

      if (url.pathname === "/ui" || url.pathname === "/ui/" || url.pathname === "/ui/style.css" || url.pathname === "/ui/app.js") {
        return serveUiAsset(url.pathname);
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse({ status: "ok", service: "nia-mock-test-server" });
      }

      if (isWsTicketPath(url.pathname) && request.method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const ticket = tickets.issue(auth.token!);
        return jsonResponse(
          {
            data: {
              ticket,
              expiresIn: tickets.ttlSeconds,
              usage: `Connect with ws://localhost:${PORT}/api/v2/ws?ticket=<ticket>`,
            },
          },
          200,
          {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        );
      }

      if (url.pathname === "/api/info" && request.method === "GET") {
        return jsonResponse({
          data: {
            latestVersion: "v2",
            versions: {
              v2: {
                status: "current",
                docsUrl: "https://neuro.appstun.net/api/docs",
              },
            },
          },
        });
      }

      if (url.pathname === "/api/test/geterror" && request.method === "GET") {
        const code = url.searchParams.get("code");
        if (!isApiErrorCode(code)) return jsonResponse({ error: "Not Found" }, 404);
        return jsonResponse(errorPayload(code), 418);
      }

      const apiPath = getApiPath(url.pathname);
      if (!apiPath) {
        return textResponse("Not Found", 404);
      }

      const path = apiPath;
      const method = request.method;

      if (path === "/twitch/stream" && method === "GET") {
        const state = stateStore.getSnapshot();
        return jsonResponse(state.twitch.stream, 200, { "Cache-Control": "public, max-age=30" });
      }

      if (path === "/twitch/vods" && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const state = stateStore.getSnapshot();
        if (state.twitch.vods.length === 0) return jsonResponse(errorPayload("VD2"), 404);
        return jsonResponse(state.twitch.vods, 200, { "Cache-Control": "public, max-age=900" });
      }

      if (path === "/twitch/vod" && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const streamId = String(url.searchParams.get("streamId") || url.searchParams.get("id") || "").trim();
        if (!streamId) return jsonResponse(errorPayload("VD1"), 400);

        const state = stateStore.getSnapshot();
        const vod = state.twitch.vods.find((entry) => entry.streamId === streamId);
        if (!vod) return jsonResponse(errorPayload("VD1"), 404);
        return jsonResponse(vod, 200, { "Cache-Control": "public, max-age=3600" });
      }

      if (path === "/schedule" && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const weekRaw = url.searchParams.get("week");
        const yearRaw = url.searchParams.get("year");
        const currentYear = getIsoWeekAndYear(new Date()).year;

        const week = Number.parseInt(String(weekRaw || ""), 10);
        const year = Number.parseInt(String(yearRaw || currentYear), 10);

        if (!Number.isInteger(week) || !Number.isInteger(year) || week < 1 || week > 53 || year < 2023 || year > currentYear) {
          return jsonResponse(errorPayload("SC2"), 400);
        }

        const state = stateStore.getSnapshot();
        const schedule = state.schedule.weeks[getScheduleKey(year, week)];
        if (!schedule) return jsonResponse(errorPayload("SC1"), 404);

        return jsonResponse(schedule, 200, { "Cache-Control": "public, max-age=1800" });
      }

      if (path === "/schedule/latest" && method === "GET") {
        const state = stateStore.getSnapshot();
        const latest = latestScheduleFromState(state);
        if (!latest) return jsonResponse(errorPayload("SC1"), 404);

        const hasActiveSubathon = Object.values(state.subathon.byYear).some((entry) => entry.isActive);
        return jsonResponse(
          {
            ...latest,
            hasActiveSubathon,
          },
          200,
          { "Cache-Control": "public, max-age=60" },
        );
      }

      if (path === "/schedule/weeks" && method === "GET") {
        const state = stateStore.getSnapshot();
        return jsonResponse(makeScheduleWeeksIndex(state), 200, { "Cache-Control": "public, max-age=300" });
      }

      if (path === "/schedule/search" && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const query = String(url.searchParams.get("query") || "").trim();
        if (!query) return jsonResponse(errorPayload("SC3"), 400);
        if (query.length < 3) return jsonResponse(errorPayload("SC4"), 400);

        const limitRaw = url.searchParams.get("limit");
        const yearRaw = url.searchParams.get("year");
        const sortRaw = String(url.searchParams.get("sort") || "desc");
        const typeRaw = url.searchParams.get("type");
        const cursorYearRaw = url.searchParams.get("cursorYear");
        const cursorWeekRaw = url.searchParams.get("cursorWeek");

        const limit = limitRaw == null ? 25 : Number.parseInt(limitRaw, 10);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) return jsonResponse(errorPayload("SC2"), 400);

        const yearFilter = yearRaw == null ? null : Number.parseInt(yearRaw, 10);
        if (yearFilter != null && (!Number.isInteger(yearFilter) || yearFilter < 2023)) return jsonResponse(errorPayload("SC2"), 400);

        const sort = sortRaw === "asc" ? "asc" : sortRaw === "desc" ? "desc" : null;
        if (!sort) return jsonResponse(errorPayload("SC2"), 400);

        const typeFilter = typeRaw == null ? null : typeRaw;
        if (typeFilter != null && !ALL_SCHEDULE_DAY_TYPES.includes(typeFilter as (typeof ALL_SCHEDULE_DAY_TYPES)[number])) {
          return jsonResponse(errorPayload("SC2"), 400);
        }

        const hasCursorYear = cursorYearRaw != null;
        const hasCursorWeek = cursorWeekRaw != null;
        if ((hasCursorYear && !hasCursorWeek) || (!hasCursorYear && hasCursorWeek)) {
          return jsonResponse(errorPayload("SC2"), 400);
        }

        const cursor = hasCursorYear
          ? {
              year: Number.parseInt(String(cursorYearRaw), 10),
              week: Number.parseInt(String(cursorWeekRaw), 10),
            }
          : null;

        if (
          cursor &&
          (!Number.isInteger(cursor.year) || !Number.isInteger(cursor.week) || cursor.year < 2023 || cursor.week < 1 || cursor.week > 53)
        ) {
          return jsonResponse(errorPayload("SC2"), 400);
        }

        const state = stateStore.getSnapshot();
        const weeks = Object.values(state.schedule.weeks)
          .filter((week) => (yearFilter == null ? true : week.year === yearFilter))
          .sort((a, b) => (sort === "asc" ? compareYearWeek(a, b) : compareYearWeek(b, a)));

        const cursorFiltered = cursor
          ? weeks.filter((entry) => {
              const cmp = compareYearWeek(entry, cursor);
              return sort === "asc" ? cmp > 0 : cmp < 0;
            })
          : weeks;

        const lowered = query.toLowerCase();
        const matches: ScheduleSearchResultItem[] = [];
        for (const week of cursorFiltered) {
          const matchedEntries = week.schedule.filter((entry) => {
            if (typeFilter != null && entry.type !== typeFilter) return false;
            return String(entry.message || "")
              .toLowerCase()
              .includes(lowered);
          });

          if (matchedEntries.length === 0) continue;

          const foundDays = [...new Set(matchedEntries.map((entry) => entry.day))].sort((a, b) => a - b);
          matches.push({
            foundDays,
            data: {
              year: week.year,
              week: week.week,
              schedule: matchedEntries,
              status: week.status,
            },
          });
        }

        const results = matches.slice(0, limit);
        const hasMore = matches.length > limit;
        const tail = results.length > 0 ? results[results.length - 1] : null;
        const nextCursor = hasMore && tail ? { year: tail.data.year, week: tail.data.week } : null;

        return jsonResponse(
          {
            nextCursor,
            results,
          },
          200,
          { "Cache-Control": "public, max-age=30" },
        );
      }

      if (path === "/devstream/times" && method === "GET") {
        const state = stateStore.getSnapshot();
        return jsonResponse(state.schedule.devstreamtimes, 200, { "Cache-Control": "public, max-age=300" });
      }

      if ((path === "/subathon/current" || (path === "/subathon" && !url.searchParams.has("year"))) && method === "GET") {
        const state = stateStore.getSnapshot();
        const active = Object.values(state.subathon.byYear)
          .filter((entry) => entry.isActive)
          .sort((a, b) => b.year - a.year);

        if (active.length === 0) return jsonResponse(errorPayload("SB1"), 404);
        return jsonResponse(active, 200, { "Cache-Control": "public, max-age=60" });
      }

      if (path === "/subathon/years" && method === "GET") {
        const state = stateStore.getSnapshot();
        return jsonResponse(makeSubathonYears(state), 200, { "Cache-Control": "public, max-age=300" });
      }

      if (path === "/subathon" && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const yearRaw = url.searchParams.get("year");
        if (yearRaw == null || yearRaw.trim().length === 0) return jsonResponse(errorPayload("SB2"), 400);

        const year = Number.parseInt(yearRaw, 10);
        if (!Number.isInteger(year) || year > new Date().getFullYear()) return jsonResponse(errorPayload("SB3"), 400);

        const state = stateStore.getSnapshot();
        const subathon = state.subathon.byYear[String(year)];
        if (!subathon) return jsonResponse(errorPayload("SB4"), 404);

        return jsonResponse(subathon, 200, { "Cache-Control": "private, max-age=300" });
      }

      if ((path === "/blog/feed" || path === "/blog") && method === "GET") {
        const auth = requireAuthHeader(request);
        if (!auth.ok) return auth.response!;

        const state = stateStore.getSnapshot();
        const includeRaw = url.searchParams.get("raw") === "true";
        return jsonResponse(makeBlogFeedResponse(state.blog.feed, includeRaw), 200, { "Cache-Control": "private, max-age=300" });
      }

      if (path === "/__test/state" && method === "GET") {
        return jsonResponse({
          state: stateStore.getSnapshot(),
          ws: {
            clients: wsHub.getConnectionCount(),
            eventSubscriptions: wsHub.getSubscriptionCounts(),
          },
          events: [...ALL_EVENT_TYPES],
        });
      }

      if (path === "/__test/state" && method === "PUT") {
        const body = await parseJsonBody<{ state?: MockState } | MockState>(request);
        if (!body || typeof body !== "object") {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        const nextState = "state" in body ? body.state : body;
        if (!nextState || typeof nextState !== "object") {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        stateStore.replaceState(nextState as MockState);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/reset" && method === "POST") {
        stateStore.resetToDefaults();
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/twitch/stream" && method === "PATCH") {
        const body = await parseJsonBody<TwitchStreamData>(request);
        if (!body || typeof body !== "object") return jsonResponse({ error: "Invalid payload" }, 400);

        stateStore.setStream(body);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/twitch/vods" && method === "PUT") {
        const body = await parseJsonBody<TwitchVod[]>(request);
        if (!Array.isArray(body)) return jsonResponse({ error: "Invalid payload" }, 400);

        stateStore.setVods(body);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/schedule" && method === "POST") {
        const body = await parseJsonBody<{
          year: number;
          week: number;
          schedule: ScheduleResponse["schedule"];
          status?: ScheduleStatus;
          setAsLatest?: boolean;
        }>(request);

        if (!body || !Number.isInteger(body.year) || !Number.isInteger(body.week) || !Array.isArray(body.schedule)) {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        const status = body.status && ALL_SCHEDULE_STATUSES.includes(body.status) ? body.status : "auto_twitch";

        const schedule: ScheduleResponse = {
          year: body.year,
          week: body.week,
          schedule: body.schedule,
          status,
        };

        stateStore.upsertSchedule(schedule, !!body.setAsLatest);
        wsHub.broadcast("scheduleUpdate", schedule);
        return jsonResponse({ ok: true, schedule });
      }

      if (path === "/__test/schedule" && method === "DELETE") {
        const year = Number.parseInt(String(url.searchParams.get("year") || ""), 10);
        const week = Number.parseInt(String(url.searchParams.get("week") || ""), 10);

        if (!Number.isInteger(year) || !Number.isInteger(week)) {
          return jsonResponse({ error: "year and week are required" }, 400);
        }

        const deleted = stateStore.deleteSchedule(year, week);
        return jsonResponse({ ok: deleted });
      }

      if (path === "/__test/schedule/devstreamtimes" && method === "PUT") {
        const body = await parseJsonBody<number[]>(request);
        if (!Array.isArray(body) || body.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        stateStore.setDevstreamTimes(body);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/subathon" && method === "PATCH") {
        const body = await parseJsonBody<SubathonData>(request);
        if (!body || !Number.isInteger(body.year) || typeof body.name !== "string") {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        stateStore.upsertSubathon(body);
        wsHub.broadcast("subathonUpdate", body);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/subathon" && method === "DELETE") {
        const year = Number.parseInt(String(url.searchParams.get("year") || ""), 10);
        if (!Number.isInteger(year)) return jsonResponse({ error: "year is required" }, 400);

        const deleted = stateStore.deleteSubathon(year);
        return jsonResponse({ ok: deleted });
      }

      if (path === "/__test/blog/feed" && method === "PUT") {
        const body = await parseJsonBody<BlogFeedData>(request);
        const feed = asBlogFeedData(body);
        if (!feed) return jsonResponse({ error: "Invalid payload" }, 400);

        stateStore.setBlogFeed(feed);
        wsHub.broadcast("blogFeedUpdate", feed);
        return jsonResponse({ ok: true });
      }

      if (path === "/__test/emit" && method === "POST") {
        const body = await parseJsonBody<{ eventType: WsEventType; eventData: unknown; timestamp?: number }>(request);
        if (!body || !isWsEventType(body.eventType)) return jsonResponse({ error: "Invalid eventType" }, 400);

        const timestamp = Number.isFinite(body.timestamp) ? Number(body.timestamp) : Date.now();
        wsHub.broadcast(body.eventType, body.eventData as never, timestamp);
        return jsonResponse({ ok: true, eventType: body.eventType, timestamp });
      }

      if (path === "/__test/import" && method === "POST") {
        const body = await parseJsonBody<{ target: ImportTarget; token: string; year?: number; week?: number; raw?: boolean }>(request);
        if (!body || !isImportTarget(body.target) || typeof body.token !== "string") {
          return jsonResponse({ error: "Invalid payload" }, 400);
        }

        const result = await importFromUpstream({
          target: body.target,
          token: body.token,
          year: body.year,
          week: body.week,
          raw: body.raw,
        });

        if (!result.ok) {
          return jsonResponse(
            {
              error: "Import failed",
              message: result.message,
              upstreamStatus: result.status,
              details: result.details,
            },
            result.status,
          );
        }

        switch (body.target) {
          case "stream": {
            const stream = asTwitchStreamData(result.data);
            if (!stream) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.setStream(stream);
            break;
          }
          case "vods": {
            const vods = asTwitchVods(result.data);
            if (!vods) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.setVods(vods);
            break;
          }
          case "scheduleLatest": {
            const schedule = asScheduleResponse(result.data);
            if (!schedule) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.upsertSchedule(schedule, true);
            break;
          }
          case "scheduleWeek": {
            const schedule = asScheduleResponse(result.data);
            if (!schedule) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.upsertSchedule(schedule, false);
            break;
          }
          case "subathonCurrent": {
            const current = asSubathonArray(result.data);
            if (!current) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            for (const subathon of current) stateStore.upsertSubathon(subathon);
            break;
          }
          case "subathonYear": {
            const subathon = asSubathonData(result.data);
            if (!subathon) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.upsertSubathon(subathon);
            break;
          }
          case "devstreamtimes": {
            const times = asNumberArray(result.data);
            if (!times) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.setDevstreamTimes(times);
            break;
          }
          case "blogFeed": {
            const feed = asBlogFeedData(result.data);
            if (!feed) return jsonResponse({ error: "Unexpected upstream payload" }, 502);
            stateStore.setBlogFeed(feed);
            wsHub.broadcast("blogFeedUpdate", feed);
            break;
          }
        }

        return jsonResponse({ ok: true, target: body.target });
      }

      return textResponse("Not Found", 404);
    },
    websocket: {
      open: (ws) => {
        wsHub.onOpen(ws);
      },
      close: (ws) => {
        wsHub.onClose(ws);
      },
      message: (ws, message) => {
        wsHub.onMessage(ws, message);
      },
      sendPings: true,
      idleTimeout: 60,
    },
  });

  let isShuttingDown = false;
  const shutdown = async (reason: string, error?: unknown) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (error) {
      console.error(`[nia-mock] shutdown due to ${reason}`, error);
    } else {
      console.log(`[nia-mock] shutdown: ${reason}`);
    }

    try {
      await stateStore.flush();
    } catch (flushError) {
      console.error("[nia-mock] flush failed", flushError);
    }

    try {
      server.stop(true);
    } catch {}

    process.exit(0);
  };

  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on("SIGINT", () => process.emit("SIGINT"));
  rl.on("SIGTERM", () => process.emit("SIGTERM"));

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (error) => void shutdown("uncaughtException", error));
  process.on("unhandledRejection", (error) => void shutdown("unhandledRejection", error));

  console.log("[nia-mock] server running");
  console.log(`[nia-mock] UI: http://localhost:${PORT}/ui`);
  console.log(`[nia-mock] REST: http://localhost:${PORT}/api/v2`);
  console.log(`[nia-mock] WS: ws://localhost:${PORT}/api/v2/ws`);
  console.log(`[nia-mock] Ticket: http://localhost:${PORT}/api/v2/ws/ticket`);
}

void startServer();
