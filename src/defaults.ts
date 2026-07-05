import { BlogFeedData, MockState, ScheduleResponse, SubathonData, TwitchStreamData, TwitchVod } from "./contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getScheduleKey(year: number, week: number): string {
  return `${year}-${week}`;
}

export function splitScheduleKey(key: string): { year: number; week: number } | null {
  const [yearRaw, weekRaw] = key.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const week = Number.parseInt(weekRaw ?? "", 10);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  return { year, week };
}

export function compareYearWeek(a: { year: number; week: number }, b: { year: number; week: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.week - b.week;
}

export function getIsoWeekAndYear(date: Date): { week: number; year: number } {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { week, year: utcDate.getUTCFullYear() };
}

export function startOfIsoWeek(input: Date): Date {
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildScheduleFromWeekStart(weekStart: Date, year: number, week: number, seed: number): ScheduleResponse {
  const entries = [
    {
      day: 2,
      hour: 19,
      minute: 0,
      message: seed % 2 === 0 ? "Neuro Stream" : "Neuro Karaoke",
      type: "normal" as const,
    },
    {
      day: 4,
      hour: 19,
      minute: 30,
      message: seed % 3 === 0 ? "Evil Stream" : "Collab Stream",
      type: seed % 3 === 0 ? ("normal" as const) : ("TBD" as const),
    },
    {
      day: 6,
      hour: 18,
      minute: 0,
      message: "Offline",
      type: "offline" as const,
    },
  ];

  return {
    year,
    week,
    status: seed % 2 === 0 ? "confirmed" : "auto_twitch",
    schedule: entries.map((entry) => ({
      day: entry.day,
      time: weekStart.getTime() + entry.day * DAY_MS + entry.hour * 60 * 60 * 1000 + entry.minute * 60 * 1000,
      message: entry.message,
      type: entry.type,
    })),
  };
}

function createDefaultStream(now: number): TwitchStreamData {
  return {
    isLive: true,
    id: "331913732989",
    title: "Local Mock Stream: Testing NeuroInfo Client",
    game: {
      id: "509658",
      name: "Just Chatting",
    },
    language: "en",
    tags: ["Mock", "Testing", "NeuroInfoAPI"],
    isMature: false,
    viewerCount: 4242,
    startedAt: now - 45 * 60 * 1000,
    thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_vedal987-{width}x{height}.jpg",
  };
}

function createDefaultVods(now: number): TwitchVod[] {
  return [
    {
      id: "2525705075",
      streamId: "323888365817",
      title: "My First Livestream - Neuro-sama",
      url: "https://www.twitch.tv/videos/2525705075",
      viewable: "public",
      type: "archive",
      language: "en",
      duration: "2h21m20s",
      viewCount: 80346,
      createdAt: now - 7 * DAY_MS,
      publishedAt: now - 7 * DAY_MS,
      thumbnailUrl:
        "https://static-cdn.jtvnw.net/cf_vods/d3fi1amfgojobc/392eb4c5d5a13379e26f_vedal987_323888365817_1753812000//thumb/thumb0-%{width}x%{height}.jpg",
    },
    {
      id: "2534657392",
      streamId: "324276445817",
      title: "OUTER WILDS w/ VEDAL AND NEURO",
      url: "https://www.twitch.tv/videos/2534657392",
      viewable: "public",
      type: "archive",
      language: "en",
      duration: "4h27m10s",
      viewCount: 112395,
      createdAt: now - 3 * DAY_MS,
      publishedAt: now - 3 * DAY_MS,
      thumbnailUrl:
        "https://static-cdn.jtvnw.net/cf_vods/d3fi1amfgojobc/5f171bfa046b419abede_vedal987_324276445817_1754675999//thumb/thumb0-%{width}x%{height}.jpg",
    },
  ];
}

function createDefaultSubathons(now: number, year: number): Record<string, SubathonData> {
  const current: SubathonData = {
    year,
    name: `Neuro-sama Subathon ${Math.max(1, year - 2022)}`,
    subcount: 132450,
    goals: {
      1000: { name: "Goal A", completed: true, reached: true },
      100000: { name: "Goal B", completed: false, reached: true },
      150000: { name: "Goal C", completed: false, reached: false },
    },
    isActive: true,
    startTimestamp: now - 5 * DAY_MS,
  };

  const previous: SubathonData = {
    year: year - 1,
    name: `Neuro-sama Subathon ${Math.max(1, year - 2023)}`,
    subcount: 82400,
    goals: {
      1000: { name: "Kickoff", completed: true, reached: true },
      20000: { name: "Song Cover", completed: true, reached: true },
      90000: { name: "Bonus Goal", completed: false, reached: false },
    },
    isActive: false,
    startTimestamp: now - 140 * DAY_MS,
    endTimestamp: now - 132 * DAY_MS,
  };

  return {
    [String(current.year)]: current,
    [String(previous.year)]: previous,
  };
}

function createDefaultBlogFeed(now: number): BlogFeedData {
  return {
    url: "https://neurosama.com/blog/feed",
    lastUpdated: now,
    title: "Neuro-sama Blog",
    subtitle: "Local mock blog feed",
    entries: [
      {
        title: "Mock blog entry",
        author: "NIA Mock",
        url: "https://neuro.appstun.net/blog/mock-entry",
        published: now - DAY_MS,
        updated: now - DAY_MS,
        summary: "Example blog entry returned by the local mock server.",
        content: [
          {
            header: "Overview",
            body: "This placeholder keeps the mock shape aligned with neuroinfoapi-client.",
          },
        ],
      },
    ],
  };
}

export function createDefaultMockState(): MockState {
  const now = Date.now();
  const today = new Date(now);
  const currentIso = getIsoWeekAndYear(today);
  const monday = startOfIsoWeek(today);

  const previousWeekStart = new Date(monday.getTime() - 7 * DAY_MS);
  const nextWeekStart = new Date(monday.getTime() + 7 * DAY_MS);

  const previousIso = getIsoWeekAndYear(previousWeekStart);
  const nextIso = getIsoWeekAndYear(nextWeekStart);

  const previousSchedule = buildScheduleFromWeekStart(previousWeekStart, previousIso.year, previousIso.week, 1);
  const currentSchedule = buildScheduleFromWeekStart(monday, currentIso.year, currentIso.week, 2);
  const nextSchedule = buildScheduleFromWeekStart(nextWeekStart, nextIso.year, nextIso.week, 3);

  const previousKey = getScheduleKey(previousSchedule.year, previousSchedule.week);
  const currentKey = getScheduleKey(currentSchedule.year, currentSchedule.week);
  const nextKey = getScheduleKey(nextSchedule.year, nextSchedule.week);

  return {
    version: 1,
    updatedAt: now,
    twitch: {
      stream: createDefaultStream(now),
      vods: createDefaultVods(now),
    },
    schedule: {
      weeks: {
        [previousKey]: previousSchedule,
        [currentKey]: currentSchedule,
        [nextKey]: nextSchedule,
      },
      latestKey: nextKey,
      devstreamtimes: [
        monday.getTime() - 14 * DAY_MS + 18 * 60 * 60 * 1000,
        monday.getTime() - 7 * DAY_MS + 18 * 60 * 60 * 1000,
        monday.getTime() + 18 * 60 * 60 * 1000,
      ],
    },
    subathon: {
      byYear: createDefaultSubathons(now, currentIso.year),
    },
    blog: {
      feed: createDefaultBlogFeed(now),
    },
  };
}
