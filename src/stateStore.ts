import { dirname, join } from "node:path";
import { mkdir, rename } from "node:fs/promises";
import { BlogFeedData, MockState, ScheduleResponse, SubathonData, TwitchStreamData, TwitchVod } from "./contracts";
import { compareYearWeek, createDefaultMockState, deepClone, getScheduleKey, splitScheduleKey } from "./defaults";

export class StateStore {
  private readonly filePath: string;
  private state: MockState;
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(filePath: string, initialState: MockState) {
    this.filePath = filePath;
    this.state = initialState;
  }

  static async create(baseDir: string): Promise<StateStore> {
    const filePath = join(baseDir, "mock-state.json");
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      const defaults = createDefaultMockState();
      const store = new StateStore(filePath, defaults);
      await store.saveNow();
      return store;
    }

    try {
      const parsed = (await file.json()) as MockState;
      if (!parsed || parsed.version !== 1) throw new Error("Unsupported state version");
      const sanitized = sanitizeState(parsed);
      const store = new StateStore(filePath, sanitized);
      if (stateNeedsPersistenceMigration(parsed, sanitized)) {
        await store.saveNow();
      }
      return store;
    } catch {
      const defaults = createDefaultMockState();
      const store = new StateStore(filePath, defaults);
      await store.saveNow();
      return store;
    }
  }

  getSnapshot(): MockState {
    return deepClone(this.state);
  }

  replaceState(nextState: MockState): void {
    this.state = sanitizeState(nextState);
    this.state.updatedAt = Date.now();
    this.saveQueued();
  }

  resetToDefaults(): void {
    this.state = createDefaultMockState();
    this.state.updatedAt = Date.now();
    this.saveQueued();
  }

  setStream(stream: TwitchStreamData): void {
    this.state.twitch.stream = deepClone(stream);
    this.bumpAndSave();
  }

  setVods(vods: TwitchVod[]): void {
    this.state.twitch.vods = deepClone(vods);
    this.bumpAndSave();
  }

  upsertSchedule(schedule: ScheduleResponse, setAsLatest: boolean): void {
    const key = getScheduleKey(schedule.year, schedule.week);
    this.state.schedule.weeks[key] = deepClone(schedule);
    if (setAsLatest || !this.state.schedule.latestKey) {
      this.state.schedule.latestKey = key;
    }
    this.ensureLatestKey();
    this.bumpAndSave();
  }

  setLatestSchedule(year: number, week: number): boolean {
    const key = getScheduleKey(year, week);
    if (!this.state.schedule.weeks[key]) return false;
    this.state.schedule.latestKey = key;
    this.bumpAndSave();
    return true;
  }

  deleteSchedule(year: number, week: number): boolean {
    const key = getScheduleKey(year, week);
    if (!this.state.schedule.weeks[key]) return false;
    delete this.state.schedule.weeks[key];
    if (this.state.schedule.latestKey === key) {
      this.state.schedule.latestKey = null;
      this.ensureLatestKey();
    }
    this.bumpAndSave();
    return true;
  }

  setDevstreamTimes(times: number[]): void {
    this.state.schedule.devstreamtimes = [...times].sort((a, b) => a - b);
    this.bumpAndSave();
  }

  upsertSubathon(subathon: SubathonData): void {
    this.state.subathon.byYear[String(subathon.year)] = deepClone(subathon);
    this.bumpAndSave();
  }

  deleteSubathon(year: number): boolean {
    const key = String(year);
    if (!this.state.subathon.byYear[key]) return false;
    delete this.state.subathon.byYear[key];
    this.bumpAndSave();
    return true;
  }

  setBlogFeed(feed: BlogFeedData): void {
    this.state.blog.feed = deepClone(feed);
    this.bumpAndSave();
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private bumpAndSave(): void {
    this.state.updatedAt = Date.now();
    this.saveQueued();
  }

  private ensureLatestKey(): void {
    const keys = Object.keys(this.state.schedule.weeks);
    if (keys.length === 0) {
      this.state.schedule.latestKey = null;
      return;
    }

    if (this.state.schedule.latestKey && this.state.schedule.weeks[this.state.schedule.latestKey]) return;

    const latest = keys
      .map((key) => ({ key, value: splitScheduleKey(key) }))
      .filter((item): item is { key: string; value: { year: number; week: number } } => item.value != null)
      .sort((a, b) => compareYearWeek(b.value, a.value))[0];

    this.state.schedule.latestKey = latest?.key ?? null;
  }

  private saveQueued(): void {
    this.writeQueue = this.writeQueue.then(() => this.saveNow()).catch(() => this.saveNow());
  }

  private async saveNow(): Promise<void> {
    const targetDir = dirname(this.filePath);
    const tempPath = this.filePath + ".tmp";
    try {
      await mkdir(targetDir, { recursive: true });
    } catch (error: unknown) {
      if (!hasErrorCode(error, "EEXIST")) throw error;
    }

    const serialized = JSON.stringify(this.state, null, 2);
    await Bun.write(tempPath, serialized);
    await rename(tempPath, this.filePath);
  }
}

function stateNeedsPersistenceMigration(before: MockState, after: MockState): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function sanitizeState(state: MockState): MockState {
  const next = deepClone(state);
  if (next.version !== 1) next.version = 1;
  if (!next.updatedAt) next.updatedAt = Date.now();

  if (!next.twitch) {
    next.twitch = createDefaultMockState().twitch;
  }
  if (!next.schedule) {
    next.schedule = createDefaultMockState().schedule;
  }
  if (!next.subathon) {
    next.subathon = createDefaultMockState().subathon;
  }
  if (!next.blog) {
    next.blog = createDefaultMockState().blog;
  }

  next.twitch.stream = next.twitch.stream ?? { isLive: false };
  next.twitch.vods = Array.isArray(next.twitch.vods) ? next.twitch.vods : [];

  next.schedule.weeks = next.schedule.weeks ?? {};
  next.schedule.latestKey = next.schedule.latestKey ?? null;
  next.schedule.devstreamtimes = Array.isArray(next.schedule.devstreamtimes) ? next.schedule.devstreamtimes : [];

  next.subathon.byYear = next.subathon.byYear ?? {};
  next.blog.feed = normalizeBlogFeed(next.blog.feed) ?? createDefaultMockState().blog.feed;
  next.schedule.weeks = migrateScheduleWeeks(next.schedule.weeks);

  return next;
}

function normalizeBlogFeed(feed: unknown): BlogFeedData | null {
  if (!feed || typeof feed !== "object") return null;

  const maybeWrapped = feed as { data?: BlogFeedData };
  if (maybeWrapped.data && Array.isArray(maybeWrapped.data.entries)) {
    return maybeWrapped.data;
  }

  if (Array.isArray((feed as BlogFeedData).entries)) {
    return feed as BlogFeedData;
  }

  return null;
}

function migrateScheduleWeeks(weeks: Record<string, ScheduleResponse>): Record<string, ScheduleResponse> {
  const migrated: Record<string, ScheduleResponse> = {};

  for (const [key, schedule] of Object.entries(weeks)) {
    const legacy = schedule as ScheduleResponse & { isFinal?: boolean };
    const status = legacy.status ?? (legacy.isFinal ? "confirmed" : "auto_twitch");

    migrated[key] = {
      year: schedule.year,
      week: schedule.week,
      schedule: schedule.schedule,
      status,
    };
  }

  return migrated;
}
