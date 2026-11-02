#!/usr/bin/env node
/**
 * productmetrics CLI.
 *   productmetrics <tool-name> '<json args>'
 *   productmetrics mcp
 * Requires POSTHOG_API_KEY. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./posthog.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "list_projects", "get_project", "list_insights", "get_insight",
  "query_insight", "run_hogql_query", "list_feature_flags", "get_feature_flag",
  "create_feature_flag", "update_feature_flag", "list_experiments", "get_experiment",
];

function usage(): never {
  console.error(`Usage:
  productmetrics <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  productmetrics mcp
  productmetrics --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, tokenFromEnv(), apiBaseFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
