import React from "react";
import { useState, useMemo, useEffect } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2026";

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

// ═══════════════ CHIP THEME (edit these to restyle every stat pill) ═══
// Every colored stat chip in the app - Brl%, GB%, HR/9, lineup chips,
// board pills - reads from these four strings. Green always means
// "good for the HR bet", red always means "fights it".
const CHIP = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
  none: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};
// The headline HR% number and scorecard accents.
const HR_ACCENT = "text-emerald-600 dark:text-emerald-400";

const TEAM_COLORS = {
  ARI: "#A71930", ATL: "#CE1141", BAL: "#DF4601", BOS: "#BD3039",
  CHC: "#0E3386", CWS: "#27251F", CHW: "#27251F", CIN: "#C6011F",
  CLE: "#00385D", COL: "#333366", DET: "#0C2340", HOU: "#002D62",
  KC: "#004687", LAA: "#BA0021", LAD: "#005A9C", MIA: "#00A3E0",
  MIL: "#12284B", MIN: "#002B5C", NYM: "#002D72", NYY: "#003087",
  OAK: "#003831", ATH: "#003831", PHI: "#E81828", PIT: "#FDB827",
  SD: "#2F241D", SF: "#FD5A1E", SEA: "#0C2C56", STL: "#C41E3A",
  TB: "#092C5C", TEX: "#003278", TOR: "#134A8E", WSH: "#AB0003",
};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "arizona diamondbacks": "ARI", "atlanta braves": "ATL", "baltimore orioles": "BAL",
  "boston red sox": "BOS", "chicago cubs": "CHC", "chicago white sox": "CWS",
  "cincinnati reds": "CIN", "cleveland guardians": "CLE", "colorado rockies": "COL",
  "detroit tigers": "DET", "houston astros": "HOU", "kansas city royals": "KC",
  "los angeles angels": "LAA", "los angeles dodgers": "LAD", "miami marlins": "MIA",
  "milwaukee brewers": "MIL", "minnesota twins": "MIN", "new york mets": "NYM",
  "new york yankees": "NYY", "oakland athletics": "ATH", "athletics": "ATH",
  "philadelphia phillies": "PHI", "pittsburgh pirates": "PIT", "san diego padres": "SD",
  "san francisco giants": "SF", "seattle mariners": "SEA", "st. louis cardinals": "STL",
  "st louis cardinals": "STL", "tampa bay rays": "TB", "texas rangers": "TEX",
  "toronto blue jays": "TOR", "washington nationals": "WSH",
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
const BADGE = { PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-slate-500 dark:text-slate-400", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

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
const MLB_ID_CACHE = {};
const STREAK_BY_ID = {};
function LiveStreak({ p }) {
  const key = String(p.name || "").toLowerCase();
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let mid = MLB_ID_CACHE[key];
        if (mid === undefined) {
          const d = await (await fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(p.name)}`)).json();
          mid = (d.people || [])[0] ? d.people[0].id : null;
          MLB_ID_CACHE[key] = mid;
        }
        if (!mid || STREAK_BY_ID[mid] !== undefined) { if (alive) force((x) => x + 1); return; }
        const gl = await (await fetch(`https://statsapi.mlb.com/api/v1/people/${mid}/stats?stats=gameLog&group=hitting`)).json();
        const splits = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
        const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
        let n = 0;
        for (let j = splits.length - 1; j >= 0; j--) {
          if (splits[j].date === todayET) continue;
          const st = splits[j].stat || {};
          if ((st.atBats ?? 0) === 0) continue;
          if ((st.hits ?? 0) > 0) { if (n < 0) break; n++; }
          else { if (n > 0) break; n--; }
        }
        STREAK_BY_ID[mid] = n;
        if (alive) force((x) => x + 1);
      } catch {}
    })();
    return () => { alive = false; };
  }, [key]);
  const mid = MLB_ID_CACHE[key];
  const n = mid != null ? STREAK_BY_ID[mid] : undefined;
  if (n == null) return null;
  if (n >= 5) return <span className="ml-1 text-[11px] font-extrabold text-orange-500">{n}🔥</span>;
  if (n <= -5) return <span className="ml-1 text-[11px] font-extrabold text-sky-400">{-n}❄️</span>;
  return null;
}
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : "w-11 h-11 text-sm";
  const key = String(p.name || "").toLowerCase();
  const [mid, setMid] = useState(MLB_ID_CACHE[key]);
  useEffect(() => {
    if (p.photo || MLB_ID_CACHE[key] !== undefined) return;
    let alive = true;
    MLB_ID_CACHE[key] = null; // claim so parallel rows don't double-fetch
    fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(p.name)}`)
      .then((r) => r.json())
      .then((d) => {
        const person = (d.people || [])[0];
        MLB_ID_CACHE[key] = person ? person.id : null;
        if (alive) setMid(MLB_ID_CACHE[key]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);
  if (p.photo) {
    return <img src={p.photo} alt={p.name} className={px + " rounded-full object-cover object-top bg-white shrink-0"} />;
  }
  if (mid) {
    return <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + mid + "/headshot/silo/current"}
      alt={p.name} className={px + " rounded-full object-cover object-top bg-white shrink-0"} loading="lazy" />;
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

function Tile({ value, label, sub, accent, valueClass, topColor }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-2 py-4 text-center shadow-sm flex flex-col items-center justify-start"
      style={topColor ? { borderTop: "3px solid " + topColor } : undefined}>
      <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">{label}</div>
      <div className={"text-2xl font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}</div>
      {sub && (
        <div className={"text-[10px] font-bold mt-0.5 " + (typeof sub === "object" && sub.cls ? sub.cls : "text-blue-600 dark:text-blue-400")}>
          {typeof sub === "object" && sub.label !== undefined ? sub.label : sub}
        </div>
      )}
    </div>
  );
}


// "2026-2027" -> "'26-'27"; falls back to the old single-year tick
function seasonTick(y) {
  const raw = String(y.season || "");
  const m = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return "'" + m[1].slice(2) + "-'" + m[2].slice(2);
  const single = raw.match(/(\d{4})/);
  if (single) return single[1];
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
function TrendsChart({ p }) {
  const [gl, setGl] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await (await fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(p.name)}`)).json();
        const person = (s.people || [])[0];
        if (!person) { if (alive) setGl([]); return; }
        const g = await (await fetch(`https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=gameLog&group=hitting`)).json();
        const splits = (g.stats && g.stats[0] && g.stats[0].splits) || [];
        if (alive) setGl(splits.filter((x) => x.stat && x.stat.atBats != null).slice(-30));
      } catch { if (alive) setGl([]); }
    })();
    return () => { alive = false; };
  }, [p.id]);
  if (gl == null || gl.length < 3) return null;
  const sum = (f) => gl.reduce((a, x) => a + (x.stat[f] || 0), 0);
  const hrTot = sum("homeRuns"), hits = sum("hits"), abs = sum("atBats");
  const max = Math.max(3, ...gl.map((x) => x.stat.hits || 0));
  return (
    <div className="px-4 mt-6">
      <div className="text-[11px] font-bold tracking-widest uppercase mb-2 px-1 text-slate-500 dark:text-slate-400">Trends · Last {gl.length} Games</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
        <div className="flex items-end gap-[2px] h-16">
          {gl.map((x, i2) => {
            const h = x.stat.hits || 0;
            const hr = (x.stat.homeRuns || 0) > 0;
            return (
              <span key={i2}
                className={"flex-1 rounded-t " + (hr ? "bg-orange-500" : h > 0 ? "bg-emerald-400 dark:bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")}
                style={{ height: Math.max(8, (h / max) * 100) + "%" }} />
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
          <span>{gl[0].date}</span><span>{gl[gl.length - 1].date}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {[["HR", hrTot], ["Hits", hits], ["AVG", abs ? (hits / abs).toFixed(3).replace(/^0/, "") : "—"]].map(([lbl, v]) => (
            <span key={lbl}>
              <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
              <span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
            </span>
          ))}
        </div>
        <div className="text-[9px] text-slate-400 mt-2">Bar height = hits per game · orange = homered · gray = hitless</div>
      </div>
    </div>
  );
}

function PlayerDetail({ p, onBack, backLabel, mode = "full" }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
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
              <div className="text-xs font-bold mt-1 truncate" style={{ color: "#f87171" }}>{p.injuryNotes}</div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {(p.rating2k != null || currentSalary(p) > 0 || nextEvent(p)) && (
        <div className="grid grid-cols-3 gap-2">
          <Tile
            value={p.rating2k != null ? Math.round(p.rating2k) : "—"}
            label="The Show"
            valueClass={p.rating2k == null ? null
              : Math.round(p.rating2k) >= 90 ? "text-amber-500 dark:text-amber-400"
              : Math.round(p.rating2k) >= 80 ? "text-slate-500 dark:text-slate-300"
              : "text-orange-700 dark:text-orange-400"}
          />
          <Tile value={currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"} label={CURRENT_SEASON + " Salary"} />
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
        </div>)}

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height / Weight" v={[p.height, p.weight].filter(Boolean).join(" · ")} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(": ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow
                k={["Pitching", "Bullpen"].includes(unitOf(p)) ? "Throws" : ["Batting", "Bench"].includes(unitOf(p)) ? "Bats" : "Bats / Throws"}
                v={(() => {
                  const parts = String(p.bt || "").split("/").map((x) => x.trim()).filter(Boolean);
                  if (parts.length < 2) return p.bt;
                  return ["Pitching", "Bullpen"].includes(unitOf(p)) ? parts[parts.length - 1] : parts[0];
                })()}
              />
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
                const isP = ["Pitching", "Bullpen"].includes(unitOf(p));
                const showBat = !isP || st.avg != null || st.hr != null || st.rbi != null;
                const showPit = isP || st.era != null || st.w != null || st.sv != null || st.whip != null;
                const fmtPct = (v) => (v == null ? null : Number(v).toFixed(1) + "%");
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{st.season || "—"}</div>
                    {showBat && <div className="flex justify-between">
                      {[["G", st.gp != null ? Math.round(st.gp) : null], ["AVG", st.avg != null ? Number(st.avg).toFixed(3).replace(/^0/, "") : null], ["HR", st.hr != null ? Math.round(st.hr) : null], ["RBI", st.rbi != null ? Math.round(st.rbi) : null], ["SB", st.sb != null ? Math.round(st.sb) : null], ...(i === 0 && p.barrel != null ? [["BRL%", Number(p.barrel).toFixed(1) + "%"]] : []), ...(i === 0 && p.bbe != null ? [["BBE", Math.round(p.bbe)]] : [])].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>}
                    {(st.avgVl != null || st.avgVr != null || st.opsVl != null || st.opsVr != null) && (
                      <div className="flex justify-between mt-2">
                        {[["AVG vs LHP", st.avgVl != null ? Number(st.avgVl).toFixed(3).replace(/^0/, "") : null], ["OPS vs LHP", st.opsVl != null ? Number(st.opsVl).toFixed(3).replace(/^0/, "") : null], ["AVG vs RHP", st.avgVr != null ? Number(st.avgVr).toFixed(3).replace(/^0/, "") : null], ["OPS vs RHP", st.opsVr != null ? Number(st.opsVr).toFixed(3).replace(/^0/, "") : null]].map(([lbl, v]) => (
                          <span key={lbl} className="flex-1 text-center">
                            <span className="block text-[8px] font-bold text-slate-400">{lbl}</span>
                            <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {showPit && <div className="flex justify-between mt-2">
                      {[["W-L", st.w != null || st.l != null ? `${Math.round(st.w || 0)}-${Math.round(st.l || 0)}` : null], ["ERA", st.era != null ? Number(st.era).toFixed(2) : null], ["SO", st.so != null ? Math.round(st.so) : null], ["SV", st.sv != null ? Math.round(st.sv) : null], ...(i === 0 && p.hr9 != null ? [["HR/9", Number(p.hr9).toFixed(2)]] : [])].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>}
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
      {mode === "full" && <TrendsChart p={p} />}
    </div>
  );
}

// ═══════════════ LIST HEADER (shared) ════════════════════════════
function ListHeader({ title, q, setQ, placeholder }) {
  if (!setQ) return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
    </div>
  );
  return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
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

// Populated once data loads: abbr -> logo URL
const TEAM_LOGOS = {};

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = TEAM_LOGOS[abbr];
  if (logo) {
    return <img src={logo} alt={abbr} className="w-8 h-8 rounded-full object-contain bg-white shrink-0" />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
function PlayersTab({ players, onSelect }) {
  const [q, setQ] = useState("");
  const [pill, setPill] = useState("active");
  const isRetired = (p) => String(p.status || "").toLowerCase().includes("retire");
  const list = useMemo(
    () => players.filter((p) => (pill === "retired" ? isRetired(p) : !isRetired(p))).filter((p) => matchesQuery(p, q)),
    [players, q, pill]
  );
  const pillsBar = (
    <div className="flex gap-2 px-4 mt-3">
      {[["active", "Active"], ["contracts", "Contracts"], ["retired", "Retired"]].map(([id, label]) => (
        <button key={id} onClick={() => setPill(id)}
          className={"flex-1 py-2 rounded-full text-[11px] font-extrabold " + (pill === id
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-800")}>
          {label}
        </button>
      ))}
    </div>
  );
  if (pill === "contracts") return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      {pillsBar}
      <ContractsTab players={players} onSelect={onSelect} embedded extQ={q} />
    </div>
  );
  return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      {pillsBar}
      {pill === "retired" && list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No retired players saved yet.</div>}
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
              </span>
              <TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} />
            </button>
          ))}
          {list.length === 0 && faOnly && <div className="text-center text-sm text-slate-400 py-12 px-6">No events for the {startYear(CURRENT_SEASON) + 1} offseason yet. Add UFA/RFA rows or option years in Contract Years.</div>}
          {list.length === 0 && !faOnly && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
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
      if (!best || String(y.season) < String(best.season)) best = { kind, season: y.season };
    }
  }
  if (!best) return null;
  return { ...best, label: best.kind + " " + String(best.season).slice(0, 4) };
}

const EVENT_WORDS = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
const EVENT_COLORS = {
  PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  UFA: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  RFA: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
};

function EventPill({ ev }) {
  if (!ev) return null;
  const cls = EVENT_COLORS[ev.kind] || EVENT_COLORS.UFA;
  return (
    <span className={"inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {EVENT_WORDS[ev.kind] || ev.kind} {seasonTick({ season: ev.season })}
    </span>
  );
}


// The season after the current one - "2025-2026" -> "2026-2027". Rolls forward with CURRENT_SEASON.
function nextSeason(s) {
  const m = String(s).match(/(\d{4})\s*-\s*(\d{4})/);
  if (!m) return null;
  return (Number(m[1]) + 1) + "-" + (Number(m[2]) + 1);
}

function ContractsTab({ players, onSelect, embedded = false, extQ }) {
  const [qState, setQ] = useState("");
  const q = embedded ? (extQ || "") : qState;
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
      {!embedded && <ListHeader title="Contracts" q={qState} setQ={setQ} />}
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
                    {act ? displayLine(act) : "No contract"}
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

const ROLE_ORDER = ["Batting", "Pitching", "Bullpen", "Bench"];
const CAT_ORDER = ["__P__", "__C__", "__IF__", "__OF__", "__DH__"];
const CAT_LABELS = { __P__: "Pitchers", __C__: "Catchers", __IF__: "Infielders", __OF__: "Outfielders", __DH__: "Designated Hitters" };
const catOf = (p) => {
  // Split multi-position strings ("OF/1B", "CF-RF", "1B, OF") into tokens
  // and classify by the FIRST recognizable one — Bellinger-proof.
  const tokens = String(p.pos || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (["P", "SP", "RP", "CP", "CL", "LHP", "RHP"].includes(t)) return "__P__";
    if (t === "C") return "__C__";
    if (["LF", "CF", "RF", "OF"].includes(t)) return "__OF__";
    if (["1B", "2B", "3B", "SS", "IF", "UT", "INF"].includes(t)) return "__IF__";
    if (t === "DH") return "__DH__";
  }
  return "__IF__";
};
const UNIT_LABELS = { Batting: "Batting Order", Pitching: "Pitching Rotation", Bullpen: "Bullpen", Bench: "Bench" };
// "R/R" -> throws with the right hand -> RHP
function pitcherHand(p) {
  const t = String(p.bt || "").trim().split("/").pop().trim().toUpperCase();
  return t === "R" ? "RHP" : t === "L" ? "LHP" : null;
}
// "L/R" -> bats left -> "L"; switch hitters show "S"
function batterHand(p) {
  const b = String(p.bt || "").trim().split("/")[0].trim().toUpperCase();
  return b === "L" || b === "R" || b === "S" ? b : null;
}
// Role wins in baseball (a Bench player keeps his fielding position), then
// position decides: SP -> Pitching, RP/CP -> Bullpen, everyone else Batting.
const POS_UNIT = {};
for (const p of ["SP"]) POS_UNIT[p] = "Pitching";
for (const p of ["RP", "CP", "CL"]) POS_UNIT[p] = "Bullpen";
for (const p of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "IF", "UT"]) POS_UNIT[p] = "Batting";
function statusRank(p) {
  const s = String(p.status || "").toLowerCase();
  if (s.includes("active") || s.includes("available")) return 0;
  const m = s.match(/(\d+)\s*-?\s*day/) || s.match(/il-?(\d+)/);
  if (m) return 100 + Number(m[1]);
  if (s.includes("il") || s.includes("injur") || s.includes("out")) return 400;
  if (s.includes("minor")) return 900;
  return 500;
}

function unitOf(p) {
  if (ROLE_ORDER.includes(p.role)) return p.role;
  const pos = String(p.pos || "").toUpperCase().trim();
  if (POS_UNIT[pos]) return POS_UNIT[pos];
  if (pos === "P") return "Pitching";
  return "Roster";
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

// HR park rank, 1 = most homer-friendly. Based on recent MLB park factors;
// edit freely - venue names must match MLB's official venue.name strings.
const PARK_HR_RANK = {
  "Great American Ball Park": 1, "Yankee Stadium": 2, "Citizens Bank Park": 3,
  "Dodger Stadium": 4, "Coors Field": 5, "Sutter Health Park": 6, "Truist Park": 7,
  "Angel Stadium": 8, "Rogers Centre": 9, "Wrigley Field": 10, "American Family Field": 11,
  "Daikin Park": 12, "Citi Field": 13, "Fenway Park": 14, "Rate Field": 15,
  "Chase Field": 16, "Nationals Park": 17, "Busch Stadium": 18, "Target Field": 19,
  "PNC Park": 20, "Kauffman Stadium": 21, "Oriole Park at Camden Yards": 22,
  "Progressive Field": 23, "loanDepot park": 24, "Petco Park": 25, "Oracle Park": 26,
  "T-Mobile Park": 27, "George M. Steinbrenner Field": 28, "Tropicana Field": 27, "Comerica Park": 29,
  "Globe Life Field": 30,
};
const PARK_RANK_NORM = (() => {
  const m = {};
  for (const k of Object.keys(PARK_HR_RANK)) m[k.toLowerCase().replace(/\s+/g, " ").trim()] = PARK_HR_RANK[k];
  return m;
})();
// ═══ HR park factors by BATTER HANDEDNESS (Statcast-style, 100 = avg) ═══
// 3-year HR factors, updated Aug 2026. Verified anchors: Cincinnati has
// boosted LHB homers ~40% and Oracle suppressed them ~23% over recent
// 3-yr windows; Progressive turned LHB-friendly after the 2024 fence/wind
// change; Citi favors L and punishes R; Petco plays ~+4% for HR.
// The rest are best available estimates - REFRESH EACH APRIL from
// baseballsavant.mlb.com/leaderboard/statcast-park-factors
// (Year → rolling 3 → stat HR → batSide L, then R) and paste over.
// Scoring damps these by ^0.7, so a few points of error stays small.
const PARK_HR_LR = {
  "coors field": { L: 112, R: 112 },
  "great american ball park": { L: 138, R: 124 },
  "yankee stadium": { L: 118, R: 104 },
  "citizens bank park": { L: 112, R: 114 },
  "angel stadium": { L: 104, R: 112 },
  "dodger stadium": { L: 112, R: 110 },
  "truist park": { L: 105, R: 108 },
  "globe life field": { L: 104, R: 104 },
  "rogers centre": { L: 104, R: 102 },
  "oriole park at camden yards": { L: 106, R: 96 },
  "camden yards": { L: 106, R: 96 },
  "fenway park": { L: 92, R: 104 },
  "wrigley field": { L: 102, R: 100 },
  "target field": { L: 100, R: 102 },
  "rate field": { L: 110, R: 108 },
  "guaranteed rate field": { L: 110, R: 108 },
  "progressive field": { L: 108, R: 96 },
  "daikin park": { L: 104, R: 110 },
  "minute maid park": { L: 104, R: 110 },
  "t-mobile park": { L: 96, R: 100 },
  "citi field": { L: 106, R: 94 },
  "nationals park": { L: 106, R: 100 },
  "busch stadium": { L: 92, R: 90 },
  "pnc park": { L: 84, R: 90 },
  "kauffman stadium": { L: 88, R: 90 },
  "ewing m. kauffman stadium": { L: 88, R: 90 },
  "comerica park": { L: 94, R: 96 },
  "american family field": { L: 108, R: 104 },
  "petco park": { L: 102, R: 104 },
  "oracle park": { L: 78, R: 94 },
  "chase field": { L: 104, R: 100 },
  "loandepot park": { L: 92, R: 94 },
  "tropicana field": { L: 96, R: 98 },
  "sutter health park": { L: 112, R: 106 },
  "george m. steinbrenner field": { L: 120, R: 110 },
  "steinbrenner field": { L: 120, R: 110 },
};
// batHand: "L" | "R" | "S"; pitHand used to resolve switch hitters.
// Returns { f: multiplier-for-scoring, shown: raw index, hand } or null.
function parkFactorLR(venueName, batHand, pitHand) {
  const rec = PARK_HR_LR[String(venueName || "").trim().toLowerCase()];
  if (!rec) return null;
  let hand = batHand === "S" ? (pitHand === "L" ? "R" : pitHand === "R" ? "L" : null) : batHand;
  const idx = hand === "L" ? rec.L : hand === "R" ? rec.R : (rec.L + rec.R) / 2;
  if (idx == null) return null;
  return { f: Math.pow(idx / 100, 0.7), shown: Math.round(idx), hand: hand || "S" };
}
function parkRankFor(name) {
  const n = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (PARK_RANK_NORM[n]) return PARK_RANK_NORM[n];
  for (const k of Object.keys(PARK_RANK_NORM)) {
    if (n.includes(k) || k.includes(n)) return PARK_RANK_NORM[k];
  }
  return null;
}

function parkRankColor(rank) {
  if (rank <= 10) return "text-emerald-600 dark:text-emerald-400"; // most HR-friendly
  if (rank <= 20) return "text-yellow-400";
  return "text-red-500"; // toughest parks for homers
}
function wxEmoji(c) {
  const s = String(c || "").toLowerCase();
  if (s.includes("partly")) return "⛅";
  if (s.includes("sun") || s.includes("clear")) return "☀️";
  if (s.includes("cloud") || s.includes("overcast")) return "☁️";
  if (s.includes("storm") || s.includes("thunder")) return "⛈️";
  if (s.includes("rain") || s.includes("shower") || s.includes("drizzle")) return "🌧️";
  if (s.includes("snow")) return "❄️";
  if (s.includes("dome") || s.includes("roof")) return "🏟️";
  return "🌡️";
}

function ordinalize(n) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
}

class HRBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) return (
      <div className="p-6 pt-20">
        <div className="text-sm font-bold text-red-500 break-words">Breakdown error: {String((this.state.err && this.state.err.message) || this.state.err)}</div>
        <button className="mt-4 text-sm font-extrabold text-blue-600" onClick={this.props.onBack}>‹ Back</button>
      </div>
    );
    return this.props.children;
  }
}

function GameDetail({ g, players, onSelectPlayer, onBack }) {
  const [side, setSide] = useState("away");
  const [box, setBox] = useState(null);
  const [pstats, setPstats] = useState({});
  const [vsHand, setVsHand] = useState({});
  const [curBatter, setCurBatter] = useState(null);
  const [inning, setInning] = useState(null);
  const [wx, setWx] = useState(null);
  const [liveDef, setLiveDef] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const yr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 4);
      const ids = ["away", "home"].map((k) => g.teams[k].probablePitcher && g.teams[k].probablePitcher.id).filter(Boolean);
      const [b, ppl, ls, feed] = await Promise.all([
        fetch(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`).then((r) => r.json()).catch(() => ({})),
        ids.length ? fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[pitching],type=[season])`).then((r) => r.json()).catch(() => ({})) : Promise.resolve({}),
        fetch(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/linescore`).then((r) => r.json()).catch(() => ({})),
        fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`).then((r) => r.json()).catch(() => ({})),
      ]);
      if (!alive) return;
      setBox(b);
      setCurBatter((ls && ls.offense && ls.offense.batter && ls.offense.batter.id) || null);
      if (ls && ls.currentInning) setInning({ half: (ls.inningHalf || (ls.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "TOP" : "BOT", num: ls.currentInning });
      if (feed && feed.gameData && feed.gameData.weather && feed.gameData.weather.temp) setWx(feed.gameData.weather);
      const lp = ls && ls.defense && ls.defense.pitcher;
      const offTeam = ls && ls.offense && ls.offense.team && ls.offense.team.id;
      if (lp && lp.id) setLiveDef({ id: lp.id, name: lp.fullName, offenseTeamId: offTeam });
      const outP = {};
      await Promise.all((ppl.people || []).map(async (person) => {
        const sp = (person.stats && person.stats[0] && person.stats[0].splits && person.stats[0].splits[0] && person.stats[0].splits[0].stat) || {};
        outP[person.id] = { hand: person.pitchHand && person.pitchHand.code, w: sp.wins, l: sp.losses, era: sp.era, ip: sp.inningsPitched, so: sp.strikeOuts, bb: sp.baseOnBalls, hr: sp.homeRuns, whip: sp.whip, gs: sp.gamesStarted };
        try {
          const gl = await (await fetch(`https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=gameLog&season=${yr}&group=pitching`)).json();
          const gls = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
          outP[person.id].hrL9 = gls.slice(-9).reduce((acc, s) => acc + Number((s.stat && s.stat.homeRuns) || 0), 0);
        } catch {}
      }));
      // Reliever on the mound who wasn't a probable: pull his season line too
      const lp2 = ls && ls.defense && ls.defense.pitcher;
      if (lp2 && lp2.id && !outP[lp2.id]) {
        try {
          const extra = await (await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${lp2.id}&hydrate=stats(group=[pitching],type=[season])`)).json();
          for (const person of extra.people || []) {
            const sp2 = (person.stats && person.stats[0] && person.stats[0].splits && person.stats[0].splits[0] && person.stats[0].splits[0].stat) || {};
            outP[person.id] = { hand: person.pitchHand && person.pitchHand.code, w: sp2.wins, l: sp2.losses, era: sp2.era, ip: sp2.inningsPitched, so: sp2.strikeOuts, bb: sp2.baseOnBalls, hr: sp2.homeRuns, whip: sp2.whip };
          }
        } catch {}
      }
      if (!alive) return;
      setPstats(outP);
      try {
        const outSplits = {};
        await Promise.all(["away", "home"].map(async (k) => {
          const oppP = g.teams[k === "away" ? "home" : "away"].probablePitcher;
          const hand = oppP && outP[oppP.id] && outP[oppP.id].hand === "L" ? "vl" : "vr";
          const orderIds = (b.teams && b.teams[k] && b.teams[k].battingOrder) || [];
          if (!orderIds.length) return;
          const res = await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${orderIds.join(",")}&hydrate=stats(group=[hitting],type=[statSplits],sitCodes=[${hand}],season=${yr})`);
          const data = await res.json();
          for (const person of data.people || []) {
            outSplits[person.id] = outSplits[person.id] || {};
            if (person.batSide && person.batSide.code) outSplits[person.id].bats = person.batSide.code;
            for (const grp of person.stats || []) {
              for (const s of grp.splits || []) {
                if (s.split && (s.split.code === "vl" || s.split.code === "vr") && s.stat) {
                  outSplits[person.id].avg = s.stat.avg;
                  outSplits[person.id].hr = s.stat.homeRuns;
                  outSplits[person.id].rbi = s.stat.rbi;
                  outSplits[person.id].ops = s.stat.ops;
                }
              }
            }
          }
        }));
        if (alive) setVsHand(outSplits);
      } catch {}
    })();
    return () => { alive = false; };
  }, [g.gamePk]);
  const myByName = useMemo(() => {
    const m = {};
    for (const p of players || []) {
      const st = latestStats(p);
      m[hrbNrm(p.name)] = { player: p, photo: p.photo || null, streak: st && st.streak != null ? Math.round(st.streak) : 0, barrel: p.barrel, hr9: p.hr9, gb: p.gb, bbe: p.bbe };
    }
    return m;
  }, [players]);

  const abbrOf = (k) => {
    const nm = (g.teams[k].team && g.teams[k].team.name) || "";
    return NAME_TO_ABBR[nm.toLowerCase()] || toAbbr(nm) || "";
  };
  const state = g.status && g.status.abstractGameState;
  const timeLabel = state === "Final" ? "Final" : state === "Live" ? "LIVE" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(g.gameDate));
  const oppKey = side === "away" ? "home" : "away";
  const probable = g.teams[oppKey].probablePitcher;
  const sideTeamId = g.teams[side].team && g.teams[side].team.id;
  const liveNow = state === "Live" && liveDef && liveDef.offenseTeamId === sideTeamId && liveDef.id !== (probable && probable.id)
    ? { id: liveDef.id, fullName: liveDef.name } : null;
  const pp = liveNow || probable;
  const ps = pp ? pstats[pp.id] : null;
  const myPP = pp ? myByName[hrbNrm(pp.fullName)] : undefined;
  const teamBox = box && box.teams && box.teams[side];
  const order = (teamBox && teamBox.battingOrder) || [];

  return (
    <div>
      <div className="px-4 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", backgroundColor: teamColor(abbrOf(side)) }}>
        <button onClick={onBack} className="text-white/90 text-sm font-semibold mb-3">‹ Matchups</button>
        <div className="flex items-center justify-between">
          {["away", "home"].map((k) => {
            const ab = abbrOf(k);
            const logo = TEAM_LOGOS[ab];
            const rec = g.teams[k].leagueRecord ? g.teams[k].leagueRecord.wins + "-" + g.teams[k].leagueRecord.losses : "";
            return (
              <div key={k} className={"flex items-center gap-3 " + (k === "home" ? "flex-row-reverse text-right" : "")}>
                {logo ? (
                  <img src={logo} alt="" className="w-12 h-12 rounded-full object-contain bg-white shrink-0" />
                ) : (
                  <span className="w-12 h-12 rounded-full shrink-0" style={{ backgroundColor: teamColor(ab) }} />
                )}
                <div>
                  <div className="text-white font-extrabold text-lg leading-tight">{ab}</div>
                  <div className="text-white/70 text-[11px] font-bold">{rec}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="text-white text-3xl font-extrabold tabular-nums">{g.teams.away.score != null ? g.teams.away.score : "–"}</span>
          <span className={"text-[11px] font-extrabold " + (state === "Live" ? "text-red-500" : "text-white/70")}>{timeLabel}</span>
          <span className="text-white text-3xl font-extrabold tabular-nums">{g.teams.home.score != null ? g.teams.home.score : "–"}</span>
        </div>
        {state === "Live" && inning && (
          <div className="text-center text-[11px] font-extrabold text-white/80 mt-1">{inning.half} {inning.num}</div>
        )}
        {wx && (
          <div className="text-center text-[11px] font-bold text-white/70 mt-1">
            {wxEmoji(wx.condition)} {wx.temp}° · {wx.condition}
            {wx.wind ? " · 💨 " + wx.wind : ""}
          </div>
        )}
      </div>
      <div className="px-4 pb-28">
        <div className="flex gap-2 mt-4">
          {["away", "home"].map((k) => (
            <button key={k} onClick={() => setSide(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (side === k ? "text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={side === k ? { backgroundColor: teamColor(abbrOf(k)) } : undefined}>
              {(g.teams[k].team && g.teams[k].team.name) || (k === "away" ? "Away" : "Home")}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-bold tracking-widest uppercase mt-6 mb-2 px-1" style={{ color: teamColor(abbrOf(oppKey)) }}>Pitcher</div>
        <button onClick={myPP && onSelectPlayer ? () => onSelectPlayer(myPP.player) : undefined}
          className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3"
          style={{ borderLeft: "4px solid " + teamColor(abbrOf(oppKey)) }}>
          <div className="flex items-center gap-3">
            {pp && (myPP && myPP.photo ? (
              <img src={myPP.photo} alt="" className="w-11 h-11 rounded-full object-cover object-top bg-white shrink-0" loading="lazy" />
            ) : (
              <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + pp.id + "/headshot/silo/current"} alt=""
                className="w-11 h-11 rounded-full object-cover object-top shrink-0"
                style={{ backgroundColor: teamColor(abbrOf(oppKey)) + "26" }} loading="lazy" />
            ))}
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {(() => {
                const jn = pp && box && box.teams && box.teams[oppKey] && box.teams[oppKey].players && box.teams[oppKey].players["ID" + pp.id] && box.teams[oppKey].players["ID" + pp.id].jerseyNumber;
                return jn ? <span className="text-[11px] font-bold text-slate-400">#{jn} </span> : null;
              })()}
              {pp ? pp.fullName : "Starter TBD"}
              {ps && ps.hand && <span className="text-[11px] font-bold text-slate-400"> · {ps.hand}HP</span>}
              {liveNow && <span className="ml-2 text-[9px] font-extrabold uppercase tracking-wide text-red-500">Now Pitching</span>}
            </div>
          </div>
          {ps && (
            <div className="mt-3">
              {/* Traditional line - two clean rows of five, scoreboard style */}
              <div className="grid grid-cols-5 gap-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                {[["W-L", (ps.w ?? 0) + "-" + (ps.l ?? 0)], ["ERA", ps.era ?? "—"], ["WHIP", ps.whip ?? "—"], ["IP", ps.ip ?? "—"], ["GS", ps.gs ?? "—"],
                  ["SO", ps.so ?? "—"], ["BB", ps.bb ?? "—"], ["HR", ps.hr ?? "—"], ["HR L9", ps.hrL9 ?? "—"],
                  ["BBE", (() => { const mp = pp ? myByName[hrbNrm(pp.fullName)] : null; return mp && mp.bbe != null ? Math.round(mp.bbe) : "—"; })()],
                ].map(([lbl, v]) => (
                  <span key={lbl} className="text-center">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide">{lbl}</span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
                  </span>
                ))}
              </div>
              {/* Statcast strip - the colored, decision-driving numbers */}
              {(() => {
                const mp = pp ? myByName[hrbNrm(pp.fullName)] : null;
                if (!mp || (mp.barrel == null && mp.gb == null && mp.hr9 == null)) return null;
                return (
                  <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    {[["BRL%", mp.barrel != null ? Number(mp.barrel).toFixed(1) + "%" : "—", hrbPitBrlClass(mp.barrel)],
                      ["GB%", mp.gb != null ? Number(mp.gb).toFixed(0) + "%" : "—", hrbGbClass(mp.gb)],
                      ["HR/9", mp.hr9 != null ? Number(mp.hr9).toFixed(2) : "—", hrbHr9Class(mp.hr9)],
                    ].map(([lbl, v, cls]) => (
                      <span key={lbl} className="text-center">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide">{lbl}</span>
                        <span className={"block text-xs font-extrabold rounded px-1.5 py-0.5 mx-auto w-fit tabular-nums " + cls}>{v}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </button>

        <div className="text-[11px] font-bold tracking-widest uppercase mt-6 mb-2 px-1" style={{ color: teamColor(abbrOf(side)) }}>
          {(g.teams[side].team && g.teams[side].team.name) || ""} vs {ps && ps.hand === "L" ? "LHP" : "RHP"}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {box == null && <SkeletonCards cards={2} rows={5} />}
          {box != null && order.length === 0 && <div className="text-center text-sm text-slate-400 py-10">Lineup not posted yet.</div>}
          {order.map((pid, i) => {
            const pd = teamBox.players["ID" + pid] || {};
            const nm = (pd.person && pd.person.fullName) || "";
            const pos = (pd.position && pd.position.abbreviation) || "—";
            const season = (pd.seasonStats && pd.seasonStats.batting) || {};
            const sp = vsHand[pid] || {};
            // vs-hand splits where available, season numbers fill any gaps
            const bat = {
              avg: sp.avg != null ? sp.avg : season.avg,
              hr: sp.hr != null ? sp.hr : season.homeRuns,
              rbi: sp.rbi != null ? sp.rbi : season.rbi,
              ops: sp.ops != null ? sp.ops : season.ops,
            };
            const mine = myByName[hrbNrm(nm)];
            const streak = (mine && mine.streak) || 0;
            const isBatting = curBatter === pid && state === "Live";
            const RowTag = mine && onSelectPlayer ? "button" : "div";
            return (
              <RowTag key={pid}
                onClick={mine && onSelectPlayer ? () => onSelectPlayer(mine.player) : undefined}
                className={"w-full text-left flex items-center gap-3 px-4 py-3 " + (isBatting ? "ring-2 ring-inset ring-emerald-400 rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/30" : "")}>
                <span className="shrink-0 flex items-center">
                  <span className="w-4 text-right text-[11px] font-extrabold tabular-nums text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbrOf(side)) }}>{i + 1}</span>
                  <span className="w-9 text-center text-[11px] font-extrabold text-slate-400 uppercase">{pos}</span>
                </span>
                {mine && mine.photo ? (
                  <img src={mine.photo} alt="" className="w-11 h-11 rounded-full object-cover object-top bg-white shrink-0" loading="lazy" />
                ) : (
                  <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + pid + "/headshot/silo/current"} alt=""
                    className="w-11 h-11 rounded-full object-cover object-top bg-slate-200 dark:bg-slate-700 shrink-0" loading="lazy" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {pd.jerseyNumber && <span className="text-[11px] font-bold text-slate-400">#{pd.jerseyNumber} </span>}
                    {nm}
                  </span>
                  <span className="flex gap-2 mt-1">
                    {[["AVG", bat.avg ? String(bat.avg).replace(/^0/, "") : "—"], ["HR", bat.hr != null ? bat.hr : "—"], ["RBI", bat.rbi != null ? bat.rbi : "—"], ["OPS", bat.ops ? String(bat.ops).replace(/^0/, "") : "—"], ["BRL%", mine && mine.barrel != null ? Number(mine.barrel).toFixed(1) + "%" : "—"]].map(([lbl, v]) => (
                      <span key={lbl} className="w-10 text-center">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                        <span className={"block text-[11px] font-extrabold tabular-nums " + (lbl === "BRL%" && v !== "—" ? "rounded px-0.5 " + hrbHitClass(parseFloat(v)) : lbl === "BRL%" ? "text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-slate-100")}>{v}</span>
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 flex items-center">
                  <span className="w-10 text-center text-[11px] font-extrabold text-orange-500 dark:text-orange-400">{streak >= 5 ? streak + "🔥" : ""}</span>
                  <span className="w-4 text-center text-[11px] font-extrabold uppercase text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbrOf(side)) }}>{sp.bats || ""}</span>
                </span>
              </RowTag>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamsTab({ teams, players, onSelect, onSelectPlayer }) {
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
    return c.startsWith("a") ? "al" : c.startsWith("n") ? "nl" : "other";
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
    conf === "all"
      ? String(a.name).localeCompare(String(b.name))
      : winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0)
  );
  const pickConf = (k) => { setConf(k); setDiv(null); };
  return (
    <div>
      <ListHeader title="Teams" />
      <div className="px-4 pb-28">
        <div className="flex gap-2 mt-4">
          {[["all", "All"], ["al", "American League"], ["nl", "National League"]].map(([k, lbl]) => (
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
                  <img src={t.logo} alt="" className="w-11 h-11 rounded-full object-contain bg-white shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }} />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division}` : t.division) : "—"}
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
  const raw = String(status);
  const dayMatch = raw.match(/(\d+)\s*-?\s*day/i) || raw.match(/^il-?(\d+)$/i);
  const label = dayMatch && /(il|injur)/i.test(raw) ? "IL" + dayMatch[1] : raw;
  let cls = "bg-slate-100 text-slate-500 dark:text-slate-400";
  if (s === "ir" || s.includes("injured reserve") || s.includes("out") || s.includes("il") || s.includes("injur") || s.includes("day")) cls = "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300";
  else if (s.includes("active") || s.includes("available")) cls = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  else if (s.includes("minor") || s.includes("question") || s.includes("doubt")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {label}
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

function FieldView({ roster, abbr, onSelectPlayer }) {
  const used = new Set();
  const pick = (aliases) => {
    const cands = roster
      .filter((p) => aliases.includes(String(p.pos || "").toUpperCase()) && !used.has(p.id))
      .sort((a, b) => (b.rating2k ?? -1) - (a.rating2k ?? -1));
    const hit = cands[0] || null;
    if (hit) used.add(hit.id);
    return hit;
  };
  // Geometry (viewBox 0-100 x, 0-108 y). Home 50,84 · 1B 74,60 · 2B 50,36
  // · 3B 26,60 · mound 50,60. 90 ft ≈ 34 units. Infielders sit ON the bag;
  // 2B and SS flank second base the way they actually play it.
  const SPOTS = [
    { lbl: "CF", x: 50, y: 14, aliases: ["CF", "OF"] },
    { lbl: "LF", x: 18, y: 25, aliases: ["LF", "OF"] },
    { lbl: "RF", x: 82, y: 25, aliases: ["RF", "OF"] },
    { lbl: "2B", x: 58, y: 38, aliases: ["2B"] },
    { lbl: "SS", x: 42, y: 38, aliases: ["SS"] },
    { lbl: "3B", x: 26, y: 60, aliases: ["3B"] },
    { lbl: "1B", x: 74, y: 60, aliases: ["1B"] },
    { lbl: "P", x: 50, y: 60, aliases: ["P", "SP", "RHP", "LHP"] },
    { lbl: "C", x: 50, y: 92, aliases: ["C"] },
  ];
  const oaaChip = (v) => v == null ? "bg-slate-900/70 text-white/70"
    : v >= 8 ? "bg-amber-400 text-slate-900"
    : v >= 3 ? "bg-emerald-500 text-white"
    : v > -3 ? "bg-slate-900/85 text-white"
    : "bg-rose-600 text-white";
  const tc = teamColor(abbr) || "#1e3a8a";
  return (
    <div className="mt-4">
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-[#1f6b34]"
        style={{ paddingBottom: "108%" }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 108" preserveAspectRatio="none">
          <defs>
            {/* fair territory: wedge from home along both foul lines, closed by the fence arc (r 80) */}
            <clipPath id="fairClip"><path d="M50,84 L110,24 A80,80 0 0 0 -10,24 Z" /></clipPath>
            <radialGradient id="grassGlow" cx="50%" cy="78%" r="80%">
              <stop offset="0%" stopColor="#3f9a4e" />
              <stop offset="100%" stopColor="#1f6b34" />
            </radialGradient>
            <radialGradient id="dirtGrad" cx="50%" cy="60%" r="70%">
              <stop offset="0%" stopColor="#c8925a" />
              <stop offset="100%" stopColor="#a8703f" />
            </radialGradient>
          </defs>
          {/* grass + concentric mowing arcs centred on home plate */}
          <rect x="-10" y="-10" width="120" height="130" fill="url(#grassGlow)" />
          {[16, 32, 48, 64].map((r) => (
            <circle key={r} cx="50" cy="84" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.035" strokeWidth="8" />
          ))}
          {/* foul lines run to the wall; anything past the wall becomes stands */}
          <line x1="50" y1="84" x2="110" y2="24" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.75" />
          <line x1="50" y1="84" x2="-10" y2="24" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.75" />
          <circle cx="50" cy="84" r="130" fill="none" stroke="#0b1220" strokeWidth="100" />
          <circle cx="50" cy="84" r="86" fill="none" stroke="#1e293b" strokeWidth="12" />
          {/* warning track + outfield wall in team colour */}
          <g clipPath="url(#fairClip)">
            <circle cx="50" cy="84" r="80" fill="none" stroke="#b98a5a" strokeWidth="6" />
            <circle cx="50" cy="84" r="81" fill="none" stroke={tc} strokeWidth="2.4" />
          </g>
          {/* skinned infield: arc r 28 from the mound, bounded by the foul lines */}
          <path d="M50,84 L80.76,53.24 A28,28 0 1 0 19.24,53.24 Z" fill="url(#dirtGrad)" />
          {/* grass inside the diamond (leaves ~7 ft dirt base paths) */}
          <polygon points="50,79.5 68.5,60 50,40.5 31.5,60" fill="#3d9a4c" />
          {/* dirt cutouts at the bags, home circle, mound */}
          {[[74, 60], [50, 36], [26, 60]].map(([bx, by], i) => (
            <circle key={i} cx={bx} cy={by} r="4.2" fill="#b47a45" />
          ))}
          <circle cx="50" cy="84" r="9.5" fill="#b47a45" />
          <circle cx="50" cy="60" r="3.6" fill="#c08a52" stroke="#a8703f" strokeWidth="0.4" />
          <rect x="49.1" y="59.2" width="1.8" height="0.6" fill="#fff" fillOpacity="0.9" />
          {/* batter's boxes + bases + home plate */}
          <rect x="44.4" y="80.2" width="3.2" height="6.2" fill="none" stroke="#fff" strokeWidth="0.35" strokeOpacity="0.6" />
          <rect x="52.4" y="80.2" width="3.2" height="6.2" fill="none" stroke="#fff" strokeWidth="0.35" strokeOpacity="0.6" />
          {[[74, 60], [50, 36], [26, 60]].map(([bx, by], i) => (
            <rect key={i} x={bx - 1.5} y={by - 1.5} width="3" height="3" fill="#fff" transform={"rotate(45 " + bx + " " + by + ")"} />
          ))}
          <polygon points="48.6,82.6 51.4,82.6 51.4,84.2 50,85.5 48.6,84.2" fill="#fff" />
        </svg>
        {SPOTS.map((s, i) => {
          const p = pick(s.aliases);
          return (
            <button key={i} disabled={!p} onClick={p ? () => onSelectPlayer(p) : undefined}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: s.x + "%", top: (s.y / 1.08) + "%" }}>
              <span className="relative">
                {p ? (
                  <span className="block w-11 h-11 rounded-full overflow-hidden border-2 border-white/80 shadow-md bg-white"><Avatar p={p} /></span>
                ) : (
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-[10px] font-extrabold bg-white/25 text-white/80 border-2 border-dashed border-white/50 shadow-md">{s.lbl}</span>
                )}
                {p && cleanNo(p.no) && (
                  <span className="absolute top-1/2 -translate-y-1/2 -left-2.5 px-1 rounded text-[8px] font-extrabold bg-white/85 text-slate-700 tabular-nums shadow">
                    #{cleanNo(p.no)}
                  </span>
                )}
                {p && (
                  <span className={"absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[8px] font-extrabold tabular-nums shadow " + oaaChip(p.oaa)}>
                    {p.oaa != null ? (p.oaa > 0 ? "+" : "") + Math.round(p.oaa) : "—"}
                  </span>
                )}
              </span>
              <span className="mt-2 text-[8px] font-bold text-white/95 max-w-[64px] truncate drop-shadow">
                {p ? p.name.split(" ").slice(-1)[0] : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[9px] text-slate-400 mt-2 px-1">Chip = Outs Above Average (Statcast fielding): gold +8 elite · green +3 · red −3 or worse · tap for profile</div>
    </div>
  );
}

let MLB_TEAMID_MAP = null;
function TeamFormChart({ teamName }) {
  const [games, setGames] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!MLB_TEAMID_MAP) {
          const d = await (await fetch("https://statsapi.mlb.com/api/v1/teams?sportId=1")).json();
          MLB_TEAMID_MAP = {};
          for (const t of d.teams || []) MLB_TEAMID_MAP[String(t.name).toLowerCase()] = t.id;
        }
        const tid = MLB_TEAMID_MAP[String(teamName).toLowerCase()];
        if (!tid) { if (alive) setGames([]); return; }
        const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
        const sched = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${tid}&startDate=${dayStr(30)}&endDate=${dayStr(0)}`)).json();
        const gs = (sched.dates || []).flatMap((d) => d.games || [])
          .filter((g) => g.status && g.status.abstractGameState === "Final")
          .map((g) => {
            const home = g.teams.home.team.id === tid;
            const us = home ? g.teams.home : g.teams.away;
            const them = home ? g.teams.away : g.teams.home;
            return { runs: us.score ?? 0, won: (us.score ?? 0) > (them.score ?? 0), date: g.officialDate || g.gameDate };
          })
          .slice(-20);
        if (alive) setGames(gs);
      } catch { if (alive) setGames([]); }
    })();
    return () => { alive = false; };
  }, [teamName]);
  if (games == null) return <SkeletonCards cards={1} rows={4} />;
  if (!games.length) return <div className="text-center text-xs text-slate-400 py-10">No recent completed games found.</div>;
  const wins = games.filter((g) => g.won).length;
  const runs = games.reduce((a, g) => a + g.runs, 0);
  const max = Math.max(6, ...games.map((g) => g.runs));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 mt-3">
      <div className="flex items-end gap-[3px] h-24">
        {games.map((g, i) => (
          <span key={i}
            className={"flex-1 rounded-t " + (g.won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-rose-300 dark:bg-rose-500/70")}
            style={{ height: Math.max(6, (g.runs / max) * 100) + "%" }}
            title={g.date + ": " + g.runs + " runs"} />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
        <span>{String(games[0].date).slice(5)}</span><span>{String(games[games.length - 1].date).slice(5)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[["Last " + games.length, wins + "-" + (games.length - wins)], ["Runs/Gm", (runs / games.length).toFixed(1)], ["Total Runs", runs]].map(([lbl, v]) => (
          <span key={lbl}>
            <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
            <span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
          </span>
        ))}
      </div>
      <div className="text-[9px] text-slate-400 mt-2">Bar height = runs scored that game · green = win, red = loss · last 20 games</div>
    </div>
  );
}

function TeamDetail({ team, teams, players, onBack, onSelectPlayer }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const abbr = team.abbr || toAbbr(team.name);
  const [seg, setSeg] = useState("roster");
  const [roleFilter, setRoleFilter] = useState(null);
  const [chartMode, setChartMode] = useState("form");
  const [capSeason, setCapSeason] = useState(null);
  const roster = players.filter((p) => {
    if (p.teamId && p.teamId === team.id) return true; // exact Airtable link - no naming needed
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);

  const numericLabel = (p) => /^\d+$/.test(String(p.sortLabel || "").trim());
  // When a live lineup exists, only tonight's nine stay in Batting Order -
  // everyone else in the batting unit moves to Bench automatically.
  const hasLineup = roster.some((p) => unitOf(p) === "Batting" && numericLabel(p));
  const groups = {};
  for (const p of roster) {
    let role = unitOf(p);
    if (role === "Batting" && hasLineup && !numericLabel(p)) role = "Bench";
    (groups[role] ??= []).push(p);
  }
  const orderedRoles = [...ROLE_ORDER.filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Teams</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-16 h-16 rounded-full object-contain bg-white shrink-0" />
          ) : (
            <span className="text-3xl">⚾</span>
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
                return ord ? `${ord} in ${team.division}` : team.division;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-2">
          <Tile topColor={teamColor(abbr)} value={(team.wins ?? 0) + "-" + (team.losses ?? 0)} label="Record"
            sub={team.rs != null && team.ra != null ? (
              <span className={team.rs - team.ra >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                {(team.rs - team.ra >= 0 ? "+" : "") + (team.rs - team.ra)}
              </span>
            ) : null} />
          <Tile
            topColor={teamColor(abbr)}
            value={team.rs != null ? team.rs : "—"}
            label="Runs Scored"
            sub={(() => {
              const r = rankOf(teams, team, "ppg", "desc");
              return (
                <span>
                  {team.ppg != null && <span className="text-slate-500 dark:text-slate-400">{team.ppg.toFixed(1)}</span>}
                  {r && <span className={"ml-1 " + r.cls}>{r.label}</span>}
                </span>
              );
            })()}
          />
          <Tile
            topColor={teamColor(abbr)}
            value={team.ra != null ? team.ra : "—"}
            label="Runs Allowed"
            sub={(() => {
              const r = rankOf(teams, team, "oppPpg", "asc");
              return (
                <span>
                  {team.oppPpg != null && <span className="text-slate-500 dark:text-slate-400">{team.oppPpg.toFixed(1)}</span>}
                  {r && <span className={"ml-1 " + r.cls}>{r.label}</span>}
                </span>
              );
            })()}
          />
        </div>

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["field", "Field"], ["contracts", "Contracts"], ["charts", "Charts"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? "text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: teamColor(abbr) } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "roster" && (
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
            {ROLE_ORDER.map((r) => (
              <button key={r} onClick={() => setRoleFilter(roleFilter === r ? null : r)}
                className={"px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors " + (roleFilter === r
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={roleFilter === r ? { backgroundColor: teamColor(abbr) } : undefined}>
                {UNIT_LABELS[r] || r}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && (roleFilter ? orderedRoles.filter((role) => role === roleFilter) : CAT_ORDER).map((role) => (
          <div key={role}>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{CAT_LABELS[role] || UNIT_LABELS[role] || role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(CAT_LABELS[role] ? roster.filter((p) => catOf(p) === role) : groups[role])
                .sort((a, b) => {
                  if (CAT_LABELS[role]) {
                    const last = (n) => String(n).split(" ").slice(-1)[0];
                    return last(a.name).localeCompare(last(b.name)) || String(a.name).localeCompare(String(b.name));
                  }
                  if (role === "Bench") {
                    const r = statusRank(a) - statusRank(b);
                    if (r !== 0) return r;
                  }
                  if (a.sort != null && b.sort != null) return a.sort - b.sort;
                  if (a.sort != null) return -1;
                  if (b.sort != null) return 1;
                  return currentSalary(b) - currentSalary(a);
                })
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                    {(() => {
                      const showNum = roleFilter === "Batting" && role === "Batting";
                      const num = showNum && /^\d+$/.test(String(p.sortLabel || "").trim()) ? String(p.sortLabel).trim() : null;
                      const hand = (role === "Pitching" || role === "Bullpen") ? pitcherHand(p) : null;
                      return (
                        <span className="shrink-0 flex items-center">
                          <span className="w-4 text-right text-[11px] font-extrabold tabular-nums text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbr) }}>{num || ""}</span>
                          <span className="w-9 text-center text-[11px] font-extrabold text-slate-400 uppercase">{hand || (role === "Batting" && p.gamePos) || p.pos || "—"}</span>
                        </span>
                      );
                    })()}
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={(role === "Batting" ? "" : "flex-1 ") + "min-w-0 text-sm font-bold text-slate-900 dark:text-slate-100 truncate"}>
                          {cleanNo(p.no) && (
                            <span className="text-[11px] font-bold text-slate-400">#{cleanNo(p.no)} </span>
                          )}
                          {p.name}
                        </span>
                        {role === "Batting" && !hasLineup && <StatusBadge status={p.status} />}
                        {role === "Batting" && <span className="flex-1" />}
                        {p.rating2k != null && <Rating2kBadge r={p.rating2k} />}
                      </span>
                      <span className="flex items-center gap-1.5 mt-1">
                        {role !== "Batting" && <StatusBadge status={p.status} />}
                        {role !== "Batting" && role !== "Bench" && <span className="flex-1" />}
                        {(() => {
                          const st = latestStats(p);
                          if (st && (st.avg != null || st.hr != null || st.era != null || st.w != null || st.l != null || st.whip != null || st.sv != null)) {
                            return (
                              <span className="flex gap-2 shrink-0">
                                {((role === "Pitching" || role === "Bullpen" || ["Pitching", "Bullpen"].includes(unitOf(p)) || catOf(p) === "__P__")
                                  ? [["W", st.w != null ? String(Math.round(st.w)) : null], ["L", st.l != null ? String(Math.round(st.l)) : null], ["ERA", st.era != null ? Number(st.era).toFixed(2) : null], ["WHIP", st.whip != null ? Number(st.whip).toFixed(2) : null]]
                                  : [["AVG", st.avg != null ? Number(st.avg).toFixed(3).replace(/^0/, "") : null], ["HR", st.hr != null ? String(Math.round(st.hr)) : null], ["RBI", st.rbi != null ? String(Math.round(st.rbi)) : null], ["OPS", st.ops != null ? Number(st.ops).toFixed(3).replace(/^0/, "") : null]]
                                ).map(([lbl, v]) => (
                                  <span key={lbl} className="w-7 text-center">
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                                    <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                                  </span>
                                ))}
                              </span>
                            );
                          }
                          return currentSalary(p) > 0 ? (
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 shrink-0">{fmtM(currentSalary(p))}</span>
                          ) : null;
                        })()}
                      </span>
                      {p.injuryNotes && (
                        <span className="block text-[11px] font-semibold text-red-600 dark:text-red-500 truncate mt-0.5">{p.injuryNotes}</span>
                      )}
                    </span>
                    {(() => {
                      if (role !== "Batting" && role !== "Bench") return null;
                      const throwsLetter = (() => { const t = String(p.bt || "").split("/").pop().trim().toUpperCase(); return ["L", "R", "S"].includes(t) ? t : null; })();
                      const h = batterHand(p) || throwsLetter;
                      const stH = latestStats(p);
                      const streak = stH && stH.streak != null ? Math.round(stH.streak) : 0;
                      if (!h) return null;
                      return (
                        <span className="shrink-0 flex items-center">
                          <span className="w-10 text-center"><LiveStreak p={p} /></span>
                          <span className="w-4 text-center text-[11px] font-extrabold uppercase text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbr) }}>{h || ""}</span>
                        </span>
                      );
                    })()}
                  </button>
                ))}
            </div>
          </div>
        ))}
        {seg === "field" && <FieldView roster={roster} abbr={toAbbr(team.name)} onSelectPlayer={onSelectPlayer} />}
        {seg === "contracts" && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Team Contracts</span>
              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">{fmtM(payroll)} payroll</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {roster
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
                          {act ? (act.terms || displayLine(act)) : "No contract"}
                        </span>
                        {nextEvent(p) && (
                          <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
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

        {seg === "charts" && (() => {
          const seasons = seasonsAhead(5);
          return (
            <>
              <div className="flex gap-2 mt-4">
                {[["form", "Form"], ["cap", "Cap Outlook"], ["timeline", "Timeline"], ["trends", "Trends"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setChartMode(k)}
                    className={"flex-1 py-1.5 rounded-full text-[11px] font-bold " + (chartMode === k
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                    {lbl}
                  </button>
                ))}
              </div>
              {chartMode === "form" && <TeamFormChart teamName={team.name} />}

              {chartMode === "cap" && (() => {
                const totals = seasons.map((s) => ({
                  season: s,
                  rows: roster
                    .map((p) => ({ p, y: salaryInSeason(p, s) }))
                    .filter((x) => x.y)
                    .sort((a, b) => b.y.salary - a.y.salary),
                }));
                const max = Math.max(...totals.map((t) => t.rows.reduce((a, r) => a + r.y.salary, 0)), 1);
                const selT = totals.find((t) => t.season === capSeason) || null;
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Committed Payroll by Season</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <div className="flex items-end gap-2 h-36">
                        {totals.map((t) => {
                          const sum = t.rows.reduce((a, r) => a + r.y.salary, 0);
                          const active = capSeason === t.season;
                          return (
                            <button key={t.season} onClick={() => setCapSeason(active ? null : t.season)} className="flex-1 flex flex-col items-center justify-end h-full">
                              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 mb-1 tabular-nums">{sum > 0 ? fmtM(sum) : "—"}</div>
                              <div className={"w-full rounded-t-md " + (active ? "opacity-100" : "opacity-80")}
                                style={{ backgroundColor: active ? "#1d4ed8" : "#2563eb", height: Math.max((sum / max) * 100, sum > 0 ? 6 : 2) + "%" }} />
                              <div className={"text-[10px] font-semibold mt-1 whitespace-nowrap " + (active ? "text-blue-600 dark:text-blue-400" : "text-slate-400")}>{seasonTick({ season: t.season })}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400 text-center mt-2">Tap a season for the breakdown</div>
                    </div>
                    {selT && (
                      <>
                        <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-5 mb-2 px-1">{selT.season} · {selT.rows.length} players</div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                          {selT.rows.map(({ p, y }) => (
                            <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
                              <Avatar p={p} />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                              </span>
                              {(y.type === "PO" || y.type === "TO") && !y.decision && (
                                <span className={"px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase " + (y.type === "PO" ? EVENT_COLORS.PO : EVENT_COLORS.TO)}>
                                  {y.type === "PO" ? "Player Option" : "Team Option"}
                                </span>
                              )}
                              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0 tabular-nums">{fmtM(y.salary)}</span>
                            </button>
                          ))}
                          {selT.rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8">No committed salary.</div>}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              {chartMode === "timeline" && (() => {
                const rows = roster
                  .map((p) => ({ p, cells: seasons.map((s) => salaryInSeason(p, s) || (faStatus(p) && faStatus(p).season === s ? { fa: true } : null)) }))
                  .filter((r) => r.cells.some(Boolean))
                  .sort((a, b) => currentSalary(b.p) - currentSalary(a.p));
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Contract Timeline</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-20 shrink-0" />
                        {seasons.map((s) => (
                          <span key={s} className="flex-1 text-center text-[9px] font-bold text-slate-400">{"'" + String(s).slice(2, 4)}</span>
                        ))}
                      </div>
                      {rows.map(({ p, cells }) => (
                        <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-2 py-1.5 text-left">
                          <span className="w-20 shrink-0 text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                          {cells.map((c, i) => (
                            <span key={i} className="flex-1 h-3 rounded-sm" style={{
                              backgroundColor: !c ? "transparent"
                                : c.fa ? "#94a3b8"
                                : BAR_COLORS[c.type] || BAR_COLORS.G,
                              opacity: c && c.fa ? 0.35 : 1,
                              border: !c ? "1px dashed rgba(148,163,184,0.25)" : "none",
                            }} />
                          ))}
                        </button>
                      ))}
                      {rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8">No contract years entered.</div>}
                      <div className="flex flex-wrap gap-3 mt-3 text-[9px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.G }} /> Guaranteed</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.PO }} /> Player Opt</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.TO }} /> Team Opt</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400/40" /> Free Agent</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {chartMode === "trends" && (() => {
                const withTrend = roster
                  .map((p) => ({ p, pts: (p.stats || []).filter((s) => s.hr != null).sort((a, b) => String(a.season).localeCompare(String(b.season))) }))
                  .filter((x) => x.pts.length >= 2)
                  .sort((a, b) => (b.pts[b.pts.length - 1].hr ?? 0) - (a.pts[a.pts.length - 1].hr ?? 0))
                  .slice(0, 5);
                if (withTrend.length === 0) {
                  return <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6 text-center text-sm text-slate-400 py-10 px-6">Trends need at least two seasons of stats per player. Add more seasons in the Stats table and lines appear here.</div>;
                }
                const allSeasons = Array.from(new Set(withTrend.flatMap((x) => x.pts.map((s) => s.season)))).sort();
                const maxPts = Math.max(...withTrend.flatMap((x) => x.pts.map((s) => s.hr)), 10);
                const W = 320, H = 150, PAD = 14;
                const xOf = (season) => PAD + (allSeasons.indexOf(season) / Math.max(allSeasons.length - 1, 1)) * (W - PAD * 2);
                const yOf = (v) => H - PAD - (v / maxPts) * (H - PAD * 2);
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">HR Trends</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <svg viewBox={"0 0 " + W + " " + H} className="w-full">
                        {withTrend.map((x, i) => (
                          <g key={x.p.id}>
                            <polyline
                              fill="none" stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              points={x.pts.map((s) => xOf(s.season) + "," + yOf(s.hr)).join(" ")} />
                            {x.pts.map((s) => (
                              <circle key={s.season} cx={xOf(s.season)} cy={yOf(s.hr)} r="3" fill={LINE_COLORS[i % LINE_COLORS.length]} />
                            ))}
                          </g>
                        ))}
                        {allSeasons.map((s) => (
                          <text key={s} x={xOf(s)} y={H - 2} textAnchor="middle" className="fill-slate-400" fontSize="8" fontWeight="600">{"'" + String(s).slice(2, 4)}</text>
                        ))}
                      </svg>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {withTrend.map((x, i) => (
                          <button key={x.p.id} onClick={() => onSelectPlayer(x.p)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                            {x.p.name} · {Math.round(x.pts[x.pts.length - 1].hr)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          );
        })()}

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
  // fall back to the pick number: ~30 picks per round
  const pk = pickOf(p);
  if (pk !== 999) return Math.min(20, Math.ceil(pk / 30));
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
  { key: "avg", label: "AVG" },
  { key: "hr", label: "HR" },
  { key: "rbi", label: "RBI" },
  { key: "sb", label: "SB" },
  { key: "w", label: "W" },
  { key: "era", label: "ERA" },
  { key: "so", label: "SO" },
  { key: "sv", label: "SV" },
];
// Rate stats format specially; ERA ranks ascending (lower is better).
const ASC_CATS = ["era"];
function fmtCat(cat, v) {
  if (v == null) return "\u2014";
  if (cat === "avg") return Number(v).toFixed(3).replace(/^0/, "");
  if (cat === "era") return Number(v).toFixed(2);
  return String(Math.round(v * 10) / 10);
}

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
    .sort((a, b) => (ASC_CATS.includes(cat) ? a.st[cat] - b.st[cat] : b.st[cat] - a.st[cat]));

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
                  {fmtCat(cat, st[cat])}
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
      <div className="bg-blue-600 pb-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
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
        {[yr].filter((y) => y != null).map((yr) => {
          const cls = byYear[yr];
          const rounds = [
            ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => ["Round " + r, cls.filter((p) => roundOf(p) === r)]),
            ["Later Rounds", cls.filter((p) => !isUndrafted(p) && roundOf(p) != null && roundOf(p) > 10)],
            ["Undrafted", cls.filter((p) => isUndrafted(p))],
            ["Round Unknown", cls.filter((p) => !isUndrafted(p) && roundOf(p) == null)],
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

// ═══════════════ HR BOARD (betting sheet) ════════════════════════
// Recreates the Google Sheets HR/parlay board inside the app. One card
// per game: each team's starting pitcher (hand, Barrel % against, batted
// balls, HR/9) plus batting spots 1-5 with bat side and Barrel %.
// CONFIRMED (green) when today's lineup is posted; PROJECTED (amber)
// falls back to the team's most recent posted lineup. Tap a card to
// open the full matchup view. Tune every threshold/color rule here:
const HRB = {
  minBBE: 120,   // pitcher sample floor (sheet's "min. 120 batted balls")
  hitGreen: 12,  // hitter Barrel % >= this -> green
  hitAmber: 8,   // hitter Barrel % >= this -> amber (below -> red)
  pitGreen: 9.5, // pitcher Barrel % against >= this -> green (HR-prone target)
  pitRed: 6.5,   // pitcher Barrel % against <= this -> red (avoid)
  hr9Green: 1.2, // pitcher HR/9 >= this -> green
  hr9Red: 0.9,   // pitcher HR/9 <= this -> red
  gbGreen: 38,   // pitcher GB% <= this -> green (fly-ball pitcher = HR-prone)
  gbRed: 48,     // pitcher GB% >= this -> red (ground-ball pitcher = fade)
  // ── Top Targets: MULTIPLICATIVE score, 100 = league-average matchup ──
  // Each factor is a ratio to league average (capped so one freak stat
  // can't dominate), and they MULTIPLY: a stingy pitcher shrinks the
  // whole score instead of just adding less. Missing data = ratio of 1.
  topN: 10,        // how many targets to rank
  maxPerTeam: 2,   // diversity cap: at most this many hitters per team
                   // in Top Targets (spreads picks across games)
  lgHitBrl: 8.5,   // league-average hitter Barrel %
  lgPitBrl: 8.5,   // league-average pitcher Barrel % against
  lgHr9: 1.10,     // league-average HR/9
  capRatio: 2.5,   // max any single ratio can contribute
  eHit: 1.0,       // exponent on the hitter's barrel ratio
  ePitBrl: 0.5,    // exponent on SP Brl%-against ratio
  eHr9: 0.5,       // exponent on SP HR/9 ratio
  parkSwing: 0.12, // park factor range: rank 1 = x1.12 ... rank 30 = x0.88
  // Real plate-appearance curve by lineup spot (ratio to leadoff).
  // 9th hitter sees ~18% fewer PAs than leadoff — measured, not vibes.
  paCurve: [1, 0.978, 0.953, 0.931, 0.908, 0.884, 0.860, 0.839, 0.817],
  assumeBBE: 40,   // players with NO batted-ball data are treated as
                   // having this small a sample (unproven != trustworthy)
  shrinkK: 60,     // sample-size regression: stats behave as if K extra
                   // league-average batted balls were mixed in. Small
                   // samples pull hard toward average; 300+ BBE barely move.
                   // Activates per-player only when Batted Balls has data.
  projMult: 0.9,   // discount applied when the lineup is only projected
  coldMult: 1.0,   // v92: hit streaks are noise for HR purposes - disabled
                   // (set back to 0.9 to restore the old drought discount)
  unknownSP: 0.85, // discount when the opposing SP has NO barrel/HR9 data
  noSavant: 0.8,   // discount when the HITTER has no barrel data (name mismatch)
  calibration: 1.0, // global scale on HR%. Leave at 1.0 until the History
                    // scorecard has 14+ graded days; if it still says "too
                    // bold", set this to (actual homers ÷ expected) - e.g. 0.75.
                   // (a blind matchup shouldn't rank beside a proven one)
  // Weather (applied only when data exists; domes stay neutral):
  wxTempPer: 0.004, // +0.4% per °F above 72 (capped ±8%)
  wxWindPer: 0.012, // ±1.2% per mph blowing out/in (capped ±12%)
  // ── v92 ────────────────────────────────────────────────────────────
  // HITTER = Barrel/PA (process, fixes the strikeout blind spot of Brl%
  // per batted ball) blended with HR/PA (outcome). Exponents sum to 1.
  lgBrlPa: 5.8,    // league-avg Barrel/PA % (Savant "brl_pa"; = 8.5 Brl% x ~68% balls-in-play)
  lgHrPa: 0.032,   // league-avg HR per plate appearance (~3.2%)
  eBrlPa: 0.6,
  eHrPa: 0.4,
  // PITCHER = SP Brl% against + HR/9 (both HR-proneness) + ground-ball
  // rate (independent HR suppressor). Exponents sum to 1.
  eSpBrl: 0.35,
  eSpHr9: 0.35,
  eGb: 0.30,
  lgGb: 43,        // league-avg GB% (Savant scale, balls in play)
  lgGoPct: 52,     // league-avg groundOuts/(groundOuts+airOuts) - the MLB
                   // API fallback runs on an outs-only scale, hence separate
  // BULLPEN: ~35% of a hitter's PAs come vs relievers, not the SP.
  spShare: 0.65,   // SP factor ^ spShare  x  bullpen factor ^ (1 - spShare)
  // v100: SP strikeout adjustment. Brl%-against and GB% are per-batted-ball
  // and blind to how OFTEN the ball gets hit; high-K pitchers (Gausman,
  // Ober types) were inflated. HR/9 already prices Ks, so the exponent
  // covers only the K-blind components (eSpBrl + eGb = 0.65).
  lgK: 22,          // league-avg K% of batters faced
  eContact: 0.65,
  // v100: residual platoon. Split Brl% is regressed hard toward a hitter's
  // overall number, which understates the same-hand penalty for stars.
  platoonLL: 0.90,  // LHB vs LHP
  platoonRR: 0.96,  // RHB vs RHP (righties suffer less)
  // Expected plate appearances by lineup spot (leadoff -> 9th). Turns the
  // score into a real per-game HR probability: 1 - (1 - p_PA) ^ expPA.
  expPA: [4.65, 4.55, 4.45, 4.35, 4.25, 4.15, 4.05, 3.95, 3.85],
  avgPA: 4.25,     // expPA / avgPA replaces the old paCurve multiplier
};

// ── v92 shared scorer ───────────────────────────────────────────────────
// ONE function feeds the live board, the game accordion, and the
// backtester so History always grades the exact formula you bet from.
//   hm   = hitter stats row (Airtable/import): barrel, brlL, brlR, bbe, brlPa, pa, hr
//   hApi = hitter from MLB API: { hr, pa }           (may be {} / undefined)
//   om   = opposing SP stats row: barrel, hr9, bbe, gb
//   pApi = SP from MLB API: { goPct }                (may be {} / undefined)
//   penR = opposing bullpen HR/9 ratio to league (1 = avg / unknown)
// Returns null when the hitter has no usable data at all.
function hrbEval({ hm, hApi, om, pApi, hand, batHand, spot, parkF, wxF, confirmed, penR }) {
  hm = hm || {}; hApi = hApi || {}; om = om || {}; pApi = pApi || {};
  const shrink = (v, lg, n) => (v != null && n != null && n > 0) ? (v * n + lg * HRB.shrinkK) / (n + HRB.shrinkK) : v;
  const capped = (r) => Math.min(Math.max(r, 0.2), HRB.capRatio);
  const pa = hm.pa != null ? hm.pa : hApi.pa;
  const hr = hm.hr != null ? hm.hr : hApi.hr;

  // ── Hitter: vs-hand Barrel% (regressed) -> converted to Barrel/PA ──
  const useBrl = brlVsHand(hm, hand);
  const isSplit = hand === "L" ? hm.brlL != null : hand === "R" ? hm.brlR != null : false;
  const effBbe = hm.bbe == null ? null : isSplit && hand === "L" ? hm.bbe * 0.3 : isSplit && hand === "R" ? hm.bbe * 0.7 : hm.bbe;
  const totAdj = shrink(hm.barrel, HRB.lgHitBrl, hm.bbe != null ? hm.bbe : HRB.assumeBBE);
  const prior = totAdj != null ? totAdj : HRB.lgHitBrl;
  const adjBrl = useBrl == null ? null : isSplit
    ? shrink(useBrl, prior, effBbe != null ? effBbe : HRB.assumeBBE * 0.3)
    : shrink(useBrl, HRB.lgHitBrl, effBbe != null ? effBbe : HRB.assumeBBE);
  // Barrel/PA: prefer the Savant column; else derive Brl% x BBE / PA
  // (contact rate), so strikeout-heavy hitters stop tying contact hitters.
  let brlPa = null;
  if (hm.brlPa != null) {
    // scale the season Barrel/PA by the vs-hand adjustment so the split still counts
    brlPa = hm.brlPa * (adjBrl != null && totAdj != null && totAdj > 0 ? adjBrl / totAdj : 1);
  } else if (adjBrl != null && hm.bbe != null && pa != null && pa > 0) {
    brlPa = adjBrl * (hm.bbe / pa);
  } else if (adjBrl != null) {
    brlPa = adjBrl * (HRB.lgBrlPa / HRB.lgHitBrl); // no contact info: assume league BIP rate
  }
  const hrPaRaw = (hr != null && pa != null && pa > 0) ? hr / pa : null;
  const hrPa = hrPaRaw != null ? (hrPaRaw * pa + HRB.lgHrPa * HRB.shrinkK) / (pa + HRB.shrinkK) : null;
  if (brlPa == null && hrPa == null) return null;
  const noSavant = brlPa == null; // name didn't match the import - fix the name, don't trust the row
  const brlPaR = brlPa != null ? Math.pow(capped(brlPa / HRB.lgBrlPa), HRB.eBrlPa) : 1;
  const hrPaR = hrPa != null ? Math.pow(capped(hrPa / HRB.lgHrPa), HRB.eHrPa) : 1;
  // If only one hitter input exists, give it the full weight.
  const hitR = brlPa != null && hrPa != null ? brlPaR * hrPaR
    : brlPa != null ? Math.pow(capped(brlPa / HRB.lgBrlPa), 1)
    : Math.pow(capped(hrPa / HRB.lgHrPa), 1);

  // ── Starting pitcher ──
  const adjPitBrl = shrink(om.barrel, HRB.lgPitBrl, om.bbe != null ? om.bbe : HRB.assumeBBE);
  const adjHr9 = shrink(om.hr9, HRB.lgHr9, om.bbe != null ? om.bbe : HRB.assumeBBE);
  const spBrlR = adjPitBrl != null ? Math.pow(capped(adjPitBrl / HRB.lgPitBrl), HRB.eSpBrl) : 1;
  const spHr9R = adjHr9 != null ? Math.pow(capped(adjHr9 / HRB.lgHr9), HRB.eSpHr9) : 1;
  // Ground-ball rate: MORE grounders = FEWER homers, so the ratio is inverted.
  // Regressed by BBE exactly like Brl% and HR/9 - a 10-batted-ball rookie
  // with a 10% GB rate is treated as roughly league average, not as a
  // fly-ball machine.
  let gbR = 1;
  const adjGb = om.gb != null ? shrink(om.gb, HRB.lgGb, om.bbe != null ? om.bbe : HRB.assumeBBE) : null;
  if (adjGb != null) gbR = Math.pow(capped(HRB.lgGb / Math.max(adjGb, 1)), HRB.eGb);
  else if (pApi.goPct != null) gbR = Math.pow(capped(HRB.lgGoPct / Math.max(pApi.goPct, 1)), HRB.eGb);
  const spKnown = om.barrel != null || om.hr9 != null;
  // Contact rate: how often this SP lets the ball get hit at all,
  // regressed by batters faced like every other pitcher input.
  let contactR = 1;
  if (pApi.kPct != null) {
    const adjK = (pApi.kPct * (pApi.bf || 0) + HRB.lgK * HRB.shrinkK) / ((pApi.bf || 0) + HRB.shrinkK);
    contactR = Math.pow(capped((100 - adjK) / (100 - HRB.lgK)), HRB.eContact);
  }
  const spR = spBrlR * spHr9R * gbR * contactR;
  // ── Bullpen blend ──
  const pitR = Math.pow(spR, HRB.spShare) * Math.pow(penR != null ? capped(penR) : 1, 1 - HRB.spShare);

  // ── Assemble ──
  let pPA = HRB.lgHrPa * hitR * pitR * (parkF || 1) * (wxF || 1) * HRB.calibration;
  if (batHand === "L" && hand === "L") pPA *= HRB.platoonLL;
  else if (batHand === "R" && hand === "R") pPA *= HRB.platoonRR;
  if (!spKnown) pPA *= HRB.unknownSP;
  if (noSavant) pPA *= HRB.noSavant;
  if (confirmed === false) pPA *= HRB.projMult;
  const ePA = HRB.expPA[Math.min(Math.max(spot || 0, 0), 8)];
  const prob = 1 - Math.pow(1 - Math.min(pPA, 0.5), ePA);
  const score = 100 * (pPA / HRB.lgHrPa) * (ePA / HRB.avgPA);
  return { score, prob, hitR, pitR, brlPa, hrPa, adjBrl, adjPitBrl, adjHr9, adjGb, gbR, contactR, penR, spKnown, noSavant };
}
// GB% is INVERTED: low ground-ball rate = more balls in the air = target.
function hrbGbClass(v) {
  if (v == null) return CHIP.none;
  if (v <= HRB.gbGreen) return CHIP.good;
  if (v >= HRB.gbRed) return CHIP.bad;
  return CHIP.warn;
}
function hrbHitClass(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.hitGreen) return CHIP.good;
  if (v >= HRB.hitAmber) return CHIP.warn;
  return CHIP.bad;
}
function hrbPitBrlClass(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.pitGreen) return CHIP.good;
  if (v <= HRB.pitRed) return CHIP.bad;
  return CHIP.warn;
}
function hrbHr9Class(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.hr9Green) return CHIP.good;
  if (v <= HRB.hr9Red) return CHIP.bad;
  return CHIP.warn;
}
// ═══ Skeleton loading cards (football-app polish) ═══
// Grey pulsing placeholders shaped like the real content, so the app
// feels loaded before the data lands - no bare "Loading…" text.
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
        <span className="block h-2 w-1/4 rounded bg-slate-100 dark:bg-slate-800/60" />
      </span>
      <span className="w-11 h-5 rounded bg-slate-100 dark:bg-slate-800/60 shrink-0" />
    </div>
  );
}
function SkeletonCards({ cards = 3, rows = 3 }) {
  return (
    <div className="space-y-3 animate-pulse mt-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
            <span className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <span className="ml-auto h-4 w-20 rounded-full bg-slate-100 dark:bg-slate-800/60" />
          </div>
          {Array.from({ length: rows }).map((_, j) => <SkeletonRow key={j} />)}
        </div>
      ))}
    </div>
  );
}
const HRB_VERSION = "v102";
// Crash reporter that survives React unmounting: writes straight to the DOM.
if (typeof window !== "undefined" && !window.__hrbTrap) {
  window.__hrbTrap = true;
  const show = (msg) => {
    try {
      let el = document.getElementById("hrb-crash");
      if (!el) {
        el = document.createElement("div");
        el.id = "hrb-crash";
        el.style.cssText = "position:fixed;top:env(safe-area-inset-top,8px);left:8px;right:8px;z-index:99999;background:#dc2626;color:#fff;font:700 11px -apple-system,sans-serif;padding:10px 12px;border-radius:12px;word-break:break-word;box-shadow:0 4px 16px rgba(0,0,0,.3)";
        el.onclick = () => el.remove();
        document.body.appendChild(el);
      }
      el.textContent = "⚠️ " + msg + " (tap to dismiss)";
    } catch {}
  };
  window.addEventListener("error", (e) => {
    const err = e.error || {};
    const parts = [err.name, err.message || e.message, e.filename ? "@" + String(e.filename).split("/").pop() + ":" + e.lineno + ":" + e.colno : ""];
    show(parts.filter(Boolean).join(" ") || String(e));
  });
  window.addEventListener("unhandledrejection", (e) => show("async: " + String((e.reason && e.reason.message) || e.reason)));
}
// Accents, periods, and Jr./Sr./II/III suffixes all dropped so
// "Luis García Jr." (MLB) matches "Luis Garcia" (Savant/Airtable).
const hrbNrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l") // dotless ı, ø, ł
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const ABBR_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_ABBR).map(([n, a]) => [a, n]));
// Matchup-aware barrel: use the hitter's split vs the opposing SP's hand
// when it exists in Airtable, otherwise fall back to overall Barrel %.
const brlVsHand = (hm, hand) =>
  hand === "L" ? (hm.brlL != null ? hm.brlL : hm.barrel)
  : hand === "R" ? (hm.brlR != null ? hm.brlR : hm.barrel)
  : hm.barrel;

// Weather multiplier (temp above/below 72°F, wind blowing out/in); domes = 1.
function hrbWxFactor(w) {
  if (!w || w.temp == null) return 1;
  let f = 1 + Math.max(-0.08, Math.min(0.08, (Number(w.temp) - 72) * HRB.wxTempPer));
  const wind = String(w.wind || "").toLowerCase();
  const mph = parseFloat(wind) || 0;
  if (wind.includes("out")) f += Math.min(0.12, mph * HRB.wxWindPer);
  else if (wind.includes("in")) f -= Math.min(0.12, mph * HRB.wxWindPer);
  return Math.max(0.8, Math.min(1.25, f));
}
// v92: batched people lookup - bat/pitch hands PLUS season hitting (HR, PA)
// and pitching (HR allowed, W-L, ground-out share) in one hydrate.
async function hrbPeopleStats(idList) {
  const out = {};
  const ipToNum = (ip) => { const [w, f] = String(ip || "0").split("."); return Number(w) + (Number(f || 0) / 3); };
  for (let i = 0; i < idList.length; i += 90) {
    const chunk = idList.slice(i, i + 90);
    try {
      const ppl = await (await fetch(`https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(",")}&hydrate=stats(group=[hitting,pitching],type=[season])`)).json();
      for (const person of ppl.people || []) {
        const grp = (name) => {
          const st = (person.stats || []).find((x) => x.group && String(x.group.displayName).toLowerCase() === name);
          return st && st.splits && st.splits[0] && st.splits[0].stat;
        };
        const hit = grp("hitting");
        const pit = grp("pitching");
        const go = pit && pit.groundOuts != null ? Number(pit.groundOuts) : null;
        const ao = pit && pit.airOuts != null ? Number(pit.airOuts) : null;
        out[person.id] = {
          bat: person.batSide && person.batSide.code,
          pitch: person.pitchHand && person.pitchHand.code,
          hr: hit && hit.homeRuns != null ? Number(hit.homeRuns) : null,
          pa: hit && hit.plateAppearances != null ? Number(hit.plateAppearances) : null,
          hra: pit && pit.homeRuns != null ? Number(pit.homeRuns) : null,
          rec: pit && pit.wins != null ? Math.round(pit.wins) + "-" + Math.round(pit.losses ?? 0) : null,
          era: pit && pit.era != null ? String(pit.era) : null,
          ip: pit ? ipToNum(pit.inningsPitched) : null,
          goPct: go != null && ao != null && go + ao > 0 ? (go / (go + ao)) * 100 : null,
          bf: pit && pit.battersFaced != null ? Number(pit.battersFaced) : null,
          kPct: pit && pit.strikeOuts != null && pit.battersFaced > 0 ? (Number(pit.strikeOuts) / Number(pit.battersFaced)) * 100 : null,
        };
      }
    } catch {}
  }
  return out;
}
// v92: team bullpen HR/9 (relievers-only split; falls back to the team's
// overall HR/9; null if the API says nothing - scorer then treats it as avg).
const hrbPenCache = {};
async function hrbBullpenHr9(teamIds, season) {
  const ipToNum = (ip) => { const [w, f] = String(ip || "0").split("."); return Number(w) + (Number(f || 0) / 3); };
  const out = {};
  await Promise.all(teamIds.map(async (tid) => {
    const key = tid + ":" + season;
    if (hrbPenCache[key] !== undefined) { out[tid] = hrbPenCache[key]; return; }
    let val = null;
    const pick = (j) => {
      const st = j && j.stats && j.stats[0] && j.stats[0].splits && j.stats[0].splits[0] && j.stats[0].splits[0].stat;
      if (!st || st.homeRuns == null) return null;
      const ip = ipToNum(st.inningsPitched);
      return ip > 0 ? (Number(st.homeRuns) / ip) * 9 : null;
    };
    try { val = pick(await (await fetch(`https://statsapi.mlb.com/api/v1/teams/${tid}/stats?stats=statSplits&group=pitching&sitCodes=rp&season=${season}`)).json()); } catch {}
    if (val == null) {
      try { val = pick(await (await fetch(`https://statsapi.mlb.com/api/v1/teams/${tid}/stats?stats=season&group=pitching&season=${season}`)).json()); } catch {}
    }
    hrbPenCache[key] = val;
    out[tid] = val;
  }));
  return out;
}

function HRBoardTab({ players, onSelectPlayer }) {
  const [data, setData] = useState(null);
  const [selGame, setSelGame] = useState(null);
  const [view, setView] = useState("matchups"); // matchups | targets | history
  const [history, setHistory] = useState(null);
  const [openPks, setOpenPks] = useState({});   // matchup accordion state
  const [streaks, setStreaks] = useState({});   // hitter id -> current hit streak
  const myByName = useMemo(() => {
    const m = {};
    // Keep ALL records sharing a name (e.g. both Max Muncys); meta()
    // resolves by team. Imports first so rostered records win ties.
    const add = (p) => { const k = hrbNrm(p.name); (m[k] = m[k] || []).push(p); };
    for (const p of window.__imports || []) add(p);
    for (const p of players || []) add(p);
    return m;
  }, [players]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
        const [sched, standings] = await Promise.all([
          (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dayStr(0)}&hydrate=team,linescore,probablePitcher,venue`)).json(),
          fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104").then((r) => r.json()).catch(() => ({})),
        ]);
        const teamRec = {};
        for (const rec of standings.records || []) for (const tr of rec.teamRecords || []) {
          teamRec[tr.team.id] = {
            rec: (tr.wins ?? "") + "-" + (tr.losses ?? ""),
            streak: (tr.streak && tr.streak.streakCode) || "",
          };
        }
        const gs = ((sched.dates && sched.dates[0] && sched.dates[0].games) || [])
          .slice().sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
        // Today's boxscores (posted lineups) + weather in parallel
        const boxes = {};
        const wxByPk = {};
        await Promise.all(gs.flatMap((g) => [
          (async () => {
            try { boxes[g.gamePk] = await (await fetch(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`)).json(); } catch {}
          })(),
          (async () => {
            try {
              const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`)).json();
              if (f && f.gameData && f.gameData.weather && f.gameData.weather.temp) wxByPk[g.gamePk] = f.gameData.weather;
            } catch {}
          })(),
        ]));
        // Teams with no lineup yet -> most recent posted lineup (last 3 days)
        const need = new Set();
        for (const g of gs) for (const k of ["away", "home"]) {
          const b = boxes[g.gamePk];
          const order = b && b.teams && b.teams[k] && b.teams[k].battingOrder;
          if (!order || !order.length) need.add(g.teams[k].team && g.teams[k].team.id);
        }
        const prevByTeam = {};
        if (need.size) {
          try {
            const past = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${dayStr(3)}&endDate=${dayStr(1)}`)).json();
            for (const d of past.dates || []) for (const pg of d.games || []) {
              for (const k of ["away", "home"]) {
                const tid = pg.teams[k].team && pg.teams[k].team.id;
                if (!need.has(tid)) continue;
                const cur = prevByTeam[tid];
                if (!cur || new Date(pg.gameDate) > new Date(cur.date)) prevByTeam[tid] = { pk: pg.gamePk, side: k, date: pg.gameDate };
              }
            }
            const pks = [...new Set(Object.values(prevByTeam).map((x) => x.pk))];
            const prevBoxes = {};
            await Promise.all(pks.map(async (pk) => {
              try { prevBoxes[pk] = await (await fetch(`https://statsapi.mlb.com/api/v1/game/${pk}/boxscore`)).json(); } catch {}
            }));
            for (const tid of Object.keys(prevByTeam)) prevByTeam[tid].box = prevBoxes[prevByTeam[tid].pk];
          } catch {}
        }
        // Assemble both sides of every game, collecting ids for one
        // batched people call (bat sides + pitch hands)
        const ids = new Set();
        const rows = gs.map((g) => {
          const sides = {};
          for (const k of ["away", "home"]) {
            const t = g.teams[k];
            const nm = (t.team && t.team.name) || "";
            const ab = NAME_TO_ABBR[nm.toLowerCase()] || toAbbr(nm) || "";
            const todayBox = boxes[g.gamePk];
            let order = (todayBox && todayBox.teams && todayBox.teams[k] && todayBox.teams[k].battingOrder) || [];
            let pmap = (todayBox && todayBox.teams && todayBox.teams[k] && todayBox.teams[k].players) || {};
            // Pin to the STARTING nine even mid-game: per-player battingOrder
            // codes ending in 00 are starters ("300"), subs are "301"+ — bets
            // are placed pregame, so the board must not drift with subs.
            if (order.length) {
              const starters = Object.values(pmap)
                .filter((pl) => pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0)
                .sort((x, y) => Number(x.battingOrder) - Number(y.battingOrder))
                .map((pl) => pl.person && pl.person.id)
                .filter(Boolean);
              if (starters.length >= 9) order = starters;
            }
            const confirmed = order.length > 0;
            if (!confirmed) {
              const prev = prevByTeam[t.team && t.team.id];
              if (prev && prev.box && prev.box.teams && prev.box.teams[prev.side]) {
                order = prev.box.teams[prev.side].battingOrder || [];
                pmap = prev.box.teams[prev.side].players || {};
              }
            }
            const hitters = order.slice(0, 9).map((pid) => {
              ids.add(pid);
              const pd = pmap["ID" + pid] || {};
              return { id: pid, name: (pd.person && pd.person.fullName) || "" };
            });
            const pp = t.probablePitcher || null;
            if (pp && pp.id) ids.add(pp.id);
            const tr = teamRec[t.team && t.team.id] || {};
            sides[k] = { name: nm, abbr: ab, confirmed, hitters, rec: tr.rec || "", streak: tr.streak || "", pitcher: pp ? { id: pp.id, name: pp.fullName } : null };
          }
          return { g, sides, wx: wxByPk[g.gamePk] || null };
        });
        const all = [...ids];
        const hands = await hrbPeopleStats(all);
        // v92: opposing BULLPEN HR/9 per team (one call per team, cached)
        const teamIds = [...new Set(rows.flatMap((r) => ["away", "home"].map((k) => r.g.teams[k].team && r.g.teams[k].team.id).filter(Boolean)))];
        const penByTeam = await hrbBullpenHr9(teamIds, dayStr(0).slice(0, 4));
        for (const row of rows) for (const k of ["away", "home"]) {
          const s = row.sides[k];
          if (s.pitcher && hands[s.pitcher.id]) {
            s.pitcher.hand = hands[s.pitcher.id].pitch;
            s.pitcher.hra = hands[s.pitcher.id].hra;
            s.pitcher.rec = hands[s.pitcher.id].rec;
            s.pitcher.goPct = hands[s.pitcher.id].goPct;
            s.pitcher.era = hands[s.pitcher.id].era;
            s.pitcher.kPct = hands[s.pitcher.id].kPct;
            s.pitcher.bf = hands[s.pitcher.id].bf;
          }
          s.penHr9 = penByTeam[row.g.teams[k].team && row.g.teams[k].team.id] ?? null;
          for (const h of s.hitters) if (hands[h.id]) { h.bats = hands[h.id].bat; h.hr = hands[h.id].hr; h.pa = hands[h.id].pa; }
        }
        if (alive) setData(rows);
      } catch {
        if (alive) setData([]);
      }
    })();
    return () => { alive = false; };
  }, []);
  const todayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit" }).format(new Date());
  // want = "hit" | "pit": with duplicate names (three Luis Garcias) only
  // consider records that carry that kind of stat, so a hitter can never
  // silently pick up a pitcher's Brl%-against.
  const meta = (name, abbr, want) => {
    let list = myByName[hrbNrm(name)];
    if (!list || !list.length) return {};
    if (list.length > 1 && want) {
      const isPit = (r) => r.hr9 != null || r.gb != null;
      const isHit = (r) => r.brlL != null || r.brlR != null || r.brlPa != null || (r.barrel != null && !isPit(r));
      const f = list.filter(want === "pit" ? isPit : isHit);
      if (f.length) list = f;
    }
    if (list.length > 1 && abbr) {
      const a = String(abbr).toLowerCase();
      const full = (ABBR_TO_NAME[abbr] || "").toLowerCase();
      for (let idx = list.length - 1; idx >= 0; idx--) {
        const t = String(list[idx].team || list[idx].teamName || "").toLowerCase();
        if (t && (t === a || (full && (t === full || t.includes(full) || full.includes(t))))) return list[idx];
      }
    }
    return list[list.length - 1];
  };
  // Rank every hitter on the slate: own Brl% + opposing SP's HR-proneness
  // + park, discounted if the lineup is only projected.
  const targets = [];
  const capped = (r) => Math.min(Math.max(r, 0.2), HRB.capRatio);
  for (const row of data || []) {
    const rank = row.g.venue && row.g.venue.name ? parkRankFor(row.g.venue.name) : null;
    const parkF = rank != null ? 1 + ((15.5 - rank) / 14.5) * HRB.parkSwing : 1;
    const wxF = hrbWxFactor(row.wx);
    for (const k of ["away", "home"]) {
      const s = row.sides[k];
      const oppSide = row.sides[k === "away" ? "home" : "away"];
      const opp = oppSide.pitcher;
      const om = opp ? meta(opp.name, oppSide.abbr, "pit") : {};
      const penR = oppSide.penHr9 != null ? oppSide.penHr9 / HRB.lgHr9 : null;
      for (let i = 0; i < s.hitters.length; i++) {
        const h = s.hitters[i];
        const hm = meta(h.name, s.abbr, "hit");
        // Hand-specific park: Rice (L) at Yankee Stadium gets the short
        // porch, a righty in the same game doesn't. Falls back to the
        // old rank-based factor when the venue isn't in the table.
        const plr = parkFactorLR(row.g.venue && row.g.venue.name, h.bats, opp && opp.hand);
        const ev = hrbEval({ hm, hApi: { hr: h.hr, pa: h.pa }, om, pApi: { goPct: opp && opp.goPct, kPct: opp && opp.kPct, bf: opp && opp.bf }, hand: opp && opp.hand, batHand: h.bats, spot: i, parkF: plr ? plr.f : parkF, wxF, confirmed: s.confirmed, penR });
        if (!ev) continue;
        let score = ev.score, prob = ev.prob;
        const stk = streaks[h.id];
        if (stk != null && stk <= -5) { score *= HRB.coldMult; prob *= HRB.coldMult; }
        targets.push({ h, spot: i, side: s, opp, oppAbbr: oppSide.abbr, oppHand: opp && opp.hand, brl: ev.adjBrl, brlPa: ev.brlPa, hrPa: ev.hrPa, oppBrl: ev.adjPitBrl, oppHr9: ev.adjHr9, oppGb: ev.adjGb, gbR: ev.gbR, penHr9: oppSide.penHr9, park: rank, parkLR: plr, score, prob, g: row.g, wx: row.wx, oppBbe: om.bbe, confirmed: s.confirmed });
      }
    }
  }
  targets.sort((a, b) => b.score - a.score);
  const top = [];
  const perTeam = {};
  for (const t of targets) {
    if ((perTeam[t.side.abbr] || 0) >= HRB.maxPerTeam) continue;
    perTeam[t.side.abbr] = (perTeam[t.side.abbr] || 0) + 1;
    top.push(t);
    if (top.length >= HRB.topN) break;
  }
  // Hide the BBE column entirely until batted-ball data exists in Airtable
  const [valProg, setValProg] = useState(null);
  const [valResult, setValResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hrbValidation") || "null"); } catch { return null; }
  });
  const [valWin, setValWin] = useState("recent");   // recent | prior
  const [valPA, setValPA] = useState(true);          // PA curve on/off
  const [showAdv, setShowAdv] = useState(false);     // history: show backtest tools
  const runValidation = async (days = 14) => {
    if (valProg && valProg !== "done") return;
    const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
    const agg = { all: [0, 0], p1: [0, 0], t5: [0, 0], t610: [0, 0], days: 0 };
    const bAgg = { all: [0, 0], p1: [0, 0], t5: [0, 0], t610: [0, 0] };
    const off0 = valWin === "prior" ? days : 0;
    // Data health: catches silent import corruption at a glance
    const snap = HRB_META_SNAPSHOT();
    const bat = Object.values(snap).filter((m) => m.barrel != null);
    const sps = Object.values(snap).filter((m) => m.hr9 != null);
    // Lineup match rate: of TODAY's loaded starters, how many resolve to a
    // stats row? Low rate = names in the stats table don't match lineups
    // (flipped "Last, First" imports, duplicates) => model runs blind.
    let luTot = 0, luHit = 0;
    const luMiss = [];
    for (const { sides } of data || []) for (const k of ["away", "home"]) for (const h of sides[k].hitters || []) {
      luTot++;
      if (myByName[hrbNrm(h.name)]) luHit++;
      else if (luMiss.length < 6) luMiss.push(h.name);
    }
    const dupes = Object.values(myByName).filter((l) => Array.isArray(l) && l.length > 1).length;
    const health = {
      nB: bat.length,
      avgBrl: bat.length ? (bat.reduce((a, m) => a + m.barrel, 0) / bat.length) : null,
      nP: sps.length,
      avgHr9: sps.length ? (sps.reduce((a, m) => a + m.hr9, 0) / sps.length) : null,
      luTot, luHit, luMiss, dupes,
    };
    for (let d = 1 + off0; d <= days + off0; d++) {
      setValProg(`${d - off0}/${days}`);
      try {
        const day = dayStr(d);
        const sched = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${day}&hydrate=team,probablePitcher,venue`)).json();
        // Rank the FULL slate exactly like the live board does; the
        // evening-bettable distinction is applied at GRADING time below.
        const wkd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(day + "T12:00:00-04:00"));
        const wknd = wkd === "Sat" || wkd === "Sun";
        const hrET = (g) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(g.gameDate)));
        const gs = ((sched.dates && sched.dates[0] && sched.dates[0].games) || [])
          .filter((g) => g.status && g.status.abstractGameState === "Final");
        if (!gs.length) continue;
        const boxes = {};
        const wxV = {};
        await Promise.all(gs.flatMap((g) => [
          (async () => { try { boxes[g.gamePk] = await (await fetch(`https://statsapi.mlb.com/api/v1/game/${g.gamePk}/boxscore`)).json(); } catch {} })(),
          (async () => {
            try {
              const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`)).json();
              if (f && f.gameData && f.gameData.weather && f.gameData.weather.temp) wxV[g.gamePk] = f.gameData.weather;
            } catch {}
          })(),
        ]));
        // v92: people stats for SPs AND every starter (HR/PA, hands, GO%)
        const pidSet = new Set(gs.flatMap((g) => ["away", "home"].map((k) => g.teams[k].probablePitcher && g.teams[k].probablePitcher.id).filter(Boolean)));
        for (const g of gs) { const b = boxes[g.gamePk]; if (!b || !b.teams) continue; for (const k of ["away", "home"]) for (const pl of Object.values((b.teams[k] && b.teams[k].players) || {})) if (pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0 && pl.person) pidSet.add(pl.person.id); }
        const ppl = await hrbPeopleStats([...pidSet]);
        const hand = {};
        for (const id of Object.keys(ppl)) hand[id] = ppl[id].pitch;
        const tIds = [...new Set(gs.flatMap((g) => ["away", "home"].map((k) => g.teams[k].team && g.teams[k].team.id).filter(Boolean)))];
        const penV = await hrbBullpenHr9(tIds, day.slice(0, 4));
        const cands = [];
        for (const g of gs) {
          const box = boxes[g.gamePk];
          if (!box || !box.teams) continue;
          const rank = g.venue && g.venue.name ? parkRankFor(g.venue.name) : null;
          const parkF = rank != null ? 1 + ((15.5 - rank) / 14.5) * HRB.parkSwing : 1;
          const wxF = hrbWxFactor(wxV[g.gamePk]);
          for (const k of ["away", "home"]) {
            const t = g.teams[k];
            const ab = NAME_TO_ABBR[((t.team && t.team.name) || "").toLowerCase()] || "";
            const oppT = g.teams[k === "away" ? "home" : "away"];
            const oppAb = NAME_TO_ABBR[((oppT.team && oppT.team.name) || "").toLowerCase()] || "";
            const opp = oppT.probablePitcher || null;
            const om = opp ? meta(opp.fullName, oppAb, "pit") : {};
            const oh = opp ? hand[opp.id] : null;
            const pmap = (box.teams[k] && box.teams[k].players) || {};
            const starters = Object.values(pmap)
              .filter((pl) => pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0)
              .sort((x, y) => Number(x.battingOrder) - Number(y.battingOrder));
            const penR = penV[oppT.team && oppT.team.id] != null ? penV[oppT.team.id] / HRB.lgHr9 : null;
            const pApi = opp && ppl[opp.id] ? { goPct: ppl[opp.id].goPct, kPct: ppl[opp.id].kPct, bf: ppl[opp.id].bf } : {};
            starters.forEach((pl, i) => {
              const nm = pl.person && pl.person.fullName;
              if (!nm) return;
              const hm = meta(nm, ab, "hit");
              const hApi = ppl[pl.person.id] || {};
              const plr = parkFactorLR(g.venue && g.venue.name, hApi.bat, oh);
              const ev = hrbEval({ hm, hApi: { hr: hApi.hr, pa: hApi.pa }, om, pApi, hand: oh, batHand: hApi.bat, spot: valPA ? i : 4, parkF: plr ? plr.f : parkF, wxF, confirmed: true, penR });
              if (!ev) return;
              const score = ev.score;
              const st = pl.stats && pl.stats.batting;
              cands.push({ team: ab, score, prob: ev.prob, hr: (st && st.homeRuns) || 0, bett: wknd || hrET(g) >= 16 });
            });
          }
        }
        cands.sort((a, b) => b.score - a.score);
        const picked = [];
        const perT = {};
        for (const c of cands) {
          if ((perT[c.team] || 0) >= HRB.maxPerTeam) continue;
          perT[c.team] = (perT[c.team] || 0) + 1;
          picked.push(c);
          if (picked.length >= HRB.topN) break;
        }
        if (picked.length < HRB.topN) continue;
        agg.days++;
        picked.forEach((c, i) => {
          const hit = c.hr > 0 ? 1 : 0;
          agg.all[0] += hit; agg.all[1]++;
          if (i === 0) { agg.p1[0] += hit; agg.p1[1]++; }
          if (i < 5) { agg.t5[0] += hit; agg.t5[1]++; } else { agg.t610[0] += hit; agg.t610[1]++; }
          if (c.bett) {
            bAgg.all[0] += hit; bAgg.all[1]++;
            if (i === 0) { bAgg.p1[0] += hit; bAgg.p1[1]++; }
            if (i < 5) { bAgg.t5[0] += hit; bAgg.t5[1]++; } else { bAgg.t610[0] += hit; bAgg.t610[1]++; }
          }
        });
      } catch {}
    }
    const out = { ver: HRB_VERSION + (valPA ? "" : " (linear spot)"), win: valWin, when: new Date().toISOString().slice(0, 10), health, ...agg, bett: bAgg };
    try { localStorage.setItem("hrbValidation", JSON.stringify(out)); } catch {}
    setValResult(out);
    setValProg("done");
  };
  const HRB_META_SNAPSHOT = () => {
    const out = {};
    for (const [k, list] of Object.entries(myByName)) {
      const m = Array.isArray(list) ? list[0] : list;
      if (m) out[k] = m;
    }
    return out;
  };
  const topIdsKey = targets.slice(0, 25).map((t) => t.h.id).join(",");
  useEffect(() => {
    if (!topIdsKey) return;
    let alive = true;
    (async () => {
      const ids = topIdsKey.split(",").filter((id) => streaks[id] == null);
      const out = {};
      await Promise.all(ids.map(async (pid) => {
        try {
          const gl = await (await fetch(`https://statsapi.mlb.com/api/v1/people/${pid}/stats?stats=gameLog&group=hitting`)).json();
          const splits = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
          const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
          let n = 0;
          for (let j = splits.length - 1; j >= 0; j--) {
            if (splits[j].date === todayET) continue; // streak = entering today
            const st = splits[j].stat || {};
            if ((st.atBats ?? 0) === 0) continue; // skip games without an AB
            if ((st.hits ?? 0) > 0) { if (n < 0) break; n++; }
            else { if (n > 0) break; n--; }
          }
          out[pid] = n;
        } catch { out[pid] = 0; }
      }));
      if (alive && Object.keys(out).length) setStreaks((s) => ({ ...s, ...out }));
    })();
    return () => { alive = false; };
  }, [topIdsKey]);
  // Snapshot today's ranked list so History can grade it later
  useEffect(() => {
    if (!top.length) return;
    try {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const hist = JSON.parse(localStorage.getItem("hrbHistory") || "{}");
      // Freeze the day's board once first pitch happens anywhere: the graded
      // slate must match the PREGAME board bets were placed from.
      const games = data || [];
      const isStarted = ({ g }) => {
        const st = g.status && g.status.abstractGameState;
        return st === "Live" || st === "Final";
      };
      const startedN = games.filter(isStarted).length;
      const wkday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
      const isWeekend = wkday === "Sat" || wkday === "Sun";
      const hourET = (g) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(g.gameDate)));
      // Weekdays: a couple of matinees don't lock the board — freeze only
      // when the first afternoon/evening (4pm+ ET) game starts, or when
      // everything has started. Weekends (early games all day): majority.
      const shouldLock = games.length > 0 && (isWeekend
        ? startedN > games.length / 2
        : games.some((x) => isStarted(x) && hourET(x.g) >= 16) || startedN === games.length);
      if (hist[day] && shouldLock) return;
      hist[day] = { ver: HRB_VERSION, entries: top.map((t) => ({ id: t.h.id, name: t.h.name, team: t.side.abbr, score: Math.round(t.score), prob: t.prob != null ? Math.round(t.prob * 1000) / 10 : null, pk: t.g.gamePk, st: streaks[t.h.id] ?? null })), results: (hist[day] && hist[day].results) || null };
      localStorage.setItem("hrbHistory", JSON.stringify(hist));
    } catch {}
  }, [topIdsKey, streaks]);
  // Grade past days (which of the 15 homered) the first time History opens
  useEffect(() => {
    if (view !== "history") return;
    let alive = true;
    (async () => {
      let hist = {};
      try { hist = JSON.parse(localStorage.getItem("hrbHistory") || "{}"); } catch {}
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const boxCache = {};
      for (const day of Object.keys(hist)) {
        const h = hist[day];
        if (day >= today || h.results) continue;
        const results = {};
        for (const e of h.entries || []) {
          try {
            if (!boxCache[e.pk]) boxCache[e.pk] = await (await fetch(`https://statsapi.mlb.com/api/v1/game/${e.pk}/boxscore`)).json();
            const b = boxCache[e.pk];
            // -1 = didn't play (scratched / benched / postponed): excluded
            // from hit-rate and expected sums instead of counting as a miss.
            let hr = -1;
            for (const k of ["away", "home"]) {
              const pl = b.teams && b.teams[k] && b.teams[k].players && b.teams[k].players["ID" + e.id];
              const st = pl && pl.stats && pl.stats.batting;
              if (!st) continue;
              const pa = st.plateAppearances != null ? st.plateAppearances
                : (st.atBats || 0) + (st.baseOnBalls || 0) + (st.hitByPitch || 0) + (st.sacFlies || 0) + (st.sacBunts || 0);
              if (pa > 0) hr = st.homeRuns || 0;
            }
            results[e.id] = hr;
          } catch { results[e.id] = null; }
        }
        h.results = results;
      }
      try { localStorage.setItem("hrbHistory", JSON.stringify(hist)); } catch {}
      if (alive) setHistory(hist);
    })();
    return () => { alive = false; };
  }, [view]);
  const hasBbe = (data || []).some(({ sides }) =>
    ["away", "home"].some((k) => {
      const s = sides[k];
      const pm = s.pitcher ? meta(s.pitcher.name, s.abbr, "pit") : {};
      return pm.bbe != null;
    })
  );
  if (selGame) return <HRBoundary onBack={() => setSelGame(null)}><GameDetail g={selGame} players={players} onSelectPlayer={onSelectPlayer} onBack={() => setSelGame(null)} /></HRBoundary>;
  return (
    <div>
      <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <div className="text-2xl font-extrabold tracking-tight">Matchups ({todayLabel}) <span role="button" onClick={() => window.__hrbRefetch && window.__hrbRefetch()}
              className="text-[10px] font-bold text-white/50 align-middle">
              {HRB_VERSION}{typeof window !== "undefined" && window.__hrbApiVer ? " · api " + window.__hrbApiVer : ""}{typeof window !== "undefined" && window.__hrbDataAt ? " · data " + window.__hrbDataAt + " ↻" : ""}
            </span></div>
      </div>
      <div className="px-4 pb-28">
        <div className="flex gap-2 mt-3">
          {[["matchups", "Matchups"], ["targets", "HR Targets"], ["history", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={"flex-1 py-2 rounded-full text-[11px] font-extrabold " + (view === id
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-800")}>
              {label}
            </button>
          ))}
        </div>
        {view === "targets" && top.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest uppercase mt-4 mb-2 px-1 text-slate-500 dark:text-slate-400">🎯 HR Targets</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {top.map((t, i) => (
                <button key={t.h.id + "-" + t.g.gamePk} onClick={() => setSelGame(t.g)}
                  className="w-full text-left px-3 py-1.5 active:bg-slate-50 dark:active:bg-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center text-[11px] font-extrabold text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                    <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + t.h.id + "/headshot/silo/current"}
                      alt="" className="w-8 h-8 rounded-full object-cover object-top shrink-0"
                      style={{ backgroundColor: teamColor(t.side.abbr) + "26" }} loading="lazy" />
                    {TEAM_LOGOS[t.side.abbr] && <img src={TEAM_LOGOS[t.side.abbr]} alt={t.side.abbr} className="w-4 h-4 rounded-full object-contain bg-white shrink-0" />}
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                      {t.h.bats ? t.h.bats + " " : ""}{t.h.name}
                    </span>
                    {!t.confirmed && <span className="text-[8px] font-extrabold text-amber-500 uppercase shrink-0">proj</span>}
                    <span className="ml-auto min-w-0 flex items-center justify-end gap-1">
                      {TEAM_LOGOS[t.oppAbbr] && <img src={TEAM_LOGOS[t.oppAbbr]} alt={t.oppAbbr} className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                      <span className="min-w-0 text-[10px] font-semibold text-slate-400 truncate">
                        vs {t.oppHand ? t.oppHand + "HP " : ""}{t.opp ? t.opp.name : "TBD"}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 pl-7">
                    <span className="w-8 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Bat</span>
                      <span className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-100 tabular-nums">{ordinalize(t.spot + 1)}</span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Brl%</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + (t.brl != null ? hrbHitClass(t.brl) : "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300")}>
                        {t.brl != null ? Number(t.brl).toFixed(1) + "%" : "no data"}
                      </span>
                    </span>
                    <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP Brl</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbPitBrlClass(t.oppBrl)}>
                        {t.oppBrl != null ? Number(t.oppBrl).toFixed(1) + "%" : "—"}
                      </span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP HR9</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbHr9Class(t.oppHr9)}>
                        {t.oppHr9 != null ? Number(t.oppHr9).toFixed(2) : "—"}
                      </span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP GB%</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbGbClass(t.oppGb)}>
                        {t.oppGb != null ? Number(t.oppGb).toFixed(0) + "%" : "—"}
                      </span>
                    </span>
                    <span className="ml-auto w-12 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">HR%</span>
                      <span className={"block text-[13px] font-extrabold " + HR_ACCENT + " tabular-nums"}>{t.prob != null ? (t.prob * 100).toFixed(0) + "%" : "—"}</span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 mt-0.5 pl-7">
                    <span className="text-[9px] font-semibold text-slate-400 truncate">
                      {(t.g.venue && t.g.venue.name) || ""}
                      {t.parkLR != null
                        ? <span className={"font-extrabold " + (t.parkLR.shown >= 105 ? "text-emerald-500" : t.parkLR.shown <= 95 ? "text-rose-500" : "text-amber-500")}> ({t.parkLR.shown} vs {t.parkLR.hand})</span>
                        : t.park != null && <span className={"font-extrabold " + parkRankColor(t.park)}> ({ordinalize(t.park)})</span>}
                    </span>
                    {t.wx && (
                      <span className="text-[9px] font-semibold text-slate-400 shrink-0">
                        {wxEmoji(t.wx.condition)} {t.wx.temp}°{t.wx.wind ? " · 💨 " + t.wx.wind : ""}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-[9px] text-slate-400 mt-1.5 px-1">v100 · HR% = chance of at least one HR today. SP K% discounts the per-contact stats · same-hand platoon ×0.90 L/L, ×0.96 R/R · Hitter = Barrel/PA^{HRB.eBrlPa} × HR/PA^{HRB.eHrPa} · SP = Brl%^{HRB.eSpBrl} × HR/9^{HRB.eSpHr9} × GB%⁻¹^{HRB.eGb}, blended {Math.round(HRB.spShare * 100)}/{Math.round((1 - HRB.spShare) * 100)} with opposing bullpen HR/9 · × park × weather&nbsp;· park is hand-specific (100 = avg, damped) · expected PAs by lineup spot · projected ×{HRB.projMult}</div>
          </>
        )}
        {view === "matchups" && (<>
        <div className="text-[11px] font-bold tracking-widest uppercase mt-5 mb-2 px-1 text-slate-500 dark:text-slate-400">Matchups</div>
        <div className="space-y-3">
          {data == null && <SkeletonCards cards={3} rows={4} />}
          {data && data.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No MLB games today.</div>}
          {data && [...data]
            .sort((a, b) => {
              const pri = (g) => {
                const st = g.status && g.status.abstractGameState;
                return st === "Live" ? 0 : st === "Final" ? 2 : 1;
              };
              return pri(a.g) - pri(b.g);
            })
            .map(({ g, sides, wx }) => {
            const state = g.status && g.status.abstractGameState;
            const aScore = g.teams.away.score, hScore = g.teams.home.score;
            const scoreStr = aScore != null && hScore != null ? aScore + "-" + hScore : "";
            const inn = g.linescore && g.linescore.currentInning
              ? ((g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "TOP " : "BOT ") + g.linescore.currentInning
              : "";
            const timeLabel = state === "Final" ? "Final " + scoreStr
              : state === "Live" ? "LIVE " + scoreStr + (inn ? " · " + inn : "")
              : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(g.gameDate));
            const rank = g.venue && g.venue.name ? parkRankFor(g.venue.name) : null;
            const isOpen = !!openPks[g.gamePk];
            const streakBadge = (s) => {
              const m = /^([WL])(\d+)$/.exec(s.streak || "");
              if (!m || Number(m[2]) < 5) return null;
              return m[1] === "W"
                ? <span className="ml-1 text-[9px] font-extrabold text-orange-500">W{m[2]}🔥</span>
                : <span className="ml-1 text-[9px] font-extrabold text-sky-400">L{m[2]}❄️</span>;
            };
            return (
              <div key={g.gamePk}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <button onClick={() => {
                    const opening = !openPks[g.gamePk];
                    setOpenPks((o) => ({ ...o, [g.gamePk]: !o[g.gamePk] }));
                    if (opening) {
                      const need = ["away", "home"].flatMap((kk) => sides[kk].hitters.map((h2) => h2.id)).filter((pid) => streaks[pid] == null);
                      Promise.all(need.map(async (pid) => {
                        try {
                          const gl = await (await fetch(`https://statsapi.mlb.com/api/v1/people/${pid}/stats?stats=gameLog&group=hitting`)).json();
                          const sp2 = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
                          const todayET2 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
                          let n2 = 0;
                          for (let j2 = sp2.length - 1; j2 >= 0; j2--) {
                            if (sp2[j2].date === todayET2) continue;
                            const st2 = sp2[j2].stat || {};
                            if ((st2.atBats ?? 0) === 0) continue;
                            if ((st2.hits ?? 0) > 0) { if (n2 < 0) break; n2++; }
                            else { if (n2 > 0) break; n2--; }
                          }
                          return [pid, n2];
                        } catch { return [pid, 0]; }
                      })).then((pairs) => setStreaks((s2) => ({ ...s2, ...Object.fromEntries(pairs) })));
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 active:bg-slate-50 dark:active:bg-slate-800">
<span className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 space-y-1.5">
                      {["away", "home"].map((kk) => {
                        const sd = sides[kk];
                        const sc = kk === "away" ? aScore : hScore;
                        return (
                          <span key={kk} className="flex items-center gap-2">
                            {TEAM_LOGOS[sd.abbr] && <img src={TEAM_LOGOS[sd.abbr]} alt="" className="w-6 h-6 rounded-full object-contain bg-white shrink-0" />}
                            <span className="min-w-0">
                              <span className="block text-xs font-extrabold" style={{ color: teamColor(sd.abbr) }}>
                                {sd.abbr}<span className="ml-1 font-bold text-slate-400 text-[9px] tabular-nums">{sd.rec}</span>{streakBadge(sd)}
                              </span>
                              {sd.pitcher && <span className="block text-[9px] font-bold text-slate-400 truncate">{sd.pitcher.name}{sd.pitcher.rec ? " (" + sd.pitcher.rec + ")" : ""}</span>}
                            </span>
                            {sc != null && (
                              <span className="ml-auto flex items-center shrink-0">
                                <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tabular-nums min-w-[26px] text-right">{sc}</span>
                                <span className="w-3.5 text-center text-red-500 text-[10px]">
                                  {state === "Live" && g.linescore && g.linescore.currentInning != null &&
                                    ((String(g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "away" : "home") === kk)
                                    ? (kk === "away" ? "▲" : "▼") : ""}
                                </span>
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                    <span className={"w-20 text-center text-[10px] font-extrabold shrink-0 " + (state === "Live" ? "text-slate-800 dark:text-white" : "text-slate-400")}>
                      {state === "Live" ? (
                        <span>
                          <span className="block text-[12px]">
                            {g.linescore && g.linescore.currentInning != null
                              ? (String(g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "TOP " : "BOT ") + g.linescore.currentInning
                              : "LIVE"}
                          </span>
                          {g.linescore && g.linescore.outs != null && (
                            <span className="block text-[8px] font-bold text-slate-400">{g.linescore.outs} OUT{g.linescore.outs === 1 ? "" : "S"}</span>
                          )}
                        </span>
                      ) : state === "Final" ? "Final" : timeLabel}
                    </span>
                    <span className={"text-slate-300 dark:text-slate-600 text-[10px] shrink-0 transition-transform " + (isOpen ? "rotate-90" : "")}>▶</span>
                  </span>
                </button>
                {isOpen && <div>
                {(g.venue && g.venue.name) || wx ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 truncate">
                      {(g.venue && g.venue.name) || ""}
                      {rank != null && <span className={"font-extrabold " + parkRankColor(rank)}> ({ordinalize(rank)})</span>}
                    </span>
                    {wx && (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {wxEmoji(wx.condition)} {wx.temp}°{wx.wind ? " · 💨 " + wx.wind : ""}
                      </span>
                    )}
                  </div>
                ) : null}
                {["away", "home"].map((k) => {
                  const s = sides[k];
                  const logo = TEAM_LOGOS[s.abbr];
                  const pm = s.pitcher ? meta(s.pitcher.name, s.abbr, "pit") : {};
                  const oppSP = sides[k === "away" ? "home" : "away"].pitcher;
                  const oppHand = oppSP && oppSP.hand;
                  return (
                    <div key={k} className={"px-4 py-3 " + (k === "home" ? "border-t border-slate-100 dark:border-slate-800" : "")}>
                      <div className="flex items-center gap-2">
                        {logo ? (
                          <img src={logo} alt="" className="w-6 h-6 rounded-full object-contain bg-white shrink-0" />
                        ) : (
                          <span className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: teamColor(s.abbr) }} />
                        )}
                        <span className="text-sm font-extrabold" style={{ color: teamColor(s.abbr) }}>{s.abbr}</span>
                        <span className={"ml-auto text-[9px] font-extrabold px-2 py-0.5 rounded-full " + (s.confirmed ? CHIP.good : s.hitters.length ? CHIP.warn : CHIP.none)}>
                          {s.confirmed ? "CONFIRMED LINEUP" : s.hitters.length ? "PROJECTED LINEUP" : "NO LINEUP"}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 mt-2">
                        <span className="flex items-center gap-2 flex-1 min-w-0 pb-0.5">
                          <span className="w-9 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5 shrink-0">
                            {s.pitcher && s.pitcher.hand ? s.pitcher.hand + "HP" : "SP"}
                          </span>
                          <span className="min-w-0 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {s.pitcher ? s.pitcher.name : "TBD"}
                            {s.pitcher && s.pitcher.era != null && (
                              <span className="ml-1.5 text-[10px] font-bold text-slate-400 tabular-nums">{s.pitcher.era} ERA</span>
                            )}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">Brl%</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbPitBrlClass(pm.barrel)}>
                            {pm.barrel != null ? Number(pm.barrel).toFixed(1) + "%" : "—"}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">GB%</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbGbClass(pm.gb)}>
                            {pm.gb != null ? Number(pm.gb).toFixed(0) + "%" : "—"}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">HR/9</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbHr9Class(pm.hr9)}>
                            {pm.hr9 != null ? Number(pm.hr9).toFixed(2) : "—"}
                          </span>
                        </span>
                      </div>
                      {(s.penHr9 != null || pm.bbe != null) && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="flex-1 min-w-0 flex items-center justify-between pl-11">
                            <span className={"text-[9px] font-bold tabular-nums " + (pm.bbe != null && pm.bbe < 60 ? "text-rose-500" : "text-slate-400")}>
                              {pm.bbe != null ? Math.round(pm.bbe) + " BBE" : ""}
                            </span>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">{s.penHr9 != null ? "Bullpen" : ""}</span>
                          </span>
                          <span className="w-11 shrink-0" />
                          <span className="w-11 shrink-0" />
                          <span className="w-11 text-center shrink-0">
                            {s.penHr9 != null && (
                              <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbHr9Class(Number(s.penHr9))}>
                                {Number(s.penHr9).toFixed(2)}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        {s.hitters.map((h, i) => {
                          const hm = meta(h.name, s.abbr, "hit");
                          const hb = brlVsHand(hm, oppHand);
                          return (
                            <div key={h.id} className="flex items-center gap-2">
                              <span className="w-4 text-center text-[10px] font-extrabold text-slate-300 dark:text-slate-600 tabular-nums shrink-0">{i + 1}</span>
                              <span className="w-4 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-200 shrink-0">{h.bats || ""}</span>
                              <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{h.name}</span>
                              <span className={"w-11 text-center text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums shrink-0 " + hrbHitClass(hb)}>
                                {hb != null ? Number(hb).toFixed(1) + "%" : "—"}
                              </span>
                              <span className="w-11 shrink-0" />
                              <span className={"w-11 shrink-0 text-center text-[11px] font-extrabold " + (streaks[h.id] <= -5 ? "text-sky-400" : "text-orange-500")}>
                                {streaks[h.id] >= 5 ? streaks[h.id] + "🔥" : streaks[h.id] <= -5 ? (-streaks[h.id]) + "❄️" : ""}
                              </span>
                            </div>
                          );
                        })}
                        {s.hitters.length === 0 && (
                          <div className="text-[11px] text-slate-400 pl-6">No recent lineup found.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setSelGame(g)}
                  className="w-full text-center text-[11px] font-extrabold text-blue-600 dark:text-blue-400 py-2.5 border-t border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800">
                  Full breakdown ›
                </button>
                </div>}
              </div>
            );
          })}
        </div>
        </>)}
        {view === "history" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300 leading-relaxed">
              Every day the Top 10 is frozen the first time the board loads, stamped with the formula version that made it. After the games end, each pick is graded from the box score: ✅ homered · — played but didn't · DNP scratched (doesn't count for or against). The scorecard shows whether HR% is telling the truth over time.
            </div>
            {showAdv && <div className="flex gap-2">
              {[["recent", "Last 14"], ["prior", "Prior 14"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setValWin(k)}
                  className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (valWin === k ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 dark:text-slate-300")}>{lbl}</button>
              ))}
              <button onClick={() => setValPA((v) => !v)}
                className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (valPA ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 dark:text-slate-300")}>
                {valPA ? "PA curve ON" : "PA curve OFF"}
              </button>
            </div>}
            {showAdv && <button onClick={() => runValidation(14)}
              disabled={valProg != null && valProg !== "done"}
              className="w-full text-center text-[11px] font-extrabold text-blue-600 dark:text-blue-400 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              {valProg == null ? "Validate current scoring (14-day backtest)" : valProg === "done" ? "Validation complete ✓ — re-run" : "Validating… " + valProg}
            </button>}
            {showAdv && valResult && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-200 dark:border-blue-900 shadow-sm px-4 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 mb-2">Validation · {valResult.ver} · {valResult.win === "prior" ? "prior" : "last"} 14 days · run {valResult.when}</div>
                {valResult.health && (
                  <div className="text-[9px] font-bold text-slate-400 mb-2">
                    <span className="block">Data health: {valResult.health.nB} batters, avg Brl {valResult.health.avgBrl != null ? valResult.health.avgBrl.toFixed(1) : "—"}% · {valResult.health.nP} SPs, avg HR/9 {valResult.health.avgHr9 != null ? valResult.health.avgHr9.toFixed(2) : "—"} · {valResult.health.dupes} duplicate names</span>
                    {valResult.health.luTot > 0 && (
                      <span className={"block " + ((valResult.health.luHit / valResult.health.luTot) < 0.8 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                        Lineup match: {valResult.health.luHit}/{valResult.health.luTot} of today's starters found ({Math.round((valResult.health.luHit / valResult.health.luTot) * 100)}%)
                        {valResult.health.luMiss.length > 0 && " · missing: " + valResult.health.luMiss.join(", ")}
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[["All", valResult.all], ["#1 pick", valResult.p1], ["Top 5", valResult.t5], ["6-10", valResult.t610]].map(([lbl, [h, t]]) => (
                    <span key={lbl}>
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                      <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{t ? `${h}/${t} (${Math.round((h / t) * 100)}%)` : "—"}</span>
                    </span>
                  ))}
                </div>
                {valResult.bett && (
                  <>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mt-3 mb-1">Bettable picks only (evening / weekend games)</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[["All", valResult.bett.all], ["#1 pick", valResult.bett.p1], ["Top 5", valResult.bett.t5], ["6-10", valResult.bett.t610]].map(([lbl, [h, t]]) => (
                        <span key={"b" + lbl}>
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{t ? `${h}/${t} (${Math.round((h / t) * 100)}%)` : "—"}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {history == null && <div className="text-center text-sm text-slate-400 py-12">Grading past boards…</div>}
            {history != null && Object.keys(history).length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">No history yet — each day's Top {HRB.topN} is saved automatically from this device.</div>
            )}
            {history != null && (() => {
              // ═══ THE SCORECARD ═══ One question: is HR% telling the truth?
              // played  = graded picks that actually got in the game (DNP = -1 excluded)
              // homered = how many of those homered
              // expected= what HR% promised, summed over the same picks
              // Verdict: expected ÷ actual - near 1.0 = honest, >1.25 = too
              // bold (scale HRB.calibration down), <0.8 = too timid.
              const days = Object.values(history).filter((h) => h.results);
              if (!days.length) return null;
              let played = 0, homered = 0, exp = 0, dnp = 0;
              const bucket = (lo, hi) => {
                let hit = 0, tot = 0;
                for (const h of days) (h.entries || []).forEach((e, i) => {
                  if (i < lo || i > hi || h.results[e.id] === -1) return;
                  tot++; if ((h.results[e.id] || 0) > 0) hit++;
                });
                return tot ? `${hit}/${tot} (${Math.round((hit / tot) * 100)}%)` : "—";
              };
              for (const h of days) for (const e of h.entries || []) {
                if (h.results[e.id] === -1) { dnp++; continue; }
                played++;
                if ((h.results[e.id] || 0) > 0) homered++;
                if (e.prob != null) exp += e.prob / 100;
              }
              const ratio = homered > 0 ? exp / homered : null;
              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Scorecard · {days.length} graded day{days.length > 1 ? "s" : ""}</span>
                    {ratio != null && (
                      <span className={"text-[10px] font-extrabold " + (ratio > 1.25 ? "text-rose-500" : ratio < 0.8 ? "text-sky-500" : "text-emerald-500")}>
                        {ratio > 1.25 ? "HR% too bold" : ratio < 0.8 ? "HR% too timid" : "HR% honest"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 tabular-nums mb-2">
                    {homered} of {played} picks homered ({played ? Math.round((100 * homered) / played) : 0}%) · HR% promised {exp.toFixed(1)}{dnp > 0 ? ` · ${dnp} DNP excluded` : ""}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[["#1 pick", bucket(0, 0)], ["Top 5", bucket(0, 4)], ["6-10", bucket(5, 14)]].map(([lbl, v]) => (
                      <span key={lbl}>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                        <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {history != null && Object.keys(history).sort().reverse().map((day) => {
              const h = history[day] || {};
              const entries = h.entries || [];
              const graded = h.results != null;
              const hits = graded ? entries.filter((e) => (h.results[e.id] || 0) > 0).length : null;
              const dnps = graded ? entries.filter((e) => h.results[e.id] === -1).length : 0;
              return (
                <div key={day} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-300">{day}{h.ver && <span className="ml-1 font-bold text-slate-400 dark:text-slate-500">· {h.ver}</span>}</span>
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-300">
                      {(() => {
                        if (!graded) return "Pending — grades after games end";
                        const live = entries.filter((e) => h.results[e.id] !== -1);
                        const probs = live.map((e) => e.prob).filter((x) => x != null);
                        const exp = probs.length ? probs.reduce((a, b) => a + b, 0) / 100 : null;
                        return `${hits}/${live.length} homered` + (exp != null ? ` · expected ${exp.toFixed(1)}` : "") + (dnps ? ` · ${dnps} DNP` : "");
                      })()}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entries.map((e, i) => {
                      const hr = graded ? h.results[e.id] : null;
                      return (
                        <div key={e.id + "-" + i} className="flex items-center gap-2 px-4 py-1.5">
                          <span className="w-4 text-center text-[10px] font-extrabold text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                          {TEAM_LOGOS[e.team] && <img src={TEAM_LOGOS[e.team]} alt="" className="w-4 h-4 rounded-full object-contain bg-white shrink-0" />}
                          <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{e.name}</span>
                          {e.prob != null && <span className={"text-[10px] font-bold " + HR_ACCENT + " tabular-nums shrink-0"}>{Math.round(e.prob)}%</span>}
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">{e.score}</span>
                          <span className="w-12 text-right text-[11px] font-extrabold shrink-0">
                            {hr == null && !graded ? <span className="text-slate-300 dark:text-slate-600">·</span>
                              : hr === -1 ? <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600">DNP</span>
                              : hr == null ? <span className="text-slate-300 dark:text-slate-600">—</span>
                              : hr > 0 ? <span className="text-emerald-500">✅{hr > 1 ? " ×" + hr : ""}</span>
                              : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button onClick={() => setShowAdv((v) => !v)}
              className="w-full text-center text-[10px] font-bold text-slate-400 py-1">
              {showAdv ? "Hide advanced tools" : "Advanced: 14-day backtest"}
            </button>
            {history != null && Object.keys(history).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Erase ALL saved history? This cannot be undone.")) {
                    try { localStorage.removeItem("hrbHistory"); } catch {}
                    setHistory({});
                  }
                }}
                className="w-full text-center text-[10px] font-bold text-slate-400 py-3">
                Reset history
              </button>
            )}
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

// ═══════════════ APP SHELL ═══════════════════════════════════════
const TABS = [
  { id: "hrboard", label: "Matchups", icon: "🎯" },
  { id: "teams", label: "Teams", icon: "⚾" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

export default function App() {
  const [tab, setTab] = useState("hrboard");
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [fatal, setFatal] = useState(null);
  useEffect(() => {
    const onErr = (e) => setFatal(String((e.error && e.error.message) || e.message || e.reason || e));
    const onRej = (e) => setFatal("async: " + String((e.reason && e.reason.message) || e.reason));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  const [teams, setTeams] = useState([]);
  const [selTeam, setSelTeam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = (bust) => fetch("/api/contracts" + (bust ? "?t=" + Date.now() : ""))
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        for (const t of d.teams || []) { const a = t.abbr || toAbbr(t.name); if (a && t.logo) TEAM_LOGOS[a] = t.logo; }
        // Different data sources abbreviate some teams differently
        for (const [x, y] of [["CWS","CHW"],["ARI","AZ"],["WSH","WSN"],["SF","SFG"],["SD","SDP"],["TB","TBR"],["KC","KCR"],["OAK","ATH"]]) {
          if (TEAM_LOGOS[x] && !TEAM_LOGOS[y]) TEAM_LOGOS[y] = TEAM_LOGOS[x];
          if (TEAM_LOGOS[y] && !TEAM_LOGOS[x]) TEAM_LOGOS[x] = TEAM_LOGOS[y];
        }
        setPlayers(d.players); setTeams(d.teams || []); window.__imports = d.imports || []; window.__hrbApiVer = d.apiVersion || "";
        window.__hrbDataAt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());
      } })
      .catch((e) => setError(String(e)));
    load(false);
    window.__hrbRefetch = () => load(true);
  }, []);

  if (sel) {
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={tab === "contracts" ? "Contracts" : tab === "teams" ? (selTeam ? selTeam.name : "Teams") : "Players"}
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
      {!players && !error && <div className="px-4 pt-6"><SkeletonCards cards={3} rows={3} /></div>}

      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={teams} players={players} onSelect={setSelTeam} onSelectPlayer={setSel} />
      )}
      {players && tab === "teams" && selTeam && (
        <TeamDetail
          team={selTeam} teams={teams}
          players={players}
          onBack={() => setSelTeam(null)}
          onSelectPlayer={setSel}
        />
      )}
      {fatal && (
        <div className="fixed inset-x-2 top-2 z-50 bg-red-600 text-white text-[11px] font-bold rounded-xl p-3 break-words shadow-lg" style={{ marginTop: "env(safe-area-inset-top)" }}>
          ⚠️ {fatal}
          <button className="block mt-1 underline" onClick={() => setFatal(null)}>dismiss</button>
        </div>
      )}
      {players && tab === "hrboard" && <HRBoardTab players={players} onSelectPlayer={setSel} />}
      {players && tab === "players" && <PlayersTab players={players} onSelect={setSel} />}
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
