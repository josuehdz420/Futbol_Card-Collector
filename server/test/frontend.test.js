/**
 * test/frontend.test.js — carga el api.js + swr-cache.js REALES del frontend
 * en un contexto con fetch/localStorage simulados y lo prueba contra el
 * backend real (que a su vez habla con el ESPN simulado).
 */
process.env.CACHE_DISABLE_PERSIST = "1";
process.env.LOG_LEVEL = "error";
process.env.ESPN_TIMEOUT_MS = "400";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createMock, makeEvent, standingsEntries } = require("./mock-espn");

const mock = createMock();
let backend, cache, server, espnBase, espnV2;
const DAY = 86400000;
const at = (o, h = 18) => { const d = new Date(Date.now() + o * DAY); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

function loadFrontend(apiBase) {
  const logs = [];
  const ctx = {
    window: { __API_BASE__: apiBase, addEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, },
    DB: { put: async () => {}, get: async () => null, delete: async () => {} },
    CustomEvent: class {}, document: { addEventListener() {} },
    fetch, AbortController, performance, URL, setTimeout, clearTimeout, setInterval, Promise, Date, Math, JSON, Set, Map, Object, Array, String, Number,
    console: { info() {}, log() {}, warn: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")) },
  };
  vm.createContext(ctx);
  const root = path.join(__dirname, "..", "..", "public", "js");
  const src = ["utils/swr-cache.js", "modules/api.js"].map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
  vm.runInContext(src + "\n;globalThis.__API = API; globalThis.__Cache = Cache; globalThis.__STATUS = API_STATUS;", ctx);
  ctx.__API.ESPN_DIRECT_BASE = espnBase;
  ctx.__API.ESPN_STANDINGS_DIRECT_BASE = espnV2;
  Object.keys(ctx.__API._leagueMemo).forEach((k) => delete ctx.__API._leagueMemo[k]);
  return { API: ctx.__API, Cache: ctx.__Cache, STATUS: ctx.__STATUS, logs, ctx };
}

before(async () => {
  const port = await mock.start();
  espnBase = `http://127.0.0.1:${port}/apis/site/v2/sports/soccer`;
  espnV2 = `http://127.0.0.1:${port}/apis/v2/sports/soccer`;
  process.env.ESPN_BASE_URL = espnBase;
  process.env.ESPN_STANDINGS_BASE_URL = espnV2;
  cache = require("../src/utils/cache");
  const app = require("../src/app");
  await new Promise((r) => (server = app.listen(0, "127.0.0.1", r)));
  backend = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await mock.stop(); });
beforeEach(() => {
  cache.flush(); mock.reset(); require("../src/services/espnService")._internal.resetBreaker();
  mock.state.events = {
    "esp.1": [makeEvent(101, at(-20), { state: "post", home: "Real Madrid", away: "Barcelona", hs: "2", as: "1" }), makeEvent(102, at(0), { state: "in" }), makeEvent(103, at(30))],
    "eng.1": [makeEvent(201, at(5))],
  };
  mock.state.standings = { "esp.1": standingsEntries(["A", "B"]) };
});

test("flujo normal: partidos normalizados y fan-out compartido entre live/upcoming/finished/teamMatches", async () => {
  const { API } = loadFrontend(backend);
  const [live, up, fin, tm] = await Promise.all([API.getLiveMatches(), API.getUpcomingMatches(), API.getFinishedMatches(), API.getTeamMatches("Real Madrid")]);
  assert.equal(live.length, 1);
  assert.equal(live[0].status, "live");
  assert.ok(up.length >= 3);
  assert.equal(fin.length, 1);
  assert.equal(fin[0].scoreHome, 2);
  assert.equal(tm.played.length, 1);
  // 8 ligas x 6 ventanas = 48 consultas a ESPN en total (antes: x4 por duplicados)
  const sb = mock.state.hits.filter((u) => u.includes("/scoreboard")).length;
  assert.equal(sb, 48);
});

test("backend caído: cae a ESPN directo y los datos llegan", async () => {
  const { API, STATUS } = loadFrontend("http://127.0.0.1:1"); // puerto cerrado
  const up = await API.getUpcomingMatches();
  assert.ok(up.length >= 3);
  assert.equal(STATUS.usedEspnFallback, true);
});

test("backend y ESPN caídos: [] SIN envenenar el caché; al volver ESPN se recupera", async () => {
  const { API, Cache } = loadFrontend("http://127.0.0.1:1");
  mock.state.failWhen = () => 500;
  const none = await API.getUpcomingMatches();
  assert.equal(none.length, 0);
  assert.equal(Cache.get("upcoming"), null); // nada guardado
  mock.state.failWhen = null;
  API._leagueMemo = {};
  const back = await API.getUpcomingMatches();
  assert.ok(back.length >= 3);
});

test("un fallo transitorio NO pisa los datos buenos ya cacheados", async () => {
  const { API, Cache } = loadFrontend(backend);
  const good = await API.getUpcomingMatches();
  assert.ok(good.length >= 3);
  mock.state.failWhen = () => 500; cache.flush(); API._leagueMemo = {};
  await API.getUpcomingMatches({}); // sirve caché y revalida en segundo plano
  await new Promise((r) => setTimeout(r, 3500));
  assert.ok(Cache.get("upcoming").data.length >= 3);
});

test("vacío confirmado por el backend (verifiedEmpty) se acepta sin contrastar con ESPN directo", async () => {
  mock.state.events = {};
  const { API, ctx } = loadFrontend(backend);
  let direct = 0;
  const orig = API._fetchEspnGamesDirect.bind(API);
  API._fetchEspnGamesDirect = async (...a) => { direct++; return orig(...a); };
  const r = await API._fetchLeagueMatches("esp.super_cup");
  assert.equal(r.length, 0);
  assert.equal(direct, 0);
});

test("backend ANTIGUO (sin meta) que devuelve [] pero ESPN sí tiene partidos: se contrasta y se recuperan", async () => {
  const fake = require("http").createServer((req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: true, count: 0, data: [] })); });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  const { API, STATUS } = loadFrontend(`http://127.0.0.1:${fake.address().port}`);
  const r = await API._fetchLeagueMatches("esp.1");
  assert.ok(r.length >= 3);
  assert.equal(STATUS.usedEspnFallback, true);
  await new Promise((r) => fake.close(r));
});

