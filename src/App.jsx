import { useState, useMemo, useEffect } from "react";

// Team colors for header + pills. Add teams as your data grows.
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
const teamColor = (abbr) => TEAM_COLORS[abbr] || "#334155";

const TYPE_LABEL = { G: "Guaranteed", PO: "Player Option", TO: "Team Option", NG: "Non-Guaranteed", UFA: "Free Agent", RFA: "Restricted FA" };
const BAR_STYLE = { G: "bg-orange-500", PO: "bg-orange-300", TO: "bg-amber-200", NG: "bg-orange-200", UFA: "bg-slate-200", RFA: "bg-rose-200" };
const BADGE = { PO: "bg-orange-100 text-orange-700", TO: "bg-amber-100 text-amber-700", NG: "bg-orange-50 text-orange-500", UFA: "bg-slate-100 text-slate-500", RFA: "bg-rose-100 text-rose-600" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const display = (c) => terms(c) + " (" + c.team + ") · " + c.kind;
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0];

function Tile({ value, label, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-2 py-4 text-center shadow-sm">
      <div className={"text-2xl font-extrabold tracking-tight " + (accent ? "text-orange-500" : "text-slate-900")}>
        {value}
      </div>
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
            {y.salary == null ? (TYPE_LABEL[y.type] === "Free Agent" ? "UFA" : y.type) : fmtM(y.salary)}
          </div>
          <div
            className={"w-full rounded-t-md " + (BAR_STYLE[y.type] || "bg-orange-500")}
            style={{ height: y.salary == null ? "6px" : Math.max((y.salary / max) * 100, 8) + "%" }}
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
        <span className={
          "text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " +
          (c.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")
        }>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years.filter((y) => y.type !== "G").map((y, i) => (
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (BADGE[y.type] || "bg-slate-100 text-slate-500")}>
            {y.season || y.s} · {TYPE_LABEL[y.type] || y.type}
          </span>
        ))}
        {c.years.length > 0 && c.years.every((y) => y.type === "G") && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Fully guaranteed
          </span>
        )}
      </div>
    </div>
  );
}

function PlayerDetail({ p, onBack }) {
  const act = activeOf(p);
  const abbr = act?.team || "";
  const past = p.contracts.filter((c) => c !== act);
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-5 pt-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr) }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Contracts</button>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-black opacity-40">{p.no}</div>
          <div>
            <div className="text-2xl font-extrabold leading-tight">
              {p.no !== "" ? "#" + p.no + " " : ""}{p.name}
            </div>
            <div className="text-sm opacity-80 font-medium mt-0.5">
              {[p.pos, p.teamName].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 pb-10">
        {act && salaried(act).length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={fmtM(total(act))} label="Total" accent />
              <Tile value={fmtM(total(act) / salaried(act).length)} label="AAV" />
              <Tile value={salaried(act).length} label="Years" />
            </div>
            <div className="mt-4">
              <ContractCard c={act} big />
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">
              Contract history
            </div>
            <div className="flex flex-col gap-3">
              {past.map((c, i) => <ContractCard key={i} c={c} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setPlayers(d.players)))
      .catch((e) => setError(String(e)));
  }, []);

  const list = useMemo(
    () => (players || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [players, q]
  );

  if (sel) return <PlayerDetail p={sel} onBack={() => setSel(null)} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-600 px-5 pt-6 pb-5 text-white sticky top-0 z-10 shadow-md">
        <div className="text-2xl font-extrabold tracking-tight">Contracts</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white/95 placeholder-slate-400 outline-none"
        />
      </div>

      <div className="px-4 pb-10 mt-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
            Couldn't load data: {error}. Check the Vercel environment variables and field names in api/contracts.js.
          </div>
        )}
        {!players && !error && (
          <div className="text-center text-sm text-slate-400 mt-16">Loading players…</div>
        )}
        {players && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {list.map((p) => {
              const act = activeOf(p);
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                >
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1 w-9 text-center shrink-0">
                    {p.pos || "—"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{p.name}</span>
                    <span className="block text-[11px] text-slate-400 font-medium truncate">
                      {act ? display(act) : "No contract"}
                      {p.contracts.length > 1 ? " · " + p.contracts.length + " deals" : ""}
                    </span>
                  </span>
                  {act?.team && (
                    <span
                      className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: teamColor(act.team) }}
                    >
                      {act.team}
                    </span>
                  )}
                  <span className="text-slate-300 shrink-0">›</span>
                </button>
              );
            })}
            {list.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
