export type Bar = { date: string; close: number };
export type Strategy = "ma_crossover" | "rsi_reversion" | "breakout";
export type Dataset = "SPY" | "BTC" | "AAPL" | "CUSTOM";
export type BacktestConfig = {
  name: string;
  strategy: Strategy;
  dataset: Dataset;
  initialCapital: number;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  oversold: number;
  overbought: number;
  breakoutPeriod: number;
  feePercent: number;
};
export type EquityPoint = { date: string; equity: number; benchmark: number; close: number };
export type Trade = { id: number; entryDate: string; exitDate: string; entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number; duration: number; status: "Win" | "Loss" };
export type Metrics = { totalReturn: number; benchmarkReturn: number; maxDrawdown: number; winRate: number; profitFactor: number; sharpeRatio: number; totalTrades: number; endingBalance: number };
export type BacktestResult = { equity: EquityPoint[]; trades: Trade[]; metrics: Metrics; startDate: string; endDate: string; barCount: number };
export type SavedRun = { id: number; config: BacktestConfig; result: BacktestResult; createdAt: string };

export const defaultConfig: BacktestConfig = {
  name: "Momentum crossover",
  strategy: "ma_crossover",
  dataset: "SPY",
  initialCapital: 10000,
  fastPeriod: 20,
  slowPeriod: 50,
  rsiPeriod: 14,
  oversold: 30,
  overbought: 70,
  breakoutPeriod: 20,
  feePercent: 0.1,
};

export const strategyNames: Record<Strategy, string> = {
  ma_crossover: "Moving average crossover",
  rsi_reversion: "RSI mean reversion",
  breakout: "Price breakout",
};

// Generated price series are illustrative demo data, not exchange history.
export function generateSampleData(dataset: Exclude<Dataset, "CUSTOM">): Bar[] {
  const settings = {
    SPY: { start: 472, drift: 0.00039, wave: 0.0049, noise: 0.006, seed: 17 },
    BTC: { start: 42000, drift: 0.00072, wave: 0.011, noise: 0.019, seed: 29 },
    AAPL: { start: 184, drift: 0.00045, wave: 0.0075, noise: 0.009, seed: 43 },
  }[dataset];
  let seed = settings.seed;
  let price = settings.start;
  const bars: Bar[] = [];
  const date = new Date("2024-01-02T12:00:00Z");
  while (bars.length < 420) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
      seed = (seed * 16807) % 2147483647;
      const random = seed / 2147483647 - 0.5;
      const i = bars.length;
      const cycle = Math.sin(i / 23) * settings.wave + Math.cos(i / 57) * settings.wave * 0.45;
      price *= 1 + settings.drift + cycle + random * settings.noise;
      bars.push({ date: date.toISOString().slice(0, 10), close: Math.round(price * 100) / 100 });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return bars;
}

