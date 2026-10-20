// Planteles de referencia de los clubes grandes que sigue la app (La Liga y
// Premier League). Se usan como base para la pestaña "Jugadores" y se
// combinan con lo que traiga la API cuando esté disponible. Los valores de
// goles/asistencias/partidos son de referencia (temporada anterior) y se
// actualizan con datos reales cuando la API los provee.
const ALL_PLAYERS = [
  // --- Real Madrid ---
  {id:'cp001', name:'Thibaut Courtois',    team:'Real Madrid', pos:'POR', goals:0, assists:0, caps:38, rating:88},
  {id:'cp002', name:'Dani Carvajal',       team:'Real Madrid', pos:'DEF', goals:1, assists:4,  caps:30, rating:84},
  {id:'cp003', name:'Antonio Rüdiger',     team:'Real Madrid', pos:'DEF', goals:3, assists:1,  caps:34, rating:86},
  {id:'cp004', name:'Eder Militão',        team:'Real Madrid', pos:'DEF', goals:1, assists:0,  caps:20, rating:84},
  {id:'cp005', name:'Ferland Mendy',       team:'Real Madrid', pos:'DEF', goals:0, assists:3,  caps:26, rating:82},
  {id:'cp006', name:'Aurélien Tchouaméni', team:'Real Madrid', pos:'MED', goals:2, assists:2,  caps:36, rating:85},
  {id:'cp007', name:'Federico Valverde',   team:'Real Madrid', pos:'MED', goals:6, assists:8,  caps:40, rating:88},
  {id:'cp008', name:'Jude Bellingham',     team:'Real Madrid', pos:'MED', goals:19,assists:6,  caps:33, rating:91},
  {id:'cp009', name:'Vinícius Jr.',        team:'Real Madrid', pos:'DEL', goals:24,assists:11, caps:35, rating:91},
  {id:'cp010', name:'Kylian Mbappé',       team:'Real Madrid', pos:'DEL', goals:31,assists:7,  caps:36, rating:92},
  {id:'cp011', name:'Rodrygo',             team:'Real Madrid', pos:'DEL', goals:14,assists:9,  caps:38, rating:85},

  // --- FC Barcelona ---
  {id:'cp012', name:'Marc-André ter Stegen', team:'Barcelona', pos:'POR', goals:0, assists:0,  caps:20, rating:85},
  {id:'cp013', name:'Jules Koundé',        team:'Barcelona',   pos:'DEF', goals:2, assists:5,  caps:36, rating:85},
  {id:'cp014', name:'Pau Cubarsí',         team:'Barcelona',   pos:'DEF', goals:0, assists:1,  caps:34, rating:83},
  {id:'cp015', name:'Iñigo Martínez',      team:'Barcelona',   pos:'DEF', goals:2, assists:0,  caps:28, rating:82},
  {id:'cp016', name:'Alejandro Balde',     team:'Barcelona',   pos:'DEF', goals:1, assists:6,  caps:30, rating:83},
  {id:'cp017', name:'Pedri',               team:'Barcelona',   pos:'MED', goals:8, assists:8,  caps:34, rating:88},
  {id:'cp018', name:'Gavi',                team:'Barcelona',   pos:'MED', goals:3, assists:4,  caps:24, rating:85},
  {id:'cp019', name:'Frenkie de Jong',     team:'Barcelona',   pos:'MED', goals:2, assists:5,  caps:27, rating:85},
  {id:'cp020', name:'Raphinha',            team:'Barcelona',   pos:'DEL', goals:27,assists:14, caps:41, rating:89},
  {id:'cp021', name:'Robert Lewandowski',  team:'Barcelona',   pos:'DEL', goals:26,assists:6,  caps:35, rating:87},
  {id:'cp022', name:'Lamine Yamal',        team:'Barcelona',   pos:'DEL', goals:9, assists:13, caps:38, rating:89},

  // --- Atlético de Madrid ---
  {id:'cp023', name:'Jan Oblak',           team:'Atlético de Madrid', pos:'POR', goals:0, assists:0, caps:36, rating:86},
  {id:'cp024', name:'Nahuel Molina',       team:'Atlético de Madrid', pos:'DEF', goals:1, assists:5, caps:32, rating:81},
  {id:'cp025', name:'José María Giménez',  team:'Atlético de Madrid', pos:'DEF', goals:2, assists:1, caps:26, rating:82},
  {id:'cp026', name:'Clément Lenglet',     team:'Atlético de Madrid', pos:'DEF', goals:1, assists:0, caps:24, rating:80},
  {id:'cp027', name:'Marcos Llorente',     team:'Atlético de Madrid', pos:'MED', goals:8, assists:4, caps:37, rating:83},
  {id:'cp028', name:'Koke',                team:'Atlético de Madrid', pos:'MED', goals:2, assists:5, caps:33, rating:82},
  {id:'cp029', name:'Rodrigo De Paul',     team:'Atlético de Madrid', pos:'MED', goals:3, assists:6, caps:36, rating:83},
  {id:'cp030', name:'Antoine Griezmann',   team:'Atlético de Madrid', pos:'DEL', goals:19,assists:11,caps:40, rating:86},
  {id:'cp031', name:'Julián Álvarez',      team:'Atlético de Madrid', pos:'DEL', goals:20,assists:9, caps:39, rating:87},

  // --- Manchester City ---
  {id:'cp032', name:'Ederson',             team:'Manchester City', pos:'POR', goals:0, assists:1, caps:34, rating:85},
  {id:'cp033', name:'Kyle Walker',         team:'Manchester City', pos:'DEF', goals:0, assists:2, caps:30, rating:81},
  {id:'cp034', name:'Rúben Dias',          team:'Manchester City', pos:'DEF', goals:2, assists:1, caps:32, rating:87},
  {id:'cp035', name:'Joško Gvardiol',      team:'Manchester City', pos:'DEF', goals:4, assists:3, caps:35, rating:85},
  {id:'cp036', name:'Nathan Aké',          team:'Manchester City', pos:'DEF', goals:1, assists:0, caps:26, rating:82},
  {id:'cp037', name:'Rodri',               team:'Manchester City', pos:'MED', goals:8, assists:9, caps:34, rating:90},
  {id:'cp038', name:'Kevin De Bruyne',     team:'Manchester City', pos:'MED', goals:5, assists:10,caps:28, rating:87},
  {id:'cp039', name:'Bernardo Silva',      team:'Manchester City', pos:'MED', goals:6, assists:7, caps:38, rating:86},
  {id:'cp040', name:'Phil Foden',          team:'Manchester City', pos:'DEL', goals:19,assists:8, caps:40, rating:87},
  {id:'cp041', name:'Erling Haaland',      team:'Manchester City', pos:'DEL', goals:38,assists:6, caps:36, rating:91},
  {id:'cp042', name:'Jack Grealish',       team:'Manchester City', pos:'DEL', goals:5, assists:9, caps:33, rating:81},

  // --- Liverpool ---
  {id:'cp043', name:'Alisson Becker',      team:'Liverpool', pos:'POR', goals:0, assists:1, caps:33, rating:88},
  {id:'cp044', name:'Trent Alexander-Arnold', team:'Liverpool', pos:'DEF', goals:3, assists:12,caps:35, rating:86},
  {id:'cp045', name:'Virgil van Dijk',     team:'Liverpool', pos:'DEF', goals:3, assists:1, caps:36, rating:88},
  {id:'cp046', name:'Ibrahima Konaté',     team:'Liverpool', pos:'DEF', goals:1, assists:0, caps:28, rating:83},
  {id:'cp047', name:'Andrew Robertson',    team:'Liverpool', pos:'DEF', goals:0, assists:5, caps:32, rating:82},
  {id:'cp048', name:'Alexis Mac Allister', team:'Liverpool', pos:'MED', goals:6, assists:5, caps:37, rating:84},
  {id:'cp049', name:'Dominik Szoboszlai',  team:'Liverpool', pos:'MED', goals:7, assists:6, caps:38, rating:84},
  {id:'cp050', name:'Mohamed Salah',       team:'Liverpool', pos:'DEL', goals:29,assists:18,caps:38, rating:90},
  {id:'cp051', name:'Luis Díaz',           team:'Liverpool', pos:'DEL', goals:13,assists:7, caps:37, rating:85},
  {id:'cp052', name:'Darwin Núñez',        team:'Liverpool', pos:'DEL', goals:11,assists:5, caps:35, rating:82},
  {id:'cp053', name:'Cody Gakpo',          team:'Liverpool', pos:'DEL', goals:9, assists:5, caps:36, rating:83},

  // --- Manchester United ---
  {id:'cp054', name:'André Onana',         team:'Manchester United', pos:'POR', goals:0, assists:0, caps:34, rating:81},
  {id:'cp055', name:'Diogo Dalot',         team:'Manchester United', pos:'DEF', goals:1, assists:3, caps:32, rating:80},
  {id:'cp056', name:'Lisandro Martínez',   team:'Manchester United', pos:'DEF', goals:1, assists:0, caps:22, rating:83},
  {id:'cp057', name:'Noussair Mazraoui',   team:'Manchester United', pos:'DEF', goals:1, assists:2, caps:28, rating:80},
  {id:'cp058', name:'Luke Shaw',           team:'Manchester United', pos:'DEF', goals:0, assists:2, caps:18, rating:81},
  {id:'cp059', name:'Casemiro',            team:'Manchester United', pos:'MED', goals:3, assists:1, caps:29, rating:81},
  {id:'cp060', name:'Bruno Fernandes',     team:'Manchester United', pos:'MED', goals:11,assists:9, caps:38, rating:86},
  {id:'cp061', name:'Kobbie Mainoo',       team:'Manchester United', pos:'MED', goals:2, assists:2, caps:30, rating:80},
  {id:'cp062', name:'Marcus Rashford',     team:'Manchester United', pos:'DEL', goals:8, assists:5, caps:32, rating:81},
  {id:'cp063', name:'Alejandro Garnacho',  team:'Manchester United', pos:'DEL', goals:9, assists:4, caps:35, rating:80},
  {id:'cp064', name:'Rasmus Højlund',      team:'Manchester United', pos:'DEL', goals:10,assists:2, caps:32, rating:79},

  // --- Chelsea ---
  {id:'cp065', name:'Robert Sánchez',      team:'Chelsea', pos:'POR', goals:0, assists:0, caps:26, rating:78},
  {id:'cp066', name:'Reece James',         team:'Chelsea', pos:'DEF', goals:1, assists:4, caps:20, rating:81},
  {id:'cp067', name:'Levi Colwill',        team:'Chelsea', pos:'DEF', goals:1, assists:1, caps:30, rating:80},
  {id:'cp068', name:'Wesley Fofana',       team:'Chelsea', pos:'DEF', goals:1, assists:0, caps:22, rating:79},
  {id:'cp069', name:'Moisés Caicedo',      team:'Chelsea', pos:'MED', goals:2, assists:2, caps:35, rating:83},
  {id:'cp070', name:'Enzo Fernández',      team:'Chelsea', pos:'MED', goals:4, assists:6, caps:37, rating:83},
  {id:'cp071', name:'Cole Palmer',         team:'Chelsea', pos:'DEL', goals:22,assists:11,caps:36, rating:86},
  {id:'cp072', name:'Nicolas Jackson',     team:'Chelsea', pos:'DEL', goals:14,assists:5, caps:33, rating:80},

  // --- Arsenal ---
  {id:'cp073', name:'David Raya',          team:'Arsenal', pos:'POR', goals:0, assists:0, caps:38, rating:84},
  {id:'cp074', name:'Ben White',           team:'Arsenal', pos:'DEF', goals:2, assists:4, caps:34, rating:82},
  {id:'cp075', name:'William Saliba',      team:'Arsenal', pos:'DEF', goals:2, assists:0, caps:36, rating:87},
  {id:'cp076', name:'Gabriel Magalhães',   team:'Arsenal', pos:'DEF', goals:5, assists:1, caps:33, rating:85},
  {id:'cp077', name:'Jurriën Timber',      team:'Arsenal', pos:'DEF', goals:1, assists:3, caps:28, rating:81},
  {id:'cp078', name:'Declan Rice',         team:'Arsenal', pos:'MED', goals:5, assists:8, caps:38, rating:86},
  {id:'cp079', name:'Martin Ødegaard',     team:'Arsenal', pos:'MED', goals:7, assists:9, caps:32, rating:86},
  {id:'cp080', name:'Bukayo Saka',         team:'Arsenal', pos:'DEL', goals:16,assists:9, caps:35, rating:87},
  {id:'cp081', name:'Gabriel Jesus',       team:'Arsenal', pos:'DEL', goals:8, assists:4, caps:28, rating:80},
  {id:'cp082', name:'Kai Havertz',         team:'Arsenal', pos:'DEL', goals:13,assists:4, caps:35, rating:83},

  // --- Tottenham Hotspur ---
  {id:'cp083', name:'Guglielmo Vicario',   team:'Tottenham Hotspur', pos:'POR', goals:0, assists:0, caps:36, rating:82},
  {id:'cp084', name:'Pedro Porro',         team:'Tottenham Hotspur', pos:'DEF', goals:3, assists:8, caps:36, rating:82},
  {id:'cp085', name:'Cristian Romero',     team:'Tottenham Hotspur', pos:'DEF', goals:3, assists:1, caps:30, rating:83},
  {id:'cp086', name:'Micky van de Ven',    team:'Tottenham Hotspur', pos:'DEF', goals:1, assists:1, caps:29, rating:81},
  {id:'cp087', name:'Yves Bissouma',       team:'Tottenham Hotspur', pos:'MED', goals:1, assists:1, caps:30, rating:80},
  {id:'cp088', name:'James Maddison',      team:'Tottenham Hotspur', pos:'MED', goals:5, assists:8, caps:26, rating:82},
  {id:'cp089', name:'Son Heung-min',       team:'Tottenham Hotspur', pos:'DEL', goals:17,assists:9, caps:35, rating:85},
  {id:'cp090', name:'Dejan Kulusevski',    team:'Tottenham Hotspur', pos:'DEL', goals:8, assists:6, caps:32, rating:81},

  // --- Athletic Club (Champions) ---
  {id:'cp091', name:'Unai Simón',          team:'Athletic Club', pos:'POR', goals:0, assists:0, caps:36, rating:83},
  {id:'cp092', name:'Nico Williams',       team:'Athletic Club', pos:'DEL', goals:8, assists:8, caps:37, rating:85},
  {id:'cp093', name:'Iñaki Williams',      team:'Athletic Club', pos:'DEL', goals:9, assists:5, caps:38, rating:82},
  {id:'cp094', name:'Óscar de Marcos',     team:'Athletic Club', pos:'DEF', goals:3, assists:2, caps:34, rating:79},

  // --- Aston Villa (Champions) ---
  {id:'cp095', name:'Emiliano Martínez',   team:'Aston Villa', pos:'POR', goals:0, assists:0, caps:35, rating:85},
  {id:'cp096', name:'Ollie Watkins',       team:'Aston Villa', pos:'DEL', goals:19,assists:13,caps:37, rating:84},
  {id:'cp097', name:'John McGinn',         team:'Aston Villa', pos:'MED', goals:6, assists:4, caps:36, rating:80},
];

