# productmetrics — BUILD REPORT

Original: posthog (PostHog hosted remote MCP) → Rebuild: productmetrics
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the PostHog REST API (https://app.posthog.com/api,
host overridable via POSTHOG_HOST, base overridable via
POSTHOG_API_BASE_URL), Authorization: Bearer POSTHOG_API_KEY
(personal API key) on every request, project selected per call via
project_id or the POSTHOG_PROJECT_ID fallback, all HTTP behind an
injectable FetchFn:
list_projects (GET /projects/), get_project (GET /projects/{id}/),
list_insights (GET /projects/{id}/insights/), get_insight
(GET /projects/{id}/insights/{id}/), query_insight (same path with
?refresh=true), run_hogql_query (POST /projects/{id}/query/ with the
HogQLQuery kind body), list_feature_flags
(GET /projects/{id}/feature_flags/), get_feature_flag,
create_feature_flag (POST, provided fields only), update_feature_flag
(PATCH, provided fields only), list_experiments
(GET /projects/{id}/experiments/), get_experiment.

Omitted groups (fixture `_source` lists them): events and persons,
actions and cohorts, annotations, dashboards and dashboard items,
data warehouse, error tracking, surveys, session recordings,
subscriptions, organization and user admin tools.

Ground truth: schemas are docs-derived from the public PostHog API
documentation. Fixture: harness/fixtures/posthog-tools-original.json
(labelled core-subset). The original is PostHog's hosted remote MCP
(OAuth); hosted OAuth NOT reproduced — this is a personal-API-key
REST client for the same API.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 12/12 pass (fake FetchFn; URL/method/Bearer header/body
  shaping for every tool, POSTHOG_HOST and POSTHOG_API_BASE_URL
  resolution, project_id argument/env fallback and its error,
  provided-fields-only flag bodies, upstream error surfacing,
  empty-body {status} handling, missing-key error).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env checks: CLI list_projects with POSTHOG_API_KEY unset →
  "error: POSTHOG_API_KEY environment variable is required", exit 1;
  stdio tools/call list_projects with the key unset returned isError
  "POSTHOG_API_KEY environment variable is required".
- server.json description 63 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/productmetrics; full 19-file factory set
  present.

## Honest gaps
- No live PostHog call was made — request/response behaviour is
  fake-fetch proven only.
- query_insight uses the insight GET with ?refresh=true rather than a
  dedicated async query job flow; long-running insights may need the
  query endpoint in a later pass.
- Feature-flag filters (rollout groups/conditions) are not exposed in
  this subset; create/update cover key, name and active only.
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- Hosted OAuth surface of the original remote server is not
  reproduced (see Scope).
