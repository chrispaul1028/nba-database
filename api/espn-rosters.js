// /api/espn-rosters — every NBA roster from ESPN in one call: headshot,
// position (PG/SG/SF/PF/C), jersey number, height, per player. The app uses
// this the way the NFL app uses Sleeper: photos fill in automatically when
// the Airtable attachment is blank, and positions fill in when Airtable
// says just "G" or "F" (or nothing). Cached 6h — rosters don't move fast.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const ABBR_FIX = { SA: "SAS", NO: "NOP" };
// Same normalizer the app uses for name matching: strip accents, dots,
// apostrophes, Jr/Sr/II/III suffixes.
const nrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

export default async function handler(req, res) {
  try {
    const list = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=40");
    const teams = ((list.sports || [])[0]?.leagues?.[0]?.teams || []).map((x) => x.team).filter(Boolean);
    const rosters = await Promise.all(teams.map((t) =>
      getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${t.id}/roster`).catch(() => null)
    ));
    const players = {};
    teams.forEach((t, i) => {
      const raw = String(t.abbreviation || "").toUpperCase();
      const abbr = ABBR_FIX[raw] || raw;
      for (const a of (rosters[i]?.athletes || [])) {
        const name = a.fullName || a.displayName || "";
        if (!name) continue;
        const rec = {
          name,
          team: abbr,
          pos: String(a.position?.abbreviation || "").toUpperCase(),
          no: a.jersey || null,
          height: a.displayHeight || null,
          headshot: a.headshot?.href || null,
          age: a.age ?? null,
          injury: (a.injuries || [])[0]?.status || null,
          // ESPN's injury write-up + estimated return, when it has one
          injuryDetail: (() => { const inj = (a.injuries || [])[0]; if (!inj) return null; const d = inj.details || {}; return [d.side, d.type, d.detail].filter(Boolean).join(" ") || null; })(),
          injuryReturn: (a.injuries || [])[0]?.details?.returnDate || null,
          espnId: a.id,
        };
        players[nrm(name)] = rec;
        // second key: TEAM|lastname, for the odd spelling mismatch
        const last = nrm(name).split(" ").pop();
        players[abbr + "|" + last] ??= rec;
      }
    });
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ count: Object.keys(players).length, teams: teams.length, players, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
