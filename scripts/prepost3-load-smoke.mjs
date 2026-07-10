import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_LEVELS = [30, 60, 120];
const DEFAULT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.APP_URL || "http://localhost:3000";
const WRITE_BACKUP = process.env.LOAD_SMOKE_ALLOW_BACKUP_WRITES === "1";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lQn2swAAAABJRU5ErkJggg==";

const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
const levels = String(args.levels || DEFAULT_LEVELS.join(","))
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const outDir = String(args.outDir || "artifacts/prepost3-load-smoke");
const runId = new Date().toISOString().replace(/[:.]/g, "-");

if (levels.length === 0) {
  throw new Error("No valid load levels. Use --levels=30,60,120");
}

console.log(
  `[prepost3-load-smoke] base=${baseUrl} levels=${levels.join(",")} backupWrites=${WRITE_BACKUP}`,
);

const results = [];

for (const level of levels) {
  for (const target of buildTargets()) {
    const result = await runTargetLevel(target, level);
    results.push(result);
    printSummary(result);
  }
}

await mkdir(outDir, { recursive: true });
const outputPath = path.join(outDir, `${runId}.json`);
await writeFile(
  outputPath,
  JSON.stringify(
    {
      baseUrl,
      runId,
      generatedAt: new Date().toISOString(),
      notes: [
        "exchange uses debugDryRun=true by default to avoid writes.",
        "backup uses invalid_photo by default. Set LOAD_SMOKE_ALLOW_BACKUP_WRITES=1 only in local/preview test environments.",
      ],
      results,
    },
    null,
    2,
  ),
);

console.log(`[prepost3-load-smoke] wrote ${outputPath}`);

function buildTargets() {
  return [
    {
      name: "exchange-dry-run",
      method: "POST",
      path: "/api/sleeping-delivery/exchange",
      body: (index) => ({
        anonymousId: `load-smoke-anon-${runId}-${index}`,
        deliveryDateKey: "2026-07-10",
        debugDryRun: true,
        ownPhoto: {
          id: `load-smoke-own-${runId}-${index}`,
          catId: "load-smoke-cat",
          ownerCatId: "load-smoke-cat",
          src: tinyPng,
          createdAt: Date.now(),
          triggerLabel: "sleeping",
          theme: "sleeping",
        },
        seed: `load-smoke-${index}`,
        triggerLabel: "sleeping",
        theme: "sleeping",
      }),
      expectedStatuses: new Set([200, 422, 429, 500, 503]),
    },
    {
      name: "presence",
      method: "GET",
      path: "/api/presence",
      expectedStatuses: new Set([200]),
    },
    {
      name: "photo-signed-urls",
      method: "POST",
      path: "/api/photo-storage/signed-urls",
      body: (index) => ({
        anonymousId: `load-smoke-anon-${runId}-${index}`,
        paths: [`load-smoke/probe-${index}.webp`],
        variant: "thumbnail",
      }),
      expectedStatuses: new Set([200, 400, 401, 503]),
    },
    {
      name: WRITE_BACKUP ? "backup-write-opt-in" : "backup-safe-invalid",
      method: "POST",
      path: "/api/sleeping-delivery/backup",
      body: (index) =>
        WRITE_BACKUP
          ? {
              anonymousId: `load-smoke-backup-${runId}-${index}`,
              photo: {
                id: `load-smoke-backup-photo-${runId}-${index}`,
                catId: "load-smoke-cat",
                ownerCatId: "load-smoke-cat",
                src: tinyPng,
                state: "sleeping",
                visibility: "private",
                deliveryStatus: "available",
                triggerLabel: "sleeping",
                theme: "sleeping",
                shared: false,
                createdAt: Date.now(),
              },
            }
          : { anonymousId: `load-smoke-backup-${runId}-${index}`, photo: null },
      expectedStatuses: WRITE_BACKUP
        ? new Set([200, 400, 429, 500, 503])
        : new Set([400, 429, 503]),
    },
  ];
}

async function runTargetLevel(target, level) {
  const requests = Array.from({ length: level }, (_, index) =>
    timeRequest(target, index),
  );
  const responses = await Promise.all(requests);
  const latencies = responses.map((response) => response.ms).sort((a, b) => a - b);
  const statusCounts = new Map();
  let unexpectedStatusCount = 0;
  let networkErrorCount = 0;

  for (const response of responses) {
    const statusKey = response.status === null ? "network_error" : String(response.status);
    statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
    if (response.status === null) {
      networkErrorCount += 1;
    } else if (!target.expectedStatuses.has(response.status)) {
      unexpectedStatusCount += 1;
    }
  }

  return {
    target: target.name,
    level,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: Math.max(...latencies),
    errorRate: Number(((networkErrorCount + unexpectedStatusCount) / level).toFixed(4)),
    networkErrorCount,
    unexpectedStatusCount,
    statusCounts: Object.fromEntries(statusCounts),
    sampleErrors: responses
      .filter((response) => response.error || response.unexpectedStatus)
      .slice(0, 5),
  };
}

async function timeRequest(target, index) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${target.path}`, {
      method: target.method,
      headers:
        target.method === "POST"
          ? {
              "content-type": "application/json",
              "x-forwarded-for": `198.51.100.${(index % 200) + 1}`,
            }
          : {
              "x-forwarded-for": `198.51.100.${(index % 200) + 1}`,
            },
      body:
        target.method === "POST"
          ? JSON.stringify(typeof target.body === "function" ? target.body(index) : target.body)
          : undefined,
    });
    const text = await response.text().catch(() => "");
    const ms = Math.round(performance.now() - startedAt);
    const unexpectedStatus = !target.expectedStatuses.has(response.status);

    return {
      index,
      status: response.status,
      ms,
      unexpectedStatus,
      bodySample: unexpectedStatus ? text.slice(0, 220) : undefined,
    };
  } catch (error) {
    return {
      index,
      status: null,
      ms: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * fraction) - 1,
  );
  return sortedValues[index];
}

function printSummary(result) {
  console.log(
    [
      `[${result.target}]`,
      `n=${result.level}`,
      `p50=${result.p50Ms}ms`,
      `p95=${result.p95Ms}ms`,
      `max=${result.maxMs}ms`,
      `errorRate=${result.errorRate}`,
      `statuses=${JSON.stringify(result.statusCounts)}`,
    ].join(" "),
  );
}

function parseArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const normalized = arg.replace(/^--/, "");
      const [key, ...rest] = normalized.split("=");
      return [key, rest.length > 0 ? rest.join("=") : "true"];
    }),
  );
}
