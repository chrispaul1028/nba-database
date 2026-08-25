// Vercel serverless function: pulls the NBA injury report from ESPN's public
// JSON feed and writes it into the Airtable Players table.
//
//   Status        -> "Active" | "Game Time Decision" | "IR"
//   Injury Notes  -> e.g. "Left Ankle Sprain (est. return Nov 12)"
//
// How a run works:
//   1. Fetch every player from Airtable + every injury from ESPN.
//   2. Match ESPN athletes to Airtable players by normalized name
//      (case, accents, punctuation and Jr./III suffixes ignored).
//   3. Players on the report -> Status + Injury Notes are set.
//      Players NOT on the report whose Status is blank/Active/GTD/IR
//      -> Status = Active, Injury Notes cleared.
//      Any other Status you set by hand (e.g. "Two-Way", "Suspended")
//      is left alone unless that player shows up on the report.
//   4. Only records that actually changed are written (batches of 10).
//
// Triggering:
//   - Vercel Cron (see vercel.json) sends  Authorization: Bearer <CRON_SECRET>
//   - Manually from a browser:  /api/sync-injuries?key=<CRON_SECRET>
//   - Dry run (shows the plan, writes nothing):  add  &dry=1
//
// Env vars: AIRTABLE_TOKEN (needs data.records:WRITE scope), AIRTABLE_BASE_ID,
//           CRON_SECRET (any long random string).
// Optional overrides: INJURY_STATUS_FIELD, INJURY_NOTES_FIELD

const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";

const TABLES = { players: "Players", teams: "Teams" };

// Candidate field names, matched fuzzily (same idea as contracts.js).
const CANDIDATES = {
  name: ["Name", "Player Name", "Full Name"],
  status: ["Status", "Player Status", "Availability"],
  injury: ["Injury Notes", "Injury Note", "Injury", "Injury Status", "Injury Report"],
  team: ["Team Name", "Team", "Current Team"],
  teamAbbr: ["TM", "Abbreviation", "Abbr", "Short Name", "Code"],
  teamName: ["Name", "Team Name", "Team"],
};

// The three values the sync manages.
const STATUS = { active: "Active", gtd: "Game Time Decision", ir: "IR" };

// Statuses the sync is allowed to overwrite back to "Active" when a player
// drops off the report. Normalized (lowercase, alphanumerics only).
const MANAGED = new Set([
  "", "active", "available", "healthy",
  "ir", "injuredreserve", "out",
  "gametimedecision", "gtd", "daytoday", "dtd", "questionable", "doubtful", "probable",
]);

// Put "(est. return Nov 12)" at the end of the note when ESPN has a date.
const INCLUDE_RETURN_DATE = true;

// ESPN abbreviations that differ from the common ones. Only used to break
// ties when two players in your base share a name.
const ESPN_ABBR = { GS: "GSW", NY: "NYK", NO: "NOP", SA: "SAS", UTAH: "UTA", WSH: "WAS", PHX: "PHX" };

// ---------------------------------------------------------------- helpers

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isRecId = (v) => typeof v === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v);

// "Nikola Jokić" / "De'Aaron Fox" / "Jaren Jackson Jr." all normalize cleanly.
function normName(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Find the real field name used in this base for a list of candidates.
function detectField(records, candidates, fallback) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r.fields || {})) keys.add(k);
  for (const cand of candidates) {
    for (const k of keys) if (norm(k) === norm(cand)) return k;
  }
  return fallback;
}

function getField(fields, candidates) {
  for (const cand of candidates) {
    for (const k of Object.keys(fields)) if (norm(k) === norm(cand)) return fields[k];
  }
  return undefined;
}