// --- Clubes que la app destaca como "grandes" (también participan en
// competiciones secundarias además de su liga principal) ---
const FEATURED_CLUBS = [
  { name: 'Real Madrid', league: 'esp.1', secondary: ['esp.copa_del_rey', 'esp.super_cup'] },
  { name: 'Barcelona', league: 'esp.1', secondary: ['esp.copa_del_rey', 'esp.super_cup'] },
  { name: 'Atlético de Madrid', league: 'esp.1', secondary: ['esp.copa_del_rey', 'esp.super_cup'] },
  { name: 'Manchester City', league: 'eng.1', secondary: ['eng.fa', 'eng.league_cup', 'eng.charity'] },
  { name: 'Liverpool', league: 'eng.1', secondary: ['eng.fa', 'eng.league_cup', 'eng.charity'] },
  { name: 'Manchester United', league: 'eng.1', secondary: ['eng.fa', 'eng.league_cup', 'eng.charity'] },
];

function matchesSearch(text, q) {
  const norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return norm(text).includes(norm(q));
}

const Stats = {
  _currentTab: 'teams',
  _lastQuery: '',
  _teamsLeague: 'esp.1', // liga activa para la sub-pestaña "Equipos"

  async render(tab = 'teams') {
    this._currentTab = tab;
    const input = document.getElementById('search-input');
    if (input && this._lastQuery) input.value = this._lastQuery;
    const content = document.getElementById('stats-content');
    if (!content) return;
    content.innerHTML = '<div class="spinner"></div>';
    try {
      const q = this._lastQuery;
      if (tab === 'teams')   await this.renderTeams(content, q);
      if (tab === 'players') await this.renderPlayers(content, q);
      if (tab === 'leagues') await this.renderLeagueTables(content);
    } catch(err) {
      console.error('[Stats.render]', err);
      content.innerHTML = '<p class="empty-state" style="color:var(--text-muted)">Error al cargar datos. Intenta de nuevo.</p>';
    }
  },

  _leagueSelector(activeId) {
    const leagues = API.getMainLeagues();
    return `<div class="stats-league-selector" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${leagues.map(l => `
        <button class="league-sel-btn${l.id===activeId?' active':''}" data-league="${l.id}"
          style="padding:4px 10px;font-size:0.72rem;border-radius:8px;border:1px solid var(--border);cursor:pointer;
            background:${l.id===activeId?'var(--accent)':'transparent'};color:${l.id===activeId?'#000':'var(--text-muted)'};font-weight:${l.id===activeId?'700':'400'}">
          ${l.short || l.name}
        </button>`).join('')}
    </div>`;
  },

  async renderTeams(container, query = '') {
    const leagueId = this._teamsLeague || 'esp.1';
    let teams = await API.getTeams(leagueId, query);

    teams = [...teams].sort((a, b) => {
      const ptsA = a.pts ?? 0, ptsB = b.pts ?? 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const dgA = (a.gf ?? 0) - (a.gc ?? 0);
      const dgB = (b.gf ?? 0) - (b.gc ?? 0);
      if (dgB !== dgA) return dgB - dgA;
      return (b.w??0) - (a.w??0);
    });
    const user    = await Auth.currentUser();
    const favIds  = new Set((user?.favoritos || []).map(f => f.id));

    container.innerHTML = this._leagueSelector(leagueId) + `
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr>
            <th>#</th><th>Equipo</th><th>PJ</th>
            <th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GC</th><th>Pts</th><th></th>
          </tr></thead>
          <tbody>
            ${teams.map((t, i) => `
              <tr>
                <td class="text-muted">${i+1}</td>
                <td><img src="${t.crest}" alt="" referrerpolicy="no-referrer" style="width:18px;height:18px;object-fit:contain;vertical-align:-4px;margin-right:5px" onerror="this.style.display='none'">${t.name}</td>
                <td>${t.pj??0}</td>
                <td class="stat-w">${t.w??0}</td>
                <td class="text-muted">${t.d??0}</td>
                <td class="stat-l">${t.l??0}</td>
                <td>${t.gf??0}</td>
                <td>${t.gc??0}</td>
                <td class="stat-pts">${t.pts??0}</td>
                <td>
                  <button class="fav-btn ${favIds.has(t.id)?'active':''}"
                    data-id="${t.id}" data-name="${t.name.replace(/'/g, '&#39;')}"
                    data-crest="${t.crest||''}" data-tipo="team">
                    ${favIds.has(t.id)?'★':'☆'}
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('.league-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._teamsLeague = btn.dataset.league;
        this.renderTeams(container, this._lastQuery);
      });
    });

    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isFav = await Profile.isFavorite(btn.dataset.id, 'team');
        if (isFav) {
          await Profile.removeFavorite(btn.dataset.id, 'team');
          btn.textContent = '☆'; btn.classList.remove('active');
        } else {
          await Profile.addFavorite({id:btn.dataset.id,name:btn.dataset.name,crest:btn.dataset.crest},'team');
          btn.textContent = '★'; btn.classList.add('active');
        }
      });
    });
  },

  async renderPlayers(container, query = '') {
    const q       = query.toLowerCase();
    const players = q
      ? ALL_PLAYERS.filter(p => p.name.toLowerCase().includes(q) || matchesSearch(p.team, query))
      : ALL_PLAYERS;

    const user    = await Auth.currentUser();
    const favIds  = new Set((user?.favoritos || []).map(f => f.id));

    if (!players.length) {
      container.innerHTML = '<p class="empty-state">No se encontraron jugadores.</p>';
      return;
    }

    container.innerHTML = `
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr>
            <th>Jugador</th><th>Equipo</th><th>Pos</th>
            <th>⚽</th><th>🅰️</th><th>PJ</th><th></th>
          </tr></thead>
          <tbody>
            ${players.map(p => `
              <tr>
                <td style="font-weight:600">${p.name}</td>
                <td>${p.team}</td>
                <td><span class="pos-badge">${p.pos}</span></td>
                <td class="stat-w">${p.goals??0}</td>
                <td style="color:var(--rare)">${p.assists??0}</td>
                <td class="text-muted">${p.caps??0}</td>
                <td>
                  <button class="fav-btn ${favIds.has(p.id)?'active':''}"
                    data-id="${p.id}" data-name="${p.name.replace(/'/g, '&#39;')}"
                    data-tipo="player">
                    ${favIds.has(p.id)?'★':'☆'}
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isFav = await Profile.isFavorite(btn.dataset.id, 'player');
        if (isFav) {
          await Profile.removeFavorite(btn.dataset.id, 'player');
          btn.textContent = '☆'; btn.classList.remove('active');
        } else {
          await Profile.addFavorite({id:btn.dataset.id,name:btn.dataset.name},'player');
          btn.textContent = '★'; btn.classList.add('active');
        }
      });
    });
  },

  async renderScorers() {
    const players = [...ALL_PLAYERS].sort((a,b) => (b.goals||0)-(a.goals||0));
    return players;
  },

  // --- Tablas completas de las 3 competiciones principales, una debajo de
  // la otra (reemplaza al viejo "Grupos A-L" del Mundial, que no aplica a
  // ligas de clubes). ---
  async renderLeagueTables(container) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const leagues = API.getMainLeagues();
      const tables = await Promise.all(leagues.map(l => API.getStandings(l.id).catch(() => [])));

      container.innerHTML = leagues.map((l, idx) => {
        const rows = tables[idx] || [];
        if (!rows.length) {
          return `<div class="group-table-wrap"><div class="group-table-title">${l.name}</div><p class="empty-state" style="font-size:0.72rem">Sin datos disponibles por ahora.</p></div>`;
        }
        return `
          <div class="group-table-wrap" style="margin-bottom:1.2rem">
            <div class="group-table-title">${l.name}</div>
            <table class="stats-table" style="font-size:0.72rem">
              <thead><tr>
                <th>#</th><th>Equipo</th><th>PJ</th>
                <th style="color:#44ff88">V</th><th>E</th><th style="color:#ff4466">D</th>
                <th>GF</th><th>GC</th><th style="color:var(--gold)">Pts</th>
              </tr></thead>
              <tbody>
                ${rows.map((t, i) => `
                  <tr style="${i < 4 ? 'border-left:2px solid var(--accent)' : ''}">
                    <td class="text-muted" style="font-size:0.8rem">${t.pos || i+1}</td>
                    <td><img src="${t.crest}" alt="" referrerpolicy="no-referrer" style="width:16px;height:16px;object-fit:contain;vertical-align:-3px;margin-right:4px" onerror="this.style.display='none'">${t.team}</td>
                    <td>${t.pj||0}</td>
                    <td style="color:#44ff88">${t.w||0}</td>
                    <td class="text-muted">${t.d||0}</td>
                    <td style="color:#ff4466">${t.l||0}</td>
                    <td>${t.gf||0}</td>
                    <td>${t.gc||0}</td>
                    <td style="color:var(--gold);font-weight:700">${t.pts||0}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      }).join('');
    } catch(err) {
      container.innerHTML = '<p class="empty-state" style="color:var(--text-muted)">Error al cargar las tablas.</p>';
    }
  },

  async search(query) {
    this._lastQuery = query;
    const content = document.getElementById('stats-content');
    if (!content) return;
    content.innerHTML = '<div class="spinner"></div>';
    if (this._currentTab === 'teams')   await this.renderTeams(content, query);
    if (this._currentTab === 'players') await this.renderPlayers(content, query);
    if (this._currentTab === 'leagues') await this.renderLeagueTables(content);
  },

  findPlayer(name) {
    const q = name.toLowerCase();
    return ALL_PLAYERS.find(p => p.name.toLowerCase().includes(q)) || null;
  }
};
