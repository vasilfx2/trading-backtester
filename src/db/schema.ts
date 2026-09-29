import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { BacktestConfig, BacktestResult } from "@/lib/backtest";

export const backtestRuns = pgTable("backtest_runs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").$type<BacktestConfig>().notNull(),
  result: jsonb("result").$type<BacktestResult>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
