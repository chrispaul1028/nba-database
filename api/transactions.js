// /api/transactions — league-wide NBA transactions from ESPN (signings,
// waivers, options exercised/declined, trades, two-way conversions),
// newest first. Cached 15 minutes.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

const kindOf = (t) => {
  const s = t.toLowerCase();
  if (/exercised/.test(s)) return "Option exercised";
  if (/declined/.test(s)) return "Option declined";
  if (/waived|released/.test(s)) return "Waived";
  if (/traded|acquired/.test(s)) return "Trade";
  if (/two-way/.test(s)) return "Two-way";
  if (/signed|re-signed|extension/.test(s)) return "Signing";
  if (/assigned|recalled/.test(s)) return "G League";
  return "Transaction";
};

// ESPN team ids, for the per-team feed (?team=NY) which goes back much
// further than the league-wide list.
const TEAM_IDS = { ATL: 1, BOS: 2, NOP: 3, NO: 3, CHI: 4, CLE: 5, DAL: 6, DEN: 7, DET: 8, GSW: 9, GS: 9, HOU: 10, IND: 11, LAC: 12, LAL: 13, MIA: 14, MIL: 15, MIN: 16, BKN: 17, BRK: 17, NY: 18, NYK: 18, ORL: 19, PHI: 20, PHX: 21, PHO: 21, POR: 22, SAC: 23, SAS: 24, SA: 24, OKC: 25, UTAH: 26, UTA: 26, WSH: 27, WAS: 27, TOR: 28, MEM: 29, CHA: 30, CHO: 30 };

export default async function handler(req, res) {
  try {
    const team = String(req.query?.team || "").toUpperCase();
    const url = team && TEAM_IDS[team]
      ? `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${TEAM_IDS[team]}/transactions?limit=500`
      : "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=1000";
    let d = await getJson(url).catch(() => ({ transactions: [] }));
    if (team && !(d.transactions || []).length) {
      // ESPN's per-team feed is sometimes empty — fall back to the league feed filtered to this team
      const all = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=1000").catch(() => ({ transactions: [] }));
      const id = TEAM_IDS[team];
      d = { transactions: (all.transactions || []).filter((t) => String(t.team?.id) === String(id) || String(t.team?.abbreviation || "").toUpperCase() === team) };
    }
    // ESPN bundles a team's moves for the day into one description
    // ("Signed X. Waived Y. Converted Z…"). Split into one record per move so
    // each gets the right tag.
    const out = [];
    for (const [i, t] of (d.transactions || []).entries()) {
      const raw = String(t.team?.abbreviation || team || "").toUpperCase();
      const sentences = String(t.description || "").split(/(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
      for (const [j, text] of (sentences.length ? sentences : [t.description || ""]).entries()) {
        out.push({
          id: (t.id || String(i) + "-" + t.date) + "-" + j,
          date: t.date || null,
          team: ABBR_FIX[raw] || raw,
          teamName: t.team?.displayName || "",
          text,
          kind: kindOf(text),
        });
      }
    }
    out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ count: out.length, records: out, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
