import { desc } from "drizzle-orm";
import { db } from "@/db";
import { backtestRuns } from "@/db/schema";
import { defaultConfig, generateSampleData, runBacktest, type SavedRun } from "@/lib/backtest";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let savedRuns: SavedRun[] = [];
  try {
    const rows = await db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt)).limit(20);
    savedRuns = rows.map(row => ({ id: row.id, config: row.config, result: row.result, createdAt: row.createdAt.toISOString() }));
  } catch (error) {
    console.error("Could not load backtest history:", error);
  }
  const demoRun: SavedRun = {
    id: 0,
    config: defaultConfig,
    result: runBacktest(defaultConfig, generateSampleData("SPY")),
    createdAt: "2025-08-11T10:00:00.000Z",
  };
  return <Dashboard initialRuns={savedRuns} demoRun={demoRun} />;
}
