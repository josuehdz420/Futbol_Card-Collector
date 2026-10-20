// league-predictor.js
// --------------------------------------------------
// Reemplaza al viejo predictor de bracket del Mundial (fase de grupos →
// campeón). Como ahora la app sigue ligas de clubes (temporada larga, sin
// bracket fijo), el predictor se simplifica a: "¿quién gana cada una de las
// 3 competiciones principales esta temporada?" — una predicción por
// competición, evaluada al final de la temporada / del torneo.

const LP_COMPETITIONS_REWARD = 50; // tiradas por acertar el campeón de una competición
const LP_LS_KEY = 'wcc_league_prediction';

const LeaguePredictor = {

  async open() {
    const user = await Auth.currentUser();
    if (!user) { Toast.warn('Inicia sesión para predecir'); return; }

    const leagues = API.getMainLeagues();
    const pred = user.leaguePrediction || {};

    // Cargamos los equipos de cada competición para poblar los selectores
    // (se usa la tabla actual como fuente de candidatos).
    const teamsByLeague = {};
    await Promise.all(leagues.map(async l => {
      try { teamsByLeague[l.id] = await API.getTeams(l.id); }
      catch(_) { teamsByLeague[l.id] = []; }
    }));

    const overlay = document.createElement('div');
    overlay.id = 'lp-overlay';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
      background:rgba(10,12,20,0.97);overflow-y:auto;
      display:flex;flex-direction:column;`;

    overlay.innerHTML = this._buildUI(leagues, teamsByLeague, pred);
    document.body.appendChild(overlay);

    overlay.querySelector('#lp-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#lp-save').addEventListener('click', () => this._save(overlay, leagues));

    this._initPickers(overlay, leagues, teamsByLeague, pred);
  },

  _buildUI(leagues, teamsByLeague, pred) {
    const rewarded = pred.rewarded || {};
    return `
      <div style="max-width:600px;width:100%;margin:0 auto;padding:1rem;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div>
            <h2 style="margin:0;font-size:1.3rem;color:var(--gold)">🏆 Predecir campeones</h2>
            <p style="font-size:0.7rem;color:var(--text-muted);margin:0.2rem 0 0">
              Elige quién gana cada competición esta temporada
            </p>
          </div>
          <button id="lp-close" style="background:transparent;border:1px solid var(--border);
            border-radius:8px;color:var(--text-secondary);padding:0.4rem 0.8rem;cursor:pointer;
            font-size:0.85rem">✕ Cerrar</button>
        </div>

        <div style="background:var(--card-bg,#181c28);border:1px solid var(--border);
          border-radius:12px;padding:0.85rem 1rem;margin-bottom:1rem;">
          <p style="font-size:0.65rem;font-weight:700;color:var(--text-muted);letter-spacing:1px;
            text-transform:uppercase;margin:0 0 0.5rem">Recompensa por acertar</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.4rem;">
            ${leagues.map(l => {
              const won = !!rewarded[l.id];
              return `<div style="font-size:0.7rem;color:${won?'#4caf6a':'var(--text-muted)'};background:rgba(255,255,255,0.04);
                border-radius:8px;padding:0.35rem 0.5rem;text-align:center;">
                ${won ? '✅' : '⏳'} ${l.short || l.name}<br>
                <span style="font-weight:800;color:var(--gold)">${LP_COMPETITIONS_REWARD} 🎴</span>
              </div>`;
            }).join('')}
          </div>
          <p style="font-size:0.72rem;color:var(--gold);font-weight:700;margin:0.6rem 0 0;text-align:right">
            Total posible: <strong>${leagues.length * LP_COMPETITIONS_REWARD} tiradas</strong>
          </p>
        </div>

        ${leagues.map(l => this._buildLeaguePanel(l, teamsByLeague[l.id] || [], pred[l.id])).join('')}

        <div style="text-align:center;padding:1.5rem 0 2rem;">
          <button id="lp-save" style="background:linear-gradient(135deg,#c0a022,#e8c840);
            color:#000;font-weight:800;font-size:1rem;border:none;border-radius:12px;
            padding:0.85rem 2.5rem;cursor:pointer;width:100%;max-width:350px;
            box-shadow:0 4px 20px rgba(200,160,0,0.35);">
            💾 Guardar predicción
          </button>
          <p style="font-size:0.65rem;color:var(--text-muted);margin-top:0.5rem">
            Puedes cambiar tu predicción en cualquier momento antes de que termine la temporada
          </p>
        </div>
      </div>`;
  },

  _buildLeaguePanel(league, teams, currentPick) {
    const sorted = [...teams].sort((a,b) => (b.pts||0)-(a.pts||0));
    return `
      <div class="lp-league-panel" data-league="${league.id}" style="margin-bottom:1rem">
        <p style="font-size:0.72rem;color:var(--text-muted);margin:0 0 0.5rem">
          <strong style="color:var(--gold)">${league.name}</strong> — ¿quién levanta el título?
        </p>
        <div style="background:var(--card-bg,#181c28);border:2px solid ${currentPick?'var(--gold)':'var(--border)'};
          border-radius:12px;padding:0.75rem;text-align:center;margin-bottom:0.5rem">
          <div class="lp-pick-label" data-league="${league.id}" style="font-size:0.95rem;font-weight:800;color:var(--gold);min-height:1.4rem">
            ${currentPick ? `🏆 ${currentPick}` : 'Selecciona un equipo'}
          </div>
        </div>
        <div class="lp-team-grid" data-league="${league.id}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.35rem;max-height:220px;overflow-y:auto">
          ${sorted.length ? sorted.map(t => `
            <button class="lp-team-btn${t.name===currentPick?' selected':''}" data-league="${league.id}" data-team="${t.name}"
              style="background:${t.name===currentPick?'rgba(200,160,0,0.2)':'rgba(255,255,255,0.05)'};
                border:1px solid ${t.name===currentPick?'var(--gold)':'var(--border)'};
                border-radius:8px;padding:0.4rem 0.5rem;cursor:pointer;font-size:0.7rem;
                color:${t.name===currentPick?'var(--gold)':'var(--text-secondary)'};
                font-weight:${t.name===currentPick?'700':'400'};text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <img src="${t.crest}" alt="" referrerpolicy="no-referrer" style="width:14px;height:14px;object-fit:contain;vertical-align:-2px;margin-right:3px" onerror="this.remove()">${t.name}
            </button>`).join('') : '<p style="grid-column:1/-1;font-size:0.7rem;color:var(--text-muted)">Sin datos de equipos disponibles por ahora.</p>'}
        </div>
      </div>`;
  },

  _initPickers(overlay, leagues, teamsByLeague, pred) {
    overlay.querySelectorAll('.lp-team-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const leagueId = btn.dataset.league;
        const team = btn.dataset.team;
        overlay.querySelectorAll(`.lp-team-btn[data-league="${leagueId}"]`).forEach(b => {
          const selected = b === btn;
          b.classList.toggle('selected', selected);
          b.style.background = selected ? 'rgba(200,160,0,0.2)' : 'rgba(255,255,255,0.05)';
          b.style.borderColor = selected ? 'var(--gold)' : 'var(--border)';
          b.style.color = selected ? 'var(--gold)' : 'var(--text-secondary)';
          b.style.fontWeight = selected ? '700' : '400';
        });
        const label = overlay.querySelector(`.lp-pick-label[data-league="${leagueId}"]`);
        if (label) label.textContent = `🏆 ${team}`;
        const panel = overlay.querySelector(`.lp-league-panel[data-league="${leagueId}"] > div`);
        if (panel) panel.style.borderColor = 'var(--gold)';
      });
    });
  },

  async _save(overlay, leagues) {
    const user = await Auth.currentUser();
    if (!user) return;

    const pred = { rewarded: user.leaguePrediction?.rewarded || {} };
    leagues.forEach(l => {
      const selected = overlay.querySelector(`.lp-team-btn.selected[data-league="${l.id}"]`);
      if (selected) pred[l.id] = selected.dataset.team;
    });
    pred.savedAt = new Date().toISOString();

    user.leaguePrediction = pred;
    await Auth.updateUser(user);

    try { localStorage.setItem(LP_LS_KEY, JSON.stringify(pred)); } catch(_) {}

    Toast.success('¡Predicción de campeones guardada! 🏆');
    overlay.remove();
  },

  // Se llama (por ejemplo desde un chequeo periódico o manual) cuando se
  // confirma el campeón real de una competición, para repartir tiradas si
  // el usuario acertó. No corre automáticamente: se deja como utilidad para
  // cuando la temporada termine y se conozca el campeón oficial.
  async evaluateChampion(leagueId, actualChampionName) {
    const user = await Auth.currentUser();
    if (!user || !user.leaguePrediction) return 0;

    const pred = user.leaguePrediction;
    const rewarded = pred.rewarded || {};
    if (rewarded[leagueId]) return 0;
    if (!pred[leagueId] || pred[leagueId] !== actualChampionName) return 0;

    rewarded[leagueId] = true;
    pred.rewarded = rewarded;
    user.leaguePrediction = pred;
    user.tiradas = (user.tiradas || 0) + LP_COMPETITIONS_REWARD;
    await Auth.updateUser(user);
    if (typeof DB !== 'undefined' && DB.logActivity) {
      await DB.logActivity(user.email, 'league_pred_reward', `${leagueId}: +${LP_COMPETITIONS_REWARD} tiradas`);
    }
    Toast.success(`🏆 ¡Predijiste bien al campeón! +${LP_COMPETITIONS_REWARD} tiradas 🎴`);
    return LP_COMPETITIONS_REWARD;
  },
};
