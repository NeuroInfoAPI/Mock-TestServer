/* ═══════════════════════════════════════════════════════════
   NIA Mock Console — App Logic
   ═══════════════════════════════════════════════════════════ */

const state = { snapshot: null };
let logCount = 0;

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  tabs: $("tabs"),
  panels: $$(".panel"),
  health: $("health"),
  healthPill: $("healthPill"),
  wsClients: $("wsClients"),
  log: $("log"),
  niaToken: $("niaToken"),
  snapshot: $("snapshot"),
  consoleBadge: $("consoleBadge"),
  consoleDrawer: $("consoleDrawer"),
  consoleToggle: $("consoleToggle"),

  streamEditor: $("streamEditor"),
  vodsEditor: $("vodsEditor"),

  scheduleYear: $("scheduleYear"),
  scheduleWeek: $("scheduleWeek"),
  scheduleFinal: $("scheduleFinal"),
  scheduleLatest: $("scheduleLatest"),
  scheduleEditor: $("scheduleEditor"),
  devstreamEditor: $("devstreamEditor"),

  subathonYear: $("subathonYear"),
  subathonEditor: $("subathonEditor"),
  subathonPreview: $("subathonPreview"),

  eventType: $("eventType"),
  eventTimestamp: $("eventTimestamp"),
  eventEditor: $("eventEditor"),

  stateEditor: $("stateEditor"),

  importWeekYear: $("importWeekYear"),
  importWeekWeek: $("importWeekWeek"),
  importSubathonYear: $("importSubathonYear"),
};

/* ─── Toast notifications ─── */
function toast(message, kind = "ok") {
  const container = $("toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  container.append(el);
  setTimeout(() => el.remove(), 3000);
}

/* ─── Console log ─── */
function log(message, kind = "ok") {
  logCount++;
  els.consoleBadge.textContent = String(logCount);

  const line = document.createElement("div");
  line.className = `log-line ${kind}`;
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  line.textContent = `${ts}  ${message}`;
  els.log.prepend(line);

  if (kind === "err") toast(message, "err");
  else if (kind === "warn") toast(message, "warn");
  else toast(message, "ok");
}

/* ─── Fetch helper ─── */
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body = null;
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const details = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    throw new Error(`${response.status}: ${details}`);
  }

  return body;
}

function getToken() {
  return (els.niaToken.value || "").trim();
}

function parseJsonEditor(element, name) {
  try {
    return JSON.parse(element.value);
  } catch (error) {
    throw new Error(`${name} JSON invalid: ${error.message}`);
  }
}

/* ─── Async action wrapper with loading state ─── */
async function withLoading(buttonOrId, fn) {
  const btn = typeof buttonOrId === "string" ? $(buttonOrId) : buttonOrId;
  if (!btn) return fn();

  const original = btn.textContent;
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "…";

  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = original;
  }
}

/* ─── State helpers ─── */
function getScheduleByInput() {
  const year = Number(els.scheduleYear.value);
  const week = Number(els.scheduleWeek.value);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  const key = `${year}-${week}`;
  return state.snapshot?.state?.schedule?.weeks?.[key] ?? null;
}

