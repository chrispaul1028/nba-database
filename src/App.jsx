import { useState, useMemo, useEffect } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Salary bar colors by year type - change any hex you like.
const BAR_COLORS = {
  G: "#f97316",    // guaranteed        (orange-500)
  PO: "#fdba74",   // player option     (orange-300)
  TO: "#fde68a",   // team option       (amber-200)
  NG: "#fed7aa",   // non-guaranteed    (orange-200)
  PG: "#fb923c",   // partially gtd     (orange-400)
  UFA: "#e2e8f0",  // free agent stub   (slate-200)
  RFA: "#fecdd3",  // restricted stub   (rose-200)
};

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
  "golden state warriors": "GSW", "houston rockets": "HOU", "indiana pacers": "IND",
  "los angeles clippers": "LAC", "la clippers": "LAC", "los angeles lakers": "LAL",
  "memphis grizzlies": "MEM", "miami heat": "MIA", "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN", "new orleans pelicans": "NOP",
  "new york knicks": "NY", "oklahoma city thunder": "OKC", "orlando magic": "ORL",
  "philadelphia 76ers": "PHI", "phoenix suns": "PHX", "portland trail blazers": "POR",
  "sacramento kings": "SAC", "san antonio spurs": "SAS", "toronto raptors": "TOR",
  "utah jazz": "UTA", "washington wizards": "WSH",
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
const BADGE = { PO: "bg-orange-100 text-orange-700", TO: "bg-amber-100 text-amber-700", NG: "bg-orange-50 text-orange-500", PG: "bg-orange-100 text-orange-600", UFA: "bg-slate-100 text-slate-500", RFA: "bg-rose-100 text-rose-600" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0] || null;

// ═══════════════ SHARED PIECES ═══════════════════════════════════
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : "w-11 h-11 text-sm";
  if (p.photo) {
    return <img src={p.photo} alt={p.name} className={px + " rounded-full object-cover object-top bg-slate-200 shrink-0"} />;
  }
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={px + " rounded-full bg-slate-200 text-slate-500 font-bold flex items-center justify-center shrink-0"}>
      {label}
    </div>
  );
}

function Tile({ value, label, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-2 py-4 text-center shadow-sm">
      <div className={"text-2xl font-extrabold tracking-tight " + (accent ? "text-orange-500" : "text-slate-900")}>{value}</div>
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
          <div className="text-[11px] font-bold text-slate-700 mb-1">
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
    <div className={"bg-white rounded-2xl border shadow-sm px-4 py-4 " + (big ? "border-orange-200" : "border-slate-200")}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase truncate">
            {c.kind}{c.team ? " · " + c.team : ""}{c.signed ? " · " + c.signed : ""}
          </div>
          <div className="text-sm font-extrabold text-slate-800 mt-0.5">{terms(c)}</div>
        </div>
        <span className={"text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " + (c.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years.filter((y) => y.type !== "G").map((y, i) => (
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (BADGE[y.type] || "bg-slate-100 text-slate-500")}>
            {y.season || y.s} · {TYPE_LABEL[y.type] || y.type}
            {y.decision ? " · " + y.decision : ""}
            {y.gtd != null ? " (" + fmtM(y.gtd) + " gtd)" : ""}
          </span>
        ))}
        {c.years.length > 0 && c.years.every((y) => y.type === "G") && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Fully guaranteed</span>
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
      <span className="text-slate-800 font-semibold">{v}</span>
    </div>
  );
}

// ═══════════════ PLAYER DETAIL ═══════════════════════════════════
function PlayerDetail({ p, onBack, backLabel }) {
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 pb-24">
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
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={fmtM(total(act))} label="Total" accent />
              <Tile value={fmtM(total(act) / salaried(act).length)} label="AAV" />
              <Tile value={salaried(act).length} label="Years" />
            </div>
            <div className="mt-4"><ContractCard c={act} big /></div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Contract history</div>
            <div className="flex flex-col gap-3">
              {past.map((c, i) => <ContractCard key={i} c={c} />)}
            </div>
          </>
        )}

        {(p.height || p.weight || p.age) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
              <BioRow k="Height" v={p.height} />
              <BioRow k="Weight" v={p.weight} />
              <BioRow k="Age" v={p.age} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════ LIST HEADER (shared) ════════════════════════════
function ListHeader({ title, q, setQ }) {
  return (
    <div className="bg-blue-600 px-5 pt-6 pb-5 text-white sticky top-0 z-10 shadow-md">
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players…"
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white/95 placeholder-slate-400 outline-none"
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
  const list = useMemo(
    () => players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [players, q]
  );
  return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.pos, cleanNo(p.no) ? "#" + cleanNo(p.no) : "", p.height, p.age ? p.age + " yrs" : ""]
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
        .filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [players, q]
  );
  return (
    <div>
      <ListHeader title="Contracts" q={q} setQ={setQ} />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {list.map((p) => {
            const act = activeOf(p);
            return (
              <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1 w-9 text-center shrink-0">{p.pos || "—"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {act ? displayLine(act) : "No contract"}
                    {p.contracts.length > 1 ? " · " + p.contracts.length + " deals" : ""}
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

// ═══════════════ PLACEHOLDER TABS ════════════════════════════════
function ComingSoon({ icon, title, blurb }) {
  return (
    <div>
      <div className="bg-blue-600 px-5 pt-6 pb-5 text-white sticky top-0 z-10 shadow-md">
        <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      </div>
      <div className="px-8 pt-24 pb-28 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="text-lg font-extrabold text-slate-700">{title} is coming soon</div>
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
  const [tab, setTab] = useState("players");
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setPlayers(d.players)))
      .catch((e) => setError(String(e)));
  }, []);

  if (sel) {
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={tab === "contracts" ? "Contracts" : "Players"}
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

      {players && tab === "teams" && (
        <ComingSoon icon="🏀" title="Teams" blurb="Team pages with rosters, records, and payroll — built from your Teams table. Next up." />
      )}
      {players && tab === "players" && <PlayersTab players={players} onSelect={setSel} />}
      {players && tab === "contracts" && <ContractsTab players={players} onSelect={setSel} />}
      {players && tab === "stats" && (
        <ComingSoon icon="📊" title="Stats" blurb="Season averages and leaderboards — waiting on the Stats table design in Airtable." />
      )}
      {players && tab === "draft" && (
        <ComingSoon icon="🎓" title="Draft" blurb="Draft classes grouped by year with pick numbers — built from your draft fields." />
      )}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSel(null); }}
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
