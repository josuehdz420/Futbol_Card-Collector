/**
 * test/mock-espn.js
 * --------------------------------------------------
 * ESPN SIMULADO para pruebas locales sin Internet. NO es ESPN: reproduce la
 * forma de las respuestas y permite provocar fallos controlados.
 */
const http = require("http");

function makeEvent(id, iso, { state = "pre", home = "Local", away = "Visita", hs = "0", as = "0" } = {}) {
  return {
    id: String(id),
    date: iso,
    status: {
      displayClock: state === "in" ? "65'" : "0'",
      type: {
        state,
        completed: state === "post",
        description: state === "post" ? "Full Time" : state === "in" ? "In Progress" : "Scheduled",
        detail: state === "post" ? "FT" : state === "in" ? "65'" : iso,
        shortDetail: state === "post" ? "FT" : "x"
      }
    },
    competitions: [
      {
        venue: { fullName: "Estadio Test" },
        competitors: [
          { homeAway: "home", score: hs, team: { id: "1", displayName: home, shortDisplayName: home, logo: "h.png" } },
          { homeAway: "away", score: as, team: { id: "2", displayName: away, shortDisplayName: away, logo: "a.png" } }
        ]
      }
    ]
  };
}

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function createMock() {
  const state = {
    events: {}, // league -> [event]
    hits: [], // urls recibidas
    failWhen: null, // (url, league) => status | "html" | "hang" | null
    ignoreRange: false, // responde a rangos con solo los eventos de hoy
    standings: {}, // league -> entries[]
    todayIso: new Date().toISOString()
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    state.hits.push(req.url);
    const send = (code, body, type = "application/json") => {
      res.writeHead(code, { "Content-Type": type });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };

    // /apis/site/v2/sports/soccer/{league}/{scoreboard|summary|standings}
    // /apis/v2/sports/soccer/{league}/standings
    const m = url.pathname.match(/^\/apis\/(site\/)?v2\/sports\/soccer\/([^/]+)\/(scoreboard|summary|standings)$/);
    if (!m) return send(404, { error: "no route" });
    const [, isSite, league, kind] = m;

    const fail = state.failWhen && state.failWhen(req.url, league, kind);
    if (fail === "hang") return; // nunca responde
    if (fail === "html") return send(200, "<html><body>Service busy</body></html>", "text/html");
    if (typeof fail === "number") return send(fail, { error: "forced" });

    if (kind === "scoreboard") {
      const all = state.events[league] || [];
      const dates = url.searchParams.get("dates");
      let out;
      if (!dates) {
        out = all.filter((e) => e.date.slice(0, 10) === state.todayIso.slice(0, 10) || e.status.type.state === "in");
      } else if (dates.includes("-")) {
        const [a, b] = dates.split("-");
        out = state.ignoreRange
          ? all.filter((e) => e.date.slice(0, 10) === state.todayIso.slice(0, 10))
          : all.filter((e) => ymd(new Date(e.date)) >= a && ymd(new Date(e.date)) <= b);
      } else {
        out = all.filter((e) => ymd(new Date(e.date)) === dates);
      }
      return send(200, { leagues: [{ id: league }], events: out });
    }

    if (kind === "standings") {
      if (isSite) return send(200, { fullViewLink: { text: "Full Standings", href: "https://espn" } }); // stub real
      const entries = state.standings[league] || [];
      return send(200, { children: [{ name: league, standings: { entries } }] });
    }

    if (kind === "summary") {
      const id = url.searchParams.get("event");
      const ev = (state.events[league] || []).find((e) => e.id === id);
      if (!ev) return send(404, { code: 404 });
      const c = ev.competitions[0];
      return send(200, {
        header: { competitions: [{ date: ev.date, status: ev.status, competitors: c.competitors.map((x) => ({ ...x, team: { ...x.team, logos: [{ href: x.team.logo }] } })) }] },
        gameInfo: { venue: { fullName: "Estadio Test" } },
        keyEvents: [{ type: { text: "Goal" }, clock: { displayValue: "10'" }, text: "Goal! A 1, B 0. Jugador Uno (Local) shot.", team: { displayName: "Local" } }],
        boxscore: { teams: [] },
        rosters: []
      });
    }
  });

  return {
    state,
    start: () => new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port))),
    stop: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    reset() {
      state.hits.length = 0;
      state.failWhen = null;
      state.ignoreRange = false;
    },
    countHits: (substr) => state.hits.filter((u) => u.includes(substr)).length
  };
}

function standingsEntries(names) {
  return names.map((n, i) => ({
    team: { id: String(i + 1), displayName: n, logos: [{ href: `${n}.png` }] },
    stats: [
      { name: "rank", value: i + 1 },
      { name: "gamesPlayed", value: 10 },
      { name: "wins", value: 10 - i },
      { name: "ties", value: 0 },
      { name: "losses", value: i },
      { name: "pointsFor", value: 20 },
      { name: "pointsAgainst", value: 5 },
      { name: "pointDifferential", value: 15 },
      { name: "points", value: 30 - i }
    ]
  }));
}

module.exports = { createMock, makeEvent, ymd, standingsEntries };
