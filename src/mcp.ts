/**
 * productmetrics MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./posthog.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_projects: z.object({}),
  get_project: z.object({ project_id: z.string().optional() }),
  list_insights: z.object({ project_id: z.string().optional(), limit: z.number().optional() }),
  get_insight: z.object({ insight_id: z.string(), project_id: z.string().optional() }),
  query_insight: z.object({ insight_id: z.string(), project_id: z.string().optional() }),
  run_hogql_query: z.object({ query: z.string(), project_id: z.string().optional() }),
  list_feature_flags: z.object({ project_id: z.string().optional(), limit: z.number().optional() }),
  get_feature_flag: z.object({ flag_id: z.string(), project_id: z.string().optional() }),
  create_feature_flag: z.object({ key: z.string(), name: z.string().optional(), active: z.boolean().optional(), project_id: z.string().optional() }),
  update_feature_flag: z.object({ flag_id: z.string(), name: z.string().optional(), active: z.boolean().optional(), project_id: z.string().optional() }),
  list_experiments: z.object({ project_id: z.string().optional(), limit: z.number().optional() }),
  get_experiment: z.object({ experiment_id: z.string(), project_id: z.string().optional() }),
};

export const TOOLS = [
  {
    name: "list_projects",
    description: "List PostHog projects the API key can access.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "get_project",
    description: "Retrieve a PostHog project by ID, or the configured default project.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "Optional ID of the PostHog project to retrieve; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: [] as string[] },
  },
  {
    name: "list_insights",
    description: "List insights in a PostHog project.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "Optional ID of the PostHog project to list insights from; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." }, limit: { type: "number", description: "Optional maximum number of insights to return, sent as the limit query parameter." } }, required: [] as string[] },
  },
  {
    name: "get_insight",
    description: "Retrieve a single PostHog insight by ID.",
    inputSchema: { type: "object" as const, properties: { insight_id: { type: "string", description: "The ID of the PostHog insight to retrieve." }, project_id: { type: "string", description: "Optional ID of the PostHog project the insight belongs to; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["insight_id"] },
  },
  {
    name: "query_insight",
    description: "Run a PostHog insight and return its query results.",
    inputSchema: { type: "object" as const, properties: { insight_id: { type: "string", description: "The ID of the PostHog insight to run; the request forces a refresh with refresh=true." }, project_id: { type: "string", description: "Optional ID of the PostHog project the insight belongs to; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["insight_id"] },
  },
  {
    name: "run_hogql_query",
    description: "Run a HogQL query against a PostHog project.",
    inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "The HogQL query text to run against the project." }, project_id: { type: "string", description: "Optional ID of the PostHog project to run the query against; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["query"] },
  },
  {
    name: "list_feature_flags",
    description: "List feature flags in a PostHog project.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "Optional ID of the PostHog project to list feature flags from; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." }, limit: { type: "number", description: "Optional maximum number of feature flags to return, sent as the limit query parameter." } }, required: [] as string[] },
  },
  {
    name: "get_feature_flag",
    description: "Retrieve a single PostHog feature flag by ID.",
    inputSchema: { type: "object" as const, properties: { flag_id: { type: "string", description: "The ID of the PostHog feature flag to retrieve." }, project_id: { type: "string", description: "Optional ID of the PostHog project the flag belongs to; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["flag_id"] },
  },
  {
    name: "create_feature_flag",
    description: "Create a feature flag in a PostHog project.",
    inputSchema: { type: "object" as const, properties: { key: { type: "string", description: "The unique key of the new feature flag." }, name: { type: "string", description: "Optional human-readable name for the new feature flag." }, active: { type: "boolean", description: "Optional initial active state of the new feature flag." }, project_id: { type: "string", description: "Optional ID of the PostHog project to create the flag in; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["key"] },
  },
  {
    name: "update_feature_flag",
    description: "Update a PostHog feature flag by ID.",
    inputSchema: { type: "object" as const, properties: { flag_id: { type: "string", description: "The ID of the PostHog feature flag to update." }, name: { type: "string", description: "Optional new human-readable name for the flag; omitted fields are left unchanged." }, active: { type: "boolean", description: "Optional new active state: true activates the flag, false deactivates it." }, project_id: { type: "string", description: "Optional ID of the PostHog project the flag belongs to; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["flag_id"] },
  },
  {
    name: "list_experiments",
    description: "List experiments in a PostHog project.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "Optional ID of the PostHog project to list experiments from; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." }, limit: { type: "number", description: "Optional maximum number of experiments to return, sent as the limit query parameter." } }, required: [] as string[] },
  },
  {
    name: "get_experiment",
    description: "Retrieve a single PostHog experiment by ID.",
    inputSchema: { type: "object" as const, properties: { experiment_id: { type: "string", description: "The ID of the PostHog experiment to retrieve." }, project_id: { type: "string", description: "Optional ID of the PostHog project the experiment belongs to; when omitted, the POSTHOG_PROJECT_ID environment fallback is used." } }, required: ["experiment_id"] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "productmetrics", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, apiBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
