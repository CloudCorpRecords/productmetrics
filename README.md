# productmetrics

PostHog product analytics as MCP tools, talking to the PostHog REST
API. productmetrics is a clean-room rebuild of the core surface of
the PostHog MCP server, under a new name: fresh code, no copied
branding. The original is PostHog's hosted remote MCP (OAuth);
hosted OAuth is NOT reproduced — this rebuild is a
personal-API-key REST client for the same API.

## Tools (core subset, 12)

`list_projects`, `get_project`, `list_insights`, `get_insight`,
`query_insight`, `run_hogql_query`, `list_feature_flags`,
`get_feature_flag`, `create_feature_flag`, `update_feature_flag`,
`list_experiments`, `get_experiment`.

Not in this subset: events and persons, actions and cohorts,
annotations, dashboards, data warehouse, error tracking, surveys,
session recordings, subscriptions, and organization admin tools.

## Setup

Create a personal API key in PostHog and set it:

```bash
export POSTHOG_API_KEY=phx_...
export POSTHOG_PROJECT_ID=12345   # optional default project
```

Optionally override the host with `POSTHOG_HOST` (for example the EU
host) or the full base with `POSTHOG_API_BASE_URL` (default
`https://app.posthog.com/api`). Without the key, every tool call fails
with an error naming the missing variable. Pass `project_id` per call
or rely on the `POSTHOG_PROJECT_ID` fallback.

## CLI

```bash
npx @reneturcios/productmetrics list_projects '{}'
npx @reneturcios/productmetrics mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "productmetrics": {
      "command": "npx",
      "args": ["-y", "@reneturcios/productmetrics", "mcp"],
      "env": { "POSTHOG_API_KEY": "phx_..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e POSTHOG_API_KEY ghcr.io/cloudcorprecords/productmetrics
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
