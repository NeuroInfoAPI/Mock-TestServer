import type {
  BlogFeedData,
  BlogFeedEntry,
  BlogEntryBodySection,
  ScheduleEntry,
  ScheduleLatestResponse,
  ScheduleResponse,
  ScheduleSearchCursor,
  ScheduleSearchResultItem,
  ScheduleSearchResponse,
  ScheduleStatus,
  ScheduleWeeksResponse,
  SubathonData,
  SubathonGoal,
  SubathonYearsResponse,
  TwitchStreamData,
  TwitchVod,
  WsEventDataMap,
  WsEventType,
  WsInvalidReason,
} from "neuroinfoapi-client";

export type {
  BlogFeedData,
  BlogFeedEntry,
  BlogEntryBodySection,
  ScheduleEntry,
  ScheduleLatestResponse,
  ScheduleResponse,
  ScheduleSearchCursor,
  ScheduleSearchResultItem,
  ScheduleSearchResponse,
  ScheduleStatus,
  ScheduleWeeksResponse,
  SubathonData,
  SubathonGoal,
  SubathonYearsResponse,
  TwitchStreamData,
  TwitchVod,
  WsEventDataMap,
  WsEventType,
  WsInvalidReason,
};

export type ScheduleDayType = ScheduleEntry["type"];

export const ALL_SCHEDULE_STATUSES = ["auto_twitch", "auto_discord", "confirmed"] as const satisfies readonly ScheduleStatus[];

export const ALL_SCHEDULE_DAY_TYPES = ["normal", "offline", "canceled", "TBD", "unknown"] as const satisfies readonly ScheduleDayType[];

export const ALL_EVENT_TYPES: readonly WsEventType[] = [
  "blogFeedUpdate",
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

export interface MockState {
  version: 1;
  updatedAt: number;
  twitch: {
    stream: TwitchStreamData;
    vods: TwitchVod[];
  };
  schedule: {
    weeks: Record<string, ScheduleResponse>;
    latestKey: string | null;
    devstreamtimes: number[];
  };
  subathon: {
    byYear: Record<string, SubathonData>;
  };
  blog: {
    feed: BlogFeedData;
  };
}

export type ApiErrorCode =
  | "AP1"
  | "AP3"
  | "SC1"
  | "SC2"
  | "SC3"
  | "SC4"
  | "VD1"
  | "VD2"
  | "SB1"
  | "SB2"
  | "SB3"
  | "SB4"
  | "AU1"
  | "AU2"
  | "RL2"
  | "RL3"
  | "RL4"
  | "RL5"
  | "RL6"
  | "RL7"
  | "RL8";

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    timestamp: number;
    path: string;
  };
}

export interface ConnectionData {
  sessionId: string;
  authKey: string;
  openedAt: number;
  subscriptions: Set<WsEventType>;
}

export type ImportTarget =
  | "stream"
  | "vods"
  | "scheduleLatest"
  | "scheduleWeek"
  | "subathonCurrent"
  | "subathonYear"
  | "devstreamtimes"
  | "blogFeed";
