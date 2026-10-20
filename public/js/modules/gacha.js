const FIGURITAS_POOL = [
  // --- GOAT: leyendas activas en las 3 competiciones que sigue la app ---
  { id:'fig_g001', name:'Kevin De Bruyne',       sdbName:'Kevin De Bruyne',        team:'Napoli',              rareza:'goat',      emoji:["🇧🇪","🎯","🧠"], pos:'MED', rating:97 },
  { id:'fig_g002', name:'Luka Modrić',           sdbName:'Luka Modric',            team:'Milan',               rareza:'goat',      emoji:["🇭🇷","🎩","🤍"], pos:'MED', rating:96 },
  { id:'fig_g003', name:'Robert Lewandowski',    sdbName:'Robert Lewandowski',     team:'Barcelona',           rareza:'goat',      emoji:["🇵🇱","⚽","🔥"], pos:'DEL', rating:98 },

  // --- Legendaria ---
  { id:'fig_l001', name:'Kylian Mbappé',         sdbName:'Kylian Mbappe',          team:'Real Madrid',         rareza:'legendary', emoji:["🇫🇷","🚀","⚽"], pos:'DEL', rating:97 },
  { id:'fig_l002', name:'Vinícius Jr.',          sdbName:'Vinicius Junior',        team:'Real Madrid',         rareza:'legendary', emoji:["🇧🇷","⚡","🤍"], pos:'DEL', rating:96 },
  { id:'fig_l003', name:'Jude Bellingham',       sdbName:'Jude Bellingham',        team:'Real Madrid',         rareza:'legendary', emoji:["⭐","🤍","👑"], pos:'MED', rating:95 },
  { id:'fig_l004', name:'Erling Haaland',        sdbName:'Erling Haaland',         team:'Manchester City',     rareza:'legendary', emoji:["🇳🇴","🤖","⚽"], pos:'DEL', rating:94 },
  { id:'fig_l005', name:'Mohamed Salah',         sdbName:'Mohamed Salah',          team:'Liverpool',           rareza:'legendary', emoji:["🇪🇬","⚡","🔴"], pos:'DEL', rating:94 },

  // --- Épica ---
  { id:'fig_e001', name:'Lamine Yamal',          sdbName:'Lamine Yamal',           team:'Barcelona',           rareza:'epic',      emoji:["🇪🇸","🌟","⚽"], pos:'DEL', rating:89 },
  { id:'fig_e002', name:'Pedri',                 sdbName:'Pedri Gonzalez',         team:'Barcelona',           rareza:'epic',      emoji:["🇪🇸","🧠","⚽"], pos:'MED', rating:88 },
  { id:'fig_e003', name:'Rodri',                 sdbName:'Rodri',                  team:'Manchester City',     rareza:'epic',      emoji:["🇪🇸","🛡️","⚽"], pos:'MED', rating:90 },
  { id:'fig_e004', name:'Phil Foden',            sdbName:'Phil Foden',             team:'Manchester City',     rareza:'epic',      emoji:["🏴","🎯","⚽"], pos:'DEL', rating:87 },
  { id:'fig_e005', name:'Federico Valverde',     sdbName:'Federico Valverde',      team:'Real Madrid',         rareza:'epic',      emoji:["🇺🇾","🚂","🤍"], pos:'MED', rating:88 },
  { id:'fig_e006', name:'Bukayo Saka',           sdbName:'Bukayo Saka',            team:'Arsenal',             rareza:'epic',      emoji:["🏴","⚡","⚽"], pos:'DEL', rating:87 },
  { id:'fig_e007', name:'Jamal Musiala',         sdbName:'Jamal Musiala',          team:'Bayern Múnich',       rareza:'epic',      emoji:["🇩🇪","🎩","⚽"], pos:'MED', rating:88 },
  { id:'fig_e008', name:'Bernardo Silva',        sdbName:'Bernardo Silva',         team:'Manchester City',     rareza:'epic',      emoji:["🇵🇹","🧠","⚽"], pos:'MED', rating:87 },
  { id:'fig_e009', name:'Raphinha',              sdbName:'Raphinha',               team:'Barcelona',           rareza:'epic',      emoji:["🇧🇷","⚡","⚽"], pos:'DEL', rating:89 },
  { id:'fig_e010', name:'Cole Palmer',           sdbName:'Cole Palmer',            team:'Chelsea',             rareza:'epic',      emoji:["🏴","🥶","⚽"], pos:'MED', rating:86 },
  { id:'fig_e011', name:'Bruno Fernandes',       sdbName:'Bruno Fernandes',        team:'Manchester United',   rareza:'epic',      emoji:["🇵🇹","🎯","⚽"], pos:'MED', rating:86 },
  { id:'fig_e012', name:'Ousmane Dembélé',       sdbName:'Ousmane Dembele',        team:'Paris Saint-Germain', rareza:'epic',      emoji:["🇫🇷","⚡","🎩"], pos:'DEL', rating:87 },
  { id:'fig_e013', name:'Antoine Griezmann',     sdbName:'Antoine Griezmann',      team:'Atlético de Madrid',  rareza:'epic',      emoji:["🇫🇷","🎯","⚽"], pos:'DEL', rating:86 },
  { id:'fig_e014', name:'Martin Ødegaard',       sdbName:'Martin Odegaard',        team:'Arsenal',             rareza:'epic',      emoji:["🇳🇴","🎩","⚽"], pos:'MED', rating:86 },

  // --- Rara ---
  { id:'fig_r001', name:'Thibaut Courtois',      sdbName:'Thibaut Courtois',       team:'Real Madrid',         rareza:'rare',      emoji:["🇧🇪","🧤","🧱"], pos:'POR', rating:88 },
  { id:'fig_r002', name:'Alisson Becker',        sdbName:'Alisson Becker',         team:'Liverpool',           rareza:'rare',      emoji:["🇧🇷","🧤","🧱"], pos:'POR', rating:88 },
  { id:'fig_r003', name:'Ederson',               sdbName:'Ederson',                team:'Manchester City',     rareza:'rare',      emoji:["🇧🇷","🧤","🎯"], pos:'POR', rating:85 },
  { id:'fig_r004', name:'William Saliba',        sdbName:'William Saliba',         team:'Arsenal',             rareza:'rare',      emoji:["🇫🇷","🛡️","⚽"], pos:'DEF', rating:87 },
  { id:'fig_r005', name:'Rúben Dias',            sdbName:'Ruben Dias',             team:'Manchester City',     rareza:'rare',      emoji:["🇵🇹","🛡️","🧱"], pos:'DEF', rating:87 },
  { id:'fig_r006', name:'Virgil van Dijk',       sdbName:'Virgil van Dijk',        team:'Liverpool',           rareza:'rare',      emoji:["🇳🇱","🧱","🛡️"], pos:'DEF', rating:88 },
  { id:'fig_r007', name:'Antonio Rüdiger',       sdbName:'Antonio Rudiger',        team:'Real Madrid',         rareza:'rare',      emoji:["🇩🇪","🧱","⚽"], pos:'DEF', rating:86 },
  { id:'fig_r008', name:'Achraf Hakimi',         sdbName:'Achraf Hakimi',          team:'Paris Saint-Germain', rareza:'rare',      emoji:["🇲🇦","⚡","🛡️"], pos:'DEF', rating:87 },
  { id:'fig_r009', name:'Trent Alexander-Arnold',sdbName:'Trent Alexander-Arnold', team:'Real Madrid',         rareza:'rare',      emoji:["🏴","🎯","⚽"], pos:'DEF', rating:86 },
  { id:'fig_r010', name:'Alejandro Balde',       sdbName:'Alejandro Balde',        team:'Barcelona',           rareza:'rare',      emoji:["🇪🇸","⚡","🛡️"], pos:'DEF', rating:83 },
  { id:'fig_r011', name:'Nico Williams',         sdbName:'Nico Williams',          team:'Athletic Club',       rareza:'rare',      emoji:["🇪🇸","⚡","⭐"], pos:'DEL', rating:85 },
  { id:'fig_r012', name:'Julián Álvarez',        sdbName:'Julian Alvarez',         team:'Atlético de Madrid',  rareza:'rare',      emoji:["🇦🇷","⚽","🔥"], pos:'DEL', rating:87 },
  { id:'fig_r013', name:'Declan Rice',           sdbName:'Declan Rice',            team:'Arsenal',             rareza:'rare',      emoji:["🏴","🛡️","⚽"], pos:'MED', rating:86 },
  { id:'fig_r014', name:'Moisés Caicedo',        sdbName:'Moises Caicedo',         team:'Chelsea',             rareza:'rare',      emoji:["🇪🇨","🛡️","⚽"], pos:'MED', rating:83 },
  { id:'fig_r015', name:'Frenkie de Jong',       sdbName:'Frenkie de Jong',        team:'Barcelona',           rareza:'rare',      emoji:["🇳🇱","🧠","⚽"], pos:'MED', rating:85 },
  { id:'fig_r016', name:'Gavi',                  sdbName:'Gavi',                   team:'Barcelona',           rareza:'rare',      emoji:["🇪🇸","⭐","⚽"], pos:'MED', rating:85 },
  { id:'fig_r017', name:'Vitinha',               sdbName:'Vitinha',                team:'Paris Saint-Germain', rareza:'rare',      emoji:["🇵🇹","🧠","⚽"], pos:'MED', rating:85 },
  { id:'fig_r018', name:'Son Heung-min',         sdbName:'Son Heung-min',          team:'Tottenham Hotspur',   rareza:'rare',      emoji:["🇰🇷","⚡","⚽"], pos:'DEL', rating:85 },

  // --- Común ---
  { id:'fig_c001', name:'Luis Díaz',             sdbName:'Luis Diaz',              team:'Bayern Múnich',       rareza:'common',    emoji:["🇨🇴","⚡","⚽"], pos:'DEL', rating:83 },
  { id:'fig_c002', name:'Marcus Rashford',       sdbName:'Marcus Rashford',        team:'Barcelona',           rareza:'common',    emoji:["🏴","⚡","⚽"], pos:'DEL', rating:81 },
  { id:'fig_c003', name:'Jérémy Doku',           sdbName:'Jeremy Doku',            team:'Manchester City',     rareza:'common',    emoji:["🇧🇪","⚡","⚽"], pos:'DEL', rating:82 },
  { id:'fig_c004', name:'Enzo Fernández',        sdbName:'Enzo Fernandez',         team:'Chelsea',             rareza:'common',    emoji:["🇦🇷","🎯","⚽"], pos:'MED', rating:83 },
  { id:'fig_c005', name:'Bradley Barcola',       sdbName:'Bradley Barcola',        team:'Paris Saint-Germain', rareza:'common',    emoji:["🇫🇷","⚡","⭐"], pos:'DEL', rating:81 },
  { id:'fig_c006', name:'Gabriel Magalhães',     sdbName:'Gabriel Magalhaes',      team:'Arsenal',             rareza:'common',    emoji:["🇧🇷","🧱","🛡️"], pos:'DEF', rating:85 },
  { id:'fig_c007', name:'Kobbie Mainoo',         sdbName:'Kobbie Mainoo',          team:'Manchester United',   rareza:'common',    emoji:["🏴","🧠","⭐"], pos:'MED', rating:80 },
  { id:'fig_c008', name:'Pau Cubarsí',           sdbName:'Pau Cubarsi',            team:'Barcelona',           rareza:'common',    emoji:["🇪🇸","🧱","⭐"], pos:'DEF', rating:83 },
  { id:'fig_c009', name:'Jules Koundé',          sdbName:'Jules Kounde',           team:'Barcelona',           rareza:'common',    emoji:["🇫🇷","🛡️","⚽"], pos:'DEF', rating:85 },
  { id:'fig_c010', name:'Levi Colwill',          sdbName:'Levi Colwill',           team:'Chelsea',             rareza:'common',    emoji:["🏴","🛡️","⚽"], pos:'DEF', rating:80 },
  { id:'fig_c011', name:'Nicolas Jackson',       sdbName:'Nicolas Jackson',        team:'Chelsea',             rareza:'common',    emoji:["🇸🇳","⚡","⚽"], pos:'DEL', rating:80 },
  { id:'fig_c012', name:'Alejandro Garnacho',    sdbName:'Alejandro Garnacho',     team:'Chelsea',             rareza:'common',    emoji:["🇦🇷","⚡","⭐"], pos:'DEL', rating:80 },
  { id:'fig_c013', name:'Rasmus Højlund',        sdbName:'Rasmus Hojlund',         team:'Manchester United',   rareza:'common',    emoji:["🇩🇰","⚽","⭐"], pos:'DEL', rating:79 },
  { id:'fig_c014', name:'Dominik Szoboszlai',    sdbName:'Dominik Szoboszlai',     team:'Liverpool',           rareza:'common',    emoji:["🇭🇺","🎯","⚽"], pos:'MED', rating:84 },
  { id:'fig_c015', name:'Darwin Núñez',          sdbName:'Darwin Nunez',           team:'Al-Hilal',            rareza:'common',    emoji:["🇺🇾","🔥","⚽"], pos:'DEL', rating:82 },
  { id:'fig_c016', name:'Cody Gakpo',            sdbName:'Cody Gakpo',             team:'Liverpool',           rareza:'common',    emoji:["🇳🇱","⚽","⭐"], pos:'DEL', rating:83 },
  { id:'fig_c017', name:'James Maddison',        sdbName:'James Maddison',         team:'Tottenham Hotspur',   rareza:'common',    emoji:["🏴","🎯","⚽"], pos:'MED', rating:82 },
  { id:'fig_c018', name:'Nahuel Molina',         sdbName:'Nahuel Molina',          team:'Atlético de Madrid',  rareza:'common',    emoji:["🇦🇷","⚡","🛡️"], pos:'DEF', rating:81 },
  { id:'fig_c019', name:'Joško Gvardiol',        sdbName:'Josko Gvardiol',         team:'Manchester City',     rareza:'common',    emoji:["🇭🇷","🧱","⭐"], pos:'DEF', rating:85 },
  { id:'fig_c020', name:'Yves Bissouma',         sdbName:'Yves Bissouma',          team:'Tottenham Hotspur',   rareza:'common',    emoji:["🇲🇱","🛡️","⚽"], pos:'MED', rating:80 },
  { id:'fig_c021', name:'Kai Havertz',           sdbName:'Kai Havertz',            team:'Arsenal',             rareza:'common',    emoji:["🇩🇪","⚽","⭐"], pos:'DEL', rating:83 },
  { id:'fig_c022', name:'Diogo Dalot',           sdbName:'Diogo Dalot',            team:'Manchester United',   rareza:'common',    emoji:["🇵🇹","⚡","🛡️"], pos:'DEF', rating:80 },
  { id:'fig_c023', name:'Jack Grealish',         sdbName:'Jack Grealish',          team:'Everton',             rareza:'common',    emoji:["🏴","⚡","⚽"], pos:'DEL', rating:80 },
  { id:'fig_c024', name:'Nathan Ordaz',          sdbName:'Nathan Ordaz',           team:'Alianza F.C.',        rareza:'common',    emoji:["🇸🇻","⚽","⭐"], pos:'DEL', rating:72 },
];

