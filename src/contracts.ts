export type ScheduleDayType = "normal" | "offline" | "canceled" | "TBD" | "unknown";

export interface ScheduleEntry {
  day: number;
  time: number;
  message: string;
  type: ScheduleDayType;
}

export interface ScheduleResponse {
  year: number;
  week: number;
  schedule: ScheduleEntry[];
  isFinal: boolean;
}

export interface ScheduleLatestResponse extends ScheduleResponse {
  hasActiveSubathon: boolean;
}

export interface ScheduleSearchCursor {
  year: number;
  week: number;
}

export interface ScheduleSearchResultItem {
  foundDays: number[];
  data: ScheduleResponse;
}

export interface ScheduleSearchResponse {
  nextCursor: ScheduleSearchCursor | null;
  results: ScheduleSearchResultItem[];
}

export interface TwitchStreamData {
  isLive: boolean;
  id?: string;
  title?: string;
  game?: {
    id: string;
    name: string;
  };
  language?: string;
  tags?: string[];
  isMature?: boolean;
  viewerCount?: number;
  startedAt?: number;
  thumbnailUrl?: string;
}

export interface TwitchVod {
  id: string;
  streamId: string;
  title: string;
  url: string;
  viewable: string;
  type: string;
  language: string;
  duration: string;
  viewCount: number;
  createdAt: number;
  publishedAt: number;
  thumbnailUrl: string;
}

export interface SubathonGoal {
  name: string;
  completed: boolean;
  reached: boolean;
}

export interface SubathonData {
  year: number;
  name: string;
  subcount: number;
  goals: { [goalNumber: number]: SubathonGoal };
  isActive: boolean;
  startTimestamp?: number;
  endTimestamp?: number;
}

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
}

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

export type WsInvalidReason =
  | "malformed"
  | "unauthenticated"
  | "missingEventtype"
  | "invalidEventtype"
  | "missingToken"
  | "invalidToken"
  | "authError";

export interface WsEventDataMap {
  streamOnline: {
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
  };
  streamOffline: {
    isLive: false;
  };
  streamUpdate: {
    title: string;
    game: { id: string; name: string };
    language: string;
    isMature: boolean;
  };
  secretneuroaccountOnline: {
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
  };
  streamRaidIncoming: {
    channel: { displayName: string; name: string; id: string };
    viewerCount: number;
  };
  streamRaidOutgoing: {
    channel: { displayName: string; name: string; id: string };
    viewerCount: number;
  };
  scheduleUpdate: {
    year: number;
    week: number;
    schedule: ScheduleEntry[];
    isFinal: boolean;
  };
  subathonUpdate: {
    year: number;
    name: string;
    subcount: number;
    goals: { [goal: number]: SubathonGoal };
    isActive: boolean;
    startTimestamp?: number;
    endTimestamp?: number;
  };
  subathonGoalUpdate: {
    year: number;
    goalNumber: number;
    goal: SubathonGoal;
    subcount: number;
  };
}

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

export const ALL_SCHEDULE_DAY_TYPES: readonly ScheduleDayType[] = ["normal", "offline", "canceled", "TBD", "unknown"] as const;

export type ApiErrorCode = "AP1" | "AP3" | "SC1" | "SC2" | "SC3" | "SC4" | "VD1" | "VD2" | "SB1" | "SB2" | "SB3" | "SB4" | "AU1";

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ConnectionData {
  sessionId: string;
  authKey: string;
  openedAt: number;
  subscriptions: Set<WsEventType>;
}

export type ImportTarget = "stream" | "vods" | "scheduleLatest" | "scheduleWeek" | "subathonCurrent" | "subathonYear" | "devstreamtimes";
