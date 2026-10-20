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

export default async function handler(req, res) {
  try {
    const now = new Date();
    const season = Number(req.query?.season) || (now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
    const seasontype = Number(req.query?.seasontype) || 2;
    const base = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&season=${season}&seasontype=${seasontype}&limit=1000`;
    const players = [];
    let page = 1, more = true;
    while (more && page <= 3) {
      const d = await getJson(base + `&page=${page}`);
      for (const a of d.athletes || []) {
        const ath = a.athlete || {};
        const row = {};
        for (const cat of a.categories || []) {
          const names = cat.names || [], vals = cat.values || cat.displayValues || [];
          names.forEach((n, i) => { const k = KEYS[n]; if (k && row[k] == null) { const v = Number(vals[i]); if (!isNaN(v)) row[k] = v; } });
        }
        const raw = String(ath.teamShortName || ath.team?.abbreviation || "").toUpperCase();
        players.push({
          id: ath.id, name: ath.displayName || ath.name || "", team: ABBR_FIX[raw] || raw,
          pos: ath.position?.abbreviation || "", headshot: ath.headshot?.href || null,
          ...row,
        });
      }
      const pg = d.pagination || {};
      more = pg.page != null && pg.pages != null ? pg.page < pg.pages : (d.athletes || []).length >= 1000;
      page++;
    }
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ season: `${season - 1}-${season}`, seasontype, count: players.length, players, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
