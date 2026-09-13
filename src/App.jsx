import React, { useState, useMemo, useEffect } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2026-2027"; // league year — bump every July

// Salary bar colors by year type - change any hex you like.
const BAR_COLORS = {
  G: "#2563eb",    // guaranteed        (blue)
  PO: "#22c55e",   // player option     (green)
  TO: "#dc2626",   // team option       (red)
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
  CHA: "#1D1160", DET: "#1D42BA", HOU: "#CE1141", SAS: "#000000",
  MEM: "#5D76A9", NOP: "#0C2340", PHX: "#E56020", SAC: "#5A2D81",
  POR: "#E03A3E", UTA: "#002B5C", UTAH: "#002B5C", LAC: "#C8102E",
  SA: "#000000", NO: "#0C2340", // ESPN spellings
};
// Secondary color per team (free-throw circle, and the center circle for
// teams whose logo is the same color as their primary).
const TEAM_COLORS2 = {
  NY: "#F58426", DAL: "#B8C4CA", ATL: "#FDB927", OKC: "#EF6024",
  MIN: "#236192", DEN: "#FEC524", IND: "#002D62", BOS: "#BA9653",
  PHI: "#ED174C", LAL: "#FDB927", GSW: "#1D428A", GS: "#1D428A",
  MIA: "#F9A01B", MIL: "#EEE1C6", CHI: "#000000", CLE: "#FDBB30",
  TOR: "#000000", BKN: "#FFFFFF", WSH: "#002B5C", ORL: "#C4CED4",
  CHA: "#00788C", DET: "#C8102E", HOU: "#000000", SAS: "#C4CED4",
  MEM: "#12173F", NOP: "#C8102E", PHX: "#1D1160", SAC: "#63727A",
  POR: "#000000", UTA: "#F9A01B", UTAH: "#F9A01B", LAC: "#1D428A",
  SA: "#C4CED4", NO: "#C8102E",
};
const teamColor2 = (abbr) => TEAM_COLORS2[String(abbr || "").toUpperCase()] || "#F59E0B";
// Teams whose logo is mostly the primary color — the center circle uses the
// secondary color for them so the logo doesn't disappear into it.
const FLIP_CENTER = new Set(["HOU", "CHI", "MIA", "TOR", "ATL", "POR", "WSH", "IND", "NOP", "NO", "DAL", "ORL", "MEM", "CLE", "LAC", "DET", "MIN", "UTAH", "UTA", "BKN", "SAS", "SA"]);
const centerColor = (abbr) => (FLIP_CENTER.has(String(abbr || "").toUpperCase()) ? teamColor2(abbr) : teamColor(abbr));

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
const BADGE = { PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-blue-700", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
// Same line, but the signing team shows as a small logo instead of "(ATL)".
function ContractLine({ c }) {
  const abbr = toAbbr(c.team) || String(c.team || "").toUpperCase();
  const logo = abbr ? TEAM_LOGOS[abbr] : null;
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="shrink-0">{terms(c)}</span>
      {abbr && (logo
        ? <img src={logo} alt={abbr} title={c.team} className="w-4 h-4 rounded-full object-contain bg-white shrink-0" />
        : <span className="text-[9px] font-extrabold text-slate-400 shrink-0">{abbr}</span>)}
      <span className="truncate">· {c.kind}</span>
    </span>
  );
}
// Free-agency deadline for a contract: the Contract Years row typed UFA/RFA
// (the empty year after the last paid one). An Airtable Deadline on that
// row wins; otherwise free agency opens June 30 of that summer.
function faDeadline(c) {
  const rows = (c.years || []).filter((y) => /^(UFA|RFA)$/i.test(String(y.type || "")) && startYear(y.season) != null)
    .sort((a, b) => startYear(a.season) - startYear(b.season));
  const y = rows[0];
  if (!y) return null;
  const dl = eventDeadline({ kind: String(y.type).toUpperCase(), season: y.season, deadline: y.deadline || null });
  return dl ? dl.label : null;
}
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0] || null;

// Years in the league, computed from Draft Year vs the current season.
function latestStats(p) {
  return p.stats && p.stats.length > 0 ? p.stats[0] : null;
}
// The season before the latest one (for trend arrows)
function prevStats(p) {
  return p.stats && p.stats.length > 1 ? p.stats[1] : null;
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


// ═══════════════ ESPN ROSTER FEED (photos + positions) ═══════════
// Filled once from /api/espn-rosters. Airtable still wins when it has a
// value; ESPN fills the blanks — a missing headshot, or a Position that
// only says "G" / "F".
const ESPN_BY_NAME = {};
const espnNrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
function espnOf(p) {
  if (!p) return null;
  const hit = ESPN_BY_NAME[espnNrm(p.name)];
  if (hit) return hit;
  const team = teamOfPlayer(p);
  return team ? ESPN_BY_NAME[String(team).toUpperCase() + "|" + espnNrm(p.name).split(" ").pop()] || null : null;
}
const photoOf = (p) => p.photo || espnOf(p)?.headshot || null;
// Injury write-up for a player: the Airtable Injury Notes field, else ESPN's
// description; plus ESPN's estimated return date when it publishes one.
function injuryLine(p) {
  const e = espnOf(p);
  const note = p.injuryNotes || e?.injuryDetail || "";
  const ret = e?.injuryReturn ? new Date(e.injuryReturn) : null;
  const retTxt = ret && !isNaN(ret) ? "est. return " + ret.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
  return [note, retTxt].filter(Boolean).join(" · ");
}
const isActiveStatus = (p) => { const st = String(p.status || "").toLowerCase(); return !st || st.includes("active") || st.includes("available"); };
const GENERIC_POS = new Set(["", "G", "F", "G-F", "F-G", "F-C", "C-F", "G/F", "F/C", "GUARD", "FORWARD", "WING", "BIG"]);
// Court position: Airtable's exact label (PG/SG/SF/PF/C) if it has one,
// otherwise ESPN's, otherwise whatever Airtable said.
function courtPos(p) {
  const a = String(p.pos || "").toUpperCase().replace(/\s+/g, "");
  if (!GENERIC_POS.has(a)) return a;
  const e = espnOf(p)?.pos;
  return e && !GENERIC_POS.has(e) ? e : a;
}
// Height in inches from "6-7", "6'7", "6 ft 7 in", "6'7\"" — used only as a
// tie-break when two forwards both qualify for the same slot.
function heightIn(p) {
  const m = String(p.height || espnOf(p)?.height || "").match(/(\d)\D+(\d{1,2})/);
  return m ? Number(m[1]) * 12 + Number(m[2]) : null;
}

const SWIPE_DEPTH = { n: 0 }; // how many teams deep the swipe trail goes
function useSwipe(onLeft, onRight) {
  const start = React.useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      const s0 = start.current; start.current = null;
      if (!s0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
      if (Date.now() - s0.t > 600) return;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx > 0) onRight && onRight(); else onLeft && onLeft();
    },
  };
}

// ═══════════════ SHARED PIECES ═══════════════════════════════════
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : "w-11 h-11 text-sm";
  const url = photoOf(p);
  if (url) {
    return <img src={url} alt={p.name} loading="lazy" className={px + " rounded-full object-cover object-top bg-slate-200 shrink-0"} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
  }
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={px + " rounded-full bg-slate-200 text-slate-500 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0"}>
      {label}
    </div>
  );
}


function rankOf(teams, team, key, dir) {
  if (!teams || team[key] == null) return null;
  const vals = teams.filter((t) => t[key] != null);
  if (vals.length < 2) return null;
  const sorted = vals.slice().sort((a, b) => (dir === "asc" ? a[key] - b[key] : b[key] - a[key]));
  const rank = sorted.findIndex((t) => t.id === team.id) + 1;
  if (!rank) return null;
  const cls =
    rank <= 10 ? "text-green-600 dark:text-green-400"
    : rank <= 20 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return { label: "(" + ordinal(rank) + ")", cls };
}

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + "th";
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + suffix;
}