function fillFromSnapshot() {
  if (!state.snapshot) return;

  const snap = state.snapshot.state;

  // Health
  els.health.textContent = state.snapshot.health;
  els.healthPill.classList.toggle("pill--down", state.snapshot.health !== "ok");

  // WS
  els.wsClients.textContent = String(state.snapshot.ws.clients);

  // Snapshot preview
  els.snapshot.textContent = JSON.stringify(
    {
      health: state.snapshot.health,
      ws: state.snapshot.ws,
      latestScheduleKey: snap.schedule.latestKey,
      scheduleKeys: Object.keys(snap.schedule.weeks),
      subathonYears: Object.keys(snap.subathon.byYear),
    },
    null,
    2,
  );

  // Twitch editors
  els.streamEditor.value = JSON.stringify(snap.twitch.stream, null, 2);
  els.vodsEditor.value = JSON.stringify(snap.twitch.vods, null, 2);

  // Devstream
  els.devstreamEditor.value = JSON.stringify(snap.schedule.devstreamtimes, null, 2);

  // Schedule
  if (!els.scheduleYear.value || !els.scheduleWeek.value) {
    const latestKey = snap.schedule.latestKey;
    if (latestKey) {
      const [year, week] = latestKey.split("-");
      els.scheduleYear.value = year;
      els.scheduleWeek.value = week;
    }
  }

  const pickedWeek = getScheduleByInput();
  if (pickedWeek) {
    els.scheduleEditor.value = JSON.stringify(pickedWeek.schedule, null, 2);
    els.scheduleFinal.checked = !!pickedWeek.isFinal;
  }

  // Subathon
  const yearKeys = Object.keys(snap.subathon.byYear).sort((a, b) => Number(b) - Number(a));
  const firstYear = yearKeys[0];
  if (!els.subathonYear.value && firstYear) els.subathonYear.value = firstYear;

  const selectedSubathon = snap.subathon.byYear[String(els.subathonYear.value)] || (firstYear ? snap.subathon.byYear[firstYear] : null);
  if (selectedSubathon) els.subathonEditor.value = JSON.stringify(selectedSubathon, null, 2);

  const current = Object.values(snap.subathon.byYear)
    .filter((e) => e.isActive)
    .sort((a, b) => b.year - a.year);
  els.subathonPreview.textContent = JSON.stringify(current, null, 2);

  // Raw state
  els.stateEditor.value = JSON.stringify(snap, null, 2);

  // Events dropdown
  const events = state.snapshot.events || [];
  els.eventType.innerHTML = "";
  for (const eventType of events) {
    const option = document.createElement("option");
    option.value = eventType;
    option.textContent = eventType;
    els.eventType.append(option);
  }

  if (!els.eventType.value && events.length > 0) els.eventType.value = events[0];

  if (els.eventType.value && (!els.eventEditor.value || els.eventEditor.value.trim() === "")) {
    els.eventEditor.value = JSON.stringify(getDefaultEventPayload(els.eventType.value), null, 2);
  }
}

function getDefaultEventPayload(eventType) {
  const now = Date.now();
  const defaults = {
    streamOnline: {
      isLive: true,
      id: "local-stream-id",
      title: "Mock stream online",
      game: { id: "509658", name: "Just Chatting" },
      language: "en",
      tags: ["Mock"],
      isMature: false,
      viewerCount: 1234,
      startedAt: now - 120000,
      thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_vedal987-{width}x{height}.jpg",
    },
    streamOffline: { isLive: false },
    streamUpdate: {
      title: "Updated title",
      game: { id: "509658", name: "Just Chatting" },
      language: "en",
      isMature: false,
    },
    scheduleUpdate: {
      year: Number(els.scheduleYear.value) || new Date().getUTCFullYear(),
      week: Number(els.scheduleWeek.value) || 1,
      isFinal: els.scheduleFinal.checked,
      schedule: (() => {
        try {
          return parseJsonEditor(els.scheduleEditor, "schedule");
        } catch {
          return [];
        }
      })(),
    },
    subathonUpdate: {
      year: Number(els.subathonYear.value) || new Date().getUTCFullYear(),
      name: "Mock subathon",
      subcount: 100,
      goals: { 100: { name: "Kickoff", completed: true, reached: true } },
      isActive: true,
      startTimestamp: now - 60000,
    },
    subathonGoalUpdate: {
      year: Number(els.subathonYear.value) || new Date().getUTCFullYear(),
      goalNumber: 100,
      goal: { name: "Kickoff", completed: true, reached: true },
      subcount: 100,
    },
    secretneuroaccountOnline: {
      isLive: true,
      id: "secret-stream-id",
      title: "Secret neuro account online",
      game: { id: "509658", name: "Just Chatting" },
      language: "en",
      tags: ["secret", "mock"],
      isMature: false,
      viewerCount: 420,
      startedAt: now - 120000,
      thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_vedal987-{width}x{height}.jpg",
    },
    streamRaidIncoming: {
      channel: { displayName: "Incoming", name: "incoming", id: "123" },
      viewerCount: 250,
    },
    streamRaidOutgoing: {
      channel: { displayName: "Outgoing", name: "outgoing", id: "456" },
      viewerCount: 310,
    },
  };
  return defaults[eventType] || {};
}

