// /api/scoreboard — this week's NFL games with live scores, kickoff times,
// records, and betting lines, from ESPN's public scoreboard. Cached 60s so
// live games tick along without hammering ESPN.
//
// Optional: /api/scoreboard?week=3 for a specific week of the current season.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

function side(comp, homeAway) {
  const c = (comp.competitors || []).find((x) => x.homeAway === homeAway) || {};
  const t = c.team || {};
  const rec = (c.records || []).find((r) => r.type === "total" || r.name === "overall") || (c.records || [])[0];
  return {
    id: t.id,
    abbr: String(t.abbreviation || "").toUpperCase(),
    name: t.displayName || t.name || "",
    short: t.shortDisplayName || t.name || "",
    logo: t.logo || null,
    color: t.color ? "#" + t.color : null,
    altColor: t.alternateColor ? "#" + t.alternateColor : null,
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    record: rec ? rec.summary : null,
    winner: !!c.winner,
  };
}

// ── Team schedule mode: /api/scoreboard?team=BUF ─────────────────────────
// One team's full regular season from ESPN's team-schedule feed: week, date,
// opponent, home/away, final score + W/L, and TV network. Bye weeks are the
// week numbers missing between 1 and the last week.
const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "object") v = v.value ?? v.displayValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function networkOf(comp, ev) {
  const names = [];
  for (const b of [...(comp.broadcasts || []), ...(comp.geoBroadcasts || []), ...(ev.broadcasts || [])]) {
    if (Array.isArray(b.names)) names.push(...b.names);
    const m = b.media || {};
    if (m.shortName) names.push(m.shortName);
    else if (b.shortName) names.push(b.shortName);
  }
  const uniq = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  return uniq.length ? uniq.slice(0, 2).join(" / ") : null;
}
async function teamSchedule(team, season) {
  const t = String(team).toLowerCase() === "was" ? "wsh" : String(team).toLowerCase();
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${encodeURIComponent(t)}/schedule?seasontype=2${season ? `&season=${encodeURIComponent(season)}` : ""}`;
  let d;
  for (let i = 0; i < 3; i++) {   // retry like the other feeds
    try { d = await getJson(url); break; } catch (e) { if (i === 2) throw e; await new Promise((ok) => setTimeout(ok, 400 * (i + 1))); }
  }
  const me = String(team).toUpperCase();
  const isMe = (abbr) => { const a = String(abbr || "").toUpperCase(); return a === me || (me === "WAS" && a === "WSH") || (me === "WSH" && a === "WAS"); };
  const games = (d.events || []).map((ev) => {
    const comp = (ev.competitions || [])[0] || {};
    const cs = comp.competitors || [];
    const mine = cs.find((c) => isMe(c.team && c.team.abbreviation)) || cs[0] || {};
    const opp = cs.find((c) => c !== mine) || {};
    const ot = opp.team || {};
    const st = (comp.status || ev.status || {}).type || {};
    const done = !!st.completed || st.state === "post";
    const my = num(mine.score), their = num(opp.score);
    return {
      week: ev.week && ev.week.number != null ? Number(ev.week.number) : null,
      date: ev.date || comp.date || null,
      timeValid: ev.timeValid !== false && comp.timeValid !== false,
      home: mine.homeAway === "home",
      neutral: !!comp.neutralSite,
      opp: String(ot.abbreviation || "").toUpperCase(),
      oppName: ot.displayName || ot.shortDisplayName || ot.name || "",
      oppLogo: (ot.logos && ot.logos[0] && ot.logos[0].href) || ot.logo || null,
      state: done ? "post" : st.state || "pre",
      detail: st.shortDetail || st.detail || null,
      my: done || st.state === "in" ? my : null,
      their: done || st.state === "in" ? their : null,
      result: done && my != null && their != null ? (my > their ? "W" : my < their ? "L" : "T") : null,
      tv: networkOf(comp, ev),
    };
  }).filter((g) => g.week != null).sort((a, b) => a.week - b.week);
  // Byes: any week number missing between the first and last game
  const weeks = new Set(games.map((g) => g.week));
  const last = games.length ? games[games.length - 1].week : 0;
  for (let w = 1; w <= last; w++) if (!weeks.has(w)) games.push({ week: w, bye: true });
  games.sort((a, b) => a.week - b.week);
  return { team: me, season: d.requestedSeason && d.requestedSeason.year ? d.requestedSeason.year : season || null, games };
}

export default async function handler(req, res) {
  if (req.query && req.query.team) {
    try {
      const out = await teamSchedule(req.query.team, req.query.season);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json(out);
    } catch (e) {
      return res.status(502).json({ error: String(e.message || e) });
    }
  }
  try {
    const week = req.query && req.query.week ? `&week=${encodeURIComponent(req.query.week)}` : "";
    const d = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2${week}`);

    const games = (d.events || []).map((ev) => {
      const comp = (ev.competitions || [])[0] || {};
      const st = comp.status || ev.status || {};
      const type = st.type || {};
      const odds = (comp.odds || [])[0] || null;
      const sit = comp.situation || {};
      return {
        id: ev.id,
        date: ev.date,                              // ISO kickoff
        state: type.state || "pre",                 // pre | in | post
        detail: type.shortDetail || type.detail || "", // "Sun 1:00 PM" / "Final" / "Q3 7:42"
        completed: !!type.completed,
        period: st.period ?? null,
        clock: st.displayClock ?? null,
        home: side(comp, "home"),
        away: side(comp, "away"),
        venue: comp.venue?.fullName || null,
        broadcast: ((comp.broadcasts || [])[0]?.names || [])[0] || null,
        odds: odds ? { details: odds.details || null, overUnder: odds.overUnder ?? null, spread: odds.spread ?? null,
          homeML: odds.homeTeamOdds?.moneyLine ?? null, awayML: odds.awayTeamOdds?.moneyLine ?? null,
          homeFav: !!odds.homeTeamOdds?.favorite, awayFav: !!odds.awayTeamOdds?.favorite } : null,
        possession: sit.possession || null,         // team id with the ball (live)
        downDistance: sit.shortDownDistanceText || null,
        spot: sit.possessionText || null,               // e.g. "WAS 6"
        redZone: !!sit.isRedZone,
        // Timeouts left this half. ESPN publishes them on the live situation;
        // null before kickoff so the card can hide the pips.
        homeTimeouts: sit.homeTimeouts ?? null,
        awayTimeouts: sit.awayTimeouts ?? null,
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      week: d.week?.number ?? null,
      season: d.season?.year ?? null,
      games,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
