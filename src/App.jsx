import { useState, useMemo, useEffect } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2025-2026";

// Salary bar colors by year type - change any hex you like.
const BAR_COLORS = {
  G: "#2563eb",    // guaranteed        (blue)
  PO: "#22c55e",   // player option     (green)
  TO: "#f59e0b",   // team option       (amber)
  NG: "#cbd5e1",   // non-guaranteed    (slate)
  PG: "#d2b48c",   // partially gtd     (tan)
  UFA: "#e2e8f0",  // free agent stub
  RFA: "#fecdd3",  // restricted stub
};
// Accent for the Total tile + featured contract border.
const ACCENT_TEXT = "text-emerald-600";
const ACCENT_BORDER = "border-emerald-200";

const TEAM_COLORS = {
  NY: "#1D428A", DAL: "#00538C", ATL: "#C8102E", OKC: "#007AC1",
  MIN: "#0C2340", DEN: "#0E2240", IND: "#FDBB30", BOS: "#007A33",
  PHI: "#006BB6", LAL: "#552583", GSW: "#FDB927", GS: "#FDB927",
  MIA: "#98002E", MIL: "#00471B", CHI: "#CE1141", CLE: "#860038",
  TOR: "#CE1141", BKN: "#000000", WSH: "#E31837", ORL: "#0077C0",
  CHA: "#1D1160", DET: "#C8102E", HOU: "#CE1141", SAS: "#C4CED4",
  MEM: "#5D76A9", NOP: "#0C2340", PHX: "#E56020", SAC: "#5A2D81",
  POR: "#E03A3E", UTA: "#002B5C", UTAH: "#002B5C", LAC: "#C8102E",
};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "atlanta hawks": "ATL", "boston celtics": "BOS", "brooklyn nets": "BKN",
  "charlotte hornets": "CHA", "chicago bulls": "CHI", "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL", "denver nuggets": "DEN", "detroit pistons": "DET",
  "golden state warriors": "GS", "houston rockets": "HOU", "indiana pacers": "IND",
  "los angeles clippers": "LAC", "la clippers": "LAC", "los angeles lakers": "LAL",
  "memphis grizzlies": "MEM", "miami heat": "MIA", "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN", "new orleans pelicans": "NOP",
  "new york knicks": "NY", "oklahoma city thunder": "OKC", "orlando magic": "ORL",
  "philadelphia 76ers": "PHI", "phoenix suns": "PHX", "portland trail blazers": "POR",
  "sacramento kings": "SAC", "san antonio spurs": "SAS", "toronto raptors": "TOR",
  "utah jazz": "UTAH", "washington wizards": "WSH",
};

function toAbbr(team) {
  if (!team) return "";
  const t = String(team).trim();
  if (TEAM_COLORS[t.toUpperCase()]) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}
const teamColor = (abbr) => TEAM_COLORS[String(abbr).toUpperCase()] || "#334155";
// Current-team color first; falls back to the contract team if no current team.
function playerHeaderColor(p) {
  if (HEADER_COLOR !== "team") return HEADER_COLOR;
  const current = toAbbr(p.teamName);
  if (current) return teamColor(current);
  const act = activeOf(p);
  return teamColor(act?.team || "");
}

