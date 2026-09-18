import React, { useState, useMemo, useEffect, useRef } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2025";

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
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#003594", DEN: "#FB4F14", DET: "#0076B6", GB: "#203731",
  HOU: "#03202F", IND: "#002C5F", JAX: "#006778", JAC: "#006778",
  KC: "#E31837", LV: "#000000", LAC: "#0080C6", LAR: "#003594",
  MIA: "#008E97", MIN: "#4F2683", NE: "#002244", NO: "#D3BC8D",
  NYG: "#0B2265", NYJ: "#125740", PHI: "#004C54", PIT: "#FFB612",
  SF: "#AA0000", SEA: "#002244", TB: "#D50A0A", TEN: "#0C2340",
  WAS: "#5A1414", WSH: "#5A1414",
};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "arizona cardinals": "ARI", "atlanta falcons": "ATL", "baltimore ravens": "BAL",
  "buffalo bills": "BUF", "carolina panthers": "CAR", "chicago bears": "CHI",
  "cincinnati bengals": "CIN", "cleveland browns": "CLE", "dallas cowboys": "DAL",
  "denver broncos": "DEN", "detroit lions": "DET", "green bay packers": "GB",
  "houston texans": "HOU", "indianapolis colts": "IND", "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC", "las vegas raiders": "LV", "los angeles chargers": "LAC",
  "los angeles rams": "LAR", "miami dolphins": "MIA", "minnesota vikings": "MIN",
  "new england patriots": "NE", "new orleans saints": "NO", "new york giants": "NYG",
  "new york jets": "NYJ", "philadelphia eagles": "PHI", "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF", "seattle seahawks": "SEA", "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN", "washington commanders": "WAS",
};

function toAbbr(team) {
  if (!team) return "";
  const t = String(team).trim();
  if (TEAM_COLORS[t.toUpperCase()]) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}
const teamColorSafe = (a) => { try { return teamColor(a) || "#334155"; } catch { return "#334155"; } };
// Logo chips sit on the team's own color instead of plain white, the way the
// matchup header does. Dark colors get a subtle top gloss so the mark reads.
// Luminance of a hex color, 0 (black) to 1 (white)
// Is the app currently rendering dark? Inline styles can't use Tailwind's
// dark: variant, so team colors have to be computed.
function useDark() {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  return dark;
}
const lumOf = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Nudge a hex lighter (+) or darker (−) by a percentage — used for the subtle
// gradient on team-colored rows.
const shade = (hex, pct) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const v = [0, 2, 4].map((i) => {
    const n = parseInt(h.slice(i, i + 2), 16) + Math.round(255 * (pct / 100));
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  });
  return "#" + v.join("");
};
// The readable version of a team color for the current theme: dark navies get
// lifted on dark backgrounds, pale golds get deepened on light ones.
const teamInk = (abbr, dark) => {
  const c = teamColorSafe(abbr), l = lumOf(c);
  if (dark) return l < 0.34 ? shade(c, 34 - l * 100) : c;
  return l > 0.68 ? shade(c, -(l * 100 - 55)) : c;
};
// ESPN publishes a light "dark-background" mark for every team. Giants, Jets,
// Rams and friends vanish on their own navy without it.
const darkLogo = (abbr) => (abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${String(abbr).toLowerCase()}.png` : null);
const logoFor = (abbr, fallback, onDark) => (onDark && abbr ? darkLogo(abbr) : (fallback || TEAM_LOGOS[abbr] || null));
// White disc keeps every mark legible (they're drawn for white); identity comes
// from a team-color ring with an alternate-color hairline inside it.
const LOGO_BG = { BUF: "#00338D", DET: "#B0B7BC" };
const logoChip = (abbr, onColor) => {
  const bg = LOGO_BG[abbr] || "#ffffff";
  const onDark = lumOf(bg) < 0.5;
  return {
    background: bg,
    boxShadow: [
      onDark ? "inset 0 0 0 2px rgba(255,255,255,0.95)" : null,   // white keyline inside the disc
      `0 0 0 2.5px ${TEAM_ALT[abbr] || teamColorSafe(abbr)}`,      // team ring (Buffalo keeps its red)
      onColor ? "0 0 0 4px rgba(255,255,255,0.55)" : null,
    ].filter(Boolean).join(", "),
  };
};
// On a dark chip the standard mark disappears, so use ESPN's dark-background art.
const chipLogo = (abbr, fallback) => (LOGO_BG[abbr] && lumOf(LOGO_BG[abbr]) < 0.5 ? darkLogo(abbr) : (fallback || TEAM_LOGOS[abbr] || null));
const teamColor = (abbr) => TEAM_COLORS[String(abbr).toUpperCase()] || "#334155";
// Current-team color first; falls back to the contract team if no current team.
// Sleeper carries birth_date for every rostered player ("1994-10-31"); the
// Airtable base doesn't need a field for it.
function birthDateOf(p) {
  const inj = injFor(p.name, toAbbr(teamOfPlayer(p) || p.teamName || ""));
  const raw = (inj && inj.birth_date) || p.birthDate || null;
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function playerHeaderColor(p, dark) {
  if (HEADER_COLOR !== "team") return HEADER_COLOR;
  const abbr = toAbbr(p.teamName) || activeOf(p)?.team || "";
  return dark ? teamInk(abbr, true) : teamColor(abbr);
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
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  const url = photoOf(p);
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  // Initials render underneath; the img sits on top and removes itself if the
  // CDN 404s, so a bad fallback URL degrades to initials instead of a broken icon.
  return (
    <div className={px + " relative rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 overflow-hidden"}>
      {label}
      {url && (
        <img src={url} alt={p.name} loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top bg-white"
          onError={(e) => e.currentTarget.remove()} />
      )}
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

function Tile({ value, label, sub, accent, valueClass, compact, tint, trend }) {
  return (
    <div className={"bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm flex flex-col items-center justify-center " + (compact ? "px-1 py-2.5" : "px-2 py-4")}
      style={tint ? { borderColor: tint + "66", boxShadow: `inset 0 2px 0 0 ${tint}` } : undefined}>
      <div className={"font-semibold tracking-widest uppercase mb-1 " + (compact ? "text-[8px] " : "text-[10px] ") + (tint ? "" : "text-slate-400")}
        style={tint ? { color: tint, opacity: 0.9 } : undefined}>{label}</div>
      <div className={(compact ? "text-lg " : "text-2xl ") + "font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}<Trend t={trend} /></div>
      {sub && (
        <div className={"text-[10px] font-bold mt-0.5 " + (typeof sub === "object" && sub.cls ? sub.cls : "text-blue-600 dark:text-blue-400")}>
          {typeof sub === "object" ? sub.label : sub}
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
// ── Swipe gestures: left→right = back/previous, right→left = next ──
function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const t = e.changedTouches[0], dx = t.clientX - start.current.x, dy = t.clientY - start.current.y, dt = Date.now() - start.current.t;
      start.current = null;
      if (dt > 700 || Math.abs(dy) > 70 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) onRight && onRight(); else onLeft && onLeft();
    },
  };
}
// Spinning-football loader (the basketball app's bouncing ball, football edition)
function GlobalPulseStyles() {
  return <style>{`@keyframes hrbSoftPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>;
}
function Loader({ label = "Loading" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60vh" }}>
      <style>{`@keyframes hrbSpin { 0% { transform: rotate(-20deg) translateY(0) } 50% { transform: rotate(20deg) translateY(-10px) } 100% { transform: rotate(-20deg) translateY(0) } }`}</style>
      <div className="text-4xl" style={{ animation: "hrbSpin 0.9s ease-in-out infinite", display: "inline-block" }}>🏈</div>
      <div className="text-xs font-bold tracking-widest uppercase text-slate-400">{label}</div>
    </div>
  );
}
// One-time attention pulse (used on injury badges when a formation opens)
const PULSE_CSS = `@keyframes hrbPulse { 0%, 100% { transform: translate(-50%,0) scale(1); opacity: 1 } 50% { transform: translate(-50%,0) scale(1.1); opacity: 0.72 } }`;

