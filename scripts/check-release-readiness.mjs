import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const requiredTables = [
  "cats",
  "collection_photos",
  "cat_moments",
  "cat_moment_deliveries",
  "account_sync_state",
];

const env = readEnvFile(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

console.log("Checking Supabase migrations...");
const migrationOutput = execFileSync("supabase", ["migration", "list"], {
  encoding: "utf8",
});
const pendingMigrations = migrationOutput
  .split(/\r?\n/)
  .filter((line) => /^\s*\d{14}\s+\|/.test(line))
  .filter((line) => line.split("|")[1]?.trim() === "");

if (pendingMigrations.length > 0) {
  fail(`Remote database is missing migrations:\n${pendingMigrations.join("\n")}`);
}

console.log("Checking required tables...");
for (const table of requiredTables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (![200, 401].includes(response.status)) {
    const body = await response.text();
    fail(`${table} is not reachable. HTTP ${response.status}: ${body}`);
  }
}

console.log("Checking cat_moments delivery pool is not anon-readable...");
const deliveryPoolResponse = await fetch(
  `${supabaseUrl}/rest/v1/cat_moments?select=id&visibility=eq.shared&delivery_status=eq.available&limit=1`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  },
);

if (deliveryPoolResponse.status === 200) {
  const rows = await deliveryPoolResponse.json().catch(() => null);

  if (Array.isArray(rows) && rows.length > 0) {
    fail("cat_moments shared delivery pool is readable with the anon key.");
  }
} else if (![401, 403].includes(deliveryPoolResponse.status)) {
  const body = await deliveryPoolResponse.text();
  fail(
    `cat_moments anon delivery-pool check returned unexpected HTTP ${deliveryPoolResponse.status}: ${body}`,
  );
}

console.log("Checking cat-photos storage bucket...");
const bucketResponse = await fetch(`${supabaseUrl}/storage/v1/object/list/cat-photos`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prefix: "", limit: 1, offset: 0 }),
});

if (![200, 400].includes(bucketResponse.status)) {
  const body = await bucketResponse.text();
  fail(`cat-photos bucket is not reachable. HTTP ${bucketResponse.status}: ${body}`);
}

console.log("Release readiness checks passed.");

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
        .filter(Boolean)
        .map((match) => [match[1], match[2]]),
    );
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