const TYPE_LABEL = { G: "Guaranteed", PO: "Player Option", TO: "Team Option", NG: "Non-Guaranteed", PG: "Partially Gtd", UFA: "Free Agent", RFA: "Restricted FA" };
const BADGE = { PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-slate-500 dark:text-slate-400", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0] || null;

// Years in the league, computed from Draft Year vs the current season.
function latestStats(p) {
  return p.stats && p.stats.length > 0 ? p.stats[0] : null;
}
const fmt1 = (v) => (v == null ? null : Number(v).toFixed(1));

// Inclusive season count: drafted 2014 -> 2025-26 is season #12.
function experienceOf(p) {
  if (!p.draftYear) return "";
  const nowYear = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
  const seasons = nowYear - p.draftYear + 1;
  if (isNaN(seasons) || seasons < 1) return "";
  return seasons === 1 ? "Rookie" : seasons + " seasons";
}

// Search matches player name, current team (full name or abbreviation),
// or the active contract's team. "knicks", "NY", "jalen" all work.
function matchesQuery(p, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  if (p.name.toLowerCase().includes(s)) return true;
  const team = String(p.teamName || "").toLowerCase();
  if (team.includes(s)) return true;
  const abbr = toAbbr(p.teamName) || (activeOf(p) && activeOf(p).team) || "";
  if (String(abbr).toLowerCase().includes(s)) return true;
  const actTeam = activeOf(p) ? String(activeOf(p).team).toLowerCase() : "";
  if (actTeam.includes(s)) return true;
  for (const c of p.contracts) {
    if (String(c.kind).toLowerCase().includes(s)) return true;
  }
  return false;
}


// ═══════════════ SHARED PIECES ═══════════════════════════════════
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : "w-11 h-11 text-sm";
  if (p.photo) {
    return <img src={p.photo} alt={p.name} className={px + " rounded-full object-cover object-top bg-slate-200 shrink-0"} />;
  }
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={px + " rounded-full bg-slate-200 text-slate-500 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0"}>
      {label}
    </div>
  );
}

function Tile({ value, label, accent }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-2 py-4 text-center shadow-sm">
      <div className={"text-2xl font-extrabold tracking-tight " + (accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}</div>
      <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mt-1">{label}</div>
    </div>
  );
}

function SalaryBars({ years }) {
  const max = Math.max(...years.map((y) => y.salary ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-32 mt-2">
      {years.map((y, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
            {y.salary == null ? y.type : fmtM(y.salary)}
          </div>
          <div
            className="w-full rounded-t-md"
            style={{
              backgroundColor: BAR_COLORS[y.type] || BAR_COLORS.G,
              height: y.salary == null ? "6px" : Math.max((y.salary / max) * 100, 8) + "%",
            }}
          />
          <div className="text-[11px] font-semibold text-slate-400 mt-1">{y.s}</div>
        </div>
      ))}
    </div>
  );
}

function ContractCard({ c, big }) {
  return (
    <div className={"bg-white dark:bg-slate-900 rounded-2xl border shadow-sm px-4 py-4 " + (big ? ACCENT_BORDER : "border-slate-200 dark:border-slate-800")}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase truncate">
            {c.kind}{c.team ? " · " + c.team : ""}{c.signed ? " · " + c.signed : ""}
          </div>
          <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{terms(c)}</div>
        </div>
        <span className={"text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " + (c.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:text-slate-400")}>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years.filter((y) => y.type !== "G").map((y, i) => (
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (BADGE[y.type] || "bg-slate-100 text-slate-500 dark:text-slate-400")}>
            {y.season || y.s} · {TYPE_LABEL[y.type] || y.type}
            {y.decision ? " · " + y.decision : ""}
            {y.gtd != null ? " (" + fmtM(y.gtd) + " gtd)" : ""}
          </span>
        ))}
        {c.years.length > 0 && c.years.every((y) => y.type === "G") && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Fully guaranteed</span>
        )}
      </div>
    </div>
  );
}

function BioRow({ k, v }) {
  if (!v) return null;
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-slate-400 font-medium">{k}</span>
      <span className="text-slate-800 dark:text-slate-200 font-semibold">{v}</span>
    </div>
  );
}

