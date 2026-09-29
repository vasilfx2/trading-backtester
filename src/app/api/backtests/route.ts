import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { backtestRuns } from "@/db/schema";
import { generateSampleData, runBacktest, type BacktestConfig, type Bar } from "@/lib/backtest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt)).limit(20);
    return NextResponse.json(rows.map(row => ({ id: row.id, config: row.config, result: row.result, createdAt: row.createdAt.toISOString() })));
  } catch {
    return NextResponse.json({ error: "Could not load saved runs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = body.config as BacktestConfig;
    if (!raw || typeof raw !== "object") throw new Error("Strategy settings are required.");
    if (!(["SPY", "BTC", "AAPL", "CUSTOM"] as string[]).includes(raw.dataset)) throw new Error("Select a valid dataset.");
    const config: BacktestConfig = {
      name: String(raw.name || "Untitled strategy").trim().slice(0, 80) || "Untitled strategy",
      strategy: raw.strategy,
      dataset: raw.dataset,
      initialCapital: Number(raw.initialCapital), fastPeriod: Number(raw.fastPeriod), slowPeriod: Number(raw.slowPeriod),
      rsiPeriod: Number(raw.rsiPeriod), oversold: Number(raw.oversold), overbought: Number(raw.overbought),
      breakoutPeriod: Number(raw.breakoutPeriod), feePercent: Number(raw.feePercent),
    };
    let bars: Bar[];
    if (config.dataset === "CUSTOM") {
      const input = body.bars;
      if (!Array.isArray(input) || input.length < 30 || input.length > 5000) throw new Error("Upload a CSV with 30 to 5,000 valid rows.");
      bars = input.map((item: Bar) => ({ date: String(item.date), close: Number(item.close) }));
      if (bars.some(b => !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || Number.isNaN(new Date(b.date).getTime()) || !Number.isFinite(b.close) || b.close <= 0)) throw new Error("CSV contains invalid dates or closing prices.");
      bars.sort((a, b) => a.date.localeCompare(b.date));
      if (bars.some((b, i) => i > 0 && b.date === bars[i - 1].date)) throw new Error("CSV contains duplicate dates.");
    } else {
      bars = generateSampleData(config.dataset);
    }
    const result = runBacktest(config, bars);
    const [row] = await db.insert(backtestRuns).values({ name: config.name, config, result }).returning();
    return NextResponse.json({ id: row.id, config: row.config, result: row.result, createdAt: row.createdAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run backtest." }, { status: 400 });
  }
}
