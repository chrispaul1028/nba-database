// Vercel serverless function: fetches your Airtable base server-side and
// returns players with their contract history, shaped for the app.
// The Airtable token NEVER reaches the browser - it lives in Vercel env vars.
//
// Required environment variables (set in Vercel > Project > Settings > Environment Variables):
//   AIRTABLE_TOKEN    - personal access token from airtable.com/create/tokens
//   AIRTABLE_BASE_ID  - starts with "app...", from your base URL
//
// ── FIELD NAME CONFIG ──────────────────────────────────────────────
// If a name below doesn't match your base exactly, edit it here.
const T = {
  players: "Players",
  contracts: "Contracts",
  years: "Contract Years",
};
const F = {
  // Players table
  playerName: "Name",
  playerPos: "Position",
  playerNo: "No.",
  playerTeamName: "Team Name",
  playerStatus: "Status",
  // Contracts table
  cPlayer: "Player",        // link to Players
  cKind: "Contract Type",
  cStatus: "Status",
  cTeam: "Team",
  cSigned: "Signed Date",
  // Contract Years table
  yContract: "Contract",    // link to Contracts
  ySeason: "Season",
  ySalary: "Salary",
  yType: "Type",
};

const TYPE_MAP = {
  "Guaranteed": "G",
  "Player Option": "PO",
  "Team Option": "TO",
  "Non-Guaranteed": "NG",
  "UFA": "UFA",
  "RFA": "RFA",
};

async function fetchAll(base, table, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${table}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// "2028-2029" -> "'29"
function seasonLabel(s) {
  if (!s) return "";
  const parts = String(s).split("-");
  const end = parts[1] || parts[0];
  return "'" + String(end).slice(-2);
}

export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const base = process.env.AIRTABLE_BASE_ID;
    if (!token || !base) {
      return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env var" });
    }

    const [players, contracts, years] = await Promise.all([
      fetchAll(base, T.players, token),
      fetchAll(base, T.contracts, token),
      fetchAll(base, T.years, token),
    ]);

    // Group years by contract record id
    const yearsByContract = {};
    for (const y of years) {
      const linked = y.fields[F.yContract];
      const cid = Array.isArray(linked) ? linked[0] : null;
      if (!cid) continue;
      (yearsByContract[cid] ??= []).push({
        s: seasonLabel(y.fields[F.ySeason]),
        season: y.fields[F.ySeason] || "",
        salary: typeof y.fields[F.ySalary] === "number" ? y.fields[F.ySalary] / 1e6 : null,
        type: TYPE_MAP[y.fields[F.yType]] || y.fields[F.yType] || "G",
      });
    }

    // Group contracts by player record id
    const contractsByPlayer = {};
    for (const c of contracts) {
      const linked = c.fields[F.cPlayer];
      const pid = Array.isArray(linked) ? linked[0] : null;
      if (!pid) continue;
      const yrs = (yearsByContract[c.id] || []).sort((a, b) => a.season.localeCompare(b.season));
      const signedRaw = c.fields[F.cSigned];
      (contractsByPlayer[pid] ??= []).push({
        kind: c.fields[F.cKind] || "Contract",
        team: c.fields[F.cTeam] || "",
        status: c.fields[F.cStatus] || "Active",
        signed: signedRaw ? new Date(signedRaw).getFullYear() : null,
        years: yrs,
      });
    }

    const out = players
      .map((p) => ({
        id: p.id,
        name: p.fields[F.playerName] || "Unknown",
        pos: p.fields[F.playerPos] || "",
        no: p.fields[F.playerNo] ?? "",
        teamName: p.fields[F.playerTeamName] || "",
        status: p.fields[F.playerStatus] || "",
        contracts: (contractsByPlayer[p.id] || []).sort(
          (a, b) => (b.signed || 0) - (a.signed || 0)
        ),
      }))
      .filter((p) => p.contracts.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ players: out });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