test("standings: backend ok; backend con tabla vacía -> ESPN directo (/apis/v2); nunca cachea []", async () => {
  const { API } = loadFrontend(backend);
  const t = await API.getStandings("esp.1");
  assert.equal(t.length, 2);
  assert.equal(t[0].team, "A");
  assert.equal(t[0].pts, 30);

  const fake = require("http").createServer((req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ success: true, count: 0, data: [] })); });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  const f2 = loadFrontend(`http://127.0.0.1:${fake.address().port}`);
  const t2 = await f2.API.getStandings("esp.1");
  assert.equal(t2.length, 2);
  mock.state.standings = {};
  const f3 = loadFrontend(`http://127.0.0.1:${fake.address().port}`);
  assert.equal((await f3.API.getStandings("esp.1")).length, 0);
  assert.equal(f3.Cache.get("standings_esp.1"), null);
  await new Promise((r) => fake.close(r));
});

test("detalle de partido envía ?league= al backend", async () => {
  const { API } = loadFrontend(backend);
  const d = await API.getMatchDetail("101", "esp.1");
  assert.equal(d.league, "esp.1");
  assert.equal(d.scorers[0].player, "Jugador Uno");
  assert.ok(mock.state.hits.some((u) => u.includes("/esp.1/summary?event=101")));
  assert.equal(mock.state.hits.filter((u) => u.includes("/summary")).length, 1);
});

test("forceRefresh distingue sin datos (vacío real) de error de red", async () => {
  mock.state.events = {};
  let f = loadFrontend(backend);
  let r = await f.API.forceRefresh();
  assert.equal(r.source, "sin_datos");
  cache.flush();
  f = loadFrontend("http://127.0.0.1:1");
  mock.state.failWhen = () => 500;
  r = await f.API.forceRefresh();
  assert.equal(r.source, "network_error");
});
