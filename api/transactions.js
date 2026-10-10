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

export default async function handler(req, res) {
  try {
    const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions?limit=200");
    const out = (d.transactions || []).map((t, i) => {
      const raw = String(t.team?.abbreviation || "").toUpperCase();
      return {
        id: t.id || String(i) + "-" + t.date,
        date: t.date || null,
        team: ABBR_FIX[raw] || raw,
        teamName: t.team?.displayName || "",
        text: t.description || "",
        kind: kindOf(t.description || ""),
      };
    });
    out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ count: out.length, records: out, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
