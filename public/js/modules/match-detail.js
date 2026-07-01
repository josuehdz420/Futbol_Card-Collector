// match-detail.js
// --------------------------------------------------
// Ficha rápida de un partido (en vivo o finalizado): marcador con la fase
// correcta (descanso, prórroga, penales), goleadores, alineación inicial +
// cambios, y estadísticas rápidas por equipo (posesión, tiros, duelos, etc.
// según lo que entregue ESPN para ese partido en particular).
//
// Se abre al tocar cualquier partido en vivo o finalizado en el dashboard
// (ver dashboard.js). Usa el Modal genérico que ya existe (toast.js).

const MatchDetail = {

  async open(matchId, basicMatch = null) {
    if (!matchId) return;

    // Estado de carga inmediato, con lo poco que ya tengamos (si vino de
    // una tarjeta ya renderizada) para que no se sienta vacío mientras llega
    // el detalle.
    Modal.open(this._renderLoading(basicMatch));

    let detail = null;
    try {
      detail = await API.getMatchDetail(matchId);
    } catch (err) {
      console.error('[MatchDetail] falló al cargar', matchId, err);
    }

    if (!detail) {
      Modal.open(`
        <div style="text-align:center;padding:2rem 1rem">
          <p style="color:var(--text-muted);font-size:0.85rem">No se pudo cargar el detalle de este partido. Intenta de nuevo en un momento.</p>
        </div>`);
      return;
    }

    Modal.open(this._render(detail));
    this._bindTabs();
  },

  // Modal.open() inserta el HTML vía innerHTML, y los <script> insertados
  // así NO se ejecutan en el navegador — por eso las pestañas se enlazan
  // acá, después de insertar el contenido, en vez de con un <script> inline.
  _bindTabs() {
    const content = document.getElementById('modal-content');
    if (!content) return;
    content.querySelectorAll('.md-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.md-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        content.querySelectorAll('.md-tab-panel').forEach(p => {
          p.style.display = (p.dataset.panel === target) ? 'block' : 'none';
        });
      });
    });
  },

  _renderLoading(basic) {
    if (!basic) {
      return `<div style="text-align:center;padding:2.5rem 1rem">
        <p style="color:var(--text-muted);font-size:0.85rem">Cargando ficha del partido…</p>
      </div>`;
    }
    return `
      <div style="text-align:center;padding:0.5rem 0 1.5rem">
        <p style="font-size:0.65rem;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin:0 0 0.5rem">${basic.competition || ''}</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;font-size:1rem;font-weight:700">
          <span>${basic.homeFlag || ''} ${basic.home || ''}</span>
          <span style="opacity:.5">vs</span>
          <span>${basic.away || ''} ${basic.awayFlag || ''}</span>
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:1rem">Cargando estadísticas y alineaciones…</p>
      </div>`;
  },

  _statBar(label, homeVal, awayVal) {
    const hNum = parseFloat(String(homeVal).replace('%', '')) || 0;
    const aNum = parseFloat(String(awayVal).replace('%', '')) || 0;
    const total = hNum + aNum;
    const hPct = total > 0 ? (hNum / total) * 100 : 50;
    return `
      <div style="margin-bottom:0.6rem">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;font-weight:700;margin-bottom:2px">
          <span>${homeVal ?? '—'}</span>
          <span style="color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;font-size:0.6rem">${label}</span>
          <span>${awayVal ?? '—'}</span>
        </div>
        <div style="display:flex;height:5px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,0.08)">
          <div style="width:${hPct}%;background:var(--accent,#00d4ff)"></div>
          <div style="width:${100-hPct}%;background:rgba(255,255,255,0.25)"></div>
        </div>
      </div>`;
  },

  _renderStats(d) {
    if (!d.statistics || d.statistics.length < 2) {
      return `<p style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:0.75rem 0">Estadísticas no disponibles todavía para este partido.</p>`;
    }
    const homeStats = d.statistics.find(s => s.team === d.home)?.stats || [];
    const awayStats = d.statistics.find(s => s.team === d.away)?.stats || [];

    // Unimos por nombre de stat, preservando el orden que trae ESPN para el
    // equipo local (si un stat solo existe en uno de los dos, igual se
    // muestra con "—" del otro lado).
    const names = [];
    homeStats.forEach(s => { if (s.name && !names.includes(s.name)) names.push(s.name); });
    awayStats.forEach(s => { if (s.name && !names.includes(s.name)) names.push(s.name); });

    if (!names.length) {
      return `<p style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:0.75rem 0">Estadísticas no disponibles todavía para este partido.</p>`;
    }

    const byName = (list, name) => list.find(s => s.name === name)?.value ?? null;

    return names.map(name => {
      const h = byName(homeStats, name);
      const a = byName(awayStats, name);
      const label = homeStats.find(s => s.name === name)?.displayName
        || awayStats.find(s => s.name === name)?.displayName
        || name;
      return this._statBar(label, h, a);
    }).join('');
  },

  _renderScorers(d) {
    if (!d.scorers || !d.scorers.length) return '';
    const line = s => {
      const tag = s.ownGoal ? ' (autogol)' : s.penalty ? ' (penal)' : '';
      return `<div style="font-size:0.78rem;padding:2px 0">⚽ ${s.player || 'Jugador'} <span style="color:var(--text-muted)">${s.clock || ''}${tag}</span></div>`;
    };
    const home = d.scorers.filter(s => s.team === d.home);
    const away = d.scorers.filter(s => s.team === d.away);
    return `
      <div style="display:flex;gap:1rem;margin:0.75rem 0">
        <div style="flex:1">${home.map(line).join('') || '<span style="color:var(--text-muted);font-size:0.75rem">Sin goles</span>'}</div>
        <div style="flex:1;text-align:right">${away.map(line).join('') || '<span style="color:var(--text-muted);font-size:0.75rem">Sin goles</span>'}</div>
      </div>`;
  },

  _renderSubs(d) {
    if (!d.substitutions || !d.substitutions.length) return '';
    const line = s => `
      <div style="font-size:0.74rem;padding:2px 0;color:var(--text-secondary)">
        🔄 ${s.playerOut ? `${s.playerOut} ➜ ` : ''}${s.playerIn || s.text || ''} <span style="color:var(--text-muted)">${s.clock || ''}</span>
      </div>`;
    const home = d.substitutions.filter(s => s.team === d.home);
    const away = d.substitutions.filter(s => s.team === d.away);
    if (!home.length && !away.length) return '';
    return `
      <div style="margin-top:0.75rem">
        <p style="font-size:0.6rem;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin:0 0 4px">Cambios</p>
        <div style="display:flex;gap:1rem">
          <div style="flex:1">${home.map(line).join('') || ''}</div>
          <div style="flex:1;text-align:right">${away.map(line).join('') || ''}</div>
        </div>
      </div>`;
  },

  _renderLineupTeam(l) {
    if (!l) return `<p style="color:var(--text-muted);font-size:0.75rem;text-align:center">No disponible</p>`;
    const starters = l.starters || [];
    const bench = l.bench || [];
    return `
      ${l.formation ? `<p style="text-align:center;font-size:0.68rem;color:var(--text-muted);margin:0 0 6px">Formación ${l.formation}</p>` : ''}
      ${starters.map(p => `
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <span>${p.name || '—'}</span>
          <span style="color:var(--text-muted)">${p.position || ''}</span>
        </div>`).join('')}
      ${bench.length ? `
        <p style="font-size:0.58rem;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin:8px 0 4px">Suplentes</p>
        ${bench.map(p => `
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:2px 0;color:var(--text-secondary)">
            <span>${p.name || '—'}</span>
            <span style="color:var(--text-muted)">${p.position || ''}</span>
          </div>`).join('')}
      ` : ''}`;
  },

  _renderLineups(d) {
    if (!d.lineups || !d.lineups.length) {
      return `<p style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:0.75rem 0">Alineaciones no disponibles todavía para este partido.</p>`;
    }
    const homeLineup = d.lineups.find(l => l.team === d.home);
    const awayLineup = d.lineups.find(l => l.team === d.away);
    return `
      <div style="display:flex;gap:1rem">
        <div style="flex:1">${this._renderLineupTeam(homeLineup)}</div>
        <div style="flex:1">${this._renderLineupTeam(awayLineup)}</div>
      </div>`;
  },

  _phaseColor(d) {
    if (d.status === 'live') return '#ff4466';
    if (d.status === 'finished') return '#888';
    return 'var(--text-muted)';
  },

  _render(d) {
    const scoreShown = d.scoreHome != null && d.scoreAway != null;
    const tabsId = `md-tabs-${Date.now()}`;

    return `
      <div style="padding:0.25rem 0 0.5rem">
        <div style="text-align:center;margin-bottom:0.75rem">
          <p style="font-size:0.6rem;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">${d.venue || ''}</p>
          <div style="display:flex;align-items:center;justify-content:center;gap:0.9rem">
            <div style="flex:1;text-align:right;font-size:0.92rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.home} ${d.homeFlag}</div>
            <div style="font-size:1.5rem;font-weight:800;letter-spacing:2px;min-width:64px">${scoreShown ? `${d.scoreHome} - ${d.scoreAway}` : 'vs'}</div>
            <div style="flex:1;text-align:left;font-size:0.92rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.awayFlag} ${d.away}</div>
          </div>
          ${d.phase ? `<p style="margin-top:6px;font-size:0.7rem;font-weight:700;color:${this._phaseColor(d)}">${d.status === 'live' ? '🔴 ' : ''}${d.phase}</p>` : ''}
        </div>

        ${this._renderScorers(d)}
        ${this._renderSubs(d)}

        <div id="${tabsId}" style="margin-top:1rem">
          <div style="display:flex;gap:6px;margin-bottom:0.75rem">
            <button class="btn btn-sm md-tab-btn active" data-tab="stats" style="flex:1">Estadísticas</button>
            <button class="btn btn-sm md-tab-btn" data-tab="lineups" style="flex:1">Alineaciones</button>
          </div>
          <div class="md-tab-panel" data-panel="stats">${this._renderStats(d)}</div>
          <div class="md-tab-panel" data-panel="lineups" style="display:none">${this._renderLineups(d)}</div>
        </div>
      </div>`;
  },
};
