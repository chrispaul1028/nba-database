// /api/season-stats — this season's per-game averages for every NBA player
// from ESPN's stats table (one request for the whole league). The app lays
// these over the Airtable Stats table as the current-season row, so stats
// move on their own as games are played. Cached 30 minutes.
//
// Optional: ?season=2027 (ESPN's season = the year it ends) · ?seasontype=1 for preseason

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

// ESPN stat name → app key
const KEYS = {
  gamesPlayed: "gp", avgMinutes: "min", avgPoints: "pts", avgRebounds: "reb", avgAssists: "ast",
  avgSteals: "stl", avgBlocks: "blk", avgTurnovers: "tov",
  fieldGoalPct: "fg", threePointFieldGoalPct: "p3", freeThrowPct: "ft",
  avgFieldGoalsMade: "fgm", avgFieldGoalsAttempted: "fga",
  avgThreePointFieldGoalsMade: "p3m", avgThreePointFieldGoalsAttempted: "p3a",
  avgFreeThrowsMade: "ftm", avgFreeThrowsAttempted: "fta",
  avgOffensiveRebounds: "oreb", avgDefensiveRebounds: "dreb", avgFouls: "pf", plusMinus: "pm",
};

// Box-score column label → app key (for live overlay from in-progress games)
const BOX = { MIN: "min", PTS: "pts", REB: "reb", AST: "ast", STL: "stl", BLK: "blk", TO: "tov", FG: "fg_", "3PT": "p3_", FT: "ft_" };
const splitMade = (v) => { const m = String(v || "").match(/^(\d+)-(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
const nrm = (s) => String(s || "").toLowerCase().replace(/[.'’-]/g, "").replace(/\s+/g, " ").trim();

export default async function handler(req, res) {
  try {
    const now = new Date();
    const season = Number(req.query?.season) || (now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
    const seasontype = Number(req.query?.seasontype) || 2;
    const base = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&season=${season}&seasontype=${seasontype}&limit=1000`;

    // How many regular-season games have actually been played per team (sanity check)
    const teamGP = {};
    try {
      const st = await getJson(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}&seasontype=2`);
      for (const g of st.children || []) for (const e of g.standings?.entries || []) {
        const raw = String(e.team?.abbreviation || "").toUpperCase(); const w = (e.stats || []).find((x) => x.name === "wins")?.value, l = (e.stats || []).find((x) => x.name === "losses")?.value;
        teamGP[ABBR_FIX[raw] || raw] = (Number(w) || 0) + (Number(l) || 0);
      }
    } catch {}
    const maxTeamGP = Math.max(0, ...Object.values(teamGP));

    // 1) Season averages for everyone. ESPN puts the column names on the
    //    top-level categories and only the values on each athlete.
    let tot = {};   // name → { gp, min_t, pts_t, … } running totals
    let page = 1, more = true;
    while (more && page <= 3) {
      const d = await getJson(base + `&page=${page}`);
      const catNames = {};
      for (const c of d.categories || []) catNames[c.name] = c.names || [];
      for (const a of d.athletes || []) {
        const ath = a.athlete || {};
        const avg = {};
        for (const cat of a.categories || []) {
          const names = cat.names || catNames[cat.name] || [];
          const vals = cat.values || [];
          names.forEach((n, i) => { const k = KEYS[n]; if (k && avg[k] == null) { const v = Number(vals[i]); if (!isNaN(v)) avg[k] = v; } });
        }
        const gp = avg.gp || 0;
        const raw = String(ath.teamShortName || ath.team?.abbreviation || "").toUpperCase();
        const rec = { id: ath.id, name: ath.displayName || ath.name || "", team: ABBR_FIX[raw] || raw, pos: ath.position?.abbreviation || "", headshot: ath.headshot?.href || null, gp,
          tot: {}, live: false };
        for (const k of ["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"]) rec.tot[k] = (avg[k] || 0) * gp;
        tot[nrm(rec.name)] = rec;
      }
      const pg = d.pagination || {};
      more = pg.page != null && pg.pages != null ? pg.page < pg.pages : (d.athletes || []).length >= 1000;
      page++;
    }

    // Sanity: if ESPN handed back a different season (early in the year its
    // table can still point at last spring's playoffs), nobody's GP would fit
    // the standings. In that case rebuild from this season's box scores.
    const stale = Object.values(tot).some((r) => r.gp > maxTeamGP + 1) || (maxTeamGP > 0 && !Object.values(tot).some((r) => r.gp > 0));
    const fromBox = stale || maxTeamGP <= 25;   // early season: box scores are the ground truth anyway
    if (fromBox) {
      tot = {};
      const start = new Date(season - 1, 9, 14), end = new Date();
      const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
      const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(start)}-${ymd(end)}&limit=1000`).catch(() => ({ events: [] }));
      const done = (sb.events || []).filter((e) => e.season?.type === 2 && e.competitions?.[0]?.status?.type?.completed);
      const addGame = (s) => {
        for (const tb of s?.boxscore?.players || []) {
          const grp = (tb.statistics || [])[0] || {}; const cols = grp.names || grp.labels || [];
          const raw = String(tb.team?.abbreviation || "").toUpperCase();
          for (const a of grp.athletes || []) {
            if (a.didNotPlay) continue;
            const name = a.athlete?.displayName || "";
            let rec = tot[nrm(name)];
            if (!rec) { rec = { id: a.athlete?.id, name, team: ABBR_FIX[raw] || raw, pos: a.athlete?.position?.abbreviation || "", headshot: a.athlete?.headshot?.href || null, gp: 0, tot: Object.fromEntries(["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"].map((k) => [k, 0])), live: false }; tot[nrm(name)] = rec; }
            rec.gp += 1;
            cols.forEach((c, i) => {
              const k = BOX[c]; if (!k) return; const v = a.stats?.[i];
              if (k.endsWith("_")) { const [m, att] = splitMade(v); const pfx = k.slice(0, -1); rec.tot[pfx + "m"] += m; rec.tot[pfx + "a"] += att; }
              else rec.tot[k] += Number(v) || 0;
            });
          }
        }
      };
      for (let i = 0; i < done.length; i += 8) {
        const chunk = done.slice(i, i + 8);
        const sums = await Promise.all(chunk.map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
        sums.forEach(addGame);
      }
    }

    // 2) Live overlay: games in progress right now aren't in the averages
    //    yet, so add each player's live line on top (gp + 1).
    try {
      const sb = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      const live = (sb.events || []).filter((e) => e.competitions?.[0]?.status?.type?.state === "in");
      const sums = await Promise.all(live.map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
      for (const s of sums) {
        for (const tb of s?.boxscore?.players || []) {
          const grp = (tb.statistics || [])[0] || {};
          const cols = grp.names || grp.labels || [];
          const raw = String(tb.team?.abbreviation || "").toUpperCase();
          for (const a of grp.athletes || []) {
            if (a.didNotPlay) continue;
            const name = a.athlete?.displayName || "";
            let rec = tot[nrm(name)];
            if (!rec) { rec = { id: a.athlete?.id, name, team: ABBR_FIX[raw] || raw, pos: a.athlete?.position?.abbreviation || "", headshot: a.athlete?.headshot?.href || null, gp: 0, tot: Object.fromEntries(["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"].map((k) => [k, 0])), live: false }; tot[nrm(name)] = rec; }
            rec.gp += 1; rec.live = true;
            cols.forEach((c, i) => {
              const k = BOX[c]; if (!k) return;
              const v = a.stats?.[i];
              if (k.endsWith("_")) { const [m, att] = splitMade(v); const pfx = k.slice(0, -1); rec.tot[pfx + "m"] += m; rec.tot[pfx + "a"] += att; }
              else rec.tot[k] += Number(v) || 0;
            });
          }
        }
      }
    } catch {}

    // 3) Back to per-game + percentages
    const players = Object.values(tot).filter((r) => r.gp > 0).map((r) => {
      const g = r.gp, t = r.tot;
      const pg = (k) => Math.round((t[k] / g) * 10) / 10;
      const pct = (m, a) => (t[a] ? Math.round((t[m] / t[a]) * 1000) / 10 : null);
      return { id: r.id, name: r.name, team: r.team, pos: r.pos, headshot: r.headshot, gp: g, live: r.live,
        min: pg("min"), pts: pg("pts"), reb: pg("reb"), ast: pg("ast"), stl: pg("stl"), blk: pg("blk"), tov: pg("tov"),
        fgm: pg("fgm"), fga: pg("fga"), p3m: pg("p3m"), p3a: pg("p3a"), ftm: pg("ftm"), fta: pg("fta"),
        fg: pct("fgm", "fga"), p3: pct("p3m", "p3a"), ft: pct("ftm", "fta") };
    });
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=240"); // 2-minute window
    return res.status(200).json({ season: `${season - 1}-${season}`, seasontype, source: fromBox ? "box scores" : "espn table", count: players.length, players, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
