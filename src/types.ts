/**
 * productmetrics types.
 *
 * A core subset of the PostHog MCP surface: projects, insights, HogQL,
 * feature flags and experiments against the PostHog REST API. HTTP
 * access is described by a minimal response surface so tests can
 * inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface ProjectOptions { project_id?: string; }
export interface ListInsightsOptions { project_id?: string; limit?: number; }
export interface GetInsightOptions { insight_id: string; project_id?: string; }
export interface RunHogQLOptions { query: string; project_id?: string; }
export interface ListFlagsOptions { project_id?: string; limit?: number; }
export interface GetFlagOptions { flag_id: string; project_id?: string; }
export interface CreateFlagOptions { key: string; name?: string; active?: boolean; project_id?: string; }
export interface UpdateFlagOptions { flag_id: string; name?: string; active?: boolean; project_id?: string; }
export interface ListExperimentsOptions { project_id?: string; limit?: number; }
export interface GetExperimentOptions { experiment_id: string; project_id?: string; }