const TOTAL_FIGURITAS = FIGURITAS_POOL.length;

const RARITY_PROBS = [
  { rareza:'goat',      min:99.7, max:100   },
  { rareza:'legendary', min:99,   max:99.69 },
  { rareza:'epic',      min:90,   max:98.99 },
  { rareza:'rare',      min:70,   max:89.99 },
  { rareza:'common',    min:0,    max:69.99 }
];

const RARITY_LABELS    = { common:'Común', rare:'Rara', epic:'Épica', legendary:'Legendaria', goat:'🐐 GOAT' };
const RARITY_COIN_VALUE = { common:1, rare:3, epic:10, legendary:50, goat:200 };
const PITY_THRESHOLD   = 50;

const Gacha = {

  _rollRarity(since = 0) {
    if (since >= PITY_THRESHOLD) return 'legendary';
    const r = Math.random() * 100;
    for (const p of RARITY_PROBS) if (r >= p.min && r <= p.max) return p.rareza;
    return 'common';
  },

  _pickFromPool(rareza) {
    const pool = FIGURITAS_POOL.filter(f => f.rareza === rareza);
    if (!pool.length) return FIGURITAS_POOL[0];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  async getPlayerPhoto(fig) {
    return await API.getPhotoById(fig.id);
  },

  async pull(n = 1) {
    const user = await Auth.currentUser();
    if (!user) return { error: 'No hay sesión activa' };
    if (user.tiradas < n) return { error: `No tienes suficientes tiradas. Tienes ${user.tiradas}.` };

    const results  = [];
    const userFigs = user.figuritas || [];
    let pityCount  = user.pityCount || 0;

    for (let i = 0; i < n; i++) {
      const rareza   = this._rollRarity(pityCount);
      const figurita = { ...this._pickFromPool(rareza) };
      pityCount = rareza === 'legendary' ? 0 : pityCount + 1;

      const existing = userFigs.find(f => f.id === figurita.id);
      if (existing) {
        existing.duplicados  = (existing.duplicados || 0) + 1;
        figurita.isDuplicate = true;
        figurita.duplicados  = existing.duplicados;
      } else {
        userFigs.push({ ...figurita, duplicados:0, obtenida: new Date().toISOString() });
        figurita.isDuplicate = false;
      }
      results.push(figurita);
    }

    user.figuritas  = userFigs;
    user.tiradas   -= n;
    user.pityCount  = pityCount;
    await Auth.updateUser(user);
    if (typeof DB !== 'undefined' && DB.logActivity)
      await DB.logActivity(user.email, 'gacha_pull', `x${n}`);

    return { results, user };
  },

  async claimDaily() {
    const user = await Auth.currentUser();
    if (!user) return { error: 'No session' };
    const today = new Date().toDateString();
    if (user.lastDailyPull === today)
      return { ok:false, msg:'Ya reclamaste tu tirada diaria 🎴' };
    user.tiradas       += 1;
    user.lastDailyPull  = today;
    await Auth.updateUser(user);
    if (typeof DB !== 'undefined' && DB.logActivity)
      await DB.logActivity(user.email, 'daily_claim', '+1');
    return { ok:true, tiradas: user.tiradas };
  },

  async convertDuplicates() {
    const user = await Auth.currentUser();
    if (!user) return { coins:0, converted:0 };
    let coins = 0, converted = 0;
    for (const f of (user.figuritas || [])) {
      if (f.duplicados > 0) {
        coins     += f.duplicados * (RARITY_COIN_VALUE[f.rareza] || 1);
        converted += f.duplicados;
        f.duplicados = 0;
      }
    }
    user.monedas = (user.monedas || 0) + coins;
    await Auth.updateUser(user);
    return { coins, converted };
  },

  getRarityLabel(r)  { return RARITY_LABELS[r] || r; },
  getPool()          { return FIGURITAS_POOL; },
  getTotalFiguritas(){ return TOTAL_FIGURITAS; }
};
