// /api/season-stats?season=2026 — merges /api/week-stats for weeks 1..N.
// Each week is its own (edge-cached) call, so a full season is 18 parallel
// requests that mostly hit cache. Returns:
//   players[id] = { name, pos, team, games:[...], totals:{...}, perGame:{...} }
//   teams[abbr] = { games, pf, pa, off:{...}, def:{...}, ranks:{...} }
//   allowed[abbr][pos] = { tdPg, ydsPg, tdRank, ydsRank }
// Optional: &through=<week> to stop early (used for "as of" views).

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

export default async function handler(req, res) {
  const now = new Date();
  const season = Number(req.query.season) || (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1);
  const through = Number(req.query.through) || 18;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;
  try {
    const weeks = await Promise.all(Array.from({ length: through }, (_, i) => i + 1)
      .map((w) => getJson(`${base}/api/week-stats?season=${season}&week=${w}`).catch(() => null)));

    const players = {}, teams = {};
    let weeksWithGames = 0;
    for (const wk of weeks) {
      if (!wk || !(wk.gamesFinal || wk.gamesLive)) continue;
      weeksWithGames++;
      for (const [id, p] of Object.entries(wk.players || {})) {
        const P = (players[id] ??= { id, name: p.name, pos: p.pos, team: p.team, games: [] });
        P.team = p.team; P.games.push(...p.games);
      }
      for (const [abbr, t] of Object.entries(wk.teams || {})) {
        const T = (teams[abbr] ??= { games: 0, pf: 0, pa: 0, off: { passYds: 0, passTd: 0, rushYds: 0, rushTd: 0 }, def: { passYds: 0, passTd: 0, rushYds: 0, rushTd: 0 }, allowed: { RB: { td: 0, yds: 0 }, WR: { td: 0, yds: 0 }, TE: { td: 0, yds: 0 } } });
        T.games += t.games; T.pf += t.pf; T.pa += t.pa;
        for (const k of Object.keys(T.off)) { T.off[k] += t.off[k] || 0; T.def[k] += t.def[k] || 0; }
        // Week-by-week log so the app can show whether a number is trending up
        // or down (latest game vs the average of everything before it).
        (T.log ??= []).push({ week: wk.week ?? null, pf: t.pf || 0, pa: t.pa || 0,
          offPassYds: t.off?.passYds || 0, offPassTd: t.off?.passTd || 0, offRushYds: t.off?.rushYds || 0, offRushTd: t.off?.rushTd || 0,
          defPassYds: t.def?.passYds || 0, defPassTd: t.def?.passTd || 0, defRushYds: t.def?.rushYds || 0, defRushTd: t.def?.rushTd || 0 });
        for (const pos of ["RB", "WR", "TE"]) { T.allowed[pos].td += t.allowed?.[pos]?.td || 0; T.allowed[pos].yds += t.allowed?.[pos]?.yds || 0; }
      }
    }

    // Positions: ESPN box scores don't carry them. Take Sleeper's (via espn_id),
    // else infer from the stat line. Without this every player is position-less
    // and the TD board filters all of them out.
    let posByEspn = {}, posByName = {}, posByTeamName = {};
    const nkey = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/\s+/g, " ").trim();
    try {
      const sl = await getJson("https://api.sleeper.app/v1/players/nfl");
      for (const sp of Object.values(sl || {})) {
        if (!sp || !sp.position) continue;
        const pos = String(sp.position).toUpperCase();
        if (sp.espn_id) posByEspn[String(sp.espn_id)] = pos;
        // Name fallbacks: espn_id is missing for a chunk of Sleeper's rows, which
        // silently mis-typed players (a TE with targets was inferred as a WR).
        if (sp.full_name) {
          posByName[nkey(sp.full_name)] = pos;
          if (sp.team) posByTeamName[String(sp.team).toUpperCase() + "|" + nkey(sp.full_name)] = pos;
        }
      }
    } catch {}
    for (const P of Object.values(players)) {
      const g = P.games;
      const att = g.reduce((a, x) => a + (x.att || 0), 0), car = g.reduce((a, x) => a + (x.car || 0), 0), tgt = g.reduce((a, x) => a + (x.tgt || 0), 0), tkl = g.reduce((a, x) => a + (x.tkl || 0), 0);
      P.pos = P.pos || posByEspn[P.id] || posByTeamName[String(P.team || "").toUpperCase() + "|" + nkey(P.name)] || posByName[nkey(P.name)]
        || (att >= 5 ? "QB" : car > tgt && car > 0 ? "RB" : tgt > 0 ? "WR" : tkl > 0 ? "DEF" : "");
      if (P.pos === "HB" || P.pos === "FB") P.pos = "RB";
    }
    // Allowed-by-position, rebuilt here now that positions are known
    for (const T of Object.values(teams)) T.allowed = { RB: { td: 0, yds: 0 }, WR: { td: 0, yds: 0 }, TE: { td: 0, yds: 0 } };
    for (const P of Object.values(players)) {
      if (!["RB", "WR", "TE"].includes(P.pos)) continue;
      for (const g of P.games) {
        const O = teams[g.opp]; if (!O) continue;
        O.allowed[P.pos].td += (g.rushTd || 0) + (g.recTd || 0);
        O.allowed[P.pos].yds += (g.rushYds || 0) + (g.recYds || 0);
      }
    }

    // Player totals + per-game
    const SUM = ["cmp", "att", "passYds", "passTd", "int", "car", "rushYds", "rushTd", "rec", "tgt", "recYds", "recTd", "tkl", "solo", "sacks", "tfl", "pd", "defTd", "defInt"];
    for (const P of Object.values(players)) {
      P.games.sort((a, b) => a.week - b.week);
      const tot = {}; for (const k of SUM) tot[k] = P.games.reduce((s, g) => s + (g[k] || 0), 0);
      tot.gp = P.games.length; tot.td = tot.rushTd + tot.recTd;
      tot.ypc = tot.rec ? Number((tot.recYds / tot.rec).toFixed(1)) : null;
      tot.ypcar = tot.car ? Number((tot.rushYds / tot.car).toFixed(1)) : null;
      P.totals = tot;
      P.perGame = {}; for (const k of SUM) P.perGame[k] = tot.gp ? Number((tot[k] / tot.gp).toFixed(1)) : null;
    }
    // Share of the team's targets and of the team's carries. Carry share is the
    // backfield equivalent of target share — for a back like Gibbs it's the
    // number that actually describes the role.
    const teamTgts = {}, teamCar = {};
    for (const P of Object.values(players)) {
      teamTgts[P.team] = (teamTgts[P.team] || 0) + (P.totals.tgt || 0);
      teamCar[P.team] = (teamCar[P.team] || 0) + (P.totals.car || 0);
    }
    for (const P of Object.values(players)) {
      P.totals.tgtShare = teamTgts[P.team] ? Number((P.totals.tgt / teamTgts[P.team]).toFixed(3)) : null;
      P.totals.carShare = teamCar[P.team] ? Number((P.totals.car / teamCar[P.team]).toFixed(3)) : null;
      // touches = carries + receptions, and its share of the team's touches
      P.totals.touches = (P.totals.car || 0) + (P.totals.rec || 0);
    }

    // Team per-game + ranks (offense: more = better; defense: fewer = better)
    const list = Object.entries(teams);
    const pg = (t, side, k) => (t.games ? t[side][k] / t.games : null);
    for (const [, t] of list) {
      t.offPg = { passYds: pg(t, "off", "passYds"), rushYds: pg(t, "off", "rushYds") };
      t.defPg = { passYds: pg(t, "def", "passYds"), rushYds: pg(t, "def", "rushYds") };
      t.ranks = {};
    }
    const rank = (key, get, dir) => {
      const arr = list.filter(([, t]) => get(t) != null).sort((a, b) => (dir === "asc" ? get(a[1]) - get(b[1]) : get(b[1]) - get(a[1])));
      arr.forEach(([, t], i) => { t.ranks[key] = i + 1; });
    };
    rank("offPassYds", (t) => t.offPg.passYds, "desc"); rank("offPassTd", (t) => t.off.passTd, "desc");
    rank("offRushYds", (t) => t.offPg.rushYds, "desc"); rank("offRushTd", (t) => t.off.rushTd, "desc");
    rank("defPassYds", (t) => t.defPg.passYds, "asc"); rank("defPassTd", (t) => t.def.passTd, "asc");
    rank("defRushYds", (t) => t.defPg.rushYds, "asc"); rank("defRushTd", (t) => t.def.rushTd, "asc");

    // Allowed by position: per game + rank (1 = stingiest)
    const allowed = {};
    for (const pos of ["RB", "WR", "TE"]) {
      const rows = list.map(([abbr, t]) => [abbr, t.games ? t.allowed[pos].td / t.games : null, t.games ? t.allowed[pos].yds / t.games : null]);
      const byTd = rows.filter((r) => r[1] != null).sort((a, b) => a[1] - b[1]);
      const byYds = rows.filter((r) => r[2] != null).sort((a, b) => a[2] - b[2]);
      for (const [abbr, tdPg, ydsPg] of rows) {
        (allowed[abbr] ??= {})[pos] = { tdPg: tdPg != null ? Number(tdPg.toFixed(2)) : null, ydsPg: ydsPg != null ? Math.round(ydsPg) : null,
          tdRank: byTd.findIndex((r) => r[0] === abbr) + 1 || null, ydsRank: byYds.findIndex((r) => r[0] === abbr) + 1 || null };
      }
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ season, weeksWithGames, players, teams, allowed, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ season, error: String(e.message || e), players: {}, teams: {}, allowed: {} });
  }
}
