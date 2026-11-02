import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  createFeatureFlag,
  getExperiment,
  getFeatureFlag,
  getInsight,
  getProject,
  listExperiments,
  listFeatureFlags,
  listInsights,
  listProjects,
  projectIdFrom,
  queryInsight,
  runHogqlQuery,
  tokenFromEnv,
  updateFeatureFlag,
} from "../src/posthog.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? JSON.stringify(step.payload),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://app.posthog.com/api";
const TOKEN = "phx_test";

describe("productmetrics core", () => {
  it("names the env var when the key is missing; resolves base and project fallback", () => {
    assert.throws(() => tokenFromEnv({}), /POSTHOG_API_KEY environment variable is required/);
    assert.equal(tokenFromEnv({ POSTHOG_API_KEY: " x " }), "x");
    assert.equal(apiBaseFromEnv({}), "https://app.posthog.com/api");
    assert.equal(apiBaseFromEnv({ POSTHOG_HOST: "https://eu.posthog.com/" }), "https://eu.posthog.com/api");
    assert.equal(apiBaseFromEnv({ POSTHOG_API_BASE_URL: "https://example.test/api/" }), "https://example.test/api");
    assert.equal(projectIdFrom("42", {}), "42");
    assert.equal(projectIdFrom(undefined, { POSTHOG_PROJECT_ID: "7" }), "7");
    assert.throws(() => projectIdFrom(undefined, {}), /POSTHOG_PROJECT_ID/);
  });

  it("list_projects gets /projects/ with Bearer auth", async () => {
    const { fn, calls } = fakeFetch([{ match: "/projects/", payload: { results: [{ id: 1 }] } }]);
    await listProjects(fn, TOKEN, BASE);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/");
    assert.equal(calls[0].headers.Authorization, "Bearer phx_test");
  });

  it("get_project gets /projects/{id}/", async () => {
    const { fn, calls } = fakeFetch([{ match: "/projects/9/", payload: { id: 9 } }]);
    await getProject(fn, TOKEN, BASE, { project_id: "9" });
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/9/");
  });

  it("list_insights and get_insight hit project-scoped insight paths", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/insights/i1/", payload: { id: "i1" } },
      { match: "/insights/", payload: { results: [] } },
    ]);
    await listInsights(fn, TOKEN, BASE, { project_id: "1", limit: 5 });
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/1/insights/?limit=5");
    await getInsight(fn, TOKEN, BASE, { insight_id: "i1", project_id: "1" });
    assert.equal(calls[1].url, "https://app.posthog.com/api/projects/1/insights/i1/");
  });

  it("query_insight requests a refresh of the insight", async () => {
    const { fn, calls } = fakeFetch([{ match: "/insights/i1/", payload: { result: [1] } }]);
    await queryInsight(fn, TOKEN, BASE, { insight_id: "i1", project_id: "1" });
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/1/insights/i1/?refresh=true");
  });

  it("run_hogql_query posts the HogQLQuery kind body", async () => {
    const { fn, calls } = fakeFetch([{ match: "/query/", payload: { results: [] } }]);
    await runHogqlQuery(fn, TOKEN, BASE, { query: "SELECT 1", project_id: "1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/1/query/");
    assert.deepEqual(calls[0].body, { query: { kind: "HogQLQuery", query: "SELECT 1" } });
  });

  it("list_feature_flags and get_feature_flag hit flag paths", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/feature_flags/f1/", payload: { id: "f1" } },
      { match: "/feature_flags/", payload: { results: [] } },
    ]);
    await listFeatureFlags(fn, TOKEN, BASE, { project_id: "1" });
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/1/feature_flags/");
    await getFeatureFlag(fn, TOKEN, BASE, { flag_id: "f1", project_id: "1" });
    assert.equal(calls[1].url, "https://app.posthog.com/api/projects/1/feature_flags/f1/");
  });

  it("create_feature_flag posts only provided fields", async () => {
    const { fn, calls } = fakeFetch([{ match: "/feature_flags/", payload: { id: 2 } }]);
    await createFeatureFlag(fn, TOKEN, BASE, { key: "new-ui", project_id: "1" });
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { key: "new-ui" });
    await createFeatureFlag(fn, TOKEN, BASE, { key: "k2", name: "K2", active: true, project_id: "1" });
    assert.deepEqual(calls[1].body, { key: "k2", name: "K2", active: true });
  });

  it("update_feature_flag patches provided fields only", async () => {
    const { fn, calls } = fakeFetch([{ match: "/feature_flags/f1/", payload: { id: "f1" } }]);
    await updateFeatureFlag(fn, TOKEN, BASE, { flag_id: "f1", active: false, project_id: "1" });
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].body, { active: false });
  });

  it("list_experiments and get_experiment hit experiment paths", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/experiments/e1/", payload: { id: "e1" } },
      { match: "/experiments/", payload: { results: [] } },
    ]);
    await listExperiments(fn, TOKEN, BASE, { project_id: "1", limit: 3 });
    assert.equal(calls[0].url, "https://app.posthog.com/api/projects/1/experiments/?limit=3");
    await getExperiment(fn, TOKEN, BASE, { experiment_id: "e1", project_id: "1" });
    assert.equal(calls[1].url, "https://app.posthog.com/api/projects/1/experiments/e1/");
  });

  it("surfaces upstream error status and detail", async () => {
    const { fn } = fakeFetch([{ match: "/projects/", payload: { detail: "forbidden" }, status: 403 }]);
    await assert.rejects(() => listProjects(fn, TOKEN, BASE), /PostHog API error 403: forbidden/);
  });

  it("returns {status} for an empty successful body", async () => {
    const { fn } = fakeFetch([{ match: "/projects/", payload: null, rawText: "", status: 200 }]);
    const out = (await listProjects(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.deepEqual(out, { status: 200 });
  });
});