// ═══════════════ PLAYER DETAIL ═══════════════════════════════════
function PlayerDetail({ p, onBack, backLabel, mode = "full" }) {
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
      <div className="px-5 pt-5 pb-6 text-white" style={{ backgroundColor: playerHeaderColor(p) }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ {backLabel}</button>
        <div className="flex items-center gap-4">
          <Avatar p={p} size="lg" />
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">
              {no ? "#" + no + " " : ""}{p.name}
            </div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {[p.pos, p.teamName].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {act && salaried(act).length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Tile value={fmtM(total(act))} label="Total" />
            <Tile value={fmtM(total(act) / salaried(act).length)} label="Per Year" />
            <Tile value={salaried(act).length} label="Years" />
          </div>
        )}

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height" v={p.height} />
              <BioRow k="Weight" v={p.weight} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(" · ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace} />
            </div>
          </>
        )}

        {act && salaried(act).length > 0 && (
          <div className="mt-4"><ContractCard c={act} big /></div>
        )}

        {past.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Contract history</div>
            <div className="flex flex-col gap-3">
              {past.map((c, i) => <ContractCard key={i} c={c} />)}
            </div>
          </>
        )}

        {mode === "full" && p.stats && p.stats.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Stats</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {p.stats.map((st, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{st.season || "—"}</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {fmt1(st.pts) ?? "—"} PTS · {fmt1(st.reb) ?? "—"} REB · {fmt1(st.ast) ?? "—"} AST
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {mode === "full" && p.awards && p.awards.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Awards</div>
            <div className="flex flex-wrap gap-1.5">
              {p.awards.map((a, i) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  🏆 {a}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════ LIST HEADER (shared) ════════════════════════════
function ListHeader({ title, q, setQ, placeholder }) {
  return (
    <div className="bg-blue-600 px-5 pt-6 pb-5 text-white sticky top-0 z-10 shadow-md">
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search players or teams…"}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/80 placeholder-slate-400 outline-none"
      />
    </div>
  );
}

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
function PlayersTab({ players, onSelect }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => players.filter((p) => matchesQuery(p, q)), [players, q]);
  return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.pos, p.archetype, p.age ? p.age + " yrs" : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>
              <TeamPill team={p.teamName || activeOf(p)?.team} />
              <span className="text-slate-300 shrink-0">›</span>
            </button>
          ))}
          {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TAB: CONTRACTS ══════════════════════════════════
function ContractsTab({ players, onSelect }) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      players
        .filter((p) => p.contracts.length > 0)
        .filter((p) => matchesQuery(p, q)),
    [players, q]
  );
  return (
    <div>
      <ListHeader title="Contracts" q={q} setQ={setQ} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => {
            const act = activeOf(p);
            return (
              <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {act ? displayLine(act) : "No contract"}
                  </span>
                </span>
                <TeamPill team={act?.team} />
                <span className="text-slate-300 shrink-0">›</span>
              </button>
            );
          })}
          {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}


// ═══════════════ TAB: TEAMS ══════════════════════════════════════
function teamOfPlayer(p) {
  return toAbbr(p.teamName) || (activeOf(p) ? toAbbr(activeOf(p).team) || activeOf(p).team : "");
}

function currentSalary(p) {
  const act = activeOf(p);
  if (!act) return 0;
  const yr = act.years.find((y) => y.season === CURRENT_SEASON && y.salary != null);
  if (yr) return yr.salary;
  const first = salaried(act)[0];
  return first ? first.salary : 0;
}

const ROLE_ORDER = ["Starter", "Bench", "Reserve", "Two-Way"];

function TeamsTab({ teams, players, onSelect }) {
  const [q, setQ] = useState("");
  const s = q.toLowerCase().trim();
  // Direct team-name matches, plus teams of any player whose name matches -
  // searching "Brunson" surfaces the Knicks.
  const playerTeamAbbrs = new Set(
    s
      ? players
          .filter((p) => p.name.toLowerCase().includes(s))
          .map((p) => teamOfPlayer(p))
          .filter(Boolean)
      : []
  );
  const list = teams.filter((t) => {
    if (!s) return true;
    if ((t.name + " " + t.abbr).toLowerCase().includes(s)) return true;
    const abbr = t.abbr || toAbbr(t.name);
    return playerTeamAbbrs.has(abbr);
  });
  return (
    <div>
      <ListHeader title="Teams" q={q} setQ={setQ} placeholder="Search teams or players…" />
      <div className="px-4 pb-28">
        {[
          ["Eastern Conference", list.filter((t) => String(t.conference).toLowerCase().startsWith("east"))],
          ["Western Conference", list.filter((t) => String(t.conference).toLowerCase().startsWith("west"))],
          ["Other", list.filter((t) => { const c = String(t.conference).toLowerCase(); return !c.startsWith("east") && !c.startsWith("west"); })],
        ]
          .filter(([, group]) => group.length > 0)
          .map(([label, group]) => (
            <div key={label}>
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{label}</div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {group.map((t) => {
                  const abbr = t.abbr || toAbbr(t.name);
                  return (
                    <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                      {t.logo ? (
                        <img src={t.logo} alt="" className="w-11 h-11 rounded-full object-contain bg-slate-100 dark:bg-slate-800 shrink-0" />
                      ) : (
                        <span className="w-11 h-11 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }} />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                        <span className="block text-[11px] text-slate-400 font-medium truncate">{t.division || "—"}</span>
                      </span>
                      {(t.wins != null || t.losses != null) && (
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 shrink-0">{t.wins ?? 0}-{t.losses ?? 0}</span>
                      )}
                      <span className="text-slate-300 shrink-0">›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No teams match "{q}".</div>}
      </div>
    </div>
  );
}


function StatusBadge({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  let cls = "bg-slate-100 text-slate-500 dark:text-slate-400";
  if (s.includes("active") || s.includes("available")) cls = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  else if (s.includes("out")) cls = "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300";
  else if (s.includes("injur") || s.includes("day") || s.includes("question") || s.includes("doubt")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {status}
    </span>
  );
}

function TeamDetail({ team, players, onBack, onSelectPlayer }) {
  const abbr = team.abbr || toAbbr(team.name);
  const roster = players.filter((p) => {
    if (p.teamId && p.teamId === team.id) return true; // exact Airtable link - no naming needed
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);

  const groups = {};
  for (const p of roster) {
    const role = ROLE_ORDER.includes(p.role) ? p.role : "Roster";
    (groups[role] ??= []).push(p);
  }
  const orderedRoles = [...ROLE_ORDER.filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
      <div className="px-5 pt-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr) }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Teams</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-16 h-16 rounded-full object-contain bg-white/20 shrink-0" />
          ) : (
            <span className="text-3xl">🏀</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">{team.name}</div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {[team.conference, team.division].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-2">
          <Tile value={(team.wins ?? 0) + "-" + (team.losses ?? 0)} label="Record" />
          <Tile value={fmtM(payroll)} label="Payroll" accent />
          <Tile value={roster.length} label="Players" />
        </div>

        {orderedRoles.map((role) => (
          <div key={role}>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {groups[role]
                .sort((a, b) => {
                  if (a.sort != null && b.sort != null) return a.sort - b.sort;
                  if (a.sort != null) return -1;
                  if (b.sort != null) return 1;
                  return currentSalary(b) - currentSalary(a);
                })
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <StatusBadge status={p.status} />
                      </span>
                      <span className="block text-[11px] text-slate-400 font-medium truncate">
                        {[p.pos, cleanNo(p.no) ? "#" + cleanNo(p.no) : ""].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {p.injuryNotes && (
                        <span className="block text-[11px] font-semibold text-red-500 truncate mt-0.5">{p.injuryNotes}</span>
                      )}
                    </span>
                    {(() => {
                      const st = latestStats(p);
                      if (st && (st.pts != null || st.reb != null || st.ast != null)) {
                        return (
                          <span className="text-right shrink-0">
                            <span className="block text-xs font-extrabold text-slate-700 dark:text-slate-200">{fmt1(st.pts) ?? "—"} PTS</span>
                            <span className="block text-[10px] font-semibold text-slate-400">
                              {fmt1(st.reb) ?? "—"} REB · {fmt1(st.ast) ?? "—"} AST
                            </span>
                          </span>
                        );
                      }
                      return currentSalary(p) > 0 ? (
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 shrink-0">{fmtM(currentSalary(p))}</span>
                      ) : null;
                    })()}
                    <span className="text-slate-300 shrink-0">›</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {roster.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No players linked to {team.name} yet.
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════ TAB: DRAFT ══════════════════════════════════════
function pickOf(p) {
  if (p.draftPick != null) return p.draftPick;
  const m = String(p.draft || "").match(/pick\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 999;
}

function DraftTab({ players, onSelect }) {
  const byYear = {};
  const noData = [];
  for (const p of players) {
    if (p.draftYear) (byYear[p.draftYear] ??= []).push(p);
    else noData.push(p);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const [selYear, setSelYear] = useState(null);
  const yr = selYear && byYear[selYear] ? selYear : years[0]; // default: newest class
  return (
    <div>
      <div className="bg-blue-600 pt-3 pb-4 px-4">
        <h1 className="text-3xl font-extrabold text-white mb-3">Draft</h1>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelYear(y)}
              className={
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors " +
                (y === yr ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-28 mt-4">
        {[yr].filter((y) => y != null).map((yr) => (
          <div key={yr}>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">
              {yr} Draft Class
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {byYear[yr]
                .sort((a, b) => pickOf(a) - pickOf(b))
                .map((p) => (
                  <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                      <span className="block text-[11px] text-slate-400 font-medium truncate">
                        {p.draft ||
                          [p.draftRound ? "Rd " + p.draftRound : "", pickOf(p) !== 999 ? "Pick " + pickOf(p) : ""]
                            .filter(Boolean)
                            .join(" · ") ||
                          "—"}
                      </span>
                    </span>
                    <TeamPill team={p.teamName || (activeOf(p) && activeOf(p).team)} />
                    <span className="text-slate-300 shrink-0">›</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {noData.length > 0 && (
          <div className="text-center text-xs text-slate-400 mt-8">
            {noData.length} player{noData.length === 1 ? "" : "s"} without draft data yet
          </div>
        )}
        {years.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No draft data yet. Fill in the Draft Year field in Airtable and classes will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ PLACEHOLDER TABS ════════════════════════════════
function ComingSoon({ icon, title, blurb }) {
  return (
    <div>
      <div className="bg-blue-600 px-5 pt-6 pb-5 text-white sticky top-0 z-10 shadow-md">
        <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      </div>
      <div className="px-8 pt-24 pb-28 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{title} is coming soon</div>
        <div className="text-sm text-slate-400 mt-2 leading-relaxed">{blurb}</div>
      </div>
    </div>
  );
}

// ═══════════════ APP SHELL ═══════════════════════════════════════
const TABS = [
  { id: "teams", label: "Teams", icon: "🏀" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "contracts", label: "Contracts", icon: "💰" },
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "draft", label: "Draft", icon: "🎓" },
];

export default function App() {
  const [tab, setTab] = useState("teams");
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selTeam, setSelTeam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else { setPlayers(d.players); setTeams(d.teams || []); } })
      .catch((e) => setError(String(e)));
  }, []);

  if (sel) {
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={tab === "contracts" ? "Contracts" : tab === "teams" ? (selTeam ? selTeam.name : "Teams") : "Players"}
        mode={tab === "contracts" ? "contracts" : "full"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <div className="text-center text-sm text-slate-400 pt-24">Loading…</div>}

      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={teams} players={players} onSelect={setSelTeam} />
      )}
      {players && tab === "teams" && selTeam && (
        <TeamDetail
          team={selTeam}
          players={players}
          onBack={() => setSelTeam(null)}
          onSelectPlayer={setSel}
        />
      )}
      {players && tab === "players" && <PlayersTab players={players} onSelect={setSel} />}
      {players && tab === "contracts" && <ContractsTab players={players} onSelect={setSel} />}
      {players && tab === "stats" && (
        <ComingSoon icon="📊" title="Stats" blurb="Season averages and leaderboards — waiting on the Stats table design in Airtable." />
      )}
      {players && tab === "draft" && <DraftTab players={players} onSelect={setSel} />}

      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSel(null); setSelTeam(null); }}
            className={"flex-1 py-2.5 text-center " + (tab === t.id ? "text-blue-600" : "text-slate-400")}
          >
            <div className="text-lg leading-none">{t.icon}</div>
            <div className="text-[10px] font-bold mt-1">{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
