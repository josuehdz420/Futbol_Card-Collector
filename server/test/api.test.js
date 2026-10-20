/**
 * test/api.test.js  —  npm --prefix server test
 * Prueba la API REAL (Express + espnService + caché) contra un ESPN simulado.
 * Verifica el contrato y los escenarios de fallo; NO prueba ESPN real
 * (para eso: npm --prefix server run diagnose).
 */
process.env.CACHE_DISABLE_PERSIST = "1";
process.env.LOG_LEVEL = "error";
process.env.ESPN_TIMEOUT_MS = "400";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createMock, makeEvent, ymd, standingsEntries } = require("./mock-espn");

const mock = createMock();
let base, server, cache;

const DAY = 86400000;
const at = (offsetDays, hour = 18) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const range = (back = 30, fwd = 45) => `from=${ymd(new Date(Date.now() - back * DAY))}&to=${ymd(new Date(Date.now() + fwd * DAY))}`;
const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
};

before(async () => {
  const port = await mock.start();
  process.env.ESPN_BASE_URL = `http://127.0.0.1:${port}/apis/site/v2/sports/soccer`;
  process.env.ESPN_STANDINGS_BASE_URL = `http://127.0.0.1:${port}/apis/v2/sports/soccer`;
  cache = require("../src/utils/cache");
  const app = require("../src/app");
  await new Promise((r) => (server = app.listen(0, "127.0.0.1", r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await mock.stop();
});
beforeEach(() => {
  cache.flush();
  mock.reset();
  require("../src/services/espnService")._internal.resetBreaker();
  mock.state.events = {
    "esp.1": [
      makeEvent(101, at(-20), { state: "post", home: "Real Madrid", away: "Barcelona", hs: "2", as: "1" }),
      makeEvent(102, at(0), { state: "in", home: "Sevilla", away: "Betis", hs: "1", as: "1" }),
      makeEvent(103, at(30))
    ],
    "eng.1": [makeEvent(201, at(5))]
  };
  mock.state.standings = { "esp.1": standingsEntries(["A", "B", "C"]), "eng.1": standingsEntries(["X", "Y"]) };
});

test("raíz y /competitions", async () => {
  assert.equal((await get("/")).body.success, true);
  const c = await get("/competitions");
  assert.equal(c.body.count, 8);
});

test("rango de 76 días: eventos de todo el rango, en ventanas, con meta", async () => {
  const r = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 3);
  assert.deepEqual(r.body.data.map((m) => m.id), ["101", "102", "103"]);
  assert.equal(r.body.meta.source, "espn");
  assert.equal(r.body.meta.partial, false);
  assert.equal(r.body.meta.verifiedEmpty, false);
  assert.equal(r.body.meta.upstream.requests, 6); // 76 días / 14
  assert.equal(r.body.data[1].status.isLive, true);
  assert.equal(r.body.data[1].home.score, "1");
});

test("segunda llamada idéntica sale del caché (sin tocar ESPN)", async () => {
  await get(`/matches?league=esp.1&${range()}`);
  const before = mock.state.hits.length;
  const r = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(r.body.meta.source, "cache");
  assert.equal(mock.state.hits.length, before);
});

test("peticiones concurrentes idénticas comparten UNA sola consulta a ESPN", async () => {
  await Promise.all(Array.from({ length: 5 }, () => get(`/matches?league=esp.1&${range()}`)));
  assert.equal(mock.countHits("/esp.1/scoreboard"), 6);
});

test("competición sin partidos: éxito, verifiedEmpty y SIN ráfaga día a día", async () => {
  const r = await get(`/matches?league=esp.super_cup&${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 0);
  assert.equal(r.body.meta.verifiedEmpty, true);
  assert.equal(mock.countHits("/esp.super_cup/scoreboard"), 6);
});

test("ESPN responde 500: error 502 con code, NO lista vacía, y no se cachea", async () => {
  mock.state.failWhen = (u, l) => (l === "eng.1" ? 500 : null);
  const r = await get(`/matches?league=eng.1&${range()}`);
  assert.equal(r.status, 502);
  assert.equal(r.body.success, false);
  assert.equal(r.body.code, "upstream_http_error");
  const n = mock.countHits("/eng.1/scoreboard");
  assert.equal(n, 12); // 6 ventanas x (intento + 1 reintento)
  mock.state.failWhen = null;
  const ok = await get(`/matches?league=eng.1&${range()}`);
  assert.equal(ok.body.count, 1); // se recuperó de inmediato: el fallo no quedó cacheado
});

test("ESPN devuelve HTML: upstream_bad_format", async () => {
  mock.state.failWhen = () => "html";
  const r = await get(`/matches?league=esp.1&date=${ymd(new Date())}`);
  assert.equal(r.status, 502);
  assert.equal(r.body.code, "upstream_bad_format");
});

test("ESPN no responde: timeout 504", async () => {
  mock.state.failWhen = () => "hang";
  const r = await get(`/matches?league=esp.1&date=${ymd(new Date())}`);
  assert.equal(r.status, 504);
  assert.equal(r.body.code, "upstream_timeout");
});

test("fallo de UNA ventana: respuesta parcial marcada, con el resto de datos", async () => {
  const bad = ymd(new Date(Date.now() + 30 * DAY));
  mock.state.failWhen = (u) => {
    const m = u.match(/dates=(\d{8})-(\d{8})/);
    return m && m[1] <= bad && bad <= m[2] ? 500 : null;
  };
  const r = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.meta.partial, true);
  assert.equal(r.body.meta.verifiedEmpty, false);
  assert.ok(r.body.meta.warnings.length >= 1);
  assert.deepEqual(r.body.data.map((m) => m.id), ["101", "102"]);
});

test("respaldo: si ESPN cae se sirve el último dato bueno marcado como stale", async () => {
  await get(`/matches?league=esp.1&${range()}`);
  for (const [, e] of cache.store) e.expiresAt = Date.now() - 1; // caducar sin borrar
  mock.state.failWhen = () => 500;
  const r = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 3);
  assert.equal(r.body.meta.stale, true);
  assert.equal(r.body.meta.source, "stale");
});

test("ESPN ignora el rango: se refuerza día a día y no se pierden partidos", async () => {
  mock.state.ignoreRange = true;
  const r = await get(`/matches?league=esp.1&${range(5, 10)}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.some((m) => m.id === "102"));
  assert.ok(r.body.meta.upstream.requests > 2);
});

test("todas las ligas en rango; si todas fallan -> all_sources_failed", async () => {
  const r = await get(`/matches?${range()}`);
  assert.equal(r.body.count, 4);
  cache.flush();
  mock.state.failWhen = () => 500;
  const bad = await get(`/matches?${range()}`);
  assert.equal(bad.status, 502);
  assert.equal(bad.body.code, "all_sources_failed");
});

test("fallo parcial entre ligas se declara en meta.warnings", async () => {
  mock.state.failWhen = (u, l) => (l === "eng.1" ? 500 : null);
  const r = await get(`/matches?${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.meta.partial, true);
  assert.ok(r.body.meta.warnings.some((w) => w.league === "eng.1"));
  assert.equal(r.body.count, 3);
});

test("/live: devuelve en vivo; sin en vivo = verifiedEmpty; ESPN caído = error", async () => {
  const live = await get("/live");
  assert.equal(live.body.count, 1);
  assert.equal(live.body.data[0].id, "102");
  cache.flush();
  mock.state.events = {};
  const none = await get("/live");
  assert.equal(none.body.count, 0);
  assert.equal(none.body.meta.verifiedEmpty, true);
  cache.flush();
  mock.state.failWhen = () => 503;
  assert.equal((await get("/live")).status, 502);
});

test("validación: fechas, rango, liga, id", async () => {
  const code = async (p) => (await get(p)).body.code;
  assert.equal(await code("/matches?league=esp.1&from=2026ABCD&to=20261231"), "invalid_date_range");
  assert.equal(await code("/matches?league=esp.1&from=20260231&to=20260301"), "invalid_date_range");
  assert.equal(await code("/matches?league=esp.1&from=20261001"), "invalid_date_range");
  assert.equal(await code("/matches?league=esp.1&from=20261201&to=20261001"), "invalid_date_range");
  assert.equal(await code("/matches?league=esp.1&from=20260101&to=20261201"), "range_too_large");
  assert.equal(await code("/matches?league=esp.1&date=hoy"), "invalid_date");
  assert.equal(await code("/matches?league=zzz.9"), "invalid_league");
  assert.equal(await code("/match/12abc"), "invalid_match_id");
  assert.equal(mock.state.hits.length, 0); // nada inválido llegó a ESPN
});

test("standings: usa el endpoint /apis/v2 (el site/v2 es un stub sin tabla)", async () => {
  const r = await get("/standings?league=esp.1");
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 3);
  assert.equal(r.body.data[0].team, "A");
  assert.equal(r.body.data[0].points, 30);
  assert.equal(r.body.data[0].group, null);
});

test("standings vacías en liga principal = error (no se cachea un []); en copa = vacío válido", async () => {
  mock.state.standings["esp.1"] = [];
  const r = await get("/standings?league=esp.1");
  assert.equal(r.status, 502);
  assert.equal(r.body.code, "standings_empty");
  const cup = await get("/standings?league=eng.fa");
  assert.equal(cup.status, 200);
  assert.equal(cup.body.count, 0);
});

test("detalle de partido: con ?league va directo; sin él lo localiza; inexistente=404; ESPN caído=502", async () => {
  let r = await get("/match/101?league=esp.1");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.league, "esp.1");
  assert.equal(r.body.data.scorers[0].player, "Jugador Uno");
  assert.equal(mock.countHits("/summary"), 1);

  cache.flush();
  mock.reset();
  await get(`/matches?league=esp.1&${range()}`); // puebla caché de scoreboards
  mock.state.hits.length = 0;
  r = await get("/match/103");
  assert.equal(r.body.data.league, "esp.1");
  assert.equal(mock.countHits("/summary"), 1); // la liga se dedujo del caché

  assert.equal((await get("/match/999999")).status, 404);
  cache.flush();
  mock.state.failWhen = () => 500;
  const down = await get("/match/101?league=esp.1");
  assert.equal(down.status, 502);
  assert.equal(down.body.code, "upstream_unavailable");
});

test("splitRange cubre el rango sin huecos ni solapes", () => {
  const { splitRange } = require("../src/services/espnService")._internal;
  const w = splitRange("20260919", "20261203");
  assert.equal(w[0][0], "20260919");
  assert.equal(w.at(-1)[1], "20261203");
  assert.equal(w.length, 6);
});

test("ESPN rechaza los RANGOS con 403: día a día, sin freno global, y se deja de insistir con rangos", async () => {
  mock.state.failWhen = (u) => (/dates=\d{8}-\d{8}/.test(u) ? 403 : null);
  const r = await get(`/matches?league=esp.1&${range(5, 10)}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.some((m) => m.id === "102"));
  assert.equal(r.body.meta.partial, false);
  // el 403 de rango NO pausó todo: tabla y partidos de hoy siguen funcionando
  assert.equal((await get("/standings?league=esp.1")).status, 200);
  assert.equal((await get(`/matches?league=eng.1&date=${ymd(new Date())}`)).status, 200);
  // segunda carga de otra liga: ya no se intentan rangos (solo días)
  const rangeHits = () => mock.state.hits.filter((u) => /dates=\d{8}-\d{8}/.test(u)).length;
  const before = rangeHits();
  await get(`/matches?league=eng.1&${range(5, 10)}`);
  assert.equal(rangeHits(), before);
});

test("ESPN rechaza el rango con 400: se pide día a día y SÍ llegan los partidos", async () => {
  mock.state.failWhen = (u) => (/dates=\d{8}-\d{8}/.test(u) ? 400 : null);
  const r = await get(`/matches?league=esp.1&${range(5, 10)}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.some((m) => m.id === "102"));
  assert.equal(r.body.meta.partial, false);
});

test("ESPN bloquea con 403: error claro, y el freno evita seguir golpeando a ESPN", async () => {
  mock.state.failWhen = () => 403;
  const first = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(first.status, 502);
  assert.equal(first.body.details.upstreamStatus, 403);
  const hitsAfterFirst = mock.state.hits.length;
  const second = await get(`/matches?league=eng.1&${range()}`);
  assert.equal(second.status, 503);
  assert.equal(second.body.code, "upstream_blocked");
  assert.equal(mock.state.hits.length, hitsAfterFirst); // cero peticiones nuevas a ESPN
});

test("durante el bloqueo se sirve el último dato bueno (stale); al terminar la pausa se recupera", async () => {
  await get(`/matches?league=esp.1&${range()}`);
  for (const [, e] of cache.store) e.expiresAt = Date.now() - 1;
  mock.state.failWhen = () => 403;
  const r = await get(`/matches?league=esp.1&${range()}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.meta.stale, true);
  assert.equal(r.body.count, 3);
  mock.state.failWhen = null;
  require("../src/services/espnService")._internal.resetBreaker(); // simula fin de la pausa
  cache.flush();
  assert.equal((await get(`/matches?league=esp.1&${range()}`)).body.meta.source, "espn");
});
