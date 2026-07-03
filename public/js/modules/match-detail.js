// match-detail.js
// --------------------------------------------------
// Ficha rápida de un partido (en vivo o finalizado): marcador con la fase
// correcta (descanso, prórroga, penales), goleadores, alineación inicial +
// cambios (cancha táctica dibujada según la formación real), y estadísticas
// rápidas por equipo (posesión, tiros, duelos, etc. según lo que entregue
// ESPN para ese partido en particular).
//
// Solo se muestran datos ya parseados (nombre, minuto, posición...), nunca
// la prosa editorial completa que entrega ESPN en sus keyEvents.
//
// Se abre al tocar cualquier partido en vivo o finalizado en el dashboard
// (ver dashboard.js). Usa el Modal genérico que ya existe (toast.js).

const MatchDetail = {

  async open(matchId, basicMatch = null) {
    if (!matchId) return;

    Modal.open(this._renderLoading(basicMatch));

    let detail = null;
    try {
      detail = await API.getMatchDetail(matchId);
    } catch (err) {
      console.error('[MatchDetail] falló al cargar', matchId, err);
    }

    if (!detail) {
      Modal.open(`
        <div class="md-empty">No se pudo cargar el detalle de este partido. Intenta de nuevo en un momento.</div>`);
      return;
    }

    Modal.open(this._render(detail));
    this._bindTabs();
  },

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

  _ICONS: {
    ball: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 7.2z" fill="currentColor"/><path d="M12 3v4.2M4.6 8.4l3.8 1.4M4.9 16l3.7-2M19.4 8.4l-3.8 1.4M19.1 16l-3.7-2M12 21v-4.8" stroke="currentColor" stroke-width="1.2"/></svg>`,
    sub: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 4v11M7 4L3.5 7.5M7 4l3.5 3.5" stroke="#44ff88" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 20V9M17 20l3.5-3.5M17 20l-3.5-3.5" stroke="#ff4466" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  _renderLoading(basic) {
    if (!basic) {
      return `<div class="md-empty">Cargando ficha del partido…</div>`;
    }
    return `
      <div class="md-wrap">
        <div class="md-header">
          <p class="md-venue">${basic.competition || ''}</p>
          <div class="md-score-row">
            <div class="md-team-name home">${basic.home || ''} ${basic.homeFlag || ''}</div>
            <div class="md-score" style="font-size:1rem;letter-spacing:0">vs</div>
            <div class="md-team-name away">${basic.awayFlag || ''} ${basic.away || ''}</div>
          </div>
        </div>
        <p class="md-empty" style="padding-top:0.5rem">Cargando estadísticas y alineaciones…</p>
      </div>`;
  },

  // --- Traducción de nombres de estadísticas que ESPN entrega en inglés ---
  _STAT_LABELS: [
    [/^possession/i,                 'Posesión'],
    [/^fouls?( committed)?$/i,       'Faltas'],
    [/^yellow cards?$/i,             'Tarjetas amarillas'],
    [/^red cards?$/i,                'Tarjetas rojas'],
    [/^offsides?$/i,                 'Fuera de juego'],
    [/^corner kicks?$/i,             'Tiros de esquina'],
    [/^saves?$/i,                    'Atajadas'],
    [/^shots on target$/i,           'Tiros al arco'],
    [/^shots on goal$/i,             'Tiros al arco'],
    [/^on goal$/i,                   'Tiros al arco'],
    [/^off target$/i,                'Tiros desviados'],
    [/^effective (goal )?attempts$/i,'Tiros efectivos'],
    [/^possession %$/i,              'Posesión'],
    [/^total shots?$/i,              'Tiros totales'],
    [/^shots?$/i,                    'Tiros'],
    [/^blocked shots?$/i,            'Tiros bloqueados'],
    [/^shot accuracy$/i,             'Precisión de tiro'],
    [/^passes?$/i,                   'Pases'],
    [/^pass(ing)? accuracy$/i,       'Precisión de pase'],
    [/^total passes?$/i,             'Pases totales'],
    [/^completed passes?$/i,         'Pases completados'],
    [/^crosses?$/i,                  'Centros'],
    [/^tackles?$/i,                  'Entradas'],
    [/^duels? won$/i,                'Duelos ganados'],
    [/^aerials? won$/i,              'Duelos aéreos ganados'],
    [/^clearances?$/i,               'Despejes'],
    [/^interceptions?$/i,            'Intercepciones'],
    [/^goal kicks?$/i,               'Saques de meta'],
    [/^throw ins?$/i,                'Saques de banda'],
  ],

  _translateStat(label) {
    const raw = String(label || '').trim();
    for (const [re, es] of this._STAT_LABELS) {
      if (re.test(raw)) return es;
    }
    return raw;
  },

  _statBar(label, homeVal, awayVal) {
    const hNum = parseFloat(String(homeVal).replace('%', '')) || 0;
    const aNum = parseFloat(String(awayVal).replace('%', '')) || 0;
    const total = hNum + aNum;
    const hPct = total > 0 ? (hNum / total) * 100 : 50;
    return `
      <div class="md-stat-row">
        <div class="md-stat-values">
          <span>${homeVal ?? '—'}</span>
          <span class="md-stat-label">${this._translateStat(label)}</span>
          <span>${awayVal ?? '—'}</span>
        </div>
        <div class="md-stat-track">
          <div class="md-stat-fill-home" style="width:${hPct}%"></div>
          <div class="md-stat-fill-away" style="width:${100 - hPct}%"></div>
        </div>
      </div>`;
  },

  _renderStats(d) {
    if (!d.statistics || d.statistics.length < 2) {
      return `<div class="md-empty">Estadísticas no disponibles todavía para este partido.</div>`;
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
      return `<div class="md-empty">Estadísticas no disponibles todavía para este partido.</div>`;
    }

    const byName = (list, name) => list.find(s => s.name === name)?.value ?? null;

    const rows = names.map(name => {
      const h = byName(homeStats, name);
      const a = byName(awayStats, name);
      const label = homeStats.find(s => s.name === name)?.displayName
        || awayStats.find(s => s.name === name)?.displayName
        || name;
      return this._statBar(label, h, a);
    }).join('');

    return `<div class="md-card">${rows}</div>`;
  },

  _renderScorers(d) {
    if (!d.scorers || !d.scorers.length) return '';
    const line = s => {
      const tag = s.ownGoal ? ' (autogol)' : s.penalty ? ' (penal)' : '';
      return `
        <div class="md-goal-line">
          <span class="md-icon md-icon-ball">${this._ICONS.ball}</span>
          <span class="md-goal-player">${s.player || 'Jugador'}</span>
          <span class="md-goal-meta">${s.clock || ''}${tag}</span>
        </div>`;
    };
    const home = d.scorers.filter(s => s.team === d.home);
    const away = d.scorers.filter(s => s.team === d.away);
    return `
      <div class="md-card">
        <div class="md-goals-cols">
          <div class="md-goals-col home">${home.map(line).join('') || '<span class="md-empty-inline">Sin goles</span>'}</div>
          <div class="md-goals-col away">${away.map(line).join('') || '<span class="md-empty-inline">Sin goles</span>'}</div>
        </div>
      </div>`;
  },

  _renderSubs(d) {
    if (!d.substitutions || !d.substitutions.length) return '';
    const line = s => {
      const inName = s.playerIn || 'Jugador';
      return `
        <div class="md-sub-line">
          <span class="md-icon md-icon-sub">${this._ICONS.sub}</span>
          <span class="md-sub-players">
            <span class="md-sub-in">${inName}</span>
            ${s.playerOut ? `<span class="md-sub-out">por ${s.playerOut}</span>` : ''}
          </span>
          <span class="md-sub-meta">${s.clock || ''}</span>
        </div>`;
    };
    const home = d.substitutions.filter(s => s.team === d.home);
    const away = d.substitutions.filter(s => s.team === d.away);
    if (!home.length && !away.length) return '';
    return `
      <div class="md-card">
        <p class="md-card-title">Cambios</p>
        <div class="md-subs-cols">
          <div class="md-subs-col home">${home.map(line).join('') || ''}</div>
          <div class="md-subs-col away">${away.map(line).join('') || ''}</div>
        </div>
      </div>`;
  },

  // --- Nombre corto para que quepa bajo el punto del jugador en la cancha ---
  _shortName(name) {
    const n = String(name || '').trim();
    if (!n) return '—';
    const parts = n.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : n;
  },

  _isGK(pos) {
    return /^(G|GK)$/i.test(pos || '');
  },

  // --- Prioridad táctica de profundidad (defensa -> ataque) según el
  // código de posición que manda ESPN (p.position, ej. "LB", "CDM", "RW",
  // "ST"). Se usa SOLO para ordenar a los titulares antes de repartirlos
  // en líneas; no toca el sistema de render de la cancha. Si la posición
  // no matchea ninguna entrada conocida, se asume centrocampista (valor
  // intermedio) para no romper el reparto por formación. ---
  _POS_DEPTH: [
    [/^(LWB|RWB|LB|RB|LCB|RCB|CB|SW|D)$/i, 1],
    [/^(LDM|RDM|CDM|DM)$/i, 2],
    [/^(LCM|RCM|CM|M)$/i, 3],
    [/^(LM|RM|WM)$/i, 4],
    [/^(LAM|RAM|CAM|AM)$/i, 5],
    [/^(LW|RW|W)$/i, 6],
    [/^(LF|RF|CF|SS|ST|FW|F)$/i, 7]
  ],

  _posDepth(pos) {
    const p = String(pos || '').trim().toUpperCase();
    for (const [re, depth] of this._POS_DEPTH) {
      if (re.test(p)) return depth;
    }
    return 3;
  },

  // --- Banda horizontal (izquierda/centro/derecha) a partir del código de
  // posición: si empieza con "L" va a la izquierda, con "R" a la derecha,
  // cualquier otra cosa (CB, CM, ST, GK, D, M, F...) queda al centro. ---
  _posSide(pos) {
    const p = String(pos || '').trim().toUpperCase();
    if (/^L/.test(p)) return -1;
    if (/^R/.test(p)) return 1;
    return 0;
  },

  // --- A partir de la formación ("4-3-3") y los titulares, arma las líneas
  // tácticas (defensa, medio, ataque) para dibujar la cancha. Si la
  // formación no coincide con el número de titulares (dato incompleto de
  // ESPN), cae a un reparto en filas parejas para no romper el render.
  // Antes de repartir, los titulares se ordenan por profundidad táctica
  // real (posición ESPN), no por el orden crudo del roster: así el 4-3-3,
  // 4-4-2, 4-2-3-1, 3-5-2, etc. arman líneas correctas (defensa/medio/
  // ataque) sin importar el orden en que ESPN entregue el roster. Ya
  // repartidos, cada línea se reordena de izquierda a derecha según la
  // banda de cada posición, así los extremos no salen invertidos y el 9
  // queda al centro en vez de en banda. ---
  _formationLines(lineup) {
    const starters = (lineup && lineup.starters) || [];
    if (!starters.length) return null;

    const gkIndex = starters.findIndex(p => this._isGK(p.position));
    const gk = gkIndex >= 0 ? starters[gkIndex] : starters[0];
    const restRaw = starters.filter((_, i) => i !== (gkIndex >= 0 ? gkIndex : 0));

    const rest = restRaw
      .map((p, i) => ({ p, i, depth: this._posDepth(p.position) }))
      .sort((a, b) => a.depth - b.depth || a.i - b.i)
      .map(x => x.p);

    const parsed = String(lineup.formation || '')
      .split(/[-\s]+/)
      .map(n => parseInt(n, 10))
      .filter(n => Number.isFinite(n) && n > 0);

    let lines;
    if (parsed.length && parsed.reduce((a, b) => a + b, 0) === rest.length) {
      lines = [];
      let idx = 0;
      for (const n of parsed) {
        lines.push(rest.slice(idx, idx + n));
        idx += n;
      }
    } else if (rest.length) {
      // Reparto de respaldo en filas parejas si la formación no calza.
      const rows = rest.length > 8 ? 4 : 3;
      const perRow = Math.ceil(rest.length / rows);
      lines = [];
      for (let i = 0; i < rest.length; i += perRow) lines.push(rest.slice(i, i + perRow));
    } else {
      lines = [];
    }

    lines = lines.map(line =>
      line.slice().sort((a, b) => this._posSide(a.position) - this._posSide(b.position))
    );

    return { gk, lines };
  },

  _playerDot(p) {
    const jersey = p.jersey ? p.jersey : '';
    return `
      <div class="md-player">
        <div class="md-player-dot">${jersey}</div>
        <div class="md-player-name">${this._shortName(p.name)}</div>
      </div>`;
  },

  _pitchHalf(lineup, side) {
    const built = this._formationLines(lineup);
    if (!built) {
      return `<div class="md-pitch-half ${side}"><div class="md-pitch-empty">Alineación no disponible</div></div>`;
    }
    const gkRow = `<div class="md-pitch-line">${this._playerDot(built.gk)}</div>`;
    const lineRows = built.lines.map(line => `
        <div class="md-pitch-line">${line.map(p => this._playerDot(p)).join('')}</div>`);

    // El arquero siempre va pegado al borde propio de la cancha (su arco),
    // nunca cerca del medio campo. El resto de líneas van de defensa a
    // ataque acercándose al medio campo.
    const orderedRows = side === 'away'
      ? [gkRow, ...lineRows]                       // borde superior -> centro: arquero, defensa, medio, ataque
      : [...lineRows.slice().reverse(), gkRow];     // centro -> borde inferior: ataque, medio, defensa, arquero

    return `<div class="md-pitch-half ${side}">${orderedRows.join('')}</div>`;
  },

  _renderPitch(d) {
    if (!d.lineups || !d.lineups.length) {
      return `<div class="md-empty">Alineaciones no disponibles todavía para este partido.</div>`;
    }
    const homeLineup = d.lineups.find(l => l.team === d.home) || null;
    const awayLineup = d.lineups.find(l => l.team === d.away) || null;

    if ((!homeLineup || !homeLineup.starters?.length) && (!awayLineup || !awayLineup.starters?.length)) {
      return `<div class="md-empty">Alineaciones no disponibles todavía para este partido.</div>`;
    }

    return `
      <div class="md-pitch-outer">
        <div class="md-pitch-teams">
          <div class="md-pitch-team-label home">${d.home || ''}${homeLineup?.formation ? `<span class="fm">${homeLineup.formation}</span>` : ''}</div>
          <div class="md-pitch-team-label away">${d.away || ''}${awayLineup?.formation ? `<span class="fm">${awayLineup.formation}</span>` : ''}</div>
        </div>
        <div class="md-pitch">
          <div class="md-pitch-border"></div>
          <div class="md-pitch-box top"></div>
          <div class="md-pitch-box bottom"></div>
          ${this._pitchHalf(awayLineup, 'away')}
          ${this._pitchHalf(homeLineup, 'home')}
        </div>
      </div>`;
  },

  _renderBenchTeam(l) {
    const bench = (l && l.bench) || [];
    if (!bench.length) return `<span class="md-empty-inline">Sin datos</span>`;
    return bench.map(p => `
      <div class="md-bench-player${p.subbedIn ? ' subbed-in' : ''}">
        <span class="num">${p.jersey || ''}</span>
        <span class="nm">${p.name || '—'}</span>
        <span class="pos">${p.position || ''}</span>
      </div>`).join('');
  },

  _renderLineups(d) {
    if (!d.lineups || !d.lineups.length) {
      return `<div class="md-empty">Alineaciones no disponibles todavía para este partido.</div>`;
    }
    const homeLineup = d.lineups.find(l => l.team === d.home) || null;
    const awayLineup = d.lineups.find(l => l.team === d.away) || null;

    return `
      ${this._renderPitch(d)}
      <div class="md-card">
        <p class="md-card-title">Suplentes</p>
        <div class="md-bench-grid">
          <div class="md-bench-col">${this._renderBenchTeam(homeLineup)}</div>
          <div class="md-bench-col">${this._renderBenchTeam(awayLineup)}</div>
        </div>
      </div>`;
  },

  _phaseColor(d) {
    if (d.status === 'live') return '#ff4466';
    if (d.status === 'finished') return 'var(--text-secondary)';
    return 'var(--text-muted)';
  },

  _render(d) {
    const scoreShown = d.scoreHome != null && d.scoreAway != null;

    return `
      <div class="md-wrap">
        <div class="md-header">
          <p class="md-venue">${d.venue || ''}</p>
          <div class="md-score-row">
            <div class="md-team-name home">${d.home} ${d.homeFlag}</div>
            <div class="md-score">${scoreShown ? `${d.scoreHome} - ${d.scoreAway}` : 'vs'}</div>
            <div class="md-team-name away">${d.awayFlag} ${d.away}</div>
          </div>
          ${d.phase ? `<p class="md-phase" style="color:${this._phaseColor(d)}">${d.status === 'live' ? '🔴 ' : ''}${d.phase}</p>` : ''}
        </div>

        ${this._renderScorers(d)}
        ${this._renderSubs(d)}

        <div class="md-tabs">
          <button class="btn btn-sm md-tab-btn active" data-tab="stats">Estadísticas</button>
          <button class="btn btn-sm md-tab-btn" data-tab="lineups">Alineaciones</button>
        </div>
        <div class="md-tab-panel" data-panel="stats">${this._renderStats(d)}</div>
        <div class="md-tab-panel" data-panel="lineups" style="display:none">${this._renderLineups(d)}</div>
      </div>`;
  },
};