export function parseCsv(text: string): Bar[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 32) throw new Error("CSV needs at least 30 rows of daily price data.");
  const header = lines[0].toLowerCase().split(",").map(x => x.trim().replace(/["']/g, ""));
  const dateIndex = header.findIndex(x => x === "date" || x === "timestamp" || x === "time");
  const closeIndex = header.findIndex(x => x === "close" || x === "adj close" || x === "adj_close" || x === "price");
  if (dateIndex < 0 || closeIndex < 0) throw new Error("CSV must have Date and Close columns.");
  const bars = lines.slice(1).map(line => {
    const cols = line.split(",").map(x => x.trim().replace(/^"|"$/g, ""));
    const date = new Date(cols[dateIndex]);
    const close = Number(cols[closeIndex]);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(close) || close <= 0) return null;
    return { date: date.toISOString().slice(0, 10), close };
  }).filter((x): x is Bar => x !== null).sort((a, b) => a.date.localeCompare(b.date));
  const unique = bars.filter((bar, i) => i === 0 || bar.date !== bars[i - 1].date);
  if (unique.length < 30) throw new Error("CSV needs at least 30 valid, unique dates and positive closing prices.");
  if (unique.length > 5000) throw new Error("CSV is limited to 5,000 rows.");
  return unique;
}

function sma(bars: Bar[], end: number, length: number) {
  if (end < length - 1) return null;
  let sum = 0;
  for (let j = end - length + 1; j <= end; j++) sum += bars[j].close;
  return sum / length;
}
function rsi(bars: Bar[], end: number, length: number) {
  if (end < length) return null;
  let gain = 0, loss = 0;
  for (let j = end - length + 1; j <= end; j++) {
    const delta = bars[j].close - bars[j - 1].close;
    if (delta > 0) gain += delta; else loss -= delta;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function runBacktest(config: BacktestConfig, bars: Bar[]): BacktestResult {
  if (bars.length < 30) throw new Error("At least 30 price bars are required.");
  if (!Number.isFinite(config.initialCapital) || config.initialCapital < 100 || config.initialCapital > 100000000) throw new Error("Starting capital must be between $100 and $100,000,000.");
  if (!Number.isFinite(config.feePercent) || config.feePercent < 0 || config.feePercent > 5) throw new Error("Trading fee must be between 0% and 5%.");
  if (!Number.isInteger(config.fastPeriod) || !Number.isInteger(config.slowPeriod) || config.fastPeriod < 2 || config.slowPeriod > 250 || config.fastPeriod >= config.slowPeriod) throw new Error("Fast period must be at least 2 and shorter than slow period (max 250).");
  if (!Number.isInteger(config.rsiPeriod) || config.rsiPeriod < 2 || config.rsiPeriod > 100 || config.oversold < 1 || config.overbought > 99 || config.oversold >= config.overbought) throw new Error("Invalid RSI settings.");
  if (!Number.isInteger(config.breakoutPeriod) || config.breakoutPeriod < 2 || config.breakoutPeriod > 250) throw new Error("Breakout period must be between 2 and 250.");
  if (!(["ma_crossover", "rsi_reversion", "breakout"] as string[]).includes(config.strategy)) throw new Error("Unknown strategy.");
  const fee = config.feePercent / 100;
  let cash = config.initialCapital;
  let shares = 0;
  let entryPrice = 0, entryDate = "", entryIndex = 0, entryCost = 0;
  let peak = cash, maxDrawdown = 0;
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const dailyReturns: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const price = bars[i].close;
    let enter = false, exit = false;
    if (config.strategy === "ma_crossover") {
      const fast = sma(bars, i, config.fastPeriod), slow = sma(bars, i, config.slowPeriod);
      enter = fast !== null && slow !== null && fast > slow;
      exit = fast !== null && slow !== null && fast < slow;
    } else if (config.strategy === "rsi_reversion") {
      const value = rsi(bars, i, config.rsiPeriod);
      enter = value !== null && value < config.oversold;
      exit = value !== null && value > config.overbought;
    } else if (i >= config.breakoutPeriod) {
      const window = bars.slice(i - config.breakoutPeriod, i).map(b => b.close);
      enter = price > Math.max(...window);
      exit = price < Math.min(...window);
    }
    if (shares > 0 && (exit || i === bars.length - 1)) {
      const proceeds = shares * price * (1 - fee);
      const pnl = proceeds - entryCost;
      trades.push({ id: trades.length + 1, entryDate, exitDate: bars[i].date, entryPrice, exitPrice: price, pnl: Math.round(pnl * 100) / 100, pnlPercent: (pnl / entryCost) * 100, duration: i - entryIndex, status: pnl >= 0 ? "Win" : "Loss" });
      cash = proceeds;
      shares = 0;
    }
    if (shares === 0 && enter && i < bars.length - 1) {
      entryCost = cash;
      shares = cash / (price * (1 + fee));
      cash = 0;
      entryPrice = price;
      entryDate = bars[i].date;
      entryIndex = i;
    }
    const value = cash + shares * price;
    const previous = equity.length ? equity[equity.length - 1].equity : config.initialCapital;
    dailyReturns.push((value - previous) / previous);
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100);
    equity.push({ date: bars[i].date, equity: Math.round(value * 100) / 100, benchmark: Math.round(config.initialCapital * price / bars[0].close * 100) / 100, close: price });
  }
  const wins = trades.filter(t => t.pnl > 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = -trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0);
  const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + (b - avg) ** 2, 0) / dailyReturns.length;
  const end = equity[equity.length - 1];
  return {
    equity, trades: trades.reverse(),
    metrics: {
      totalReturn: (end.equity / config.initialCapital - 1) * 100,
      benchmarkReturn: (end.benchmark / config.initialCapital - 1) * 100,
      maxDrawdown, winRate: trades.length ? wins.length / trades.length * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
      sharpeRatio: variance ? avg / Math.sqrt(variance) * Math.sqrt(252) : 0,
      totalTrades: trades.length, endingBalance: end.equity,
    },
    startDate: bars[0].date, endDate: end.date, barCount: bars.length,
  };
}
