import { NeuroInfoApiClient } from "neuroinfoapi-client";
import { BlogFeedData, ImportTarget, ScheduleResponse, SubathonData, TwitchStreamData, TwitchVod } from "./contracts";

const API_BASE_URL = "https://neuro.appstun.net/api/v2";

export type ImportRequest = {
  target: ImportTarget;
  token: string;
  year?: number;
  week?: number;
  raw?: boolean;
};

export type ImportResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      status: number;
      details: unknown;
      message: string;
    };

type ClientCallResult<T> = { data: T | null; error: unknown | null };

function createClient(token: string | null): NeuroInfoApiClient {
  const trimmedToken = token?.trim() || undefined;
  return new NeuroInfoApiClient(trimmedToken, { baseUrl: API_BASE_URL });
}

function toImportError(error: unknown): Exclude<ImportResult, { ok: true }> {
  if (error && typeof error === "object") {
    const maybeStatus = (error as { status?: unknown }).status;
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeStatus === "number" && typeof maybeMessage === "string") {
      return {
        ok: false,
        status: maybeStatus,
        details: error,
        message: maybeMessage,
      };
    }
  }

  return {
    ok: false,
    status: 502,
    details: String(error),
    message: "Failed to reach upstream API",
  };
}

function toImportResult<T>(result: ClientCallResult<T>): ImportResult {
  if (result.error) return toImportError(result.error);
  return { ok: true, data: result.data };
}

async function callWithClient<T>(
  token: string | null,
  call: (client: NeuroInfoApiClient) => Promise<ClientCallResult<T>>,
): Promise<ImportResult> {
  try {
    const client = createClient(token);
    const result = await call(client);
    return toImportResult(result);
  } catch (error) {
    return toImportError(error);
  }
}

export async function importFromUpstream(input: ImportRequest): Promise<ImportResult> {
  switch (input.target) {
    case "stream":
      return callWithClient(null, (client) => client.getCurrentStream());

    case "vods":
      return callWithClient(input.token, (client) => client.getAllVods());

    case "scheduleLatest":
      return callWithClient(null, (client) => client.getLatestSchedule());

    case "scheduleWeek": {
      if (!Number.isInteger(input.week) || input.week! < 1 || input.week! > 53) {
        return {
          ok: false,
          status: 400,
          details: null,
          message: "week must be between 1 and 53",
        };
      }
      return callWithClient(input.token, (client) => client.getSchedule(input.week!, input.year));
    }

    case "subathonCurrent":
      return callWithClient(null, (client) => client.getCurrentSubathons());

    case "subathonYear": {
      if (!Number.isInteger(input.year)) {
        return {
          ok: false,
          status: 400,
          details: null,
          message: "year is required",
        };
      }
      return callWithClient(input.token, (client) => client.getSubathon(input.year!));
    }

    case "devstreamtimes":
      return callWithClient(null, (client) => client.getDevstreamTimes());

    case "blogFeed":
      return callWithClient(input.token, (client) => client.getBlogFeed(!!input.raw));

    default:
      return {
        ok: false,
        status: 400,
        details: null,
        message: `Unsupported import target: ${String(input.target)}`,
      };
  }
}

export function asTwitchStreamData(value: unknown): TwitchStreamData | null {
  if (!value || typeof value !== "object") return null;
  return value as TwitchStreamData;
}

export function asTwitchVods(value: unknown): TwitchVod[] | null {
  if (!Array.isArray(value)) return null;
  return value as TwitchVod[];
}

export function asScheduleResponse(value: unknown): ScheduleResponse | null {
  if (!value || typeof value !== "object") return null;
  return value as ScheduleResponse;
}

export function asSubathonArray(value: unknown): SubathonData[] | null {
  if (!Array.isArray(value)) return null;
  return value as SubathonData[];
}

export function asSubathonData(value: unknown): SubathonData | null {
  if (!value || typeof value !== "object") return null;
  return value as SubathonData;
}

export function asNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === "number")) return null;
  return value as number[];
}

export function asBlogFeedData(value: unknown): BlogFeedData | null {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray((value as { entries?: unknown }).entries)) return null;
  return value as BlogFeedData;
}
