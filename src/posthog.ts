/**
 * productmetrics core: a 12-tool core subset of the PostHog MCP server
 * surface, implemented clean-room against the public PostHog REST API
 * (https://app.posthog.com/api, host overridable via POSTHOG_HOST, base
 * overridable via POSTHOG_API_BASE_URL).
 *
 * Auth: POSTHOG_API_KEY (personal API key), sent as
 * `Authorization: Bearer`. A project is selected per call via the
 * project_id argument or the POSTHOG_PROJECT_ID fallback. A missing
 * key is an error naming the variable. All HTTP goes through an
 * injected FetchFn so the wire behaviour is fully testable offline.
 *
 * Note: the original is PostHog's hosted remote MCP (OAuth); hosted
 * OAuth NOT reproduced — this is a personal-API-key REST client for
 * the same API.
 */
import type {
  CreateFlagOptions,
  FetchFn,
  GetExperimentOptions,
  GetFlagOptions,
  GetInsightOptions,
  ListExperimentsOptions,
  ListFlagsOptions,
  ListInsightsOptions,
  ProjectOptions,
  RunHogQLOptions,
  UpdateFlagOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://app.posthog.com/api";

export function tokenFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.POSTHOG_API_KEY;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) throw new Error("POSTHOG_API_KEY environment variable is required");
  return token;
}

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const explicit = typeof env.POSTHOG_API_BASE_URL === "string" ? env.POSTHOG_API_BASE_URL.trim() : "";
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = typeof env.POSTHOG_HOST === "string" ? env.POSTHOG_HOST.trim() : "";
  if (host) return `${host.replace(/\/+$/, "")}/api`;
  return DEFAULT_API_BASE;
}

export function projectIdFrom(argsProjectId?: string, env: Record<string, string | undefined> = process.env): string {
  const fromArgs = typeof argsProjectId === "string" ? argsProjectId.trim() : "";
  if (fromArgs) return fromArgs;
  const fromEnv = typeof env.POSTHOG_PROJECT_ID === "string" ? env.POSTHOG_PROJECT_ID.trim() : "";
  if (fromEnv) return fromEnv;
  throw new Error("project_id is required (pass project_id or set POSTHOG_PROJECT_ID)");
}

interface RequestSpec { method: string; path: string; body?: unknown; }

async function apiRequest(fetchFn: FetchFn, token: string, base: string, spec: RequestSpec): Promise<unknown> {
  const res = await fetchFn(`${base}${spec.path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch { /* keep raw */ }
    throw new Error(`PostHog API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out;
}
const enc = encodeURIComponent;

export async function listProjects(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: "/projects/" });
}
export async function getProject(fetchFn: FetchFn, token: string, base: string, opts: ProjectOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/` });
}
export async function listInsights(fetchFn: FetchFn, token: string, base: string, opts: ListInsightsOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/insights/${query({ limit: opts.limit })}` });
}
export async function getInsight(fetchFn: FetchFn, token: string, base: string, opts: GetInsightOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/insights/${enc(opts.insight_id)}/` });
}
export async function queryInsight(fetchFn: FetchFn, token: string, base: string, opts: GetInsightOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/insights/${enc(opts.insight_id)}/?refresh=true` });
}
export async function runHogqlQuery(fetchFn: FetchFn, token: string, base: string, opts: RunHogQLOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/projects/${enc(pid)}/query/`,
    body: { query: { kind: "HogQLQuery", query: opts.query } },
  });
}
export async function listFeatureFlags(fetchFn: FetchFn, token: string, base: string, opts: ListFlagsOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/feature_flags/${query({ limit: opts.limit })}` });
}
export async function getFeatureFlag(fetchFn: FetchFn, token: string, base: string, opts: GetFlagOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/feature_flags/${enc(opts.flag_id)}/` });
}
export async function createFeatureFlag(fetchFn: FetchFn, token: string, base: string, opts: CreateFlagOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/projects/${enc(pid)}/feature_flags/`,
    body: clean({ key: opts.key, name: opts.name, active: opts.active }),
  });
}
export async function updateFeatureFlag(fetchFn: FetchFn, token: string, base: string, opts: UpdateFlagOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, {
    method: "PATCH",
    path: `/projects/${enc(pid)}/feature_flags/${enc(opts.flag_id)}/`,
    body: clean({ name: opts.name, active: opts.active }),
  });
}
export async function listExperiments(fetchFn: FetchFn, token: string, base: string, opts: ListExperimentsOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/experiments/${query({ limit: opts.limit })}` });
}
export async function getExperiment(fetchFn: FetchFn, token: string, base: string, opts: GetExperimentOptions): Promise<unknown> {
  const pid = projectIdFrom(opts.project_id);
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/projects/${enc(pid)}/experiments/${enc(opts.experiment_id)}/` });
}

export async function callTool(fetchFn: FetchFn, token: string, base: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_projects": return listProjects(fetchFn, token, base);
    case "get_project": return getProject(fetchFn, token, base, args as unknown as ProjectOptions);
    case "list_insights": return listInsights(fetchFn, token, base, args as unknown as ListInsightsOptions);
    case "get_insight": return getInsight(fetchFn, token, base, args as unknown as GetInsightOptions);
    case "query_insight": return queryInsight(fetchFn, token, base, args as unknown as GetInsightOptions);
    case "run_hogql_query": return runHogqlQuery(fetchFn, token, base, args as unknown as RunHogQLOptions);
    case "list_feature_flags": return listFeatureFlags(fetchFn, token, base, args as unknown as ListFlagsOptions);
    case "get_feature_flag": return getFeatureFlag(fetchFn, token, base, args as unknown as GetFlagOptions);
    case "create_feature_flag": return createFeatureFlag(fetchFn, token, base, args as unknown as CreateFlagOptions);
    case "update_feature_flag": return updateFeatureFlag(fetchFn, token, base, args as unknown as UpdateFlagOptions);
    case "list_experiments": return listExperiments(fetchFn, token, base, args as unknown as ListExperimentsOptions);
    case "get_experiment": return getExperiment(fetchFn, token, base, args as unknown as GetExperimentOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
