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

  async open(matchId, basicMatch = null, leagueHint = null) {
    if (!matchId) return;

    Modal.open(this._renderLoading(basicMatch));

    let detail = null;
    try {
      detail = await API.getMatchDetail(matchId, leagueHint || basicMatch?.league || null);
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
    boot: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4v6.2c0 .9-.32 1.76-.9 2.44L3.3 15.1a1.6 1.6 0 0 0-.3.94V18c0 .55.45 1 1 1h16a1 1 0 0 0 1-1v-1.6c0-.5-.24-.97-.65-1.26l-4.6-3.28A2 2 0 0 1 15 10.2V4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 15.5h4.5M20.5 18H3" stroke="currentColor" stroke-width="1.3"/></svg>`,
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
            <div class="md-team-name home">${basic.home || ''} ${basic.homeCrest ? `<img src="${basic.homeCrest}" alt="" referrerpolicy="no-referrer" style="width:18px;height:18px;object-fit:contain;vertical-align:-3px" onerror="this.remove()">` : ''}</div>
            <div class="md-score" style="font-size:1rem;letter-spacing:0">vs</div>
            <div class="md-team-name away">${basic.awayCrest ? `<img src="${basic.awayCrest}" alt="" referrerpolicy="no-referrer" style="width:18px;height:18px;object-fit:contain;vertical-align:-3px" onerror="this.remove()">` : ''} ${basic.away || ''}</div>
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

  // --- Normaliza un nombre para comparar (sin acentos, minúsculas) ---
  _normName(name) {
    return String(name || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  },

  // --- Compara dos nombres de jugador con tolerancia: exacto primero, y si
  // no matchea, por apellido (los eventos de ESPN a veces usan el nombre
  // completo y la alineación solo el nombre corto, o viceversa). ---
  _samePlayer(a, b) {
    const na = this._normName(a), nb = this._normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const la = na.split(/\s+/).pop(), lb = nb.split(/\s+/).pop();
    return la.length > 2 && la === lb;
  },

  // --- Junta goles/asistencias/tarjetas por jugador a partir de los goles
  // (d.scorers) y tarjetas (d.cards) que ya vienen parseados del backend.
  // Los autogoles no suman al contador de goles del jugador (serían un
  // "logro" engañoso mostrarlo con la pelotita), pero sí quedan
  // disponibles en stats.ownGoals por si se necesitan en el futuro. ---
  _buildPlayerStats(d) {
    const map = new Map();
    const bump = (name, field, delta = 1) => {
      const key = this._normName(name);
      if (!key) return;
      if (!map.has(key)) map.set(key, { name, goals: 0, assists: 0, ownGoals: 0, yellow: 0, red: 0 });
      map.get(key)[field] += delta;
    };
    (d.scorers || []).forEach(s => {
      if (s.ownGoal) bump(s.player, 'ownGoals');
      else bump(s.player, 'goals');
      if (s.assist) bump(s.assist, 'assists');
    });
    (d.cards || []).forEach(c => bump(c.player, c.red ? 'red' : 'yellow'));
    return map;
  },

  _lookupStats(map, playerName) {
    const key = this._normName(playerName);
    if (map.has(key)) return map.get(key);
    for (const v of map.values()) {
      if (this._samePlayer(v.name, playerName)) return v;
    }
    return null;
  },

  // --- Estimación de nota 1-10 por partido a partir de los eventos
  // disponibles (goles, asistencias, tarjetas). ESPN no expone una nota
  // oficial en este endpoint, así que es un cálculo propio y aproximado,
  // no la "media" real que daría un medio especializado. Arranca en una
  // base neutral y suma/resta según lo que el jugador aportó. ---
  _estimateRating(stats, isGK) {
    let r = 6.5;
    if (stats) {
      r += (stats.goals || 0) * (isGK ? 1.5 : 1.0);
      r += (stats.assists || 0) * 0.6;
      r -= (stats.ownGoals || 0) * 1.2;
      r -= (stats.yellow || 0) * 0.7;
      r -= (stats.red || 0) * 2.5;
    }
    return Math.max(1, Math.min(10, r));
  },

  // --- Pelotita(s) de gol / bota(s) de asistencia que se pintan junto al
  // punto del jugador en la cancha o su fila en el banco. Con 2+ goles se
  // agrega el número al lado del ícono (doblete, triplete...). ---
  _achievementBadges(stats) {
    if (!stats) return '';
    const goals = stats.goals || 0;
    const assists = stats.assists || 0;
    const goalBadge = goals > 0
      ? `<span class="md-badge md-badge-goal" title="${goals} gol${goals > 1 ? 'es' : ''}">${this._ICONS.ball}${goals > 1 ? `<b>${goals}</b>` : ''}</span>`
      : '';
    const assistBadge = assists > 0
      ? `<span class="md-badge md-badge-assist" title="${assists} asistencia${assists > 1 ? 's' : ''}">${this._ICONS.boot}${assists > 1 ? `<b>${assists}</b>` : ''}</span>`
      : '';
    return `${goalBadge}${assistBadge}`;
  },

  _ratingClass(rating) {
    if (rating >= 8) return 'md-rating-great';
    if (rating >= 6.5) return 'md-rating-good';
    if (rating >= 5) return 'md-rating-avg';
    return 'md-rating-low';
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
      .map((p, i) => ({
        p,
        i,
        // A veces ESPN da un código genérico para todos los mediocampistas
        // (ej. "M" tanto para el pivote como para el extremo), y ahí la
        // profundidad por sí sola empata. Como desempate se usa la banda:
        // a igual categoría, un jugador de banda (L../R..) se asume más
        // ofensivo que uno central, porque en la práctica el doble pivote
        // casi siempre es central y los extremos casi siempre juegan por
        // banda. El +0.5 es menor al salto entre categorías reales (1 en
        // _POS_DEPTH), así que nunca reordena posiciones ya bien
        // diferenciadas (ej. un CB nunca se mezcla con un CDM por esto).
        depth: this._posDepth(p.position) + (this._posSide(p.position) !== 0 ? 0.5 : 0)
      }))
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

  _playerDot(p, statsMap) {
    const jersey = p.jersey ? p.jersey : '';
    const stats = this._lookupStats(statsMap, p.name);
    const rating = this._estimateRating(stats, this._isGK(p.position));
    return `
      <div class="md-player">
        <div class="md-player-dot-wrap">
          <div class="md-player-dot">${jersey}</div>
          <span class="md-player-rating ${this._ratingClass(rating)}">${rating.toFixed(1)}</span>
          ${this._achievementBadges(stats)}
        </div>
        <div class="md-player-name">${this._shortName(p.name)}</div>
      </div>`;
  },

  _pitchHalf(lineup, side, statsMap) {
    const built = this._formationLines(lineup);
    if (!built) {
      return `<div class="md-pitch-half ${side}"><div class="md-pitch-empty">Alineación no disponible</div></div>`;
    }
    const gkRow = `<div class="md-pitch-line">${this._playerDot(built.gk, statsMap)}</div>`;
    const lineRows = built.lines.map(line => `
        <div class="md-pitch-line">${line.map(p => this._playerDot(p, statsMap)).join('')}</div>`);

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

    const statsMap = this._buildPlayerStats(d);

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
          ${this._pitchHalf(awayLineup, 'away', statsMap)}
          ${this._pitchHalf(homeLineup, 'home', statsMap)}
        </div>
      </div>`;
  },

  _renderBenchTeam(l, statsMap) {
    const bench = (l && l.bench) || [];
    if (!bench.length) return `<span class="md-empty-inline">Sin datos</span>`;
    return bench.map(p => {
      const stats = this._lookupStats(statsMap, p.name);
      // Solo se muestra nota a los suplentes que sí entraron a jugar; el
      // resto del banco no tuvo minutos en cancha, así que no aplica.
      const rating = p.subbedIn ? this._estimateRating(stats, this._isGK(p.position)) : null;
      return `
      <div class="md-bench-player${p.subbedIn ? ' subbed-in' : ''}">
        <span class="num">${p.jersey || ''}</span>
        <span class="nm">${p.name || '—'}</span>
        <span class="md-bench-badges">${this._achievementBadges(stats)}</span>
        ${rating != null ? `<span class="md-player-rating md-bench-rating ${this._ratingClass(rating)}">${rating.toFixed(1)}</span>` : ''}
        <span class="pos">${p.position || ''}</span>
      </div>`;
    }).join('');
  },

  _renderLineups(d) {
    if (!d.lineups || !d.lineups.length) {
      return `<div class="md-empty">Alineaciones no disponibles todavía para este partido.</div>`;
    }
    const homeLineup = d.lineups.find(l => l.team === d.home) || null;
    const awayLineup = d.lineups.find(l => l.team === d.away) || null;
    const statsMap = this._buildPlayerStats(d);

    return `
      ${this._renderPitch(d)}
      <div class="md-card">
        <p class="md-card-title">Suplentes</p>
        <div class="md-bench-grid">
          <div class="md-bench-col">${this._renderBenchTeam(homeLineup, statsMap)}</div>
          <div class="md-bench-col">${this._renderBenchTeam(awayLineup, statsMap)}</div>
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
          <p class="md-venue">${d.competition || ''}${d.venue ? ' · '+d.venue : ''}</p>
          <div class="md-score-row">
            <div class="md-team-name home">${d.home} ${d.homeCrest ? `<img src="${d.homeCrest}" alt="" referrerpolicy="no-referrer" style="width:18px;height:18px;object-fit:contain;vertical-align:-3px" onerror="this.remove()">` : ''}</div>
            <div class="md-score">${scoreShown ? `${d.scoreHome} - ${d.scoreAway}` : 'vs'}</div>
            <div class="md-team-name away">${d.awayCrest ? `<img src="${d.awayCrest}" alt="" referrerpolicy="no-referrer" style="width:18px;height:18px;object-fit:contain;vertical-align:-3px" onerror="this.remove()">` : ''} ${d.away}</div>
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