/* ─── Core actions ─── */
async function refreshAll() {
  const health = await requestJson("/health");
  const snapshot = await requestJson("/api/v1/__test/state");
  state.snapshot = { health: health.status, ...snapshot };
  fillFromSnapshot();
}

async function doImport(target, extra = {}) {
  const token = getToken();
  if (!token) throw new Error("Paste a real NIA token first (sidebar).");

  await requestJson("/api/v1/__test/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, token, ...extra }),
  });

  await refreshAll();
}

function setActiveTab(tab) {
  for (const button of els.tabs.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.tab === tab);
  }
  for (const panel of els.panels) {
    panel.classList.toggle("active", panel.dataset.panel === tab);
  }
}

/* ─── Event binding ─── */
function bindEvents() {
  // Tab navigation
  els.tabs.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-tab]");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
  });

  // Console drawer toggle
  els.consoleToggle.addEventListener("click", () => {
    els.consoleDrawer.classList.toggle("open");
  });

  $("clearLog").addEventListener("click", () => {
    els.log.innerHTML = "";
    logCount = 0;
    els.consoleBadge.textContent = "0";
  });

  // Refresh & reset
  $("refreshAll").addEventListener("click", () =>
    withLoading("refreshAll", async () => {
      await refreshAll();
      log("Refreshed state");
    }).catch((e) => log(e.message, "err")),
  );

  $("resetState").addEventListener("click", async () => {
    if (!confirm("Reset mock state to defaults?")) return;
    await withLoading("resetState", async () => {
      await requestJson("/api/v1/__test/reset", { method: "POST" });
      await refreshAll();
      log("State reset to defaults");
    }).catch((e) => log(e.message, "err"));
  });

  // Import buttons
  const importHandler = (id, target, extraFn) => {
    $(id).addEventListener("click", () =>
      withLoading(id, async () => {
        await doImport(target, extraFn ? extraFn() : {});
        log(`Imported ${target}`);
      }).catch((e) => log(e.message, "err")),
    );
  };

  importHandler("importStream", "stream");
  importHandler("importVods", "vods");
  importHandler("importScheduleLatest", "scheduleLatest");
  importHandler("importSubathonCurrent", "subathonCurrent");
  importHandler("importDevstreamTimes", "devstreamtimes");
  importHandler("importScheduleWeek", "scheduleWeek", () => ({
    year: Number(els.importWeekYear.value),
    week: Number(els.importWeekWeek.value),
  }));
  importHandler("importSubathonYearBtn", "subathonYear", () => ({
    year: Number(els.importSubathonYear.value),
  }));

  // Twitch saves
  $("saveStream").addEventListener("click", () =>
    withLoading("saveStream", async () => {
      const payload = parseJsonEditor(els.streamEditor, "stream");
      await requestJson("/api/v1/__test/twitch/stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshAll();
      log("Saved stream payload");
    }).catch((e) => log(e.message, "err")),
  );

  $("saveVods").addEventListener("click", () =>
    withLoading("saveVods", async () => {
      const payload = parseJsonEditor(els.vodsEditor, "vods");
      await requestJson("/api/v1/__test/twitch/vods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshAll();
      log("Saved vod list");
    }).catch((e) => log(e.message, "err")),
  );

  // Schedule
  $("loadWeek").addEventListener("click", () => {
    const week = getScheduleByInput();
    if (!week) {
      log("Week not found in local state", "warn");
      return;
    }
    els.scheduleEditor.value = JSON.stringify(week.schedule, null, 2);
    els.scheduleFinal.checked = !!week.isFinal;
    log("Loaded week from local state");
  });

  $("saveSchedule").addEventListener("click", () =>
    withLoading("saveSchedule", async () => {
      const year = Number(els.scheduleYear.value);
      const week = Number(els.scheduleWeek.value);
      const schedule = parseJsonEditor(els.scheduleEditor, "schedule entries");
      await requestJson("/api/v1/__test/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          week,
          schedule,
          isFinal: !!els.scheduleFinal.checked,
          setAsLatest: !!els.scheduleLatest.checked,
        }),
      });
      await refreshAll();
      log(`Saved schedule ${year}/W${week}`);
    }).catch((e) => log(e.message, "err")),
  );

  $("deleteSchedule").addEventListener("click", () =>
    withLoading("deleteSchedule", async () => {
      const year = Number(els.scheduleYear.value);
      const week = Number(els.scheduleWeek.value);
      await requestJson(`/api/v1/__test/schedule?year=${year}&week=${week}`, { method: "DELETE" });
      await refreshAll();
      log(`Deleted schedule ${year}/W${week}`);
    }).catch((e) => log(e.message, "err")),
  );

  $("saveDevstream").addEventListener("click", () =>
    withLoading("saveDevstream", async () => {
      const payload = parseJsonEditor(els.devstreamEditor, "devstreamtimes");
      await requestJson("/api/v1/__test/schedule/devstreamtimes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshAll();
      log("Saved devstream timestamps");
    }).catch((e) => log(e.message, "err")),
  );

  // Subathon
  $("loadSubathon").addEventListener("click", () => {
    const year = String(els.subathonYear.value || "");
    const item = state.snapshot?.state?.subathon?.byYear?.[year];
    if (!item) {
      log("Subathon year not found", "warn");
      return;
    }
    els.subathonEditor.value = JSON.stringify(item, null, 2);
    log("Loaded subathon year");
  });

  $("saveSubathon").addEventListener("click", () =>
    withLoading("saveSubathon", async () => {
      const payload = parseJsonEditor(els.subathonEditor, "subathon");
      await requestJson("/api/v1/__test/subathon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshAll();
      log(`Saved subathon year ${payload.year}`);
    }).catch((e) => log(e.message, "err")),
  );

  $("deleteSubathon").addEventListener("click", () =>
    withLoading("deleteSubathon", async () => {
      const year = Number(els.subathonYear.value);
      await requestJson(`/api/v1/__test/subathon?year=${year}`, { method: "DELETE" });
      await refreshAll();
      log(`Deleted subathon year ${year}`);
    }).catch((e) => log(e.message, "err")),
  );

  // WS Emit
  els.eventType.addEventListener("change", () => {
    try {
      els.eventEditor.value = JSON.stringify(getDefaultEventPayload(els.eventType.value), null, 2);
    } catch {}
  });

  $("emitEvent").addEventListener("click", () =>
    withLoading("emitEvent", async () => {
      const payload = parseJsonEditor(els.eventEditor, "event payload");
      const timestampRaw = (els.eventTimestamp.value || "").trim();
      const timestamp = timestampRaw.length > 0 ? Number(timestampRaw) : undefined;
      await requestJson("/api/v1/__test/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: els.eventType.value, eventData: payload, timestamp }),
      });
      log(`Emitted ${els.eventType.value}`);
    }).catch((e) => log(e.message, "err")),
  );

  // Raw state
  $("saveState").addEventListener("click", () =>
    withLoading("saveState", async () => {
      const payload = parseJsonEditor(els.stateEditor, "mock state");
      await requestJson("/api/v1/__test/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: payload }),
      });
      await refreshAll();
      log("Saved full state");
    }).catch((e) => log(e.message, "err")),
  );

  // Token persistence
  els.niaToken.addEventListener("change", () => {
    localStorage.setItem("nia.mock.import.token", els.niaToken.value);
  });
}

async function onImportClick(target, extra = {}) {
  try {
    await doImport(target, extra);
    log(`Imported ${target}`);
  } catch (error) {
    log(error.message, "err");
  }
}

async function bootstrap() {
  els.niaToken.value = localStorage.getItem("nia.mock.import.token") || "";
  bindEvents();

  try {
    await refreshAll();
    log("UI ready");
  } catch (error) {
    log(error.message, "err");
  }
}

bootstrap();
