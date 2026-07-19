// Vercel serverless function: fetches your Airtable base server-side and
// returns players with contract history, shaped for the app.
//
// Robustness features:
//  1. Link fields between tables are AUTO-DETECTED by following record ids,
//     so the names of your link fields don't matter at all.
//  2. Regular fields are matched case-insensitively, ignoring spaces and
//     punctuation - "Contract Type", "contract type", "ContractType" all work.
//
// Required env vars (Vercel > Project > Settings > Environment Variables):
//   AIRTABLE_TOKEN, AIRTABLE_BASE_ID

// ── Table names (edit only if your TABS are named differently) ─────
const TABLES = {
  players: "Players",
  contracts: "Contracts",
  years: "Contract Years",
};

// ── Field candidates: first match wins (normalized comparison) ─────
const FIELDS = {
  playerName: ["Name", "Player Name", "Full Name"],
  playerPos: ["Position", "Pos"],
  playerNo: ["No.", "No", "Number", "Jersey", "Jersey Number"],
  playerTeamName: ["Team Name", "Team", "Current Team"],
  cKind: ["Contract Type", "Kind", "Type", "Deal Type"],
  cStatus: ["Status", "Contract Status"],
  cTeam: ["Team", "Signing Team"],
  cSigned: ["Signed Date", "Signed", "Date Signed", "Signed Year"],
  ySeason: ["Season", "Year"],
  ySalary: ["Salary", "Amount", "Cap Hit"],
  yType: ["Type", "Year Type", "Guarantee"],
  yDecision: ["Decision", "Option Decision"],
  yGuaranteed: ["Guaranteed $", "Guaranteed", "Guaranteed Amount", "Gtd"],
};

const TYPE_MAP = {
  "guaranteed": "G",
  "player option": "PO",
  "team option": "TO",
  "non-guaranteed": "NG",
  "nonguaranteed": "NG",
  "partially guaranteed": "PG",
  "ufa": "UFA",
  "rfa": "RFA",
};

// normalize "Contract Type" -> "contracttype"
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function getField(fields, candidates) {
  const keys = Object.keys(fields);
  for (const cand of candidates) {
    const target = norm(cand);
    for (const k of keys) {
      if (norm(k) === target) return fields[k];
    }
  }
  return undefined;
}

async function fetchAll(base, table, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable table "${table}": ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// Find, among a record's fields, the first linked record id present in targetIds.
// Airtable link fields are arrays of "rec..." strings - the field name is irrelevant.
function findLink(fields, targetIds) {
  for (const val of Object.values(fields)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string" && item.startsWith("rec") && targetIds.has(item)) {
          return item;
        }
      }
    }
  }
  return null;
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
      fetchAll(base, TABLES.players, token),
      fetchAll(base, TABLES.contracts, token),
      fetchAll(base, TABLES.years, token),
    ]);

    const playerIds = new Set(players.map((p) => p.id));
    const contractIds = new Set(contracts.map((c) => c.id));

    const yearsByContract = {};
    for (const y of years) {
      const cid = findLink(y.fields, contractIds);
      if (!cid) continue;
      const rawSalary = getField(y.fields, FIELDS.ySalary);
      const rawType = getField(y.fields, FIELDS.yType);
      const rawGtd = getField(y.fields, FIELDS.yGuaranteed);
      const season = getField(y.fields, FIELDS.ySeason) || "";
      (yearsByContract[cid] ??= []).push({
        s: seasonLabel(season),
        season: String(season),
        salary: typeof rawSalary === "number" ? rawSalary / 1e6 : null,
        type: TYPE_MAP[norm(rawType || "")] || rawType || "G",
        decision: getField(y.fields, FIELDS.yDecision) || null,
        gtd: typeof rawGtd === "number" ? rawGtd / 1e6 : null,
      });
    }

    const contractsByPlayer = {};
    for (const c of contracts) {
      const pid = findLink(c.fields, playerIds);
      if (!pid) continue;
      const yrs = (yearsByContract[c.id] || []).sort((a, b) =>
        a.season.localeCompare(b.season)
      );
      const signedRaw = getField(c.fields, FIELDS.cSigned);
      let signed = null;
      if (typeof signedRaw === "number") signed = signedRaw;
      else if (signedRaw) {
        const d = new Date(signedRaw);
        if (!isNaN(d)) signed = d.getFullYear();
      }
      (contractsByPlayer[pid] ??= []).push({
        kind: getField(c.fields, FIELDS.cKind) || "Contract",
        team: getField(c.fields, FIELDS.cTeam) || "",
        status: getField(c.fields, FIELDS.cStatus) || "Active",
        signed,
        years: yrs,
      });
    }

    const out = players
      .map((p) => ({
        id: p.id,
        name: getField(p.fields, FIELDS.playerName) || "Unknown",
        pos: getField(p.fields, FIELDS.playerPos) || "",
        no: getField(p.fields, FIELDS.playerNo) ?? "",
        teamName: getField(p.fields, FIELDS.playerTeamName) || "",
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