function Tile({ value, label, sub, accent, valueClass, onClick, active, activeColor }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={"relative bg-white dark:bg-slate-900 rounded-2xl border px-2 py-4 text-center shadow-sm flex flex-col items-center justify-center w-full " + (active ? "border-2" : "border-slate-200 dark:border-slate-800")}
      style={active ? { borderColor: activeColor || "#2563eb" } : undefined}>
      {onClick && (
        <svg viewBox="0 0 12 12" className={"absolute top-2 right-2 w-3 h-3 transition-transform " + (active ? "rotate-180" : "")} style={{ color: active ? (activeColor || "#2563eb") : "#cbd5e1" }} aria-hidden="true">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">{label}</div>
      <div className={"text-2xl font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}</div>
      {sub && (
        <div className={"text-[10px] font-bold mt-0.5 " + (typeof sub === "object" && sub.cls ? sub.cls : "text-blue-600 dark:text-blue-400")}>
          {typeof sub === "object" ? sub.label : sub}
        </div>
      )}
    </Tag>
  );
}


// "2026-2027" -> "'26-'27"; falls back to the old single-year tick
function seasonTick(y) {
  const m = String(y.season || "").match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return "'" + m[1].slice(2) + "-'" + m[2].slice(2);
  return y.s;
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
          <div className="text-[10px] font-semibold text-slate-400 mt-1 whitespace-nowrap">{seasonTick(y)}</div>
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
        <span className={"text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " + (c.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300")}>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years
          .filter((y) => y.type !== "G")
          .filter((y, _, arr) => {
            const isFA = y.type === "UFA" || y.type === "RFA";
            const hasOption = arr.some((o) => (o.type === "PO" || o.type === "TO") && !o.decision);
            return !(isFA && hasOption); // option chip covers it - FA chip is redundant
          })
          .map((y, i) => (
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
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const swipe = useSwipe(null, onBack);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: playerHeaderColor(p), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ {backLabel}</button>
        <div className="flex items-center gap-4">
          <Avatar p={p} size="lg" />
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">
              {p.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <span className="text-sm opacity-80 font-medium truncate">
                {[cleanNo(p.no) ? "#" + cleanNo(p.no) : "", p.pos].filter(Boolean).join(" · ")}
              </span>
              <StatusBadge status={p.status} />
            </div>
            {p.injuryNotes && (
              <div className="text-xs font-semibold text-red-200 mt-1 truncate">{p.injuryNotes}</div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-2">
          <Tile
            value={p.rating2k != null ? Math.round(p.rating2k) : "—"}
            label="2K Rating"
            valueClass={p.rating2k == null ? null
              : Math.round(p.rating2k) >= 90 ? "text-amber-500 dark:text-amber-400"
              : Math.round(p.rating2k) >= 80 ? "text-slate-500 dark:text-slate-300"
              : "text-orange-700 dark:text-orange-400"}
          />
          <Tile value={currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"} label={CURRENT_SEASON.slice(2, 4) + "-" + CURRENT_SEASON.slice(7) + " Salary"} />
          {(() => {
            const ev = nextEvent(p);
            const labels = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
            const colors = {
              PO: "text-emerald-600 dark:text-emerald-400",
              TO: "text-red-600 dark:text-red-400",
              UFA: "text-slate-500 dark:text-slate-400",
              RFA: "text-purple-600 dark:text-purple-400",
            };
            return (
              <Tile
                value={ev ? seasonTick({ season: ev.season }) : "—"}
                label={ev ? labels[ev.kind] : "Free Agent"}
                valueClass={ev ? colors[ev.kind] : null}
              />
            );
          })()}
        </div>

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height / Weight" v={[p.height, p.weight].filter(Boolean).join(" · ")} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(": ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace} />
            </div>
          </>
        )}

        {mode === "full" && p.stats && p.stats.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Stats</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {p.stats.map((st, i) => {
                const fmtPct = (v) => (v == null ? null : Number(v).toFixed(1) + "%");
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{st.season || "—"}</div>
                    <div className="flex justify-between">
                      {[["G", st.gp != null ? Math.round(st.gp) : null], ["PTS", fmt1(st.pts)], ["REB", fmt1(st.reb)], ["AST", fmt1(st.ast)], ["STL", fmt1(st.stl)], ["BLK", fmt1(st.blk)], ["TO", fmt1(st.tov)]].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {[["FG%", fmtPct(st.fg)], ["FT%", fmtPct(st.ft)], ["3P%", fmtPct(st.p3)]].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
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
function ListHeader({ title, q, setQ, placeholder, pills, noSearch }) {
  return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      {!noSearch && <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search players or teams…"}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/80 placeholder-slate-400 outline-none"
      />}
      {pills}
    </div>
  );
}

// Populated once data loads: abbr -> logo URL
const TEAM_LOGOS = {};

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = TEAM_LOGOS[abbr];
  if (logo) {
    return <img src={logo} alt={abbr} className="w-8 h-8 rounded-full object-contain bg-white p-0.5 shrink-0" />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
// One bottom tab for players, the injury report, contracts and the draft —
// same hub the NFL app uses, so the bottom nav stays at four buttons.
function PlayersHub({ players, onSelect }) {
  const [view, setView] = useState("players");
  const pills = (
    <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {[["players", "Players"], ["injury", "🏥 Injury Report"], ["contracts", "Contracts"], ["draft", "Draft"]].map(([k, lbl]) => (
        <button key={k} onClick={() => setView(k)}
          className={"shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold " + (view === k ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
          {lbl}
        </button>
      ))}
    </div>
  );
  if (view === "contracts") return <ContractsTab players={players} onSelect={onSelect} pills={pills} />;
  if (view === "draft") return <DraftTab players={players} onSelect={onSelect} pills={pills} />;
  return <PlayersTab players={players} onSelect={onSelect} pills={pills} forceInj={view === "injury"} key={view} />;
}

// Anyone not fully Active, or with an injury note, is on the report.
const isHurt = (p) => {
  const s = String(p.status || "").toLowerCase();
  return (s && !s.includes("active") && !s.includes("available")) || !!p.injuryNotes;
};

function PlayersTab({ players, onSelect, pills, forceInj }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const base = players.filter((p) => matchesQuery(p, q));
    if (!forceInj) return base;
    // Out/IR first, then game-time decisions, alphabetical inside each group
    const sev = (p) => { const s = String(p.status || "").toLowerCase(); return s.includes("ir") || s.includes("out") ? 0 : 1; };
    return base.filter(isHurt).sort((a, b) => sev(a) - sev(b) || a.name.localeCompare(b.name));
  }, [players, q, forceInj]);
  return (
    <div>
      <ListHeader title={forceInj ? "Injury Report" : "Players"} q={q} setQ={setQ} pills={pills} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <span className="w-7 text-center text-[11px] font-extrabold text-slate-400 uppercase shrink-0">{p.pos || "—"}</span>
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.height, p.weight, p.age ? p.age + " yrs" : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
                {(p.rating2k != null || p.archetype) && (
                  <span className="flex items-center gap-1.5 mt-1 min-w-0">
                    <Rating2kBadge r={p.rating2k} />
                    {p.archetype && <span className="text-[10px] font-semibold text-slate-400 truncate">{p.archetype}</span>}
                  </span>
                )}
                {forceInj && (
                  <span className="flex items-center gap-1.5 mt-1 min-w-0">
                    <StatusBadge status={p.status || "Injured"} />
                    {p.injuryNotes && <span className="text-[11px] font-semibold text-red-500 truncate">{p.injuryNotes}</span>}
                  </span>
                )}
              </span>
              <TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} />
            </button>
          ))}
          {list.length === 0 && forceInj && <div className="text-center text-sm text-slate-400 py-12 px-6">Nobody on the injury report{q ? ` matching "${q}"` : ""}. Everyone's Active.</div>}
          {list.length === 0 && !forceInj && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TAB: CONTRACTS ══════════════════════════════════

// Upcoming free agency: the earliest UFA/RFA year at/after the current season
function faStatus(p) {
  let best = null;
  for (const c of p.contracts || []) {
    for (const y of c.years || []) {
      const t = String(y.type || "").toUpperCase();
      if (t !== "UFA" && t !== "RFA") continue;
      if (String(y.season) < CURRENT_SEASON) continue;
      if (!best || String(y.season) < String(best.season)) best = { type: t, season: y.season };
    }
  }
  if (!best) return null;
  const yr = String(best.season).slice(0, 4); // "2026-2027" -> hits market summer 2026
  return { ...best, label: best.type + " " + yr };
}


function Rating2kBadge({ r }) {
  if (r == null) return null;
  const n = Math.round(r);
  const cls =
    n >= 90 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"        // gold
    : n >= 80 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"          // silver
    : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";            // bronze
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold " + cls}>
      {n} OVR
    </span>
  );
}

// Next contract event: earliest pending PO/TO or upcoming UFA/RFA on the active deal

// First year of a season string: "2026-2027" | "2026-27" -> 2026
function startYear(s) {
  const m = String(s || "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function nextEvent(p) {
  let best = null;
  for (const c of p.contracts || []) {
    if (String(c.status).toLowerCase() === "expired") continue; // blank status still counts
    for (const y of c.years || []) {
      if (startYear(y.season) != null && startYear(y.season) < startYear(CURRENT_SEASON)) continue;
      const t = String(y.type || "").toUpperCase();
      let kind = null;
      if ((t === "PO" || t === "TO") && !y.decision) kind = t;
      else if (t === "UFA" || t === "RFA") kind = t;
      if (!kind) continue;
      if (!best || String(y.season) < String(best.season)) best = { kind, season: y.season, deadline: y.deadline || null };
    }
  }
  if (!best) return null;
  return { ...best, label: best.kind + " " + String(best.season).slice(0, 4) };
}

// Everyone who could be a free agent next summer: expiring (UFA/RFA) plus
// player/team options still undecided — declined options become free agents.
function faEligible(roster) {
  const cutoff = startYear(CURRENT_SEASON) + 1;
  return roster.filter((p) => { const e = nextEvent(p); return e && startYear(e.season) != null && startYear(e.season) <= cutoff; });
}
const EVENT_WORDS = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
const EVENT_COLORS = {
  PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  UFA: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  RFA: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

// When the decision is actually due. An Airtable "Deadline" value on the
// contract year wins; otherwise the CBA's standard dates for that offseason:
// options must be exercised by June 29, free agency opens June 30 (6pm ET).
const mdy = (d) => String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + "/" + d.getFullYear();
function eventDeadline(ev) {
  if (!ev) return null;
  const yr = startYear(ev.season);             // "2027-2028" → 2027: the summer before that season
  if (ev.deadline) {
    const d = new Date(ev.deadline);
    return isNaN(d) ? { label: ev.deadline, date: null } : { label: mdy(d), date: d };
  }
  if (!yr) return null;
  const d = ev.kind === "PO" || ev.kind === "TO" ? new Date(yr, 5, 29) : new Date(yr, 5, 30);
  return { label: mdy(d), date: d, standard: true };
}
function EventPill({ ev, withDate }) {
  if (!ev) return null;
  const cls = EVENT_COLORS[ev.kind] || EVENT_COLORS.UFA;
  const dl = withDate && (ev.kind === "PO" || ev.kind === "TO") ? eventDeadline(ev) : null; // deadlines are for options only
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className={"inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
        {ev.kind === "UFA"
          ? <>Free Agent {startYear(ev.season) ?? seasonTick({ season: ev.season })}</>
          : <>{EVENT_WORDS[ev.kind] || ev.kind} {seasonTick({ season: ev.season })}</>}
      </span>
      {dl && <span className="text-[9px] font-semibold text-slate-400 truncate">(deadline {dl.label})</span>}
    </span>
  );
}


// The season after the current one - "2025-2026" -> "2026-2027". Rolls forward with CURRENT_SEASON.
function nextSeason(s) {
  const m = String(s).match(/(\d{4})\s*-\s*(\d{4})/);
  if (!m) return null;
  return (Number(m[1]) + 1) + "-" + (Number(m[2]) + 1);
}

function ContractsTab({ players, onSelect, pills }) {
  const [q, setQ] = useState("");
  const [faOnly, setFaOnly] = useState(false);
  const list = useMemo(
    () =>
      players
        .filter((p) => p.contracts.length > 0)
        .filter((p) => matchesQuery(p, q))
        .filter((p) => {
          if (!faOnly) return true;
          const ev = nextEvent(p);                       // UFA, RFA, player + team options
          return ev && startYear(ev.season) === startYear(CURRENT_SEASON) + 1;
        })
        .slice()
        .sort((x, y) => {
          if (faOnly) {
            const rank = { UFA: 0, RFA: 1, PO: 2, TO: 3 };
            const ex = nextEvent(x), ey = nextEvent(y);
            const rx = rank[ex?.kind] ?? 9, ry = rank[ey?.kind] ?? 9;
            if (rx !== ry) return rx - ry;              // free agents first, then options
          }
          const sx = currentSalary(x), sy = currentSalary(y);
          if (sy !== sx) return sy - sx;               // biggest current-season salary first
          return x.name.localeCompare(y.name);          // $0 group: alphabetical
        }),
    [players, q, faOnly]
  );
  return (
    <div>
      <ListHeader title="Contracts" q={q} setQ={setQ} pills={pills} />
      <div className="px-4 mt-3 flex gap-2">
        {[["All", false], ["Free Agency " + (startYear(CURRENT_SEASON) + 1), true]].map(([lbl, v]) => (
          <button key={lbl} onClick={() => setFaOnly(v)}
            className={"px-4 py-1.5 rounded-full text-xs font-bold " + (faOnly === v
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
            {lbl}
          </button>
        ))}
      </div>
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
                    {act ? <ContractLine c={act} /> : "No contract"}
                  </span>
                  {nextEvent(p) && (
                    <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
                  )}
                </span>
                {currentSalary(p) > 0 && (
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">{fmtM(currentSalary(p))}</span>
                )}
                <TeamPill team={teamOfPlayer(p) || act?.team} />
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

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

// The "Free Agents" row in the Teams table isn't a team: no court, no tiles.
const isFaTeam = (t) => !!t && (/free\s*agent/i.test(String(t.name || "")) || String(t.abbr || "").toUpperCase() === "FA");

function TeamsTab({ teams, players, onSelect }) {
  const [q, setQ] = useState("");
  const [conf, setConf] = useState("all"); // all | east | west
  const [div, setDiv] = useState(null);    // division name or null
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
  const confOf = (t) => {
    const c = String(t.conference).toLowerCase();
    return c.startsWith("east") ? "east" : c.startsWith("west") ? "west" : "other";
  };
  // Divisional rank across ALL teams (unaffected by search/filters)
  const divRank = {};
  {
    const byDiv = {};
    for (const t of teams) { if (t.division) (byDiv[t.division] ??= []).push(t); }
    for (const arr of Object.values(byDiv)) {
      arr.sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
      arr.forEach((t, i) => { divRank[t.id] = ORDINALS[i] || `${i + 1}th`; });
    }
  }
  const divisions = conf === "all" ? [] :
    [...new Set(teams.filter((t) => confOf(t) === conf).map((t) => t.division).filter(Boolean))].sort();
  let list = teams.filter((t) => {
    if (conf !== "all" && confOf(t) !== conf) return false;
    if (div && t.division !== div) return false;
    if (!s) return true;
    if ((t.name + " " + t.abbr).toLowerCase().includes(s)) return true;
    const abbr = t.abbr || toAbbr(t.name);
    return playerTeamAbbrs.has(abbr);
  });
  list = [...list].sort((a, b) =>
    (isFaTeam(a) ? 1 : 0) - (isFaTeam(b) ? 1 : 0) ||   // Free Agents always last
    (conf === "all"
      ? String(a.name).localeCompare(String(b.name))
      : winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0))
  );
  const pickConf = (k) => { setConf(k); setDiv(null); };
  return (
    <div>
      <div className="px-4 pb-28" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex gap-2 mt-1">
          {[["all", "All"], ["east", "East"], ["west", "West"]].map(([k, lbl]) => (
            <button key={k} onClick={() => pickConf(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (conf === k
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>
        {divisions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            {divisions.map((d) => (
              <button key={d} onClick={() => setDiv(div === d ? null : d)}
                className={"px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors " + (div === d
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                {d}
              </button>
            ))}
          </div>
        )}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden mt-4">
          {list.map((t) => {
            const abbr = t.abbr || toAbbr(t.name);
            return (
              <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                {t.logo ? (
                  <img src={t.logo} alt="" className="w-11 h-11 rounded-full object-contain bg-white p-1 shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division} Division` : t.division + " Division") : "—"}
                  </span>
                </span>
                {(t.wins != null || t.losses != null) && (
                  <span className="flex gap-2.5 shrink-0">
                    {[["W", t.wins ?? 0], ["L", t.losses ?? 0]].map(([lbl, v]) => (
                      <span key={lbl} className="w-7 text-center">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                        <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No teams match{q ? ` "${q}"` : " the selected filters"}.</div>}
      </div>
    </div>
  );
}


function StatusBadge({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase().trim();
  let cls = "bg-slate-100 text-slate-500 dark:text-slate-400";
  if (s === "ir" || s.includes("injured reserve") || s.includes("out")) cls = "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300";
  else if (s.includes("active") || s.includes("available")) cls = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  else if (s.includes("game time") || s === "gtd" || s.includes("injur") || s.includes("day") || s.includes("question") || s.includes("doubt") || s.includes("probable")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {status}
    </span>
  );
}


// Committed salary for a player in a given season (active deals only)
function salaryInSeason(p, season) {
  for (const c of p.contracts || []) {
    if (c.status !== "Active") continue;
    for (const y of c.years || []) {
      if (y.season === season && y.salary != null) return { salary: y.salary, type: y.type, decision: y.decision };
    }
  }
  return null;
}
function seasonsAhead(n) {
  const out = [CURRENT_SEASON];
  for (let i = 1; i < n; i++) out.push(nextSeason(out[i - 1]));
  return out.filter(Boolean);
}
const LINE_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#0891b2"];

// ═══════════════ COURT VIEW (starting five on a half court) ══════
// Basketball's answer to the NFL formation field. Five slots on a hardwood
// half court; the paint is painted in the team color; the bench scrolls
// underneath. Health rings + badges read the Airtable Status field
// (Active / Game Time Decision / IR) that the injury sync keeps current.
const POS_ALIASES = {
  PG: ["PG", "G", "G-F", "F-G"], SG: ["SG", "G", "G-F", "F-G"],
  SF: ["SF", "F", "G-F", "F-G", "F-C"], PF: ["PF", "F", "F-C", "C-F"], C: ["C", "F-C", "C-F"],
};
// Symmetric: point at the top of the key, wings mirrored, bigs mirrored on
// the blocks. Same spacing left-to-right and top-to-bottom.
// Court box shows 6 ft beyond half court (full center circle + logo), then
// the 47 ft half court. Slot y values are % of that 53 ft box.
const COURT_TOP_FT = 6, COURT_FT = 47 + COURT_TOP_FT;
const ftY = (ft) => ((ft + COURT_TOP_FT) / COURT_FT) * 100;
const COURT_SLOTS = [
  { lbl: "PG", x: 50, y: ftY(13), big: false },   // top of the key, above the arc
  { lbl: "SF", x: 24, y: ftY(26), big: false },
  { lbl: "SG", x: 76, y: ftY(26), big: false },
  { lbl: "PF", x: 24, y: ftY(37), big: true },
  { lbl: "C",  x: 76, y: ftY(37), big: true },
];
// Guard / Forward / Center bucket for the bench summary
function posGroup(p) {
  const x = courtPos(p);
  if (/^(PG|SG|G)/.test(x)) return "G";
  if (/^C/.test(x)) return "C";
  if (/^(SF|PF|F)/.test(x)) return "F";
  return null;
}
// "out" | "q" | "ok"  — from the Airtable Status field
function healthOf(p) {
  const s = String(p?.status || "").toLowerCase().trim();
  if (!s) return p?.injuryNotes ? "q" : "ok";
  if (s === "ir" || s.includes("injured reserve") || s.includes("out")) return "out";
  if (s.includes("active") || s.includes("available")) return p?.injuryNotes ? "q" : "ok";
  return "q"; // Game Time Decision, questionable, day-to-day…
}
const posOf = courtPos;
const lastNameOf = (p) => {
  const parts = String(p.name).split(" ");
  return /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "") ? parts.slice(-2).join(" ") : parts.slice(-1)[0];
};
const bySort = (a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || currentSalary(b) - currentSalary(a);

// Pick the five. Starters (Airtable Role = "Starter") claim their natural
// slot first, then any open slot. An OUT/IR starter is skipped and the
// next healthy body at that position steps up from the bench; he keeps his
// OUT badge on the bench strip. A game-time decision stays on the court.
// abbr -> { starters: [{name,pos}], date, opp, result } from /api/lineups
const LINEUPS = {};
function espnStartersFor(roster, abbr) {
  const lu = LINEUPS[String(abbr || "").toUpperCase()];
  if (!lu) return null;
  const names = new Set(lu.starters.map((a) => espnNrm(a.name)));
  const lastKey = (n) => espnNrm(n).split(" ").pop();
  const lasts = new Set(lu.starters.map((a) => lastKey(a.name)));
  const hits = roster.filter((p) => names.has(espnNrm(p.name)) || (lasts.has(lastKey(p.name)) && roster.filter((q) => lastKey(q.name) === lastKey(p.name)).length === 1));
  return hits.length >= 4 ? hits : null; // need most of the five to trust it
}
// Airtable is the single source of truth until ESPN confirms a lineup:
//   Role           → Starter / Bench / Reserve / Two-Way
//   Sort Priority  → position number for EVERY player: 1 PG · 2 SG · 3 SF · 4 PF · 5 C
// The five with Role = Starter go on the court in their Sort Priority slot.
// A starter who is OUT/IR drops to the bench and the healthy Bench/Reserve
// player with the same position number (most minutes first) takes his spot.
const SLOT_OF_SORT = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };
const roleOf = (p) => { const r = String(p.role || "").toLowerCase(); return r.includes("start") ? "Starter" : r.includes("bench") ? "Bench" : r.includes("reserve") ? "Reserves" : /two\s*-?\s*way/.test(r) ? "Two-Way" : "Reserves"; };
const mpgOf = (p) => latestStats(p)?.min ?? -1;
const isTwoWay = (p) => roleOf(p) === "Two-Way" || /two\s*-?\s*way/i.test(String(activeOf(p)?.kind || ""));
const slotOfPlayer = (p) => SLOT_OF_SORT[Number(p.sort)] || (POS_ALIASES.PG.includes(courtPos(p)) && courtPos(p) === "PG" ? "PG" : courtPos(p));
const byMinutes = (a, b) => mpgOf(b) - mpgOf(a) || (Number(a.sort) || 99) - (Number(b.sort) || 99);

function pickStartingFive(roster, abbr) {
  const used = new Set();
  const assigned = new Array(COURT_SLOTS.length).fill(null);
  const nextUp = new Array(COURT_SLOTS.length).fill(false);
  const take = (i, p, stepped) => { assigned[i] = p; used.add(p.id); nextUp[i] = !!stepped; };
  const slotIdx = (lbl) => COURT_SLOTS.findIndex((s) => s.lbl === lbl);
  const espnFive = espnStartersFor(roster, abbr);

  if (espnFive) {
    // Confirmed lineup from ESPN's last box score: slot by position number,
    // then by position label, then wherever is open.
    const pool = espnFive.slice().sort(byMinutes);
    for (const p of pool) { const i = slotIdx(slotOfPlayer(p)); if (i >= 0 && !assigned[i]) take(i, p); }
    for (const p of pool) { if (used.has(p.id)) continue; const i = COURT_SLOTS.findIndex((s, k) => !assigned[k] && POS_ALIASES[s.lbl].includes(courtPos(p))); if (i >= 0) take(i, p); }
    for (const p of pool) { if (used.has(p.id)) continue; const i = assigned.findIndex((x) => !x); if (i >= 0) take(i, p); }
  } else {
    // Airtable: Role = Starter, slot = Sort Priority
    const starters = roster.filter((p) => roleOf(p) === "Starter").sort(byMinutes);
    for (const p of starters) {
      if (healthOf(p) === "out") continue;
      const i = slotIdx(slotOfPlayer(p));
      if (i >= 0 && !assigned[i]) take(i, p);
    }
    // a healthy starter whose slot was taken (two 3s, or no number) → first open compatible slot
    for (const p of starters) {
      if (used.has(p.id) || healthOf(p) === "out") continue;
      const i = COURT_SLOTS.findIndex((s, k) => !assigned[k] && POS_ALIASES[s.lbl].includes(courtPos(p)));
      if (i >= 0) take(i, p);
    }
  }
  // Holes (OUT starter, or fewer than five tagged): next man up — same
  // position number first, then a compatible position, most minutes first.
  const bench = roster.filter((p) => !used.has(p.id) && healthOf(p) !== "out" && !isTwoWay(p)).sort(byMinutes);
  const benchAny = roster.filter((p) => !used.has(p.id) && healthOf(p) !== "out").sort(byMinutes);
  COURT_SLOTS.forEach((s, i) => {
    if (assigned[i]) return;
    const hit = bench.find((p) => !used.has(p.id) && slotOfPlayer(p) === s.lbl)
      || bench.find((p) => !used.has(p.id) && POS_ALIASES[s.lbl].includes(courtPos(p)))
      || benchAny.find((p) => !used.has(p.id) && POS_ALIASES[s.lbl].includes(courtPos(p)))
      || benchAny.find((p) => !used.has(p.id));
    if (hit) take(i, hit, true);
  });
  // last resort: nobody healthy — show the hurt starter rather than a hole
  COURT_SLOTS.forEach((s, i) => {
    if (assigned[i]) return;
    const hit = roster.filter((p) => !used.has(p.id)).sort(byMinutes)[0];
    if (hit) take(i, hit);
  });
  return { assigned, nextUp, used, automated: !!espnFive, source: espnFive ? "espn" : "airtable" };
}

// Everything the court and the list view share: the five (in slot order),
// then Bench / Reserves / Two-Way by Role, each ordered by minutes. An OUT
// starter shows up in the Bench group with his IR badge.
function lineupOf(roster, abbr) {
  const r = pickStartingFive(roster, abbr);
  const notFive = roster.filter((p) => !r.used.has(p.id)).sort(byMinutes);
  const grp = (p) => (isTwoWay(p) ? "Two-Way" : roleOf(p) === "Reserves" ? "Reserves" : "Bench");
  const benchGroups = [["Bench", notFive.filter((p) => grp(p) === "Bench")], ["Reserves", notFive.filter((p) => grp(p) === "Reserves")], ["Two-Way", notFive.filter((p) => grp(p) === "Two-Way")]].filter(([, l]) => l.length);
  return { ...r, benchGroups, bench: notFive, starters: COURT_SLOTS.map((s, i) => ({ slot: s.lbl, p: r.assigned[i] })).filter((x) => x.p) };
}

function CourtView({ roster, abbr, team, teams, onSelectPlayer }) {
  const { assigned, nextUp, used, automated, source, benchGroups, bench } = useMemo(() => lineupOf(roster, abbr), [roster, abbr, LINEUPS[abbr]]);
  const lineup = LINEUPS[String(abbr || "").toUpperCase()];
  const mpg = (p) => latestStats(p)?.min ?? -1;
  const color = teamColor(abbr);
  // Net rating (PPG − opp PPG) ranked against the league — the NBA version
  // of the NFL app's offense/defense rank tags.
  const netRating = useMemo(() => {
    if (!team || team.ppg == null || team.oppPpg == null) return null;
    const all = (teams || []).filter((t) => t.ppg != null && t.oppPpg != null && !isFaTeam(t)).map((t) => [t.id, t.ppg - t.oppPpg]).sort((a, b) => b[1] - a[1]);
    const rank = all.findIndex(([id]) => id === team.id) + 1;
    return { value: team.ppg - team.oppPpg, rank: rank || null };
  }, [team, teams]);
  const ringCls = (p) => {
    if (!p) return "border-white/40";
    const h = healthOf(p);
    return h === "ok" ? "border-white" : h === "q" ? "border-amber-400" : "border-red-500";
  };
  const HealthBadge = ({ p, small }) => {
    const h = healthOf(p);
    if (h === "ok") return null;
    const s = String(p.status || "").toUpperCase();
    const txt = h === "out" ? (s.includes("IR") ? "IR" : "OUT") : (s.includes("GAME") ? "GTD" : s.includes("DOUBT") ? "DOUBTFUL" : s.includes("PROB") ? "PROBABLE" : "GTD");
    return (
      <span className={"absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full font-extrabold text-white border-2 border-white shadow whitespace-nowrap flex items-center justify-center " +
        (h === "out" ? "bg-red-600 " : "bg-amber-500 ") + (small ? "h-[13px] text-[6px] " : "h-[15px] text-[7px] ")}>
        {txt}
      </span>
    );
  };
  const RatingPill = ({ r, small }) => r == null ? null : (
    <span className={"absolute left-1/2 -translate-x-1/2 rounded-full font-extrabold tabular-nums shadow " +
      (small ? "-bottom-1 px-1 text-[8px] " : "-bottom-1.5 px-1.5 text-[9px] ") +
      (Math.round(r) >= 90 ? "bg-amber-400 text-slate-900" : Math.round(r) >= 85 ? "bg-emerald-500 text-white" : Math.round(r) >= 70 ? "bg-slate-900/85 text-white" : "bg-rose-600 text-white")}>
      {Math.round(r)}
    </span>
  );
  const nick = team && team.name ? String(team.name).trim().split(" ").pop() : abbr;
  const outCount = roster.filter((p) => healthOf(p) === "out").length;
  const gtdCount = roster.filter((p) => healthOf(p) === "q").length;

  return (
    <div className="mt-4">
      {/* Half court, hoop at the bottom. Aspect = 50ft × 47ft. Lines are an
          SVG in real feet so the arcs stay true circles at any width. */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
        style={{ paddingBottom: (COURT_FT / 50 * 100).toFixed(1) + "%", background: "repeating-linear-gradient(90deg,#d9a566 0 6.5%,#cf9a5c 6.5% 13%)" }}>
        {/* plank seams + top-down light so it reads as hardwood, not a flat panel */}
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 22px)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.14) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,0.16) 100%)" }} />
        <svg viewBox={`0 ${-COURT_TOP_FT} 50 ${COURT_FT}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          {/* painted key in the team color, with the paint texture the NFL end zone uses */}
          <defs>
            <pattern id="paintTex" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="0.6" height="1.2" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect x="17" y="28" width="16" height="19" fill={color} opacity="0.88" />
          <rect x="17" y="28" width="16" height="19" fill="url(#paintTex)" />
          {/* half-court line + full center circle */}
          <line x1="0" y1="0" x2="50" y2="0" stroke="rgba(255,255,255,0.8)" strokeWidth="0.3" />
          <circle cx="25" cy="0" r="6" fill={centerColor(abbr)} stroke="rgba(255,255,255,0.9)" strokeWidth="0.3" />
          {/* three-point line: corners + arc (23.75ft from the rim) */}
          <path d="M 3 47 L 3 33.3 A 23.75 23.75 0 0 1 47 33.3 L 47 47" fill="none" stroke={color} strokeWidth="0.35" />
          {/* key outline in the team color, free-throw circle in the secondary color */}
          <rect x="17" y="28" width="16" height="19" fill="none" stroke={color} strokeWidth="0.35" />
          <path d="M 19 28 A 6 6 0 0 1 31 28" fill="none" stroke={teamColor2(abbr)} strokeWidth="0.35" />
          <path d="M 19 28 A 6 6 0 0 0 31 28" fill="none" stroke={teamColor2(abbr)} strokeWidth="0.35" strokeDasharray="1.2 0.9" opacity="0.8" />
          {/* lane hash marks */}
          {[36, 39, 42, 44.5].map((y) => (
            <React.Fragment key={y}>
              <line x1="16.2" y1={y} x2="17" y2={y} stroke="rgba(255,255,255,0.8)" strokeWidth="0.3" />
              <line x1="33" y1={y} x2="33.8" y2={y} stroke="rgba(255,255,255,0.8)" strokeWidth="0.3" />
            </React.Fragment>
          ))}
          {/* restricted area, backboard, rim */}
          <path d="M 21 45.75 A 4 4 0 0 1 29 45.75" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.25" />
          <line x1="22" y1="43" x2="28" y2="43" stroke="rgba(255,255,255,0.95)" strokeWidth="0.45" />
          <circle cx="25" cy="41.75" r="0.75" fill="none" stroke="#f97316" strokeWidth="0.35" />
          {/* baseline + sidelines */}
          <rect x="0.15" y={-COURT_TOP_FT} width="49.7" height={COURT_FT - 0.15} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        </svg>
        {/* center-court logo, sitting inside the center circle the way a
            real floor has it — we see the bottom half of it on a half court */}
        {team && team.logo && (
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24%] rounded-full overflow-hidden pointer-events-none select-none"
            style={{ top: ftY(0) + "%", aspectRatio: "1 / 1", animation: "hrbGlow 4s ease-in-out 1" }}>
            <img src={team.logo} alt="" className="absolute inset-[18%] w-[64%] h-[64%] object-contain" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
            {/* light sweep — the "sparkle" */}
            <span className="absolute inset-0" style={{ background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)", animation: "hrbSweep 1.6s ease-in-out .5s 1 both" }} />
          </div>
        )}

        {/* availability tag, top-left, same frosted style as the NFL personnel tag */}
        {/* where the five came from — last game's actual starters, or Airtable */}
        <span className={"absolute right-2 top-2 rounded-md bg-black/40 backdrop-blur-sm px-2 py-1 text-[9px] font-extrabold shadow-sm " + (automated ? "text-emerald-300" : "text-amber-300")}>
          {automated && lineup
            ? "Confirmed lineup · " + (lineup.home ? "vs " : "@ ") + lineup.opp + " · " + new Date(lineup.date).toLocaleDateString([], { month: "numeric", day: "numeric" })
            : "Projected lineup"}
        </span>
        {(outCount > 0 || gtdCount > 0) && (
          <span className="absolute left-2 top-2 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm">
            {[outCount > 0 ? `${outCount} out` : "", gtdCount > 0 ? `${gtdCount} GTD` : ""].filter(Boolean).join(" · ")}
          </span>
        )}
        <style>{`@keyframes hrbPop { from { opacity: 0; transform: translate(-50%, -50%) scale(.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes hrbSweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@keyframes hrbGlow { 0%, 100% { filter: drop-shadow(0 0 0px rgba(255,255,255,0)); } 50% { filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); } }`}</style>
        {COURT_SLOTS.map((s, i) => {
          const p = assigned[i];
          return (
            <button key={i + (p ? p.id : "")} disabled={!p} onClick={p ? () => onSelectPlayer(p) : undefined}
              className="absolute flex flex-col items-center"
              style={{ left: s.x + "%", top: s.y + "%", transform: "translate(-50%, -50%)", animation: `hrbPop .35s ease-out ${i * 45}ms both` }}>
              <span className="relative">
                {p && photoOf(p) ? (
                  <img src={photoOf(p)} alt="" loading="lazy" className={"w-14 h-14 rounded-full object-cover object-top bg-white border-[3px] shadow-md " + ringCls(p)} />
                ) : (
                  <span className={"w-14 h-14 rounded-full flex items-center justify-center text-[11px] font-extrabold shadow-md border-[3px] " + ringCls(p) + (p ? " bg-white/90 text-slate-700" : " bg-white/20 text-white/70 border-dashed")}>
                    {p ? lastNameOf(p).slice(0, 3).toUpperCase() : s.lbl}
                  </span>
                )}
                {p && (
                  <span className="absolute top-1/2 -translate-y-1/2 -left-3 px-1 rounded text-[8px] font-extrabold bg-white/90 text-slate-700 shadow">
                    {s.lbl}
                  </span>
                )}
                {p && <RatingPill r={p.rating2k} />}
                {p && <HealthBadge p={p} />}
              </span>
              <span className="mt-2 text-[10px] font-bold text-white max-w-[110px] truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                {p ? (cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : "") + lastNameOf(p) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* The bench: everyone not in the five. Horizontal scroll, rotation order. */}
      {bench.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-2 pt-2 pb-1">
          <div className="flex items-baseline justify-between px-1 mb-1.5">
            <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{benchGroups[0] ? benchGroups[0][0] : "Bench"}</span>
            <span className="text-[9px] font-bold text-slate-400 tabular-nums truncate ml-3">
              {(() => {
                const counts = { G: 0, F: 0, C: 0 };
                for (const b of bench) { const k = posGroup(b); if (k) counts[k]++; }
                return [["G", "Guards"], ["F", "Forwards"], ["C", "Centers"]].filter(([k]) => counts[k]).map(([k, lbl]) => `${lbl} (${counts[k]})`).join(" · ");
              })()}
            </span>
          </div>
          {benchGroups.map(([grp, list], gi) => (
          <div key={grp} className={gi ? "mt-1.5" : "-mt-3"}>
            {gi > 0 && <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400 px-1">{grp}</div>}
            <div className="grid grid-cols-5 gap-x-1 gap-y-2 pt-3 pb-1.5 px-0.5">
            {list.map((p) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="flex flex-col items-center min-w-0">
                <span className="relative">
                  {photoOf(p) ? (
                    <img src={photoOf(p)} alt="" loading="lazy"
                      className={"w-12 h-12 rounded-full object-cover object-top bg-white border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")} />
                  ) : (
                    <span className={"w-12 h-12 rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}>
                      {lastNameOf(p).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute top-1/2 -translate-y-1/2 -left-2 px-1 rounded text-[7px] font-extrabold bg-white/95 dark:bg-slate-700 text-slate-700 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-600">
                    {posOf(p) || "—"}
                  </span>
                  <HealthBadge p={p} small />
                  <RatingPill r={p.rating2k} small />
                </span>
                <span className="mt-2 text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-full truncate">
                  {(cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : "") + lastNameOf(p)}
                </span>
                <span className="text-[8px] font-semibold text-slate-400">{mpg(p) >= 0 ? fmt1(mpg(p)) + " min" : "—"}</span>
              </button>
            ))}
            </div>
          </div>
          ))}
        </div>
      )}
      {/* Coaching staff — reads the Teams table's "Head Coach" and
          "Assistant Coach" columns; hidden until at least one is filled */}
      {team && (team.headCoach || team.asstCoach) && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2.5 grid grid-cols-2 gap-2">
          {[["Head Coach", team.headCoach], ["Assistant Coach", team.asstCoach]].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-400">{k}</div>
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{v || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════ TEAM STATS PANEL (grid: every player × every stat) ══
// One table per pill. Tap a column header to rank the whole roster by it;
// cells are tinted by where that value sits between the team's low and
// high, so a row's strengths jump out without reading numbers.
const STAT_SETS = {
  leaders:  { label: "Leaders",  cols: [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3m", "3PM"]] },
  volume:   { label: "Volume",   cols: [["min", "MIN"], ["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"], ["tov", "TOV"]] },
  shooting: { label: "Shooting", cols: [["fg", "FG%"], ["p3", "3P%"], ["ft", "FT%"], ["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"]], pct: ["fg", "p3", "ft"], gate: { fg: ["fga", 3], p3: ["p3a", 1.5], ft: ["fta", 1.5] } },
};
function TeamStatsPanel({ roster, abbr, mode, setMode, onSelectPlayer }) {
  const set = STAT_SETS[mode] || STAT_SETS.leaders;
  const [sortKey, setSortKey] = useState(set.cols[0][0]);
  useEffect(() => { setSortKey(set.cols[0][0]); }, [mode]);
  const rows = roster.map((p) => ({ p, s: latestStats(p) })).filter((x) => x.s && (x.s.gp ?? 0) > 0);
  const yr = rows[0] ? String(rows[0].s.season || "") : "";
  const color = teamColor(abbr);
  // value shown for a cell; rate stats below the attempt minimum read as "—"
  const val = (s, k) => {
    const g = set.gate && set.gate[k];
    if (g && (s[g[0]] ?? 0) < g[1]) return null;
    return s[k] == null ? null : s[k];
  };
  const ranges = {};
  for (const [k] of set.cols) {
    const vs = rows.map((r) => val(r.s, k)).filter((v) => v != null && v > 0);
    ranges[k] = vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 0];
  }
  const sorted = rows.slice().sort((a, b) => (val(b.s, sortKey) ?? -1) - (val(a.s, sortKey) ?? -1) || a.p.name.localeCompare(b.p.name));
  const tint = (k, v) => {
    if (v == null) return "transparent";
    const [lo, hi] = ranges[k];
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    return color + Math.round(8 + t * 96).toString(16).padStart(2, "0"); // #rrggbbaa
  };
  const fmt = (k, v) => v == null ? "—" : (set.pct && set.pct.includes(k) ? Number(v).toFixed(1) : Number(v).toFixed(1));
  const leaderOf = {};
  for (const [k] of set.cols) { const top = rows.slice().sort((a, b) => (val(b.s, k) ?? -1) - (val(a.s, k) ?? -1))[0]; if (top && val(top.s, k) != null) leaderOf[k] = top.p.id; }
  return (
    <>
      <div className="flex gap-2 mt-4">
        {Object.entries(STAT_SETS).map(([k, v]) => (
          <button key={k} onClick={() => setMode(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-bold " + (mode === k ? "text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
            style={mode === k ? { backgroundColor: color } : undefined}>{v.label}</button>
        ))}
      </div>
      {!rows.length ? (
        <div className="text-center text-xs text-slate-400 py-10">No season stats for this roster yet — add rows to the Stats table.</div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline justify-between px-1 mb-1.5">
            <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">{yr} per game</span>
            <span className="text-[9px] font-semibold text-slate-400">tap a column to rank</span>
          </div>
          <style>{`@keyframes hrbRowIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }`}</style>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table key={sortKey} className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left text-[9px] font-semibold tracking-widest uppercase text-slate-400 pl-2 py-2">Player</th>
                  {set.cols.map(([k, lbl]) => (
                    <th key={k} onClick={() => setSortKey(k)}
                      className={"text-right text-[8px] font-extrabold tracking-wide uppercase py-2 pr-1 cursor-pointer select-none whitespace-nowrap " + (sortKey === k ? "" : "text-slate-400")}
                      style={sortKey === k ? { color } : undefined}>
                      {lbl}{sortKey === k ? " ▾" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={sortKey}>
                {sorted.map(({ p, s }, i) => (
                  <tr key={p.id} onClick={() => onSelectPlayer(p)} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 active:bg-slate-50 dark:active:bg-slate-800"
                    style={{ animation: `hrbRowIn .28s ease-out ${Math.min(i, 12) * 22}ms both` }}>
                    <td className="pl-2 py-1 pr-0.5 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="w-3.5 text-[8px] font-bold text-slate-300 dark:text-slate-600 text-right shrink-0">{i + 1}</span>
                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate max-w-[64px]">{lastNameOf(p)}</span>
                        <span className="text-[7px] font-semibold text-slate-400 shrink-0">{courtPos(p)}</span>
                      </div>
                    </td>
                    {set.cols.map(([k]) => {
                      const v = val(s, k);
                      const lead = leaderOf[k] === p.id;
                      return (
                        <td key={k} className="text-right pr-1 py-1">
                          <span className={"inline-block min-w-[30px] rounded px-0.5 py-0.5 text-[10px] text-right transition-colors duration-300 " + (lead ? "font-extrabold text-slate-900 dark:text-white ring-1 ring-inset" : "font-semibold text-slate-700 dark:text-slate-200")}
                            style={{ backgroundColor: tint(k, v), ...(lead ? { "--tw-ring-color": color } : {}) }}>
                            {fmt(k, v)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[9px] text-slate-400 mt-2 px-1">
            Darker cell = higher on this team. Outlined = team leader.{mode === "shooting" ? " Percentages hidden under 3 FGA / 1.5 3PA / 1.5 FTA per game." : ""}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════ CAP OUTLOOK (Payroll tile) ══════════════════════
// League thresholds in $M. 2025-26 and 2026-27 are the NBA's official
// numbers; later seasons are projected at the league's stated +5.5%.
const CAP_TABLE = {
  2025: { cap: 154.647, tax: 187.895, apron1: 195.945, apron2: 207.824 },
  2026: { cap: 164.961, tax: 200.428, apron1: 209.015, apron2: 221.686 },
};
function capFor(year) {
  if (CAP_TABLE[year]) return { ...CAP_TABLE[year], projected: false };
  const known = Math.max(...Object.keys(CAP_TABLE).map(Number));
  const base = CAP_TABLE[known], g = Math.pow(1.055, year - known);
  return { cap: base.cap * g, tax: base.tax * g, apron1: base.apron1 * g, apron2: base.apron2 * g, projected: true };
}
const seasonLabel = (y) => "'" + String(y).slice(2) + "-'" + String(y + 1).slice(2);
// Bucket a contract year by how firm the money is
function bucketOf(y) {
  const t = String(y.type || "").toUpperCase();
  if (t === "UFA" || t === "RFA") return null;                 // cap hold, not salary
  if (t === "PO") return y.decision ? "committed" : "playerOpt";
  if (t === "TO") return y.decision ? "committed" : "teamOpt";
  if (t === "NG" || t === "PG") return "nonGtd";
  return "committed";
}
const BUCKETS = [
  ["committed", "Guaranteed", "#0f172a"],
  ["nonGtd", "Non-guaranteed", "#94a3b8"],
  ["playerOpt", "Player option", "#f59e0b"],
  ["teamOpt", "Team option", "#38bdf8"],
];

function CapOutlook({ roster, color, onSelectPlayer }) {
  const y0 = startYear(CURRENT_SEASON);
  const years = [y0, y0 + 1, y0 + 2, y0 + 3];
  const [sel, setSel] = useState(y0);
  // per season: { total, byBucket, rows: [{p, salary, bucket, type}] }
  const data = useMemo(() => years.map((yr) => {
    const rows = [];
    for (const p of roster) {
      const act = activeOf(p); if (!act) continue;
      const y = (act.years || []).find((yy) => startYear(yy.season) === yr && yy.salary != null);
      if (!y) continue;
      const b = bucketOf(y); if (!b) continue;
      rows.push({ p, salary: y.salary, bucket: b, type: String(y.type || "G").toUpperCase() });
    }
    rows.sort((a, b) => b.salary - a.salary);
    const byBucket = {}; for (const r of rows) byBucket[r.bucket] = (byBucket[r.bucket] || 0) + r.salary;
    return { yr, rows, byBucket, total: rows.reduce((a, r) => a + r.salary, 0), lines: capFor(yr) };
  }), [roster, y0]);

  const W = 340, H = 250, padL = 8, padR = 82, padT = 12, padB = 26;
  const maxY = Math.max(...data.map((d) => Math.max(d.total, d.lines.apron2))) * 1.06;
  const yOf = (v) => padT + (H - padT - padB) * (1 - v / maxY);
  const slot = (W - padL - padR) / years.length, bw = slot * 0.52;
  const cur = data.find((d) => d.yr === sel);
  const room = cur ? cur.lines.cap - cur.total : 0;
  const vsTax = cur ? cur.total - cur.lines.tax : 0;
  const status = !cur ? "" : cur.total > cur.lines.apron2 ? "Over 2nd apron" : cur.total > cur.lines.apron1 ? "Over 1st apron" : cur.total > cur.lines.tax ? "Taxpayer" : cur.total > cur.lines.cap ? "Over the cap" : "Under the cap";
  const statusCls = !cur ? "" : cur.total > cur.lines.apron1 ? "text-red-500" : cur.total > cur.lines.tax ? "text-amber-500" : cur.total > cur.lines.cap ? "text-slate-600 dark:text-slate-300" : "text-emerald-600";

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-1.5 px-1">Salary cap outlook</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-3 pt-3 pb-2">
        <style>{`@keyframes capRise { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
          {/* threshold lines */}
          {[["cap", "Cap", "#64748b"], ["tax", "Tax", "#f59e0b"], ["apron1", "1st apron", "#f97316"], ["apron2", "2nd apron", "#ef4444"]].map(([k, lbl, c]) => {
            const v = cur ? cur.lines[k] : capFor(y0)[k];
            return (
              <g key={k}>
                <line x1={padL} x2={W - padR + 4} y1={yOf(v)} y2={yOf(v)} stroke={c} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                <text x={W - padR + 7} y={yOf(v) + 2.5} fontSize="7" fontWeight="700" fill={c}>{lbl} ${Math.round(v)}M</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x = padL + slot * i + (slot - bw) / 2;
            let acc = 0;
            const on = d.yr === sel;
            return (
              <g key={d.yr} onClick={() => setSel(d.yr)} style={{ cursor: "pointer" }}>
                <rect x={padL + slot * i} y={padT} width={slot} height={H - padT - padB} fill={on ? color : "transparent"} opacity={on ? 0.06 : 0} rx="8" />
                {BUCKETS.map(([b, , c]) => {
                  const v = d.byBucket[b] || 0; if (!v) return null;
                  const y1 = yOf(acc + v), h = yOf(acc) - yOf(acc + v); acc += v;
                  return <rect key={b} x={x} y={y1} width={bw} height={h} fill={b === "committed" ? color : c} rx={1.5}
                    opacity={on ? 1 : 0.55} style={{ transformOrigin: `${x}px ${H - padB}px`, animation: `capRise .5s ease-out ${i * 80}ms both` }} />;
                })}
                <text x={x + bw / 2} y={yOf(d.total) - 4} textAnchor="middle" fontSize="9" fontWeight="800" fill="currentColor" className="text-slate-800 dark:text-slate-100">{d.total ? "$" + Math.round(d.total) + "M" : ""}</text>
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fontWeight={on ? 800 : 600} fill={on ? color : "#94a3b8"}>{seasonLabel(d.yr)}</text>
                {d.lines.projected && <text x={x + bw / 2} y={H + 0} textAnchor="middle" fontSize="6" fill="#94a3b8">proj. lines</text>}
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 mt-1">
          {BUCKETS.map(([b, lbl, c]) => (
            <span key={b} className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: b === "committed" ? color : c }} />{lbl}
            </span>
          ))}
        </div>
      </div>

      {cur && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Tile value={cur.total ? fmtM(cur.total) : "—"} label={seasonLabel(cur.yr) + " Payroll"} sub={cur.rows.length + " under contract"} />
            <Tile value={(room >= 0 ? "+" : "−") + fmtM(Math.abs(room)).slice(1)} label="vs Cap" valueClass={room >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"} sub={room >= 0 ? "cap space" : "over the cap"} />
            <Tile value={(vsTax >= 0 ? "+" : "−") + fmtM(Math.abs(vsTax)).slice(1)} label="vs Tax" valueClass={vsTax > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"} sub={{ label: status, cls: statusCls }} />
          </div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-5 mb-1.5 px-1">{seasonLabel(cur.yr)} on the books</div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {cur.rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8 px-6">No salary on the books for {seasonLabel(cur.yr)} yet.</div>}
            {cur.rows.map(({ p, salary, bucket, type }) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={p} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                    <span className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200 ml-2 shrink-0">{fmtM(salary)}</span>
                  </span>
                  <span className="flex items-center gap-2 mt-1">
                    <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: Math.max(2, (salary / cur.rows[0].salary) * 100) + "%", backgroundColor: bucket === "committed" ? color : BUCKETS.find(([b]) => b === bucket)[2] }} />
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 w-14 text-right shrink-0">{TYPE_LABEL[type] || type}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="text-[9px] text-slate-400 mt-2 px-1">Tap a season bar to switch. Cap holds for free agents aren't counted. {cur.lines.projected ? "Threshold lines for this season are projected at +5.5%/yr." : ""}</div>
        </>
      )}
    </div>
  );
}

// ═══════════════ BIO PANEL (Avg Age tile) ════════════════════════
function BioPanel({ roster, color, onSelectPlayer }) {
  const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
  const buckets = [["≤ 23", (a) => a <= 23], ["24–27", (a) => a >= 24 && a <= 27], ["28–31", (a) => a >= 28 && a <= 31], ["32+", (a) => a >= 32]]
    .map(([lbl, f]) => [lbl, ages.filter(f).length]);
  const maxB = Math.max(1, ...buckets.map(([, n]) => n));
  const exp = (p) => { const e = experienceOf(p); return e ? Number(String(e).replace(/\D/g, "")) : null; };
  const exps = roster.map(exp).filter((e) => e != null);
  const avgExp = exps.length ? exps.reduce((a, b) => a + b, 0) / exps.length : null;
  const rookies = roster.filter((p) => exp(p) === 1).length;
  const drafted = roster.filter((p) => !isUndrafted(p) && (p.draftYear || p.draftPick || p.draft)).length;
  const list = roster.slice().sort((a, b) => (Number(b.age) || 0) - (Number(a.age) || 0) || a.name.localeCompare(b.name));
  const draftLine = (p) => {
    if (isUndrafted(p)) return "Undrafted";
    const parts = [];
    if (p.draftYear) parts.push(String(p.draftYear));
    if (p.draftRound || p.draftPick) parts.push([p.draftRound ? "R" + p.draftRound : "", p.draftPick ? "#" + p.draftPick : ""].filter(Boolean).join(" "));
    else if (p.draft) parts.push(p.draft);
    return parts.length ? parts.join(" · ") : "";
  };
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile value={avgExp != null ? avgExp.toFixed(1) : "—"} label="Avg Exp" sub="seasons" />
        <Tile value={rookies} label="Rookies" sub={rookies === 1 ? "first season" : "first season"} />
        <Tile value={roster.length ? Math.round((drafted / roster.length) * 100) + "%" : "—"} label="Drafted" sub={drafted + " of " + roster.length} />
      </div>
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-5 mb-1.5 px-1">Age profile</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
        <div className="grid grid-cols-4 gap-2 items-end h-20">
          {buckets.map(([lbl, n]) => (
            <div key={lbl} className="flex flex-col items-center justify-end h-full">
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 mb-1">{n}</span>
              <div className="w-full rounded-t-md" style={{ height: Math.max(4, (n / maxB) * 52) + "px", backgroundColor: color, opacity: n ? 1 : 0.15 }} />
              <span className="text-[9px] font-semibold text-slate-400 mt-1.5">{lbl}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-5 mb-1.5 px-1">Roster bios · oldest first</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {list.map((p) => (
          <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
            <Avatar p={p} />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                <span className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">{p.age ? p.age + " yrs" : "—"}</span>
              </span>
              <span className="block text-[11px] text-slate-400 font-medium truncate">
                {[p.height, p.weight ? String(p.weight).replace(/\s*lbs?$/i, "") + " lbs" : "", experienceOf(p) ? experienceOf(p) : ""].filter(Boolean).join(" · ")}
              </span>
              <span className="block text-[10px] text-slate-400 truncate">
                {[draftLine(p), p.college, p.birthplace].filter(Boolean).join(" · ") || "No bio fields yet"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Horizontal swipe detector. Fires only on a clear sideways flick so
// vertical scrolling never triggers it.
function TeamDetail({ team, teams, players, onBack, onSelectPlayer, onSelectTeam, backLabel }) {
  // swipe right = back; swipe left = next team alphabetically
  const ordered = useMemo(() => (teams || []).filter((t) => !isFaTeam(t)).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))), [teams]);
  const idx = ordered.findIndex((t) => t.id === team.id);
  const nextTeam = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const prevTeam = idx > 0 ? ordered[idx - 1] : null;
  // Swipe left: next team. Swipe right: previous team if you've been
  // flipping through teams, otherwise back to the list.
  const swipe = useSwipe(
    () => { if (nextTeam && onSelectTeam) { SWIPE_DEPTH.n++; onSelectTeam(nextTeam); window.scrollTo(0, 0); } },
    () => { if (SWIPE_DEPTH.n > 0 && prevTeam && onSelectTeam) { SWIPE_DEPTH.n--; onSelectTeam(prevTeam); window.scrollTo(0, 0); } else { SWIPE_DEPTH.n = 0; onBack(); } }
  );
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const abbr = team.abbr || toAbbr(team.name);
  const [seg, setSeg] = useState("roster");
  const [rosterView, setRosterView] = useState("court"); // court | list
  const [statMode, setStatMode] = useState("leaders");
  const [cView, setCView] = useState("list"); // list | cap | fa | bio  (which tile is pressed)
  const faOnly = cView === "fa";
  const toggleC = (k) => setCView((v) => (v === k ? "list" : k));
  const faTeam = isFaTeam(team);
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
  const roleGroups = [...ROLE_ORDER.filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])].map((r) => [r, groups[r]]);
  // List view mirrors the court: Starters PG→C, then Bench/Reserves/Two-Way by minutes.
  const listGroups = useMemo(() => {
    if (isFaTeam(team)) return roleGroups;
    const lu = lineupOf(roster, abbr);
    return [["Starters", lu.starters.map((x) => Object.assign(Object.create(x.p), { _slot: x.slot }))], ...lu.benchGroups];
  }, [roster, abbr, team, LINEUPS[abbr]]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ {backLabel || "Teams"}</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-16 h-16 rounded-full object-contain bg-white p-1.5 shrink-0" />
          ) : (
            <span className="text-3xl">🏀</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">{team.name}</div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {(() => {
                if (!team.division) return [team.conference].filter(Boolean).join(" · ") || "—";
                const rivals = (teams || []).filter((t) => t.division === team.division)
                  .sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
                const i = rivals.findIndex((t) => t.id === team.id);
                const ord = i >= 0 ? (ORDINALS[i] || `${i + 1}th`) : null;
                return ord ? `${ord} in ${team.division} Division` : `${team.division} Division`;
              })()}
            </div>
            {team.arena && <div className="text-[11px] opacity-70 font-semibold mt-0.5 truncate">🏟 {team.arena}</div>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <div className={"grid grid-cols-3 gap-2" + (faTeam && seg !== "contracts" ? " hidden" : "")}>
          {seg === "contracts" ? (() => {
            // Contracts view tiles: payroll · free agents next offseason · avg age (ranked youngest → oldest)
            const fa = faEligible(roster).length;
            const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
            const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
            const teamAvg = (t) => {
              const ab = t.abbr || toAbbr(t.name);
              const rs = players.filter((q) => (q.teamId && q.teamId === t.id) || teamOfPlayer(q) === ab || String(q.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
              const as = rs.map((q) => Number(q.age)).filter((a) => a > 0);
              return as.length >= 5 ? as.reduce((a, b) => a + b, 0) / as.length : null;
            };
            const ageRanked = (teams || []).map((t) => [t.id, teamAvg(t)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
            const ageRank = ageRanked.findIndex(([id]) => id === team.id) + 1;
            const ageCls = ageRank ? (ageRank <= 10 ? "text-green-600 dark:text-green-400" : ageRank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400") : null;
            return (
              <>
                <Tile value={payroll ? fmtM(payroll) : "—"} label="Payroll" sub={roster.length + " players"} onClick={() => toggleC("cap")} active={cView === "cap"} activeColor={teamColor(abbr)} />
                <Tile value={fa} label="Free Agents" sub={"summer " + (startYear(CURRENT_SEASON) + 1)} onClick={() => toggleC("fa")} active={faOnly} activeColor={teamColor(abbr)} />
                <Tile value={avgAge != null ? avgAge.toFixed(1) : "—"} label="Avg Age" sub={ageRank ? { label: ordinal(ageRank) + (ageRank <= 3 ? " youngest" : ageRank >= ageRanked.length - 2 ? " oldest" : ""), cls: ageCls } : null} onClick={() => toggleC("bio")} active={cView === "bio"} activeColor={teamColor(abbr)} />
              </>
            );
          })() : (
            <>
              <Tile value={(team.wins ?? 0) + "-" + (team.losses ?? 0)} label="Record" />
              <Tile value={team.ppg != null ? team.ppg.toFixed(1) : "—"} label="PPG" sub={rankOf(teams, team, "ppg", "desc")} />
              <Tile value={team.oppPpg != null ? team.oppPpg.toFixed(1) : "—"} label="Opp PPG" sub={rankOf(teams, team, "oppPpg", "asc")} />
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["contracts", "Contracts"], ["stats", "Stats"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? "text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: teamColor(abbr) } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "roster" && !faTeam && (
          <div className="flex gap-2 mt-4">
            {[["court", "Court"], ["list", "List"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setRosterView(k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (rosterView === k
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={rosterView === k ? { backgroundColor: teamColor(abbr) } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && rosterView === "court" && !faTeam && (
          <CourtView roster={roster} abbr={abbr} team={team} teams={teams} onSelectPlayer={onSelectPlayer} />
        )}
        {seg === "stats" && (
          <TeamStatsPanel roster={roster} abbr={abbr} mode={statMode} setMode={setStatMode} onSelectPlayer={onSelectPlayer} />
        )}
        {seg === "roster" && (rosterView === "list" || faTeam) && listGroups.map(([role, members]) => (
          <div key={role}>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(faTeam ? members.slice().sort((a, b) => currentSalary(b) - currentSalary(a)) : members)
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                    <span className="w-7 text-center text-[11px] font-extrabold text-slate-400 uppercase shrink-0">{p._slot || courtPos(p) || "—"}</span>
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cleanNo(p.no) && <span className="text-slate-400 font-semibold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {!isActiveStatus(p) && <StatusBadge status={p.status} />}
                        <span className="flex-1" />
                        {(() => {
                          const st = latestStats(p), pv = prevStats(p);
                          if (!st || (st.pts == null && st.reb == null && st.ast == null)) return null;
                          const Arrow = ({ k }) => {
                            if (!pv || st[k] == null || pv[k] == null) return null;
                            const d = st[k] - pv[k];
                            if (Math.abs(d) < 0.05) return null;
                            return <span className={"text-[7px] leading-none " + (d > 0 ? "text-emerald-500" : "text-red-500")}>{d > 0 ? "▲" : "▼"}</span>;
                          };
                          return (
                            <span className="flex gap-1 shrink-0">
                              {[["G", "gp"], ["PTS", "pts"], ["REB", "reb"], ["AST", "ast"]].map(([lbl, k]) => (
                                <span key={lbl} className="w-[34px] text-center">
                                  <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                                  <span className="flex items-center justify-center gap-[2px] text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                                    <span>{k === "gp" ? (st.gp != null ? Math.round(st.gp) : "—") : (fmt1(st[k]) ?? "—")}</span>{k !== "gp" && <Arrow k={k} />}
                                  </span>
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </span>
                      {!isActiveStatus(p) && injuryLine(p) && (
                        <span className="block text-[11px] font-semibold text-red-500 mt-1 leading-snug">{injuryLine(p)}</span>
                      )}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {seg === "contracts" && cView === "cap" && <CapOutlook roster={roster} color={teamColor(abbr)} onSelectPlayer={onSelectPlayer} />}
        {seg === "contracts" && cView === "bio" && <BioPanel roster={roster} color={teamColor(abbr)} onSelectPlayer={onSelectPlayer} />}
        {seg === "contracts" && (cView === "list" || cView === "fa") && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">{faOnly ? "Free Agent Eligible · " + (startYear(CURRENT_SEASON) + 1) : "Team Contracts"}</span>
              <span className="text-[11px] font-bold text-slate-400">{(faOnly ? faEligible(roster) : roster).length} players</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {faOnly && faEligible(roster).length === 0 && <div className="text-center text-sm text-slate-400 py-10 px-6">Nobody expiring or holding an option next summer.</div>}
              {(faOnly ? faEligible(roster) : roster)
                .slice()
                .sort((a, b) => currentSalary(b) - currentSalary(a) || a.name.localeCompare(b.name))
                .map((p) => {
                  const act = activeOf(p);
                  return (
                    <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                      <Avatar p={p} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <span className="block text-[11px] text-slate-400 font-medium truncate">
                          {act ? <ContractLine c={act} /> : "No contract"}
                        </span>
                        {nextEvent(p) && (
                          <span className="block mt-1"><EventPill ev={nextEvent(p)} withDate /></span>
                        )}
                      </span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                        {currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"}
                      </span>
                    </button>
                  );
                })}
              {roster.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No players linked yet.</div>}
            </div>
          </>
        )}

        {seg === "roster" && roster.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No players linked to {team.name} yet.
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════ TAB: DRAFT ══════════════════════════════════════

function roundOf(p) {
  if (isUndrafted(p)) return null;
  if (p.draftRound != null) return Number(p.draftRound) || null;
  const t = String(p.draft || "");
  let m = t.match(/(?:round|rnd|rd|r)\s*\.?\s*(\d)/i) || t.match(/(\d)(?:st|nd)\s*round/i);
  if (m) return Number(m[1]);
  // fall back to the pick number: 1-30 first round, 31-60 second
  const pk = pickOf(p);
  if (pk !== 999) return pk <= 30 ? 1 : 2;
  return null;
}
function isUndrafted(p) {
  return /undrafted/i.test(String(p.draft || ""));
}
function draftedBy(p) {
  const m = String(p.draft || "").match(/\(([A-Za-z]{2,4})\)\s*$/);
  return m ? m[1].toUpperCase() : null;
}
function pickOf(p) {
  if (p.draftPick != null) return p.draftPick;
  const m = String(p.draft || "").match(/pick\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 999;
}


const STAT_CATS = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TO" },
];

function StatsTab({ players, onSelect }) {
  const seasons = Array.from(
    new Set(players.flatMap((p) => (p.stats || []).map((s) => s.season)).filter(Boolean))
  ).sort((a, b) => String(b).localeCompare(String(a)));
  const [selSeason, setSelSeason] = useState(null);
  const season = selSeason && seasons.includes(selSeason) ? selSeason : (seasons.includes(CURRENT_SEASON) ? CURRENT_SEASON : seasons[0]);
  const [cat, setCat] = useState("pts");

  const rows = players
    .map((p) => {
      const st = (p.stats || []).find((s) => s.season === season);
      return st && st[cat] != null ? { p, st } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.st[cat] - a.st[cat]);

  const catLabel = STAT_CATS.find((c) => c.key === cat)?.label || "";

  return (
    <div>
      <div className="bg-blue-600 pb-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <h1 className="text-3xl font-extrabold text-white mb-3">Stats</h1>
        {seasons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {seasons.map((s) => (
              <button key={s} onClick={() => setSelSeason(s)}
                className={"shrink-0 px-3 py-1 rounded-full text-xs font-bold " + (s === season ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {STAT_CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={"shrink-0 px-4 py-1.5 rounded-full text-sm font-bold " + (c.key === cat ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {rows.map(({ p, st }, i) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <span className="w-6 text-center text-sm font-extrabold shrink-0 text-slate-400">{i + 1}</span>
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[teamOfPlayer(p), p.pos].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <span className="text-right shrink-0 w-8">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">G</span>
                <span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  {st.gp != null ? Math.round(st.gp) : "—"}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{catLabel}</span>
                <span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  {st[cat].toFixed(1)}
                </span>
              </span>
            </button>
          ))}
          {rows.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-12 px-6">
              No {catLabel} entries for {season || "any season"} yet. Fill the Stats table in Airtable and they appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftTab({ players, onSelect, pills }) {
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
      <div className="bg-blue-600 pb-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <h1 className="text-3xl font-extrabold text-white mb-3">Draft</h1>
        {pills && <div className="mb-3">{pills}</div>}
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
        {[yr].filter((y) => y != null).map((yr) => {
          const cls = byYear[yr];
          const rounds = [
            ["Round 1", cls.filter((p) => roundOf(p) === 1)],
            ["Round 2", cls.filter((p) => roundOf(p) === 2)],
            ["Undrafted", cls.filter((p) => isUndrafted(p))],
            ["Round Unknown", cls.filter((p) => !isUndrafted(p) && (roundOf(p) == null || roundOf(p) > 2))],
          ].filter(([, g]) => g.length > 0);
          return (
            <div key={yr}>
              {rounds.map(([label, group]) => (
                <div key={label}>
                  <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">
                    {label}
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {group
                      .sort((a, b) => pickOf(a) - pickOf(b))
                      .map((p) => (
                        <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                          <span className="w-7 text-center text-sm font-extrabold text-slate-400 tabular-nums shrink-0">{pickOf(p) !== 999 ? pickOf(p) : "—"}</span>
                          <Avatar p={p} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                            <span className="block text-[11px] text-slate-400 font-medium truncate">{[p.pos, p.college].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                          <TeamPill team={draftedBy(p) || teamOfPlayer(p)} />
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
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
      <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
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

// ═══════════════ TAB: TONIGHT (daily matchups) ═══════════════════
// The first thing you see. Basketball is a daily sport, so instead of the
// NFL's "Week N" this is a day strip: yesterday, tonight, and the week ahead.
const ymdOf = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const ymdStr = (d) => String(ymdOf(d));
function dayLabel(d, today) {
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Tonight";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short" });
}

function TonightTab({ players, teams, onSelect, onSelectTeam }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [dayOff, setDayOff] = useState(0);           // days from today
  const [sb, setSb] = useState(null);
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i - 1); return d; }), [today]);
  const day = days[dayOff + 1];

  useEffect(() => {
    let alive = true;
    setSb(null);
    const load = () => fetch(`/api/scoreboard?date=${ymdStr(day)}`).then((r) => r.json())
      .then((d) => { if (alive && d && d.games) setSb(d); else if (alive && d && d.error) setSb({ games: [], error: d.error }); })
      .catch(() => { if (alive) setSb({ games: [], error: "unreachable" }); });
    load();
    const t = setInterval(load, 60000);              // live scores tick along
    return () => { alive = false; clearInterval(t); };
  }, [dayOff]);

  // Roster lookups so a game card can jump into a team, and so "your"
  // hurt players on tonight's slate get flagged on the card.
  const teamByAbbr = (abbr) => (teams || []).find((t) => (t.abbr || toAbbr(t.name)) === abbr || toAbbr(t.name) === toAbbr(abbr));
  const hurtOn = (abbr) => players.filter((p) => teamOfPlayer(p) === abbr && isHurt(p));

  const games = sb ? sb.games : [];
  const liveCount = games.filter((g) => g.state === "in").length;
  const finalCount = games.filter((g) => g.state === "post").length;
  const stamp = sb && sb.updatedAt ? new Date(sb.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const preseason = games.length > 0 && games.every((g) => g.seasonType === 1);

  return (
    <div>
      <div className="bg-blue-600 pb-3 px-4 sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl font-extrabold text-white">
            {dayLabel(day, today)} <span className="text-blue-200">({day.toLocaleDateString([], { month: "short", day: "numeric" })})</span>
          </h1>
          <span className="text-[11px] font-semibold text-blue-200">
            {!sb ? "loading…" : sb.error ? "scores unavailable" : liveCount > 0 ? `${liveCount} live · ${stamp} ↻` : stamp ? `scores ${stamp} ↻` : ""}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto mt-3 -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
          {days.map((d, i) => {
            const off = i - 1, on = off === dayOff;
            return (
              <button key={i} onClick={() => setDayOff(off)}
                className={"shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold leading-none " + (on ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
                <div>{dayLabel(d, today)}</div>
                <div className={"text-[9px] font-semibold mt-0.5 " + (on ? "text-blue-500" : "text-blue-200")}>{d.toLocaleDateString([], { month: "numeric", day: "numeric" })}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 pb-28">
        <style>{`@keyframes hrbRise { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes hrbPing { 75%, 100% { transform: scale(2.2); opacity: 0; } }`}</style>
        {!sb && <div className="p-6 text-center text-xs text-slate-400">Loading games…</div>}
        {sb && sb.error && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Couldn't reach the scoreboard</div>
            <div className="text-[11px] text-slate-400 mt-1">ESPN didn't answer. Pull down or check back in a minute.</div>
          </div>
        )}
        {sb && !sb.error && games.length === 0 && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 text-center">
            <div className="text-3xl mb-2">🏀</div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">No games {dayLabel(day, today).toLowerCase()}</div>
            <div className="text-[11px] text-slate-400 mt-1">Swipe the day strip to find the next slate.</div>
          </div>
        )}
        {preseason && <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Preseason</div>}
        {games.length > 0 && !preseason && (
          <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">
            {games.length} game{games.length === 1 ? "" : "s"}{finalCount > 0 ? ` · ${finalCount} final` : ""}
          </div>
        )}
        <div className="space-y-1.5">
          {games.map((g, gi) => {
            const isLive = g.state === "in", isFinal = g.state === "post";
            const tip = new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const Row = ({ t }) => {
              const lost = isFinal && !t.winner;
              const hurt = hurtOn(t.abbr);
              const tm = teamByAbbr(t.abbr);
              return (
                <button onClick={tm && onSelectTeam ? () => onSelectTeam(tm) : undefined} className="w-full flex items-center gap-2.5 text-left">
                  <img src={t.logo || TEAM_LOGOS[t.abbr] || ""} alt="" className="w-7 h-7 rounded-full bg-white object-contain shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={"text-[13px] font-extrabold tracking-wide " + (lost ? "text-slate-400" : "text-slate-900 dark:text-white")}>{t.abbr}</span>
                      {t.record && <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{t.record}</span>}
                      {hurt.length > 0 && <span className="text-[9px] font-extrabold text-red-500">{hurt.length} on report</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate leading-tight">{t.name}</div>
                  </div>
                  <div className={"w-9 text-right text-lg font-extrabold tabular-nums " + (lost ? "text-slate-400" : "text-slate-900 dark:text-white")}>
                    {g.state === "pre" ? "" : (t.score ?? 0)}
                  </div>
                </button>
              );
            };
            return (
              <div key={g.id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2 flex items-center gap-2"
                style={{ animation: `hrbRise .3s ease-out ${gi * 40}ms both` }}>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Row t={g.away} />
                  <Row t={g.home} />
                </div>
                <div className="w-20 shrink-0 text-center border-l border-slate-100 dark:border-slate-800 pl-2">
                  {isLive ? (
                    <>
                      <div className="text-xs font-extrabold text-rose-500 uppercase flex items-center justify-center gap-1">
                        <span className="relative flex w-2 h-2">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" style={{ animation: "hrbPing 1.4s cubic-bezier(0,0,.2,1) infinite" }} />
                          <span className="relative inline-flex rounded-full w-2 h-2 bg-rose-500" />
                        </span>
                        {g.detail}
                      </div>
                      {g.lastPlay && <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{g.lastPlay}</div>}
                    </>
                  ) : isFinal ? (
                    <div className="text-xs font-extrabold text-slate-500 dark:text-slate-300">{g.detail || "Final"}</div>
                  ) : (
                    <>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">{tip}</div>
                      {g.broadcast && <div className="text-[9px] font-semibold text-slate-400">{g.broadcast}</div>}
                    </>
                  )}
                  {g.note && <div className="text-[9px] font-bold text-blue-500 mt-0.5 truncate">{g.note}</div>}
                  {g.odds && (g.odds.details || g.odds.overUnder != null) && !isFinal && (
                    <div className="text-[9px] font-semibold text-slate-400 mt-0.5 tabular-nums">
                      {g.odds.details}{g.odds.overUnder != null ? ` · O/U ${g.odds.overUnder}` : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {games.length > 0 && (
          <div className="text-[9px] text-slate-400 mt-3 px-1">Tap a team to open its court. "On report" counts your Airtable players who aren't Active.</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ APP SHELL ═══════════════════════════════════════
const TABS = [
  { id: "tonight", label: "Matchups", icon: "📅" },
  { id: "teams", label: "Teams", icon: "🏀" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

// Branded loading state: a ball bouncing on a hardwood strip.
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center">
      <style>{`@keyframes hrbBounce { 0%, 100% { transform: translateY(0) scale(1, 1); } 45% { transform: translateY(-36px) scale(0.98, 1.02); } 55% { transform: translateY(-36px); } 100% { transform: translateY(0) scale(1.08, 0.92); } }
@keyframes hrbShadow { 0%, 100% { transform: scaleX(1); opacity: .35; } 50% { transform: scaleX(.55); opacity: .15; } }`}</style>
      <div className="text-5xl" style={{ animation: "hrbBounce .9s cubic-bezier(.3,0,.5,1) infinite" }}>🏀</div>
      <div className="mt-2 h-1.5 w-10 rounded-full bg-slate-400" style={{ animation: "hrbShadow .9s cubic-bezier(.3,0,.5,1) infinite" }} />
      <div className="mt-6 text-sm font-bold text-slate-500 dark:text-slate-400 tracking-wide">Loading…</div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("tonight"); // land on tonight's games
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selTeam, setSelTeam] = useState(null);
  const [error, setError] = useState(null);

  const [, setEspnTick] = useState(0);
  useEffect(() => {
    // Headshots + positions for anyone Airtable is missing them for.
    fetch("/api/lineups").then((r) => r.json())
      .then((d) => { if (d && d.lineups) { Object.assign(LINEUPS, d.lineups); setEspnTick((t) => t + 1); } })
      .catch(() => {});
    fetch("/api/espn-rosters").then((r) => r.json())
      .then((d) => { if (d && d.players) { Object.assign(ESPN_BY_NAME, d.players); setEspnTick((t) => t + 1); } })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        for (const t of d.teams || []) { const a = t.abbr || toAbbr(t.name); if (a && t.logo) TEAM_LOGOS[a] = t.logo; }
        setPlayers(d.players); setTeams(d.teams || []);
      } })
      .catch((e) => setError(String(e)));
  }, []);

  if (sel) {
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={selTeam ? selTeam.name : tab === "teams" ? "Teams" : tab === "tonight" ? "Matchups" : "Players"}
        mode="full"
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <LoadingScreen />}

      {players && tab === "tonight" && !selTeam && (
        <TonightTab players={players} teams={teams} onSelect={setSel} onSelectTeam={setSelTeam} />
      )}
      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={teams} players={players} onSelect={(t) => { SWIPE_DEPTH.n = 0; setSelTeam(t); }} />
      )}
      {players && (tab === "teams" || tab === "tonight") && selTeam && (
        <TeamDetail
          team={selTeam} teams={teams}
          players={players}
          onBack={() => setSelTeam(null)}
          onSelectPlayer={setSel}
          onSelectTeam={setSelTeam}
          backLabel={tab === "tonight" ? "Matchups" : "Teams"}
        />
      )}
      {players && tab === "players" && <PlayersHub players={players} onSelect={setSel} />}
      {players && tab === "stats" && <StatsTab players={players} onSelect={setSel} />}

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