function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (typeof v === "object") return v.name || v.text || "";
  return String(v);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function airtableFetchAll(base, table, token) {
  const out = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable "${table}": ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

async function airtablePatch(base, table, token, records) {
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // typecast lets Airtable create the select options "Game Time Decision"
      // / "IR" the first time they're used.
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable write failed: ${res.status} ${await res.text()}`);
    if (i + 10 < records.length) await sleep(250); // stay under 5 req/sec
  }
}

// ------------------------------------------------------------ ESPN parsing

// ESPN groups by team: { injuries: [ { team, injuries: [athleteEntry,...] } ] }
// but be tolerant of a flat list too.
function flattenEspn(json) {
  const out = [];
  const walk = (item, team) => {
    if (!item || typeof item !== "object") return;
    if (item.athlete) {
      out.push({ ...item, teamAbbr: item.athlete?.team?.abbreviation || team?.abbreviation || "" });
      return;
    }
    if (Array.isArray(item.injuries)) for (const x of item.injuries) walk(x, item.team || team);
  };
  for (const item of json.injuries || []) walk(item, item.team);
  return out;
}

function mapStatus(entry) {
  const s = norm(entry.status);                       // "out", "daytoday", "questionable"...
  const t = norm(entry.type?.name);                   // "injurystatusout", ...
  if (s === "out" || t.endsWith("out")) return STATUS.ir;
  return STATUS.gtd;                                  // Day-To-Day, Questionable, Doubtful, Probable
}

function fmtDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
  return `${mon} ${d}`;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// "Left Ankle Sprain", "Hamstring Strain", "Abdomen Surgery", "Illness"
function buildNote(entry) {
  const d = entry.details || {};
  const clean = (v) => (v && !/not specified|unknown|n\/a|^none$/i.test(v) ? String(v).trim() : "");
  let parts = [clean(d.side), clean(d.type), clean(d.detail)].filter(Boolean);
  parts = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  let note = parts.join(" ");
  if (!note) {
    // Fall back to the "(ankle)" style tag in the headline, else the headline.
    const m = /\(([^)]+)\)/.exec(entry.shortComment || "");
    note = m ? cap(m[1]) : String(entry.shortComment || "").slice(0, 80);
  }
  if (INCLUDE_RETURN_DATE && d.returnDate) {
    const f = fmtDate(d.returnDate);
    if (f) note += ` (est. return ${f})`;
  }
  return note;
}

// ---------------------------------------------------------------- handler

export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const base = process.env.AIRTABLE_BASE_ID;
    const secret = process.env.CRON_SECRET;
    if (!token || !base) return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID" });

    // Auth: Vercel Cron sends the bearer header automatically; humans use ?key=
    const auth = req.headers.authorization || "";
    const key = req.query?.key;
    if (secret && auth !== `Bearer ${secret}` && key !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const dry = String(req.query?.dry || "") === "1";

    // 1. Load everything.
    const [players, espnRes] = await Promise.all([
      airtableFetchAll(base, TABLES.players, token),
      fetch(ESPN_URL, { headers: { "User-Agent": "nba-database-sync" } }),
    ]);
    if (!espnRes.ok) throw new Error(`ESPN ${espnRes.status}`);
    const espn = flattenEspn(await espnRes.json());

    // Optional Teams table -> lets us break name ties by team.
    const teamAbbrById = {};
    try {
      for (const t of await airtableFetchAll(base, TABLES.teams, token)) {
        teamAbbrById[t.id] = norm(asText(getField(t.fields, CANDIDATES.teamAbbr)) || asText(getField(t.fields, CANDIDATES.teamName)));
      }
    } catch { /* no Teams table - fine */ }

    const nameField = detectField(players, CANDIDATES.name, "Name");
    const statusField = process.env.INJURY_STATUS_FIELD || detectField(players, CANDIDATES.status, "Status");
    const notesField = process.env.INJURY_NOTES_FIELD || detectField(players, CANDIDATES.injury, "Injury Notes");

    // 2. Index Airtable players by normalized name.
    const byName = new Map();
    for (const p of players) {
      const n = normName(p.fields[nameField]);
      if (!n) continue;
      (byName.get(n) || byName.set(n, []).get(n)).push(p);
    }
    const teamOf = (p) => {
      const v = getField(p.fields, CANDIDATES.team);
      const id = Array.isArray(v) ? v[0] : v;
      return isRecId(id) ? teamAbbrById[id] || "" : norm(asText(v));
    };

    // 3. Decide the target state for every player.
    const target = new Map(); // recordId -> { status, note, espnName }
    const unmatched = [];
    for (const e of espn) {
      const espnName = e.athlete?.displayName || `${e.athlete?.firstName || ""} ${e.athlete?.lastName || ""}`;
      let matches = byName.get(normName(espnName)) || [];
      if (matches.length > 1) {
        const abbr = norm(ESPN_ABBR[e.teamAbbr] || e.teamAbbr);
        const narrowed = matches.filter((p) => teamOf(p) === abbr);
        if (narrowed.length) matches = narrowed;
      }
      if (!matches.length) { unmatched.push(`${espnName} (${e.teamAbbr})`); continue; }
      // If ESPN lists the same player twice, keep the most severe / newest.
      const rec = matches[0];
      const next = { status: mapStatus(e), note: buildNote(e), espnName, date: e.date || "" };
      const prev = target.get(rec.id);
      if (!prev || (prev.status !== STATUS.ir && next.status === STATUS.ir) || (prev.status === next.status && next.date > prev.date)) {
        target.set(rec.id, next);
      }
    }

    // 4. Build the update list (only real changes).
    const updates = [];
    const plan = [];
    for (const p of players) {
      const curStatus = asText(p.fields[statusField]);
      const curNote = asText(p.fields[notesField]).trim();
      const t = target.get(p.id);
      let nextStatus = curStatus, nextNote = curNote;

      if (t) {
        nextStatus = t.status;
        nextNote = t.note;
      } else if (MANAGED.has(norm(curStatus))) {
        nextStatus = STATUS.active;
        nextNote = "";
      }

      const fields = {};
      if (norm(nextStatus) !== norm(curStatus)) fields[statusField] = nextStatus;
      if (nextNote !== curNote) fields[notesField] = nextNote;
      if (Object.keys(fields).length) {
        updates.push({ id: p.id, fields });
        plan.push(`${asText(p.fields[nameField])}: ${curStatus || "(blank)"} -> ${nextStatus}${nextNote ? " | " + nextNote : ""}`);
      }
    }

    // 5. Write.
    if (!dry && updates.length) await airtablePatch(base, TABLES.players, token, updates);

    return res.status(200).json({
      ok: true,
      dryRun: dry,
      espnEntries: espn.length,
      matched: target.size,
      changed: updates.length,
      fields: { name: nameField, status: statusField, notes: notesField },
      changes: plan,
      unmatchedEspnPlayers: unmatched,
      ranAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
