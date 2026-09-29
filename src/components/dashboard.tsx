"use client";

import { useRef, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check,
  ChevronDown, CircleHelp, Clock3, CloudUpload, Database, Download,
  FlaskConical, History, LayoutDashboard, Menu, Play, Plus, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp, Wallet, X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { parseCsv, strategyNames, type BacktestConfig, type Bar, type Dataset, type SavedRun, type Strategy } from "@/lib/backtest";

type Props = { initialRuns: SavedRun[]; demoRun: SavedRun };
const currency = (value: number, decimals = 2) => "$" + value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const signed = (value: number, decimals = 2) => `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const axisDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const datasets: { value: Dataset; name: string; detail: string }[] = [
  { value: "SPY", name: "SPY", detail: "S&P 500 ETF · sample" },
  { value: "BTC", name: "BTC", detail: "Bitcoin · sample" },
  { value: "AAPL", name: "AAPL", detail: "Apple Inc. · sample" },
  { value: "CUSTOM", name: "Custom CSV", detail: "Your own price data" },
];

export default function Dashboard({ initialRuns, demoRun }: Props) {
  const [runs, setRuns] = useState<SavedRun[]>(initialRuns);
  const [selected, setSelected] = useState<SavedRun>(initialRuns[0] ?? demoRun);
  const [config, setConfig] = useState<BacktestConfig>(initialRuns[0]?.config ?? demoRun.config);
  const [customBars, setCustomBars] = useState<Bar[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Backtesting");
  const fileInput = useRef<HTMLInputElement>(null);
  const result = selected.result;
  const metrics = result.metrics;
  const update = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => {
    setConfig(previous => ({ ...previous, [key]: value }));
    setError("");
    setNotice("");
  };
  const scrollTo = (id: string, label: string) => {
    setActiveNav(label);
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("CSV file must be smaller than 2 MB.");
      const bars = parseCsv(await file.text());
      setCustomBars(bars);
      setFileName(file.name);
      update("dataset", "CUSTOM");
      setNotice(`${bars.length} price rows loaded from ${file.name}. Ready to run.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read CSV file.");
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const run = async () => {
    setError(""); setNotice("");
    if (config.dataset === "CUSTOM" && !customBars) {
      setError("Upload a CSV with Date and Close columns before running custom data.");
      return;
    }
    setIsRunning(true);
    try {
      const response = await fetch("/api/backtests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, bars: config.dataset === "CUSTOM" ? customBars : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backtest failed.");
      const saved = data as SavedRun;
      setSelected(saved);
      setRuns(previous => [saved, ...previous].slice(0, 20));
      setNotice("Backtest complete. Results saved to your run history.");
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run backtest.");
    } finally {
      setIsRunning(false);
    }
  };
  const selectRun = (run: SavedRun) => {
    setSelected(run); setConfig(run.config); setError(""); setNotice(""); setMenuOpen(false);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const reset = () => {
    setConfig({ ...demoRun.config, name: "New strategy" });
    setError(""); setNotice("New setup ready. Adjust the settings and run a backtest.");
    scrollTo("setup", "Backtesting");
  };
  const exportCsv = () => {
    const rows = ["Date,Strategy Equity,Buy and Hold,Close", ...result.equity.map(p => `${p.date},${p.equity},${p.benchmark},${p.close}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `stratlab-${selected.config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-results.csv`;
    link.click(); URL.revokeObjectURL(url);
  };
  const navItems = [
    { label: "Overview", icon: LayoutDashboard, id: "overview" },
    { label: "Backtesting", icon: FlaskConical, id: "setup" },
    { label: "Strategies", icon: SlidersHorizontal, id: "setup" },
    { label: "Datasets", icon: Database, id: "dataset-section" },
    { label: "Trade journal", icon: BarChart3, id: "trades" },
  ];
  const shownTrades = showAllTrades ? result.trades : result.trades.slice(0, 5);

  return (
    <div className="app-shell" id="overview">
      {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><span /><span /><span /><span /></span><span>stratlab<span className="brand-period">.</span></span></div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.label} className={`nav-item ${activeNav === item.label ? "nav-active" : ""}`} onClick={() => scrollTo(item.id, item.label)}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.label === "Backtesting" && <span className="nav-active-dot" />}</button>)}
        </nav>
        <div className="sidebar-divider" />
        <div className="recent-heading"><span>RECENT RUNS</span><History size={15} /></div>
        <div className="recent-list">
          {runs.slice(0, 4).map(run => <button className={`recent-item ${selected.id === run.id ? "recent-selected" : ""}`} key={run.id} onClick={() => selectRun(run)}><span className="recent-icon"><Activity size={15} /></span><span className="recent-text"><strong>{run.config.name}</strong><small>{run.config.dataset === "CUSTOM" ? "Custom data" : `${run.config.dataset} · Sample`} · {shortDate(run.result.endDate)}</small></span></button>)}
          {runs.length === 0 && <button className="recent-item recent-selected" onClick={() => selectRun(demoRun)}><span className="recent-icon"><Activity size={15} /></span><span className="recent-text"><strong>Momentum crossover</strong><small>SPY · Demo result</small></span></button>}
        </div>
        <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-icon"><Sparkles size={17} /></span><strong>Build with confidence</strong><p>Test your ideas against data before taking them to market.</p><button onClick={() => scrollTo("setup", "Backtesting")}>Start a backtest <ArrowRight size={14} /></button></div><div className="sidebar-profile"><div className="avatar">S</div><div><strong>My workspace</strong><small>Personal account</small></div><Settings2 size={17} /></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button><span>Workspace</span><span className="crumb-separator">/</span><strong>Backtesting</strong></div><div className="topbar-right"><span className="status-indicator"><span /> Research environment</span><div className="top-avatar">S</div></div></header>
        <div className="content-wrap">
          <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> THE STRATEGY LAB</div><h1>Backtest your edge<span className="title-dot">.</span></h1><p>Turn your trading ideas into measurable results. Configure a strategy, choose your data, and see how it performs.</p></div><button className="new-button" onClick={reset}><Plus size={17} strokeWidth={2.3} /> New backtest</button></div>
          <div className="workspace-grid">
            <div className="left-column">
              <section className="panel setup-panel" id="setup"><div className="panel-heading setup-heading"><div className="heading-icon"><SlidersHorizontal size={18} /></div><div><h2>Strategy setup</h2><p>Define the rules of your test</p></div></div>
                <div className="setup-body">
                  <label className="field-label" htmlFor="strategy-name">STRATEGY NAME</label><input id="strategy-name" className="form-input" maxLength={80} value={config.name} onChange={e => update("name", e.target.value)} placeholder="Name your strategy" />
                  <label className="field-label" htmlFor="strategy-type">STRATEGY TYPE</label><div className="select-wrap"><select id="strategy-type" className="form-input" value={config.strategy} onChange={e => update("strategy", e.target.value as Strategy)}><option value="ma_crossover">Moving average crossover</option><option value="rsi_reversion">RSI mean reversion</option><option value="breakout">Price breakout</option></select><ChevronDown size={16} /></div>
                  <div className="strategy-info"><div className="strategy-info-icon"><Target size={16} /></div><p>{config.strategy === "ma_crossover" ? "Buy when the fast moving average rises above the slow one. Exit when it falls below." : config.strategy === "rsi_reversion" ? "Buy when RSI dips below your oversold level. Exit when it rises above overbought." : "Buy when price breaks above its recent high. Exit when it breaks below its recent low."}</p></div>
                  <div className="field-divider" />
                  <div id="dataset-section" className="section-label-row"><label className="field-label" htmlFor="dataset">MARKET DATA</label><span className="tiny-badge">DATA SOURCE</span></div>
                  <div className="select-wrap dataset-select"><select id="dataset" className="form-input" value={config.dataset} onChange={e => update("dataset", e.target.value as Dataset)}>{datasets.map(d => <option value={d.value} key={d.value}>{d.name} — {d.detail}</option>)}</select><ChevronDown size={16} /></div>
                  <button className="upload-box" onClick={() => fileInput.current?.click()}><CloudUpload size={19} /><span>{fileName && config.dataset === "CUSTOM" ? fileName : "Upload your own CSV"}</span><ArrowRight size={15} /></button><input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} /><p className="field-hint">Date and Close columns · 30–5,000 rows</p>
                  <div className="field-divider" />
                  <div className="section-label-row"><span className="field-label no-margin">PARAMETERS</span><span className="parameter-context">{config.strategy === "ma_crossover" ? "SMA periods" : config.strategy === "rsi_reversion" ? "RSI settings" : "Lookback window"}</span></div>
                  {config.strategy === "ma_crossover" && <div className="field-row"><div><label className="field-label" htmlFor="fast">FAST PERIOD</label><div className="number-wrap"><input id="fast" type="number" min="2" max="249" value={config.fastPeriod} onChange={e => update("fastPeriod", Number(e.target.value))} /><span>days</span></div></div><div><label className="field-label" htmlFor="slow">SLOW PERIOD</label><div className="number-wrap"><input id="slow" type="number" min="3" max="250" value={config.slowPeriod} onChange={e => update("slowPeriod", Number(e.target.value))} /><span>days</span></div></div></div>}
                  {config.strategy === "rsi_reversion" && <><div className="field-row"><div><label className="field-label" htmlFor="rsi-period">RSI PERIOD</label><div className="number-wrap"><input id="rsi-period" type="number" min="2" max="100" value={config.rsiPeriod} onChange={e => update("rsiPeriod", Number(e.target.value))} /><span>days</span></div></div><div><label className="field-label" htmlFor="oversold">OVERSOLD</label><div className="number-wrap"><input id="oversold" type="number" min="1" max="98" value={config.oversold} onChange={e => update("oversold", Number(e.target.value))} /><span>RSI</span></div></div></div><div className="single-field"><label className="field-label" htmlFor="overbought">OVERBOUGHT</label><div className="number-wrap"><input id="overbought" type="number" min="2" max="99" value={config.overbought} onChange={e => update("overbought", Number(e.target.value))} /><span>RSI</span></div></div></>}
                  {config.strategy === "breakout" && <div className="single-field"><label className="field-label" htmlFor="breakout">LOOKBACK PERIOD</label><div className="number-wrap"><input id="breakout" type="number" min="2" max="250" value={config.breakoutPeriod} onChange={e => update("breakoutPeriod", Number(e.target.value))} /><span>days</span></div></div>}
                  <div className="field-row capital-row"><div><label className="field-label" htmlFor="capital">STARTING CAPITAL</label><div className="number-wrap"><span>$</span><input id="capital" type="number" min="100" max="100000000" value={config.initialCapital} onChange={e => update("initialCapital", Number(e.target.value))} /></div></div><div><label className="field-label" htmlFor="fee">TRADING FEE</label><div className="number-wrap"><input id="fee" type="number" min="0" max="5" step="0.01" value={config.feePercent} onChange={e => update("feePercent", Number(e.target.value))} /><span>%</span></div></div></div>
                  {error && <div className="feedback feedback-error" role="alert"><CircleHelp size={15} />{error}</div>}
                  {notice && <div className="feedback feedback-success" role="status"><Check size={15} />{notice}</div>}
                  <button className="run-button" onClick={run} disabled={isRunning}>{isRunning ? <span className="loading-spinner" /> : <Play size={17} fill="currentColor" />} {isRunning ? "Running backtest..." : "Run backtest"}<ArrowRight size={18} className="run-arrow" /></button>
                  <div className="setup-footer"><ShieldCheck size={14} /> Long-only · Close-price execution · Fees included</div>
                </div>
              </section>
              <div className="tip-card"><div className="tip-icon"><Sparkles size={18} /></div><div><strong>Make it your own</strong><p>Upload a CSV to test strategies on your own historical price data.</p></div></div>
            </div>
            <div className="right-column" id="results">
              <div className="results-header"><div><div className="results-overline"><span className="live-dot" /> BACKTEST RESULTS <span className="results-divider">·</span> {selected.id === 0 ? "DEMO RUN" : "SAVED RUN"}</div><h2>{selected.config.name}</h2><p><span>{strategyNames[selected.config.strategy]}</span><span className="meta-dot">·</span><span>{selected.config.dataset === "CUSTOM" ? "Custom data" : `${selected.config.dataset} sample data`}</span><span className="meta-dot">·</span><span>{shortDate(result.startDate)} – {shortDate(result.endDate)}</span></p></div><button className="export-button" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
              <div className="metrics-grid">
                <MetricCard label="TOTAL RETURN" value={signed(metrics.totalReturn)} icon={<TrendingUp size={18} />} tone={metrics.totalReturn >= 0 ? "green" : "red"} caption={`${metrics.totalReturn >= 0 ? "+" : ""}${currency(metrics.endingBalance - selected.config.initialCapital)} net profit`} />
                <MetricCard label="WIN RATE" value={`${metrics.winRate.toFixed(1)}%`} icon={<Target size={18} />} tone="blue" caption={`${metrics.totalTrades} completed trades`} />
                <MetricCard label="MAX DRAWDOWN" value={`-${metrics.maxDrawdown.toFixed(1)}%`} icon={<ArrowDownRight size={18} />} tone="orange" caption="Largest peak-to-trough" />
                <MetricCard label="SHARPE RATIO" value={metrics.sharpeRatio.toFixed(2)} icon={<Activity size={18} />} tone="purple" caption="Annualized risk-adjusted" />
              </div>
              <section className="panel chart-panel"><div className="chart-head"><div><h3>Equity curve</h3><p>Portfolio value over time</p></div><span className="period-pill"><Clock3 size={14} /> Full period</span></div><div className="chart-legend"><span><i className="legend-line legend-green" /> Strategy</span><span><i className="legend-line legend-gray" /> Buy & hold</span></div><div className="equity-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={result.equity} margin={{ top: 8, right: 10, left: -11, bottom: 2 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30b990" stopOpacity={0.20} /><stop offset="95%" stopColor="#30b990" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0ef" strokeDasharray="4 4" /><XAxis dataKey="date" tickFormatter={axisDate} tickLine={false} axisLine={false} tick={{ fill: "#98a3a1", fontSize: 11 }} minTickGap={55} dy={12} /><YAxis tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} tick={{ fill: "#98a3a1", fontSize: 11 }} width={48} domain={["auto", "auto"]} /><Tooltip formatter={(value, name) => [currency(Number(value)), name === "equity" ? "Strategy" : "Buy & hold"]} labelFormatter={label => shortDate(String(label))} contentStyle={{ borderRadius: 12, border: "1px solid #e7ecea", boxShadow: "0 10px 28px rgba(15,38,31,.10)", fontSize: 12 }} /><Area type="monotone" dataKey="benchmark" stroke="#b7c3c0" strokeWidth={2} strokeDasharray="5 5" fill="transparent" dot={false} activeDot={false} /><Area type="monotone" dataKey="equity" stroke="#119f77" strokeWidth={2.5} fill="url(#equityFill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }} /></AreaChart></ResponsiveContainer></div><div className="chart-bottom"><span><span className="chart-bottom-dot" /> Based on {result.barCount} daily price bars</span><span>Starting balance <strong>{currency(selected.config.initialCapital, 0)}</strong></span></div></section>
              <div className="insight-grid"><section className="panel insight-panel"><div className="panel-title-row"><div><h3>Performance breakdown</h3><p>A closer look at the numbers</p></div><div className="mini-icon"><GaugeIcon /></div></div><div className="breakdown-list"><div><span><Wallet size={16} /> Ending balance</span><strong>{currency(metrics.endingBalance)}</strong></div><div><span><TrendingUp size={16} /> Buy & hold return</span><strong className={metrics.benchmarkReturn >= 0 ? "text-positive" : "text-negative"}>{signed(metrics.benchmarkReturn)}</strong></div><div><span><BarChart3 size={16} /> Profit factor</span><strong>{metrics.profitFactor >= 99 ? "∞" : metrics.profitFactor.toFixed(2)}</strong></div><div><span><Activity size={16} /> Total trades</span><strong>{metrics.totalTrades}</strong></div></div></section><section className="insight-callout"><div className="callout-top"><div className="callout-symbol"><ArrowUpRight size={20} /></div><span>QUICK INSIGHT</span></div><h3>Data turns ideas<br />into decisions.</h3><p>Compare your strategy to simply buying and holding the asset over the same period.</p><div className="comparison"><span>vs. Buy & hold</span><strong className={metrics.totalReturn - metrics.benchmarkReturn >= 0 ? "" : "negative"}>{signed(metrics.totalReturn - metrics.benchmarkReturn)} <ArrowUpRight size={16} /></strong></div></section></div>
              <section className="panel trades-panel" id="trades"><div className="trades-heading"><div><h3>Trade history <span>{metrics.totalTrades}</span></h3><p>Every completed position in this backtest</p></div><button onClick={() => setShowAllTrades(!showAllTrades)} disabled={result.trades.length <= 5}>{showAllTrades ? "Show less" : "View all trades"} <ArrowRight size={15} /></button></div><div className="table-scroll"><table><thead><tr><th>TRADE</th><th>ENTRY DATE</th><th>EXIT DATE</th><th>DURATION</th><th>P&amp;L</th><th>RESULT</th></tr></thead><tbody>{shownTrades.map(trade => <tr key={trade.id}><td className="trade-id">#{String(trade.id).padStart(3, "0")}</td><td>{shortDate(trade.entryDate)}</td><td>{shortDate(trade.exitDate)}</td><td>{trade.duration} days</td><td className={trade.pnl >= 0 ? "text-positive pnl-cell" : "text-negative pnl-cell"}>{trade.pnl >= 0 ? "+" : "-"}{currency(Math.abs(trade.pnl))}<small>{signed(trade.pnlPercent)}</small></td><td><span className={`result-badge ${trade.status === "Win" ? "win" : "loss"}`}><span />{trade.status}</span></td></tr>)}</tbody></table>{result.trades.length === 0 && <div className="empty-trades">No trades were triggered. Try changing your strategy parameters.</div>}</div></section>
              <div className="disclaimer"><CircleHelp size={14} /><span>Sample datasets are synthetic and for demonstration only. Backtests are hypothetical, use close-price execution, and do not predict future performance.</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon, tone, caption }: { label: string; value: string; icon: React.ReactNode; tone: string; caption: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon tone-${tone}`}>{icon}</div></div><div className={`metric-value ${tone === "green" ? "text-positive" : tone === "red" ? "text-negative" : ""}`}>{value}</div><div className="metric-caption">{caption}</div></div>;
}
function GaugeIcon() { return <Activity size={17} />; }
