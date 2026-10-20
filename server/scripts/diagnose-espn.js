/**
 * scripts/diagnose-espn.js   —   npm --prefix server run diagnose
 * --------------------------------------------------
 * Prueba ESPN DIRECTAMENTE (sin pasar por Express) y clasifica cada
 * consulta en:
 *   1 SIN RESPUESTA (DNS/timeout/conexión)   2 ERROR HTTP
 *   3 OK pero SIN eventos                    4 OK con datos (a comparar)
 *   5 formato inválido (no JSON / sin `events`)
 *
 * Además compara, por liga, el RANGO de N días (como lo pide la app) con la
 * suma de consultas día a día: si difieren, ESPN trunca/ignora rangos.
 *
 * Opciones:  --league=esp.1   --days=14   (por defecto todas, últimos 14 días)
 */
const axios = require("axios");
const { COMPETITIONS } = require("../src/config/competitions");

const SITE = process.env.ESPN_BASE_URL || "https://site.api.espn.com/apis/site/v2/sports/soccer";
const V2 = process.env.ESPN_STANDINGS_BASE_URL || "https://site.api.espn.com/apis/v2/sports/soccer";
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1] || d;
const DAYS = Number(arg("days", 14));
const only = arg("league", null);
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://www.espn.com/"
};

async function probe(url) {
  const t0 = Date.now();
  try {
    const r = await axios.get(url, { timeout: 12000, headers: BROWSER_HEADERS });
    const ms = Date.now() - t0;
    if (!r.data || typeof r.data !== "object") return { cat: "5 formato inválido (no JSON)", ms, status: r.status };
    return { cat: "ok", ms, status: r.status, data: r.data };
  } catch (e) {
    const ms = Date.now() - t0;
    if (e.response) {
      const h = e.response.headers || {};
      const body = typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data || "");
      const who = [h.server && `server=${h.server}`, h["x-cache"] && `x-cache=${h["x-cache"]}`, h["retry-after"] && `retry-after=${h["retry-after"]}`].filter(Boolean).join(" ");
      return { cat: `2 ERROR HTTP ${e.response.status}`, ms, status: e.response.status, who, snippet: body.replace(/\s+/g, " ").slice(0, 160) };
    }
    return { cat: `1 SIN RESPUESTA (${e.code || e.message})`, ms };
  }
}

function classifyScoreboard(p) {
  if (p.cat !== "ok") return { ...p, events: null };
  if (!Array.isArray(p.data.events)) {
    return { ...p, cat: p.data.leagues ? "3 OK sin eventos (sin clave events)" : "5 formato inválido (sin events)", events: 0 };
  }
  const n = p.data.events.length;
  return { ...p, cat: n === 0 ? "3 OK pero SIN eventos" : "4 OK con eventos", events: n };
}

(async () => {
  const today = new Date();
  const from = new Date(today.getTime() - (DAYS - 1) * 86400000);
  console.log(`Diagnóstico ESPN · hoy=${ymd(today)} · ventana=${ymd(from)}-${ymd(today)} (${DAYS} días)\n`);

  const dns = await probe(`${SITE}/esp.1/scoreboard`);
  if (dns.cat.startsWith("1")) {
    console.log(`✖ No hay conexión con ESPN desde esta máquina: ${dns.cat}. Revisa Internet/DNS/firewall y repite.`);
    process.exit(2);
  }

  for (const c of COMPETITIONS.filter((x) => !only || x.id === only)) {
    console.log(`── ${c.id} (${c.name})`);
    const t = classifyScoreboard(await probe(`${SITE}/${c.id}/scoreboard`));
    console.log(`   hoy        : ${t.cat}${t.events != null ? ` · eventos=${t.events}` : ""} · ${t.ms}ms`);
    if (t.snippet !== undefined) console.log(`   ↳ quién responde: ${t.who || "(sin cabeceras útiles)"}\n   ↳ cuerpo: ${t.snippet || "(vacío)"}`);

    if (t.status === 403 || t.status === 429) {
      console.log("   ✖ ESPN bloquea esta conexión (403/429). Se omiten el resto de pruebas para no alargar el bloqueo.\n");
      process.exit(3);
    }
    const r = classifyScoreboard(await probe(`${SITE}/${c.id}/scoreboard?dates=${ymd(from)}-${ymd(today)}`));
    console.log(`   rango      : ${r.cat}${r.events != null ? ` · eventos=${r.events}` : ""} · ${r.ms}ms`);
    const rl = classifyScoreboard(await probe(`${SITE}/${c.id}/scoreboard?dates=${ymd(from)}-${ymd(today)}&limit=500`));
    console.log(`   rango+limit: ${rl.cat}${rl.events != null ? ` · eventos=${rl.events}` : ""} · ${rl.ms}ms`);

    const days = Array.from({ length: DAYS }, (_, i) => ymd(new Date(from.getTime() + i * 86400000)));
    const per = await Promise.all(days.map((d) => probe(`${SITE}/${c.id}/scoreboard?dates=${d}`).then(classifyScoreboard)));
    const failed = per.filter((x) => x.events == null).length;
    const sum = per.reduce((a, x) => a + (x.events || 0), 0);
    let verdict = "coinciden ✔";
    if (failed) verdict = `⚠ ${failed} consultas diarias fallaron (¿límite de ESPN?)`;
    else if (r.events != null && r.events !== sum) verdict = `✖ INCOMPLETO: el rango da ${r.events} y día a día ${sum}`;
    console.log(`   día a día  : eventos=${sum} (${DAYS} consultas) → ${verdict}`);

    const firstId = (per.find((x) => x.events > 0)?.data.events[0] || {}).id;
    if (firstId) {
      const s = await probe(`${SITE}/${c.id}/summary?event=${firstId}`);
      const d = s.data || {};
      console.log(
        `   summary ${firstId}: ${s.cat === "ok" ? "OK" : s.cat} · keyEvents=${(d.keyEvents || []).length} ` +
          `stats=${(d.boxscore?.teams || []).length} alineaciones=${(d.rosters || []).length}`
      );
    }

    if (c.tier === "main") {
      const v2 = await probe(`${V2}/${c.id}/standings`);
      const site = await probe(`${SITE}/${c.id}/standings`);
      const rows = (p) => (p.cat !== "ok" ? p.cat : (p.data.children || []).reduce((a, ch) => a + (ch.standings?.entries?.length || 0), 0) + (p.data.standings?.entries?.length || 0));
      console.log(`   standings  : /apis/v2 → filas=${rows(v2)} · /apis/site/v2 → filas=${rows(site)}`);
    }
    console.log("");
  }
})();
