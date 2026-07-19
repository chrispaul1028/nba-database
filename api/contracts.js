// Vercel serverless function: fetches your Airtable base server-side and
// returns ALL players (for the Player Hub) with bio, photo, and contract
// history (for the Contracts tab).
//
// Robustness:
//  1. Link fields between tables are AUTO-DETECTED by record ids.
//  2. Field names are matched fuzzily (case/space/punctuation-insensitive)
//     against candidate lists below.
//  3. Linked "Team Name" values (record ids) are resolved via the Teams table.
//
// Env vars required: AIRTABLE_TOKEN, AIRTABLE_BASE_ID

const TABLES = {
  players: "Players",
  contracts: "Contracts",
  years: "Contract Years",
  teams: "Teams", // optional - used to resolve linked team names
};

const FIELDS = {
  playerName: ["Name", "Player Name", "Full Name"],
  playerPos: ["Position", "Pos"],
  playerNo: ["No.", "No", "Number", "Jersey", "Jersey Number"],
  playerTeamName: ["Team Name", "Team", "Current Team"],
  playerPhoto: ["Photo", "Headshot", "Headshots", "Player Photo", "Image", "Img", "Pic", "Picture", "Attachment", "Attachments"],
  playerHeight: ["Height"],
  playerWeight: ["Weight"],
  playerAge: ["Age"],
  playerStatus: ["Status"],
  playerArchetype: ["Archetype", "Player Type", "Play Style"],
  playerRole: ["Role", "Depth Chart", "Depth", "Lineup Role", "Rotation"],
  playerSort: ["Sort Priority", "Sort", "Priority", "Depth Order", "Order"],
  playerDraft: ["Draft", "Draft Info", "Drafted"],
  playerDraftYear: ["Draft Year"],
  playerBirthplace: ["Birthplace", "Birth Place", "Born", "Hometown"],
  playerAwards: ["Awards", "Accolades", "Honors"],
  teamConference: ["Conference", "Conf"],
  teamDivision: ["Division", "Div"],
  teamWins: ["W", "Wins"],
  teamLosses: ["L", "Losses"],
  teamName: ["Name", "Team Name", "Team"],
  teamAbbr: ["Abbreviation", "Abbr", "Short Name", "Code"],
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

// Keys are normalized (lowercase, no spaces/punctuation) to match norm()
const TYPE_MAP = {
  "guaranteed": "G",
  "playeroption": "PO",
  "teamoption": "TO",
  "nonguaranteed": "NG",
  "partiallyguaranteed": "PG",
  "ufa": "UFA",
  "rfa": "RFA",
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const isRecId = (v) => typeof v === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v);

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

// Returns a clean string; resolves linked record ids via resolver map;
// never lets a raw rec id through.
function asText(val, resolver) {
  if (val == null) return "";
  if (Array.isArray(val)) {
    const parts = val
      .map((v) => asText(v, resolver))
      .filter(Boolean);
    return parts.join(", ");
  }
  if (isRecId(val)) return (resolver && resolver[val]) || "";
  return String(val);
}

function photoUrl(val) {
  if (Array.isArray(val) && val[0] && typeof val[0] === "object" && val[0].url) {
    const att = val[0];
    return (att.thumbnails && att.thumbnails.large && att.thumbnails.large.url) || att.url;
  }
  return null;
}

// Fallback: scan every field for an attachment-shaped value (array of
// objects with a url). Finds the headshot no matter what the field is named.
function findAnyPhoto(fields) {
  for (const val of Object.values(fields)) {
    const url = photoUrl(val);
    if (url) return url;
  }
  return null;
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

function findLink(fields, targetIds) {
  for (const val of Object.values(fields)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isRecId(item) && targetIds.has(item)) return item;
      }
    }
  }
  return null;
}

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

    // Teams table is optional - used only to translate linked ids to names.
    let teamNameById = {};
    let teamsOut = [];
    try {
      const teams = await fetchAll(base, TABLES.teams, token);
      for (const t of teams) {
        const abbr = asText(getField(t.fields, FIELDS.teamAbbr));
        const name = asText(getField(t.fields, FIELDS.teamName));
        teamNameById[t.id] = abbr || name || "";
        teamsOut.push({
          id: t.id,
          name: name || abbr,
          abbr,
          conference: asText(getField(t.fields, FIELDS.teamConference)),
          division: asText(getField(t.fields, FIELDS.teamDivision)),
          wins: getField(t.fields, FIELDS.teamWins) ?? null,
          losses: getField(t.fields, FIELDS.teamLosses) ?? null,
          logo: findAnyPhoto(t.fields),
        });
      }
      teamsOut.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } catch {
      teamNameById = {};
      teamsOut = [];
    }

    const playerIds = new Set(players.map((p) => p.id));
    const contractIds = new Set(contracts.map((c) => c.id));

    const yearsByContract = {};
    for (const y of years) {
      const cid = findLink(y.fields, contractIds);
      if (!cid) continue;
      const rawSalary = getField(y.fields, FIELDS.ySalary);
      const rawType = asText(getField(y.fields, FIELDS.yType));
      const rawGtd = getField(y.fields, FIELDS.yGuaranteed);
      const season = asText(getField(y.fields, FIELDS.ySeason));
      (yearsByContract[cid] ??= []).push({
        s: seasonLabel(season),
        season,
        salary: typeof rawSalary === "number" ? rawSalary / 1e6 : null,
        type: TYPE_MAP[norm(rawType)] || rawType || "G",
        decision: asText(getField(y.fields, FIELDS.yDecision)) || null,
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
        kind: asText(getField(c.fields, FIELDS.cKind), teamNameById) || "Contract",
        team: asText(getField(c.fields, FIELDS.cTeam), teamNameById),
        status: asText(getField(c.fields, FIELDS.cStatus)) || "Active",
        signed,
        years: yrs,
      });
    }

    const out = players
      .map((p) => ({
        id: p.id,
        name: asText(getField(p.fields, FIELDS.playerName)) || "Unknown",
        pos: asText(getField(p.fields, FIELDS.playerPos)),
        no: asText(getField(p.fields, FIELDS.playerNo)),
        teamName: asText(getField(p.fields, FIELDS.playerTeamName), teamNameById),
        photo: photoUrl(getField(p.fields, FIELDS.playerPhoto)) || findAnyPhoto(p.fields),
        height: asText(getField(p.fields, FIELDS.playerHeight)),
        weight: asText(getField(p.fields, FIELDS.playerWeight)),
        age: asText(getField(p.fields, FIELDS.playerAge)),
        status: asText(getField(p.fields, FIELDS.playerStatus)),
        archetype: asText(getField(p.fields, FIELDS.playerArchetype)),
        role: asText(getField(p.fields, FIELDS.playerRole)),
        sort: (() => { const v = getField(p.fields, FIELDS.playerSort); return typeof v === "number" ? v : null; })(),
        draft: asText(getField(p.fields, FIELDS.playerDraft)),
        draftYear: (() => { const v = getField(p.fields, FIELDS.playerDraftYear); return typeof v === "number" ? v : null; })(),
        birthplace: asText(getField(p.fields, FIELDS.playerBirthplace)),
        awards: (() => { const v = getField(p.fields, FIELDS.playerAwards); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && !isRecId(x)) : (v ? [String(v)] : []); })(),
        contracts: (contractsByPlayer[p.id] || []).sort(
          (a, b) => (b.signed || 0) - (a.signed || 0)
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ players: out, teams: teamsOut });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