// Position group for stat tiles / peer ranking
function posGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "WR") return "WR";
  if (p === "TE") return "TE";
  if (["RB", "HB", "FB"].includes(p)) return "RB";
  if (p === "QB") return "QB";
  if (/^(DE|DT|NT|EDGE|DL|LB|ILB|OLB|MLB|CB|S|FS|SS|DB|NB|LDE|RDE|LDT|RDT|LOLB|ROLB|DEF)$/.test(p)) return "DEF";
  return null;
}
// [label, statKey, ascending?]  (ascending = fewer is better, e.g. INT)
// Tapping a stat anywhere on a player page opens the Leaders board for that
// stat, filtered to the player's position group, scrolled to his row.
const STAT_JUMP = {
  passYds: ["passing", "passYds"], passTd: ["passing", "passTd"], cmp: ["passing", "cmp"], att: ["passing", "att"], int: ["passing", "int"],
  rushYds: ["rushing", "rushYds"], rushTd: ["rushing", "rushTd"], car: ["rushing", "car"], ypcar: ["rushing", "ypcar"], carShare: ["rushing", "car"],
  recYds: ["receiving", "recYds"], recTd: ["receiving", "recTd"], rec: ["receiving", "rec"], tgt: ["receiving", "tgt"], tgtShare: ["receiving", "tgt"],
  touches: ["rushing", "car"],
  tkl: ["defense", "tkl"], solo: ["defense", "tkl"], sacks: ["defense", "sacks"], defInt: ["defense", "defInt"], tfl: ["defense", "tfl"], pd: ["defense", "pd"],
};
const STAT_TILES = {
  WR: [["Rec", "rec"], ["Rec Yds", "recYds"], ["Rec TD", "recTd"]],
  TE: [["Rec", "rec"], ["Rec Yds", "recYds"], ["Rec TD", "recTd"]],
  RB: [["Carries", "car"], ["Rush Yds", "rushYds"], ["Rush TD", "rushTd"]],
  QB: [["Pass Yds", "passYds"], ["Pass TD", "passTd"], ["INT", "int", true]],
  DEF: [["Tackles", "tkl"], ["Sacks", "sacks"], ["INT", "defInt"]],
};
// ── Season stats box + game-by-game graph (from /api/season-stats) ──
const pctOf = (v) => (v != null ? Math.round(v * 100) + "%" : null);
// Direction of travel for a team stat: compare the most recent game with the
// average of every game before it. null until there are two games to compare.
// lowerBetter flips the colour (giving up fewer points is an improvement).
function trendOf(log, key, lowerBetter) {
  if (!Array.isArray(log) || log.length < 2) return null;
  const vals = log.map((g) => Number(g[key]) || 0);
  const last = vals[vals.length - 1];
  const prior = vals.slice(0, -1);
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (!avg && !last) return null;
  const diff = last - avg;
  if (Math.abs(diff) < Math.max(0.5, avg * 0.03)) return null;   // flat enough to leave alone
  const up = diff > 0;
  return { up, good: lowerBetter ? !up : up, delta: Math.abs(diff) };
}
function Trend({ t }) {
  if (!t) return null;
  return <span className={"ml-1 text-[10px] font-black align-middle " + (t.good ? "text-emerald-500" : "text-rose-500")}>{t.up ? "▲" : "▼"}</span>;
}
function SeasonStatsBox({ p, seasonStats, onStatJump }) {
  const [metric, setMetric] = useState(null);
  const dark = useDark();
  if (!seasonStats || !seasonStats.players) return null;
  // match by name (+team when ambiguous)
  const nm = hrbNrmSafe(p.name);
  const abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  const cands = Object.values(seasonStats.players).filter((q) => hrbNrmSafe(q.name) === nm);
  const P = cands.length > 1 ? cands.find((q) => injTeamEq(q.team, abbr)) || cands[0] : cands[0];
  if (!P || !P.totals || !P.totals.gp) return null;
  const T = P.totals, G = P.perGame;
  const ink = playerHeaderColor(p, dark) || "#2563eb";   // team color, theme-corrected
  const pos = String(p.pos || P.pos || "").toUpperCase();
  const isQB = pos === "QB", isRB = ["RB", "HB", "FB"].includes(pos), isRec = ["WR", "TE"].includes(pos);
  const isDef = !isQB && !isRB && !isRec && (T.tkl > 0 || T.sacks > 0 || T.defInt > 0);
  // Columns per position: [label, total, per-game, graphKey]
  const cols = isQB ? [["Cmp", T.cmp, G.cmp, "cmp"], ["Att", T.att, G.att, "att"], ["Pass Yds", T.passYds, G.passYds, "passYds"], ["Pass TD", T.passTd, G.passTd, "passTd"], ["INT", T.int, G.int, "int"], ["Rush Yds", T.rushYds, G.rushYds, "rushYds"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"]]
    : isRB ? [["Carries", T.car, G.car, "car"], ["Rush Yds", T.rushYds, G.rushYds, "rushYds"], ["Y/Car", T.ypcar, null, null, "ypcar"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"], ["Targets", T.tgt, G.tgt, "tgt"], ["Rec", T.rec, G.rec, "rec"], ["Rec Yds", T.recYds, G.recYds, "recYds"], ["Rec TD", T.recTd, G.recTd, "recTd"], ["Car Share", pctOf(T.carShare), null, null, "carShare"], ["Tgt Share", pctOf(T.tgtShare), null, null, "tgtShare"], ["Touches", T.touches ?? null, null, null, "touches"]]
    : isRec ? [["Rec", T.rec, G.rec, "rec"], ["Targets", T.tgt, G.tgt, "tgt"], ["Rec Yds", T.recYds, G.recYds, "recYds"], ["Rec TD", T.recTd, G.recTd, "recTd"], ["Y/Rec", T.ypc, null, null], ["Tgt Share", pctOf(T.tgtShare), null, null, "tgtShare"], ["Carries", T.car, G.car, "car"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"]]
    : isDef ? [["Tackles", T.tkl, G.tkl, "tkl"], ["Solo", T.solo, G.solo, "solo"], ["Sacks", T.sacks, G.sacks, "sacks"], ["TFL", T.tfl, G.tfl, "tfl"], ["INT", T.defInt, G.defInt, "defInt"], ["PD", T.pd, G.pd, "pd"], ["TD", T.defTd, G.defTd, "defTd"]]
    : [];
  if (!cols.length) return null;
  const graphable = cols.filter((c) => c[3]);
  const key = metric || (isRec ? "tgt" : isRB ? "car" : isQB ? "passYds" : "tkl");
  const series = P.games.map((g) => ({ week: g.week, opp: g.opp, v: g[key] || 0 }));
  const raw = Math.max(1, ...series.map((d) => d.v));
  const max = raw * 1.18;                 // headroom so the top value label clears the frame
  const W = 320, H = 150, padL = 24, padB = 20, padT = 18;
  const x = (i) => padL + (series.length > 1 ? (i * (W - padL - 6)) / (series.length - 1) : (W - padL) / 2);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const path = series.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d.v).toFixed(1)).join(" ");
  const label = graphable.find((c) => c[3] === key)?.[0] || key;
  const gid = String(p.id || p.name || "g").replace(/\W/g, "");
  return (
    <>
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{seasonStats.season} Season · {T.gp} GP</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-4">
          {(() => {
            // pad to a full row of 4 so the block ends square instead of ragged
            const padded = [...cols];
            while (padded.length % 4) padded.push(null);
            return padded.map((c, i) => (
              <button key={i} onClick={c && STAT_JUMP[c[4] || c[3]] && onStatJump ? () => onStatJump({ key: c[4] || c[3], name: p.name, team: abbr, pos: posGroup(pos) }) : undefined}
                className="px-2 py-3 text-center border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800/60"
                style={{ borderTopWidth: i >= 4 ? 1 : 0, borderLeftWidth: i % 4 ? 1 : 0, borderStyle: "solid" }}>
                {c ? (<>
                  <div className="text-[8px] font-bold tracking-widest uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: ink, opacity: 0.9 }}>{c[0]}</div>
                  <div className="text-[17px] leading-none font-black tabular-nums text-slate-900 dark:text-white mt-1.5">{c[1] ?? "—"}</div>
                  <div className="text-[9px] font-semibold text-slate-400 tabular-nums mt-1 h-3">{c[2] != null ? c[2] + "/g" : ""}</div>
                </>) : <div className="h-[52px]" />}
              </button>
            ));
          })()}
        </div>
        {/* game-by-game line: is the role trending up or down? */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto mb-1" style={{ scrollbarWidth: "none" }}>
            {graphable.map(([lbl,,, k]) => (
              <button key={k} onClick={() => { if (key === k && onStatJump && STAT_JUMP[k]) onStatJump({ key: k, name: p.name, team: abbr, pos: posGroup(pos) }); else setMetric(k); }}
                className={"shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold " + (key === k ? "text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300")}
                style={key === k ? { backgroundColor: ink } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <defs>
              <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ink} stopOpacity="0.32" />
                <stop offset="100%" stopColor={ink} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - 6} y1={y(raw * f)} y2={y(raw * f)} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray={f === 0 ? "" : "3 3"} />
                <text x={padL - 5} y={y(raw * f) + 3} fontSize="8" textAnchor="end" className="fill-slate-400">{Math.round(raw * f)}</text>
              </g>
            ))}
            {/* filled area under the line, in the team's color */}
            <path d={`${path} L ${x(series.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`} fill={`url(#area-${gid})`} />
            <path d={path} fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {series.map((d, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(d.v)} r="4" fill={ink} stroke="white" strokeWidth="1.8" />
                <text x={x(i)} y={y(d.v) - 9} fontSize="8.5" textAnchor="middle" fontWeight="800" className="fill-slate-700 dark:fill-slate-200">{d.v}</text>
                <text x={x(i)} y={H - 5} fontSize="7.5" textAnchor="middle" className="fill-slate-400">W{d.week}</text>
              </g>
            ))}
          </svg>
          <div className="text-[9px] text-slate-400 text-center">{label} by game · tap the selected pill for league ranks</div>
        </div>
      </div>
    </>
  );
}

function PlayerDetail({ p, onBack, backLabel, mode = "full", seasonStats, onStatJump }) {
  const dark = useDark();
  // Deeper injury record for this one player (ESPN's athlete feed), which
  // carries a return date far more often than the league-wide report does.
  const [deepInj, setDeepInj] = useState(null);
  useEffect(() => {
    setDeepInj(null);
    const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
    if (!injHasFlag(p, a)) return;
    const inj = injFor(p.name, a);
    const id = inj && inj.espn_id;
    if (!id) return;
    let alive = true;
    fetch(`/api/injuries?espn=${id}`).then((r) => r.json())
      .then((d) => { if (alive && d && d.injury) setDeepInj(d.injury); }).catch(() => {});
    return () => { alive = false; };
  }, [p.id, p.name]);
  const swipe = useSwipe({ onRight: onBack });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="relative px-5 pb-8 text-white" style={{ backgroundColor: playerHeaderColor(p, dark), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="relative text-sm font-semibold opacity-80 mb-4">‹ {backLabel}</button>
        <div className="relative flex items-center gap-4">
          <div className="rounded-full p-[3px] bg-white/90 shadow-lg shrink-0"><Avatar p={p} size="lg" /></div>
          <div className="min-w-0">
            <div className="text-[26px] font-extrabold leading-tight truncate drop-shadow-sm">
              {p.name}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-white/90 truncate">
              {(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return [TEAM_NAMES[a] || teamOfPlayer(p) || p.teamName, cleanNo(p.no) ? "#" + cleanNo(p.no) : null, POS_FULL[String(p.pos || "").toUpperCase()] || p.pos].filter(Boolean).join(" · "); })()}
            </div>
            <div className="flex items-center gap-2 mt-1.5 min-w-0 flex-wrap">
              {injHasFlag(p, toAbbr(teamOfPlayer(p) || p.teamName || ""))
                ? <InjBadge p={p} team={toAbbr(teamOfPlayer(p) || p.teamName || "")} lg noNote />
                : <span className="inline-block rounded-full bg-emerald-600 text-white text-[10px] font-extrabold tracking-wider px-2.5 py-1">ACTIVE</span>}
            </div>
            <InjuryLine p={p} deep={deepInj} />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {(() => {
          // Three season tiles by position, each ranked against every player at
          // that position league-wide (Nacua's rec yards vs all WRs).
          const pos = String(p.pos || "").toUpperCase();
          const grp = posGroup(pos);
          if (!grp || !seasonStats || !seasonStats.players) return null;
          const S = playerSeasonRow(p, seasonStats); const T = S ? S.totals : null;
          const yr = seasonStats.season;
          const spec = STAT_TILES[grp];
          const peers = Object.values(seasonStats.players).filter((q) => posGroup(q.pos) === grp && q.totals && q.totals.gp);
          const rankOf = (k, asc) => {
            if (!T) return null;
            const mine = T[k] || 0;
            const vals = peers.map((q) => q.totals[k] || 0).sort((a, b) => (asc ? a - b : b - a));
            // standard competition ranking: five backs on 4 TDs are all 1st (tie)
            return { r: vals.indexOf(mine) + 1, tie: vals.filter((v) => v === mine).length > 1 };
          };
          const tier = (r, n) => (r == null ? "text-slate-400" : r <= Math.max(5, n * 0.15) ? "text-emerald-500" : r <= n * 0.5 ? "text-amber-500" : "text-slate-400");
          return (
            <div className="grid grid-cols-3 gap-2">
              {spec.map(([lbl, k, asc]) => {
                const rk = rankOf(k, asc);
                const r = rk ? rk.r : null;
                const jump = STAT_JUMP[k];
                return (
                  <button key={k} onClick={jump && onStatJump ? () => onStatJump({ key: k, name: p.name, team: toAbbr(teamOfPlayer(p) || p.teamName || ""), pos: grp }) : undefined}
                    className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-2 pt-3 pb-2.5 text-center active:scale-[0.97] transition-transform">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: playerHeaderColor(p, dark) }} />
                    <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{lbl}</div>
                    <div className="text-[26px] leading-tight font-black tabular-nums text-slate-900 dark:text-white">{T ? (T[k] ?? "—") : "—"}</div>
                    <div className={"text-[10px] font-extrabold " + tier(r, peers.length)}>{r ? ordinal(r) + (rk.tie ? " (tie)" : "") : "—"}</div>
                    {(grp === "WR" || grp === "TE") && <div className="text-[8px] font-semibold tracking-wide uppercase text-slate-400 mt-0.5">{grp === "WR" ? "Wide Receiver Rank" : "TE Rank"}</div>}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height / Weight" v={[p.height, p.weight].filter(Boolean).join(", ")} />
              <BioRow k="Date of Birth" v={birthDateOf(p)} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(": ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace} />
            </div>
          </>
        )}
        {mode === "full" && <SeasonStatsBox p={p} seasonStats={seasonStats} onStatJump={onStatJump} />}

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
                      {[["G", st.gp != null ? Math.round(st.gp) : null], ["PASS", st.passYds != null ? Math.round(st.passYds) : null], ["RUSH", st.rushYds != null ? Math.round(st.rushYds) : null], ["REC YDS", st.recYds != null ? Math.round(st.recYds) : null], ["REC", st.rec != null ? Math.round(st.rec) : null]].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {[["TD", st.td != null ? Math.round(st.td) : null], ["INT", st.ints != null ? Math.round(st.ints) : null], ["TKL", st.tkl != null ? Math.round(st.tkl) : null], ["SCK", fmt1(st.sck)]].map(([lbl, v]) => (
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
const NFL_VERSION = "v12";
// Until the current season has results, fall back to last season's numbers
const seasonStarted = (teams) => (teams || []).some((t) => (t.wins ?? 0) + (t.losses ?? 0) + (t.ties ?? 0) > 0);
function teamRec(t, started) {
  const w = started ? t.wins : (t.winsPrev ?? t.wins);
  const l = started ? t.losses : (t.lossesPrev ?? t.losses);
  const ti = started ? t.ties : (t.tiesPrev ?? t.ties);
  return { w: w ?? 0, l: l ?? 0, t: ti ?? 0, str: (w ?? 0) + "-" + (l ?? 0) + ((ti ?? 0) > 0 ? "-" + ti : "") };
}
const teamPts = (t, started) => ({
  pf: started ? t.pf : (t.pfPrev ?? t.pf),
  pa: started ? t.pa : (t.paPrev ?? t.pa),
});

// ═══════════════ LIVE INJURY LAYER (Sleeper API) ═════════════════
// Fetched once at load; free public feed, no key. Statuses:
//   injury_status: Questionable / Doubtful / Out
//   status: Active / Injured Reserve / PUP / NFI / Inactive
const INJ_BY_NAME = {}; // normalized name -> [sleeper players] (dupes kept)
const INJ_BY_LAST = {}; // "TEAM|lastname" -> [sleeper players] — nickname-proof fallback
const lastNameKey = (name) => {
  const parts = injNrm(name).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};
const injNrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const injTeamEq = (a, b) => {
  const n = (t) => String(t || "").toUpperCase();
  if (n(a) === n(b)) return true;
  const AL = [["WAS", "WSH"], ["JAX", "JAC"], ["LAR", "LA"], ["ARI", "ARZ"], ["BAL", "BLT"], ["CLE", "CLV"], ["HOU", "HST"]];
  return AL.some(([x, y]) => (n(a) === x && n(b) === y) || (n(a) === y && n(b) === x));
};
// Sleeper's "not playing" vocabulary — shared by the formation and the unit rankings
const OUT_CODES = new Set(["OUT", "IR", "PUP", "NA", "SUS", "COV", "DNR", "NFI", "RET"]);
function injIsOut(inj) {
  return !!inj && (OUT_CODES.has(String(inj.injury_status || "").toUpperCase()) ||
    /injured reserve|pup|non football|suspend|inactive/i.test(String(inj.status || "")));
}

function injFor(name, teamAbbr) {
  const list = INJ_BY_NAME[injNrm(name)];
  if (list && list.length) {
    if (list.length > 1 && teamAbbr) {
      const hit = list.find((p) => injTeamEq(p.team, teamAbbr));
      if (hit) return hit;
      return null; // duplicate name, wrong/unknown team — don't guess
    }
    return list[0];
  }
  // Full name missed (nickname: "Bam Knight" vs Sleeper's "Zonovan Knight").
  // Fall back to team + last name, but only when exactly one player on that
  // team has the last name — never guess between two Smiths.
  if (teamAbbr) {
    for (const t of Object.keys(INJ_BY_LAST)) {
      const [team, last] = t.split("|");
      if (last === lastNameKey(name) && injTeamEq(team, teamAbbr)) {
        const cands = INJ_BY_LAST[t];
        if (cands.length === 1) return cands[0];
      }
    }
  }
  return null;
}
// Automated headshots: if Airtable has no photo, fall back to Sleeper's CDN
// (keyed by the player_id we already matched for injuries). Covers every
// rostered player with zero manual uploads.
function photoOf(p, teamAbbr) {
  if (p.photo) return p.photo;
  const inj = injFor(p.name, teamAbbr || toAbbr(teamOfPlayer(p) || p.teamName || ""));
  return inj && inj.player_id
    ? `https://sleepercdn.com/content/nfl/players/${inj.player_id}.jpg`
    : null;
}

// Badge only when NOT plain healthy-active (keeps rows quiet)
// Player-page injury line: "Ankle sprain · Est. return Oct 20". Body part +
// type from Sleeper (instant); return date from ESPN when the team gave one.
function InjuryLine({ p, deep }) {
  const abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  if (!injHasFlag(p, abbr)) return p.injuryNotes ? <div className="inline-block mt-1.5 text-[11px] font-bold text-white bg-rose-600 rounded-full px-2 py-0.5 truncate max-w-full lowercase">({p.injuryNotes})</div> : null;
  const d = injuryDetail(p, abbr, deep);
  if (!d) return null;
  return <div className="mt-1.5 text-[11px] font-bold text-white bg-rose-600 rounded-full px-2.5 py-0.5 inline-block max-w-full truncate">{d.text}</div>;
}

function InjBadge({ p, team, lg = false, noNote = false }) {
  const inj = injFor(p.name, team);
  if (!inj) return null;
  let label = null, cls = "";
  const is2 = inj.injury_status;
  if (is2 === "Questionable") { label = "QUESTIONABLE"; cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"; }
  else if (is2 === "Doubtful") { label = "DOUBTFUL"; cls = "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"; }
  else if (is2 === "Out") { label = "OUT"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
  // Sleeper also uses short codes in injury_status itself (IR, PUP, NA, Sus, COV)
  else if (/^(IR|PUP|NA|SUS|COV|DNR|NFI)$/i.test(String(is2 || ""))) { label = String(is2).toUpperCase() === "NA" ? "OUT" : String(is2).toUpperCase(); cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
  else {
    const st = String(inj.status || "");
    if (/injured reserve/i.test(st)) { label = "IR"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
    else if (/pup|physically unable/i.test(st)) { label = "PUP"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
    else if (/non football/i.test(st)) { label = "NFI"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
    else if (/inactive/i.test(st)) { label = "INACTIVE"; cls = "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"; }
  }
  if (!label) return null;
  const note = inj.injury_body_part || null; // e.g. "Hamstring", "Knee"
  return (
    <span className="inline-flex flex-col items-start gap-0.5 min-w-0">
      <span className={"font-extrabold rounded px-1.5 shrink-0 " + (lg ? "text-[11px] py-0.5 " : "text-[9px] py-px ") + cls}>
        {label}
      </span>

    </span>
  );
}

// Live status wins over the Airtable status field when they disagree
// (this is what makes Teams and Players views tell the same story)
// How many players per position count as "starters" (tune to your labels)
const STARTER_DEPTH = { WR: 3, CB: 2, LB: 2, OLB: 2, ILB: 2, DT: 2, DE: 2, EDGE: 2, S: 2, G: 2, T: 2 };
const depthOf = (p) => (p.sort != null ? (p.sort % 100 === 0 ? 1 : p.sort % 100) : null);
const isStarter = (p) => {
  const d = depthOf(p);
  if (d == null) return false;
  return d <= (STARTER_DEPTH[String(p.pos || "").toUpperCase()] || 1);
};

// unit state lives in TeamDetail now so the stat tiles up top can react to
// the Offense/Defense toggle. lineRank = this team's OL/DL league ranks.
function FormationView({ roster, abbr, unit, setUnit, onSelectPlayer, lineRank, team }) {
  const lblOf = (p) => String(p.sortLabel || "").toUpperCase();
  const depthNo = (p) => { const m = lblOf(p).match(/(\d+)$/); return m ? Number(m[1]) : 1; };
  const baseOf = (p) => { const m = lblOf(p).match(/^([A-Z]+)/); return m ? m[1] : null; };
  const norm = (b) => (b && b.length > 2 && /^[LR]/.test(b) && !["LB", "RB"].includes(b) ? b.slice(1) : b);
  const injOf = (p) => (p ? injFor(p.name, abbr) : null);
  // Sleeper's injury_status vocabulary is wider than Q/D/Out — IR, PUP, NA,
  // Sus, COV, DNR all mean "not playing". Missing any of these = a hurt
  // player shown as healthy (the Charbonnet bug).
  // Out = Sleeper says so, OR you marked Status = Out / Inactive / IR in Airtable
  // (healthy scratches never hit the injury report, so the manual flag matters).
  const airtableOut = (p) => /^(out|inactive|ir|injured reserve|pup|suspended)$/i.test(String((p && p.status) || "").trim());
  const isOut = injIsOut;
  const outP = (p) => !!p && (injIsOut(injOf(p)) || airtableOut(p));
  // Health state: "out" | "d" | "q" | "ok" | null (no Sleeper match)
  const healthOf = (p) => {
    if (airtableOut(p)) return "out";
    const inj = injOf(p);
    if (!inj) return null;
    if (isOut(inj)) return "out";
    const st = String(inj.injury_status || "").toUpperCase();
    if (st === "DOUBTFUL") return "d";
    if (st === "QUESTIONABLE") return "q";
    return "ok";
  };
  // Ring: white = healthy (reads on grass), gray = no data, orange = Q, red = D/Out
  const ringCls = (p) => {
    if (!p) return "border-white/40";
    const h = healthOf(p);
    if (h == null) return "border-slate-400";
    if (h === "ok") return "border-white";
    return "border-red-500"; // anyone banged up = red; the badge says how badly
  };
  // High-contrast status badge at the top-right of the circle — the thing
  // you actually read, since ring hue alone gets lost against green turf.
  const HealthBadge = ({ p, small }) => {
    const h = healthOf(p);
    if (!h || h === "ok") return null;
    const inj = injOf(p) || {};
    const txt = h === "q" ? "QUESTIONABLE" : h === "d" ? "DOUBTFUL"
      : (String(inj.injury_status || "").toUpperCase() === "IR" || /injured reserve|^ir$/i.test(String(inj.status || p.status || ""))) ? "IR"
      : String(inj.injury_status || "").toUpperCase() === "PUP" ? "PUP" : "OUT";
    return (
      <span className={"absolute -top-2 left-1/2 px-1.5 rounded-full font-extrabold text-white bg-red-600 border-2 border-white shadow whitespace-nowrap flex items-center justify-center " +
        (small ? "h-[13px] text-[6px] " : "h-[15px] text-[7px] ")}
        style={{ transform: "translate(-50%,0)", animation: "hrbPulse 1.8s ease-in-out infinite" }}>
        {txt}
      </span>
    );
  };
  const used = new Set();
  let SLOTS, assigned, formationLabel = null; // defense sets this ("4-3 · Nickel"); offense stays clean

  if (unit === "offense") {
    // Offense keeps the 11-man template — it's stable across the league.
    SLOTS = [
      { lbl: "WR", x: 11, y: 24, exact: ["WR1"], aliases: ["WR"] },
      { lbl: "WR", x: 89, y: 24, exact: ["WR2"], aliases: ["WR"] },
      { lbl: "WR", x: 22, y: 40, exact: ["WR3"], aliases: ["WR"] },
      { lbl: "TE", x: 82, y: 40, exact: ["TE1"], aliases: ["TE"] },
      { lbl: "LT", x: 10, y: 56, exact: ["LT1"], aliases: ["LT", "OT", "T"] },
      { lbl: "LG", x: 30, y: 56, exact: ["LG1"], aliases: ["LG", "G", "OG"] },
      { lbl: "C", x: 50, y: 56, exact: ["C1"], aliases: ["C", "OC"] },
      { lbl: "RG", x: 70, y: 56, exact: ["RG1"], aliases: ["RG", "G", "OG"] },
      { lbl: "RT", x: 90, y: 56, exact: ["RT1"], aliases: ["RT", "OT", "T"] },
      { lbl: "QB", x: 50, y: 72, exact: ["QB1"], aliases: ["QB"] },
      { lbl: "RB", x: 50, y: 88, exact: ["RB1", "HB1"], aliases: ["RB", "HB", "FB"] },
    ];
    // Two-pass slot assignment.
    //   Pass 1 — exact depth labels claim their exact slot: "WR3" lands at the
    //   3rd WR spot even if no WR2 exists, leaving the WR2 slot visibly open.
    //   Pass 2 — remaining slots fill in depth order by label, then Position.
    assigned = new Array(SLOTS.length).fill(null);
    // Next man up: an OUT/IR/PUP/suspended starter is skipped in pass 1 and
    // his slot fills from the depth chart in pass 2 (WR4 steps into WR3's
    // spot). He goes to the sideline wearing his OUT badge. Q/D starters stay
    // on the field — those are game-time calls, not lineup changes.
    const outStarter = new Array(SLOTS.length).fill(null);
    SLOTS.forEach((s, i) => {
      for (const want of s.exact || []) {
        const hit = roster.find((p) => !used.has(p.id) && lblOf(p) === want);
        if (hit) {
          if (outP(hit)) { outStarter[i] = hit; continue; }
          assigned[i] = hit; used.add(hit.id); break;
        }
      }
    });
    SLOTS.forEach((s, i) => {
      if (assigned[i]) return;
      const aliasIdx = (p) => s.aliases.findIndex((a) => new RegExp("^" + a + "\\d*$").test(lblOf(p)));
      const healthy = (p) => !outP(p);
      const byLabel = roster
        .filter((p) => !used.has(p.id) && aliasIdx(p) !== -1 && healthy(p))
        .sort((a, b) => aliasIdx(a) - aliasIdx(b) || depthNo(a) - depthNo(b));
      const byPos = roster
        .filter((p) => !used.has(p.id) && s.aliases.includes(String(p.pos || "").toUpperCase()) && healthy(p))
        .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999));
      // Offensive line backups are interchangeable across the interior (a C2 is
      // the backup guard too) and across tackle spots — so if the slot's own
      // position has no healthy backup, borrow from the line family before
      // showing a hole. Depth-1 starters at other spots are never pulled.
      const OL_INTERIOR = ["C", "OC", "LG", "RG", "G", "OG", "OL"], OL_TACKLE = ["LT", "RT", "OT", "T", "OL"];
      const fam = ["LG", "C", "RG"].includes(s.lbl) ? OL_INTERIOR : ["LT", "RT"].includes(s.lbl) ? OL_TACKLE : null;
      const byFamily = fam ? roster
        .filter((p) => !used.has(p.id) && healthy(p) && depthNo(p) >= 2 && (fam.some((a) => new RegExp("^" + a + "\\d*$").test(lblOf(p))) || fam.includes(String(p.pos || "").toUpperCase())))
        .sort((a, b) => depthNo(a) - depthNo(b) || (b.rating2k ?? 0) - (a.rating2k ?? 0)) : [];
      // no healthy body at all -> show the injured starter rather than a hole
      const hit = byLabel[0] || byPos[0] || byFamily[0] || outStarter[i] || null;
      if (hit) { assigned[i] = hit; used.add(hit.id); if (outStarter[i] && hit !== outStarter[i]) s.nextUp = true; }
    });
  } else {
    // ── Defense: NOT a template. Every declared starter takes the field. ──
    // Real depth charts don't have exactly 11 starters (4 LBs + a nickel is
    // 12). Each row lays itself out for however many starters it has, so a
    // 4-3, 3-4, nickel, or 3-4-with-four-LBs all render without dropping
    // anyone. Rule: "X1" (or a side label like LOLB1) in Airtable = starter.
    // Base label normalized: strip a side prefix (LILB -> ILB, RDE -> DE) so
    // any naming style classifies into the right row. Nicknames included
    // (MIKE/WILL/SAM/JACK/BUCK/MACK for LBs, STAR/DIME/NICKEL for DBs).
    const ROW_OF = (b0) => {
      const b = norm(b0);
      if (/^(DE|DT|NT|EDGE|DL)$/.test(b)) return "dl";
      if (/^(OLB|ILB|MLB|LB|WLB|SLB|MIKE|WILL|SAM|JACK|BUCK|MACK)$/.test(b)) return "lb";
      if (/^(CB|NB|NCB|SLOT|DB|STAR|DIME|NICKEL)$/.test(b)) return "db";
      if (/^(S|FS|SS)$/.test(b)) return "s";
      return null;
    };
    // How many depth numbers count as "starter" per label. Side-prefixed
    // labels (LDE, RILB) are one-per-side, so they're always depth 1.
    const STARTER_MAX = {
      DE: 2, DT: 2, NT: 1, EDGE: 2, DL: 4,
      OLB: 2, ILB: 2, MLB: 2, LB: 4, WLB: 1, SLB: 1, MIKE: 1, WILL: 1, SAM: 1, JACK: 1, BUCK: 1, MACK: 1,
      CB: 3, NB: 1, NCB: 1, SLOT: 1, DB: 2, STAR: 1, DIME: 1, NICKEL: 1, FS: 1, SS: 1, S: 2,
    };
    const maxFor = (b0) => (b0 !== norm(b0) ? 1 : (STARTER_MAX[b0] ?? 1));
    // Left-to-right ordering inside a row: L-side labels, then the "1" of an
    // edge position (SAM/WILL/OLB1/DE1/CB1), interior, "2" of an edge, R-side.
    const EDGE_BASES = new Set(["DE", "EDGE", "OLB", "CB", "S"]);
    const LEFT_NAMES = new Set(["SAM", "SLB"]), RIGHT_NAMES = new Set(["WILL", "WLB"]);
    // 0 = left edge · 1 = left interior · 2 = middle · 3 = right interior · 4 = right edge
    // So LDE · LDT · RDT · RDE lines up as a real front, not LDT · LDE · RDE · RDT.
    const sideKey = (b0, d) => {
      const b = norm(b0);
      const edge = EDGE_BASES.has(b);
      if (b0 !== b) return b0.startsWith("L") ? (edge ? 0 : 1) : (edge ? 4 : 3);
      if (LEFT_NAMES.has(b)) return 0;
      if (RIGHT_NAMES.has(b)) return 4;
      return edge ? (d <= 1 ? 0 : 4) : 2;
    };
    const rows = { dl: [], lb: [], db: [], s: [] };
    const starters = roster
      .filter((p) => { const b = baseOf(p); return b && ROW_OF(b) && depthNo(p) <= maxFor(b); })
      .sort((a, b) => sideKey(baseOf(a), depthNo(a)) - sideKey(baseOf(b), depthNo(b)) || depthNo(a) - depthNo(b));
    const starterIds = new Set(starters.map((p) => p.id));
    starters.forEach((p) => {
      let who = p, nextUp = false;
      if (outP(p)) {
        // Next man up: same position family first (WLB1 out -> WLB2), then
        // any healthy non-starter in the same row, shallowest depth first.
        const fam = norm(baseOf(p)), row = ROW_OF(baseOf(p));
        const repl = roster
          .filter((q) => !used.has(q.id) && !starterIds.has(q.id) && q.id !== p.id && baseOf(q) && ROW_OF(baseOf(q)) === row && !outP(q))
          .sort((a, b) => (norm(baseOf(a)) === fam ? 0 : 1) - (norm(baseOf(b)) === fam ? 0 : 1) || depthNo(a) - depthNo(b))[0];
        if (repl) { who = repl; nextUp = true; }
      }
      rows[ROW_OF(baseOf(p))].push({ p: who, lbl: baseOf(p), nextUp });
      used.add(who.id);
    });
    // Fallback for rosters without depth labels: fill each row by Position.
    const FALLBACK = { dl: ["DE", "DT", "NT", "EDGE", "DL"], lb: ["LB", "ILB", "OLB", "MLB"], db: ["CB", "NB", "DB"], s: ["S", "FS", "SS"] };
    const MIN_ROW = { dl: 3, lb: 2, db: 2, s: 2 };
    const BASE_ROW = { dl: 4, lb: 3, db: 2, s: 2 };
    for (const r of Object.keys(rows)) {
      if (rows[r].length === 0) {
        roster.filter((p) => !used.has(p.id) && FALLBACK[r].includes(String(p.pos || "").toUpperCase()))
          .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999)).slice(0, BASE_ROW[r])
          .forEach((p) => { rows[r].push({ p, lbl: String(p.pos || "").toUpperCase() }); used.add(p.id); });
      }
      while (rows[r].length < MIN_ROW[r]) rows[r].push({ p: null, lbl: r === "s" ? "S" : r === "db" ? "CB" : r.toUpperCase() });
    }
    // Row geometry mirrors real alignments instead of even columns:
    //   DL hugs the box, LBs sit inside the ends (OLBs wide in a 3-4),
    //   corners pin to the sidelines with the nickel tucked closer to the
    //   line, safeties split the deep middle.
    const XS = {
      dl: { 3: [22, 50, 78], 4: [10, 36.7, 63.3, 90], 5: [10, 30, 50, 70, 90] },
      lb: { 2: [33, 67], 3: [26, 50, 74], 4: [12, 38, 62, 88], 5: [10, 30, 50, 70, 90] },
      s: { 1: [50], 2: [33, 67], 3: [25, 50, 75] },
    };
    const spread = (n, i) => (n === 1 ? 50 : 10 + (80 * i) / (n - 1));
    const xFor = (r, n, i) => (XS[r] && XS[r][n] ? XS[r][n][i] : spread(n, i));
    const Y = { dl: 72, lb: 56, db: 40, s: 24 };
    SLOTS = []; assigned = [];
    // Personnel label from what's actually on the field: "4-3 · Nickel"
    const dbN = rows.db.filter((x) => x.p).length + rows.s.filter((x) => x.p).length;
    formationLabel = `${rows.dl.filter((x) => x.p).length}-${rows.lb.filter((x) => x.p).length}` +
      (dbN >= 7 ? " · Quarter" : dbN >= 6 ? " · Dime" : dbN >= 5 ? " · Nickel" : " · Base");
    for (const r of ["dl", "lb", "db", "s"]) {
      const n = rows[r].length;
      rows[r].forEach((it, i) => {
        let x = xFor(r, n, i), y = Y[r];
        if (r === "db") {
          // corners pinned to the sidelines, interior DBs (nickel/dime)
          // spread between them on the same row — never on top of a LB
          const inner = n - 2;
          if (i === 0) x = 11;
          else if (i === n - 1) x = 89;
          else x = inner === 1 ? 50 : 32 + (36 * (i - 1)) / (inner - 1);
          if (n === 1) x = 50;
        }
        SLOTS.push({ lbl: it.lbl, x, y, nextUp: !!it.nextUp });
        assigned.push(it.p);
      });
    }
  }
  // Sideline: everyone on this side of the ball who didn't crack the 11.
  const sideOf = (p) => {
    const u = unitOf(p);
    if (u === "Offense" || u === "Offensive Line") return "offense";
    if (u === "Defense" || u === "Defensive Line") return "defense";
    const m = lblOf(p).match(/^([A-Z]+)/);
    const b = m ? m[1] : null;
    if (b && (OL_POS.has(b) || ["QB", "RB", "FB", "HB", "WR", "TE"].includes(b))) return "offense";
    if (b && /^[LR]?(DE|DT|NT|EDGE|DL|OLB|ILB|MLB|LB|WLB|SLB|MIKE|WILL|SAM|JACK|BUCK|MACK|CB|NB|NCB|SLOT|DB|STAR|DIME|NICKEL|S|FS|SS)$/.test(b)) return "defense";
    return null;
  };
  // Sideline order: by positional importance (the question a bench answers
  // is "who's behind my starter at X"), then depth number within position.
  // Offense: QB > RB > WR > TE > line. Defense: edge > interior > LB > CB > S.
  const SIDELINE_ORDER = unit === "offense"
    ? ["QB", "RB", "HB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OC", "OL"]
    : ["DE", "LDE", "RDE", "EDGE", "DT", "LDT", "RDT", "NT", "DL", "LB", "ILB", "MLB", "OLB", "LLB", "RLB", "WLB", "SLB", "CB", "LCB", "RCB", "NB", "NCB", "DB", "S", "FS", "SS"];
  const posRank = (p) => {
    const m = lblOf(p).match(/^([A-Z]+)/);
    const base = (m && SIDELINE_ORDER.includes(m[1])) ? m[1] : String(p.pos || "").toUpperCase();
    const i = SIDELINE_ORDER.indexOf(base);
    return i === -1 ? 99 : i;
  };
  const bench = roster
    .filter((p) => !used.has(p.id) && sideOf(p) === unit)
    .sort((a, b) => posRank(a) - posRank(b) || depthNo(a) - depthNo(b) || (b.rating2k ?? -1) - (a.rating2k ?? -1));
  // Ring scheme (no yellow — it collided with the gold 90+ OVR chip):
  //   emerald = Sleeper confirms healthy · orange = Questionable
  //   red = Doubtful · red + faded photo = Out/IR/PUP · slate = no Sleeper data
  return (
    <div className="mt-4">
      {setUnit && <div className="flex gap-2 mb-3">
        {[["offense", "Offense"], ["defense", "Defense"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setUnit(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (unit === k
              ? "text-white"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
            style={unit === k ? { backgroundColor: teamColor(abbr) } : undefined}>
            {lbl}
          </button>
        ))}
      </div>}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
        style={{ paddingBottom: "118%", background: "repeating-linear-gradient(180deg,#1c7c40 0 9%,#166534 9% 18%)" }}>
        {/* subtle top-down light so it reads as turf, not a flat panel */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.10) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0.18) 100%)" }} />
        {/* end zone: team color with painted diagonal texture and big
            stenciled letters — reads like turf paint, not a UI header */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden"
          style={{ height: "9%", background: TEAM_ALT[abbr] || teamColor(abbr) }}>
          <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 10px, transparent 10px 20px)" }} />
          <div className="absolute inset-x-0 top-[18%] h-px bg-white/25" />
          <div className="absolute inset-x-0 bottom-[18%] h-px bg-white/25" />
          {/* painted end-zone lettering: team nickname, outlined like turf paint */}
          <span className="font-black text-[22px] tracking-[0.3em] pl-[0.3em] uppercase select-none"
            style={{ color: teamColor(abbr), WebkitTextStroke: "1px rgba(255,255,255,0.35)", textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 0 14px rgba(0,0,0,0.25)" }}>
            {(team && team.name ? String(team.name).trim().split(" ").pop() : abbr)}
          </span>
        </div>
        <div className="absolute inset-x-0 h-[2.5px] bg-white/90" style={{ top: "9%" }} />
        {/* line rank: frosted tag sitting just below the line it grades —
            under the OL row on offense, under the DL front on defense */}
        {(() => {
          const lr = unit === "offense" ? lineRank?.ol : lineRank?.def;
          if (!lr || lr.rank == null) return null;
          const tierText = lr.rank <= 10 ? "text-emerald-300"
            : lr.rank <= 20 ? "text-yellow-300"
            : "text-rose-300";
          return (
            <span className="absolute right-2 flex items-baseline gap-1 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm"
              style={{ top: unit === "offense" ? "66.5%" : "82.5%" }}>
              {unit === "offense" ? "OL" : "DEF"}
              <span className={"tabular-nums " + tierText}>{ordinal(lr.rank)}</span>
            </span>
          );
        })()}
        {/* faint team logo watermark at midfield */}
        {TEAM_LOGOS[abbr] && (
          <img src={TEAM_LOGOS[abbr]} alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2/5 opacity-[0.09] pointer-events-none select-none" />
        )}
        {/* personnel tag: what's on the field right now */}
        {formationLabel && (
          <span className="absolute left-2 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm" style={{ top: "11%" }}>
            {formationLabel}
          </span>
        )}
        <style>{`@keyframes hrbPop { from { opacity: 0; transform: translate(-50%, -50%) scale(.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } } ${PULSE_CSS}`}</style>
        {/* yard lines (no side numbers — quieter field) */}
        {[16, 24, 32, 40, 48, 56, 64, 72, 80, 88].map((y) => (
          <div key={y} className="absolute inset-x-0 h-px bg-white/45" style={{ top: y + "%" }} />
        ))}
        {/* hash marks */}
        {Array.from({ length: 21 }, (_, i) => 12 + i * 4).map((y) => (
          <React.Fragment key={y}>
            <div className="absolute w-1.5 h-px bg-white/30" style={{ left: "39%", top: y + "%" }} />
            <div className="absolute w-1.5 h-px bg-white/30" style={{ left: "59.5%", top: y + "%" }} />
          </React.Fragment>
        ))}
        {/* sidelines */}
        <div className="absolute inset-y-0 left-0 w-[3px] bg-white/60" />
        <div className="absolute inset-y-0 right-0 w-[3px] bg-white/60" />
        {SLOTS.map((s, i) => {
          const p = assigned[i];
          return (
            <button key={unit + i + (p ? p.id : "")} disabled={!p} onClick={p ? () => onSelectPlayer(p) : undefined}
              className="absolute flex flex-col items-center"
              style={{ left: s.x + "%", top: s.y + "%", transform: "translate(-50%, -50%)", animation: `hrbPop .35s ease-out ${i * 30}ms both` }}>
              <span className="relative">
                {p && photoOf(p, abbr) ? (
                  <img src={photoOf(p, abbr)} alt="" loading="lazy"
                    className={"w-12 h-12 rounded-full object-cover bg-white border-[3px] shadow-md " + ringCls(p)} />
                ) : (
                  <span className={"w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-md border-[3px] " + ringCls(p) + (p ? " bg-white/90 text-slate-700" : " bg-white/20 text-white/70 border-dashed")}>
                    {s.lbl}
                  </span>
                )}
                {/* Layout: position = left-edge tag (quietest info, proven
                    spot), rating = bottom pill (the scan target), number
                    merged into the single name line below. One row of text,
                    nothing above the head. */}
                {p && (
                  <span className="absolute top-1/2 -translate-y-1/2 -left-3 px-1 rounded text-[8px] font-extrabold bg-white/85 text-slate-700 shadow">
                    {s.lbl}
                  </span>
                )}
                {p && p.rating2k != null && (
                  <span className={"absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[9px] font-extrabold tabular-nums shadow " +
                    (Math.round(p.rating2k) >= 90 ? "bg-amber-400 text-slate-900"
                      : Math.round(p.rating2k) >= 85 ? "bg-emerald-500 text-white"
                      : Math.round(p.rating2k) >= 70 ? "bg-slate-900/85 text-white"
                      : "bg-rose-600 text-white")}>
                    {Math.round(p.rating2k)}
                  </span>
                )}
                {p && <HealthBadge p={p} />}
              </span>
              <span className="mt-2 text-[9px] font-bold text-white/95 max-w-[100px] truncate drop-shadow">
                {p ? (() => {
                  const parts = p.name.split(" ");
                  const last = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "")
                    ? parts.slice(-2).join(" ")
                    : parts.slice(-1)[0];
                  const no = cleanNo(p.no);
                  return (no ? "#" + no + " " : "") + last;
                })() : ""}
              </span>
            </button>
          );
        })}
      </div>
      {/* The sideline: everyone on this side of the ball who isn't in the 11.
          Horizontal scroll, best-rated first — depth at a glance without
          stealing space from the formation. */}
      {bench.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-2 pt-2 pb-1">
          <div className="px-1 mb-1.5">
            <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Sideline</div>
            <div className="flex flex-wrap justify-around gap-x-3 gap-y-0.5 mt-1">
              {(() => {
                const counts = {};
                // Group by the Position field from Airtable, shown as its abbreviation
                for (const b of bench) { const k = String(b.pos || "").toUpperCase().trim() || (baseOf(b) && norm(baseOf(b))) || "?"; counts[k] = (counts[k] || 0) + 1; }
                return Object.entries(counts).map(([k, n]) => <span key={k} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{k} ({n})</span>);
              })()}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-y-3 gap-x-1 pt-3 pb-1.5 px-1">
            {bench.map((p) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="flex flex-col items-center min-w-0">
                <span className="relative">
                  {photoOf(p, abbr) ? (
                    <img src={photoOf(p, abbr)} alt="" loading="lazy"
                      className={"w-12 h-12 rounded-full object-cover bg-white border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")} />
                  ) : (
                    <span className={"w-12 h-12 rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}>
                      {String(p.pos || "").toUpperCase() || "—"}
                    </span>
                  )}
                  <HealthBadge p={p} small />
                  {p.rating2k != null && (
                    <span className={"absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded-full text-[8px] font-extrabold tabular-nums shadow " +
                      (Math.round(p.rating2k) >= 90 ? "bg-amber-400 text-slate-900"
                        : Math.round(p.rating2k) >= 85 ? "bg-emerald-500 text-white"
                        : Math.round(p.rating2k) >= 70 ? "bg-slate-900/85 text-white"
                        : "bg-rose-600 text-white")}>
                      {Math.round(p.rating2k)}
                    </span>
                  )}
                </span>
                <span className="mt-2 text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-full truncate">
                  {(() => {
                    const parts = String(p.name).split(" ");
                    const last = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "")
                      ? parts.slice(-2).join(" ")
                      : parts.slice(-1)[0];
                    const no = cleanNo(p.no);
                    return (no ? "#" + no + " " : "") + last;
                  })()}
                </span>
                <span className="text-[8px] font-semibold text-slate-400 uppercase">{p.sortLabel || p.pos || ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {(team && (team.headCoach || team.offCoord || team.defCoord)) && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2.5 grid grid-cols-3 gap-2">
          {[["Head Coach", team.headCoach], ["Off. Coordinator", team.offCoord], ["Def. Coordinator", team.defCoord]].map(([k, v]) => (
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

function injHasFlag(p, team) {
  const inj = injFor(p.name, team);
  return !!(inj && (inj.injury_status || !/^active$/i.test(String(inj.status || ""))));
}
function LiveStatus({ p, team }) {
  return injHasFlag(p, team)
    ? <InjBadge p={p} team={team} />
    : <StatusBadge status={p.status} />;
}

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
const TEAM_NAMES = {};   // abbr -> full name
const TEAM_ALT = {};     // abbr -> alternate color (from ESPN scoreboard)
const INJ_ESPN = {};     // ESPN athlete id -> ESPN injury record (type/location/side/detail/returnDate)
const POS_FULL = { QB: "Quarterback", RB: "Running Back", HB: "Running Back", FB: "Fullback", WR: "Wide Receiver", TE: "Tight End", LT: "Left Tackle", RT: "Right Tackle", OT: "Offensive Tackle", T: "Offensive Tackle", LG: "Left Guard", RG: "Right Guard", G: "Guard", OG: "Guard", C: "Center", OL: "Offensive Line", DE: "Defensive End", LDE: "Defensive End", RDE: "Defensive End", DT: "Defensive Tackle", LDT: "Defensive Tackle", RDT: "Defensive Tackle", NT: "Nose Tackle", EDGE: "Edge Rusher", DL: "Defensive Line", LB: "Linebacker", ILB: "Inside Linebacker", OLB: "Outside Linebacker", MLB: "Middle Linebacker", LOLB: "Outside Linebacker", ROLB: "Outside Linebacker", CB: "Cornerback", LCB: "Cornerback", RCB: "Cornerback", NB: "Nickel Back", DB: "Defensive Back", S: "Safety", FS: "Free Safety", SS: "Strong Safety", K: "Kicker", P: "Punter", LS: "Long Snapper" };
// "Right ankle sprain (Est. return Oct 20)" — ESPN's injury detail for a player, via Sleeper's espn_id
function injuryDetail(p, abbr, deep) {
  const inj = injFor(p.name, abbr);
  const e = inj && inj.espn_id ? INJ_ESPN[String(inj.espn_id)] : null;
  let label = "";
  if (e) {
    const parts = [e.side, e.location, e.detail].filter(Boolean).map((x) => String(x).trim());
    label = parts.join(" ");
    if (!label && e.type) label = e.type;
    if (label.toLowerCase().startsWith("other")) label = e.type || label;
  } else if (inj && (inj.injury_body_part || inj.injury_notes)) {
    label = [inj.injury_body_part, inj.injury_notes].filter(Boolean).join(" ");
  }
  label = label.replace(/\s+/g, " ").trim().toLowerCase();
  // Airtable's "Est Return" wins when ESPN hasn't published a date of its own.
  const raw = p.estReturn || (e && e.returnDate) || (deep && deep.returnDate) || null;
  const ret = raw ? new Date(raw) : null;
  const retTxt = ret && !isNaN(ret) ? ret.toLocaleDateString([], { month: "short", day: "numeric" }).toLowerCase() : null;
  if (!label && !retTxt) return null;
  const inner = [label || "injury", retTxt ? `est. return ${retTxt}` : null].filter(Boolean).join(" · ");
  return { label, retTxt, text: `(${inner})` };
}

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = TEAM_LOGOS[abbr];
  if (logo) {
    return <img src={chipLogo(abbr, logo)} alt={abbr} className="w-8 h-8 rounded-full object-contain p-0.5 shrink-0" style={logoChip(abbr)} />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
// Hub for the Players bottom tab: one place for players, injuries, contracts, draft
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

function PlayersTab({ players, onSelect, pills, forceInj }) {
  const [q, setQ] = useState("");
  const dark = useDark();
  const injOnly = !!forceInj;
  const list = useMemo(
    () => players
      .filter((p) => matchesQuery(p, q))
      .filter((p) => !injOnly || (() => {
        const inj = injFor(p.name, toAbbr(teamOfPlayer(p) || p.teamName || ""));
        return inj && (inj.injury_status || !/^active$/i.test(String(inj.status || "")));
      })()),
    [players, q, injOnly]
  );
  return (
    <div>
      <ListHeader title={<>{injOnly ? "Injury Report" : "Players"} <span className="text-[10px] font-bold text-white/50 align-middle">{NFL_VERSION}</span></>} q={q} setQ={setQ} pills={pills} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 pr-4 pl-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
              style={(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return a ? { borderLeft: `3px solid ${teamInk(a, dark)}${dark ? "66" : "33"}` } : undefined; })()}>
              <span className="w-9 text-center text-[10px] font-extrabold uppercase shrink-0 rounded-md py-1 text-white"
                style={(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return a ? { backgroundColor: teamInk(a, dark) } : { backgroundColor: "#64748b" }; })()}>{p.pos || "—"}</span>
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {cleanNo(p.no) && <span className="text-slate-400 font-semibold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                </span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.height, p.weight, p.age ? p.age + " yrs" : ""].filter(Boolean).join(" · ") || "—"}
                </span>
                {(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); if (!injHasFlag(p, a)) return null; const d = injuryDetail(p, a); return (
                  <span className="flex items-center gap-1.5 mt-1 min-w-0"><InjBadge p={p} team={a} />{d && <span className="text-[11px] font-semibold text-rose-500 truncate">{d.text}</span>}</span>
                ); })()}
              </span>
              <TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} />
            </button>
          ))}
          {list.length === 0 && injOnly && <div className="text-center text-sm text-slate-400 py-12 px-6">No injuries reported right now.</div>}
          {list.length === 0 && !injOnly && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
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
    n >= 90 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"        // superstar
    : n >= 85 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" // great
    : n >= 70 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"          // solid
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300";                    // liability
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

const ROLE_ORDER = ["Offense", "Offensive Line", "Defense", "Defensive Line", "Special Teams"];
// Position -> unit. Position wins over the Role field so an OT always rolls
// up to Offensive Line; Role is the fallback for unknown positions.
const POS_UNIT = {};
for (const p of ["QB", "RB", "FB", "HB", "WR", "TE"]) POS_UNIT[p] = "Offense";
for (const p of ["LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OL"]) POS_UNIT[p] = "Offensive Line";
for (const p of ["DE", "DT", "NT", "EDGE", "DL"]) POS_UNIT[p] = "Defensive Line";
for (const p of ["LB", "ILB", "OLB", "MLB", "CB", "S", "FS", "SS", "DB"]) POS_UNIT[p] = "Defense";
for (const p of ["K", "P", "LS", "KR", "PR"]) POS_UNIT[p] = "Special Teams";
function unitOf(p) {
  const pos = String(p.pos || "").toUpperCase().trim();
  if (POS_UNIT[pos]) return POS_UNIT[pos];
  if (ROLE_ORDER.includes(p.role)) return p.role;
  return "Roster";
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

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
    return c.startsWith("afc") ? "afc" : c.startsWith("nfc") ? "nfc" : "other";
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
  const dark = useDark();
  return (
    <div>
      <div className="px-4 pb-28" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex gap-2 mt-1">
          {[["all", "All"], ["afc", "AFC"], ["nfc", "NFC"]].map(([k, lbl]) => (
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
        <div className="space-y-2 mt-4">
          {list.map((t) => {
            const abbr = t.abbr || toAbbr(t.name);
            const bg = teamInk(abbr, dark);
            // light shells (Chargers powder, Packers gold) need dark type
            const ink = lumOf(bg) > 0.62 ? "#0f172a" : "#ffffff";
            const sub = lumOf(bg) > 0.62 ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.72)";
            return (
              <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-2xl shadow-sm active:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(100deg, ${bg} 0%, ${bg} 62%, ${shade(bg, -14)} 100%)`, color: ink }}>
                {t.logo ? (
                  <img src={chipLogo(abbr, t.logo)} alt="" className="w-11 h-11 rounded-full object-contain p-1 shrink-0" style={logoChip(abbr, true)} />
                ) : (
                  <span className="w-11 h-11 rounded-full shrink-0 bg-white/90" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold truncate">{t.name}</span>
                  <span className="block text-[11px] font-semibold truncate" style={{ color: sub }}>
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division}` : t.division) : "—"}
                  </span>
                </span>
                {(() => { const r = teamRec(t, seasonStarted(teams)); return (r.w + r.l + r.t) >= 0; })() && (
                  <span className="flex gap-2.5 shrink-0">
                    {(() => { const r = teamRec(t, seasonStarted(teams)); return [["W", r.w], ["L", r.l], ...(r.t > 0 ? [["T", r.t]] : [])]; })().map(([lbl, v]) => (
                      <span key={lbl} className="w-7 text-center">
                        <span className="block text-[8px] font-bold uppercase" style={{ color: sub }}>{lbl}</span>
                        <span className="block text-sm font-black tabular-nums">{v}</span>
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
  else if (s.includes("injur") || s.includes("day") || s.includes("question") || s.includes("doubt")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
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

// League-wide OL/DL rankings from Madden OVRs: average of the top-5 offensive
// linemen and top-4 defensive linemen per team (typical starting fronts).
// Needs 3+ rated players to count — thin data shouldn't produce a fake rank.
const OL_POS = new Set(["LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "T", "OC", "OL"]);
const DL_POS = new Set(["DE", "DT", "NT", "EDGE", "DL", "LDE", "RDE", "LDT", "RDT"]);
const DEF_POS = new Set([...DL_POS, "LB", "ILB", "OLB", "MLB", "LOLB", "ROLB", "LLB", "RLB", "WLB", "SLB", "CB", "LCB", "RCB", "NB", "NCB", "SLOT", "DB", "S", "FS", "SS"]);
function computeLineRanks(players, teams) {
  // A player counts toward a line by Position OR by depth label — so an
  // "LDE1" whose Position field says LB still counts as a defensive lineman.
  const baseLabel = (p) => {
    const m = String(p.sortLabel || "").toUpperCase().match(/^([A-Z]+)/);
    return m ? m[1] : null;
  };
  const per = {};
  for (const t of teams || []) {
    const a = t.abbr || toAbbr(t.name);
    if (!a) continue;
    // IDENTICAL matching to TeamDetail's roster — including the full
    // team-name fallback. Without it, teams whose players only match by
    // name (e.g. Buffalo) render a formation but compute no line rank.
    const roster = players.filter((p) => {
      if (p.teamId && p.teamId === t.id) return true;
      const tm = teamOfPlayer(p);
      return tm && (tm === a || String(p.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
    });
    const avgTop = (posSet, n, min = 3) => {
      // Injury-aware: a starter on IR/OUT doesn't count toward the unit's grade,
      // so a team that loses its 95-OVR corner sees its DEF rank drop.
      const rated = roster
        .filter((p) => (posSet.has(String(p.pos || "").toUpperCase()) || posSet.has(baseLabel(p))) && p.rating2k != null && !injIsOut(injFor(p.name, a)))
        .map((p) => Number(p.rating2k))
        .sort((x, y) => y - x)
        .slice(0, n);
      return rated.length >= min ? rated.reduce((s, v) => s + v, 0) / rated.length : null;
    };
    // def = whole defense: top-11 rated defenders, needs 7+ to count.
    // Scheme-agnostic on purpose — a 3-4 and a 4-3 team compare fairly.
    per[a] = { ol: { avg: avgTop(OL_POS, 5) }, dl: { avg: avgTop(DL_POS, 4) }, def: { avg: avgTop(DEF_POS, 11, 7) } };
  }
  for (const key of ["ol", "dl", "def"]) {
    const ranked = Object.entries(per)
      .filter(([, v]) => v[key].avg != null)
      .sort((x, y) => y[1][key].avg - x[1][key].avg);
    ranked.forEach(([a], i) => { per[a][key].rank = i + 1; });
  }
  return per;
}

// ── Team Stats: Leaders (with trend arrows) · Volume (carry/target share bars) · Defense ──
function playerSeasonRow(p, seasonStats) {
  if (!seasonStats || !seasonStats.players) return null;
  const nm = hrbNrmSafe(p.name), abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  const c = Object.values(seasonStats.players).filter((q) => hrbNrmSafe(q.name) === nm);
  return (c.length > 1 ? c.find((q) => injTeamEq(q.team, abbr)) || c[0] : c[0]) || null;
}
// ▲ / ▼ / → : last 3 games vs season average for a per-game stat
function TrendArrow({ row, k }) {
  if (!row || !row.games || row.games.length < 2) return null;
  const g = row.games, last = g.slice(-3), avg = row.perGame[k] || 0;
  const recent = last.reduce((a, x) => a + (x[k] || 0), 0) / last.length;
  if (!avg && !recent) return null;
  const r = avg ? recent / avg : 2;
  const up = r >= 1.15, down = r <= 0.85;
  return <span className={"text-[10px] font-extrabold " + (up ? "text-emerald-500" : down ? "text-rose-500" : "text-slate-400")}>{up ? "▲" : down ? "▼" : "→"}</span>;
}
function TeamStatsPanel({ roster, abbr, seasonStats, mode, setMode, onSelectPlayer }) {
  const rows = roster.map((p) => ({ p, s: playerSeasonRow(p, seasonStats) })).filter((x) => x.s && x.s.totals && x.s.totals.gp);
  const yr = seasonStats ? seasonStats.season : "";
  const Bar = ({ label, sub, pct, val, arrow, color, onClick }) => (
    <button onClick={onClick} className="w-full text-left py-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">{label}{arrow}<span className="text-slate-400 font-medium">{sub}</span></span>
        <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200 ml-2 shrink-0">{val}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: Math.max(2, Math.min(100, pct)) + "%", backgroundColor: color }} />
      </div>
    </button>
  );
  const Section = ({ title, children }) => (
    <div className="mt-4">
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-1.5 px-1">{title}</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
  const color = teamColor(abbr);
  const sumBy = (k) => rows.reduce((a, x) => a + (x.s.totals[k] || 0), 0);
  const empty = <div className="text-center text-xs text-slate-400 py-10">No {yr} box-score stats for this roster yet.</div>;
  return (
    <>
      <div className="flex gap-2 mt-4">
        {[["leaders", "Leaders"], ["volume", "Volume"], ["defense", "Defense"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setMode(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-bold " + (mode === k ? "text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
            style={mode === k ? { backgroundColor: color } : undefined}>{lbl}</button>
        ))}
      </div>
      {!rows.length ? empty : mode === "leaders" ? (() => {
        const top = (k, n = 5) => rows.filter((x) => (x.s.totals[k] || 0) > 0).sort((a, b) => b.s.totals[k] - a.s.totals[k]).slice(0, n);
        const block = (title, k, unit, pgKey) => {
          const list = top(k); if (!list.length) return null;
          const max = list[0].s.totals[k];
          return (
            <Section key={title} title={title}>
              {list.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k={pgKey || k} />} pct={(s.totals[k] / max) * 100} val={s.totals[k] + unit} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
          );
        };
        return (
          <>
            {block(yr + " Rushing Yards", "rushYds", " yds", "rushYds")}
            {block(yr + " Receiving Yards", "recYds", " yds", "recYds")}
            {block(yr + " Touchdowns", "td", " TD", "recTd")}
            {block(yr + " Targets", "tgt", "", "tgt")}
            {block(yr + " Tackles", "tkl", "", "tkl")}
            {block(yr + " Sacks", "sacks", "", "sacks")}
            <div className="text-[9px] text-slate-400 mt-2 px-1">▲ ▼ = last 3 games vs season average (up 15%+ / down 15%+)</div>
          </>
        );
      })() : mode === "volume" ? (() => {
        const carries = sumBy("car"), targets = sumBy("tgt");
        const rush = rows.filter((x) => (x.s.totals.car || 0) > 0).sort((a, b) => b.s.totals.car - a.s.totals.car).slice(0, 8);
        const rec = rows.filter((x) => (x.s.totals.tgt || 0) > 0).sort((a, b) => b.s.totals.tgt - a.s.totals.tgt).slice(0, 10);
        return (
          <>
            <Section title={yr + " Rushing · carry share"}>
              {rush.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k="car" />} pct={(s.totals.car / Math.max(1, carries)) * 100} val={Math.round((s.totals.car / Math.max(1, carries)) * 100) + "% · " + s.totals.car + " car"} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
            <Section title={yr + " Receiving · target share"}>
              {rec.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k="tgt" />} pct={(s.totals.tgt / Math.max(1, targets)) * 100} val={Math.round((s.totals.tgt / Math.max(1, targets)) * 100) + "% · " + s.totals.tgt + " tgt"} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
          </>
        );
      })() : (() => {
        const block = (title, k, n = 8) => {
          const list = rows.filter((x) => (x.s.totals[k] || 0) > 0).sort((a, b) => b.s.totals[k] - a.s.totals[k]).slice(0, n);
          if (!list.length) return null;
          const max = list[0].s.totals[k];
          return (
            <Section key={title} title={title}>
              {list.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k={k} />} pct={(s.totals[k] / max) * 100} val={String(s.totals[k])} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
          );
        };
        return (
          <>
            {block(yr + " Tackles", "tkl")}
            {block(yr + " Sacks", "sacks", 6)}
            {block(yr + " Interceptions", "defInt", 6)}
            {block(yr + " Passes Defended", "pd", 6)}
            {block(yr + " Tackles for Loss", "tfl", 6)}
          </>
        );
      })()}
    </>
  );
}

function TeamDetail({ team, teams, players, onBack, onSelectPlayer, seasonStats, onSwitchTeam }) {
  useEffect(() => { window.scrollTo(0, 0); }, [team.id]);
  const alpha = useMemo(() => [...(teams || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))), [teams]);
  const idx = alpha.findIndex((t) => t.id === team.id);
  const swipe = useSwipe({
    onLeft: () => idx !== -1 && idx < alpha.length - 1 && onSwitchTeam && onSwitchTeam(alpha[idx + 1]),
    onRight: () => idx > 0 && onSwitchTeam && onSwitchTeam(alpha[idx - 1]),
  });
  const abbr = team.abbr || toAbbr(team.name);
  const [seg, setSeg] = useState("roster");
  // Inside Roster: "list" (full roster), "offense" or "defense" (formation)
  const [rosterView, setRosterView] = useState("list");
  const unit = rosterView === "list" ? null : rosterView;
  const lineRanks = useMemo(() => computeLineRanks(players, teams), [players, teams]);
  const [roleFilter, setRoleFilter] = useState(null);
  const [chartMode, setChartMode] = useState("leaders");
  const [capSeason, setCapSeason] = useState(null);
  const roster = players.filter((p) => {
    if (p.teamId && p.teamId === team.id) return true; // exact Airtable link - no naming needed
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);
  const dark = useDark();
  const ink = teamInk(abbr, dark);            // readable on the current theme
  const tint = (a) => ink + a;                // team-tinted fill
  const fill = LOGO_BG[abbr] || teamColor(abbr);  // big filled areas: the real shade

  // Offense absorbs the offensive line, Defense absorbs the defensive line;
  // Special Teams stays its own section for when that depth chart is filled in.
  const SECTION_OF = { "Offense": "Offense", "Offensive Line": "Offense", "Defense": "Defense", "Defensive Line": "Defense", "Special Teams": "Special Teams" };
  const groups = {};
  for (const p of roster) {
    const role = SECTION_OF[unitOf(p)] || "Roster";
    (groups[role] ??= []).push(p);
  }
  const orderedRoles = [...["Offense", "Defense", "Special Teams"].filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: fill, paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Teams</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={chipLogo(abbr, team.logo)} alt="" className="w-16 h-16 rounded-full object-contain p-1.5 shrink-0" style={logoChip(abbr, true)} />
          ) : (
            <span className="text-3xl">🏈</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">
              {team.name}
              {(() => {
                // Record lives next to the name now (freed the tile up top).
                // teamRec already drops the tie unless there is one.
                const r = teamRec(team, seasonStarted(teams));
                return (r.w + r.l + r.t) > 0
                  ? <span className="ml-2 text-base font-bold opacity-80 tabular-nums align-middle">({r.str})</span>
                  : null;
              })()}
            </div>
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
        <div className={"grid gap-2 " + (seg === "roster" && unit ? "grid-cols-4" : "grid-cols-3")}>
          {(() => {
            const started = seasonStarted(teams);
            // Live points: box scores (including in-progress games) beat the
            // season feed, which only updates after games go final.
            const pts = (() => {
              const base = teamPts(team, started);
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              if (bx && bx[1] && (bx[1].pf != null || bx[1].pa != null)) return { pf: bx[1].pf ?? base.pf, pa: bx[1].pa ?? base.pa };
              return base;
            })();
            const sx = team.stx || {}; // per-team stats merged from /api/standings
            // Rank line under each stat: top 10 green, 11-20 yellow, bottom 12 red.
            // (Passed as {label, cls} — the format Tile's sub actually renders;
            // a JSX element here silently displays nothing, which is why ranks
            // were invisible before.)
            const tLog = (() => {
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              return bx && bx[1] ? bx[1].log : null;
            })();
            const rk = (rank) => rank == null ? null : {
              label: ordinal(rank),
              cls: rank <= 10 ? "text-green-600 dark:text-green-400"
                : rank <= 20 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-500 dark:text-red-400",
            };
            if (seg === "roster" && unit === "offense") {
              return (
                <>
                  <Tile compact trend={trendOf(tLog, "offPassYds", false)} value={sx.offPassYpg != null ? sx.offPassYpg.toFixed(1) : "—"} label="Pass Yds" sub={rk(sx.offPassYpgRank)} />
                  <Tile compact trend={trendOf(tLog, "offPassTd", false)} value={sx.offPassTd != null ? sx.offPassTd : "—"} label="Pass TD" sub={rk(sx.offPassTdRank)} />
                  <Tile compact trend={trendOf(tLog, "offRushYds", false)} value={sx.offRushYpg != null ? sx.offRushYpg.toFixed(1) : "—"} label="Rush Yds" sub={rk(sx.offRushYpgRank)} />
                  <Tile compact trend={trendOf(tLog, "offRushTd", false)} value={sx.offRushTd != null ? sx.offRushTd : "—"} label="Rush TD" sub={rk(sx.offRushTdRank)} />
                </>
              );
            }
            if (seg === "roster" && unit === "defense") {
              return (
                <>
                  <Tile compact trend={trendOf(tLog, "defPassYds", true)} value={sx.defPassYpg != null ? sx.defPassYpg.toFixed(1) : "—"} label="Pass Yds" sub={rk(sx.defPassYpgRank)} />
                  <Tile compact trend={trendOf(tLog, "defPassTd", true)} value={sx.defPassTd != null ? sx.defPassTd : "—"} label="Pass TD" sub={rk(sx.defPassTdRank)} />
                  <Tile compact trend={trendOf(tLog, "defRushYds", true)} value={sx.defRushYpg != null ? sx.defRushYpg.toFixed(1) : "—"} label="Rush Yds" sub={rk(sx.defRushYpgRank)} />
                  <Tile compact trend={trendOf(tLog, "defRushTd", true)} value={sx.defRushTd != null ? sx.defRushTd : "—"} label="Rush TD" sub={rk(sx.defRushTdRank)} />
                </>
              );
            }
            if (seg === "charts" && (chartMode === "volume" || chartMode === "defense")) {
              // Team volume / defense totals from the box-score players, ranked across the league
              const agg = {};
              for (const P of Object.values((seasonStats && seasonStats.players) || {})) {
                const a = (agg[P.team] ??= { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0, tfl: 0 });
                a.passAtt += P.totals.att || 0; a.rushAtt += P.totals.car || 0; a.sacks += P.totals.sacks || 0; a.defInt += P.totals.defInt || 0; a.tfl += P.totals.tfl || 0;
              }
              const mineKey = Object.keys(agg).find((k) => injTeamEq(k, abbr));
              const mine = mineKey ? agg[mineKey] : null;
              const rankOf = (get) => {
                if (!mine) return null;
                const vals = Object.values(agg).map(get).sort((a, b) => b - a);
                return vals.indexOf(get(mine)) + 1;
              };
              const passRate = (a) => (a.passAtt + a.rushAtt ? a.passAtt / (a.passAtt + a.rushAtt) : 0);
              if (chartMode === "volume") return (
                <>
                  <Tile value={mine ? mine.passAtt : "—"} label="Pass Att" sub={rk(rankOf((a) => a.passAtt))} />
                  <Tile value={mine ? mine.rushAtt : "—"} label="Rush Att" sub={rk(rankOf((a) => a.rushAtt))} />
                  <Tile value={mine ? Math.round(passRate(mine) * 100) + "%" : "—"} label="Pass Rate" sub={rk(rankOf(passRate))} />
                </>
              );
              return (
                <>
                  <Tile value={mine ? mine.sacks : "—"} label="Sacks" sub={rk(rankOf((a) => a.sacks))} />
                  <Tile value={mine ? mine.defInt : "—"} label="INT" sub={rk(rankOf((a) => a.defInt))} />
                  <Tile value={mine ? mine.tfl : "—"} label="TFL" sub={rk(rankOf((a) => a.tfl))} />
                </>
              );
            }
            if (seg === "contracts") {
              const fa = roster.filter((p) => { const e = nextEvent(p); return e && (e.kind === "UFA" || e.kind === "RFA"); }).length;
              const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
              const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
              // Rank every team's average age: 1st = youngest, 32nd = oldest
              const teamAvg = (t) => {
                const ab = t.abbr || toAbbr(t.name);
                const rs = players.filter((q) => (q.teamId && q.teamId === t.id) || teamOfPlayer(q) === ab || String(q.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
                const as = rs.map((q) => Number(q.age)).filter((a) => a > 0);
                return as.length >= 5 ? as.reduce((a, b) => a + b, 0) / as.length : null;
              };
              const ageRanked = teams.map((t) => [t.id, teamAvg(t)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
              const ageRank = ageRanked.findIndex(([id]) => id === team.id) + 1;
              const ageCls = ageRank ? (ageRank <= 10 ? "text-green-600 dark:text-green-400" : ageRank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400") : null;
              return (
                <>
                  <Tile value={payroll ? fmtM(payroll) : "—"} label="Payroll" sub={roster.length + " players"} />
                  <Tile value={fa} label="Free Agents" sub={"next offseason"} />
                  <Tile value={avgAge != null ? avgAge.toFixed(1) : "—"} label="Avg Age" sub={ageRank ? { label: ordinal(ageRank) + (ageRank <= 3 ? " youngest" : ageRank >= ageRanked.length - 2 ? " oldest" : ""), cls: ageCls } : null} />
                </>
              );
            }
            const diff = pts.pf != null && pts.pa != null ? Math.round(pts.pf - pts.pa) : null;
            // League ranks for the three headline numbers. Same value = same rank,
            // flagged as a tie, exactly like the player boards.
            const allPts = teams.map((t) => {
              const ab = t.abbr || toAbbr(t.name);
              const base = teamPts(t, started);
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, ab)) : null;
              const pf = bx && bx[1] && bx[1].pf != null ? bx[1].pf : base.pf;
              const pa = bx && bx[1] && bx[1].pa != null ? bx[1].pa : base.pa;
              return { pf, pa, d: pf != null && pa != null ? pf - pa : null };
            });
            const rankIn = (vals, mine, asc) => {
              if (mine == null) return null;
              const v = vals.filter((x) => x != null).sort((a, b) => (asc ? a - b : b - a));
              const r = v.indexOf(mine) + 1;
              return r ? { rank: r, tie: v.filter((x) => x === mine).length > 1 } : null;
            };
            // scoring: most is best. allowed: fewest is best. differential: most is best.
            const rkT = (o) => o == null ? null : {
              label: ordinal(o.rank) + (o.tie ? " (tie)" : ""),
              cls: o.rank <= 10 ? "text-green-600 dark:text-green-400" : o.rank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400",
            };
            const tlog = (() => {
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              return bx && bx[1] ? bx[1].log : null;
            })();
            const pfRank = rankIn(allPts.map((x) => x.pf), pts.pf, false);
            const paRank = rankIn(allPts.map((x) => x.pa), pts.pa, true);
            const dRank = rankIn(allPts.map((x) => x.d), pts.pf != null && pts.pa != null ? pts.pf - pts.pa : null, false);
            return (
              <>
                <Tile tint={ink} trend={trendOf(tlog, "pf", false)} value={pts.pf != null ? Math.round(pts.pf) : "—"} label="Points Scored" sub={rkT(pfRank)} />
                <Tile tint={ink} trend={trendOf(tlog, "pa", true)} value={pts.pa != null ? Math.round(pts.pa) : "—"} label="Points Allowed" sub={rkT(paRank)} />
                <Tile tint={ink} value={diff != null ? (diff > 0 ? "+" + diff : String(diff)) : "—"} label="Point Diff" sub={rkT(dRank)}
                  valueClass={diff == null ? null : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-red-600 dark:text-red-400" : null} />
              </>
            );
          })()}
        </div>

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["contracts", "Contracts"], ["charts", "Stats"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? "text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: ink } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "roster" && (
          <div className="flex gap-2 mt-3">
            {[["offense", "Offense"], ["defense", "Defense"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setRosterView(rosterView === k ? "list" : k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold transition-colors " + (rosterView === k
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={rosterView === k ? { backgroundColor: ink } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && unit && <FormationView roster={roster} abbr={abbr} unit={unit} onSelectPlayer={onSelectPlayer} lineRank={lineRanks[abbr]} team={team} />}
        {seg === "roster" && !unit && orderedRoles.map((role) => (
          <div key={role}>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(() => {
                const sorted = groups[role].slice().sort((a, b) => {
                  if (a.sort != null && b.sort != null) return a.sort - b.sort;
                  if (a.sort != null) return -1;
                  if (b.sort != null) return 1;
                  return currentSalary(b) - currentSalary(a);
                });
                const starters = sorted.filter(isStarter);
                const BENCH_ORDER = ["QB", "RB", "HB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OL", "DE", "LDE", "RDE", "EDGE", "DT", "LDT", "RDT", "NT", "DL", "LB", "ILB", "OLB", "MLB", "LOLB", "ROLB", "CB", "LCB", "RCB", "NB", "DB", "S", "FS", "SS", "K", "P", "LS"];
                const benchKey = (p) => {
                  const m = String(p.sortLabel || "").toUpperCase().match(/^([A-Z]+)(\d*)$/);
                  const base = m ? m[1] : String(p.pos || "").toUpperCase();
                  const i = BENCH_ORDER.indexOf(base);
                  return [i === -1 ? 99 : i, m && m[2] ? Number(m[2]) : 99];
                };
                const bench = sorted.filter((p) => !isStarter(p)).sort((a, b) => { const ka = benchKey(a), kb = benchKey(b); return ka[0] - kb[0] || ka[1] - kb[1]; });
                // No Starters/Bench headers — the depth-chart label already says
                // WR3 or RB2, so the split would just be telling you twice.
                return [...starters, ...bench];
              })()
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 pr-4 pl-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                    style={{ borderLeft: `3px solid ${tint(dark ? "66" : "33")}` }}>
                    <span className="w-9 text-center text-[10px] font-extrabold uppercase shrink-0 rounded-md py-1 text-white"
                      style={{ backgroundColor: ink }}>{p.sortLabel || p.pos || "—"}</span>
                    <Avatar p={p} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cleanNo(p.no) && <span className="text-slate-400 font-semibold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                      </span>
                      {/* row 2: injury tag on the left, per-game tiles on the right */}
                      <span className="flex items-center gap-2 mt-1.5">
                        <span className="min-w-0 flex-1 self-center"><LiveStatus p={p} team={abbr} /></span>
                        {(() => {
                          const grp = posGroup(p.pos), S = playerSeasonRow(p, seasonStats);
                          if (!grp) return null;
                          const G = S && S.totals && S.totals.gp ? S.perGame : null;
                          return (
                            <span className="flex gap-1 shrink-0 items-stretch">
                              {STAT_TILES[grp].map(([lbl, k]) => (
                                // fixed height + no label wrap, so "RUSH YDS" can't push its
                                // number a line lower than the tiles beside it
                                <span key={k} className="w-[52px] h-[38px] flex flex-col items-stretch justify-start rounded-md border overflow-hidden"
                                  style={{ backgroundColor: tint(dark ? "24" : "14"), borderColor: tint(dark ? "59" : "33") }}>
                                  <span className="block text-[7px] font-extrabold tracking-wide uppercase leading-none whitespace-nowrap text-white text-center py-[3px]" style={{ backgroundColor: ink }}>{lbl}</span>
                                  <span className="flex-1 flex items-center justify-center text-[13px] font-extrabold tabular-nums text-slate-800 dark:text-slate-100 leading-none">{G && G[k] != null ? G[k] : "—"}</span>
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </span>
                      {/* row 3: the detailed note, directly under the tag, nothing blocking it */}
                      {(() => { const d = injHasFlag(p, abbr) ? injuryDetail(p, abbr) : null; return d ? <span className="block text-[11px] font-semibold text-rose-500 mt-1">{d.text}</span> : (p.injuryNotes ? <span className="block text-[11px] font-semibold text-red-500 mt-1 lowercase">({p.injuryNotes})</span> : null); })()}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {seg === "contracts" && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Team Contracts</span>
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

        {seg === "charts" && <TeamStatsPanel roster={roster} abbr={abbr} seasonStats={seasonStats} mode={chartMode} setMode={setChartMode} onSelectPlayer={onSelectPlayer} />}

        {seg === "roster" && !unit && roster.length === 0 && (
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
  // fall back to the pick number: 32 picks per round, 7 rounds
  const pk = pickOf(p);
  if (pk !== 999) return Math.min(7, Math.ceil(pk / 32));
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
  { key: "passYds", label: "PASS" },
  { key: "rushYds", label: "RUSH" },
  { key: "recYds", label: "REC" },
  { key: "td", label: "TD" },
  { key: "tkl", label: "TKL" },
  { key: "sck", label: "SCK" },
  { key: "ints", label: "INT" },
];

// ═══════════════ STATS: league leaders from the box-score pipeline ═══
// Standard PPR fantasy scoring
const fantasyPts = (T) => (T.passYds || 0) / 25 + (T.passTd || 0) * 4 - (T.int || 0) * 2 + (T.rushYds || 0) / 10 + (T.rushTd || 0) * 6 + (T.rec || 0) + (T.recYds || 0) / 10 + (T.recTd || 0) * 6;
const LEADER_CATS = [
  { id: "passing", label: "Passing", positions: null, stats: [["passYds", "Yards"], ["passTd", "TD"], ["cmp", "Cmp"], ["att", "Att"], ["int", "INT"]] },
  { id: "rushing", label: "Rushing", positions: ["QB", "RB", "WR"], stats: [["rushYds", "Yards"], ["rushTd", "TD"], ["car", "Carries"], ["ypcar", "Y/Car"]] },
  { id: "receiving", label: "Receiving", positions: ["WR", "TE", "RB"], stats: [["recYds", "Yards"], ["recTd", "TD"], ["rec", "Rec"], ["tgt", "Targets"]] },
  { id: "defense", label: "Defense", positions: null, stats: [["tkl", "Tackles"], ["sacks", "Sacks"], ["defInt", "INT"], ["tfl", "TFL"], ["pd", "PD"]] },
  { id: "fantasy", label: "Fantasy", positions: ["QB", "RB", "WR", "TE"], stats: [["fpts", "Points"]] },
  { id: "teams", label: "Teams", positions: null, stats: [["passRate", "Pass Rate"], ["passAtt", "Pass Att"], ["rushAtt", "Rush Att"], ["ppg", "Points/G"], ["papg", "Pts Allowed"], ["ydsFor", "Yards/G"], ["ydsAgainst", "Yds Allowed"], ["sacks", "Sacks"], ["takeaways", "Takeaways"]] },
];
// Team-level rows built from the same box-score pipeline the player stats use
function teamLeaderRows(seasonStats, key) {
  const T = (seasonStats && seasonStats.teams) || {};
  const players = Object.values((seasonStats && seasonStats.players) || {});
  const vol = {};
  for (const P of players) {
    const a = (vol[P.team] ??= { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0 });
    a.passAtt += P.totals.att || 0; a.rushAtt += P.totals.car || 0; a.sacks += P.totals.sacks || 0; a.defInt += P.totals.defInt || 0;
  }
  const rows = Object.entries(T).map(([abbr, t]) => {
    const v = vol[abbr] || { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0 };
    const gp = t.games || 1;
    const plays = v.passAtt + v.rushAtt;
    return { abbr, gp, val: {
      passRate: plays ? (v.passAtt / plays) * 100 : 0,
      passAtt: v.passAtt, rushAtt: v.rushAtt,
      ppg: (t.pf || 0) / gp, papg: (t.pa || 0) / gp,
      ydsFor: ((t.off?.passYds || 0) + (t.off?.rushYds || 0)) / gp,
      ydsAgainst: ((t.def?.passYds || 0) + (t.def?.rushYds || 0)) / gp,
      sacks: v.sacks, takeaways: v.defInt,
    } };
  });
  // fewer is better for points and yards allowed
  const asc = key === "papg" || key === "ydsAgainst";
  return rows.filter((r) => r.val[key] > 0).sort((a, b) => (asc ? a.val[key] - b.val[key] : b.val[key] - a.val[key]));
}
function StatsTab({ players, onSelect, seasonStats, jump, onJumpUsed }) {
  const [catId, setCatId] = useState("passing");
  const [statKey, setStatKey] = useState(null);
  const [posPick, setPosPick] = useState("ALL");
  const [hilite, setHilite] = useState(null);   // normalized name of the row we jumped to
  const rowRef = useRef(null);
  // A tap on a player-page stat lands here: switch the board to that stat and
  // position group, then scroll his row into the middle of the screen.
  useEffect(() => {
    if (!jump) return;
    const j = STAT_JUMP[jump.key];
    if (!j) return;
    setCatId(j[0]); setStatKey(j[1]);
    const c = LEADER_CATS.find((x) => x.id === j[0]);
    setPosPick(c && c.positions && c.positions.includes(jump.pos) ? jump.pos : "ALL");
    setHilite(hrbNrmSafe(jump.name));
    onJumpUsed && onJumpUsed();
  }, [jump]);
  useEffect(() => {
    if (!hilite || !rowRef.current) return;
    const t = setTimeout(() => rowRef.current && rowRef.current.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [hilite, catId, statKey, posPick]);
  const cat = LEADER_CATS.find((c) => c.id === catId);
  const key = statKey && cat.stats.some(([k]) => k === statKey) ? statKey : cat.stats[0][0];
  const teamRows = useMemo(() => (cat.id === "teams" ? teamLeaderRows(seasonStats, key) : []), [seasonStats, catId, key]);
  const rows = useMemo(() => {
    if (cat.id === "teams") return [];
    const all = Object.values((seasonStats && seasonStats.players) || {});
    const grp = (P) => posGroup(P.pos);
    const inCat = (P) => {
      const g = grp(P);
      if (cat.id === "passing") return g === "QB";
      if (cat.id === "defense") return g === "DEF";
      if (cat.id === "fantasy") return ["QB", "RB", "WR", "TE"].includes(g) && (posPick === "ALL" || g === posPick);
      return ["QB", "RB", "WR", "TE"].includes(g) && (posPick === "ALL" || g === posPick);
    };
    const val = (P) => (key === "fpts" ? fantasyPts(P.totals) : (P.totals[key] || 0));
    const sorted = all.filter((P) => P.totals && P.totals.gp && inCat(P) && val(P) > 0)
      .map((P) => ({ P, v: val(P) }))
      .sort((a, b) => b.v - a.v);
    // ranks are shared: same value, same number, flagged as a tie
    let lastV = null, lastR = 0;
    sorted.forEach((row, i) => {
      if (row.v !== lastV) { lastR = i + 1; lastV = row.v; }
      row.rank = lastR;
    });
    for (const row of sorted) row.tie = sorted.filter((o) => o.v === row.v).length > 1;
    // if we jumped to a player outside the top 50, extend the list far enough to show him
    const hi = sorted.findIndex((r) => hrbNrmSafe(r.P.name) === hilite);
    return sorted.slice(0, Math.max(50, hi + 1));
  }, [seasonStats, catId, key, posPick, hilite]);
  const yr = seasonStats ? seasonStats.season : "";
  const findP = (P) => players.find((p) => hrbNrmSafe(p.name) === hrbNrmSafe(P.name));
  const statLabel = cat.stats.find(([k]) => k === key)?.[1] || key;
  const fmt = (v) => (key === "fpts" || key === "ypcar" ? Number(v).toFixed(1) : v);
  return (
    <div>
      <div className="bg-blue-600 pb-3 px-4 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2"><h1 className="text-xl font-extrabold">Leaders</h1><span className="text-[11px] font-semibold text-blue-200">{yr}{seasonStats && seasonStats.weeksWithGames ? ` · thru Wk ${seasonStats.weeksWithGames}` : ""}</span></div>
        <div className="flex gap-1.5 mt-3">
          {LEADER_CATS.map((c) => (
            <button key={c.id} onClick={() => { setCatId(c.id); setStatKey(null); setPosPick("ALL"); setHilite(null); }}
              className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (catId === c.id ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100")}>{c.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {cat.stats.map(([k, lbl]) => (
            <button key={k} onClick={() => setStatKey(k)}
              className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (key === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{lbl}</button>
          ))}
        </div>
        {cat.positions && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["ALL", ...cat.positions].map((k) => (
              <button key={k} onClick={() => setPosPick(k)}
                className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (posPick === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{k === "ALL" ? "All" : k}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 pt-3">
        {!seasonStats && <Loader label="Loading leaders" />}
        {seasonStats && catId === "teams" && (
          teamRows.length === 0 ? <div className="text-center text-xs text-slate-400 py-10">No {yr} team stats yet.</div> : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Team</span>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{statLabel}{key === "papg" || key === "ydsAgainst" ? " · fewest first" : ""}</span>
              </div>
              {teamRows.map((r, i) => {
                const pct = key === "passRate";
                const v = pct || ["ppg", "papg", "ydsFor", "ydsAgainst"].includes(key) ? r.val[key].toFixed(1) : Math.round(r.val[key]);
                return (
                  <div key={r.abbr} className="px-3 py-2 flex items-center gap-2.5">
                    <div className={"w-6 text-center text-[13px] font-black tabular-nums " + (i < 3 ? "text-blue-600" : "text-slate-400")}>{i + 1}</div>
                    {TEAM_LOGOS[r.abbr] && <img src={chipLogo(r.abbr)} alt="" className="w-8 h-8 rounded-full object-contain p-0.5 shrink-0" style={logoChip(r.abbr)} />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-slate-900 dark:text-white">{TEAM_NAMES[r.abbr] || r.abbr}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: Math.max(3, (r.val[key] / (teamRows[0].val[key] || 1)) * 100) + "%", backgroundColor: teamColorSafe(r.abbr) }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-none">{v}{pct ? "%" : ""}</div>
                      <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{r.gp} GP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
        {seasonStats && catId !== "teams" && rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {yr} stats yet for this filter.</div>}
        {rows.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Player</span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{statLabel}{key !== "fpts" && key !== "ypcar" ? " · per game" : ""}</span>
            </div>
            {rows.map(({ P, v, rank, tie }, i) => {
              const p = findP(P);
              const pg = P.totals.gp ? v / P.totals.gp : null;
              const on = hilite && hrbNrmSafe(P.name) === hilite;
              return (
                <button key={P.id} ref={on ? rowRef : undefined} onClick={p ? () => onSelect(p) : undefined}
                  className={"w-full text-left pr-3 py-2 flex items-center gap-2.5 active:bg-slate-50 dark:active:bg-slate-800/60 " + (on ? "bg-slate-200/80 dark:bg-slate-700/60" : "")}>
                  <div className="self-stretch w-1 rounded-r" style={{ backgroundColor: teamColor(P.team) }} />
                  <div className={"w-8 text-center shrink-0 " + ((rank || i + 1) <= 3 ? "text-blue-600" : "text-slate-400")}>
                    <div className="text-[13px] font-black tabular-nums leading-none">{rank || i + 1}</div>
                    {tie && <div className="text-[7px] font-bold lowercase tracking-wide opacity-70">tie</div>}
                  </div>
                  <img src={`https://a.espncdn.com/i/headshots/nfl/players/full/${P.id}.png`} alt="" className="w-10 h-10 rounded-full object-cover object-top bg-white shrink-0 ring-2 ring-white dark:ring-slate-800 shadow" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{P.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">{TEAM_LOGOS[P.team] && <img src={chipLogo(P.team)} alt="" className="w-3.5 h-3.5 rounded-full object-contain p-px" style={logoChip(P.team)} onError={(e) => { e.currentTarget.src = TEAM_LOGOS[P.team] || ""; }} />}<span className="text-[10px] font-semibold text-slate-400">{P.team}</span></div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-none">{fmt(v)}</div>
                    {pg != null && key !== "ypcar" && <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{(key === "fpts" ? pg.toFixed(1) : Number.isInteger(pg) ? pg : pg.toFixed(1))}/g</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="text-[9px] text-slate-400 mt-2 px-1">{catId === "teams" ? "Pass rate = pass attempts ÷ total plays — the quickest read on an offense's identity. " : ""}{catId === "fantasy" ? "PPR scoring: 1 pt per 25 pass yds · 4 per pass TD · −2 per INT · 1 per 10 rush/rec yds · 6 per rush/rec TD · 1 per catch. " : ""}Every box score this season, including games in progress. Tap a player in your Airtable to open his page.</div>
      </div>
    </div>
  );
}

// ═══════════════ TD BOARD ════════════════════════════════════════
// Weekly anytime-TD board. Each card is "player vs this week's defense":
//   rank · headshot · POS Name · [opp logo] vs OPP
//   ROLE | OPP vs POS: TD/G · YDS/G | TD SHARE · IMP TOTAL |  big TD%
// Real data only — if the endpoint isn't live, the tab says so plainly.
// Rank colors on the opponent tiles: high rank number = defense allows a
// lot to this position = good for the scorer (green).
const rankTile = (rank) => (rank == null ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
  : rank >= 23 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
  : rank >= 11 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  : "bg-rose-500/15 text-rose-600 dark:text-rose-400");
const valTile = (val, good, ok) => (val == null ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
  : val >= good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
  : val >= ok ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  : "bg-rose-500/15 text-rose-600 dark:text-rose-400");

function TdBoardTab({ players, teams, onSelect }) {
  const [board, setBoard] = useState(null);
  const [sb, setSb] = useState(null);
  const [seg, setSeg] = useState("matchups");
  const [digestWeek, setDigestWeek] = useState(null);
  const [selGame, setSelGame] = useState(null);
  const [digest, setDigest] = useState(null);       // { week, stats, games }
  const [history, setHistory] = useState(null);
  const [bet, setBet] = useState("ml"); // ml | td | props
  const [nextSb, setNextSb] = useState(null); // next week's board, for lines once this week ends
  const season = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  useEffect(() => {
    if (seg !== "digest") return;
    const w = digestWeek ?? (sb?.week ?? 1);
    let alive = true;
    setDigest(null);
    Promise.all([
      fetch(`/api/week-stats?season=${season}&week=${w}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/scoreboard?week=${w}`).then((r) => r.json()).catch(() => null),
    ]).then(([stats, games]) => { if (alive) setDigest({ week: w, stats, games }); });
    return () => { alive = false; };
  }, [seg, digestWeek, sb?.week]);
  // Lines disappear from a game once it's final, so when the slate is done we
  // pull the following week to keep the Moneyline tab useful.
  useEffect(() => {
    if (!sb || !sb.games || !sb.games.length) return;
    const allDone = sb.games.every((g) => g.state === "post");
    if (!allDone || nextSb) return;
    fetch(`/api/scoreboard?week=${(sb.week || 1) + 1}`).then((r) => r.json()).then((d) => { if (d && d.games) setNextSb(d); }).catch(() => {});
  }, [sb, nextSb]);
  useEffect(() => {
    if (history) return;
    fetch(`/api/td?mode=history&season=${season}`).then((r) => r.json()).then(setHistory).catch(() => setHistory({ weeks: [], error: "unreachable" }));
  }, []);
  useEffect(() => {
    fetch("/api/td").then((r) => r.json()).then(setBoard).catch(() => setBoard({ ready: false, cards: [], reason: "Couldn't reach the board endpoint." }));
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/scoreboard").then((r) => r.json()).then((d) => { if (alive && d && d.games) setSb(d); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const live = board && board.ready;
  const cards = live ? board.cards : [];
  const findPlayer = (c) => players.find((p) => hrbNrmSafe(p.name) === hrbNrmSafe(c.name));
  const week = sb?.week ?? board?.week ?? 1;
  // Live games first (two-minute drills at the very top), then upcoming by
  // kickoff, finals at the bottom. Day labels ride inside each section.
  const isTwoMin = (g) => { if (g.state !== "in") return false; const [m, sec] = String(g.clock || "").split(":").map(Number); return (g.period === 2 || g.period === 4) && Number.isFinite(m) && m * 60 + (sec || 0) <= 120; };
  const gamesByDay = useMemo(() => {
    const games = [...(sb?.games || [])];
    const bucket = (g) => (g.state === "in" ? 0 : g.state === "pre" ? 1 : 2);
    games.sort((a, b) => bucket(a) - bucket(b) || (isTwoMin(b) ? 1 : 0) - (isTwoMin(a) ? 1 : 0) || new Date(a.date) - new Date(b.date));
    const out = [];
    for (const g of games) {
      const b = bucket(g);
      const day = new Date(g.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
      const key = b === 0 ? "● Live" : b === 2 ? "Final · " + day : day;
      let grp = out.find((x) => x.key === key);
      if (!grp) { grp = { key, live: b === 0, games: [] }; out.push(grp); }
      grp.games.push(g);
    }
    return out;
  }, [sb]);

  if (selGame) {
    const order = gamesByDay.flatMap((grp) => grp.games);
    const i = order.findIndex((x) => x.id === selGame.id);
    return <GameDetail game={selGame} onBack={() => setSelGame(null)}
      onPrev={i > 0 ? () => setSelGame(order[i - 1]) : null} onNext={i !== -1 && i < order.length - 1 ? () => setSelGame(order[i + 1]) : null}
      index={i + 1} total={order.length} />;
  }
  return (
    <div>
      <style>{`@keyframes hrbBlink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }`}</style>
      <div className="bg-blue-600 pb-3 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl font-extrabold text-white">{seg === "matchups" ? "Matchups" : seg === "digest" ? "Digest" : "Bets"} <span className="text-blue-200">(Wk {seg === "digest" ? (digestWeek ?? week) : week})</span> <span className="text-[10px] font-bold text-white/60 align-middle">{NFL_VERSION}</span></h1>
          <span className="text-[11px] font-semibold text-blue-200">
            {seg === "matchups"
              ? (sb ? "scores " + new Date(sb.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " ↻" : "loading…")
              : (live ? "v1 · " + new Date(board.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "v1")}
          </span>
        </div>
      </div>
      <div className="px-4 pt-3">
        <div className="flex gap-2 mb-3">
          {[["matchups", "Matchups"], ["digest", "Digest"], ["bets", "Bets"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-1.5 rounded-full text-xs font-bold " + (seg === k ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "matchups" ? (
          <>
            {!sb && <Loader label="Loading games" />}
            {sb && sb.games.length === 0 && <div className="p-6 text-center text-xs text-slate-400">No games scheduled this week.</div>}
            {gamesByDay.map((grp) => (
              <div key={grp.key} className="mb-4">
                <div className={"text-[10px] font-semibold tracking-widest uppercase mb-1.5 " + (grp.live ? "text-rose-500" : "text-slate-400")}>{grp.key}</div>
                <div className="space-y-1.5">
                  {grp.games.map((g) => (
                    <MatchCard key={g.id} g={g} onClick={() => setSelGame(g)} />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : seg === "digest" ? (() => {
          const wk = digestWeek ?? week;
          const weeksList = Array.from({ length: Math.max(1, sb?.week ?? 1) }, (_, i) => i + 1);
          const st = digest && digest.stats, gm = digest && digest.games;
          const plist = st && st.players ? Object.values(st.players) : [];
          const top = (k, n = 8) => plist.map((p) => ({ p, v: p.games.reduce((a, g) => a + (g[k] || 0), 0), g: p.games[0] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, n);
          const tdList = plist.map((p) => ({ p, v: p.games.reduce((a, g) => a + (g.rushTd || 0) + (g.recTd || 0), 0), g: p.games[0] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
          const teamsArr = st && st.teams ? Object.entries(st.teams) : [];
          const defWorst = teamsArr.map(([a, t]) => ({ a, y: (t.def.passYds || 0) + (t.def.rushYds || 0), pa: t.pa })).sort((x, y) => y.y - x.y).slice(0, 5);
          const defBest = teamsArr.map(([a, t]) => ({ a, y: (t.def.passYds || 0) + (t.def.rushYds || 0), pa: t.pa })).sort((x, y) => x.y - y.y).slice(0, 5);
          const Row = ({ x, val }) => (
            <div className="flex items-center gap-2 py-1.5 text-[12px]">
              {TEAM_LOGOS[x.p.team] && <img src={chipLogo(x.p.team)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(x.p.team)} />}
              <span className="flex-1 truncate font-bold text-slate-800 dark:text-slate-100">{x.p.name}<span className="text-slate-400 font-medium"> {x.p.pos || ""} · {x.p.team}{x.g ? " vs " + x.g.opp : ""}</span></span>
              <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{val}</span>
            </div>
          );
          const Card = ({ title, children }) => (
            <div className="mb-3">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">{title}</div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
            </div>
          );
          return (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" }}>
                {weeksList.map((w) => (
                  <button key={w} onClick={() => setDigestWeek(w)}
                    className={"shrink-0 px-3 py-1 rounded-full text-[11px] font-bold " + (wk === w ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>Wk {w}</button>
                ))}
              </div>
              {!digest && <div className="p-6 text-center text-xs text-slate-400">Building the Week {wk} digest…</div>}
              {digest && (!st || !st.gamesFinal) && <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">No finished games in Week {wk} yet — the digest fills in as games go final.</div>}
              {digest && st && st.gamesFinal > 0 && (
                <>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{st.gamesFinal} of {st.gamesScheduled} games final.</div>
                  {gm && gm.games && (
                    <div className="mb-3">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Scores</div>
                      <div className="space-y-1.5">
                        {gm.games.filter((g) => g.state !== "pre").map((g) => <MatchCard key={g.id} g={g} onClick={() => setSelGame(g)} />)}
                      </div>
                    </div>
                  )}
                  <Card title="Touchdown scorers">{tdList.map((x) => <Row key={x.p.id} x={x} val={x.v + " TD"} />)}</Card>
                  <Card title="Most targets">{top("tgt").map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Most carries">{top("car").map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Passing yards">{top("passYds", 6).map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Defenses that got gashed · total yds allowed">
                    {defWorst.map((d) => <div key={d.a} className="flex items-center justify-between py-1.5 text-[12px]"><span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{TEAM_LOGOS[d.a] && <img src={chipLogo(d.a)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(d.a)} />}{d.a}</span><span className="font-extrabold tabular-nums text-rose-500">{d.y} yds · {d.pa} pts</span></div>)}
                  </Card>
                  <Card title="Defenses that shut it down">
                    {defBest.map((d) => <div key={d.a} className="flex items-center justify-between py-1.5 text-[12px]"><span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{TEAM_LOGOS[d.a] && <img src={chipLogo(d.a)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(d.a)} />}{d.a}</span><span className="font-extrabold tabular-nums text-emerald-500">{d.y} yds · {d.pa} pts</span></div>)}
                  </Card>
                </>
              )}
            </>
          );
        })() : (
          <>
            <div className="flex gap-2 mb-3">
              {[["ml", "Moneyline"], ["td", "Touchdowns"], ["props", "Props"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setBet(k)}
                  className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (bet === k ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>{lbl}</button>
              ))}
            </div>
            {bet === "ml" && (() => {
              // American odds -> implied win probability (vig included)
              const prob = (ml) => (ml == null ? null : ml < 0 ? (-ml) / (-ml + 100) : 100 / (ml + 100));
              const withOdds = (d) => (d?.games || []).filter((g) => g.odds && (g.odds.homeML != null || g.odds.awayML != null || g.odds.details));
              const thisWk = withOdds(sb), nextWk = withOdds(nextSb);
              const useNext = thisWk.filter((g) => g.state !== "post").length === 0 && nextWk.length > 0;
              const games = useNext ? nextWk : thisWk;
              const shownWeek = useNext ? (nextSb.week || (sb.week || 1) + 1) : (sb?.week || week);
              if (!sb) return <Loader label="Loading lines" />;
              if (!games.length) return <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">No lines posted yet — books usually hang the next week's numbers by Monday night.</div>;
              const fmtML = (ml) => (ml == null ? "—" : ml > 0 ? "+" + ml : String(ml));
              return (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[9px] font-semibold tracking-widest uppercase text-slate-400"><span>Week {shownWeek}</span><span className="w-12 text-right">ML</span><span className="w-10 text-right">Win%</span><span className="w-12 text-right">Spread</span></div>
                  {games.map((g) => {
                    const o = g.odds; const pa = prob(o.awayML), ph = prob(o.homeML);
                    const norm = pa != null && ph != null ? pa + ph : null;
                    const Row = ({ t, ml, p, fav }) => (
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-1">
                        <span className="flex items-center gap-2 min-w-0">{TEAM_LOGOS[t.abbr] && <img src={chipLogo(t.abbr, t.logo)} alt="" className="w-6 h-6 rounded-full object-contain p-0.5" style={logoChip(t.abbr)} />}<span className={"text-[12px] font-extrabold truncate " + (g.state === "post" ? (t.winner ? "text-emerald-600" : "text-slate-400") : "text-slate-900 dark:text-white")}>{t.abbr}</span>{g.state === "post" && <span className="text-[11px] font-bold tabular-nums text-slate-500">{t.score}</span>}</span>
                        <span className={"w-12 text-right text-[12px] font-extrabold tabular-nums " + (ml != null && ml < 0 ? "text-slate-900 dark:text-white" : "text-slate-500")}>{fmtML(ml)}</span>
                        <span className="w-10 text-right text-[11px] font-bold tabular-nums text-slate-500">{p != null ? Math.round((norm ? p / norm : p) * 100) + "%" : "—"}</span>
                        <span className="w-12 text-right text-[11px] font-bold tabular-nums text-slate-500">{fav && o.spread != null ? (o.spread > 0 ? "-" + o.spread : String(o.spread)) : ""}</span>
                      </div>
                    );
                    return (
                      <button key={g.id} onClick={() => setSelGame(g)} className="w-full text-left px-3 py-2 active:bg-slate-50 dark:active:bg-slate-800/60">
                        <Row t={g.away} ml={o.awayML} p={pa} fav={o.awayFav} />
                        <Row t={g.home} ml={o.homeML} p={ph} fav={o.homeFav} />
                        <div className="text-[9px] text-slate-400 mt-1 flex justify-between"><span>{new Date(g.date).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}{g.state === "in" ? " · LIVE" : g.state === "post" ? " · Final" : ""}</span><span>{o.details}{o.overUnder != null ? ` · O/U ${o.overUnder}` : ""}</span></div>
                      </button>
                    );
                  })}
                  <div className="px-3 py-2 text-[9px] text-slate-400">Win% is the market's implied probability from the moneyline, with the vig removed. Lines from ESPN; they move until kickoff.</div>
                </div>
              );
            })()}
            {bet === "props" && <PropsBoard />}
            {bet === "td" && (() => {
              // Once the Thursday-morning snapshot exists for this week, the board is
              // LOCKED to it —
              // graded against what's happened so far. The live recompute only shows pre-lock.
              const locked = history && history.weeks ? history.weeks.find((w) => w.week === week) : null;
              if (locked) {
                const hits = locked.picks.filter((p) => p.hit).length, played = locked.picks.filter((p) => p.hit != null).length;
                return (
                  <>
                    <div className="mb-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 flex items-center justify-between">
                      <div><div className="text-[10px] font-extrabold tracking-widest uppercase">Week {week} board · locked</div><div className="text-[10px] opacity-70">Snapshotted before kickoff — this is what gets graded.</div></div>
                      <div className="text-right"><div className="text-lg font-black tabular-nums leading-none">{hits}<span className="text-xs opacity-60">/{played}</span></div><div className="text-[9px] opacity-70">hit · {locked.expected} exp.</div></div>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {locked.picks.map((p) => (
                        <div key={p.rank + p.player} className={"px-3 py-2 flex items-center gap-2 " + (p.hit ? "bg-emerald-50/60 dark:bg-emerald-900/10" : "")}>
                          <span className="w-5 text-xs font-extrabold text-slate-400 tabular-nums">{p.rank}</span>
                          <div className="flex-1 min-w-0"><div className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">{p.player}</div><div className="text-[9px] text-slate-400">{p.team} vs {p.opp}{p.tds != null ? ` · ${p.tds} TD` : p.played ? "" : " · not yet played"}</div></div>
                          <span className="text-[11px] font-bold tabular-nums text-slate-500">{Math.round((p.tdPct || 0) * 100)}%</span>
                          <span className={"w-5 text-center text-base font-black " + (p.hit == null ? "text-slate-300" : p.hit ? "text-emerald-500" : "text-rose-400")}>{p.hit == null ? "·" : p.hit ? "✓" : "✗"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              }
              return null;
            })()}
            {bet === "td" && !(history && history.weeks && history.weeks.find((w) => w.week === week)) && (
              <>
                {!board && <div className="p-6 text-center text-xs text-slate-400">Building this week's board…</div>}
            {board && !live && (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Board isn't live yet</div>
                <div className="text-[11px] text-slate-400 mt-1">{board.reason || "The data source didn't return player stats."} Nothing is shown rather than guessed numbers.</div>
              </div>
            )}
            {live && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {cards.map((c, i) => {
                  const p = findPlayer(c);
                  const pct = Math.round((c.tdPct || 0) * 100);
                  return (
                    <button key={c.sleeperId || c.name + i} onClick={p ? () => onSelect(p) : undefined}
                      className="w-full text-left px-3 py-2 active:bg-slate-50 dark:active:bg-slate-800/60">
                      {/* row 1: rank · headshot · POS Name · vs OPP */}
                      <div className="flex items-center gap-2">
                        <div className="w-4 text-xs font-extrabold text-slate-400 tabular-nums">{i + 1}</div>
                        {p ? <Avatar p={p} size="sm" /> : <img src={c.headshot} alt="" className="w-9 h-9 rounded-full object-cover object-top bg-white" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                        {TEAM_LOGOS[c.team] && <img src={chipLogo(c.team)} alt="" className="w-5 h-5 rounded-full object-contain p-px shrink-0" style={logoChip(c.team)} />}
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">
                            {c.name}
                            {c.injury && <span className="ml-2 text-[9px] font-extrabold uppercase text-rose-500">{c.injury}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {TEAM_LOGOS[c.opp] && <img src={chipLogo(c.opp)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(c.opp)} />}
                          <span>{(c.home ? "vs " : "@ ") + c.opp}</span>
                        </div>
                      </div>
                      {/* row 2: role | opponent vs position | player | TD% */}
                      <div className="mt-1.5 flex items-end gap-1.5">
                        <div className="w-9 text-center shrink-0">
                          <div className="text-[7px] font-semibold text-slate-400 tracking-wider">ROLE</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">{c.role || c.pos}</div>
                        </div>
                        <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                        <div className="flex-1 grid grid-cols-4 gap-1.5">
                          {[
                            [c.opp + " TD/G vs " + c.pos, c.oppTdAllowedPg != null ? c.oppTdAllowedPg.toFixed(1) : "—", rankTile(c.oppTdRank), c.oppTdRank ? ordinal(c.oppTdRank) : ""],
                            [c.opp + " YDS/G vs " + c.pos, c.oppYdsAllowedPg != null ? c.oppYdsAllowedPg : "—", rankTile(c.oppYdsRank), c.oppYdsRank ? ordinal(c.oppYdsRank) : ""],
                            ["TD SHARE", c.tdShare != null ? Math.round(c.tdShare * 100) + "%" : "—", valTile(c.tdShare, 0.22, 0.14), c.tdsLastSeason != null ? c.tdsLastSeason + " TD '" + String(board.baseSeason).slice(2) : ""],
                            ["IMP TOTAL", c.implTotal != null ? c.implTotal.toFixed(1) : "—", valTile(c.implTotal, 24, 20), c.spread != null ? (c.spread > 0 ? "+" + c.spread : String(c.spread)) : ""],
                          ].map(([lbl, val, cls, sub]) => (
                            <div key={lbl} className="text-center min-w-0">
                              <div className="text-[7px] font-semibold text-slate-400 tracking-wider truncate">{lbl}</div>
                              <div className={"mt-0.5 rounded-md py-0.5 text-[11px] font-extrabold tabular-nums " + cls}>{val}</div>
                              <div className="text-[8px] font-semibold text-slate-400 tabular-nums h-3">{sub}</div>
                            </div>
                          ))}
                        </div>
                        <div className="w-12 text-right shrink-0 pb-3">
                          <div className="text-[8px] font-semibold text-slate-400 tracking-wider">TD%</div>
                          <div className={"text-lg font-extrabold tabular-nums " + (pct >= 50 ? "text-emerald-500" : pct >= 35 ? "text-amber-500" : "text-slate-500")}>{pct}%</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* how it's scored — one summary, not a sentence per player */}
            <div className="mt-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">How the board is scored</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 leading-snug">
                <div><b>Opponent vs position</b> — TDs and yards this defense allowed per game to RBs / WRs / TEs last season, ranked 1st (toughest) to 32nd (softest). Green = soft matchup.</div>
                <div><b>TD share</b> — the slice of his team's touchdowns he scored last season. Blends toward this season 12% per week.</div>
                <div><b>Imp total</b> — points Vegas expects his team to score this week (from the spread and over/under). More points, more touchdowns to go around.</div>
                <div><b>TD%</b> — expected touchdowns = (imp total × 0.105) × share × matchup, converted to the chance of at least one. That's the ranking.</div>
                <div className="text-slate-400">Out / IR players and teams that already played this week are excluded. Locks Thursday morning, before Thursday night kickoff; that snapshot is what History grades.</div>
              </div>
            </div>
              </>
            )}
            {bet === "td" && history && !history.error && history.weeks.filter((w) => w.week !== week).length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Past weeks</div>
                {history.weeks.filter((w) => w.week !== week).map((w) => (
                  <div key={w.week} className="mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-3 py-2 flex items-baseline justify-between border-b border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Week {w.week} <span className="text-slate-400 font-semibold">· {w.picks.length} picks</span></div>
                      {w.n > 0 && <div className="text-[11px] font-bold tabular-nums"><span className={w.hits >= w.expected ? "text-emerald-500" : "text-amber-500"}>{w.hits} hit</span> <span className="text-slate-400">/ {w.expected} expected</span></div>}
                    </div>
                    {w.n > 0 && (
                      <div className="px-3 py-1.5 flex gap-1.5">
                        {w.buckets.map((b) => (
                          <div key={b.range} className="flex-1 text-center rounded-md bg-slate-50 dark:bg-slate-800 py-1">
                            <div className="text-[8px] text-slate-400 font-semibold">{b.range}</div>
                            <div className="text-[11px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{b.n ? `${b.hits}/${b.n}` : "—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
// ═══════════════ MATCH CARD (RedZone-style) — used by Matchups and Digest ═══
function gameTwoMin(g) {
  if (g.state !== "in") return false;
  const [m, sec] = String(g.clock || "").split(":").map(Number);
  return (g.period === 2 || g.period === 4) && Number.isFinite(m) && m * 60 + (sec || 0) <= 120;
}
function MatchCard({ g, onClick }) {
  const isLive = g.state === "in", isFinal = g.state === "post", twoMin = gameTwoMin(g);
  const kickoff = new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const hasBall = (t) => isLive && g.possession && String(g.possession) === String(t.id);
  const lost = (t) => isFinal && !t.winner;
  // Deepen a pale shell (Chargers powder, Packers gold) so white type holds up
  const deep = (c) => { const l = lumOf(c || "#334155"); return l > 0.55 ? shade(c, -(l * 100 - 42)) : c; };
  const awayC = deep(g.away.color || teamColorSafe(g.away.abbr));
  const homeC = deep(g.home.color || teamColorSafe(g.home.abbr));
  const cardBg = { backgroundImage: `linear-gradient(100deg, ${awayC} 0%, ${awayC} 38%, ${shade(awayC, -12)} 47%, ${shade(homeC, -12)} 53%, ${homeC} 62%, ${homeC} 100%)` };
  const Side = ({ t }) => (
    <div className="flex flex-col items-center w-16 shrink-0">
      <img src={chipLogo(t.abbr, t.logo)} alt="" className={"w-12 h-12 rounded-full object-contain p-1 " + (lost(t) ? "opacity-50" : "")} style={logoChip(t.abbr, true)} />
      <div className={"mt-1 text-[12px] font-extrabold tracking-wide " + (lost(t) ? "text-white/50" : "text-white")}>{t.abbr}</div>
      {t.record && <div className="text-[9px] font-semibold text-white/70 tabular-nums leading-none">{t.record}</div>}
    </div>
  );
  const Score = ({ t }) => (
    <div className={"w-12 text-center text-[30px] leading-none font-black tabular-nums drop-shadow " + (lost(t) ? "text-white/55" : "text-white")}>{g.state === "pre" ? "" : (t.score ?? 0)}</div>
  );
  // possession arrow points at the team with the ball, RedZone-style
  const Arrow = ({ dir, on }) => <span className={"w-3 text-[11px] font-black " + (on ? "text-rose-500" : "text-transparent")} style={on ? { animation: "hrbBlink 1.4s ease-in-out infinite" } : undefined}>{dir}</span>;
  return (
    <button onClick={onClick} style={cardBg}
      className={"w-full text-left rounded-xl shadow-sm px-2 py-2.5 active:opacity-90 border overflow-hidden " + (isLive && g.redZone ? "border-rose-400 ring-1 ring-rose-400/70" : "border-black/20 dark:border-white/10")}>
      <div className="flex items-center justify-between">
        <Side t={g.away} />
        <Score t={g.away} />
        <div className="flex-1 flex flex-col items-center px-0.5">
          <div className="flex items-center gap-1">
            <Arrow dir="◀" on={hasBall(g.away)} />
            {isLive ? (
              <div className={"rounded-lg px-2.5 py-1 text-center " + (twoMin ? "bg-rose-600 text-white" : "bg-black/45 text-white backdrop-blur-sm")}>
                <div className="text-[13px] font-black tabular-nums leading-none">{g.clock || ""}</div>
                <div className="text-[9px] font-extrabold tracking-widest uppercase mt-0.5">{g.period > 4 ? "OT" : g.period ? ordinal(g.period) + " QTR" : ""}</div>
              </div>
            ) : isFinal ? (
              <div className="rounded-lg px-2.5 py-1.5 bg-black/40 text-[11px] font-black tracking-widest uppercase text-white/90">Final</div>
            ) : (
              <div className="text-center">
                <div className="text-[13px] font-extrabold tabular-nums text-white leading-none drop-shadow">{kickoff}</div>
                {g.broadcast && <div className="text-[9px] font-semibold text-white/75 mt-0.5">{g.broadcast}</div>}
              </div>
            )}
            <Arrow dir="▶" on={hasBall(g.home)} />
          </div>
          {g.odds && (g.odds.details || g.odds.overUnder != null) && !isFinal && !isLive && (
            <div className="text-[9px] font-semibold text-white/80 mt-1 tabular-nums text-center">{g.odds.details}{g.odds.overUnder != null ? ` · O/U ${g.odds.overUnder}` : ""}</div>
          )}
        </div>
        <Score t={g.home} />
        <Side t={g.home} />
      </div>
      {isLive && (g.downDistance || g.spot) && (
        <div className={"mt-1 text-center text-[11px] font-extrabold tracking-widest uppercase " + (g.redZone ? "text-rose-200" : "text-white/90")}>
          {[g.downDistance, g.spot].filter(Boolean).join("  |  ")}{g.redZone ? "  ·  RED ZONE" : ""}
        </div>
      )}
    </button>
  );
}

// Real helmet shells — a team's helmet is NOT always its primary color
// (Buffalo, Arizona, Indianapolis, Miami and the Chargers all wear white).
// [shell, facemask]
// [shell, facemask, centre stripe] — a helmet is often not the team's primary
// colour, and the crown stripe is usually a third colour again (Buffalo: white
// shell, white mask, red stripe).
const HELMET_KIT = {
  ARI: ["#ffffff", "#97233F", "#97233F"], ATL: ["#0b0b0d", "#0b0b0d", "#A71930"], BAL: ["#12100f", "#12100f", "#241773"],
  BUF: ["#ffffff", "#f2f4f7", "#C60C30"], CAR: ["#101214", "#101214", "#0085CA"], CHI: ["#0B162A", "#8d9298", "#C83803"],
  CIN: ["#FB4F14", "#111214", "#111214"], CLE: ["#FF3C00", "#d7dade", "#311D00"], DAL: ["#b9bfc6", "#9aa1a9", "#003594"],
  DEN: ["#0C2340", "#FA4616", "#FA4616"], DET: ["#b8c2cb", "#0076B6", "#0076B6"], GB: ["#d5b43c", "#8d9298", "#203731"],
  HOU: ["#03202F", "#03202F", "#A71930"], IND: ["#ffffff", "#a7adb5", "#002C5F"], JAX: ["#101214", "#9F792C", "#9F792C"],
  KC: ["#E31837", "#f2f4f7", "#FFB81C"], LV: ["#c3c8ce", "#0b0b0d", "#0b0b0d"], LAC: ["#ffffff", "#0080C6", "#FFC20E"],
  LAR: ["#003594", "#f2f4f7", "#FFA300"], MIA: ["#ffffff", "#008E97", "#008E97"], MIN: ["#4F2683", "#dfe3e8", "#FFC62F"],
  NE: ["#c3c8ce", "#C60C30", "#002244"], NO: ["#101214", "#9F8958", "#9F8958"], NYG: ["#0B2265", "#a7adb5", "#A71930"],
  NYJ: ["#115740", "#115740", "#ffffff"], PHI: ["#1A4E42", "#9aa1a9", "#A5ACAF"], PIT: ["#101214", "#9aa1a9", "#FFB612"],
  SF: ["#B3995D", "#f2f4f7", "#AA0000"], SEA: ["#002244", "#002244", "#69BE28"], TB: ["#5b6770", "#5b6770", "#D50A0A"],
  TEN: ["#0C2340", "#f2f4f7", "#4B92DB"], WSH: ["#5A1414", "#FFB612", "#FFB612"], WAS: ["#5A1414", "#FFB612", "#FFB612"],
};
// Side profile of a modern shell: rounded crown, front rim, an open face with the
// facemask cage bridging it, jaw flap and ear hole. Facing right; flip mirrors it.
function Helmet({ abbr, logo, color, alt, flip, size = 128, style, onClick }) {
  const uid = `${String(abbr).replace(/\W/g, "")}-${flip ? "r" : "l"}`;
  const kit = HELMET_KIT[abbr] || [color || teamColor(abbr) || "#334155", alt || TEAM_ALT[abbr] || "#e5e7eb"];
  const shell = kit[0], mask = kit[1], stripe = kit[2] || alt || TEAM_ALT[abbr] || null;
  const darkShell = lumOf(shell) < 0.42;
  const SHELL = "M30 96 C20 62 40 28 74 17 C108 6 146 20 156 50 C160 62 158 74 152 84 C146 96 138 104 128 110 C118 116 104 118 90 116 C64 112 40 110 30 96 Z";
  const JAW = "M104 108 C118 108 130 104 138 98 C142 112 140 124 132 132 C120 138 106 138 96 132 C100 124 103 116 104 108 Z";
  return (
    <svg viewBox="0 0 200 170" width={size} height={size * 170 / 200} style={style} onClick={onClick} className={onClick ? "cursor-pointer" : undefined}>
      <defs>
        <clipPath id={`clip-${uid}`}><path d={SHELL} /></clipPath>
        <linearGradient id={`paint-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="62%" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="88%" stopColor="#000000" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
        </linearGradient>
        <radialGradient id={`gloss-${uid}`} cx="0.35" cy="0.22" r="0.42">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" /><stop offset="65%" stopColor="#fff" stopOpacity="0.12" /><stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`face-${uid}`} cx="0.35" cy="0.4" r="0.8">
          <stop offset="0%" stopColor="#4a3b2e" /><stop offset="55%" stopColor="#241c16" /><stop offset="100%" stopColor="#0b0908" />
        </radialGradient>
        <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="35%" stopColor={mask} /><stop offset="78%" stopColor={mask} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </linearGradient>
        <filter id={`halo-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor={darkShell ? "#ffffff" : "#000000"} floodOpacity={darkShell ? 0.85 : 0.22} />
        </filter>
        <filter id={`drop-${uid}`} x="-30%" y="-30%" width="170%" height="175%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#drop-${uid})`} transform={flip ? "translate(200,0) scale(-1,1)" : undefined}>
        {/* the open face: drawn first, the shell covers all but the front crescent */}
        <path d="M148 62 C168 66 182 82 180 100 C178 118 162 130 142 134 C126 137 116 130 114 118 L114 78 C120 68 134 59 148 62 Z" fill={`url(#face-${uid})`} />
        {/* shell */}
        <path d={SHELL} fill={shell} />
        <path d={SHELL} fill={`url(#paint-${uid})`} />
        {/* centre stripe over the crown — in profile you see it as a band along
            the top ridge, with a thin liner either side */}
        {stripe && (
          <g clipPath={`url(#clip-${uid})`}>
            <path d="M40 60 C58 30 96 14 130 20 C146 23 156 32 160 44" fill="none" stroke={stripe} strokeWidth="13" strokeLinecap="round" opacity="0.95" />
            <path d="M40 60 C58 30 96 14 130 20 C146 23 156 32 160 44" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" transform="translate(0,-6.5)" />
            <path d="M40 60 C58 30 96 14 130 20 C146 23 156 32 160 44" fill="none" stroke="#000000" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" transform="translate(0,6.5)" />
          </g>
        )}
        {logo && (
          <g clipPath={`url(#clip-${uid})`}>
            {/* decal sits on the flat of the side panel, above the ear hole. It is
                NOT counter-flipped: on a left-facing shell the mark faces left too,
                exactly as a real decal is mirrored on the opposite side. */}
            <image href={darkShell ? (darkLogo(abbr) || logo) : logo} x="56" y="30" width="82" height="52" preserveAspectRatio="xMidYMid meet"
              filter={`url(#halo-${uid})`} onError={(e) => { if (e.currentTarget.getAttribute("href") !== logo) e.currentTarget.setAttribute("href", logo); }} />
          </g>
        )}
        <g clipPath={`url(#clip-${uid})`}>
          <ellipse cx="80" cy="34" rx="34" ry="13" fill={`url(#gloss-${uid})`} />
          <ellipse cx="126" cy="30" rx="14" ry="5" fill="#fff" opacity="0.4" />
          <path d="M31 92 C24 60 44 30 76 20" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" />
          <path d="M34 104 C58 114 92 116 120 108" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="10" />
        </g>
        <path d={SHELL} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2.5" strokeLinejoin="round" />
        {/* jaw flap + ear hole */}
        <path d={JAW} fill={shell} />
        <path d={JAW} fill="rgba(0,0,0,0.3)" />
        <path d={JAW} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="86" cy="86" r="12" fill="rgba(0,0,0,0.45)" />
        <circle cx="86" cy="86" r="9" fill="#0a0d12" />
        <circle cx="86" cy="86" r="9" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" />
        {/* facemask cage: dark backing bars, then the painted bars on top */}
        <g fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="9" strokeLinecap="round">
          <path d="M150 70 C174 76 188 92 183 110 C178 126 160 136 138 136" />
          <path d="M126 96 C146 92 166 94 181 100" />
          <path d="M129 116 C148 114 166 116 180 113" />
          <path d="M170 80 C177 94 177 112 170 126" />
        </g>
        <g fill="none" stroke={`url(#bar-${uid})`} strokeWidth="6" strokeLinecap="round">
          <path d="M150 70 C174 76 188 92 183 110 C178 126 160 136 138 136" />
          <path d="M126 96 C146 92 166 94 181 100" />
          <path d="M129 116 C148 114 166 116 180 113" />
          <path d="M170 80 C177 94 177 112 170 126" />
        </g>
        <g fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round">
          <path d="M151 68 C174 74 187 90 182 108" />
          <path d="M127 94 C147 90 166 92 180 98" />
        </g>
        {/* chin strap */}
        <path d="M104 122 C116 134 130 140 144 140" fill="none" stroke="#f1f5f9" strokeOpacity="0.85" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ═══════════════ PLAYER PROPS (The Odds API via /api/props) ══════
const AMER = (v) => (v == null ? "—" : v > 0 ? "+" + v : String(v));
function PropsBoard() {
  const [meta, setMeta] = useState(null);      // { configured, events }
  const [open, setOpen] = useState(null);      // event id being shown
  const [lines, setLines] = useState({});      // event id -> markets payload
  const [mkt, setMkt] = useState("player_anytime_td");
  useEffect(() => { fetch("/api/props").then((r) => r.json()).then(setMeta).catch(() => setMeta({ configured: false })); }, []);
  const load = (id) => {
    setOpen(open === id ? null : id);
    if (lines[id] || open === id) return;
    fetch(`/api/props?event=${id}`).then((r) => r.json()).then((d) => setLines((L) => ({ ...L, [id]: d }))).catch(() => {});
  };
  if (!meta) return <Loader label="Loading props" />;
  if (!meta.configured) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Props need an odds key</div>
        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
          ESPN publishes spreads and moneylines but no player props, so this board reads The Odds API. Get a free key at the-odds-api.com,
          then in Vercel → your project → Settings → Environment Variables add <span className="font-bold">ODDS_API_KEY</span> and redeploy.
          Lines appear here automatically once it's set — no code change needed.
        </div>
      </div>
    );
  }
  const games = meta.events || [];
  return (
    <div className="space-y-2">
      {games.length === 0 && <div className="text-center text-xs text-slate-400 py-8">No upcoming games posted yet.</div>}
      {games.map((g) => {
        const d = lines[g.id];
        const isOpen = open === g.id;
        const av = d && d.markets ? Object.keys(d.markets) : [];
        const useKey = av.includes(mkt) ? mkt : av[0];
        return (
          <div key={g.id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button onClick={() => load(g.id)} className="w-full px-3 py-2.5 flex items-center justify-between text-left">
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{g.away} @ {g.home}</div>
                <div className="text-[10px] font-semibold text-slate-400">{new Date(g.start).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <span className="text-slate-400 text-xs font-bold">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {!d && <div className="px-3 py-4 text-[11px] text-slate-400">Loading lines…</div>}
                {d && av.length === 0 && <div className="px-3 py-4 text-[11px] text-slate-400">{d.error ? "Odds feed error: " + d.error : "No props posted for this game yet — books usually put them up 1–2 days out."}</div>}
                {d && av.length > 0 && (
                  <>
                    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                      {av.map((k) => (
                        <button key={k} onClick={() => setMkt(k)}
                          className={"shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold " + (useKey === k ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300")}>
                          {d.markets[k].label}
                        </button>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {d.markets[useKey].rows.map((r) => (
                        <div key={r.player} className="px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">{r.player}</span>
                          <span className="shrink-0 flex items-center gap-2 tabular-nums">
                            {r.line != null && <span className="text-[12px] font-extrabold text-slate-900 dark:text-white">{r.line}</span>}
                            {r.price != null && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{AMER(r.price)}</span>}
                            {r.over != null && <span className="text-[10px] font-semibold text-slate-400">o {AMER(r.over)}</span>}
                            {r.under != null && <span className="text-[10px] font-semibold text-slate-400">u {AMER(r.under)}</span>}
                          </span>
                        </div>
                      ))}
                      <div className="px-3 py-2 text-[9px] text-slate-400">{d.markets[useKey].rows[0]?.book ? "Lines from " + d.markets[useKey].rows[0].book : ""}{meta.remaining ? ` · ${meta.remaining} API credits left this month` : ""}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════ GAME DETAIL (tap a matchup) ═════════════════════
function GameDetail({ game, onBack, onPrev, onNext, index, total }) {
  const [d, setD] = useState(null);
  const [focus, setFocus] = useState(null); // team abbr -> box score view
  // The helmet clash plays once, when the game view first opens — not on every
  // swipe between games and not when tapping a team for its box score.
  const [clash, setClash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setClash(false), 1400); return () => clearTimeout(t); }, []);
  const swipe = useSwipe({ onLeft: onNext || undefined, onRight: onPrev || undefined });
  useEffect(() => {
    let alive = true; setD(null); setFocus(null);
    const load = () => fetch(`/api/game?event=${game.id}`).then((r) => r.json()).then((x) => { if (alive && x && !x.error) setD(x); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [game.id]);
  const g = d || { home: game.home, away: game.away, state: game.state, detail: game.detail, period: game.period, clock: game.clock, scoring: [], leaders: [], teamStats: [], box: [], situation: {} };
  const isLive = g.state === "in", isFinal = g.state === "post";
  const [cm, cs] = String(g.clock || "").split(":").map(Number);
  const twoMin = isLive && (g.period === 2 || g.period === 4) && Number.isFinite(cm) && cm * 60 + (cs || 0) <= 120;
  const homeColor = g.home.color || "#1e3a8a", awayColor = g.away.color || "#334155";
  const statRow = (label, key) => {
    const a = g.teamStats.find((t) => t.team === g.away.abbr)?.stats?.[key], h = g.teamStats.find((t) => t.team === g.home.abbr)?.stats?.[key];
    if (a == null && h == null) return null;
    const na = Number(String(a).split("-")[0]) || 0, nh = Number(String(h).split("-")[0]) || 0, tot = na + nh || 1;
    return (
      <div key={key} className="py-2">
        <div className="flex justify-between text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200"><span>{a ?? "—"}</span><span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span><span>{h ?? "—"}</span></div>
        <div className="mt-1 flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div style={{ width: (na / tot) * 100 + "%", backgroundColor: awayColor }} /><div className="flex-1" /><div style={{ width: (nh / tot) * 100 + "%", backgroundColor: homeColor }} />
        </div>
      </div>
    );
  };
  const Team = ({ t, home }) => (
    <button onClick={() => setFocus(focus === t.abbr ? null : t.abbr)} className={"flex flex-col items-center rounded-2xl px-1 py-1 " + (focus === t.abbr ? "bg-white/15 ring-2 ring-white/70" : "")}>
      <div style={clash ? { animation: `${home ? "hrbHitR" : "hrbHitL"} 1s cubic-bezier(.16,.9,.28,1) 1` } : undefined}>
        <Helmet abbr={t.abbr} logo={t.logo || TEAM_LOGOS[t.abbr]} color={t.color || teamColor(t.abbr)} alt={t.altColor || TEAM_ALT[t.abbr]} flip={!!home} size={134}
          style={focus === t.abbr ? { animation: "hrbNudge 0.45s ease-out 1" } : undefined} />
      </div>
      <div className="text-sm font-extrabold text-white -mt-1">{t.abbr}</div>
      {t.record && <div className="text-[10px] text-white/70 tabular-nums">{t.record}</div>}
    </button>
  );
  const hasBall = (t) => isLive && g.situation && g.situation.possession && String(g.situation.possession) === String(t.id);
  const LABEL = { passingYards: "Passing", rushingYards: "Rushing", receivingYards: "Receiving" };
  // Box score for the focused team: offense (passing / rushing / receiving) then defense
  const BoxTable = ({ cat }) => {
    if (!cat || !cat.rows.length) return null;
    // Four columns that matter per category, so the name column gets the room
    const WANT = { passing: ["C/ATT", "YDS", "TD", "INT"], rushing: ["CAR", "YDS", "AVG", "TD"], receiving: ["REC", "YDS", "AVG", "TD"], defensive: ["TOT", "SOLO", "SACKS", "TFL"], interceptions: ["INT", "YDS", "TD"] };
    const want = WANT[String(cat.name).toLowerCase()];
    const idxs = (want ? want.map((w) => cat.labels.findIndex((l) => String(l).toUpperCase() === w)).filter((i) => i !== -1) : []);
    const cols = idxs.length ? idxs : cat.labels.slice(0, 4).map((_, i) => i);
    const show = cols.map((i) => cat.labels[i]);
    return (
      <div className="mb-2">
        <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400 mb-1 capitalize">{cat.name}</div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="grid text-[8px] font-bold text-slate-400 uppercase px-2 py-1 border-b border-slate-100 dark:border-slate-800" style={{ gridTemplateColumns: `minmax(0,2.6fr) repeat(${show.length}, minmax(0,0.9fr))` }}>
            <span>Player</span>{show.map((l, i) => <span key={i} className="text-center">{l}</span>)}
          </div>
          {cat.rows.map((r) => (
            <div key={r.id || r.name} className="grid items-center px-2 py-1.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0" style={{ gridTemplateColumns: `minmax(0,2.6fr) repeat(${show.length}, minmax(0,0.9fr))` }}>
              <span className="flex items-center gap-1.5 min-w-0">{r.headshot && <img src={r.headshot} alt="" className="w-6 h-6 rounded-full object-cover object-top bg-white shrink-0" onError={(e) => e.currentTarget.remove()} />}<span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</span></span>
              {cols.map((ci) => <span key={ci} className="text-center text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.stats[ci] ?? "—"}</span>)}
            </div>
          ))}
        </div>
      </div>
    );
  };
  const fb = focus && g.box ? g.box.find((b) => b.team === focus) : null;
  const catOf = (n) => fb && fb.cats.find((c) => String(c.name).toLowerCase() === n);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-28" {...swipe}>
      <style>{`
        @keyframes hrbNudge { 0% { transform: scale(1) } 35% { transform: scale(1.22) } 70% { transform: scale(0.96) } 100% { transform: scale(1) } }
        @keyframes hrbBlink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
        /* helmets charge in, collide once, rock back, settle */
        /* helmets charge in, clash hard, rock back, settle — once, on open */
        /* helmets charge from off-screen, slam, squash, rebound, settle */
        @keyframes hrbHitL {
          0% { transform: translateX(-190px) rotate(-22deg) scale(0.82); opacity: 0 }
          8% { opacity: 1 }
          40% { transform: translateX(52px) rotate(13deg) scale(1.12) }
          45% { transform: translateX(44px) rotate(10deg) scale(1.14, 0.9) }
          58% { transform: translateX(-22px) rotate(-9deg) scale(1.02) }
          72% { transform: translateX(11px) rotate(5deg) scale(1) }
          86% { transform: translateX(-4px) rotate(-2deg) }
          100% { transform: translateX(0) rotate(0deg) scale(1) }
        }
        @keyframes hrbHitR {
          0% { transform: translateX(190px) rotate(22deg) scale(0.82); opacity: 0 }
          8% { opacity: 1 }
          40% { transform: translateX(-52px) rotate(-13deg) scale(1.12) }
          45% { transform: translateX(-44px) rotate(-10deg) scale(1.14, 0.9) }
          58% { transform: translateX(22px) rotate(9deg) scale(1.02) }
          72% { transform: translateX(-11px) rotate(-5deg) scale(1) }
          86% { transform: translateX(4px) rotate(2deg) }
          100% { transform: translateX(0) rotate(0deg) scale(1) }
        }
        @keyframes hrbShake {
          0%, 36% { transform: translate(0,0) }
          41% { transform: translate(-9px, 4px) }
          46% { transform: translate(9px, -4px) }
          51% { transform: translate(-6px, 3px) }
          57% { transform: translate(5px, -2px) }
          64% { transform: translate(-3px, 1px) }
          72%, 100% { transform: translate(0,0) }
        }
        /* impact flash + expanding shockwave at the point of contact */
        @keyframes hrbFlash { 0%, 36% { opacity: 0; transform: translate(-50%,-50%) scale(0.3) } 43% { opacity: 0.95; transform: translate(-50%,-50%) scale(1) } 60% { opacity: 0; transform: translate(-50%,-50%) scale(1.5) } 100% { opacity: 0 } }
        @keyframes hrbWave { 0%, 38% { opacity: 0; transform: translate(-50%,-50%) scale(0.2) } 44% { opacity: 0.85 } 78% { opacity: 0; transform: translate(-50%,-50%) scale(2.6) } 100% { opacity: 0 } }
      `}</style>
      <div className="px-4 pb-5 text-white" style={{ background: `linear-gradient(90deg, ${awayColor} 0%, ${awayColor} 42%, ${homeColor} 58%, ${homeColor} 100%)`, paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-90 mb-1">‹ Matchups</button>

        <div className="relative flex items-center justify-between" style={clash ? { animation: "hrbShake 1.2s ease-out 1" } : undefined}>
          {clash && <>
            <span className="pointer-events-none absolute left-1/2 top-[38%] w-24 h-24 rounded-full opacity-0" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,240,180,0.6) 40%, rgba(255,255,255,0) 70%)", animation: "hrbFlash 1.2s ease-out 1 both" }} />
            <span className="pointer-events-none absolute left-1/2 top-[38%] w-16 h-16 rounded-full border-2 border-white/80 opacity-0" style={{ animation: "hrbWave 1.2s ease-out 1 both" }} />
          </>}
          <Team t={g.away} />
          <div className="text-center">
            <div className="flex items-baseline gap-3 text-4xl font-black tabular-nums">
              <span className={g.away.score != null && isFinal && !g.away.winner ? "opacity-60" : ""}>{g.away.score ?? "–"}{hasBall(g.away) && <span className="text-sm align-middle ml-1">🏈</span>}</span>
              <span className="text-lg opacity-60">–</span>
              <span className={g.home.score != null && isFinal && !g.home.winner ? "opacity-60" : ""}>{hasBall(g.home) && <span className="text-sm align-middle mr-1">🏈</span>}{g.home.score ?? "–"}</span>
            </div>
            <div className={"mt-1 text-[11px] font-extrabold uppercase tracking-wider " + (twoMin ? "text-rose-300" : "text-white")}>{isLive ? "● " : ""}{g.detail}</div>
            {isLive && g.situation && g.situation.downDistance && <div className="text-[11px] font-semibold text-white/90 mt-0.5">{g.situation.downDistance}{g.situation.yardLine ? " · " + g.situation.yardLine : ""}{g.situation.redZone ? " · RED ZONE" : ""}</div>}
          </div>
          <Team t={g.home} home />
        </div>
        {g.homeWinPct != null && !isFinal && (
          <div className="mt-4">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider opacity-80"><span>{g.away.abbr} {100 - g.homeWinPct}%</span><span>Win probability</span><span>{g.home.abbr} {g.homeWinPct}%</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-white/90" style={{ width: (100 - g.homeWinPct) + "%" }} /></div>
          </div>
        )}
      </div>
      <div className="px-4 pt-3">
        {!d && <Loader label="Loading game" />}
        {d && focus && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">{focus} box score</div>
              <button onClick={() => setFocus(null)} className="text-[10px] font-bold text-blue-600">Back to game</button>
            </div>
            <div className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 mb-1">Offense</div>
            <BoxTable cat={catOf("passing")} /><BoxTable cat={catOf("rushing")} /><BoxTable cat={catOf("receiving")} />
            <div className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 mb-1 mt-3">Defense</div>
            <BoxTable cat={catOf("defensive")} /><BoxTable cat={catOf("interceptions")} />
            {!fb && <div className="text-xs text-slate-400 text-center py-6">No box score yet for {focus}.</div>}
          </>
        )}
        {d && !focus && (g.away.linescores?.length > 0 || g.home.linescores?.length > 0) && (() => {
          // Quarter-by-quarter, the way a broadcast score bug lays it out.
          const qs = Math.max(4, g.away.linescores?.length || 0, g.home.linescores?.length || 0);
          const cols = Array.from({ length: qs }, (_, i) => i);
          const head = (i) => (i < 4 ? ordinal(i + 1) : qs === 5 ? "OT" : "OT" + (i - 3));
          const Row = ({ t }) => (
            <div className="flex items-center px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src={chipLogo(t.abbr, t.logo)} alt="" className="w-6 h-6 rounded-full object-contain p-0.5 shrink-0" style={logoChip(t.abbr)} />
                <span className="text-[12px] font-extrabold text-slate-900 dark:text-white">{t.abbr}</span>
              </div>
              {cols.map((i) => (
                <span key={i} className="w-8 text-center text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{t.linescores?.[i] ?? "-"}</span>
              ))}
              <span className="w-9 text-center text-[14px] font-black tabular-nums text-slate-900 dark:text-white">{t.score ?? 0}</span>
            </div>
          );
          return (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-3 overflow-hidden">
              <div className="flex items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <span className="flex-1 text-[9px] font-semibold tracking-widest uppercase text-slate-400">Scoring by quarter</span>
                {cols.map((i) => <span key={i} className="w-8 text-center text-[9px] font-bold uppercase text-slate-400">{head(i)}</span>)}
                <span className="w-9 text-center text-[9px] font-bold uppercase text-slate-400">T</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800"><Row t={g.away} /><Row t={g.home} /></div>
            </div>
          );
        })()}
        {d && !focus && isLive && g.situation && (g.situation.lastPlay || g.situation.drive) && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 mb-3">
            <div className="text-[9px] font-semibold tracking-widest uppercase text-rose-500 mb-1">● Last play</div>
            <div className="text-[12px] text-slate-800 dark:text-slate-100 leading-snug">{g.situation.lastPlay || g.situation.drive}</div>
            {g.situation.lastPlay && g.situation.drive && <div className="text-[10px] text-slate-400 mt-1">{g.situation.drive}</div>}
          </div>
        )}
        {d && !focus && g.scoring.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Scoring</div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {g.scoring.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-start gap-2">
                  {TEAM_LOGOS[p.team] && <img src={chipLogo(p.team)} alt="" className="w-5 h-5 rounded-full object-contain p-px mt-0.5" style={logoChip(p.team)} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-800 dark:text-slate-100 leading-snug">{p.text}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{p.type ? p.type + " · " : ""}Q{p.q} {p.clock}</div>
                  </div>
                  <div className="text-[11px] font-extrabold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">{p.away}–{p.home}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {d && !focus && g.leaders.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Leaders</div>
            <div className="grid grid-cols-2 gap-2">
              {[g.away, g.home].map((t) => {
                const L = g.leaders.find((x) => x.team === t.abbr);
                return (
                  <div key={t.abbr} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[10px] font-extrabold text-slate-500 mb-1">{t.abbr}</div>
                    {(L ? L.items : []).filter((l) => LABEL[l.cat]).slice(0, 3).map((l) => (
                      <div key={l.cat} className="py-1">
                        <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-400">{LABEL[l.cat]}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {l.headshot && <img src={l.headshot} alt="" className="w-7 h-7 rounded-full object-cover object-top bg-white" />}
                          <div className="min-w-0"><div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{l.name}</div><div className="text-[9px] text-slate-400 truncate">{l.value}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {d && !focus && g.teamStats.length === 2 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Team stats</div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 divide-y divide-slate-100 dark:divide-slate-800">
              {statRow("Total yards", "totalYards")}{statRow("Passing", "netPassingYards")}{statRow("Rushing", "rushingYards")}{statRow("First downs", "firstDowns")}{statRow("3rd down", "thirdDownEff")}{statRow("Turnovers", "turnovers")}{statRow("Possession", "possessionTime")}
            </div>
          </div>
        )}
        {d && !focus && (g.venue || g.weather) && <div className="text-[10px] text-slate-400 text-center mb-2">{[g.venue, g.weather].filter(Boolean).join(" · ")}{isLive ? " · updates every 30s" : ""} · tap a team for its box score</div>}
      </div>
    </div>
  );
}
// name normalizer local to the board (falls back gracefully if hrbNrm isn't in scope)
function hrbNrmSafe(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").trim().toLowerCase();
}

const TABS = [
  { id: "targets", label: "Week", icon: "🎯" }, // label becomes "Week N" from the live scoreboard
  { id: "teams", label: "Teams", icon: "🏈" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

export default function App() {
  const [tab, setTab] = useState("targets"); // land on the Week board
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [stand, setStand] = useState(null); // records + stat ranks from /api/standings
  const [nflWeek, setNflWeek] = useState(null);
  const [, setInjEspnTick] = useState(0); // current week, for the bottom-nav label
  const [seasonStats, setSeasonStats] = useState(null); // ESPN box-score aggregation (/api/season-stats)

  // Automated records/stats: merge ESPN data into the Airtable teams by abbr.
  // Airtable values still win when present; ESPN fills the blanks (and stx).
  const mergedTeams = useMemo(() => {
    if (!stand || !stand.teams) return teams;
    const find = (abbr) => stand.teams.find((s) => injTeamEq(s.abbr, abbr));
    return teams.map((t) => {
      const s = find(t.abbr || toAbbr(t.name)) || {};
      const bx = seasonStats && seasonStats.teams ? seasonStats.teams[t.abbr || toAbbr(t.name)] : null;
      const stx = {
        // defense splits from box scores (pass/rush yds & TDs allowed, ranked)
        offPassYpg: bx ? bx.offPg.passYds : null, offPassYpgRank: bx ? bx.ranks.offPassYds : null,
        offPassTd: bx ? bx.off.passTd : null, offPassTdRank: bx ? bx.ranks.offPassTd : null,
        offRushYpg: bx ? bx.offPg.rushYds : null, offRushYpgRank: bx ? bx.ranks.offRushYds : null,
        offRushTd: bx ? bx.off.rushTd : null, offRushTdRank: bx ? bx.ranks.offRushTd : null,
        defPassYpg: bx ? bx.defPg.passYds : null, defPassYpgRank: bx ? bx.ranks.defPassYds : null,
        defPassTd: bx ? bx.def.passTd : null, defPassTdRank: bx ? bx.ranks.defPassTd : null,
        defRushYpg: bx ? bx.defPg.rushYds : null, defRushYpgRank: bx ? bx.ranks.defRushYds : null,
        defRushTd: bx ? bx.def.rushTd : null, defRushTdRank: bx ? bx.ranks.defRushTd : null,
        defSeason: seasonStats ? seasonStats.season : null,
        passYpg: s.passYpg, passYpgRank: s.passYpgRank,
        rushYpg: s.rushYpg, rushYpgRank: s.rushYpgRank,
        offTd: s.offTd, offTdRank: s.offTdRank,
        passTd: s.passTd, passTdRank: s.passTdRank,
        rushTd: s.rushTd, rushTdRank: s.rushTdRank,
        sacks: s.sacks, sacksRank: s.sacksRank,
        takeaways: s.takeaways, takeawaysRank: s.takeawaysRank,
        toDiff: s.toDiff, toDiffRank: s.toDiffRank,
        paRank: s.paRank,
      };
      return stand.isCurrent
        ? { ...t, wins: t.wins ?? s.wins, losses: t.losses ?? s.losses, ties: t.ties ?? s.ties, pf: t.pf ?? s.pf, pa: t.pa ?? s.pa, stx }
        : { ...t, winsPrev: t.winsPrev ?? s.wins, lossesPrev: t.lossesPrev ?? s.losses, tiesPrev: t.tiesPrev ?? s.ties, pfPrev: t.pfPrev ?? s.pf, paPrev: t.paPrev ?? s.pa, stx };
    });
  }, [teams, stand, seasonStats]);
  const [selTeam, setSelTeam] = useState(null);
  const [statJump, setStatJump] = useState(null);   // stat tapped on a player page
  const [error, setError] = useState(null);

  const [, setInjTick] = useState(0);
  useEffect(() => {
    let alive = true;
    // Injury/roster feed. Refreshed every 5 minutes and whenever the app comes
    // back to the foreground, so in-game designations (questionable to return,
    // IR moves) show up without a restart. No ?active=true — that excluded IR.
    const load = () => fetch("https://api.sleeper.app/v1/players/nfl")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        for (const k of Object.keys(INJ_BY_NAME)) delete INJ_BY_NAME[k];
        for (const k of Object.keys(INJ_BY_LAST)) delete INJ_BY_LAST[k];
        for (const p of Object.values(d || {})) {
          if (!p || !p.full_name || !p.team) continue;
          const k = injNrm(p.full_name);
          (INJ_BY_NAME[k] = INJ_BY_NAME[k] || []).push(p);
          const lk = String(p.team).toUpperCase() + "|" + lastNameKey(p.full_name);
          (INJ_BY_LAST[lk] = INJ_BY_LAST[lk] || []).push(p);
        }
        setInjTick((t) => t + 1);
      })
      .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        for (const t of d.teams || []) { const a = t.abbr || toAbbr(t.name); if (a && t.logo) TEAM_LOGOS[a] = t.logo; if (a && t.name) TEAM_NAMES[a] = t.name; }
        setPlayers(d.players); setTeams(d.teams || []);
      } })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    fetch("/api/scoreboard").then((r) => r.json()).then((d) => {
      if (d && d.week) setNflWeek(d.week);
      for (const g of (d && d.games) || []) for (const t of [g.home, g.away]) { if (t && t.abbr && t.altColor) TEAM_ALT[t.abbr] = t.altColor; }
    }).catch(() => {});
    // ESPN league injury report (detail + est. return date). Refreshed every 10 min.
    const loadInj = () => fetch("/api/injuries").then((r) => r.json()).then((d) => {
      for (const k of Object.keys(INJ_ESPN)) delete INJ_ESPN[k];
      Object.assign(INJ_ESPN, (d && d.injuries) || {});
      setInjEspnTick((t) => t + 1); // force a re-render so notes pick up the detail
    }).catch(() => {});
    loadInj();
    const t = setInterval(loadInj, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // Current season's box scores; until a week is final, show last season's so tiles aren't blank.
    const yr = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    fetch(`/api/season-stats?season=${yr}`).then((r) => r.json())
      .then((d) => {
        if (d && d.weeksWithGames > 0) return setSeasonStats(d);
        return fetch(`/api/season-stats?season=${yr - 1}`).then((r) => r.json()).then((d2) => setSeasonStats(d2 && d2.players ? d2 : null));
      }).catch(() => {});
  }, []);
  useEffect(() => {
    // Non-fatal: if ESPN is down the app just shows Airtable's numbers.
    fetch("/api/standings")
      .then((r) => r.json())
      .then((d) => { if (d && d.teams) setStand(d); })
      .catch(() => {});
  }, []);

  if (sel) {
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={tab === "teams" ? (selTeam ? selTeam.name : "Teams") : "Players"}
        mode="full"
        seasonStats={seasonStats}
        onStatJump={(j) => { setStatJump(j); setSel(null); setSelTeam(null); setTab("stats"); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <GlobalPulseStyles />
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <Loader />}

      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={mergedTeams} players={players} onSelect={setSelTeam} />
      )}
      {players && tab === "teams" && selTeam && (
        <TeamDetail
          team={mergedTeams.find((t) => t.id === selTeam.id) || selTeam} teams={mergedTeams} seasonStats={seasonStats}
          players={players}
          onBack={() => setSelTeam(null)}
          onSwitchTeam={(t) => setSelTeam(t)}
          onSelectPlayer={setSel}
        />
      )}
      <div className="pb-28">
        {players && tab === "targets" && <TdBoardTab players={players} teams={mergedTeams} onSelect={setSel} />}
        {players && tab === "players" && <PlayersHub players={players} onSelect={setSel} />}
        {players && tab === "stats" && <StatsTab players={players} onSelect={setSel} seasonStats={seasonStats} jump={statJump} onJumpUsed={() => setStatJump(null)} />}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSel(null); setSelTeam(null); }}
            className={"flex-1 py-2.5 text-center " + (tab === t.id ? "text-blue-600" : "text-slate-400")}
          >
            <div className="text-lg leading-none">{t.icon}</div>
            <div className="text-[10px] font-bold mt-1">{t.id === "targets" && nflWeek ? "Week " + nflWeek : t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── END OF FILE · v12 · if you do not see this line, the upload was truncated ───
