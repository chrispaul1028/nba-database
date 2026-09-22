// /api/injuries — ESPN's NBA injury feed, flattened and newest-first.
// Each record: player, team, status, injury detail, estimated return, and
// ESPN's write-up. Cached 15 minutes.
//
// Lessons carried over from the NFL version of this feed:
//  - the feed nests as injuries[team].injuries[entry]
//  - the team level has an id + displayName but no abbreviation
//  - the athlete object has no id; it only appears in the player-card link

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const idFromLinks = (a) => {
  for (const l of a?.links || []) { const m = String(l.href || "").match(/\/id\/(\d+)/); if (m) return m[1]; }
  return a?.id || null;
};

export default async function handler(req, res) {
  try {
    const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries");
    const out = [];
    for (const team of d.injuries || []) {
      for (const e of team.injuries || []) {
        const a = e.athlete || {};
        const det = e.details || {};
        // "Right Ankle Sprain" → shown lowercase in parentheses by the app
        const detail = [det.side, det.type, det.detail].filter(Boolean).join(" ").trim() || null;
        out.push({
          id: e.id,
          espnId: idFromLinks(a),
          name: a.displayName || a.fullName || "",
          jersey: a.jersey || null,
          pos: String(a.position?.abbreviation || "").toUpperCase(),
          headshot: a.headshot?.href || null,
          team: team.displayName || "",
          teamId: team.id,
          status: e.status || null,                 // Out · Day-To-Day · Questionable · Doubtful …
          date: e.date || null,                     // when ESPN last updated this entry
          detail,
          returnDate: det.returnDate || null,
          comment: e.longComment || e.shortComment || null,
        });
      }
    }
    out.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ count: out.length, records: out, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
